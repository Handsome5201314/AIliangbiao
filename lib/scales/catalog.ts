import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

import { AllScales as builtinScales } from "@/lib/schemas/core/registry";
import type {
  ExecutableScaleDefinition,
  PatientInfoFieldType,
  ScaleCategory,
  ScaleDefinition,
  ScaleDimensionResult,
  ScaleManifest,
  ScaleManifestDimension,
  ScaleManifestThreshold,
  ScalePatientInfoField,
  ScaleQuestion,
  ScaleScoreResult,
  ScaleSummary,
} from "@/lib/schemas/core/types";

const localizedTextSchema = z.union([
  z.string(),
  z.object({
    zh: z.string(),
    en: z.string().optional(),
  }),
]);

const categorySchema = z.enum([
  "Child Development",
  "Mental Health",
  "Personality",
  "Career Assessment",
  "Cognitive Health",
  "General Health",
]) satisfies z.ZodType<ScaleCategory>;

const languageCodeSchema = z.enum(["zh", "en"]);

const interactionModeSchema = z.enum([
  "manual_only",
  "voice_guided",
  "full_voice",
  "call_mode",
]);

const patientInfoFieldTypeSchema = z.enum(["string", "number", "date"]) satisfies z.ZodType<PatientInfoFieldType>;

const patientInfoFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: patientInfoFieldTypeSchema,
});

const manifestOptionSchema = z.object({
  label: z.string(),
  score: z.number(),
  description: z.string().optional(),
  aliases: z.array(z.string()).optional(),
});

const manifestQuestionSchema = z.object({
  id: z.number(),
  externalId: z.string().optional(),
  text: localizedTextSchema,
  clinical_intent: z.string(),
  colloquial: localizedTextSchema,
  fallback_examples: z.array(localizedTextSchema),
  options: z.array(manifestOptionSchema).min(1),
  voicePrompt: localizedTextSchema.optional(),
  simpleExplain: localizedTextSchema.optional(),
  confirmationPrompt: localizedTextSchema.optional(),
  autoAnswerable: z.boolean().optional(),
  answerMappingHints: z
    .object({
      keywords: z.array(z.string()).optional(),
      phrases: z
        .array(
          z.object({
            score: z.number(),
            keywords: z.array(z.string()).min(1),
          })
        )
        .optional(),
      negativeKeywords: z.array(z.string()).optional(),
      irrelevantKeywords: z.array(z.string()).optional(),
    })
    .optional(),
  riskLevel: z.enum(["normal", "sensitive", "high"]).optional(),
  analysisHints: z
    .object({
      keywords: z.array(z.string()).optional(),
      optionKeywords: z
        .array(
          z.object({
            score: z.number(),
            keywords: z.array(z.string()).min(1),
          })
        )
        .optional(),
    })
    .optional(),
});

const manifestThresholdSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
  conclusion: z.string(),
  description: z.string().optional(),
  details: z.record(z.string(), z.unknown()).optional(),
});

const manifestDimensionSchema = z.object({
  id: z.string(),
  label: z.string(),
  questionIds: z.array(z.number()).min(1),
});

const manifestSchema = z.object({
  id: z.string(),
  version: z.string().optional(),
  shortName: z.string().optional(),
  title: localizedTextSchema,
  description: localizedTextSchema,
  instructions: localizedTextSchema.optional(),
  importantNotice: localizedTextSchema.optional(),
  reference: localizedTextSchema.optional(),
  patientInfoFields: z.array(patientInfoFieldSchema).optional(),
  source: z.literal("manifest"),
  category: categorySchema.optional(),
  tags: z.array(z.string()).optional(),
  estimatedMinutes: z.number().optional(),
  interactionMode: interactionModeSchema.optional(),
  supportedLanguages: z.array(languageCodeSchema).optional(),
  requiresConfirmation: z.boolean().optional(),
  questions: z.array(manifestQuestionSchema).min(1),
  scoring: z.object({
    method: z.literal("sum"),
    thresholds: z.array(manifestThresholdSchema).min(1),
    dimensions: z.array(manifestDimensionSchema).optional(),
  }),
});

