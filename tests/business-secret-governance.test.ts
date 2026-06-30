import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("business secret utilities should use versioned encryption and hmac hashes", async () => {
  const previousKey = process.env.BUSINESS_SECRET_ENCRYPTION_KEY;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.BUSINESS_SECRET_ENCRYPTION_KEY =
    "test-business-secret-key-material-with-enough-entropy";
  process.env.NODE_ENV = "test";

  try {
    const secrets = await import("../lib/utils/businessSecrets");
    const plaintext = "sk-test-secret-value";

    const encrypted = secrets.encryptBusinessSecret(plaintext);
    assert.match(encrypted, /^bs:v1:/);
    assert.equal(encrypted.includes(plaintext), false);
    assert.equal(secrets.decryptBusinessSecret(encrypted), plaintext);

    assert.throws(() => secrets.decryptBusinessSecret(plaintext), /Unsupported business secret format/);
    assert.throws(() => secrets.decryptBusinessSecret("abc.def.ghi"), /Unsupported business secret format/);

    const hash = secrets.hashBusinessSecret(plaintext);
    assert.match(hash, /^bs:hmac:v1:/);
    assert.equal(hash.includes(plaintext), false);
    assert.equal(secrets.verifyBusinessSecretHash(plaintext, hash), true);
    assert.equal(secrets.verifyBusinessSecretHash("wrong-secret", hash), false);

    process.env.NODE_ENV = "production";
    delete process.env.BUSINESS_SECRET_ENCRYPTION_KEY;
    assert.throws(() => secrets.encryptBusinessSecret(plaintext), /BUSINESS_SECRET_ENCRYPTION_KEY/);
  } finally {
    if (previousKey === undefined) {
      delete process.env.BUSINESS_SECRET_ENCRYPTION_KEY;
    } else {
      process.env.BUSINESS_SECRET_ENCRYPTION_KEY = previousKey;
    }
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});

test("ApiKey model should store secrets outside legacy plaintext keyValue", async () => {
  const schema = await readFile("prisma/schema.prisma", "utf8");

  assert.match(schema, /keyValue\s+String\?/);
  assert.match(schema, /secretCiphertext\s+String\?/);
  assert.match(schema, /secretHash\s+String\?/);
  assert.match(schema, /secretPreview\s+String\?/);
  assert.match(schema, /secretVersion\s+String\?/);
});

test("admin AI key API should not select or return full secret values", async () => {
  const source = await readFile("app/api/admin/apikeys/route.ts", "utf8");

  assert.doesNotMatch(source, /keyValue:\s*true/);
  assert.match(source, /secretPreview:\s*true/);
  assert.match(source, /encryptBusinessSecret/);
  assert.match(source, /secretCiphertext/);
  assert.match(source, /secretVersion/);
});

test("AI key admin UI should not reveal, copy, or submit stored plaintext keys", async () => {
  const source = await readFile("app/admin/apikeys/page.tsx", "utf8");

  assert.doesNotMatch(source, /visibleKeys/);
  assert.doesNotMatch(source, /toggleKeyVisibility/);
  assert.doesNotMatch(source, /copyToClipboard\(key\.keyValue/);
  assert.doesNotMatch(source, /apiKey:\s*key\.keyValue/);
  assert.match(source, /secretPreview/);
});

test("Agent admin model loading should use keyId instead of keyValue", async () => {
  const source = await readFile("app/admin/agent/page.tsx", "utf8");

  assert.doesNotMatch(source, /keyValue:\s*string/);
  assert.doesNotMatch(source, /apiKey:\s*matchingKey\.keyValue/);
  assert.match(source, /keyId:\s*matchingKey\.id/);
});

test("AI control plane copy should distinguish project-side keys from Hermes upstream config", async () => {
  const apiKeySource = await readFile("app/admin/apikeys/page.tsx", "utf8");
  const agentSource = await readFile("app/admin/agent/page.tsx", "utf8");

  assert.match(apiKeySource, /Hermes Runtime 自己的上游模型配置/);
  assert.match(agentSource, /不会直接写入 Hermes Runtime 自己的上游 provider 配置/);
});

test("MCP API keys should validate by hash and list only previews", async () => {
  const authSource = await readFile("lib/mcp/auth.ts", "utf8");
  const routeSource = await readFile("app/api/admin/mcpkeys/route.ts", "utf8");

  assert.doesNotMatch(authSource, /keyValue:\s*token/);
  assert.match(authSource, /hashBusinessSecret/);
  assert.match(authSource, /secretHash/);

  assert.doesNotMatch(routeSource, /keyValue:\s*true/);
  assert.match(routeSource, /secretPreview/);
  assert.match(routeSource, /hashBusinessSecret/);
});

test("MCP key creation should surface failures and prefer streamableHTTP guidance", async () => {
  const pageSource = await readFile("app/admin/mcpkeys/page.tsx", "utf8");
  const routeSource = await readFile("app/api/admin/mcpkeys/route.ts", "utf8");
  const skillSource = await readFile("skills/ailiangbiao-mcp/SKILL.md", "utf8");

  assert.match(pageSource, /createError/);
  assert.match(pageSource, /creatingKey/);
  assert.match(pageSource, /res\.ok/);
  assert.match(pageSource, /创建中/);
  assert.match(pageSource, /streamableHTTP（推荐）/);
  assert.match(pageSource, /Accept:\s*application\/json,\s*text\/event-stream/);

  assert.match(routeSource, /normalizeMcpKeyName/);
  assert.match(routeSource, /MCP_KEY_CREATE_FAILED/);
  assert.match(routeSource, /BUSINESS_SECRET_ENCRYPTION_KEY/);

  assert.match(skillSource, /streamableHTTP/);
  assert.match(skillSource, /SSE compatibility/i);
});

test("system API key route should not expose usable API secrets", async () => {
  const source = await readFile("app/api/system/apikey/route.ts", "utf8");

  assert.doesNotMatch(source, /apiKey:\s*selectedKey\.key/);
  assert.doesNotMatch(source, /apiKey:/);
});
