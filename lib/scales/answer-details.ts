import { resolveLocalizedText } from "../schemas/core/i18n";
import type {
  NormalizedScaleAnswerDetailMap,
  ScaleAnswerDetailInput,
  ScaleAnswerDetailMap,
  ScaleDefinition,
  ScaleQuestion,
  ScaleSymptomOption,
} from "../schemas/core/types";

type NormalizedAiAnswerDetail = {
  source?: ScaleAnswerDetailInput["source"];
};

function normalizeQuestionId(questionId: string) {
  const parsed = Number(questionId);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeConfidence(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.min(Math.max(value, 0), 1);
}

export function normalizeScaleAnswerDetails(
  scale: Pick<ScaleDefinition, "questions">,
  answerDetails?: ScaleAnswerDetailMap
): NormalizedScaleAnswerDetailMap | undefined {
  if (!answerDetails) {
    return undefined;
  }

  const normalized = Object.entries(answerDetails).reduce<NormalizedScaleAnswerDetailMap>(
    (result, [questionId, detail]) => {
      const numericQuestionId = normalizeQuestionId(questionId);
      if (numericQuestionId === null) {
        return result;
      }

      const question = scale.questions.find((item) => item.id === numericQuestionId) as
        | (ScaleQuestion & { symptomOptions?: ScaleSymptomOption[] })
        | undefined;

      if (!question) {
        return result;
      }

      const nextEntry: NormalizedScaleAnswerDetailMap[string] = {};

      if (detail.estimated) {
        nextEntry.estimated = true;
      }

      const confidence = normalizeConfidence(detail.confidence);
      if (confidence !== null) {
        nextEntry.confidence = confidence;
      }

      const evidence = detail.evidence?.trim();
      if (evidence) {
        nextEntry.evidence = evidence.slice(0, 500);
      }

      if (detail.source) {
        nextEntry.source = detail.source as NormalizedAiAnswerDetail["source"];
      }

      if (detail.confirmedLowConfidence === true) {
        nextEntry.confirmedLowConfidence = true;
      }

      if (question.symptomOptions?.length && detail.selectedSymptomIds?.length) {
        const selectedSymptoms = question.symptomOptions
          .filter((item) => detail.selectedSymptomIds?.includes(item.id))
          .map((item) => ({
            id: item.id,
            label: resolveLocalizedText(item.label, "zh"),
          }));

        if (selectedSymptoms.length) {
          nextEntry.selectedSymptoms = selectedSymptoms;
          const primarySymptom =
            selectedSymptoms.find((item) => item.id === detail.primarySymptomId) || selectedSymptoms[0];
          nextEntry.primarySymptomId = primarySymptom?.id;
          nextEntry.primarySymptomLabel = primarySymptom?.label;
        }
      }

      if (!Object.keys(nextEntry).length) {
        return result;
      }

      result[String(numericQuestionId)] = nextEntry;
      return result;
    },
    {}
  );

  return Object.keys(normalized).length ? normalized : undefined;
}

export function summarizeEstimatedAnswerDetails(answerDetails?: NormalizedScaleAnswerDetailMap) {
  if (!answerDetails) {
    return undefined;
  }

  const estimatedQuestionIds = Object.entries(answerDetails)
    .filter(([, detail]) => detail.estimated)
    .map(([questionId]) => Number(questionId))
    .filter((questionId) => Number.isFinite(questionId))
    .sort((left, right) => left - right);

  if (!estimatedQuestionIds.length) {
    return undefined;
  }

  return {
    estimatedCount: estimatedQuestionIds.length,
    estimatedQuestionIds,
  };
}
