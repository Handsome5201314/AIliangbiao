#!/usr/bin/env python3
"""
Redeploy the Dockerized AI Scale System to the production server.

This script is intended for the post-cutover environment where:
- the server already runs docker compose
- /opt/ai-scale-system/shared/.env.production already exists
- nginx is already configured and points to 127.0.0.1:3000

It performs a low-downtime application redeploy:
1. package the current repo
2. upload a new release directory
3. optionally trigger a database backup
4. build the app image on the server
5. ensure the db container is up
6. run prisma db push in a one-off app container
7. recreate the app container
8. switch /opt/ai-scale-system/current after health checks pass
"""

from __future__ import annotations

import argparse
import io
import os
import posixpath
import subprocess
import tarfile
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import paramiko


REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_HOST = "tongyimohe.cloud"
DEFAULT_USER = "ubuntu"
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
    ".env.production",
}
EXCLUDED_PREFIXES = ("tmp_", "Userslishuaishuai.claudeplans")
EXCLUDED_SUFFIXES = (".log", ".tmp", ".temp", ".pyc")
EXCLUDED_DIR_PARTS = {"tmp_mmse_pages"}


@dataclass
class DeployConfig:
    host: str
    user: str
    port: int
    password: str
    app_base: str
    env_path: str
    backup_dir: str
    domain: str
    skip_backup: bool
    skip_prisma_push: bool
    keep_releases: int

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
    if name.startswith(EXCLUDED_PREFIXES):
        return True
    if name.endswith(EXCLUDED_SUFFIXES):
        return True

    return False


def create_release_tarball(output_path: Path) -> None:
    def add_file(tar: tarfile.TarFile, path: Path, arcname: str) -> None:
        stat_result = path.stat()
        data = path.read_bytes()
        if path.suffix == ".sh":
            data = data.replace(b"\r\n", b"\n")

        info = tarfile.TarInfo(name=arcname)
        info.size = len(data)
        info.mode = stat_result.st_mode & 0o7777
        info.mtime = int(stat_result.st_mtime)
        info.uid = stat_result.st_uid
        info.gid = stat_result.st_gid
        tar.addfile(info, io.BytesIO(data))

    with tarfile.open(output_path, "w:gz") as tar:
        for root, dirs, files in os.walk(REPO_ROOT):
            rel_root = Path(root).relative_to(REPO_ROOT)
            rel_root_str = "" if str(rel_root) == "." else str(rel_root).replace("\\", "/")

            dirs[:] = [
                entry
                for entry in dirs
                if not should_skip(f"{rel_root_str}/{entry}" if rel_root_str else entry, True)
            ]

            for file_name in files:
                rel_path = f"{rel_root_str}/{file_name}" if rel_root_str else file_name
                rel_path = rel_path.replace("\\", "/")
                if should_skip(rel_path, False):
                    continue
                add_file(tar, Path(root) / file_name, rel_path)


def create_ssh_client(config: DeployConfig) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {config.user}@{config.host}:{config.port} ...")
    client.connect(
        config.host,
        port=config.port,
        username=config.user,
        password=config.password,
        timeout=30,
    )
    print("Connected.")
    return client


def run_remote(
    client: paramiko.SSHClient,
    command: str,
    *,
    timeout: int = 1800,
    check: bool = True,
) -> str:
    print(f"  > {command[:140]}{'...' if len(command) > 140 else ''}")
    stdin, stdout, stderr = client.exec_command(command, timeout=timeout)

    output_lines: list[str] = []
    for line in stdout:
        line = line.rstrip()
        if line:
            safe = line.encode("ascii", errors="replace").decode("ascii")
            print(f"    {safe}")
            output_lines.append(line)

    err_text = stderr.read().decode("utf-8", errors="replace").strip()
    if err_text:
        for err_line in err_text.splitlines()[:10]:
            safe = err_line.encode("ascii", errors="replace").decode("ascii")
            print(f"    [stderr] {safe}")

    exit_code = stdout.channel.recv_exit_status()
    if check and exit_code != 0:
        raise RuntimeError(f"Remote command failed with exit code {exit_code}: {command}")
    return "\n".join(output_lines)


def upload_file(client: paramiko.SSHClient, local_path: Path, remote_path: str) -> None:
    print(f"Uploading {local_path.name} -> {remote_path}")
    sftp = client.open_sftp()
    try:
        sftp.put(str(local_path), remote_path)
    finally:
        sftp.close()


def shell_quote(value: str) -> str:
    return "'" + value.replace("'", "'\"'\"'") + "'"


def parse_args() -> DeployConfig:
    parser = argparse.ArgumentParser(description="Redeploy the Dockerized AI Scale System.")
    parser.add_argument("--host", default=os.environ.get("DEPLOY_HOST", DEFAULT_HOST))
    parser.add_argument("--user", default=os.environ.get("DEPLOY_USER", DEFAULT_USER))
    parser.add_argument("--port", type=int, default=int(os.environ.get("DEPLOY_PORT", DEFAULT_PORT)))
    parser.add_argument("--password", default=os.environ.get("DEPLOY_PASSWORD"))
    parser.add_argument("--password-env", default="DEPLOY_PASSWORD")
    parser.add_argument("--app-base", default=DEFAULT_APP_BASE)
    parser.add_argument("--env-path", default=DEFAULT_ENV_PATH)
    parser.add_argument("--backup-dir", default=DEFAULT_BACKUP_DIR)
    parser.add_argument("--domain", default=os.environ.get("DEPLOY_DOMAIN", DEFAULT_DOMAIN))
    parser.add_argument("--skip-backup", action="store_true")
    parser.add_argument("--skip-prisma-push", action="store_true")
    parser.add_argument("--keep-releases", type=int, default=3)
    args = parser.parse_args()

    password = args.password or os.environ.get(args.password_env)
    if not password:
        parser.error(
            f"Missing SSH password. Set {args.password_env} or pass --password."
        )

    return DeployConfig(
        host=args.host,
        user=args.user,
        port=args.port,
        password=password,
        app_base=args.app_base,
        env_path=args.env_path,
        backup_dir=args.backup_dir,
        domain=args.domain,
        skip_backup=args.skip_backup,
        skip_prisma_push=args.skip_prisma_push,
        keep_releases=args.keep_releases,
    )


def main() -> int:
    config = parse_args()
    release_id = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    release_dir = posixpath.join(config.releases_dir, release_id)
    remote_tarball = f"/tmp/ai-scale-release-{release_id}.tar.gz"

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

        if not config.skip_prisma_push:
            print("Running prisma db push ...")
            run_remote(
                client,
                f"{compose_prefix} run --rm --no-deps app npx prisma db push",
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
    raise SystemExit(main())