const structuredOptionSchema = z.object({
  value: z.number(),
  label: z.string(),
  description: z.string().optional(),
});

const structuredQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  dimension: z.string(),
  options: z.array(structuredOptionSchema).optional(),
});

const structuredScaleSchema = z.object({
  version: z.string().optional(),
  category: categorySchema.optional(),
  tags: z.array(z.string()).optional(),
  estimatedMinutes: z.number().optional(),
  interactionMode: interactionModeSchema.optional(),
  supportedLanguages: z.array(languageCodeSchema).optional(),
  requiresConfirmation: z.boolean().optional(),
  Description: z.object({
    scale_id: z.string(),
    title: z.string(),
    short_name: z.string().optional(),
    reference: z.string().optional(),
    important_notice: z.string().optional(),
    instructions: z.string().optional(),
    patient_info_fields: z.array(patientInfoFieldSchema).optional(),
  }),
  Dimension: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        description: z.string().optional(),
      })
    )
    .min(1),
  Data: z.object({
    common_options: z.array(structuredOptionSchema).optional(),
    questions: z.array(structuredQuestionSchema).default([]),
    additional_questions: z.array(structuredQuestionSchema).default([]),
  }),
  Diagnosis: z.object({
    scoring_rules: z
      .array(
        z.object({
          dimension_target: z.string(),
          method: z.enum(["sum", "single_item"]),
          items: z.array(z.string()).min(1),
          min_score: z.number().optional(),
          max_score: z.number().optional(),
        })
      )
      .min(1),
    result_output: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
          source: z.string(),
        })
      )
      .optional(),
  }),
});

type StructuredScaleJson = z.infer<typeof structuredScaleSchema>;
type StructuredScaleOption = z.infer<typeof structuredOptionSchema>;

const manifestsDirectory = path.join(process.cwd(), "data", "scales");

function estimateScaleMinutes(scale: Pick<ScaleDefinition, "questions" | "estimatedMinutes">): number {
  if (scale.estimatedMinutes && scale.estimatedMinutes > 0) {
    return scale.estimatedMinutes;
  }

  const questionCount = scale.questions.length;
  if (questionCount <= 20) return 5;
  if (questionCount <= 40) return 8;
  if (questionCount <= 60) return 12;
  return 15;
}

function toSerializableScale(scale: ExecutableScaleDefinition): ScaleDefinition {
  const { calculateScore: _ignored, ...serializableScale } = scale;
  return {
    ...serializableScale,
    estimatedMinutes: estimateScaleMinutes(serializableScale),
  };
}

function toScaleSummary(scale: ScaleDefinition): ScaleSummary {
  const { questions, ...summary } = scale;
  return {
    ...summary,
    questionCount: questions.length,
  };
}

function matchesThreshold(totalScore: number, threshold: ScaleManifestThreshold): boolean {
  const aboveMinimum = threshold.min === undefined || totalScore >= threshold.min;
  const belowMaximum = threshold.max === undefined || totalScore <= threshold.max;
  return aboveMinimum && belowMaximum;
}

function buildDimensionScores(
  answers: number[],
  questions: ScaleQuestion[],
  dimensions?: ScaleManifestDimension[]
): Record<string, { label: string; score: number }> | undefined {
  if (!dimensions?.length) {
    return undefined;
  }

  const scoreMap = new Map<number, number>();
  questions.forEach((question, index) => {
    scoreMap.set(question.id, answers[index] ?? 0);
  });

  return dimensions.reduce<Record<string, { label: string; score: number }>>((result, dimension) => {
    const score = dimension.questionIds.reduce((sum, questionId) => {
      return sum + (scoreMap.get(questionId) ?? 0);
    }, 0);

    result[dimension.id] = {
      label: dimension.label,
      score,
    };

    return result;
  }, {});
}

