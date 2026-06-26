#!/usr/bin/env python3
"""
Redeploy the Dockerized AI Scale System to the production server.

This script is intended for the post-cutover environment where:
- the server already runs docker compose
- /opt/ai-scale-system/shared/.env.production already exists
- nginx is already configured and points to 127.0.0.1:3000

It performs a low-downtime application redeploy:
1. package the Git-tracked release files
2. upload a new release directory
3. optionally trigger a database backup
4. build the app image on the server
5. ensure the db container is up
6. run prisma migrate deploy in a one-off app container
7. recreate the app container
8. switch /opt/ai-scale-system/current after health checks pass
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import posixpath
import subprocess
import sys
import tarfile
import tempfile
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import paramiko


REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_HOST = "tongyimohe.cloud"
DEFAULT_USER = "root"
DEFAULT_PORT = 22
DEFAULT_APP_BASE = "/opt/ai-scale-system"
DEFAULT_ENV_PATH = "/opt/ai-scale-system/shared/.env.production"
DEFAULT_BACKUP_DIR = "/var/backups/ai-scale-system/postgres"
DEFAULT_DOMAIN = "tongyimohe.cloud"

EXCLUDED_TOP_LEVEL = {
    ".git",
    ".next",
    "node_modules",
    ".codebuddy",
    ".claude",
    ".vscode",
    "__pycache__",
}
EXCLUDED_FILES = {
    ".env",
    ".env.local",
    ".env.production",
    ".env.development.local",
    ".env.test.local",
    ".env.production.local",
}
EXCLUDED_PREFIXES = ("tmp_", "Userslishuaishuai.claudeplans")
EXCLUDED_SUFFIXES = (".log", ".tmp", ".temp", ".pyc")
EXCLUDED_DIR_PARTS = {"tmp_mmse_pages"}


@dataclass
class DeployConfig:
    host: str
    user: str
    port: int
    password: str | None
    key_path: str | None
    app_base: str
    env_path: str
    backup_dir: str
    domain: str
    skip_backup: bool
    skip_prisma_migrate: bool
    prepare_only: bool
    keep_releases: int
    diff_only: bool
    diff_limit: int

    @property
    def current_link(self) -> str:
        return posixpath.join(self.app_base, "current")

    @property
    def releases_dir(self) -> str:
        return posixpath.join(self.app_base, "releases")


def should_skip(rel_path: str, is_dir: bool) -> bool:
    parts = [part for part in rel_path.split("/") if part]
    if not parts:
        return False

    for part in parts:
        if part in EXCLUDED_TOP_LEVEL:
            return True
        if part in EXCLUDED_DIR_PARTS:
            return True
        if part.startswith(EXCLUDED_PREFIXES):
            return True

    name = parts[-1]
    if name in EXCLUDED_FILES:
        return True
    if name.startswith(".env.") and name.endswith(".local"):
        return True
    if name.startswith(EXCLUDED_PREFIXES):
        return True
    if name.endswith(EXCLUDED_SUFFIXES):
        return True

    return False


def normalize_release_bytes(path: Path) -> bytes:
    data = path.read_bytes()
    if path.suffix == ".sh":
        return data.replace(b"\r\r\n", b"\n").replace(b"\r\n", b"\n").replace(b"\r", b"\n")
    return data


def git_tracked_release_files(repo_root: Path = REPO_ROOT) -> list[str]:
    result = subprocess.run(
        ["git", "-C", str(repo_root), "ls-files", "-z"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    rel_paths = [
        item.decode("utf-8")
        for item in result.stdout.split(b"\0")
        if item
    ]
    return [
        rel_path
        for rel_path in sorted(rel_paths)
        if not should_skip(rel_path, False)
        and (repo_root / rel_path).is_file()
    ]


def build_release_manifest(repo_root: Path = REPO_ROOT) -> dict[str, dict[str, int | str]]:
    manifest: dict[str, dict[str, int | str]] = {}
    for rel_path in git_tracked_release_files(repo_root):
        data = normalize_release_bytes(repo_root / rel_path)
        manifest[rel_path] = {
            "sha256": hashlib.sha256(data).hexdigest(),
            "size": len(data),
        }
    return manifest


def diff_manifests(
    candidate: dict[str, dict[str, int | str]],
    current: dict[str, dict[str, int | str]],
) -> dict[str, list[str]]:
    candidate_paths = set(candidate)
    current_paths = set(current)
    common_paths = candidate_paths & current_paths
    return {
        "added": sorted(candidate_paths - current_paths),
        "deleted": sorted(current_paths - candidate_paths),
        "modified": sorted(
            path
            for path in common_paths
            if candidate[path].get("sha256") != current[path].get("sha256")
            or candidate[path].get("size") != current[path].get("size")
        ),
    }


def validate_release_manifest(manifest: dict[str, dict[str, int | str]]) -> None:
    risky = [
        rel_path
        for rel_path in manifest
        if rel_path in EXCLUDED_FILES
        or (rel_path.startswith(".env.") and not rel_path.endswith(".example"))
        or rel_path.endswith((".pem", ".key", ".crt"))
        or rel_path.startswith(("secrets/", ".secrets/"))
    ]
    if risky:
        raise RuntimeError(
            "Release manifest contains local-only or secret-like files: "
            + ", ".join(sorted(risky)[:20])
        )


def render_manifest_diff(diff: dict[str, list[str]], *, limit: int) -> str:
    lines = ["Release diff against remote current:"]
    for key in ("added", "modified", "deleted"):
        values = diff[key]
        lines.append(f"  {key}: {len(values)}")
        for rel_path in values[:limit]:
            lines.append(f"    {rel_path}")
        if len(values) > limit:
            lines.append(f"    ... {len(values) - limit} more")
    return "\n".join(lines)


def create_release_tarball(output_path: Path, repo_root: Path = REPO_ROOT) -> None:
    def add_file(tar: tarfile.TarFile, path: Path, arcname: str) -> None:
        stat_result = path.stat()
        data = normalize_release_bytes(path)

        info = tarfile.TarInfo(name=arcname)
        info.size = len(data)
        info.mode = stat_result.st_mode & 0o7777
        info.mtime = int(stat_result.st_mtime)
        info.uid = stat_result.st_uid
        info.gid = stat_result.st_gid
        tar.addfile(info, io.BytesIO(data))

    with tarfile.open(output_path, "w:gz") as tar:
        for rel_path in git_tracked_release_files(repo_root):
            add_file(tar, repo_root / rel_path, rel_path)


def create_ssh_client(config: DeployConfig) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {config.user}@{config.host}:{config.port} ...")
    connect_kwargs: dict[str, object] = {
        "hostname": config.host,
        "port": config.port,
        "username": config.user,
        "timeout": 30,
    }
    if config.password:
        connect_kwargs["password"] = config.password
    if config.key_path:
        connect_kwargs["key_filename"] = config.key_path
    client.connect(**connect_kwargs)
    print("Connected.")
    return client


def run_remote(
    client: paramiko.SSHClient,
    command: str,
    *,
    timeout: int = 1800,
    check: bool = True,
    echo_output: bool = True,
) -> str:
    print(f"  > {command[:140]}{'...' if len(command) > 140 else ''}", flush=True)
    stdin, stdout, stderr = client.exec_command(command, timeout=timeout)

    channel = stdout.channel
    out = bytearray()
    err = bytearray()
    while True:
        drained = False
        while channel.recv_ready():
            out.extend(channel.recv(8192))
            drained = True
        while channel.recv_stderr_ready():
            err.extend(channel.recv_stderr(8192))
            drained = True
        if channel.exit_status_ready() and not channel.recv_ready() and not channel.recv_stderr_ready():
            break
        if not drained:
            time.sleep(0.1)

    exit_code = channel.recv_exit_status()
    output_text = out.decode("utf-8", errors="replace")
    err_text = err.decode("utf-8", errors="replace").strip()
    if echo_output:
        for line in output_text.splitlines():
            line = line.rstrip()
            if line:
                safe = line.encode("ascii", errors="replace").decode("ascii")
                print(f"    {safe}", flush=True)
    if err_text:
        err_lines = err_text.splitlines()
        for err_line in err_lines[-80:]:
            safe = err_line.encode("ascii", errors="replace").decode("ascii")
            print(f"    [stderr] {safe}", flush=True)

    if check and exit_code != 0:
        raise RuntimeError(f"Remote command failed with exit code {exit_code}: {command}")
    return output_text.strip()


def upload_file(client: paramiko.SSHClient, local_path: Path, remote_path: str) -> None:
    print(f"Uploading {local_path.name} -> {remote_path}")
    sftp = client.open_sftp()
    try:
        sftp.put(str(local_path), remote_path)
    finally:
        sftp.close()


def shell_quote(value: str) -> str:
    return "'" + value.replace("'", "'\"'\"'") + "'"


def remote_manifest_command(current_link: str) -> str:
    script = r"""
