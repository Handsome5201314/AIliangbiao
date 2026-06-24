import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
const DEMO_DATA_PATH = path.join(
  REPO_ROOT,
  "packages",
  "assessment-skill",
  "demo",
  "phase8-demo-cases.json"
);

const FORBIDDEN_IDENTITY_KEYS = new Set([
  "name",
  "realname",
  "fullname",
  "childname",
  "guardianname",
  "phone",
  "mobile",
  "idcard",
  "nationalid",
  "birthday",
  "birthdate",
  "address",
  "school",
  "medicalrecordno",
  "patientid",
]);

function normalizeKey(key) {
  return key.toLowerCase().replaceAll("_", "").replaceAll("-", "");
}

function collectSafetySignals(value, pathParts = []) {
  const issues = [];

  if (typeof value === "string") {
    if (/1[3-9]\d{9}/.test(value)) {
      issues.push(`phone-like string at ${pathParts.join(".") || "<root>"}`);
    }
    if (/\b\d{17}[\dXx]\b/.test(value)) {
      issues.push(`id-card-like string at ${pathParts.join(".") || "<root>"}`);
    }
    return issues;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      issues.push(...collectSafetySignals(item, [...pathParts, String(index)]));
    });
    return issues;
  }

  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      if (FORBIDDEN_IDENTITY_KEYS.has(normalizeKey(key))) {
        issues.push(`forbidden identity key "${key}" at ${pathParts.join(".") || "<root>"}`);
      }
      issues.push(...collectSafetySignals(item, [...pathParts, key]));
    });
  }

  return issues;
}

async function loadCatalog() {
  const imported = await import(pathToFileURL(path.join(REPO_ROOT, "lib", "scales", "catalog.ts")).href);
  return imported.default ?? imported["module.exports"] ?? imported;
}

async function loadMcpScaleHandlers() {
  const imported = await import(
    pathToFileURL(path.join(REPO_ROOT, "lib", "mcp", "skills", "scale", "handlers.ts")).href
  );
  return imported.default ?? imported["module.exports"] ?? imported;
}

export async function loadPhase8DemoCases() {
  const payload = JSON.parse(await fs.readFile(DEMO_DATA_PATH, "utf8"));
  assertDemoPayloadSafety(payload);
  return payload;
}

export function assertDemoPayloadSafety(payload) {
  if (!payload || typeof payload !== "object") {
    throw new Error("Phase 8 demo payload must be an object");
  }
  if (payload.demo_mode !== true || payload.synthetic_data_only !== true || payload.watermark !== "DEMO_ONLY") {
    throw new Error("Phase 8 demo payload must carry demo_mode, synthetic_data_only and DEMO_ONLY watermark");
  }
  if (!Array.isArray(payload.cases) || payload.cases.length !== 5) {
    throw new Error("Phase 8 demo payload must contain exactly five cases");
  }

  const issues = collectSafetySignals(payload);
  if (issues.length > 0) {
    throw new Error(`Phase 8 demo payload contains unsafe identity-like data: ${issues.join("; ")}`);
  }
}

function jsonRpcToolCall(id, name, args) {
  return {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: {
      name,
      arguments: args,
    },
  };
}

function expandAnswers(demoCase, scale) {
  if (demoCase.answers.length === scale.questions.length) {
    return demoCase.answers;
  }

  if (demoCase.answerExpansion !== "repeat_to_scale_length") {
    throw new Error(
      `${demoCase.caseId} has ${demoCase.answers.length} answers, expected ${scale.questions.length}`
    );
  }

  return Array.from({ length: scale.questions.length }, (_, index) => {
    const rawScore = demoCase.answers[index % demoCase.answers.length];
    const allowedScores = scale.questions[index].options.map((option) => option.score);
    if (allowedScores.includes(rawScore)) {
      return rawScore;
    }

    const fallbackIndex = Math.abs(Number(rawScore) || 0) % allowedScores.length;
    return allowedScores[fallbackIndex];
  });
}

function assertAnswersMatchScale(demoCase, scale, answers) {
  if (answers.length !== scale.questions.length) {
    throw new Error(`${demoCase.caseId} answer count mismatch: ${answers.length}/${scale.questions.length}`);
  }

  answers.forEach((score, index) => {
    const question = scale.questions[index];
    if (!question.options.some((option) => option.score === score)) {
      throw new Error(`${demoCase.caseId} score ${score} is invalid for question ${question.id}`);
    }
  });
}