function buildManifestDimensionResults(
  answers: number[],
  questions: ScaleQuestion[],
  dimensions?: ScaleManifestDimension[]
): ScaleDimensionResult[] | undefined {
  const dimensionsMap = buildDimensionScores(answers, questions, dimensions);
  if (!dimensionsMap) {
    return undefined;
  }

  return Object.entries(dimensionsMap).map(([id, dimension]) => ({
    id,
    label: dimension.label,
    score: dimension.score,
    displayValue: `${dimension.score}分`,
  }));
}

function normalizeScaleScoreResult(result: ScaleScoreResult): ScaleScoreResult {
  const dimensionResults = result.details?.dimensionResults ?? deriveDimensionResultsFromLegacyDetails(result.details);
  if (!dimensionResults?.length) {
    return result;
  }

  return {
    ...result,
    details: {
      ...(result.details ?? {}),
      dimensionResults,
    },
  };
}

function deriveDimensionResultsFromLegacyDetails(
  details: ScaleScoreResult["details"]
): ScaleDimensionResult[] | undefined {
  const rawDimensions = details?.dimensions;
  if (!rawDimensions || typeof rawDimensions !== "object" || Array.isArray(rawDimensions)) {
    return undefined;
  }

  const dimensionResults: ScaleDimensionResult[] = [];

  Object.entries(rawDimensions as Record<string, unknown>).forEach(([id, value]) => {
    if (typeof value === "number") {
      dimensionResults.push({
        id,
        label: id,
        score: value,
        displayValue: `${value}分`,
      });
      return;
    }

    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return;
    }

    const record = value as Record<string, unknown>;
    if (typeof record.score !== "number") {
      return;
    }

    dimensionResults.push({
      id,
      label: typeof record.label === "string" ? record.label : id,
      score: record.score,
      displayValue: `${record.score}分`,
      description: typeof record.description === "string" ? record.description : undefined,
    });
  });

  return dimensionResults.length ? dimensionResults : undefined;
}

function buildManifestScale(manifest: ScaleManifest): ExecutableScaleDefinition {
  return {
    ...manifest,
    estimatedMinutes: estimateScaleMinutes(manifest),
    calculateScore(answers: number[]): ScaleScoreResult {
      const totalScore = answers.reduce((sum, score) => sum + score, 0);
      const threshold =
        manifest.scoring.thresholds.find((candidate) => matchesThreshold(totalScore, candidate)) ??
        manifest.scoring.thresholds[manifest.scoring.thresholds.length - 1];
      const dimensions = buildDimensionScores(answers, manifest.questions, manifest.scoring.dimensions);
      const dimensionResults = buildManifestDimensionResults(answers, manifest.questions, manifest.scoring.dimensions);

      return normalizeScaleScoreResult({
        totalScore,
        conclusion: threshold.conclusion,
        details: {
          ...(threshold.details ?? {}),
          ...(threshold.description ? { description: threshold.description } : {}),
          ...(dimensions ? { dimensions } : {}),
          ...(dimensionResults ? { dimensionResults } : {}),
        },
      });
    },
  };
}

function buildStructuredScaleDescription(scale: StructuredScaleJson): string {
  const dimensionNames = scale.Dimension.map((dimension) => dimension.name);
  if (!dimensionNames.length) {
    return `${scale.Description.title}。`;
  }

  return `用于评估${dimensionNames.join("、")}。`;
}

function extractKeywordCandidates(text: string): string[] {
  const cleanedText = text
    .replace(/[（）()]/g, "、")
    .replace(/[：:]/g, "、")
    .replace(/\s+/g, "");

  return [...new Set(cleanedText.split(/[、，,。；;\/]/).map((item) => item.trim()))].filter((item) => {
    return item.length >= 2 && item.length <= 16;
  });
}

