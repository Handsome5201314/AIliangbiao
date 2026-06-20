import assert from "node:assert/strict";
import test from "node:test";

test("package scripts should expose a local smoke command", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("package.json", "utf8");

  assert.match(source, /"smoke:local"/);
  assert.match(source, /scripts\/smoke-local\.mjs/);
});

test("CI workflow should start the app and run smoke checks after build", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile(".github/workflows/ci.yml", "utf8");

  assert.match(source, /Start application for smoke check/);
  assert.match(source, /Wait for local health endpoint/);
  assert.match(source, /Run local smoke checks/);
  assert.match(source, /scripts\/smoke-local\.mjs/);
});

test("root TypeScript config should not type-check the independent H5 Vite project", async () => {
  const file = await import("node:fs/promises");
  const source = await file.readFile("tsconfig.json", "utf8");
  const config = JSON.parse(source);

  assert.ok(Array.isArray(config.exclude));
  assert.ok(config.exclude.includes("mobile-h5-prototype"));
});
