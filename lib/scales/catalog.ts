import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

import { AllScales as builtinScales } from "@/lib/schemas/core/registry";
import type {
  ExecutableScaleDefinition,
  ScaleAudience,
  ScaleProductGroup,
  ScaleDefinition,
  ScaleCategory,
  ScaleResultDeliveryMode,
  ScaleStatus,
  ScaleManifest,
  ScaleManifestDimension,
  ScaleManifestThreshold,
  ScaleQuestion,
  ScaleScoreResult,
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
  "web_handoff",
]);

const resultDeliveryModeSchema = z.enum([
  "immediate",
  "physician_review",
]);

const audienceSchema = z.enum([
  "child",
  "adult",
  "personality",
  "career",
]) satisfies z.ZodType<ScaleAudience>;

const productGroupSchema = z.enum([
  "clinical_child",
  "exploration",
  "growth",
]) satisfies z.ZodType<ScaleProductGroup>;

const statusSchema = z.enum([
  "active",
  "disabled",
  "legacy",
]) satisfies z.ZodType<ScaleStatus>;

const manifestOptionSchema = z.object({
  label: z.string(),
  score: z.number(),
  aliases: z.array(z.string()).optional(),
  description: localizedTextSchema.optional(),
});

const manifestSymptomOptionSchema = z.object({
  id: z.string(),
  label: localizedTextSchema,
});

const manifestQuestionSchema = z.object({
  id: z.number(),
  text: localizedTextSchema,
  clinical_intent: z.string(),
  colloquial: localizedTextSchema,
  fallback_examples: z.array(localizedTextSchema),
  options: z.array(manifestOptionSchema).min(1),
  symptomOptions: z.array(manifestSymptomOptionSchema).optional(),
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
  title: localizedTextSchema,
  description: localizedTextSchema,
  source: z.literal("manifest"),
  category: categorySchema.optional(),
  tags: z.array(z.string()).optional(),
  estimatedMinutes: z.number().optional(),
  interactionMode: interactionModeSchema.optional(),
  supportedLanguages: z.array(languageCodeSchema).optional(),
  requiresConfirmation: z.boolean().optional(),
  resultDeliveryMode: resultDeliveryModeSchema.optional(),
  audience: audienceSchema.optional(),
  productGroup: productGroupSchema.optional(),
  isPediatric: z.boolean().optional(),
  status: statusSchema.optional(),
  defaultVisible: z.boolean().optional(),
  voiceFriendly: z.boolean().optional(),
  questions: z.array(manifestQuestionSchema).min(1),
  scoring: z.object({
    method: z.literal("sum"),
    thresholds: z.array(manifestThresholdSchema).min(1),
    dimensions: z.array(manifestDimensionSchema).optional(),
    scoreQuestionIds: z.array(z.number()).optional(),
    totalScoreLabel: z.string().optional(),
    totalScoreHint: z.string().optional(),
  }),
});

const manifestsDirectory = path.join(process.cwd(), "data", "scales");
const legacyManifestFilenames = new Set(["phq-9.json", "gad-7.json", "sss.json"]);

export type ScaleCatalogSelector =
  | "publicClinicalChild"
  | "exploration"
  | "doctorVisible"
  | "adminAll"
  | "voiceFriendlyChild";

export type ScaleCatalogCategoryParam = "all_child" | "exploration";

type ScaleCatalogMetadata = Required<
  Pick<
    ScaleDefinition,
    "audience" | "productGroup" | "isPediatric" | "status" | "defaultVisible" | "voiceFriendly"
  >
>;

type ScaleCatalogLookupOptions = {
  selector?: ScaleCatalogSelector;
  doctorExplorationEnabled?: boolean;
};

const DEFAULT_CHILD_CLINICAL_METADATA: ScaleCatalogMetadata = {
  audience: "child",
  productGroup: "clinical_child",
  isPediatric: true,
  status: "active",
  defaultVisible: true,
  voiceFriendly: false,
};

const DEFAULT_EXPLORATION_ADULT_METADATA: ScaleCatalogMetadata = {
  audience: "adult",
  productGroup: "exploration",
  isPediatric: false,
  status: "active",
  defaultVisible: false,
  voiceFriendly: false,
};