function buildDefaultAnalysisHints(text: string, options: Array<{ score: number; keywords: string[] }>) {
  const keywords = extractKeywordCandidates(text);
  return {
    keywords: keywords.length ? keywords : [text],
    optionKeywords: options,
  };
}

function toScaleOption(option: StructuredScaleOption) {
  return {
    label: option.label,
    score: option.value,
    description: option.description,
    aliases: option.description ? [option.description] : undefined,
  };
}

function buildStructuredResultDescription(
  scale: StructuredScaleJson,
  primaryResult: ScaleDimensionResult | undefined,
  dimensionResults: ScaleDimensionResult[]
): string {
  const otherDimensions = dimensionResults
    .filter((dimension) => primaryResult && dimension.id !== primaryResult.id)
    .map((dimension) => `${dimension.label}：${dimension.displayValue ?? `${dimension.score}分`}`);

  const lines = [
    `${scale.Description.title}评估已完成。`,
    primaryResult ? `${primaryResult.label}：${primaryResult.displayValue ?? `${primaryResult.score}分`}` : "",
    otherDimensions.length ? `其他维度：${otherDimensions.join("；")}` : "",
    "本结果仅供临床沟通与复测比较参考，请结合专业医生判断。",
  ].filter(Boolean);

  return lines.join("\n");
}

function buildStructuredScale(structuredScale: StructuredScaleJson): ExecutableScaleDefinition {
  const dimensionsById = new Map(structuredScale.Dimension.map((dimension) => [dimension.id, dimension]));
  const baseOptions = structuredScale.Data.common_options?.map(toScaleOption) ?? [];
  const orderedQuestions = [...structuredScale.Data.questions, ...structuredScale.Data.additional_questions];

  const questions: ScaleQuestion[] = orderedQuestions.map((question, index) => {
    const dimension = dimensionsById.get(question.dimension);
    const questionOptions = (question.options?.map(toScaleOption) ?? baseOptions).map((option) => ({
      ...option,
      aliases: option.aliases?.filter(Boolean),
      description: option.description,
    }));

    if (!questionOptions.length) {
      throw new Error(`Question ${question.id} in ${structuredScale.Description.scale_id} is missing options`);
    }

    return {
      id: index + 1,
      externalId: question.id,
      text: question.text,
      clinical_intent: dimension?.description || `评估${dimension?.name || question.dimension}`,
      colloquial: question.text,
      fallback_examples: [],
      options: questionOptions,
      analysisHints: buildDefaultAnalysisHints(
        question.text,
        questionOptions.map((option) => ({
          score: option.score,
          keywords: [option.label, ...(option.aliases ?? [])],
        }))
      ),
      simpleExplain: dimension?.description,
    };
  });

  const patientInfoFields = (structuredScale.Description.patient_info_fields ?? []).map((field) => ({
    ...field,
    required: true,
  }));

  return {
    id: structuredScale.Description.scale_id,
    version: structuredScale.version || "1.0",
    shortName: structuredScale.Description.short_name || structuredScale.Description.scale_id,
    title: structuredScale.Description.title,
    description: buildStructuredScaleDescription(structuredScale),
    instructions: structuredScale.Description.instructions,
    importantNotice: structuredScale.Description.important_notice,
    reference: structuredScale.Description.reference,
    patientInfoFields,
    category: structuredScale.category || "General Health",
    questions,
    source: "structured",
    tags:
      structuredScale.tags ||
      [structuredScale.Description.short_name || structuredScale.Description.scale_id, structuredScale.Description.title],
    estimatedMinutes: structuredScale.estimatedMinutes,
    interactionMode: structuredScale.interactionMode || "manual_only",
    supportedLanguages: structuredScale.supportedLanguages || ["zh"],
    requiresConfirmation: structuredScale.requiresConfirmation ?? false,
    calculateScore(answers: number[]): ScaleScoreResult {
      const safeAnswers = questions.map((_, index) => answers[index] ?? 0);
      const answerByExternalId = new Map<string, number>();

      questions.forEach((question, index) => {
        answerByExternalId.set(question.externalId || String(question.id), safeAnswers[index] ?? 0);
      });

      const dimensionResults = structuredScale.Diagnosis.scoring_rules.map((rule) => {
        const dimension = dimensionsById.get(rule.dimension_target);
        const itemScores = rule.items.map((itemId) => answerByExternalId.get(itemId) ?? 0);
        const score = rule.method === "single_item" ? (itemScores[0] ?? 0) : itemScores.reduce((sum, value) => sum + value, 0);
        const firstItemId = rule.items[0];
        const firstQuestion = questions.find((question) => question.externalId === firstItemId);
        const optionLabel =
          rule.method === "single_item"
            ? firstQuestion?.options.find((option) => option.score === score)?.label
            : undefined;

        return {
          id: rule.dimension_target,
          label: dimension?.name || rule.dimension_target,
          score,
          maxScore: rule.max_score,
          displayValue: optionLabel ? `${optionLabel} (${score}分)` : `${score}分`,
          description: dimension?.description,
        } satisfies ScaleDimensionResult;
      });

      const primaryOutput = structuredScale.Diagnosis.result_output?.[0];
      const primaryResult =
        dimensionResults.find((dimension) => dimension.id === primaryOutput?.source) ?? dimensionResults[0];
      const totalScoreHint = dimensionResults
        .filter((dimension) => primaryResult && dimension.id !== primaryResult.id)
        .map((dimension) => dimension.label);

      return normalizeScaleScoreResult({
        totalScore: primaryResult?.score ?? 0,
        conclusion: `${structuredScale.Description.short_name || structuredScale.Description.scale_id}评估已完成`,
        details: {
          description: buildStructuredResultDescription(structuredScale, primaryResult, dimensionResults),
          scoreLabel: primaryOutput?.label || primaryResult?.label || "总分",
          scoreDisplay: primaryResult?.displayValue || `${primaryResult?.score ?? 0}分`,
          totalScoreLabel: primaryResult?.label || "总分",
          ...(totalScoreHint.length
            ? {
                totalScoreHint: `${totalScoreHint.join("、")}单独展示，不计入总分。`,
              }
            : {}),
          dimensionResults,
          structuredScale: {
            resultOutput: structuredScale.Diagnosis.result_output || [],
          },
        },
      });
    },
  };
}

