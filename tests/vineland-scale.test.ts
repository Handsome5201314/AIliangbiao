import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const expectedSectionCounts = {
  listening_and_understanding: 39,
  talking: 49,
  reading_and_writing: 38,
  caring_for_self: 55,
  caring_for_home: 30,
  living_in_the_community: 58,
  relating_to_others: 43,
  playing_and_using_leisure_time: 36,
  adapting: 33,
  using_large_muscles: 43,
  using_small_muscles: 34,
  problem_behaviors: 44,
};

test("Vineland item asset contains the full 502-question bank", async () => {
  const assetPath = path.join(process.cwd(), "data", "scale-assets", "vineland-3.items.json");
  const raw = await fs.readFile(assetPath, "utf8");
  const items = JSON.parse(raw);

  assert.equal(items.length, 502);

  const counts = items.reduce((result: Record<string, number>, item: Record<string, unknown>) => {
    const sectionKey = String(item.sectionKey);
    result[sectionKey] = (result[sectionKey] || 0) + 1;
    return result;
  }, {});

  assert.deepEqual(counts, expectedSectionCounts);
  assert.ok(items.every((item: Record<string, unknown>) => typeof item.id === "number" && item.id > 0));
  assert.ok(
    items.every(
      (item: Record<string, unknown>) => typeof item.text === "string" && item.text.trim().length > 0
    )
  );
});

test("VINELAND_3 is registered as a web handoff physician-review scale", async () => {
  const { AllScales } = await import("../lib/schemas/core/registry");
  const scale = AllScales.find((candidate) => candidate.id === "VINELAND_3");

  assert.ok(scale);
  assert.equal(scale?.interactionMode, "web_handoff");
  assert.equal(scale?.resultDeliveryMode, "physician_review");
  assert.equal(scale?.questions.length, 502);

  const firstQuestion = scale?.questions[0];
  assert.equal(firstQuestion?.sectionKey, "listening_and_understanding");
  assert.equal(firstQuestion?.domainKey, "communication");
  assert.equal(firstQuestion?.supportsEstimate, true);
  assert.ok(firstQuestion?.ageBandLabel);
});

test("Vineland scoring reports raw domain totals and basal/ceiling annotations", async () => {
  const { Vineland3_Scale } = await import("../lib/schemas/development/vineland");

  const answers = Array.from({ length: Vineland3_Scale.questions.length }, (_, index) =>
    index < 39 ? 2 : 0
  );
  const result = Vineland3_Scale.calculateScore(answers);
  const dimensions = result.details?.dimensions as Record<string, { score: number }> | undefined;
  const basalCeiling = result.details?.basalCeiling;

  assert.ok(dimensions);
  assert.equal(dimensions?.communication?.score, 78);
  assert.equal(dimensions?.dailyLiving?.score, 0);
  assert.equal(dimensions?.socialization?.score, 0);
  assert.equal(dimensions?.motor?.score, 0);
  assert.equal(dimensions?.maladaptive?.score, 0);
  assert.ok(basalCeiling);
  assert.equal("standardScores" in (result.details || {}), false);
});

test("answer detail normalization preserves estimated markers without symptom selections", async () => {
  const { normalizeScaleAnswerDetails } = await import("../lib/scales/answer-details");
  const { Vineland3_Scale } = await import("../lib/schemas/development/vineland");

  const normalized = normalizeScaleAnswerDetails(Vineland3_Scale, {
    "1": { estimated: true },
    "459": { estimated: true },
  });

  assert.deepEqual(normalized?.["1"], { estimated: true });
  assert.deepEqual(normalized?.["459"], { estimated: true });
});
