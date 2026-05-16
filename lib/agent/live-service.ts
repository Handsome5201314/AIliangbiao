import { prisma } from '@/lib/db/prisma';
import type { AgentSessionPayload } from '@/lib/assessment-skill/auth';
import {
  appendAgentLiveEvent,
  applyAgentLiveControl,
  buildWorkspaceLiveView,
  parseAgentLiveState,
  type AgentLiveControlAction,
  type AgentLiveEvent,
  type AgentLiveState,
  type AgentLiveView,
} from '@/lib/agent/live';

type ExecutionWithSteps = Awaited<ReturnType<typeof getAgentLiveExecution>>;

const LIVE_EXECUTION_STATUS = ['AWAITING_CONFIRMATION', 'EXECUTING', 'PAUSED', 'TAKEOVER'] as const;

function extractPlan(execution: { plan: unknown }) {
  return ((execution.plan || {}) as Record<string, unknown>) || {};
}

function extractLiveState(execution: { plan: unknown }) {
  const plan = extractPlan(execution);
  return parseAgentLiveState(plan.live);
}

function withLiveState(execution: { plan: unknown }, live: AgentLiveState) {
  return {
    ...extractPlan(execution),
    live,
  };
}

function executionStatusForLiveStatus(status: AgentLiveState['status']) {
  if (status === 'paused') return 'PAUSED';
  if (status === 'takeover') return 'TAKEOVER';
  if (status === 'completed') return 'COMPLETED';
  if (status === 'failed') return 'FAILED';
  if (status === 'running' || status === 'planning') return 'EXECUTING';
  return 'AWAITING_CONFIRMATION';
}

function isSameAgentSession(execution: { userId: string; memberProfileId: string | null }, session: AgentSessionPayload) {
  return execution.userId === session.sub && execution.memberProfileId === session.member_id;
}

export async function getAgentLiveExecution(input: {
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

export async function getOrCreateAgentLiveExecution(input: {
  session: AgentSessionPayload;
  goal?: string;
}) {
  const existing = await prisma.agentExecution.findFirst({
    where: {
      userId: input.session.sub,
      memberProfileId: input.session.member_id,
      agentSessionId: input.session.session_id,
      status: { in: [...LIVE_EXECUTION_STATUS] },
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      steps: {
        orderBy: { stepOrder: 'asc' },
      },
    },
  });

  if (existing) {
    return existing;
  }

  const live = appendAgentLiveEvent(undefined, {
    type: 'plan',
    message: '实时跟随会话已创建',
    view: buildWorkspaceLiveView('小安实时工作台'),
    data: {
      goal: input.goal || 'standby',
    },
  });

  return prisma.agentExecution.create({
    data: {
      userId: input.session.sub,
      memberProfileId: input.session.member_id,
      agentSessionId: input.session.session_id,
      accountType: input.session.account_type || 'PATIENT',
      goal: input.goal || '站内实时跟随',
      status: executionStatusForLiveStatus(live.status),
      plan: {
        detectedIntent: 'live_follow',
        highlightedScaleId: null,
        steps: [],
        live,
      } as any,
    },
    include: {
      steps: {
        orderBy: { stepOrder: 'asc' },
      },
    },
  });
}

export async function appendAgentLiveExecutionEvent(input: {
  session: AgentSessionPayload;
  executionId: string;
  type: AgentLiveEvent['type'];
  message: string;
  view?: AgentLiveView;
  data?: Record<string, unknown>;
}) {
  const execution = await getAgentLiveExecution({
    session: input.session,
    executionId: input.executionId,
  });
  const live = appendAgentLiveEvent(extractLiveState(execution), {
    type: input.type,
    message: input.message,
    view: input.view,
    data: input.data,
  });

  return prisma.agentExecution.update({
    where: { id: execution.id },
    data: {
      status: executionStatusForLiveStatus(live.status),
      plan: withLiveState(execution, live) as any,
      ...(live.status === 'completed' ? { completedAt: new Date() } : {}),
    },
    include: {
      steps: {
        orderBy: { stepOrder: 'asc' },
      },
    },
  });
}

export async function controlAgentLiveExecution(input: {
  session: AgentSessionPayload;
  executionId: string;
  action: AgentLiveControlAction;
  message?: string;
}) {
  const execution = await getAgentLiveExecution({
    session: input.session,
    executionId: input.executionId,
  });
  const live = applyAgentLiveControl(extractLiveState(execution), {
    action: input.action,
    actor: input.session.sub,
    message: input.message,
  });

  return prisma.agentExecution.update({
    where: { id: execution.id },
    data: {
      status: executionStatusForLiveStatus(live.status),
      plan: withLiveState(execution, live) as any,
      confirmedAt: execution.confirmedAt || new Date(),
    },
    include: {
      steps: {
        orderBy: { stepOrder: 'asc' },
      },
    },
  });
}

export function serializeAgentLiveExecution(execution: NonNullable<ExecutionWithSteps>) {
  const live = extractLiveState(execution);
  return {
    execution,
    live,
  };
}

export function getEventsAfterCursor(execution: { plan: unknown }, afterSeq = 0) {
  const live = extractLiveState(execution);
  return live.events.filter((event) => event.seq > afterSeq);
}

export function assertCanUseLiveExecution(
  execution: { userId: string; memberProfileId: string | null },
  session: AgentSessionPayload
) {
  if (!isSameAgentSession(execution, session)) {
    throw new Error('Execution not found');
  }
}