function parseScaleFile(filePath: string): ExecutableScaleDefinition {
  const rawContent = fs.readFileSync(filePath, "utf8");
  const parsedJson = JSON.parse(rawContent) as Record<string, unknown>;

  if (parsedJson?.source === "manifest") {
    const parsedManifest = manifestSchema.parse(parsedJson) as ScaleManifest;
    return buildManifestScale(parsedManifest);
  }

  if (parsedJson?.Description && parsedJson?.Diagnosis) {
    const parsedStructuredScale = structuredScaleSchema.parse(parsedJson);
    return buildStructuredScale(parsedStructuredScale);
  }

  throw new Error(`Unsupported scale format in ${path.basename(filePath)}`);
}

function readManifestScales(): ExecutableScaleDefinition[] {
  if (!fs.existsSync(manifestsDirectory)) {
    return [];
  }

  return fs
    .readdirSync(manifestsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => parseScaleFile(path.join(manifestsDirectory, entry.name)));
}

function mergeScaleDefinitions(scales: ExecutableScaleDefinition[]): ExecutableScaleDefinition[] {
  const dedupedScales = new Map<string, ExecutableScaleDefinition>();

  scales.forEach((scale) => {
    dedupedScales.set(scale.id.toUpperCase(), scale);
  });

  return [...dedupedScales.values()];
}

