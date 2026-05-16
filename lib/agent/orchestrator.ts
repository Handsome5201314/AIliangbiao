import { prisma } from '@/lib/db/prisma';
import { createAssessmentSession, getSkillScale, listSkillScales } from '@/lib/assessment-skill/scale-service';
import {
  extractSymptomsFromTranscript,
  recommendScaleFromSymptoms,
} from '@/lib/services/triageFlow';
import { getMemberAssessmentSummary, getMemberContext } from '@/lib/assessment-skill/member-service';
import {
  getOrBuildAgentProfileState,
  rebuildAgentProfileState,
} from '@/lib/services/agent-profile';
import { createDoctorScaleInvite, getDoctorScaleInvites } from '@/lib/services/doctor-invites';
import { exportPersonaSnapshot } from '@/lib/partner/personaSnapshot';
import type { AgentSessionPayload } from '@/lib/assessment-skill/auth';
import { getAgentWorkspaceConfig } from '@/lib/agent/config';

export type AgentToolRiskLevel = 'low' | 'medium' | 'high';

export type AgentToolId =
  | 'context.read_member'
  | 'context.read_assessments'
  | 'profile.read'
  | 'profile.rebuild'
  | 'profile.export_v1'
  | 'assessment.recommend'
  | 'assessment.session.start'
  | 'assessment.session.answer'
  | 'assessment.session.result'
  | 'assessment.session.cancel'
  | 'doctor.invites.create'
  | 'doctor.invites.list';

export interface PlannedAgentStep {
  toolId: AgentToolId;
  summary: string;
  riskLevel: AgentToolRiskLevel;
  confirmBeforeExecute: boolean;
  input?: Record<string, unknown>;
}

export interface AgentPlanResponse {
  mode: 'plan' | 'follow_up';
  assistantMessage: string;
  requiresConfirmation: boolean;
  steps: PlannedAgentStep[];
  executionId?: string;
  preview?: {
    detectedIntent: string;
    highlightedScaleId?: string;
  };
}

type ExecutionStepRecord = {
  id: string;
  stepOrder: number;
  toolId: AgentToolId;
  summary: string | null;
  riskLevel: string;
  status: string;
  output: unknown;
  errorMessage: string | null;
};

function findExplicitScale(goal: string) {
  const normalizedGoal = goal.trim().toLowerCase();
  const scales = listSkillScales();

  for (const scale of scales) {
    const title =
      typeof scale.title === 'string'
        ? scale.title
        : `${scale.title.zh || ''} ${scale.title.en || ''}`.trim();

    if (
      normalizedGoal.includes(scale.id.toLowerCase()) ||
      (title && normalizedGoal.includes(title.toLowerCase()))
    ) {
      return scale.id;
    }
  }

  return undefined;
}

function includesAnyKeyword(normalizedGoal: string, keywords: readonly string[]) {
  return keywords.some((keyword) => normalizedGoal.includes(String(keyword).toLowerCase()));
}

function renderSummaryTemplate(template: string, vars: Record<string, string | undefined>) {
  return Object.entries(vars).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, value || ''),
    template
  );
}

function buildStepFromConfig(
  toolConfig: Record<string, any>,
  toolId: AgentToolId,
  vars: Record<string, string | undefined> = {},
  input?: Record<string, unknown>
) {
  const config = toolConfig[toolId] || {};

  return {
    toolId,
    summary: renderSummaryTemplate(config.summaryTemplate || toolId, vars),
    riskLevel: (config.riskLevel || 'low') as AgentToolRiskLevel,
    confirmBeforeExecute: Boolean(config.confirmBeforeExecute),
    ...(input ? { input } : {}),
  } satisfies PlannedAgentStep;
}

function detectIntentFromConfig(
  goal: string,
  session: AgentSessionPayload,
  config: Awaited<ReturnType<typeof getAgentWorkspaceConfig>>
) {
  const normalizedGoal = goal.trim().toLowerCase();
  const explicitScaleId = findExplicitScale(goal);
  const keywords = config.toolRules.intentKeywords;

  if (includesAnyKeyword(normalizedGoal, keywords.exportProfile)) {
    return { detectedIntent: 'export_profile' as const, scaleId: explicitScaleId };
  }

  if (includesAnyKeyword(normalizedGoal, keywords.inspectProfile)) {
    return { detectedIntent: 'inspect_profile' as const, scaleId: explicitScaleId };
  }

  if (session.account_type === 'DOCTOR' && includesAnyKeyword(normalizedGoal, keywords.doctorInvite)) {
    return { detectedIntent: 'doctor_invite' as const, scaleId: explicitScaleId };
  }

  const symptoms = extractSymptomsFromTranscript(goal);
  const keywordRecommendedScale =
    includesAnyKeyword(normalizedGoal, keywords.anxiety)
      ? 'GAD-7'
      : includesAnyKeyword(normalizedGoal, keywords.depression)
        ? 'PHQ-9'
        : includesAnyKeyword(normalizedGoal, keywords.adhd)
          ? 'SNAP-IV'
          : includesAnyKeyword(normalizedGoal, keywords.autism)
            ? 'SRS'
            : includesAnyKeyword(normalizedGoal, keywords.mbti)
              ? 'MBTI'
              : undefined;

  const recommendedScale =
    explicitScaleId ||
    keywordRecommendedScale ||
    recommendScaleFromSymptoms(symptoms, goal);

  if (recommendedScale) {
    return {
      detectedIntent: 'assessment' as const,
      scaleId: recommendedScale,
    };
  }

  return {
    detectedIntent: 'unknown' as const,
    scaleId: explicitScaleId,
  };
}

