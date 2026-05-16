import crypto from 'node:crypto';

import { prisma } from '@/lib/db/prisma';
import { evaluateScaleAnswers } from '@/lib/scales/catalog';

import {
  type RawAssessmentScores,
  createPublicProfileId,
  generateBehavioralConstraints,
  generateDatingTraits,
  generateLockedHash,
  generateTraitVector,
  getSourceSummary,
} from './personaMapper';

type AssessmentRecord = {
  scaleId: string;
  scaleVersion: string;
  totalScore: number;
  conclusion: string;
  answers: unknown;
  createdAt: Date;
};

const SUPPORTED_PERSONA_SCALES = new Set(['SRS', 'MBTI', 'PHQ-9', 'GAD-7', 'ABC', 'CARS', 'SNAP-IV', 'HOLLAND']);

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function normalizeAnswers(answers: unknown) {
  if (!Array.isArray(answers)) {
    return [];
  }

  return answers
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

function normalizeScaleId(scaleId: string) {
  return scaleId.toUpperCase();
}

function average(values: number[]) {
  if (!values.length) {
    return 0.5;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeLikert4Score(score: number) {
  return clamp01((score - 1) / 3);
}

function scoreByQuestionIds(answers: number[], questionIds: number[]) {
  const values = questionIds
    .map((questionId) => answers[questionId - 1])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  return average(values.map(normalizeLikert4Score));
}

function buildSrsInsights(assessment: AssessmentRecord) {
  const answers = normalizeAnswers(assessment.answers);
  if (!answers.length) {
    return null;
  }

  return {
    totalScore: assessment.totalScore,
    normalizedTotal: clamp01(assessment.totalScore / 260),
    subscales: {
      socialEnergyLoss: scoreByQuestionIds(answers, [1, 6, 18, 23, 27, 64]),
      empathyDifficulty: scoreByQuestionIds(answers, [7, 15, 17, 26, 38, 45, 55]),
      stressSensitivity: scoreByQuestionIds(answers, [4, 9, 24, 30, 42, 64]),
      flexibilityDifficulty: scoreByQuestionIds(answers, [20, 24, 28, 31, 39, 50, 61, 62]),
      boundaryDifficulty: scoreByQuestionIds(answers, [16, 25, 52, 54, 55, 56]),
    },
  };
}

function buildMbtiInsights(assessment: AssessmentRecord) {
  const answers = normalizeAnswers(assessment.answers);
  if (!answers.length) {
    return {
      personalityType: assessment.conclusion,
      dimensions: {},
    };
  }

  const result = evaluateScaleAnswers('MBTI', answers);
  const details =
    result.details && typeof result.details === 'object'
      ? (result.details as { dimensions?: Record<string, unknown> })
      : {};

  return {
    personalityType: assessment.conclusion || result.conclusion,
    dimensions:
      details.dimensions && typeof details.dimensions === 'object'
        ? (details.dimensions as Record<string, { E?: number; I?: number; S?: number; N?: number; T?: number; F?: number; J?: number; P?: number; winner?: string }>)
        : {},
  };
}

function buildMoodInsight(assessment: AssessmentRecord, maxScore: number) {
  return {
    totalScore: assessment.totalScore,
    normalizedTotal: clamp01(assessment.totalScore / maxScore),
  };
}

function buildHollandInsights(assessment: AssessmentRecord) {
  const answers = normalizeAnswers(assessment.answers);
  if (!answers.length) {
    return {
      topCode: assessment.conclusion,
      dimensions: {},
    };
  }

  const result = evaluateScaleAnswers('HOLLAND', answers);
  const details =
    result.details && typeof result.details === 'object'
      ? (result.details as { dimensions?: Record<string, { score?: number; label?: string }> })
      : {};

  return {
    topCode: assessment.conclusion || result.conclusion,
    dimensions: details.dimensions || {},
  };
}

async function getOwnedProfile(userId: string, profileId: string) {
  const profile = await prisma.memberProfile.findFirst({
    where: {
      id: profileId,
      userId,
    },
    select: {
      id: true,
      relation: true,
      nickname: true,
      traits: true,
      userId: true,
    },
  });

  if (!profile) {
    throw new Error('Profile not found');
  }

  return profile;
}

function mapMemberTraits(traits: unknown) {
  const next = (traits as {
    interests?: string[];
    fears?: string[];
    behaviors?: string[];
    medicalHistory?: string[];
  }) || {};

  return {
    interests: Array.isArray(next.interests) ? next.interests : [],
    fears: Array.isArray(next.fears) ? next.fears : [],
    behaviors: Array.isArray(next.behaviors) ? next.behaviors : [],
    medicalHistory: Array.isArray(next.medicalHistory) ? next.medicalHistory : [],
  };
}

async function getLatestPersonaAssessments(userId: string, profileId: string) {
  const profileCount = await prisma.memberProfile.count({ where: { userId } });
  const where =
    profileCount === 1
      ? {
          userId,
          OR: [{ profileId }, { profileId: null }],
        }
      : {
          userId,
          profileId,
        };

  const assessments = await prisma.assessmentHistory.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      scaleId: true,
      scaleVersion: true,
      totalScore: true,
      conclusion: true,
      answers: true,
      createdAt: true,
    },
  });

  const latestByScale = new Map<string, AssessmentRecord>();

  for (const assessment of assessments) {
    const scaleId = normalizeScaleId(assessment.scaleId);
    if (!SUPPORTED_PERSONA_SCALES.has(scaleId)) {
      continue;
    }

    if (!latestByScale.has(scaleId)) {
      latestByScale.set(scaleId, {
        scaleId,
        scaleVersion: assessment.scaleVersion,
        totalScore: assessment.totalScore,
        conclusion: assessment.conclusion,
        answers: assessment.answers,
        createdAt: assessment.createdAt,
      });
    }
  }

  return latestByScale;
}

