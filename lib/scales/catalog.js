"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllScaleDefinitions = getAllScaleDefinitions;
exports.listSerializableScales = listSerializableScales;
exports.getScaleDefinitionById = getScaleDefinitionById;
exports.getSerializableScaleById = getSerializableScaleById;
exports.evaluateScaleAnswers = evaluateScaleAnswers;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const zod_1 = require("zod");
const registry_1 = require("@/lib/schemas/core/registry");
const localizedTextSchema = zod_1.z.union([
    zod_1.z.string(),
    zod_1.z.object({
        zh: zod_1.z.string(),
        en: zod_1.z.string().optional(),
    }),
]);
const categorySchema = zod_1.z.enum([
    "Child Development",
    "Mental Health",
    "Personality",
    "Career Assessment",
    "Cognitive Health",
    "General Health",
]);
const languageCodeSchema = zod_1.z.enum(["zh", "en"]);
const interactionModeSchema = zod_1.z.enum([
    "manual_only",
    "voice_guided",
    "full_voice",
    "call_mode",
]);
const manifestOptionSchema = zod_1.z.object({
    label: zod_1.z.string(),
    score: zod_1.z.number(),
    aliases: zod_1.z.array(zod_1.z.string()).optional(),
});
const manifestQuestionSchema = zod_1.z.object({
    id: zod_1.z.number(),
    text: localizedTextSchema,
    clinical_intent: zod_1.z.string(),
    colloquial: localizedTextSchema,
    fallback_examples: zod_1.z.array(localizedTextSchema),
    options: zod_1.z.array(manifestOptionSchema).min(1),
    voicePrompt: localizedTextSchema.optional(),
    simpleExplain: localizedTextSchema.optional(),
    confirmationPrompt: localizedTextSchema.optional(),
    autoAnswerable: zod_1.z.boolean().optional(),
    answerMappingHints: zod_1.z
        .object({
        keywords: zod_1.z.array(zod_1.z.string()).optional(),
        phrases: zod_1.z
            .array(zod_1.z.object({
            score: zod_1.z.number(),
            keywords: zod_1.z.array(zod_1.z.string()).min(1),
        }))
            .optional(),
        negativeKeywords: zod_1.z.array(zod_1.z.string()).optional(),
        irrelevantKeywords: zod_1.z.array(zod_1.z.string()).optional(),
    })
        .optional(),
    riskLevel: zod_1.z.enum(["normal", "sensitive", "high"]).optional(),
    analysisHints: zod_1.z
        .object({
        keywords: zod_1.z.array(zod_1.z.string()).optional(),
        optionKeywords: zod_1.z
            .array(zod_1.z.object({
            score: zod_1.z.number(),
            keywords: zod_1.z.array(zod_1.z.string()).min(1),
        }))
            .optional(),
    })
        .optional(),
});
const manifestThresholdSchema = zod_1.z.object({
    min: zod_1.z.number().optional(),
    max: zod_1.z.number().optional(),
    conclusion: zod_1.z.string(),
    description: zod_1.z.string().optional(),
    details: zod_1.z.record(zod_1.z.string(), zod_1.z.unknown()).optional(),
});
const manifestDimensionSchema = zod_1.z.object({
    id: zod_1.z.string(),
    label: zod_1.z.string(),
    questionIds: zod_1.z.array(zod_1.z.number()).min(1),
});
const manifestSchema = zod_1.z.object({
    id: zod_1.z.string(),
    version: zod_1.z.string().optional(),
    title: localizedTextSchema,
    description: localizedTextSchema,
    source: zod_1.z.literal("manifest"),
    category: categorySchema.optional(),
    tags: zod_1.z.array(zod_1.z.string()).optional(),
    estimatedMinutes: zod_1.z.number().optional(),
    interactionMode: interactionModeSchema.optional(),
    supportedLanguages: zod_1.z.array(languageCodeSchema).optional(),
    requiresConfirmation: zod_1.z.boolean().optional(),
    questions: zod_1.z.array(manifestQuestionSchema).min(1),
    scoring: zod_1.z.object({
        method: zod_1.z.literal("sum"),
        thresholds: zod_1.z.array(manifestThresholdSchema).min(1),
        dimensions: zod_1.z.array(manifestDimensionSchema).optional(),
        scoreQuestionIds: zod_1.z.array(zod_1.z.number()).optional(),
        totalScoreLabel: zod_1.z.string().optional(),
        totalScoreHint: zod_1.z.string().optional(),
    }),
});
const manifestsDirectory = node_path_1.default.join(process.cwd(), "data", "scales");
function estimateScaleMinutes(scale) {
    if (scale.estimatedMinutes && scale.estimatedMinutes > 0) {
        return scale.estimatedMinutes;
    }
    const questionCount = scale.questions.length;
    if (questionCount <= 20)
        return 5;
    if (questionCount <= 40)
        return 8;
    if (questionCount <= 60)
        return 12;
    return 15;
}
function toSerializableScale(scale) {
    const { calculateScore: _ignored, ...serializableScale } = scale;
    return {
        ...serializableScale,
        estimatedMinutes: estimateScaleMinutes(serializableScale),
    };
}
function matchesThreshold(totalScore, threshold) {
    const aboveMinimum = threshold.min === undefined || totalScore >= threshold.min;
    const belowMaximum = threshold.max === undefined || totalScore <= threshold.max;
    return aboveMinimum && belowMaximum;
}
function buildDimensionScores(answers, questions, dimensions) {
    if (!dimensions?.length) {
        return undefined;
    }
    const scoreMap = new Map();
    questions.forEach((question, index) => {
        scoreMap.set(question.id, answers[index] ?? 0);
    });
    return dimensions.reduce((result, dimension) => {
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
function buildQuestionScoreMap(answers, questions) {
    const scoreMap = new Map();
    questions.forEach((question, index) => {
        scoreMap.set(question.id, answers[index] ?? 0);
    });
    return scoreMap;
}
function buildManifestTotalScore(answers, questions, scoreQuestionIds) {
    if (!scoreQuestionIds?.length) {
        return answers.reduce((sum, score) => sum + score, 0);
    }
    const scoreMap = buildQuestionScoreMap(answers, questions);
    return scoreQuestionIds.reduce((sum, questionId) => {
        return sum + (scoreMap.get(questionId) ?? 0);
    }, 0);
}
function buildManifestScale(manifest) {
    return {
        ...manifest,
        estimatedMinutes: estimateScaleMinutes(manifest),
        calculateScore(answers) {
            const totalScore = buildManifestTotalScore(answers, manifest.questions, manifest.scoring.scoreQuestionIds);
            const threshold = manifest.scoring.thresholds.find((candidate) => matchesThreshold(totalScore, candidate)) ??
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
function readManifestScales() {
    if (!node_fs_1.default.existsSync(manifestsDirectory)) {
        return [];
    }
    return node_fs_1.default
        .readdirSync(manifestsDirectory, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => {
        const filePath = node_path_1.default.join(manifestsDirectory, entry.name);
        const rawContent = node_fs_1.default.readFileSync(filePath, "utf8");
        const parsedManifest = manifestSchema.parse(JSON.parse(rawContent));
        return buildManifestScale(parsedManifest);
    });
}
function mergeScaleDefinitions(scales) {
    const dedupedScales = new Map();
    scales.forEach((scale) => {
        dedupedScales.set(scale.id.toUpperCase(), scale);
    });
    return [...dedupedScales.values()];
}
function getAllScaleDefinitions() {
    return mergeScaleDefinitions([...registry_1.AllScales, ...readManifestScales()]);
}
function listSerializableScales() {
    return getAllScaleDefinitions().map(toSerializableScale);
}
function getScaleDefinitionById(scaleId) {
    return getAllScaleDefinitions().find((scale) => scale.id.toUpperCase() === scaleId.toUpperCase());
}
function getSerializableScaleById(scaleId) {
    const scale = getScaleDefinitionById(scaleId);
    return scale ? toSerializableScale(scale) : undefined;
}
function evaluateScaleAnswers(scaleId, answers) {
    const scale = getScaleDefinitionById(scaleId);
    if (!scale) {
        throw new Error(`Scale ${scaleId} not found`);
    }
    return scale.calculateScore(answers);
}