const SCALE_METADATA_OVERRIDES: Record<string, ScaleCatalogMetadata> = {
  ABC: { ...DEFAULT_CHILD_CLINICAL_METADATA },
  ATEC: { ...DEFAULT_CHILD_CLINICAL_METADATA },
  CARS: { ...DEFAULT_CHILD_CLINICAL_METADATA },
  M_CHAT_R: { ...DEFAULT_CHILD_CLINICAL_METADATA, voiceFriendly: true },
  SRS: { ...DEFAULT_CHILD_CLINICAL_METADATA },
  "SNAP-IV": { ...DEFAULT_CHILD_CLINICAL_METADATA, voiceFriendly: true },
  CBCL_113: { ...DEFAULT_CHILD_CLINICAL_METADATA },
  TAS_37: { ...DEFAULT_CHILD_CLINICAL_METADATA },
  VINELAND_3: { ...DEFAULT_CHILD_CLINICAL_METADATA },
  "PHQ-9": { ...DEFAULT_EXPLORATION_ADULT_METADATA },
  "GAD-7": { ...DEFAULT_EXPLORATION_ADULT_METADATA },
  PSQI_18: { ...DEFAULT_EXPLORATION_ADULT_METADATA },
  SSS: { ...DEFAULT_EXPLORATION_ADULT_METADATA },
  RSES_10: {
    ...DEFAULT_EXPLORATION_ADULT_METADATA,
    audience: "personality",
  },
  MBTI: {
    ...DEFAULT_EXPLORATION_ADULT_METADATA,
    audience: "personality",
  },
  HOLLAND: {
    ...DEFAULT_EXPLORATION_ADULT_METADATA,
    audience: "career",
  },
  MMSE_30: { ...DEFAULT_EXPLORATION_ADULT_METADATA },
  MOCA_30: { ...DEFAULT_EXPLORATION_ADULT_METADATA },
};

function isManifestCandidateFile(entryName: string) {
  return entryName.endsWith(".scale.json") || legacyManifestFilenames.has(entryName.toLowerCase());
}

function logManifestSkip(filePath: string, reason: string, error?: unknown) {
  const details =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : typeof error === "string"
        ? error
        : undefined;

  console.warn(
    `[scale-manifest] Skipping ${path.basename(filePath)}: ${reason}${details ? ` (${details})` : ""}`
  );
}

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

function inferScaleCatalogMetadata(scale: ScaleDefinition): ScaleCatalogMetadata {
  switch (scale.category) {
    case "Child Development":
      return { ...DEFAULT_CHILD_CLINICAL_METADATA };
    case "Personality":
      return {
        ...DEFAULT_EXPLORATION_ADULT_METADATA,
        audience: "personality",
      };
    case "Career Assessment":
      return {
        ...DEFAULT_EXPLORATION_ADULT_METADATA,
        audience: "career",
      };
    case "Cognitive Health":
    case "General Health":
      return { ...DEFAULT_EXPLORATION_ADULT_METADATA };
    case "Mental Health":
      return scale.source === "manifest"
        ? { ...DEFAULT_EXPLORATION_ADULT_METADATA }
        : { ...DEFAULT_CHILD_CLINICAL_METADATA };
    default:
      return scale.source === "manifest"
        ? { ...DEFAULT_EXPLORATION_ADULT_METADATA }
        : { ...DEFAULT_CHILD_CLINICAL_METADATA };
  }
}

function resolveScaleCatalogMetadata(scale: ScaleDefinition): ScaleCatalogMetadata {
  const override = SCALE_METADATA_OVERRIDES[scale.id.toUpperCase()];
  const inferred = inferScaleCatalogMetadata(scale);

  return {
    audience: scale.audience ?? override?.audience ?? inferred.audience,
    productGroup: scale.productGroup ?? override?.productGroup ?? inferred.productGroup,
    isPediatric: scale.isPediatric ?? override?.isPediatric ?? inferred.isPediatric,
    status: scale.status ?? override?.status ?? inferred.status,
    defaultVisible: scale.defaultVisible ?? override?.defaultVisible ?? inferred.defaultVisible,
    voiceFriendly: scale.voiceFriendly ?? override?.voiceFriendly ?? inferred.voiceFriendly,
  };
}

