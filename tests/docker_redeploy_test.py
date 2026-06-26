from __future__ import annotations

import importlib.util
import io
import subprocess
import sys
import tarfile
import tempfile
import types
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPT_PATH = REPO_ROOT / "scripts" / "docker-redeploy.py"
PGVECTOR_IMAGE = "pgvector/pgvector:0.8.3-pg16-bookworm"


def load_deploy_module():
    sys.modules.setdefault("paramiko", types.SimpleNamespace(SSHClient=object, AutoAddPolicy=object))
    spec = importlib.util.spec_from_file_location("docker_redeploy", SCRIPT_PATH)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def git(repo: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=repo,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    return result.stdout.strip()


def read_project_file(*parts: str) -> str:
    return (REPO_ROOT.joinpath(*parts)).read_text(encoding="utf-8")


class DockerRedeployTests(unittest.TestCase):
    def setUp(self) -> None:
        self.module = load_deploy_module()

    def test_release_tarball_contains_only_git_tracked_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            repo = Path(tmp)
            git(repo, "init")
            git(repo, "config", "user.email", "test@example.local")
            git(repo, "config", "user.name", "Test User")
            (repo / ".gitignore").write_text(".env.local\nscratch.txt\n", encoding="utf-8")
            (repo / "package.json").write_text('{"name":"app"}\n', encoding="utf-8")
            (repo / "scripts").mkdir()
            (repo / "scripts" / "docker-db-backup.sh").write_text(
                "#!/usr/bin/env bash\r\necho backup\r\n",
                encoding="utf-8",
            )
            git(repo, "add", ".gitignore", "package.json", "scripts/docker-db-backup.sh")
            git(repo, "commit", "-m", "init")
            (repo / ".env.local").write_text("SECRET=local\n", encoding="utf-8")
            (repo / "scratch.txt").write_text("do not deploy\n", encoding="utf-8")

            tar_path = repo / "release.tar.gz"
            self.module.create_release_tarball(tar_path, repo_root=repo)

            with tarfile.open(tar_path, "r:gz") as tar:
                names = sorted(tar.getnames())
                script_bytes = tar.extractfile("scripts/docker-db-backup.sh").read()

            self.assertEqual(names, [".gitignore", "package.json", "scripts/docker-db-backup.sh"])
            self.assertNotIn(".env.local", names)
            self.assertNotIn("scratch.txt", names)
            self.assertEqual(script_bytes, b"#!/usr/bin/env bash\necho backup\n")

    def test_manifest_diff_reports_added_modified_and_deleted_files(self) -> None:
        current = {
            "keep.txt": {"sha256": "same", "size": 1},
            "delete.txt": {"sha256": "old", "size": 2},
            "modify.txt": {"sha256": "old", "size": 3},
        }
        candidate = {
            "keep.txt": {"sha256": "same", "size": 1},
            "add.txt": {"sha256": "new", "size": 4},
            "modify.txt": {"sha256": "new", "size": 5},
        }

        diff = self.module.diff_manifests(candidate, current)

        self.assertEqual(diff["added"], ["add.txt"])
        self.assertEqual(diff["deleted"], ["delete.txt"])
        self.assertEqual(diff["modified"], ["modify.txt"])

    def test_release_manifest_allows_tracked_env_examples(self) -> None:
        self.module.validate_release_manifest(
            {
                ".env.local.example": {"sha256": "example", "size": 1},
                ".env.production.example": {"sha256": "example", "size": 1},
            }
        )

    def test_prisma_deploy_command_uses_migrations_not_db_push(self) -> None:
        command = self.module.prisma_migrate_command("compose")

        self.assertIn("npx prisma migrate deploy", command)
        self.assertNotIn("prisma db push", command)

    def test_deploy_requires_public_health_before_switching_current_release(self) -> None:
        source = read_project_file("scripts", "docker-redeploy.py")

        public_health_guard = source.index('Public health check failed after deploy')
        current_switch = source.index('sudo ln -sfn {shell_quote(release_dir)}')
        self.assertLess(public_health_guard, current_switch)

    def test_parser_defaults_to_root_and_exposes_diff_only(self) -> None:
        parser = self.module.build_arg_parser()
        option_names = {option for action in parser._actions for option in action.option_strings}
        args = parser.parse_args(["--diff-only", "--prepare-only"])

        self.assertEqual(args.user, "root")
        self.assertTrue(args.diff_only)
        self.assertTrue(args.prepare_only)
        self.assertIn("--key-path", option_names)
        self.assertIn("--prepare-only", option_names)
        self.assertNotIn("--password", option_names)

    def test_prepare_only_stops_before_prisma_app_and_current_switch(self) -> None:
        source = read_project_file("scripts", "docker-redeploy.py")

        db_ready = source.index('f"{compose_prefix} up -d db"')
        prepare_guard = source.index("if config.prepare_only:")
        prisma_migrate = source.index("Running prisma migrate deploy")
        app_recreate = source.index("Recreating app container")
        current_switch = source.index("sudo ln -sfn {shell_quote(release_dir)}")

        self.assertLess(db_ready, prepare_guard)
        self.assertLess(prepare_guard, prisma_migrate)
        self.assertLess(prepare_guard, app_recreate)
        self.assertLess(prepare_guard, current_switch)

    def test_run_remote_drains_stdout_and_stderr_before_exit_status(self) -> None:
        class FakeChannel:
            def __init__(self) -> None:
                self.out = [b"hello\n"]
                self.err = [b"build log\n"]

            def recv_ready(self) -> bool:
                return bool(self.out)

            def recv(self, _size: int) -> bytes:
                return self.out.pop(0)

            def recv_stderr_ready(self) -> bool:
                return bool(self.err)

            def recv_stderr(self, _size: int) -> bytes:
                return self.err.pop(0)

            def exit_status_ready(self) -> bool:
                return not self.out and not self.err

            def recv_exit_status(self) -> int:
                return 0

        class FakeClient:
            def exec_command(self, _command: str, timeout: int):
                return None, types.SimpleNamespace(channel=FakeChannel()), None

        output = self.module.run_remote(FakeClient(), "cmd", echo_output=False)

        self.assertEqual(output, "hello")

    def test_compose_ci_and_backup_tools_use_pgvector_postgres16_image(self) -> None:
        files = {
            "docker-compose.dev.yml": read_project_file("docker-compose.dev.yml"),
            "docker-compose.prod.yml": read_project_file("docker-compose.prod.yml"),
            ".github/workflows/ci.yml": read_project_file(".github", "workflows", "ci.yml"),
            "scripts/docker-db-migrate.sh": read_project_file("scripts", "docker-db-migrate.sh"),
            "scripts/export-production-db.mjs": read_project_file("scripts", "export-production-db.mjs"),
            "DEPLOYMENT.md": read_project_file("DEPLOYMENT.md"),
        }

        for name, source in files.items():
            with self.subTest(name=name):
                self.assertIn(PGVECTOR_IMAGE, source)
                self.assertNotIn("postgres:16-bookworm", source)

    def test_production_entrypoints_use_prisma_migrate_deploy_not_db_push(self) -> None:
        entrypoint_files = {
            "package.json": read_project_file("package.json"),
            ".github/workflows/ci.yml": read_project_file(".github", "workflows", "ci.yml"),
            "scripts/docker-prisma-sync.sh": read_project_file("scripts", "docker-prisma-sync.sh"),
            "scripts/docker-redeploy.py": read_project_file("scripts", "docker-redeploy.py"),
        }

        for name, source in entrypoint_files.items():
            with self.subTest(name=name):
                self.assertNotIn("prisma db push", source)
        self.assertIn("prisma migrate deploy", entrypoint_files["scripts/docker-prisma-sync.sh"])
        self.assertIn("prisma migrate deploy", entrypoint_files[".github/workflows/ci.yml"])

        docs = {
            "README.md": read_project_file("README.md"),
            "DEPLOYMENT.md": read_project_file("DEPLOYMENT.md"),
        }
        for name, source in docs.items():
            with self.subTest(name=name):
                self.assertIn("prisma db push", source)
                self.assertIn("prisma migrate deploy", source)
                self.assertNotIn("npm run db:dev:push", source)
                self.assertNotIn("npx prisma db push", source)

    def test_prisma_migrations_use_single_baseline_and_archive_old_chain(self) -> None:
        migrations_dir = REPO_ROOT / "prisma" / "migrations"
        migration_names = sorted(path.name for path in migrations_dir.iterdir() if path.is_dir())

        self.assertEqual(migration_names, ["20260627_baseline"])

        archived_dir = REPO_ROOT / "prisma" / "migrations_archive" / "pre_20260627_baseline"
        archived_names = sorted(path.name for path in archived_dir.iterdir() if path.is_dir())
        self.assertEqual(
            archived_names,
            [
                "20260616_platform_knowledge_pgvector",
                "20260620_research_p0_models",
                "20260623_developmental_closure_phase1",
                "20260624_business_secret_governance",
                "20260624_phase6_health_education_followup",
                "20260624_phase7_research_import_export",
            ],
        )

    def test_baseline_migration_can_create_current_core_schema_from_empty_database(self) -> None:
        migration_sql = read_project_file("prisma", "migrations", "20260627_baseline", "migration.sql")

        self.assertIn("CREATE EXTENSION IF NOT EXISTS vector", migration_sql)
        self.assertIn('CREATE TABLE "User"', migration_sql)
        self.assertIn('CREATE TABLE "ChildProfile"', migration_sql)
        self.assertIn('CREATE TABLE "DoctorProfile"', migration_sql)
        self.assertIn('CREATE TABLE "AssessmentHistory"', migration_sql)
        self.assertIn('CREATE TABLE "SystemConfig"', migration_sql)
        self.assertIn('"embedding" vector', migration_sql)
        self.assertNotIn('ALTER TABLE "KnowledgeChunk" ADD COLUMN IF NOT EXISTS "embedding"', migration_sql)


if __name__ == "__main__":
    unittest.main()
