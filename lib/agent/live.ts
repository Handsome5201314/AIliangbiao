export type AgentLiveEventType =
  | 'plan'
  | 'running'
  | 'page_focus'
  | 'action'
  | 'result'
  | 'failed'
  | 'paused'
  | 'takeover'
  | 'resumed';

export type AgentLiveStatus =
  | 'idle'
  | 'planning'
  | 'running'
  | 'paused'
  | 'takeover'
  | 'completed'
  | 'failed';

export type AgentLiveViewKind = 'workspace' | 'assessment' | 'handoff' | 'result';

export interface AgentLiveEvent {
  seq: number;
  type: AgentLiveEventType;
  message: string;
  createdAt: string;
  stepId?: string;
  view?: AgentLiveView;
  data?: Record<string, unknown>;
}

export interface AgentLiveView {
  kind: AgentLiveViewKind;
  title: string;
  href: string;
  anchor?: string;
  pendingAction?: string;
  meta?: Record<string, unknown>;
}

export interface AgentLiveControl {
  pausedBy?: string;
  pausedAt?: string;
  takenOverBy?: string;
  takenOverAt?: string;
  resumedAt?: string;
  lastManualCompletionAt?: string;
}

export interface AgentLiveState {
  status: AgentLiveStatus;
  nextSeq: number;
  events: AgentLiveEvent[];
  currentView?: AgentLiveView;
  control?: AgentLiveControl;
}

export type AppendAgentLiveEventInput = {
  type: AgentLiveEventType;
  message: string;
  now?: string;
  stepId?: string;
  view?: AgentLiveView;
  data?: Record<string, unknown>;
};

export type AgentLiveControlAction = 'pause' | 'takeover' | 'resume' | 'manual_complete';

export type ApplyAgentLiveControlInput = {
  action: AgentLiveControlAction;
  actor: string;
  now?: string;
  message?: string;
};

export type AssessmentLiveViewInput = {
  sessionId: string;
  scaleId: string;
  interactionMode?: string;
  progress: {
    answered: number;
    total: number;
    ratio: number;
  };
  currentQuestion: {
    id: number;
    text: string;
    options?: unknown[];
  } | null;
  handoff?: {
    url: string;
    expiresAt?: string;
  } | null;
  result: {
    totalScore: number;
    conclusion: string;
  } | null;
};

function createEmptyLiveState(): AgentLiveState {
  return {
    status: 'idle',
    nextSeq: 1,
    events: [],
  };
}

function resolveNow(now?: string) {
  return now || new Date().toISOString();
}

function statusForEvent(
  type: AgentLiveEventType,
  currentStatus?: AgentLiveStatus,
  control?: AgentLiveControl
): AgentLiveStatus | undefined {
  const hasTakeover = currentStatus === 'takeover' || Boolean(control?.takenOverBy);
  if (hasTakeover && type !== 'resumed' && type !== 'failed' && type !== 'result') {
    return 'takeover';
  }

  const hasPause = currentStatus === 'paused' || Boolean(control?.pausedBy);
  if (hasPause && type !== 'resumed' && type !== 'failed' && type !== 'result' && type !== 'takeover') {
    return 'paused';
  }

  switch (type) {
    case 'plan':
      return 'planning';
    case 'running':
    case 'page_focus':
    case 'action':
      return 'running';
    case 'result':
      return 'completed';
    case 'failed':
      return 'failed';
    case 'paused':
      return 'paused';
    case 'takeover':
      return 'takeover';
    case 'resumed':
      return 'running';
    default:
      return undefined;
  }
}

export function appendAgentLiveEvent(
  state: AgentLiveState | undefined,
  input: AppendAgentLiveEventInput
): AgentLiveState {
  const base = state || createEmptyLiveState();
  const event: AgentLiveEvent = {
    seq: base.nextSeq,
    type: input.type,
    message: input.message,
    createdAt: resolveNow(input.now),
    ...(input.stepId ? { stepId: input.stepId } : {}),
    ...(input.view ? { view: input.view } : {}),
    ...(input.data ? { data: input.data } : {}),
  };
  const nextStatus = statusForEvent(input.type, base.status, base.control) || base.status;

  return {
    ...base,
    status: nextStatus,
    nextSeq: base.nextSeq + 1,
    events: [...base.events, event],
    currentView: input.view || base.currentView,
  };
}

