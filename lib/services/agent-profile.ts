import { prisma } from '@/lib/db/prisma';
import { exportPersonaSnapshot } from '@/lib/partner/personaSnapshot';
import {
  getMemberAssessmentSummary,
  getMemberContext,
  getMemberMemorySummary,
} from '@/lib/assessment-skill/member-service';

type AssessmentSummaryItem = {
  id: string;
  scaleId: string;
  scaleVersion: string;
  totalScore: number;
  conclusion: string;
  createdAt: Date;
};

function determineStatusEffects(items: AssessmentSummaryItem[]) {
  const effects: Array<{
    id: string;
    level: number;
    source: string;
    reason: string;
  }> = [];

  const latestPhq = items.find((item) => item.scaleId.toUpperCase() === 'PHQ-9');
  if (latestPhq && latestPhq.totalScore >= 10) {
    effects.push({
      id: latestPhq.totalScore >= 15 ? 'moderate_depression' : 'mild_depression',
      level: latestPhq.totalScore >= 15 ? 2 : 1,
      source: latestPhq.scaleId,
      reason: latestPhq.conclusion,
    });
  }

  const latestGad = items.find((item) => item.scaleId.toUpperCase() === 'GAD-7');
  if (latestGad && latestGad.totalScore >= 10) {
    effects.push({
      id: latestGad.totalScore >= 15 ? 'high_anxiety' : 'mild_anxiety',
      level: latestGad.totalScore >= 15 ? 2 : 1,
      source: latestGad.scaleId,
      reason: latestGad.conclusion,
    });
  }

  return effects;
}

function determineUnlockedTraits(items: AssessmentSummaryItem[]) {
  const traits: Array<{
    id: string;
    source: string;
    label: string;
  }> = [];

  const latestMbti = items.find((item) => item.scaleId.toUpperCase() === 'MBTI');
  if (latestMbti) {
    traits.push({
      id: `mbti_${latestMbti.conclusion.replace(/\s+/g, '_')}`,
      source: latestMbti.scaleId,
      label: latestMbti.conclusion,
    });
  }

  const latestHolland = items.find((item) => item.scaleId.toUpperCase() === 'HOLLAND');
  if (latestHolland) {
    traits.push({
      id: `holland_${latestHolland.conclusion.replace(/\s+/g, '_')}`,
      source: latestHolland.scaleId,
      label: latestHolland.conclusion,
    });
  }

  return traits;
}

function mapBaseAttributes(snapshot: any) {
  const reliability = Number(snapshot?.sourceSummary?.reliabilityScore || 0.4);
  const vector = snapshot?.traitVector || {};

  return {
    social_energy: {
      value: Number(vector.social_energy ?? 0.5),
      confidence: reliability,
    },
    empathy_resonance: {
      value: Number(vector.empathy_resonance ?? 0.5),
      confidence: reliability,
    },
    rational_logic: {
      value: Number(vector.rational_logic ?? 0.5),
      confidence: reliability,
    },
    stress_resilience: {
      value: Number(vector.stress_resilience ?? 0.5),
      confidence: reliability,
    },
    behavioral_flexibility: {
      value: Number(vector.behavioral_flexibility ?? 0.5),
      confidence: reliability,
    },
  };
}

async function buildAgentProfileSummary(input: { userId: string; memberId: string }) {
  const [context, assessmentSummary, memorySummary] = await Promise.all([
    getMemberContext(input.userId, input.memberId),
    getMemberAssessmentSummary(input.userId, input.memberId),
    getMemberMemorySummary(input.userId, input.memberId),
  ]);

  let snapshotV1: any = null;
  try {
    snapshotV1 = await exportPersonaSnapshot({
      userId: input.userId,
      profileId: input.memberId,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Profile not found') {
      throw error;
    }
  }

  const items = (assessmentSummary.items || []) as AssessmentSummaryItem[];
  const latestAssessment = items[0];
  const lastAssessmentAt = latestAssessment?.createdAt || null;

  return {
    summary: {
      member: context.member,
      baseAttributes: mapBaseAttributes(snapshotV1),
      statusEffects: determineStatusEffects(items),
      unlockedTraits: determineUnlockedTraits(items),
      assessmentHistory: items.map((item) => ({
        id: item.id,
        scaleId: item.scaleId,
        version: item.scaleVersion,
        score: item.totalScore,
        conclusion: item.conclusion,
        createdAt: item.createdAt.toISOString(),
      })),
      memorySummary,
      snapshotV1,
      meta: {
        source: 'agent_profile_state',
        dataDepth: snapshotV1?.sourceSummary?.dataDepth || 'Low',
        reliabilityScore: snapshotV1?.sourceSummary?.reliabilityScore || 0.4,
        lastAssessmentAt: lastAssessmentAt?.toISOString() || null,
        lastUpdated: new Date().toISOString(),
      },
    },
    snapshotV1,
    lastAssessmentAt,
  };
}

export async function rebuildAgentProfileState(input: {
  userId: string;
  memberId: string;
  trigger: string;
}) {
  const built = await buildAgentProfileSummary(input);
  const model = (prisma as any).agentProfileState;
  const versionModel = (prisma as any).agentProfileVersion;

  const existing = await model.findUnique({
    where: { memberProfileId: input.memberId },
  });

  const nextVersion = existing ? Number(existing.version || 0) + 1 : 1;

  const state = existing
    ? await model.update({
        where: { memberProfileId: input.memberId },
        data: {
          version: nextVersion,
          summary: built.summary,
          snapshotV1: built.snapshotV1 || undefined,
          lastAssessmentAt: built.lastAssessmentAt,
        },
      })
    : await model.create({
        data: {
          memberProfileId: input.memberId,
          version: nextVersion,
          summary: built.summary,
          snapshotV1: built.snapshotV1 || undefined,
          lastAssessmentAt: built.lastAssessmentAt,
        },
      });

  await versionModel.create({
    data: {
      agentProfileStateId: state.id,
      version: nextVersion,
      trigger: input.trigger,
      summary: built.summary,
      snapshotV1: built.snapshotV1 || undefined,
    },
  });

  return {
    id: state.id,
    memberProfileId: state.memberProfileId,
    version: state.version,
    summary: built.summary,
    snapshotV1: built.snapshotV1,
    lastAssessmentAt: state.lastAssessmentAt,
    updatedAt: state.updatedAt,
  };
}

export async function getOrBuildAgentProfileState(input: {
  userId: string;
  memberId: string;
}) {
  const model = (prisma as any).agentProfileState;
  const existing = await model.findUnique({
    where: { memberProfileId: input.memberId },
  });

  if (!existing) {
    return rebuildAgentProfileState({
      userId: input.userId,
      memberId: input.memberId,
      trigger: 'bootstrap',
    });
  }

  return {
    id: existing.id,
    memberProfileId: existing.memberProfileId,
    version: existing.version,
    summary: existing.summary,
    snapshotV1: existing.snapshotV1,
    lastAssessmentAt: existing.lastAssessmentAt,
    updatedAt: existing.updatedAt,
  };
}

export async function listAgentProfileVersions(input: {
  userId: string;
  memberId: string;
}) {
  const state = await getOrBuildAgentProfileState(input);
  const versions = await (prisma as any).agentProfileVersion.findMany({
    where: { agentProfileStateId: state.id },
    orderBy: { version: 'desc' },
    take: 20,
  });

  return versions.map((item: any) => ({
    id: item.id,
    version: item.version,
    trigger: item.trigger,
    createdAt: item.createdAt,
  }));
}
