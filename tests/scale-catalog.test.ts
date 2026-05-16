import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { NextRequest } from "next/server";

test("GET /api/scales returns public scales when auxiliary JSON assets exist", async () => {
  const { GET } = await import("../app/api/scales/route");

  const response = await GET(new NextRequest("http://localhost/api/scales"));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(payload.scales));
  assert.ok(payload.scales.length > 0);

  const scaleIds = new Set(payload.scales.map((scale: { id: string }) => scale.id));
  assert.ok(scaleIds.has("ABC"));
  assert.ok(scaleIds.has("PHQ-9"));
  assert.ok(scaleIds.has("GAD-7"));
  assert.ok(scaleIds.has("SSS"));
  assert.ok(scaleIds.has("VINELAND_3"));
});

test("GET /api/scales skips invalid manifest files instead of failing the whole response", async () => {
  const tempManifestPath = path.join(process.cwd(), "data", "scales", "__invalid-test.scale.json");
  const { GET } = await import("../app/api/scales/route");

  await fs.writeFile(tempManifestPath, JSON.stringify([{ id: 1 }], null, 2), "utf8");

  try {
    const response = await GET(new NextRequest("http://localhost/api/scales"));
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(payload.scales));
    assert.ok(payload.scales.length > 0);
  } finally {
    await fs.unlink(tempManifestPath).catch(() => undefined);
  }
});