function normalizePatientInfoFieldValue(field: ScalePatientInfoField, rawValue: unknown): string | number {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    throw new Error(`Missing required field: ${field.label}`);
  }

  if (field.type === "number") {
    const numericValue =
      typeof rawValue === "number" ? rawValue : Number.parseFloat(String(rawValue).trim());
    if (!Number.isFinite(numericValue)) {
      throw new Error(`Invalid number for field: ${field.label}`);
    }
    return numericValue;
  }

  const stringValue = String(rawValue).trim();
  if (!stringValue) {
    throw new Error(`Missing required field: ${field.label}`);
  }

  if (field.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
    throw new Error(`Invalid date for field: ${field.label}`);
  }

  return stringValue;
}

function normalizeScaleFormDataForScale(
  scale: Pick<ScaleDefinition, "id" | "patientInfoFields">,
  formData?: Record<string, unknown>
): Record<string, string | number | null> | undefined {
  const patientInfoFields = scale.patientInfoFields ?? [];
  if (!patientInfoFields.length) {
    return undefined;
  }

  if (!formData || typeof formData !== "object" || Array.isArray(formData)) {
    throw new Error(`Scale ${scale.id} requires patient information`);
  }

  return patientInfoFields.reduce<Record<string, string | number | null>>((result, field) => {
    result[field.id] = normalizePatientInfoFieldValue(field, formData[field.id]);
    return result;
  }, {});
}

type ScaleCatalogCache = {
  definitions: ExecutableScaleDefinition[];
  serializableScales: ScaleDefinition[];
  scaleSummaries: ScaleSummary[];
};

const globalForScaleCatalog = globalThis as typeof globalThis & {
  __aiScaleCatalogCache?: ScaleCatalogCache;
};

function buildScaleCatalogCache(): ScaleCatalogCache {
  const definitions = mergeScaleDefinitions([...builtinScales, ...readManifestScales()]);
  const serializableScales = definitions.map(toSerializableScale);
  const scaleSummaries = serializableScales.map(toScaleSummary);

  return {
    definitions,
    serializableScales,
    scaleSummaries,
  };
}

function getScaleCatalogCache(): ScaleCatalogCache {
  if (process.env.NODE_ENV === "production") {
    if (!globalForScaleCatalog.__aiScaleCatalogCache) {
      globalForScaleCatalog.__aiScaleCatalogCache = buildScaleCatalogCache();
    }

    return globalForScaleCatalog.__aiScaleCatalogCache;
  }

  return buildScaleCatalogCache();
}

export function getAllScaleDefinitions(): ExecutableScaleDefinition[] {
  return getScaleCatalogCache().definitions;
}

export function listSerializableScales(): ScaleDefinition[] {
  return getScaleCatalogCache().serializableScales;
}

export function listSerializableScaleSummaries(): ScaleSummary[] {
  return getScaleCatalogCache().scaleSummaries;
}

export function getScaleDefinitionById(scaleId: string): ExecutableScaleDefinition | undefined {
  return getScaleCatalogCache().definitions.find((scale) => scale.id.toUpperCase() === scaleId.toUpperCase());
}

export function getSerializableScaleById(scaleId: string): ScaleDefinition | undefined {
  return getScaleCatalogCache().serializableScales.find((scale) => scale.id.toUpperCase() === scaleId.toUpperCase());
}

export function normalizeScaleFormData(
  scaleId: string,
  formData?: Record<string, unknown>
): Record<string, string | number | null> | undefined {
  const scale = getScaleDefinitionById(scaleId);

  if (!scale) {
    throw new Error(`Scale ${scaleId} not found`);
  }

  return normalizeScaleFormDataForScale(scale, formData);
}

export function evaluateScaleAnswers(
  scaleId: string,
  answers: number[],
  formData?: Record<string, unknown>
): ScaleScoreResult {
  const scale = getScaleDefinitionById(scaleId);

  if (!scale) {
    throw new Error(`Scale ${scaleId} not found`);
  }

  normalizeScaleFormDataForScale(scale, formData);
  return normalizeScaleScoreResult(scale.calculateScore(answers));
}