function buildAssistantMessageForPlan(input: {
  accountType?: 'PATIENT' | 'DOCTOR';
  detectedIntent: string;
  scaleId?: string;
  config: Awaited<ReturnType<typeof getAgentWorkspaceConfig>>;
}) {
  const prompts = input.config.prompts;

  if (input.detectedIntent === 'doctor_invite') {
    return input.scaleId
      ? prompts.doctorInvitePlan.replace('{scaleId}', input.scaleId)
      : prompts.followUpDoctorInviteNeedsScale;
  }

  if (input.detectedIntent === 'export_profile') {
    return prompts.exportProfilePlan;
  }

  if (input.detectedIntent === 'inspect_profile') {
    return prompts.inspectProfilePlan;
  }

  if (input.scaleId) {
    return prompts.assessmentPlan.replace('{scaleId}', input.scaleId);
  }

  return input.accountType === 'DOCTOR'
    ? prompts.doctorUnknownGoal
    : prompts.patientUnknownGoal;
}

function buildFollowUpResponse(message: string): AgentPlanResponse {
  return {
    mode: 'follow_up',
    assistantMessage: message,
    requiresConfirmation: false,
    steps: [],
  };
}

function buildSteps(input: {
  detectedIntent: 'assessment' | 'inspect_profile' | 'export_profile' | 'doctor_invite';
  scaleId?: string;
  config: Awaited<ReturnType<typeof getAgentWorkspaceConfig>>;
}) {
  const toolConfig = input.config.toolRules.tools as Record<string, any>;

  switch (input.detectedIntent) {
    case 'assessment':
      return [
        buildStepFromConfig(toolConfig, 'context.read_member'),
        buildStepFromConfig(toolConfig, 'context.read_assessments'),
        buildStepFromConfig(toolConfig, 'assessment.recommend', { scaleId: input.scaleId }, { scaleId: input.scaleId }),
        buildStepFromConfig(toolConfig, 'assessment.session.start', { scaleId: input.scaleId }, { scaleId: input.scaleId }),
      ];
    case 'inspect_profile':
      return [
        buildStepFromConfig(toolConfig, 'profile.read'),
        buildStepFromConfig(toolConfig, 'context.read_assessments'),
      ];
    case 'export_profile':
      return [
        buildStepFromConfig(toolConfig, 'profile.read'),
        buildStepFromConfig(toolConfig, 'profile.export_v1'),
      ];
    case 'doctor_invite':
      return [
        buildStepFromConfig(toolConfig, 'doctor.invites.create', { scaleId: input.scaleId }, { scaleId: input.scaleId }),
        buildStepFromConfig(toolConfig, 'doctor.invites.list'),
      ];
  }
}

export async function createAgentPlan(input: {
  session: AgentSessionPayload;
  goal: string;
}) {
  const config = await getAgentWorkspaceConfig();
  const intent = detectIntentFromConfig(input.goal, input.session, config);

  if (intent.detectedIntent === 'unknown') {
    return buildFollowUpResponse(config.prompts.followUpUnknown);
  }

  if (intent.detectedIntent === 'doctor_invite' && !intent.scaleId) {
    return buildFollowUpResponse(config.prompts.followUpDoctorInviteNeedsScale);
  }

  const steps = buildSteps({
    ...(intent as any),
    config,
  });

  const execution = await prisma.agentExecution.create({
    data: {
      userId: input.session.sub,
      memberProfileId: input.session.member_id,
      agentSessionId: input.session.session_id,
      accountType: input.session.account_type || 'PATIENT',
      goal: input.goal,
      status: 'AWAITING_CONFIRMATION',
      plan: {
        detectedIntent: intent.detectedIntent,
        highlightedScaleId: intent.scaleId || null,
        steps,
      } as any,
      steps: {
        create: steps.map((step, index) => ({
          stepOrder: index,
          toolId: step.toolId,
          summary: step.summary,
          riskLevel: step.riskLevel,
          status: 'PENDING',
          input: ('input' in step ? step.input : undefined) as any,
        })),
      },
    },
  });

  return {
    mode: 'plan',
    assistantMessage: buildAssistantMessageForPlan({
      accountType: input.session.account_type,
      detectedIntent: intent.detectedIntent,
      scaleId: intent.scaleId,
      config,
    }),
    requiresConfirmation: true,
    steps,
    executionId: execution.id,
    preview: {
      detectedIntent: intent.detectedIntent,
      highlightedScaleId: intent.scaleId,
    },
  } satisfies AgentPlanResponse;
}

