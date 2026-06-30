import assert from "node:assert/strict";
import test from "node:test";

async function readProjectFile(path: string) {
  const file = await import("node:fs/promises");
  return file.readFile(path, "utf8");
}

test("package scripts should expose a local smoke command", async () => {
  const source = await readProjectFile("package.json");

  assert.match(source, /"smoke:local"/);
  assert.match(source, /scripts\/smoke-local\.mjs/);
});

test("CI workflow should start the app and run smoke checks after build", async () => {
  const source = await readProjectFile(".github/workflows/ci.yml");

  assert.match(source, /Start application for smoke check/);
  assert.match(source, /Wait for local health endpoint/);
  assert.match(source, /Run local smoke checks/);
  assert.match(source, /scripts\/smoke-local\.mjs/);
});

test("root TypeScript config should not type-check the independent H5 Vite project", async () => {
  const source = await readProjectFile("tsconfig.json");
  const config = JSON.parse(source);

  assert.ok(Array.isArray(config.exclude));
  assert.ok(config.exclude.includes("mobile-h5-prototype"));
});

test("Tencent Gitee upgrade script should pull confirmed releases and protect production data", async () => {
  const source = await readProjectFile("scripts/tencent-gitee-upgrade.sh");

  assert.match(source, /https:\/\/gitee\.com\/lishuaishuai1314520\/AIliangbiao\.git/);
  assert.match(source, /--diff-only/);
  assert.match(source, /--prepare-only/);
  assert.match(source, /--commit/);
  assert.match(source, /git -C "\$repo_dir" archive "\$target_commit"/);
  assert.match(source, /scripts\/docker-db-backup\.sh/);
  assert.match(source, /prisma migrate deploy/);
  assert.doesNotMatch(source, /prisma db push/);
  assert.match(source, /up -d --no-deps app/);

  const backupCommand = source.indexOf("bash scripts/docker-db-backup.sh");
  const migrateCommand = source.indexOf('compose "$release_dir" run --rm --no-deps app npx prisma migrate deploy');
  const healthCheck = source.indexOf("curl -fsS http://127.0.0.1:3000/api/health");
  const currentSwitch = source.indexOf('ln -sfn "$release_dir" "$APP_BASE/current"');

  assert.ok(backupCommand >= 0);
  assert.ok(migrateCommand >= 0);
  assert.ok(healthCheck >= 0);
  assert.ok(currentSwitch >= 0);
  assert.ok(backupCommand < migrateCommand);
  assert.ok(healthCheck < currentSwitch);
});

test("deployment docs should describe Gitee upgrades and separated AI key ownership", async () => {
  const deployment = await readProjectFile("DEPLOYMENT.md");
  const readme = await readProjectFile("README.md");

  assert.match(deployment, /gitee\.com\/lishuaishuai1314520\/AIliangbiao\.git/);
  assert.match(deployment, /scripts\/tencent-gitee-upgrade\.sh --diff-only/);
  assert.match(deployment, /HERMES_API_SERVER_KEY/);
  assert.match(deployment, /\/admin\/apikeys/);
  assert.match(deployment, /Hermes .*上游/);
  assert.match(readme, /腾讯云/);
  assert.match(readme, /Gitee/);
});