export function applyAgentLiveControl(
  state: AgentLiveState | undefined,
  input: ApplyAgentLiveControlInput
): AgentLiveState {
  const now = resolveNow(input.now);
  const base = state || createEmptyLiveState();

  if (input.action === 'pause') {
    const control = {
      ...base.control,
      pausedBy: input.actor,
      pausedAt: now,
    };
    return {
      ...appendAgentLiveEvent(
        { ...base, control },
        {
          type: 'paused',
          message: input.message || 'Agent execution paused',
          now,
          data: { actor: input.actor },
        }
      ),
      control,
    };
  }

  if (input.action === 'takeover') {
    const control = {
      ...base.control,
      takenOverBy: input.actor,
      takenOverAt: now,
    };
    return {
      ...appendAgentLiveEvent(
        { ...base, control },
        {
          type: 'takeover',
          message: input.message || 'User took over the current page',
          now,
          data: { actor: input.actor },
        }
      ),
      control,
    };
  }

  if (input.action === 'manual_complete') {
    const control = {
      ...base.control,
      lastManualCompletionAt: now,
    };
    return {
      ...appendAgentLiveEvent(
        { ...base, control },
        {
          type: 'action',
          message: input.message || 'Current step completed manually',
          now,
          data: { actor: input.actor, manual: true },
        }
      ),
      control,
    };
  }

  const control = {
    ...base.control,
    pausedBy: undefined,
    pausedAt: undefined,
    takenOverBy: undefined,
    takenOverAt: undefined,
    resumedAt: now,
  };
  return {
    ...appendAgentLiveEvent(
      { ...base, control },
      {
        type: 'resumed',
        message: input.message || 'Agent execution resumed',
        now,
        data: { actor: input.actor },
      }
    ),
    control,
  };
}

export function buildWorkspaceLiveView(title = 'Agent workspace'): AgentLiveView {
  return {
    kind: 'workspace',
    title,
    href: '/agent',
    anchor: 'agent-live-workspace',
    pendingAction: 'listen_for_goal',
  };
}

export function buildAssessmentLiveView(input: AssessmentLiveViewInput): AgentLiveView {
  if (input.result) {
    return {
      kind: 'result',
      title: input.scaleId,
      href: `/agent?liveSession=${encodeURIComponent(input.sessionId)}`,
      anchor: 'agent-assessment-result',
      pendingAction: 'review_result',
      meta: {
        scaleId: input.scaleId,
        totalScore: input.result.totalScore,
        conclusion: input.result.conclusion,
      },
    };
  }

  if (input.interactionMode === 'web_handoff' && input.handoff) {
    return {
      kind: 'handoff',
      title: input.scaleId,
      href: input.handoff.url,
      anchor: 'agent-handoff-link',
      pendingAction: 'complete_handoff',
      meta: {
        scaleId: input.scaleId,
        answered: input.progress.answered,
        total: input.progress.total,
        expiresAt: input.handoff.expiresAt,
      },
    };
  }

  return {
    kind: 'assessment',
    title: input.scaleId,
    href: `/agent?liveSession=${encodeURIComponent(input.sessionId)}`,
    anchor: input.currentQuestion ? `agent-question-${input.currentQuestion.id}` : 'agent-assessment-session',
    pendingAction: input.currentQuestion ? 'answer_question' : 'wait_for_question',
    meta: {
      scaleId: input.scaleId,
      questionId: input.currentQuestion?.id,
      questionText: input.currentQuestion?.text,
      answered: input.progress.answered,
      total: input.progress.total,
      ratio: input.progress.ratio,
    },
  };
}

export function parseAgentLiveState(value: unknown): AgentLiveState {
  if (!value || typeof value !== 'object') {
    return createEmptyLiveState();
  }

  const candidate = value as Partial<AgentLiveState>;
  const events = Array.isArray(candidate.events) ? candidate.events : [];
  const nextSeq =
    typeof candidate.nextSeq === 'number' && candidate.nextSeq > 0
      ? candidate.nextSeq
      : events.reduce((max, event) => Math.max(max, Number((event as AgentLiveEvent).seq) || 0), 0) + 1;

  return {
    status: candidate.status || 'idle',
    nextSeq,
    events: events as AgentLiveEvent[],
    currentView: candidate.currentView,
    control: candidate.control,
  };
}