async function executeTool(input: {
  session: AgentSessionPayload;
  step: PlannedAgentStep;
}) {
  switch (input.step.toolId) {
    case 'context.read_member':
      return getMemberContext(input.session.sub, input.session.member_id);
    case 'context.read_assessments':
      return getMemberAssessmentSummary(input.session.sub, input.session.member_id);
    case 'profile.read':
      return getOrBuildAgentProfileState({
        userId: input.session.sub,
        memberId: input.session.member_id,
      });
    case 'profile.rebuild':
      return rebuildAgentProfileState({
        userId: input.session.sub,
        memberId: input.session.member_id,
        trigger: 'agent_execute',
      });
    case 'profile.export_v1':
      return exportPersonaSnapshot({
        userId: input.session.sub,
        profileId: input.session.member_id,
      });
    case 'assessment.recommend':
      return { recommendedScale: input.step.input?.scaleId || null };
    case 'assessment.session.start': {
      const scaleId = String(input.step.input?.scaleId || '');
      const [sessionState, scale] = await Promise.all([
        createAssessmentSession({
          userId: input.session.sub,
          profileId: input.session.member_id,
          scaleId,
          language: 'zh',
          channel: 'agent',
          agentSession: input.session,
        }),
        Promise.resolve(getSkillScale(scaleId)),
      ]);

      return { session: sessionState, scale };
    }
    case 'doctor.invites.create': {
      if (input.session.account_type !== 'DOCTOR' || !input.session.doctor_profile_id) {
        throw new Error('Doctor account required for invite generation');
      }
      const scaleId = String(input.step.input?.scaleId || '');
      return createDoctorScaleInvite({
        doctorProfileId: input.session.doctor_profile_id,
        scaleId,
      });
    }
    case 'doctor.invites.list': {
      if (input.session.account_type !== 'DOCTOR' || !input.session.doctor_profile_id) {
        throw new Error('Doctor account required for invite listing');
      }
      return getDoctorScaleInvites(input.session.doctor_profile_id);
    }
    default:
      throw new Error(`Unsupported tool: ${input.step.toolId}`);
  }
}

export async function executeAgentPlan(input: {
  session: AgentSessionPayload;
  executionId: string;
}) {
  const execution = await prisma.agentExecution.findFirst({
    where: {
      id: input.executionId,
      userId: input.session.sub,
      memberProfileId: input.session.member_id,
    },
    include: {
      steps: {
        orderBy: { stepOrder: 'asc' },
      },
    },
  });

  if (!execution) {
    throw new Error('Execution not found');
  }

  if (execution.status === 'COMPLETED') {
    return execution;
  }

  const plannedSteps = (((execution.plan as any)?.steps || []) as PlannedAgentStep[]);

  await prisma.agentExecution.update({
    where: { id: execution.id },
    data: {
      status: 'EXECUTING',
      confirmedAt: execution.confirmedAt || new Date(),
    },
  });

  const outputs: Record<string, unknown> = {};

  for (const stepRecord of execution.steps as ExecutionStepRecord[]) {
    const step =
      plannedSteps[stepRecord.stepOrder] ||
      ({
        toolId: stepRecord.toolId,
        summary: stepRecord.summary || stepRecord.toolId,
        riskLevel: (stepRecord.riskLevel as AgentToolRiskLevel) || 'low',
        confirmBeforeExecute: false,
      } satisfies PlannedAgentStep);

    await prisma.agentExecutionStep.update({
      where: { id: stepRecord.id },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    try {
      const output = await executeTool({
        session: input.session,
        step,
      });
      outputs[step.toolId] = output;

      await prisma.agentExecutionStep.update({
        where: { id: stepRecord.id },
        data: {
          status: 'COMPLETED',
          output: output as any,
          completedAt: new Date(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Execution failed';

      await prisma.agentExecutionStep.update({
        where: { id: stepRecord.id },
        data: {
          status: 'FAILED',
          errorMessage: message,
          completedAt: new Date(),
        },
      });

      await prisma.agentExecution.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          errorMessage: message,
          result: outputs as any,
        },
      });

      throw error;
    }
  }

  return prisma.agentExecution.update({
    where: { id: execution.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      result: outputs as any,
    },
    include: {
      steps: {
        orderBy: { stepOrder: 'asc' },
      },
    },
  });
}

export async function getAgentExecution(input: {
  session: AgentSessionPayload;
  executionId: string;
}) {
  const execution = await prisma.agentExecution.findFirst({
    where: {
      id: input.executionId,
      userId: input.session.sub,
      memberProfileId: input.session.member_id,
    },
    include: {
      steps: {
        orderBy: { stepOrder: 'asc' },
      },
    },
  });

  if (!execution) {
    throw new Error('Execution not found');
  }

  return execution;
}
