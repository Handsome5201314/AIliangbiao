#!/usr/bin/env python3
from __future__ import annotations

import argparse
import io
import json
import os
import shlex
import socket
import subprocess
import sys
import tarfile
import tempfile
import time
from pathlib import Path
from typing import Dict, Iterable

import paramiko


REPO_ROOT = Path(__file__).resolve().parents[1]


def log(message: str) -> None:
    print(f"[tencent-migrate] {message}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Migrate the current production app to a Tencent Cloud validation server.")
    parser.add_argument("--source-host", required=True)
    parser.add_argument("--source-user", default="root")
    parser.add_argument("--source-password", required=True)
    parser.add_argument("--target-host", required=True)
    parser.add_argument("--target-user", default="root")
    parser.add_argument("--target-password", required=True)
    parser.add_argument("--domain", default="")
    parser.add_argument("--validation-url", required=True)
    parser.add_argument("--repo-root", default=str(REPO_ROOT))
    return parser.parse_args()


def check_port(host: str, port: int, timeout: float = 5.0) -> bool:
    with socket.socket() as sock:
      sock.settimeout(timeout)
      sock.connect((host, port))
    return True


class Remote:
    def __init__(self, host: str, user: str, password: str):
        self.host = host
        self.user = user
        self.password = password
        self.client = paramiko.SSHClient()
        self.client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        self.client.connect(hostname=host, username=user, password=password, timeout=20)
        self.sftp = self.client.open_sftp()

    def run(self, command: str, check: bool = True, stdin_text: str | None = None) -> str:
        stdin, stdout, stderr = self.client.exec_command(command, get_pty=True)
        if stdin_text is not None:
            stdin.write(stdin_text + "\n")
            stdin.flush()
            stdin.channel.shutdown_write()
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        code = stdout.channel.recv_exit_status()
        if check and code != 0:
            raise RuntimeError(f"{self.host}: command failed ({code}): {command}\nSTDOUT:\n{out}\nSTDERR:\n{err}")
        return out + err

    def get_text(self, remote_path: str) -> str:
        with self.sftp.open(remote_path, "r") as handle:
            return handle.read().decode("utf-8", errors="replace")

    def put_file(self, local_path: Path, remote_path: str) -> None:
        self.sftp.put(str(local_path), remote_path)

    def get_file(self, remote_path: str, local_path: Path) -> None:
        self.sftp.get(remote_path, str(local_path))

    def close(self) -> None:
        self.sftp.close()
        self.client.close()


def parse_env(text: str) -> Dict[str, str]:
    values: Dict[str, str] = {}
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        value = value.strip()
        if value.startswith('"') and value.endswith('"'):
            value = value[1:-1]
        values[key.strip()] = value
    return values


def create_release_tarball(repo_root: Path, destination: Path) -> None:
    excluded = {
        ".git",
        ".next",
        "node_modules",
        ".env",
        ".vercel",
        ".codebuddy",
        "tsconfig.tsbuildinfo",
    }
    with tarfile.open(destination, "w:gz") as archive:
        for path in repo_root.rglob("*"):
            relative = path.relative_to(repo_root)
            if any(part in excluded for part in relative.parts):
                continue
            archive.add(path, arcname=str(relative))


def create_remote_env_file(path: Path, values: Dict[str, str]) -> None:
    def shell_quote(value: str) -> str:
        return "'" + value.replace("'", "'\"'\"'") + "'"

    content = "\n".join(f"{key}={shell_quote(value)}" for key, value in values.items()) + "\n"
    path.write_text(content, encoding="utf-8", newline="\n")


