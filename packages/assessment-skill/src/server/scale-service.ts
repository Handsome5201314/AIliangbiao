import { prisma } from '@/lib/db/prisma';
import {
  evaluateScaleAnswers,
  getSerializableScaleById,
  listSerializableScales,
  listSerializableScaleSummaries,
  normalizeScaleFormData,
} from '@/lib/scales/catalog';

export function listSkillScales() {
  return listSerializableScales().map((scale: any) => ({
    ...scale,
    interactionMode: scale.interactionMode || 'manual_only',
    supportedLanguages: scale.supportedLanguages || ['zh'],
    requiresConfirmation: scale.requiresConfirmation ?? false,
    questionCount: scale.questions.length,
  }));
}

export function listSkillScaleSummaries() {
  return listSerializableScaleSummaries().map((scale: any) => ({
    ...scale,
    interactionMode: scale.interactionMode || 'manual_only',
    supportedLanguages: scale.supportedLanguages || ['zh'],
    requiresConfirmation: scale.requiresConfirmation ?? false,
  }));
}

export function getSkillScale(scaleId: string) {
  return getSerializableScaleById(scaleId);
}

export async function evaluateSkillScale(input: {
  userId: string;
  profileId?: string | null;
  scaleId: string;
  answers: number[];
  formData?: Record<string, unknown>;
}) {
  const scale = getSerializableScaleById(input.scaleId);
  if (!scale) {
    throw new Error(`Scale ${input.scaleId} not found`);
  }

  if (input.answers.length !== scale.questions.length) {
    throw new Error(`Expected ${scale.questions.length} answers, received ${input.answers.length}`);
  }

  const normalizedFormData = normalizeScaleFormData(scale.id, input.formData);
  const result = evaluateScaleAnswers(scale.id, input.answers, normalizedFormData);

  const assessment = await prisma.assessmentHistory.create({
    data: {
      userId: input.userId,
      profileId: input.profileId || null,
      scaleId: scale.id,
      scaleVersion: scale.version || '1.0',
      totalScore: result.totalScore,
      conclusion: result.conclusion,
      answers: JSON.parse(JSON.stringify(input.answers)),
      formData: normalizedFormData ? JSON.parse(JSON.stringify(normalizedFormData)) : undefined,
      resultDetails: result.details ? JSON.parse(JSON.stringify(result.details)) : undefined,
    },
  });

  return {
    assessmentId: assessment.id,
    scaleId: scale.id,
    result,
    formData: normalizedFormData,
    createdAt: assessment.createdAt,
  };
}