function buildRawScores(
  latestAssessments: Map<string, AssessmentRecord>,
  memberTraits: ReturnType<typeof mapMemberTraits>
): RawAssessmentScores {
  const rawScores: RawAssessmentScores = {
    memberTraits,
    sources: Array.from(latestAssessments.keys()),
  };

  const srs = latestAssessments.get('SRS');
  if (srs) {
    const srsInsights = buildSrsInsights(srs);
    if (srsInsights) {
      rawScores.SRS = srsInsights;
    }
  }

  const mbti = latestAssessments.get('MBTI');
  if (mbti) rawScores.MBTI = buildMbtiInsights(mbti);

  const phq9 = latestAssessments.get('PHQ-9');
  if (phq9) rawScores.PHQ9 = buildMoodInsight(phq9, 27);

  const gad7 = latestAssessments.get('GAD-7');
  if (gad7) rawScores.GAD7 = buildMoodInsight(gad7, 21);

  const holland = latestAssessments.get('HOLLAND');
  if (holland) rawScores.HOLLAND = buildHollandInsights(holland);

  return rawScores;
}

export async function exportPersonaSnapshot(input: {
  userId: string;
  profileId: string;
}) {
  const profile = await getOwnedProfile(input.userId, input.profileId);
  const memberTraits = mapMemberTraits(profile.traits);
  const latestAssessments = await getLatestPersonaAssessments(input.userId, input.profileId);

  if (!latestAssessments.size) {
    throw new Error('尚未完成足够的基础量表测试');
  }

  const rawScores = buildRawScores(latestAssessments, memberTraits);
  const traitVector = generateTraitVector(rawScores);
  const behavioralConstraints = generateBehavioralConstraints(rawScores, traitVector);
  const datingTraits = generateDatingTraits(rawScores, traitVector);
  const lockedHash = generateLockedHash(traitVector, behavioralConstraints);
  const sourceSummary = getSourceSummary(rawScores);

  const latestVersion = Array.from(latestAssessments.values())
    .map((item) => item.scaleVersion)
    .filter(Boolean)
    .sort()
    .at(-1);

  return {
    version: '1.0',
    snapshotId: `snap_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`,
    profileId: createPublicProfileId(profile.id),
    source: 'AIliangbiao_Export',
    assessmentVersion: latestVersion ? `assessment:${latestVersion}` : 'v2026.04',
    importedAt: new Date().toISOString(),
    lockedHash,
    traitVector,
    behavioralConstraints,
    datingTraits,
    sourceSummary,
  };
}