function buildCaseCalls(demoCase, answers, index) {
  const deviceId = `phase8-${demoCase.caseId}`;
  const sessionIdPlaceholder = "{{sessionId_from_create_assessment_session}}";
  const firstQuestionId = demoCase.mappingExample?.questionId ?? 1;
  const firstScore = answers[0];
  const calls = [
    jsonRpcToolCall(`${index + 1}.1`, "list_supported_scales", {}),
    jsonRpcToolCall(`${index + 1}.2`, "get_scale_schema", {
      scaleId: demoCase.scaleId,
    }),
    jsonRpcToolCall(`${index + 1}.3`, "create_assessment_session", {
      deviceId,
      scaleId: demoCase.scaleId,
      language: demoCase.language || "zh",
    }),
  ];

  if (demoCase.handoffDemo?.scaleId) {
    calls.push(
      jsonRpcToolCall(`${index + 1}.4`, "generate_assessment_link", {
        deviceId: `${deviceId}-handoff`,
        scaleId: demoCase.handoffDemo.scaleId,
        language: demoCase.language || "zh",
      })
    );
  }

  calls.push(
    jsonRpcToolCall(`${index + 1}.5`, "map_natural_language_answer", {
      scaleId: demoCase.scaleId,
      questionId: firstQuestionId,
      text: demoCase.mappingExample?.text || "DEMO_ONLY answer text",
      language: demoCase.language || "zh",
    }),
    jsonRpcToolCall(`${index + 1}.6`, "confirm_mapped_answer", {
      scaleId: demoCase.scaleId,
      questionId: firstQuestionId,
      score: demoCase.mappingExample?.expectedScore ?? firstScore,
      confidence: 0.72,
      evidence: "DEMO_ONLY synthetic answer mapping; user confirmation required before submit.",
    }),
    jsonRpcToolCall(`${index + 1}.7`, "submit_answer", {
      deviceId,
      sessionId: sessionIdPlaceholder,
      questionId: firstQuestionId,
      score: firstScore,
    }),
    jsonRpcToolCall(`${index + 1}.8`, "score_assessment", {
      scaleId: demoCase.scaleId,
      answers,
    }),
    jsonRpcToolCall(`${index + 1}.9`, "get_assessment_result", {
      deviceId,
      sessionId: sessionIdPlaceholder,
    })
  );

  return calls;
}

export async function buildPhase8DemoReplay(options = {}) {
  const payload = await loadPhase8DemoCases();
  const catalog = await loadCatalog();

  return {
    demo_mode: true,
    synthetic_data_only: true,
    watermark: "DEMO_ONLY",
    note: "Replay calls are safe competition artifacts. Database-backed session calls are emitted as JSON-RPC payloads; deterministic scoring is executed locally.",
    cases: payload.cases.map((demoCase, index) => {
      const scale = catalog.getScaleDefinitionById(demoCase.scaleId);
      if (!scale) {
        throw new Error(`${demoCase.caseId} references unknown scale ${demoCase.scaleId}`);
      }

      const answers = expandAnswers(demoCase, scale);
      assertAnswersMatchScale(demoCase, scale, answers);

      return {
        caseId: demoCase.caseId,
        demo_mode: true,
        synthetic_data_only: true,
        watermark: "DEMO_ONLY",
        scaleId: demoCase.scaleId,
        resultDeliveryMode: catalog.resolveScaleResultDeliveryMode(scale),
        doctorReviewRequired: catalog.resolveScaleResultDeliveryMode(scale) === "physician_review",
        safetyFocus: demoCase.safetyFocus,
        mcpCalls: buildCaseCalls(demoCase, answers, index),
        ...(options.includeResults ? { answers } : {}),
      };
    }),
  };
}

async function executeSafeMcpTools(demoCase, answers) {
  const handlers = await loadMcpScaleHandlers();
  const handleScaleToolCall = handlers.handleScaleToolCall;
  if (typeof handleScaleToolCall !== "function") {
    throw new Error("MCP scale handler export handleScaleToolCall is not available");
  }

  const [catalogResult, schemaResult, scoreResult] = await Promise.all([
    handleScaleToolCall("list_supported_scales", {}),
    handleScaleToolCall("get_scale_schema", { scaleId: demoCase.scaleId }),
    handleScaleToolCall("score_assessment", { scaleId: demoCase.scaleId, answers }),
  ]);

  if (!catalogResult?.success || !schemaResult?.success || !scoreResult?.success) {
    throw new Error(`${demoCase.caseId} safe MCP tool replay failed`);
  }

  return {
    executedTools: ["list_supported_scales", "get_scale_schema", "score_assessment"],
    deterministicScore: toDemoScorePreview(scoreResult.result),
  };
}

function toDemoScorePreview(scoreResult) {
  return {
    totalScore: scoreResult.totalScore,
    rawConclusionRedactedForDemo: true,
    detailsRedactedForDemo: true,
    source: "evaluateScaleAnswers via MCP score_assessment",
  };
}

export async function runPhase8DemoReplay(options = {}) {
  const payload = await loadPhase8DemoCases();
  const replay = await buildPhase8DemoReplay({ includeResults: true });
  const catalog = await loadCatalog();

  const cases = [];
  for (const replayCase of replay.cases) {
    const demoCase = payload.cases.find((candidate) => candidate.caseId === replayCase.caseId);
    const scale = catalog.getScaleDefinitionById(replayCase.scaleId);
    const answers = replayCase.answers;
    const safeMcpExecution = await executeSafeMcpTools(demoCase, answers);
    const resultDeliveryMode = catalog.resolveScaleResultDeliveryMode(scale);

    cases.push({
      caseId: replayCase.caseId,
      scaleId: replayCase.scaleId,
      callCount: replayCase.mcpCalls.length,
      executedTools: safeMcpExecution.executedTools,
      deterministicScore: safeMcpExecution.deterministicScore,
      safety: {
        demo_mode: true,
        synthetic_data_only: true,
        watermark: "DEMO_ONLY",
        resultDeliveryMode,
        doctorReviewRequired: resultDeliveryMode === "physician_review",
        formalReportStatus:
          resultDeliveryMode === "physician_review" ? "doctor_review_required" : "not_formal_report",
        explanation:
          "DEMO_ONLY：该输出只用于比赛演示和医生复核预览，不构成诊断、处方或未复核正式报告。",
      },
    });
  }

  const result = {
    demo_mode: true,
    synthetic_data_only: true,
    watermark: "DEMO_ONLY",
    cases,
  };

  if (!options.quiet) {
    console.log(JSON.stringify(result, null, 2));
  }

  return result;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  runPhase8DemoReplay().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