import hashlib
import json
import os

skip_top = {".git", ".next", "node_modules", ".codebuddy", ".claude", ".vscode", "__pycache__"}
skip_files = {".env", ".env.local", ".env.production", ".env.development.local", ".env.test.local", ".env.production.local"}
skip_dir_parts = {"tmp_mmse_pages"}
skip_prefixes = ("tmp_", "Userslishuaishuai.claudeplans")
skip_suffixes = (".log", ".tmp", ".temp", ".pyc")

def should_skip(rel_path):
    parts = [part for part in rel_path.split("/") if part]
    if not parts:
        return False
    for part in parts:
        if part in skip_top or part in skip_dir_parts or part.startswith(skip_prefixes):
            return True
    name = parts[-1]
    return (
        name in skip_files
        or (name.startswith(".env.") and name.endswith(".local"))
        or name.startswith(skip_prefixes)
        or name.endswith(skip_suffixes)
    )

manifest = {}
for root, dirs, files in os.walk("."):
    rel_root = root[2:] if root.startswith("./") else root
    dirs[:] = [
        name for name in dirs
        if not should_skip(f"{rel_root}/{name}" if rel_root != "." else name)
    ]
    for name in files:
        rel_path = f"{rel_root}/{name}" if rel_root != "." else name
        rel_path = rel_path.replace("\\", "/")
        if should_skip(rel_path):
            continue
        with open(rel_path, "rb") as fh:
            data = fh.read()
        if rel_path.endswith(".sh"):
            data = data.replace(b"\r\n", b"\n")
        manifest[rel_path] = {"sha256": hashlib.sha256(data).hexdigest(), "size": len(data)}
