import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

import { AllScales as builtinScales } from "@/lib/schemas/core/registry";
import type {
  ExecutableScaleDefinition,
  ScaleDefinition,
  ScaleCategory,
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
]);

const manifestOptionSchema = z.object({
  label: z.string(),
  score: z.number(),
  aliases: z.array(z.string()).optional(),
  description: localizedTextSchema.optional(),
});

const manifestQuestionSchema = z.object({
  id: z.number(),
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
  title: localizedTextSchema,
  description: localizedTextSchema,
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
    scoreQuestionIds: z.array(z.number()).optional(),
    totalScoreLabel: z.string().optional(),
    totalScoreHint: z.string().optional(),
  }),
});

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
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => {
      const filePath = path.join(manifestsDirectory, entry.name);
      const rawContent = fs.readFileSync(filePath, "utf8");
      const parsedManifest = manifestSchema.parse(JSON.parse(rawContent)) as ScaleManifest;
      return buildManifestScale(parsedManifest);
    });
}

function mergeScaleDefinitions(scales: ExecutableScaleDefinition[]): ExecutableScaleDefinition[] {
  const dedupedScales = new Map<string, ExecutableScaleDefinition>();

  scales.forEach((scale) => {
    dedupedScales.set(scale.id.toUpperCase(), scale);
  });

  return [...dedupedScales.values()];
}

export function getAllScaleDefinitions(): ExecutableScaleDefinition[] {
  return mergeScaleDefinitions([...builtinScales, ...readManifestScales()]);
}

export function listSerializableScales(): ScaleDefinition[] {
  return getAllScaleDefinitions().map(toSerializableScale);
}

export function getScaleDefinitionById(scaleId: string): ExecutableScaleDefinition | undefined {
  return getAllScaleDefinitions().find((scale) => scale.id.toUpperCase() === scaleId.toUpperCase());
}

export function getSerializableScaleById(scaleId: string): ScaleDefinition | undefined {
  const scale = getScaleDefinitionById(scaleId);
  return scale ? toSerializableScale(scale) : undefined;
}

export function evaluateScaleAnswers(scaleId: string, answers: number[]): ScaleScoreResult {
  const scale = getScaleDefinitionById(scaleId);

  if (!scale) {
    throw new Error(`Scale ${scaleId} not found`);
  }

  return scale.calculateScore(answers);
}