def main() -> None:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()

    try:
        check_port(args.source_host, 22)
    except Exception as exc:  # pragma: no cover - operator feedback
        raise SystemExit(f"Source server {args.source_host}:22 is not reachable: {exc}")

    try:
        check_port(args.target_host, 22)
    except Exception as exc:  # pragma: no cover - operator feedback
        raise SystemExit(
            f"Target server {args.target_host}:22 is not reachable: {exc}\n"
            "Open TCP/22 in the Tencent Cloud security group and host firewall, then rerun."
        )

    ssl_enabled = bool(args.domain)
    release_id = time.strftime("%Y%m%d-%H%M%S", time.gmtime())

    temp_dir = Path(tempfile.mkdtemp(prefix="ai-scale-tencent-"))
    tarball_path = temp_dir / f"ai-scale-release-{release_id}.tar.gz"
    dump_path = temp_dir / f"ai-scale-db-{release_id}.dump"
    remote_env_path = temp_dir / f"tencent-migrate-{release_id}.env"
    remote_script_local = repo_root / "scripts" / "remote-migrate-preserve.sh"

    source = Remote(args.source_host, args.source_user, args.source_password)
    target = Remote(args.target_host, args.target_user, args.target_password)
    try:
        log("reading production environment from source server")
        source_env_text = source.get_text("/opt/ai-scale-system/shared/.env.production")
        source_env = parse_env(source_env_text)

        required_keys = [
            "DATABASE_URL",
            "DIRECT_URL",
            "SESSION_SECRET",
            "ADMIN_USERNAME",
            "ADMIN_PASSWORD",
        ]
        missing = [key for key in required_keys if key not in source_env]
        if missing:
            raise SystemExit(f"Source env is missing required keys: {', '.join(missing)}")

        db_url = source_env["DATABASE_URL"]
        db_name = db_url.rsplit("/", 1)[-1]
        db_user = db_url.split("://", 1)[1].split(":", 1)[0]
        db_password = db_url.split("://", 1)[1].split(":", 1)[1].split("@", 1)[0]

        log("creating local release tarball")
        create_release_tarball(repo_root, tarball_path)

        remote_source_dump = f"/tmp/{release_id}-ai-scale.dump"
        log("dumping production database on source server")
        source.run(
            f"sudo -u postgres pg_dump -Fc -d {shlex.quote(db_name)} -f {shlex.quote(remote_source_dump)}"
        )
        try:
            log("downloading database dump")
            source.get_file(remote_source_dump, dump_path)
        finally:
            source.run(f"rm -f {shlex.quote(remote_source_dump)}", check=False)

        remote_tarball = f"/tmp/ai-scale-release-{release_id}.tar.gz"
        remote_dump = f"/tmp/ai-scale-db-{release_id}.dump"
        remote_script = f"/tmp/remote-migrate-preserve-{release_id}.sh"
        remote_env = f"/tmp/tencent-migrate-{release_id}.env"
        backup_dir = f"/root/deploy-backup/{release_id}"
        app_base = "/opt/ai-scale-system"
        env_values = {
            "RELEASE_TARBALL": remote_tarball,
            "DB_DUMP": remote_dump,
            "RELEASE_DIR": f"{app_base}/releases/{release_id}",
            "RELEASES_DIR": f"{app_base}/releases",
            "CURRENT_LINK": f"{app_base}/current",
            "SHARED_DIR": f"{app_base}/shared",
            "ENV_PATH": f"{app_base}/shared/.env.production",
            "LOG_DIR": "/var/log/ai-scale-system",
            "APP_NAME": "ai-scale-system",
            "APP_NAME_PUBLIC": source_env.get("NEXT_PUBLIC_APP_NAME", "AI 量表系统"),
            "DB_NAME": db_name,
            "DB_USER": db_user,
            "DB_PASSWORD": db_password,
            "SESSION_SECRET": source_env["SESSION_SECRET"],
            "ADMIN_USERNAME": source_env["ADMIN_USERNAME"],
            "ADMIN_PASSWORD": source_env["ADMIN_PASSWORD"],
            "VALIDATION_URL": args.validation_url,
            "BACKUP_DIR": backup_dir,
            "SSL_ENABLED": "1" if ssl_enabled else "0",
            "DEEPSEEK_API_KEY": source_env.get("DEEPSEEK_API_KEY", ""),
            "TENCENT_SECRET_ID": source_env.get("TENCENT_SECRET_ID", ""),
            "TENCENT_SECRET_KEY": source_env.get("TENCENT_SECRET_KEY", ""),
            "TENCENT_SPEECH_SECRET_ID": source_env.get("TENCENT_SPEECH_SECRET_ID", ""),
            "TENCENT_SPEECH_SECRET_KEY": source_env.get("TENCENT_SPEECH_SECRET_KEY", ""),
            "ENABLE_VOICE_INTERACTION": source_env.get("ENABLE_VOICE_INTERACTION", "true"),
            "ENABLE_MCP_SERVER": source_env.get("ENABLE_MCP_SERVER", "true"),
            "CACHE_TTL": source_env.get("CACHE_TTL", "3600"),
            "MAX_CACHE_SIZE": source_env.get("MAX_CACHE_SIZE", "1000"),
            "LOG_LEVEL": source_env.get("LOG_LEVEL", "info"),
            "AGENTPIT_SHARED_BEARER": source_env.get("AGENTPIT_SHARED_BEARER", ""),
            "AGENTPIT_CLIENT_ID": source_env.get("AGENTPIT_CLIENT_ID", ""),
            "AGENTPIT_CLIENT_SECRET": source_env.get("AGENTPIT_CLIENT_SECRET", ""),
            "AGENTPIT_OAUTH_BASE_URL": source_env.get("AGENTPIT_OAUTH_BASE_URL", ""),
            "AGENTPIT_OAUTH_REDIRECT_URI": source_env.get("AGENTPIT_OAUTH_REDIRECT_URI", ""),
        }
        if ssl_enabled:
            env_values["DOMAIN"] = args.domain

        create_remote_env_file(remote_env_path, env_values)

        log("uploading release, dump, and remote script to target server")
        target.put_file(tarball_path, remote_tarball)
        target.put_file(dump_path, remote_dump)
        target.put_file(remote_script_local, remote_script)
        target.put_file(remote_env_path, remote_env)

        remote_inner = f"set -a && source {shlex.quote(remote_env)} && set +a && chmod +x {shlex.quote(remote_script)} && bash {shlex.quote(remote_script)}"
        log("running migration on target server")
        if args.target_user == "root":
            output = target.run(f"bash -lc {shlex.quote(remote_inner)}")
        else:
            output = target.run(
                f"sudo -S bash -lc {shlex.quote(remote_inner)}",
                stdin_text=args.target_password,
            )

        json_line = None
        for line in reversed(output.splitlines()):
            stripped = line.strip()
            if stripped.startswith("{") and stripped.endswith("}"):
                json_line = stripped
                break
        if not json_line:
            raise RuntimeError(f"Target script finished without JSON output.\n{output}")

        result = json.loads(json_line)
        result["source_host"] = args.source_host
        result["target_host"] = args.target_host
        result["domain"] = args.domain or None
        result["validation_url"] = args.validation_url
        sys.stdout.write(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    finally:
        source.close()
        target.close()


if __name__ == "__main__":
    main()
