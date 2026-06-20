import crypto from 'node:crypto';

import { prisma } from '@/lib/db/prisma';

type AuthenticatedResearchActor = {
  user: {
    id: string;
    accountType: string;
    profiles?: Array<{ id: string }>;
    doctorProfile?: { id: string } | null;
  };
};

function db() {
  return prisma as any;
}

function hashPrompt(prompt?: string | null) {
  if (!prompt) {
    return null;
  }

  return crypto.createHash('sha256').update(prompt).digest('hex');
}

function assertMemberAccess(actor: AuthenticatedResearchActor, memberProfileId?: string | null) {
  if (!memberProfileId || actor.user.accountType === 'DOCTOR') {
    return;
  }

  const owned = actor.user.profiles?.some((profile) => profile.id === memberProfileId);
  if (!owned) {
    throw new Error('Member profile not accessible');
  }
}

async function resolveMemberProfileId(input: {
  memberProfileId?: string | null;
  assessmentSessionId?: string | null;
  assessmentHistoryId?: string | null;
}) {
  if (input.memberProfileId) {
    return input.memberProfileId;
  }

  if (input.assessmentSessionId) {
    const session = await db().assessmentSession.findUnique({
      where: { id: input.assessmentSessionId },
      select: { profileId: true },
    });
    if (session?.profileId) {
      return session.profileId;
    }
  }

  if (input.assessmentHistoryId) {
    const history = await db().assessmentHistory.findUnique({
      where: { id: input.assessmentHistoryId },
      select: { profileId: true },
    });
    if (history?.profileId) {
      return history.profileId;
    }
  }

  return null;
}

export async function recordAiInteraction(input: {
  actor: AuthenticatedResearchActor;
  memberProfileId?: string | null;
  assessmentSessionId?: string | null;
  assessmentHistoryId?: string | null;
  scaleId?: string | null;
  questionId?: string | null;
  interactionType: string;
  prompt?: string | null;
  responseSummary?: string | null;
  metadata?: unknown;
}) {
  const memberProfileId = await resolveMemberProfileId(input);
  assertMemberAccess(input.actor, memberProfileId);

  return db().aiInteraction.create({
    data: {
      userId: input.actor.user.id,
      memberProfileId,
      assessmentSessionId: input.assessmentSessionId || null,
      assessmentHistoryId: input.assessmentHistoryId || null,
      doctorProfileId: input.actor.user.doctorProfile?.id || null,
      scaleId: input.scaleId || null,
      questionId: input.questionId || null,
      interactionType: input.interactionType,
      promptHash: hashPrompt(input.prompt),
      responseSummary: input.responseSummary || null,
      metadata: input.metadata ?? undefined,
    },
  });
}

export async function recordReportView(input: {
  actor: AuthenticatedResearchActor;
  memberProfileId?: string | null;
  assessmentSessionId?: string | null;
  assessmentHistoryId?: string | null;
  viewerRole?: string | null;
  metadata?: unknown;
}) {
  const memberProfileId = await resolveMemberProfileId(input);
  assertMemberAccess(input.actor, memberProfileId);

  return db().reportView.create({
    data: {
      userId: input.actor.user.id,
      memberProfileId,
      assessmentSessionId: input.assessmentSessionId || null,
      assessmentHistoryId: input.assessmentHistoryId || null,
      doctorProfileId: input.actor.user.doctorProfile?.id || null,
      viewerRole: input.viewerRole || input.actor.user.accountType,
      metadata: input.metadata ?? undefined,
    },
  });
}

export async function recordFollowUp(input: {
  actor: AuthenticatedResearchActor;
  memberProfileId?: string | null;
  assessmentSessionId?: string | null;
  assessmentHistoryId?: string | null;
  status: string;
  completedAt?: string | null;
  metadata?: unknown;
}) {
  const memberProfileId = await resolveMemberProfileId(input);
  if (!memberProfileId) {
    throw new Error('memberProfileId or assessment reference is required');
  }

  assertMemberAccess(input.actor, memberProfileId);

  return db().followUp.create({
    data: {
      memberProfileId,
      assessmentSessionId: input.assessmentSessionId || null,
      assessmentHistoryId: input.assessmentHistoryId || null,
      doctorProfileId: input.actor.user.doctorProfile?.id || null,
      status: input.status,
      completedAt: input.completedAt ? new Date(input.completedAt) : null,
      metadata: input.metadata ?? undefined,
    },
  });
}