function withCatalogMetadata<T extends ScaleDefinition>(scale: T): T & ScaleCatalogMetadata {
  return {
    ...scale,
    ...resolveScaleCatalogMetadata(scale),
  };
}

function toSerializableScale(scale: ExecutableScaleDefinition): ScaleDefinition {
  const { calculateScore: _ignored, ...serializableScale } = scale;
  return withCatalogMetadata({
    ...serializableScale,
    estimatedMinutes: estimateScaleMinutes(serializableScale),
  });
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

function buildQuestionScoreMap(answers: number[], questions: ScaleQuestion[]): Map<number, number> {
  const scoreMap = new Map<number, number>();

  questions.forEach((question, index) => {
    scoreMap.set(question.id, answers[index] ?? 0);
  });

  return scoreMap;
}

function buildManifestTotalScore(
  answers: number[],
  questions: ScaleQuestion[],
  scoreQuestionIds?: number[]
): number {
  if (!scoreQuestionIds?.length) {
    return answers.reduce((sum, score) => sum + score, 0);
  }

  const scoreMap = buildQuestionScoreMap(answers, questions);

  return scoreQuestionIds.reduce((sum, questionId) => {
    return sum + (scoreMap.get(questionId) ?? 0);
  }, 0);
}

function buildManifestScale(manifest: ScaleManifest): ExecutableScaleDefinition {
  return {
    ...manifest,
    estimatedMinutes: estimateScaleMinutes(manifest),
    calculateScore(answers: number[]): ScaleScoreResult {
      const totalScore = buildManifestTotalScore(
        answers,
        manifest.questions,
        manifest.scoring.scoreQuestionIds
      );
      const threshold =
        manifest.scoring.thresholds.find((candidate) => matchesThreshold(totalScore, candidate)) ??
        manifest.scoring.thresholds[manifest.scoring.thresholds.length - 1];
      const dimensions = buildDimensionScores(answers, manifest.questions, manifest.scoring.dimensions);

      return {
        totalScore,
        conclusion: threshold.conclusion,
        details: {
          ...(threshold.details ?? {}),
          ...(threshold.description ? { description: threshold.description } : {}),
          ...(manifest.scoring.totalScoreLabel
            ? { totalScoreLabel: manifest.scoring.totalScoreLabel }
            : {}),
          ...(manifest.scoring.totalScoreHint
            ? { totalScoreHint: manifest.scoring.totalScoreHint }
            : {}),
          ...(dimensions ? { dimensions } : {}),
        },
      };
    },
  };
}

function readManifestScales(): ExecutableScaleDefinition[] {
  if (!fs.existsSync(manifestsDirectory)) {
    return [];
  }

  return fs
    .readdirSync(manifestsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isManifestCandidateFile(entry.name))
    .flatMap((entry) => {
      const filePath = path.join(manifestsDirectory, entry.name);

      try {
        const rawContent = fs.readFileSync(filePath, "utf8");
        const parsedJson = JSON.parse(rawContent);

        if (!parsedJson || typeof parsedJson !== "object" || Array.isArray(parsedJson)) {
          logManifestSkip(filePath, "top-level JSON value must be a manifest object");
          return [];
        }

        const parsedManifest = manifestSchema.parse(parsedJson) as ScaleManifest;
        return [buildManifestScale(parsedManifest)];
      } catch (error) {
        logManifestSkip(filePath, "failed to parse manifest", error);
        return [];
      }
    });
}

function mergeScaleDefinitions(scales: ExecutableScaleDefinition[]): ExecutableScaleDefinition[] {
  const dedupedScales = new Map<string, ExecutableScaleDefinition>();

  scales.forEach((scale) => {
    dedupedScales.set(scale.id.toUpperCase(), withCatalogMetadata(scale));
  });

  return [...dedupedScales.values()];
}

export function getAllScaleDefinitions(): ExecutableScaleDefinition[] {
  return mergeScaleDefinitions([...builtinScales, ...readManifestScales()]);
}

export function listSerializableScales(): ScaleDefinition[] {
  return getAllScaleDefinitions().map(toSerializableScale);
}

function isScaleAvailable(scale: ScaleDefinition) {
  return scale.status !== "disabled";
}

function matchesCatalogSelector(
  scale: ScaleDefinition,
  selector: ScaleCatalogSelector,
  options?: ScaleCatalogLookupOptions
) {
  switch (selector) {
    case "publicClinicalChild":
      return (
        isScaleAvailable(scale) &&
        scale.productGroup === "clinical_child" &&
        scale.isPediatric === true &&
        scale.defaultVisible !== false
      );
    case "exploration":
      return isScaleAvailable(scale) && scale.productGroup === "exploration";
    case "doctorVisible":
      return (
        (isScaleAvailable(scale) &&
          scale.productGroup === "clinical_child" &&
          scale.isPediatric === true) ||
        (Boolean(options?.doctorExplorationEnabled) &&
          isScaleAvailable(scale) &&
          scale.productGroup === "exploration")
      );
    case "voiceFriendlyChild":
      return (
        isScaleAvailable(scale) &&
        scale.productGroup === "clinical_child" &&
        scale.isPediatric === true &&
        scale.voiceFriendly === true
      );
    case "adminAll":
    default:
      return true;
  }
}

export function listSerializableScalesBySelector(
  selector: ScaleCatalogSelector,
  options?: ScaleCatalogLookupOptions
): ScaleDefinition[] {
  return listSerializableScales().filter((scale) => matchesCatalogSelector(scale, selector, options));
}

export function getScaleDefinitionById(scaleId: string): ExecutableScaleDefinition | undefined {
  return getAllScaleDefinitions().find((scale) => scale.id.toUpperCase() === scaleId.toUpperCase());
}

export function getSerializableScaleById(scaleId: string): ScaleDefinition | undefined {
  const scale = getScaleDefinitionById(scaleId);
  return scale ? toSerializableScale(scale) : undefined;
}

export function getSerializableScaleByIdForSelector(
  scaleId: string,
  selector: ScaleCatalogSelector,
  options?: ScaleCatalogLookupOptions
): ScaleDefinition | undefined {
  const scale = getSerializableScaleById(scaleId);
  if (!scale || !matchesCatalogSelector(scale, selector, options)) {
    return undefined;
  }

  return scale;
}

export function listPublicClinicalChildScales() {
  return listSerializableScalesBySelector("publicClinicalChild");
}

export function listExplorationScales() {
  return listSerializableScalesBySelector("exploration");
}

export function listDoctorVisibleScales(options?: { doctorExplorationEnabled?: boolean }) {
  return listSerializableScalesBySelector("doctorVisible", options);
}

export function listAdminScales() {
  return listSerializableScalesBySelector("adminAll");
}

export function listVoiceFriendlyChildScales() {
  return listSerializableScalesBySelector("voiceFriendlyChild");
}

export function getPublicClinicalChildScaleById(scaleId: string) {
  return getSerializableScaleByIdForSelector(scaleId, "publicClinicalChild");
}

export function getExplorationScaleById(scaleId: string) {
  return getSerializableScaleByIdForSelector(scaleId, "exploration");
}

export function getDoctorVisibleScaleById(
  scaleId: string,
  options?: { doctorExplorationEnabled?: boolean }
) {
  return getSerializableScaleByIdForSelector(scaleId, "doctorVisible", options);
}

export function getAdminScaleById(scaleId: string) {
  return getSerializableScaleByIdForSelector(scaleId, "adminAll");
}

export function getVoiceFriendlyChildScaleById(scaleId: string) {
  return getSerializableScaleByIdForSelector(scaleId, "voiceFriendlyChild");
}

export function normalizeScaleCatalogCategoryParam(category?: string | null): ScaleCatalogCategoryParam {
  return category === "exploration" ? "exploration" : "all_child";
}

export function resolveScaleResultDeliveryMode(
  scale: Pick<ScaleDefinition, "resultDeliveryMode">
): ScaleResultDeliveryMode {
  return scale.resultDeliveryMode || "immediate";
}

export function isRespondentResultVisible(
  scale: Pick<ScaleDefinition, "resultDeliveryMode">
) {
  return resolveScaleResultDeliveryMode(scale) === "immediate";
}

export function evaluateScaleAnswers(scaleId: string, answers: number[]): ScaleScoreResult {
  const scale = getScaleDefinitionById(scaleId);

  if (!scale) {
    throw new Error(`Scale ${scaleId} not found`);
  }

  return scale.calculateScore(answers);
}
