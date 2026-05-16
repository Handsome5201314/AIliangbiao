import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

function envValue(source: string, key: string): string {
  const line = source
    .split(/\r?\n/)
    .find((candidate) => candidate.startsWith(`${key}=`));

  assert.ok(line, `${key} should be present`);

  const rawValue = line.slice(key.length + 1).trim();
  return rawValue.replace(/^["']|["']$/g, "");
}

test("local Prisma URLs use the same IPv4 loopback host exposed by dev compose", async () => {
  const [envExample, compose] = await Promise.all([
    readFile(".env.local.example", "utf8"),
    readFile("docker-compose.dev.yml", "utf8"),
  ]);

  assert.match(compose, /127\.0\.0\.1:5432:5432/);
  assert.equal(new URL(envValue(envExample, "DATABASE_URL")).hostname, "127.0.0.1");
  assert.equal(new URL(envValue(envExample, "DIRECT_URL")).hostname, "127.0.0.1");
});
