import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import {
  evaluateScaleAnswers,
  getScaleDefinitionById,
  listPublicClinicalChildScales,
} from "../lib/scales/catalog";
import { skillHttpRoutes } from "../packages/assessment-skill/src/contracts/http";
import { buildMcpManifest } from "../packages/assessment-skill/src/service/mcp-manifest";

const TARGET_SCALE_IDS = [
  "M_CHAT_R",
  "ABC",
  "CARS",
  "SRS",
  "SNAP-IV",
  "ATEC",
  "VINELAND_3",
] as const;

function validAnswersForScale(scaleId: string): number[] {
  const scale = getScaleDefinitionById(scaleId);
  assert.ok(scale, `${scaleId} should be registered`);

  return scale.questions.map((question) => {
    assert.ok(question.options.length > 0, `${scaleId} question ${question.id} should have options`);
    return question.options[question.options.length - 1].score;
  });
}

test("Phase 2 target scales are public clinical scales and score deterministically", () => {
  const publicScaleIds = new Set(listPublicClinicalChildScales().map((scale) => scale.id));

  for (const scaleId of TARGET_SCALE_IDS) {
    assert.ok(publicScaleIds.has(scaleId), `${scaleId} should be queryable in the child clinical catalog`);

    const answers = validAnswersForScale(scaleId);
    const firstResult = evaluateScaleAnswers(scaleId, answers);
    const secondResult = evaluateScaleAnswers(scaleId, [...answers]);

    assert.deepEqual(secondResult, firstResult, `${scaleId} should produce stable deterministic scoring`);
    assert.equal(typeof firstResult.totalScore, "number");
    assert.equal(typeof firstResult.conclusion, "string");
  }
});

test("legacy assessment save route recomputes score and ignores client result fields", async () => {
  const source = await fs.readFile("app/api/assessment/save/route.ts", "utf8");

  assert.match(source, /evaluateScaleAnswers/);
  assert.match(source, /const result = evaluateScaleAnswers\(scale\.id, deterministicAnswers\)/);
  assert.doesNotMatch(source, /const\s*\{[^}]*totalScore[^}]*\}\s*=\s*body/s);
  assert.doesNotMatch(source, /const\s*\{[^}]*conclusion[^}]*\}\s*=\s*body/s);
  assert.doesNotMatch(source, /totalScore:\s*normalizedScore/);
});

test("Skill session completion uses evaluateScaleAnswers as the only scoring source", async () => {
  const source = await fs.readFile("packages/assessment-skill/src/server/scale-service.ts", "utf8");

  assert.match(source, /evaluateScaleAnswers\(input\.scale\.id,\s*input\.answers\)/);
  assert.match(source, /evaluateScaleAnswers\(scale\.id,\s*input\.answers\)/);
  assert.doesNotMatch(source, /\.calculateScore\s*\(/);
});

test("MCP and Skill contracts expose Phase 2 mapping and scoring tools without dropping legacy tools", () => {
  const mcpToolNames = new Set(buildMcpManifest().tools.map((tool) => tool.name));
  for (const toolName of [
    "list_supported_scales",
    "get_scale_schema",
    "map_natural_language_answer",
    "confirm_mapped_answer",
    "score_assessment",
    "submit_and_evaluate",
  ]) {
    assert.ok(mcpToolNames.has(toolName), `MCP manifest should expose ${toolName}`);
  }

  const routeKeys = new Set(skillHttpRoutes.map((route) => `${route.method} ${route.path}`));
  assert.ok(routeKeys.has("POST /v1/scales/:scaleId/map-answer"));
  assert.ok(routeKeys.has("POST /v1/scales/:scaleId/mapped-answers/confirm"));
  assert.ok(routeKeys.has("POST /v1/scales/:scaleId/evaluate"));
});

test("natural language answer mapping marks low confidence suggestions for confirmation", async () => {
  const source = await fs.readFile("app/api/scales/analyze-conversation/route.ts", "utf8");
  const handlers = await fs.readFile("lib/mcp/skills/scale/handlers.ts", "utf8");

  assert.match(source, /needsConfirmation:\s*suggestion\.score !== null && suggestion\.confidence < 0\.8/);
  assert.match(source, /requiresExplicitSelection:\s*suggestion\.score !== null && suggestion\.confidence < 0\.6/);
  assert.match(handlers, /needsConfirmation:\s*mapping\.score !== null && mapping\.confidence < 0\.8/);
});
