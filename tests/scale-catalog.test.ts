import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

import { NextRequest } from "next/server";

import {
  listAdminScales,
  listDoctorVisibleScales,
  listVoiceFriendlyChildScales,
} from "../lib/scales/catalog";

test("GET /api/scales defaults to child clinical scales only", async () => {
  const { GET } = await import("../app/api/scales/route");

  const response = await GET(new NextRequest("http://localhost/api/scales"));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(payload.scales));
  assert.ok(payload.scales.length > 0);

  const scaleIds = new Set(payload.scales.map((scale: { id: string }) => scale.id));
  assert.ok(scaleIds.has("ABC"));
  assert.ok(scaleIds.has("VINELAND_3"));
  assert.ok(scaleIds.has("M_CHAT_R"));
  assert.ok(!scaleIds.has("PHQ-9"));
  assert.ok(!scaleIds.has("GAD-7"));
  assert.ok(!scaleIds.has("SSS"));
  assert.ok(!scaleIds.has("MBTI"));
  assert.ok(!scaleIds.has("HOLLAND"));
});

test("GET /api/scales returns exploration scales only when category=exploration", async () => {
  const { GET } = await import("../app/api/scales/route");

  const response = await GET(new NextRequest("http://localhost/api/scales?category=exploration"));
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.ok(Array.isArray(payload.scales));

  const scaleIds = new Set(payload.scales.map((scale: { id: string }) => scale.id));
  assert.ok(scaleIds.has("PHQ-9"));
  assert.ok(scaleIds.has("GAD-7"));
  assert.ok(scaleIds.has("MBTI"));
  assert.ok(scaleIds.has("HOLLAND"));
  assert.ok(!scaleIds.has("ABC"));
  assert.ok(!scaleIds.has("VINELAND_3"));
});

test("GET /api/scales hides exploration scale details outside exploration mode", async () => {
  const { GET } = await import("../app/api/scales/route");

  const defaultResponse = await GET(new NextRequest("http://localhost/api/scales?id=PHQ-9"));
  const defaultPayload = await defaultResponse.json();
  assert.equal(defaultResponse.status, 404);
  assert.match(defaultPayload.error, /not found/i);

  const explorationResponse = await GET(
    new NextRequest("http://localhost/api/scales?id=PHQ-9&category=exploration")
  );
  const explorationPayload = await explorationResponse.json();
  assert.equal(explorationResponse.status, 200);
  assert.equal(explorationPayload.scale.id, "PHQ-9");
});

test("catalog selectors keep admin, doctor, and voice-friendly visibility separated", () => {
  const adminScaleIds = new Set(listAdminScales().map((scale) => scale.id));
  assert.ok(adminScaleIds.has("ABC"));
  assert.ok(adminScaleIds.has("PHQ-9"));
  assert.ok(adminScaleIds.has("MBTI"));

  const doctorDefaultIds = new Set(
    listDoctorVisibleScales({ doctorExplorationEnabled: false }).map((scale) => scale.id)
  );
  assert.ok(doctorDefaultIds.has("ABC"));
  assert.ok(!doctorDefaultIds.has("PHQ-9"));
  assert.ok(!doctorDefaultIds.has("MBTI"));

  const doctorExplorationIds = new Set(
    listDoctorVisibleScales({ doctorExplorationEnabled: true }).map((scale) => scale.id)
  );
  assert.ok(doctorExplorationIds.has("ABC"));
  assert.ok(doctorExplorationIds.has("PHQ-9"));
  assert.ok(doctorExplorationIds.has("MBTI"));

  const voiceFriendlyIds = new Set(listVoiceFriendlyChildScales().map((scale) => scale.id));
  assert.ok(voiceFriendlyIds.has("M_CHAT_R"));
  assert.ok(voiceFriendlyIds.has("SNAP-IV"));
  assert.ok(!voiceFriendlyIds.has("PHQ-9"));
  assert.ok(!voiceFriendlyIds.has("GAD-7"));
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