print(json.dumps(manifest, sort_keys=True, ensure_ascii=False))
"""
    return f"cd {shell_quote(current_link)} && python3 - <<'PY'\n{script}\nPY"


def fetch_remote_manifest(
    client: paramiko.SSHClient,
    config: DeployConfig,
) -> dict[str, dict[str, int | str]]:
    raw_manifest = run_remote(
        client,
        remote_manifest_command(config.current_link),
        timeout=120,
        echo_output=False,
    )
    return json.loads(raw_manifest)


def print_remote_status(client: paramiko.SSHClient, config: DeployConfig) -> None:
    print("Reading remote status ...")
    run_remote(
        client,
        " && ".join(
            [
                "echo 'remote identity:'",
                "hostname",
                "whoami",
                "date -Is",
                "echo 'current release:'",
                f"readlink -f {shell_quote(config.current_link)} || true",
                "echo 'compose ps:'",
                f"cd {shell_quote(config.current_link)} && env APP_ENV_FILE={shell_quote(config.env_path)} "
                f"docker compose -f docker-compose.prod.yml --env-file {shell_quote(config.env_path)} ps",
                "echo 'health:'",
                "printf 'local='",
                "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/health || true",
                "echo",
                "printf 'public='",
                f"curl -k -s -o /dev/null -w '%{{http_code}}' https://{config.domain}/api/health || true",
                "echo",
            ]
        ),
        timeout=120,
    )


def prisma_migrate_command(compose_prefix: str) -> str:
    return f"{compose_prefix} run --rm --no-deps app npx prisma migrate deploy"


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Redeploy the Dockerized AI Scale System.")
    parser.add_argument("--host", default=os.environ.get("DEPLOY_HOST", DEFAULT_HOST))
    parser.add_argument("--user", default=os.environ.get("DEPLOY_USER", DEFAULT_USER))
    parser.add_argument("--port", type=int, default=int(os.environ.get("DEPLOY_PORT", DEFAULT_PORT)))
    parser.add_argument("--password-env", default="DEPLOY_PASSWORD")
    parser.add_argument("--key-path", default=os.environ.get("DEPLOY_KEY_PATH"))
    parser.add_argument("--app-base", default=DEFAULT_APP_BASE)
    parser.add_argument("--env-path", default=DEFAULT_ENV_PATH)
    parser.add_argument("--backup-dir", default=DEFAULT_BACKUP_DIR)
    parser.add_argument("--domain", default=os.environ.get("DEPLOY_DOMAIN", DEFAULT_DOMAIN))
    parser.add_argument("--skip-backup", action="store_true")
    parser.add_argument("--skip-prisma-migrate", action="store_true")
    parser.add_argument(
        "--prepare-only",
        action="store_true",
        help="Upload, backup, build, and ensure db, then stop before Prisma/app/current changes.",
    )
    parser.add_argument("--keep-releases", type=int, default=3)
    parser.add_argument("--diff-only", action="store_true")
    parser.add_argument("--diff-limit", type=int, default=40)
    return parser


def parse_args() -> DeployConfig:
    parser = build_arg_parser()
    args = parser.parse_args()

    password = os.environ.get(args.password_env)
    key_path = args.key_path
    if key_path and not Path(key_path).expanduser().is_file():
        parser.error(f"SSH key path does not exist: {key_path}")
    if not password and not key_path:
        parser.error(
            f"Missing SSH credentials. Set {args.password_env} or DEPLOY_KEY_PATH/--key-path."
        )

    return DeployConfig(
        host=args.host,
        user=args.user,
        port=args.port,
        password=password,
        key_path=str(Path(key_path).expanduser()) if key_path else None,
        app_base=args.app_base,
        env_path=args.env_path,
        backup_dir=args.backup_dir,
        domain=args.domain,
        skip_backup=args.skip_backup,
        skip_prisma_migrate=args.skip_prisma_migrate,
        prepare_only=args.prepare_only,
        keep_releases=args.keep_releases,
        diff_only=args.diff_only,
        diff_limit=args.diff_limit,
    )


def main() -> int:
    try:
        sys.stdout.reconfigure(line_buffering=True)
    except AttributeError:
        pass

    config = parse_args()
    release_id = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    release_dir = posixpath.join(config.releases_dir, release_id)
    remote_tarball = f"/tmp/ai-scale-release-{release_id}.tar.gz"

    local_manifest = build_release_manifest(REPO_ROOT)
    validate_release_manifest(local_manifest)

    client = create_ssh_client(config)
    try:
        print_remote_status(client, config)
        remote_manifest = fetch_remote_manifest(client, config)
        release_diff = diff_manifests(local_manifest, remote_manifest)
        print(render_manifest_diff(release_diff, limit=config.diff_limit))
        if config.diff_only:
            print("Diff-only mode complete. No files uploaded and no services changed.")
            return 0
    finally:
        client.close()

    temp_dir = Path(tempfile.mkdtemp(prefix="ai-scale-docker-redeploy-"))
    local_tarball = temp_dir / f"ai-scale-release-{release_id}.tar.gz"

    print(f"Creating release tarball: {local_tarball.name}")
    create_release_tarball(local_tarball)
    print(f"Tarball size: {local_tarball.stat().st_size / (1024 * 1024):.2f} MB")

    client = create_ssh_client(config)
    try:
        upload_file(client, local_tarball, remote_tarball)

        run_remote(
            client,
            " && ".join(
                [
                    f"sudo mkdir -p {shell_quote(release_dir)}",
                    f"sudo tar -xzf {shell_quote(remote_tarball)} -C {shell_quote(release_dir)}",
                    f"sudo ln -sfn {shell_quote(config.env_path)} {shell_quote(posixpath.join(release_dir, '.env'))}",
                    f"sudo ln -sfn {shell_quote(config.env_path)} {shell_quote(posixpath.join(release_dir, '.env.production'))}",
                    f"sudo chown -R {shell_quote(config.user + ':' + config.user)} {shell_quote(release_dir)}",
                    f"rm -f {shell_quote(remote_tarball)}",
                ]
            ),
        )

        if not config.skip_backup:
            print("Running pre-deploy database backup ...")
            run_remote(
                client,
                " ".join(
                    [
                        f"cd {shell_quote(release_dir)}",
                        "&&",
                        "sudo env",
                        f"APP_ENV_FILE={shell_quote(config.env_path)}",
                        f"DB_BACKUP_DIR={shell_quote(config.backup_dir)}",
                        "bash scripts/docker-db-backup.sh",
                    ]
                ),
                timeout=1800,
            )

        compose_prefix = (
            f"cd {shell_quote(release_dir)} && "
            f"sudo env APP_ENV_FILE={shell_quote(config.env_path)} "
            f"docker compose -f docker-compose.prod.yml --env-file {shell_quote(config.env_path)}"
        )

        print("Building app image ...")
        run_remote(client, f"{compose_prefix} build app", timeout=7200)

        print("Ensuring database container is running ...")
        run_remote(client, f"{compose_prefix} up -d db", timeout=600)

        if config.prepare_only:
            print("\nPrepare-only mode complete.")
            print(f"Prepared release: {release_dir}")
            print("No Prisma migration, app recreation, health switch, or current symlink change was performed.")
            return 0

        if not config.skip_prisma_migrate:
            print("Running prisma migrate deploy ...")
            run_remote(
                client,
                prisma_migrate_command(compose_prefix),
                timeout=1800,
            )

        print("Recreating app container ...")
        run_remote(client, f"{compose_prefix} up -d app", timeout=1200)

        print("Waiting for local health check ...")
        run_remote(
            client,
            "sudo bash -lc " + shell_quote(
                "for i in $(seq 1 60); do "
                "code=$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/health || true); "
                "if [ \"$code\" = \"200\" ]; then exit 0; fi; "
                "sleep 2; "
                "done; "
                "exit 1"
            ),
            timeout=180,
        )

        public_health = run_remote(
            client,
            f"curl -k -s -o /dev/null -w '%{{http_code}}' https://{config.domain}/api/health || true",
            timeout=30,
        ).strip()

        local_health = run_remote(
            client,
            "curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/health || true",
            timeout=30,
        ).strip()

        if local_health != "200":
            raise RuntimeError(f"Local health check failed after deploy: {local_health}")
        if public_health != "200":
            raise RuntimeError(f"Public health check failed after deploy: {public_health}")

        run_remote(
            client,
            f"sudo ln -sfn {shell_quote(release_dir)} {shell_quote(config.current_link)}",
        )

        print("Cleaning old releases and unused Docker cache ...")
        run_remote(
            client,
            " ".join(
                [
                    f"cd {shell_quote(release_dir)}",
                    "&&",
                    "sudo env",
                    f"APP_BASE={shell_quote(config.app_base)}",
                    f"KEEP_RELEASES={config.keep_releases}",
                    "bash scripts/docker-server-cleanup.sh",
                ]
            ),
            timeout=3600,
        )

        current_target = run_remote(
            client,
            f"readlink -f {shell_quote(config.current_link)}",
            timeout=30,
        ).strip()

        print("\nDeploy complete.")
        print(f"Current release: {current_target}")
        print(f"Local health: {local_health}")
        print(f"Public health: {public_health}")
        return 0
    finally:
        client.close()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except paramiko.AuthenticationException:
        print(
            "SSH authentication failed. Check DEPLOY_USER, DEPLOY_PASSWORD, or DEPLOY_KEY_PATH.",
            file=sys.stderr,
        )
        raise SystemExit(2)
