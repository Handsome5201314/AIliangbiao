'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Bot, Eye, GraduationCap, Home, Loader2, Maximize2, MessageCircleHeart, Minimize2, MousePointer2, Pause, PlayCircle, RefreshCw, Square } from 'lucide-react';

import { useAuthSession } from '@/contexts/AuthSessionContext';
import { useProfile } from '@/contexts/ProfileContext';
import PlatformKnowledgePanel from '@/components/PlatformKnowledgePanel';
import InviteQrCard from '@/components/InviteQrCard';
import { QuestionnaireOptionButton } from '@/components/questionnaire/Shared';
import dynamic from 'next/dynamic';

const TriageVoiceRecorder = dynamic(
  () => import('@/components/TriageVoiceRecorder'),
  { ssr: false }
);
import { resolveLocalizedText } from '@/lib/schemas/core/i18n';
import type { LocalizedTextValue } from '@/lib/schemas/core/types';
import type { TriageContext } from '@/lib/services/triageFlow';
import { getOrCreateGuestSessionId, peekGuestSessionId } from '@/lib/utils/guestSession';
import { generateUUID } from '@/lib/utils/uuid';
import { buildAssessmentLiveView, buildWorkspaceLiveView, type AgentLiveEvent, type AgentLiveState, type AgentLiveView } from '@/lib/agent/live';
import { parseAgentLiveSseBuffer } from '@/lib/agent/live-stream';

type AgentBootstrapResponse = {
  token: string;
  session?: {
    device_id: string;
  };
  account: {
    accountType: 'PATIENT' | 'DOCTOR';
    isAuthenticated: boolean;
  };
  member: { id: string; nickname: string };
  members: Array<{ id: string; nickname: string }>;
};

type SkillScaleSummary = {
  id: string;
  title: LocalizedTextValue;
};

type AgentAssessmentSession = {
  sessionId: string;
  scaleId: string;
  status: string;
  interactionMode?: string;
  resultDeliveryMode?: string;
  resultVisibleToRespondent?: boolean;
  progress: { ratio: number; answered: number; total: number };
  handoff?: {
    url: string;
    expiresAt: string;
  } | null;
  currentQuestion: {
    id: number;
    text: string;
    imageUrl?: string;
    imageAlt?: string;
    options: Array<{ label: string; score: number; description?: string }>;
  } | null;
  result: { totalScore: number; conclusion: string } | null;
};

type AssessmentSummaryResponse = {
  total: number;
  items: Array<{
    id: string;
    scaleId: string;
    totalScore: number;
    conclusion: string;
    createdAt: string;
  }>;
};

type PersistedTriageSession = {
  id: string;
  status: string;
  symptoms: string[];
  conversationHistory: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
  recommendedScale?: string | null;
  updatedAt?: string;
};

type LiveSessionPayload = {
  execution: {
    id: string;
    status: string;
  };
  live: AgentLiveState;
};

type RealtimeBootstrapResponse = {
  runtime: {
    provider: 'hermes';
    mode: 'sdk';
    fallbacks: {
      voiceIntent: boolean;
      speechToText: boolean;
      doctorBot: boolean;
    };
  };
  surface: 'agent' | 'doctor_bot';
  session: {
    token: string;
    payload: {
      device_id: string;
    };
  };
  tools: Array<{
    name: string;
    riskLevel: 'low' | 'medium' | 'high';
  }>;
  activeAssessment: AgentAssessmentSession | null;
};

type PlatformAgentStreamActionPayload = {
  agentAction?: string;
  actionCard?: {
    scaleId?: string;
  } | null;
  triageSessionPatch?: {
    status: string;
    symptoms: string[];
    conversationHistory: Array<{
      role: 'user' | 'assistant';
      content: string;
      timestamp: number;
    }>;
    recommendedScale: string | null;
  } | null;
  backend?: string;
  fallback?: boolean;
};

type PlatformAgentStreamMetaPayload = {
  backend?: string;
  fallback?: boolean;
};

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

async function consumePlatformAgentChatStream(input: {
  agentToken: string;
  language: 'zh' | 'en';
  triageContext: TriageContext;
  content: string;
  onAssistantDelta: (content: string) => void;
}): Promise<{
  replyText: string;
  meta: PlatformAgentStreamMetaPayload | null;
  action: PlatformAgentStreamActionPayload | null;
}> {
  const response = await fetch('/api/platform/v1/ai/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.agentToken}`,
    },
    body: JSON.stringify({
      conversationBackend: 'hermes',
      language: input.language,
      triageContext: input.triageContext,
      input: {
        type: 'text',
        text: input.content,
      },
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'Failed to continue triage');
  }

  if (!response.body) {
    throw new Error('Platform AI stream is unavailable');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let replyText = '';
  let metaPayload: PlatformAgentStreamMetaPayload | null = null;
  let actionPayload: PlatformAgentStreamActionPayload | null = null;

  const handleMessages = (messages: Array<{ event: string; data: unknown }>) => {
    for (const message of messages) {
      if (message.event === 'meta' && isPlainRecord(message.data)) {
        metaPayload = {
          backend:
            typeof message.data.backend === 'string' ? message.data.backend : undefined,
          fallback:
            typeof message.data.fallback === 'boolean' ? message.data.fallback : undefined,
        };
        continue;
      }

      if (message.event === 'delta' && isPlainRecord(message.data)) {
        const nextContent =
          typeof message.data.content === 'string'
            ? message.data.content
            : typeof message.data.delta === 'string'
              ? `${replyText}${message.data.delta}`
              : replyText;
        if (nextContent) {
          replyText = nextContent;
          input.onAssistantDelta(nextContent);
        }
        continue;
      }

      if (message.event === 'message' && isPlainRecord(message.data)) {
        if (typeof message.data.content === 'string' && message.data.content) {
          replyText = message.data.content;
          input.onAssistantDelta(replyText);
        }
        continue;
      }

      if (message.event === 'action' && isPlainRecord(message.data)) {
        actionPayload = {
          agentAction:
            typeof message.data.agentAction === 'string'
              ? message.data.agentAction
              : undefined,
          actionCard:
            isPlainRecord(message.data.actionCard)
              ? (message.data.actionCard as { scaleId?: string })
              : null,
          triageSessionPatch:
            isPlainRecord(message.data.triageSessionPatch)
              ? (message.data.triageSessionPatch as PlatformAgentStreamActionPayload['triageSessionPatch'])
              : null,
          backend:
            typeof message.data.backend === 'string' ? message.data.backend : undefined,
          fallback:
            typeof message.data.fallback === 'boolean' ? message.data.fallback : undefined,
        };
        continue;
      }

      if (message.event === 'error') {
        if (typeof message.data === 'string') {
          throw new Error(message.data);
        }
        if (isPlainRecord(message.data) && typeof message.data.message === 'string') {
          throw new Error(message.data.message);
        }
        throw new Error('Failed to continue triage');
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    const parsed = parseAgentLiveSseBuffer(buffer);
    buffer = parsed.rest;
    handleMessages(parsed.messages);

    if (done) {
      break;
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    const parsed = parseAgentLiveSseBuffer(`${buffer}\n\n`);
    handleMessages(parsed.messages);
  }

  return {
    replyText,
    meta: metaPayload,
    action: actionPayload,
  };
}

function getSessionDeviceId(isAuthenticated: boolean) {
  if (isAuthenticated) {
    return peekGuestSessionId() || generateUUID();
  }

  return getOrCreateGuestSessionId();
}

function formatScaleTitle(title: LocalizedTextValue, language: 'zh' | 'en') {
  return resolveLocalizedText(title, language);
}

function formatDate(value: string, language: 'zh' | 'en') {
  return new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'zh-CN', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

function isHandoffDoneIntent(value: string) {
  return /(填完了|已提交|提交好了|做完了|done|finished|submitted)/i.test(value.trim());
}

function mergeLiveEvent(live: AgentLiveState | null, event: AgentLiveEvent): AgentLiveState {
  const base: AgentLiveState = live || {
    status: 'idle',
    nextSeq: 1,
    events: [],
  };
  if (base.events.some((item) => item.seq === event.seq)) {
    return base;
  }

  const events = [...base.events, event].sort((left, right) => left.seq - right.seq);
  const nextControl = {
    ...base.control,
    ...(event.type === 'paused'
      ? { pausedBy: base.control?.pausedBy || 'user', pausedAt: event.createdAt }
      : {}),
    ...(event.type === 'takeover'
      ? { takenOverBy: base.control?.takenOverBy || 'user', takenOverAt: event.createdAt }
      : {}),
    ...(event.type === 'resumed'
      ? { pausedBy: undefined, pausedAt: undefined, takenOverBy: undefined, takenOverAt: undefined, resumedAt: event.createdAt }
      : {}),
  };
  const stickyStatus =
    (base.status === 'takeover' || nextControl.takenOverBy) &&
    event.type !== 'resumed' &&
    event.type !== 'failed' &&
    event.type !== 'result'
      ? 'takeover'
      : (base.status === 'paused' || nextControl.pausedBy) &&
        event.type !== 'resumed' &&
        event.type !== 'failed' &&
        event.type !== 'result' &&
        event.type !== 'takeover'
        ? 'paused'
        : null;

  return {
    ...base,
    status:
      stickyStatus ||
      (event.type === 'paused'
        ? 'paused'
        : event.type === 'takeover'
          ? 'takeover'
          : event.type === 'resumed'
            ? 'running'
            : event.type === 'result'
              ? 'completed'
              : event.type === 'failed'
                ? 'failed'
                : event.type === 'running' || event.type === 'action' || event.type === 'page_focus'
                  ? 'running'
                  : base.status),
    nextSeq: Math.max(base.nextSeq, event.seq + 1),
    events,
    currentView: event.view || base.currentView,
    control: nextControl,
  };
}

type AgentWorkspaceProps = {
  mobile?: boolean;
  mobileShellMode?: 'standalone' | 'drawer' | 'fullscreen';
  onRequestExpand?: (() => void) | undefined;
  onRequestCollapse?: (() => void) | undefined;
  knowledgeOpenOverride?: boolean | undefined;
  onKnowledgeOpenChange?: ((open: boolean) => void) | undefined;
  onCurrentQuestionChange?: ((questionId: number | null) => void) | undefined;
  onCurrentScaleChange?: ((scaleId: string | null) => void) | undefined;
  renderKnowledgePanel?: boolean | undefined;
};

export default function AgentWorkspace({
  mobile = false,
  mobileShellMode = 'standalone',
  onRequestExpand,
  onRequestCollapse,
  knowledgeOpenOverride,
  onKnowledgeOpenChange,
  onCurrentQuestionChange,
  onCurrentScaleChange,
  renderKnowledgePanel = true,
}: AgentWorkspaceProps) {
  const router = useRouter();
  const { authHeaders, isAuthenticated } = useAuthSession();
  const { profile } = useProfile();
  const language = (profile.languagePreference || 'zh') as 'zh' | 'en';

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [agentConfig, setAgentConfig] = useState<any>(null);
  const [bootstrap, setBootstrap] = useState<AgentBootstrapResponse | null>(null);
  const [activeMemberId, setActiveMemberId] = useState('');
  const [goal, setGoal] = useState('');
  const [composerOpen, setComposerOpen] = useState(false);
  const [knowledgeOpenState, setKnowledgeOpenState] = useState(false);
  const [latestAssistant, setLatestAssistant] = useState('');
  const [latestUser, setLatestUser] = useState('');
  const [assessmentSummary, setAssessmentSummary] = useState<AssessmentSummaryResponse | null>(null);
  const [scaleLibrary, setScaleLibrary] = useState<SkillScaleSummary[]>([]);
  const [assessmentSession, setAssessmentSession] = useState<AgentAssessmentSession | null>(null);
  const [triageSession, setTriageSession] = useState<PersistedTriageSession | null>(null);
  const [lastCompletedResult, setLastCompletedResult] = useState<{ totalScore: number; conclusion: string } | null>(null);
  const [liveExecutionId, setLiveExecutionId] = useState('');
  const [liveState, setLiveState] = useState<AgentLiveState | null>(null);
  const [liveStreamError, setLiveStreamError] = useState('');
  const [realtimeBootstrap, setRealtimeBootstrap] = useState<RealtimeBootstrapResponse | null>(null);
  const [error, setError] = useState('');
  const mobileEmbedded = mobile && mobileShellMode !== 'standalone';
  const showWorkspaceHeader = !mobileEmbedded;
  const knowledgeOpen = knowledgeOpenOverride ?? knowledgeOpenState;
  const setKnowledgeOpen = (open: boolean) => {
    if (knowledgeOpenOverride === undefined) {
      setKnowledgeOpenState(open);
    }
    onKnowledgeOpenChange?.(open);
  };

  const agentToken = bootstrap?.token || '';
  const currentDeviceId = bootstrap?.session?.device_id || getSessionDeviceId(isAuthenticated);
  const prompts = agentConfig?.prompts || {};
  const memberSnapshot = useMemo(() => ({
    nickname: profile.nickname,
    gender: profile.gender,
    ageMonths: profile.ageMonths,
    relation: profile.relation,
    languagePreference: profile.languagePreference,
    interests: profile.interests,
    fears: profile.fears,
    avatarConfig: profile.avatarState,
  }), [profile.nickname, profile.gender, profile.ageMonths, profile.relation, profile.languagePreference, profile.interests, profile.fears, profile.avatarState]);

  useEffect(() => {
    onCurrentQuestionChange?.(assessmentSession?.currentQuestion?.id || null);
  }, [assessmentSession?.currentQuestion?.id, onCurrentQuestionChange]);

  useEffect(() => {
    onCurrentScaleChange?.(assessmentSession?.scaleId || null);
  }, [assessmentSession?.scaleId, onCurrentScaleChange]);
  const copy = useMemo(() => language === 'en'
    ? {
        title: 'XiaoAn stays with you through screening',
        subtitle: 'Speak first. I will guide you step by step.',
        doctor: 'Doctor features are now in the doctor workspace.',
        doctorPrimary: 'Open Doctor Workspace',
        doctorSecondary: 'Open Invite Center',
        backHome: 'Back Home',
        currentProfile: 'Current Profile',
        preparing: 'Preparing your screening assistant...',
        latestReply: 'Latest guidance',
        youSaid: 'You just said',
        typingEntry: 'Type instead',
        hideTyping: 'Hide typing',
        send: 'Send',
        currentScale: 'Current scale',
        stopAssessment: 'Exit This Assessment',
        results: 'Recent Results',
        noResults: 'No completed results yet.',
        quickStart: 'Quick Start',
        completed: 'Your result is ready',
        scoreLabel: 'Score',
        assistantExpand: 'Open full screen',
        assistantCollapse: 'Back to half-open',
        knowledgeTitle: 'Question Explanation',
        knowledgeBody:
          'Open it while answering a question to view the platform-standard explanation and any approved doctor supplement.',
        knowledgeOpen: 'Open Knowledge Panel',
        liveTitle: 'Live Follow',
        liveMirror: 'Current Page',
        liveControl: 'Control',
        liveEmpty: 'Live events will appear when the assistant starts working.',
        livePause: 'Pause',
        liveTakeover: 'Take over',
        liveResume: 'Resume',
        liveManualDone: 'Manual done',
        liveOpen: 'Open page',
        liveStatusIdle: 'Standing by',
        liveStatusRunning: 'Running',
        liveStatusPaused: 'Paused',
        liveStatusTakeover: 'User control',
        liveStatusCompleted: 'Completed',
        liveStatusFailed: 'Failed',
        companionTitle: 'XiaoAn assistant',
        companionReady: 'Ready to listen',
        companionThinking: 'Understanding your concern',
        companionFilling: 'Guiding this assessment',
        helpHuman: 'Ask a human',
        taskCanvas: 'Assessment workspace',
        explainQuestion: 'Explain this question',
        unsureHint: 'Not sure what to choose? Tell XiaoAn what happened.',
        desktopInputPlaceholder: 'Send a message, or use voice to describe the situation...',
        desktopDefaultAssistant: 'Tell me what has been worrying you recently. I will help you choose the right next step.',
        desktopIdleTitle: 'Start with what you observed',
        desktopIdleBody: 'You can describe behavior in plain words, or start from a common scale below.',
        fillingProgress: 'Progress',
        supportDrawerTitle: 'Assistant controls and trace',
        latestActivity: 'Recent activity',
        pauseFilling: 'Pause',
        takeoverFilling: 'Take over',
        resumeFilling: 'Resume',
        manualDone: 'Done',
        noActivity: 'No assistant activity yet.',
      }
    : {
        title: '小安陪你做筛查',
        subtitle: '不会填量表也没关系，你先说，我会一步一步带你做。',
        doctor: '医生复杂能力已移到医生工作台。',
        doctorPrimary: '进入医生工作台',
        doctorSecondary: '进入邀填中心',
        backHome: '返回主页',
        currentProfile: '当前档案',
        preparing: '正在准备筛查助手...',
        latestReply: '小安正在引导你',
        youSaid: '你刚刚说',
        typingEntry: '我来打字',
        hideTyping: '收起打字',
        send: '发送',
        currentScale: '当前量表',
        stopAssessment: '退出本次评测',
        results: '最近结果',
        noResults: '你还没有完成过筛查。',
        quickStart: '快捷开始',
        completed: '筛查结果已经出来了',
        scoreLabel: '得分',
        assistantExpand: '切到全屏',
        assistantCollapse: '回到半展开',
        knowledgeTitle: '题目解释',
        knowledgeBody: '在答题过程中打开这里，可以看到当前题的平台标准解释，以及审核通过的医生 / 机构补充说明。',
        knowledgeOpen: '打开知识面板',
        liveTitle: '实时跟随',
        liveMirror: '当前页面',
        liveControl: '控制权',
        liveEmpty: '小安开始操作后，实时轨迹会显示在这里。',
        livePause: '暂停',
        liveTakeover: '接管',
        liveResume: '恢复',
        liveManualDone: '我已完成',
        liveOpen: '打开页面',
        liveStatusIdle: '待命中',
        liveStatusRunning: '执行中',
        liveStatusPaused: '已暂停',
        liveStatusTakeover: '用户接管',
        liveStatusCompleted: '已完成',
        liveStatusFailed: '失败',
        companionTitle: '小安助手',
        companionReady: '可以开始说情况',
        companionThinking: '正在理解你的情况',
        companionFilling: '正在陪你填写',
        helpHuman: '求助人工',
        taskCanvas: '筛查任务区',
        explainQuestion: '查看题目解释',
        unsureHint: '不确定怎么选？告诉小安具体情况。',
        desktopInputPlaceholder: '发消息，或用语音说明孩子的具体情况...',
        desktopDefaultAssistant: '你可以先告诉我最近最困扰的情况，我会帮你判断下一步适合做什么。',
        desktopIdleTitle: '先从观察到的情况开始',
        desktopIdleBody: '可以直接描述孩子的表现，也可以从常用量表里快速开始。',
        fillingProgress: '填写进度',
        supportDrawerTitle: '辅助控制与轨迹',
        latestActivity: '最近动态',
        pauseFilling: '暂停填写',
        takeoverFilling: '我来接管',
        resumeFilling: '继续填写',
        manualDone: '我已完成',
        noActivity: '小安开始工作后，这里会显示最近动态。',
      }, [language]);

  const handoffCopy = useMemo(() => language === 'en'
    ? {
        title: 'Continue in the handoff form',
        body: 'Open the secure link on your phone or in a new tab, finish the form, then come back and say you are done.',
        open: 'Open handoff form',
        pending: 'Waiting for your handoff result',
        pendingBody: 'Once you finish the form, tell me “done” and I will fetch the result here.',
        notReady: 'I have not received the completed form yet. Please finish the handoff page first.',
        resultReceived: 'I received the submitted result and pulled it back into the workspace.',
        physicianReviewSubmitted: 'The assessment has been submitted. Please wait for the physician to review the result.',
      }
    : {
        title: '请继续完成外链量表',
        body: '打开安全 handoff 链接，在手机或新标签页里填完量表，然后回来告诉我“我填完了”。',
        open: '打开 handoff 表单',
        pending: '正在等待 handoff 结果',
        pendingBody: '你提交完表单后，回来对我说“我填完了”，我就会把结果接回工作台。',
        notReady: '我这边还没有收到完成结果，请先把 handoff 页面提交完成。',
        resultReceived: '我收到你提交的量表结果了，已经接回当前工作台。',
        physicianReviewSubmitted: '量表已提交，等待医师审核评估结果。',
      }, [language]);

  const loadAgentConfig = useCallback(async () => {
    const response = await fetch('/api/agent/config');
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Failed to load agent config');
    setAgentConfig(data.config || null);
    return data.config || null;
  }, []);

  const loadRealtimeBootstrap = useCallback(async (memberId?: string) => {
    const response = await fetch('/api/realtime/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        surface: 'agent',
        deviceId: getSessionDeviceId(isAuthenticated),
        memberId: memberId || activeMemberId || undefined,
        memberSnapshot,
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Failed to prepare Hermes realtime session');
    setRealtimeBootstrap(data as RealtimeBootstrapResponse);
    return data as RealtimeBootstrapResponse;
  }, [activeMemberId, authHeaders, isAuthenticated, memberSnapshot]);

  const loadResources = useCallback(async (token: string, memberId: string) => {
    const headers = { Authorization: `Bearer ${token}` };
    const [summaryRes, scalesRes, activeRes, triageRes] = await Promise.all([
      fetch(`/api/skill/v1/me/members/${memberId}/assessment-summary`, { headers }),
      fetch('/api/skill/v1/scales', { headers }),
      fetch(`/api/skill/v1/me/members/${memberId}/active-assessment`, { headers }),
      fetch('/api/skill/v1/me/triage-session', { headers }),
    ]);

    const [summaryData, scalesData, activeData, triageData] = await Promise.all([
      summaryRes.json().catch(() => ({})),
      scalesRes.json().catch(() => ({})),
      activeRes.json().catch(() => ({})),
      triageRes.json().catch(() => ({})),
    ]);

    setAssessmentSummary(summaryData || null);
    setScaleLibrary(scalesData.scales || []);
    setAssessmentSession(activeData.session || null);
    setTriageSession(triageData.session || null);
  }, []);

  const getAssessmentView = useCallback((session: AgentAssessmentSession | null): AgentLiveView => {
    if (!session) {
      return buildWorkspaceLiveView(language === 'en' ? 'Agent workspace' : '小安实时工作台');
    }

    return buildAssessmentLiveView({
      sessionId: session.sessionId,
      scaleId: session.scaleId,
      interactionMode: session.interactionMode,
      progress: session.progress,
      currentQuestion: session.currentQuestion,
      handoff: session.handoff,
      result: session.result,
    });
  }, [language]);

  const createLiveSession = useCallback(async (token: string) => {
    const response = await fetch('/api/agent/live', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ goal: '站内实时跟随' }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Failed to create live session');
    const data = payload as LiveSessionPayload;
    setLiveExecutionId(data.execution.id);
    setLiveState(data.live);
    setLiveStreamError('');
    return data.execution.id;
  }, []);

  const appendLiveEvent = useCallback(async (input: {
    type: AgentLiveEvent['type'];
    message: string;
    view?: AgentLiveView;
    data?: Record<string, unknown>;
  }) => {
    if (!agentToken || !liveExecutionId) return;

    try {
      const response = await fetch(`/api/agent/live/${encodeURIComponent(liveExecutionId)}/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${agentToken}` },
        body: JSON.stringify(input),
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok && payload.live) {
        setLiveState(payload.live);
      }
    } catch {
      // Live follow should never break the assessment workflow.
    }
  }, [agentToken, liveExecutionId]);

  const controlLive = useCallback(async (action: 'pause' | 'takeover' | 'resume' | 'manual_complete') => {
    if (!agentToken || !liveExecutionId) return;

    try {
      const response = await fetch(`/api/agent/live/${encodeURIComponent(liveExecutionId)}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${agentToken}` },
        body: JSON.stringify({ action }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to update live control');
      setLiveState(payload.live || null);
    } catch (controlError) {
      setError(controlError instanceof Error ? controlError.message : 'Failed to update live control');
    }
  }, [agentToken, liveExecutionId]);

  const bootstrapAgent = useCallback(async (memberId?: string) => {
    setLoading(true);
    setError('');
    try {
      const config = await loadAgentConfig();
      await loadRealtimeBootstrap(memberId);
      const response = await fetch('/api/agent/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          deviceId: getSessionDeviceId(isAuthenticated),
          entrypoint: 'agent',
          memberId: memberId || activeMemberId || undefined,
          memberSnapshot,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to create agent session');

      setBootstrap(data);
      setActiveMemberId(data.member.id);
      await loadResources(data.token, data.member.id);
      await createLiveSession(data.token);
      setLatestAssistant(data.account.accountType === 'DOCTOR' ? (config?.prompts?.bootstrapDoctor || '') : (config?.prompts?.bootstrapPatient || ''));
      setLatestUser('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to bootstrap workspace');
    } finally {
      setLoading(false);
    }
  }, [activeMemberId, authHeaders, createLiveSession, isAuthenticated, loadAgentConfig, loadRealtimeBootstrap, loadResources, memberSnapshot]);

  useEffect(() => {
    void bootstrapAgent();
  }, [bootstrapAgent]);

  useEffect(() => {
    if (!agentToken || !liveExecutionId) {
      return;
    }

    const controller = new AbortController();
    let rest = '';

    async function connect() {
      try {
        const response = await fetch(`/api/agent/live/${encodeURIComponent(liveExecutionId)}/stream`, {
          headers: { Authorization: `Bearer ${agentToken}` },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          throw new Error('Live stream is unavailable');
        }

        setLiveStreamError('');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;

          const parsed = parseAgentLiveSseBuffer(rest + decoder.decode(value, { stream: true }));
          rest = parsed.rest;
          for (const message of parsed.messages) {
            if (message.event === 'agent-live' && message.data && typeof message.data === 'object') {
              setLiveState((current) => mergeLiveEvent(current, message.data as AgentLiveEvent));
            }
          }
        }
      } catch (streamError) {
        if (!controller.signal.aborted) {
          setLiveStreamError(streamError instanceof Error ? streamError.message : 'Live stream disconnected');
        }
      }
    }

    void connect();
    return () => controller.abort();
  }, [agentToken, liveExecutionId]);

  const activeHandoffSession =
    assessmentSession &&
    !assessmentSession.result &&
    assessmentSession.interactionMode === 'web_handoff' &&
    assessmentSession.handoff;

  const pullHandoffResult = useCallback(async () => {
    if (!agentToken || !assessmentSession) {
      return handoffCopy.notReady;
    }

    setBusy(true);
    setError('');

    try {
      const response = await fetch(
        `/api/skill/v1/scales/${encodeURIComponent(assessmentSession.scaleId)}/sessions/${encodeURIComponent(assessmentSession.sessionId)}/result`,
        {
          headers: { Authorization: `Bearer ${agentToken}` },
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to load assessment result');
      }

      const nextSession = payload.session as AgentAssessmentSession;
      setAssessmentSession(nextSession);
      await appendLiveEvent({
        type: 'page_focus',
        message: language === 'en' ? 'Checking the handoff result' : '正在检查 handoff 提交结果',
        view: getAssessmentView(nextSession),
      });

      if (nextSession.result && nextSession.resultDeliveryMode !== 'physician_review') {
        setLastCompletedResult(nextSession.result);
        const replyText = `${handoffCopy.resultReceived} ${nextSession.result.conclusion}`;
        setLatestAssistant(replyText);
        await appendLiveEvent({
          type: 'result',
          message: replyText,
          view: getAssessmentView(nextSession),
        });
        await fetch(`/api/agent/profile/${activeMemberId}/rebuild`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${agentToken}` },
        }).catch(() => null);
        await loadResources(agentToken, activeMemberId);
        return replyText;
      }

      if (nextSession.status === 'COMPLETED' && nextSession.resultDeliveryMode === 'physician_review') {
        setLastCompletedResult(null);
        setLatestAssistant(handoffCopy.physicianReviewSubmitted);
        await appendLiveEvent({
          type: 'result',
          message: handoffCopy.physicianReviewSubmitted,
          view: getAssessmentView(nextSession),
        });
        await fetch(`/api/agent/profile/${activeMemberId}/rebuild`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${agentToken}` },
        }).catch(() => null);
        await loadResources(agentToken, activeMemberId);
        return handoffCopy.physicianReviewSubmitted;
      }

      setLatestAssistant(handoffCopy.notReady);
      await appendLiveEvent({
        type: 'action',
        message: handoffCopy.notReady,
        view: getAssessmentView(nextSession),
      });
      return handoffCopy.notReady;
    } catch (resultError) {
      const message =
        resultError instanceof Error ? resultError.message : 'Failed to load assessment result';
      setError(message);
      return message;
    } finally {
      setBusy(false);
    }
  }, [activeMemberId, agentToken, appendLiveEvent, assessmentSession, getAssessmentView, handoffCopy.notReady, handoffCopy.physicianReviewSubmitted, handoffCopy.resultReceived, language, loadResources]);

  const interceptHandoffDone = useCallback(async (content: string) => {
    if (!activeHandoffSession || !isHandoffDoneIntent(content)) {
      return null;
    }

    setLatestUser(content);
    return pullHandoffResult();
  }, [activeHandoffSession, pullHandoffResult]);

  const startAssessmentSession = useCallback(async (scaleId: string) => {
    if (!agentToken) return;
    setBusy(true);
    setError('');
    void appendLiveEvent({
      type: 'running',
      message: language === 'en' ? `Starting ${scaleId}` : `正在启动 ${scaleId} 量表`,
      view: buildWorkspaceLiveView(language === 'en' ? 'Agent workspace' : '小安实时工作台'),
      data: { scaleId },
    });
    try {
      const response = await fetch(`/api/skill/v1/scales/${encodeURIComponent(scaleId)}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${agentToken}` },
        body: JSON.stringify({ memberId: activeMemberId, language }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to start assessment session');

      setAssessmentSession(payload.session || null);
      await appendLiveEvent({
        type: 'page_focus',
        message:
          payload.session?.interactionMode === 'web_handoff'
            ? (language === 'en' ? 'Opening the handoff form' : '已生成 handoff 填写页面')
            : (language === 'en' ? 'Opening the assessment question' : '已进入站内量表题目'),
        view: getAssessmentView(payload.session || null),
      });
      setLatestAssistant(
        payload.session?.interactionMode === 'web_handoff'
          ? handoffCopy.body
          : String(prompts.startedAssessment || '').replace('{scaleId}', scaleId)
      );
      setLastCompletedResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start assessment session');
    } finally {
      setBusy(false);
    }
  }, [activeMemberId, agentToken, appendLiveEvent, getAssessmentView, handoffCopy.body, language, prompts.startedAssessment]);

  const submitAnswer = useCallback(async (score: number) => {
    if (!agentToken || !assessmentSession?.currentQuestion) return;
    setBusy(true);
    setError('');
    void appendLiveEvent({
      type: 'action',
      message: language === 'en' ? 'Submitting the selected answer' : '正在提交当前选择',
      view: getAssessmentView(assessmentSession),
      data: {
        questionId: assessmentSession.currentQuestion.id,
        score,
      },
    });
    try {
      const response = await fetch(
        `/api/skill/v1/scales/${encodeURIComponent(assessmentSession.scaleId)}/sessions/${encodeURIComponent(assessmentSession.sessionId)}/answer`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${agentToken}` },
          body: JSON.stringify({ questionId: assessmentSession.currentQuestion.id, score }),
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to submit answer');

      const nextSession = payload.session as AgentAssessmentSession;
      setAssessmentSession(nextSession);
      await appendLiveEvent({
        type: nextSession.result ? 'result' : 'page_focus',
        message: nextSession.result
          ? (language === 'en' ? 'Assessment completed' : '量表已完成')
          : (language === 'en' ? 'Moved to the next question' : '已进入下一题'),
        view: getAssessmentView(nextSession),
      });

      if (nextSession.result && nextSession.resultDeliveryMode !== 'physician_review') {
        setLastCompletedResult(nextSession.result);
        setLatestAssistant(String(prompts.completedAssessment || '').replace('{conclusion}', nextSession.result.conclusion));
        await fetch(`/api/agent/profile/${activeMemberId}/rebuild`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${agentToken}` },
        }).catch(() => null);
        await loadResources(agentToken, activeMemberId);
      } else if (nextSession.status === 'COMPLETED' && nextSession.resultDeliveryMode === 'physician_review') {
        setLastCompletedResult(null);
        setLatestAssistant(handoffCopy.physicianReviewSubmitted);
        await fetch(`/api/agent/profile/${activeMemberId}/rebuild`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${agentToken}` },
        }).catch(() => null);
        await loadResources(agentToken, activeMemberId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit answer');
    } finally {
      setBusy(false);
    }
  }, [activeMemberId, agentToken, appendLiveEvent, assessmentSession, getAssessmentView, handoffCopy.physicianReviewSubmitted, language, loadResources, prompts.completedAssessment]);

  const cancelAssessment = useCallback(async () => {
    if (!agentToken || !assessmentSession) return;
    setBusy(true);
    void appendLiveEvent({
      type: 'action',
      message: language === 'en' ? 'Cancelling the current assessment' : '正在取消当前量表会话',
      view: getAssessmentView(assessmentSession),
    });
    try {
      const response = await fetch(
        `/api/skill/v1/scales/${encodeURIComponent(assessmentSession.scaleId)}/sessions/${encodeURIComponent(assessmentSession.sessionId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${agentToken}` },
        }
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Failed to cancel assessment session');
      setAssessmentSession(null);
      setLatestAssistant(prompts.cancelledAssessment || latestAssistant);
      await appendLiveEvent({
        type: 'result',
        message: prompts.cancelledAssessment || latestAssistant || (language === 'en' ? 'Assessment cancelled' : '量表会话已取消'),
        view: buildWorkspaceLiveView(language === 'en' ? 'Agent workspace' : '小安实时工作台'),
      });
      await loadResources(agentToken, activeMemberId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to cancel assessment session');
    } finally {
      setBusy(false);
    }
  }, [activeMemberId, agentToken, appendLiveEvent, assessmentSession, getAssessmentView, language, latestAssistant, loadResources, prompts.cancelledAssessment]);

  const planGoal = useCallback(async () => {
    if (!agentToken || !goal.trim()) return;

    const content = goal.trim();
    setGoal('');
    const interceptedReply = await interceptHandoffDone(content);
    if (interceptedReply) {
      return;
    }

    if (assessmentSession && !assessmentSession.result) {
      setLatestUser(content);
      setLatestAssistant(prompts.activeAssessmentGuard || latestAssistant);
      return;
    }

    setLatestUser(content);
    setBusy(true);
    setError('');
    void appendLiveEvent({
      type: 'running',
      message: language === 'en' ? 'Understanding the user goal' : '正在理解你的目标',
      view: buildWorkspaceLiveView(language === 'en' ? 'Agent workspace' : '小安实时工作台'),
      data: { transcript: content },
    });

    try {
      if (bootstrap?.account.accountType === 'DOCTOR') {
        setLatestAssistant(prompts.doctorUnknownGoal || latestAssistant);
        return;
      }

      const currentContext: TriageContext = {
        state:
          triageSession?.status === 'PAUSED'
            ? 'paused'
            : triageSession?.status === 'CONSENT'
              ? 'consent'
              : 'triage',
        symptoms: triageSession?.symptoms || [],
        conversationHistory: triageSession?.conversationHistory || [],
        recommendedScale: triageSession?.recommendedScale || undefined,
        consentGiven: Boolean(triageSession?.recommendedScale),
        language,
        userProfile: {
          childName: profile.nickname,
          childAge: profile.ageMonths,
          relation: profile.relation,
          recentConcerns: profile.fears,
        },
      };

      const streamed = await consumePlatformAgentChatStream({
        agentToken,
        language,
        triageContext: currentContext,
        content,
        onAssistantDelta: (assistantText) => {
          setLatestAssistant(assistantText);
        },
      });

      const triagePatch = streamed.action?.triageSessionPatch || null;
      const replyText = streamed.replyText || prompts.bootstrapPatient || '';
      const scaleId =
        typeof streamed.action?.actionCard?.scaleId === 'string'
          ? streamed.action.actionCard.scaleId
          : typeof triagePatch?.recommendedScale === 'string'
            ? triagePatch.recommendedScale
            : undefined;

      setLatestAssistant(replyText);
      await appendLiveEvent({
        type: streamed.action?.agentAction === 'start_scale' ? 'action' : 'result',
        message: replyText,
        view: buildWorkspaceLiveView(language === 'en' ? 'Agent workspace' : '小安实时工作台'),
        data: {
          action: streamed.action?.agentAction,
          scaleId,
          backend: streamed.action?.backend || streamed.meta?.backend,
          fallback: streamed.action?.fallback ?? streamed.meta?.fallback,
        },
      });

      if (triagePatch) {
        const persistResponse = await fetch('/api/skill/v1/me/triage-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${agentToken}` },
          body: JSON.stringify({
            sessionId: triageSession?.id,
            status: triagePatch.status,
            symptoms: triagePatch.symptoms,
            conversationHistory: triagePatch.conversationHistory,
            recommendedScale: triagePatch.recommendedScale,
          }),
        });
        const persistPayload = await persistResponse.json().catch(() => ({}));
        if (persistResponse.ok) {
          setTriageSession(persistPayload.session || null);
        }
      }

      if (streamed.action?.agentAction === 'start_scale' && scaleId) {
        if (triageSession?.id) {
          await fetch(`/api/skill/v1/me/triage-session?sessionId=${encodeURIComponent(triageSession.id)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${agentToken}` },
          }).catch(() => null);
          setTriageSession(null);
        }
        await startAssessmentSession(scaleId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create plan');
    } finally {
      setBusy(false);
    }
  }, [agentToken, appendLiveEvent, assessmentSession, bootstrap?.account.accountType, goal, interceptHandoffDone, language, latestAssistant, profile.ageMonths, profile.fears, profile.nickname, profile.relation, prompts.activeAssessmentGuard, prompts.bootstrapPatient, prompts.doctorUnknownGoal, startAssessmentSession, triageSession]);

  const handleVoiceStateChange = useCallback((state: { assistantText?: string; transcript?: string; error?: string | null }) => {
    if (state.assistantText) setLatestAssistant(state.assistantText);
    if (state.transcript) setLatestUser(state.transcript);
    if (state.error) {
      setError(state.error);
      if (mobile) {
        setComposerOpen(true);
      }
    }
  }, [mobile]);

  const currentScaleTitle = useMemo(() => {
    const matched = scaleLibrary.find(
      (scale) => scale.id.toUpperCase() === assessmentSession?.scaleId?.toUpperCase()
    );
    return matched ? formatScaleTitle(matched.title, language) : assessmentSession?.scaleId || '';
  }, [assessmentSession?.scaleId, language, scaleLibrary]);

  const liveStatusLabel = useMemo(() => {
    switch (liveState?.status) {
      case 'running':
      case 'planning':
        return copy.liveStatusRunning;
      case 'paused':
        return copy.liveStatusPaused;
      case 'takeover':
        return copy.liveStatusTakeover;
      case 'completed':
        return copy.liveStatusCompleted;
      case 'failed':
        return copy.liveStatusFailed;
      default:
        return copy.liveStatusIdle;
    }
  }, [copy.liveStatusCompleted, copy.liveStatusFailed, copy.liveStatusIdle, copy.liveStatusPaused, copy.liveStatusRunning, copy.liveStatusTakeover, liveState?.status]);

  const isAssessmentActive = Boolean(assessmentSession && !assessmentSession.result);
  const companionStatus = isAssessmentActive
    ? copy.companionFilling
    : busy
      ? copy.companionThinking
      : copy.companionReady;
  const assistantMessage = String(latestAssistant || prompts.bootstrapPatient || copy.desktopDefaultAssistant);
  const currentMemberName = bootstrap?.member.nickname || profile.nickname || (language === 'en' ? 'Current child' : '当前成员');
  const recentLiveEvents = (liveState?.events || []).slice(-5).reverse();

  const renderAssessmentPanel = () => (
    assessmentSession && !assessmentSession.result ? (
      <div id="agent-assessment-session" className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">
              {copy.currentScale}
            </p>
            <h2 className="mt-2 text-xl font-bold text-foreground">
              {currentScaleTitle || assessmentSession.scaleId}
            </h2>
          </div>
          <button onClick={() => void cancelAssessment()} disabled={busy} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50">
            <Square className="h-3.5 w-3.5" />
            <span>{copy.stopAssessment}</span>
          </button>
        </div>

        <div className="mb-4 rounded-md bg-muted/50 px-4 py-3 text-sm text-foreground">
          <div className="flex items-center justify-between gap-3">
            <span>
              {assessmentSession.interactionMode === 'web_handoff'
                ? assessmentSession.progress.answered
                : assessmentSession.progress.answered + 1}{' '}
              / {assessmentSession.progress.total}
            </span>
            <span className="font-semibold text-foreground">{Math.round(assessmentSession.progress.ratio * 100)}%</span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${assessmentSession.progress.ratio * 100}%` }} />
          </div>
        </div>

        {assessmentSession.interactionMode === 'web_handoff' && assessmentSession.handoff ? (
          <div id="agent-handoff-link" className="space-y-4 rounded-md border-2 border-primary/30 bg-primary/10 p-3">
            <div className="rounded-md border border-primary/20 bg-primary/10 px-4 py-4">
              <div className="text-sm font-semibold text-primary">{handoffCopy.pending}</div>
              <p className="mt-2 text-sm leading-7 text-primary">{handoffCopy.pendingBody}</p>
            </div>
            <InviteQrCard
              url={assessmentSession.handoff.url}
              title={handoffCopy.title}
              subtitle={handoffCopy.body}
            />
            <a
              href={assessmentSession.handoff.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-primary"
            >
              <span>{handoffCopy.open}</span>
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        ) : assessmentSession.currentQuestion ? (
          <div id={`agent-question-${assessmentSession.currentQuestion.id}`} className="space-y-3 rounded-md border-2 border-primary/30 bg-primary/5 p-3">
            <div className="mb-4 text-lg font-semibold leading-8 text-foreground">
              {assessmentSession.currentQuestion.text}
            </div>
            {assessmentSession.currentQuestion.imageUrl ? (
              <div className="overflow-hidden rounded-md border border-border bg-card">
                <img
                  src={assessmentSession.currentQuestion.imageUrl}
                  alt={assessmentSession.currentQuestion.imageAlt || assessmentSession.currentQuestion.text}
                  className="w-full object-contain"
                />
              </div>
            ) : null}
            {assessmentSession.currentQuestion.options.map((option) => (
              <QuestionnaireOptionButton
                key={`${assessmentSession.currentQuestion?.id}-${option.score}`}
                label={option.label}
                description={option.description}
                selected={false}
                selectedLabel={language === 'en' ? 'Selected' : '当前选择'}
                emphasis="strong"
                showSelector
                disabled={busy}
                onClick={() => void submitAnswer(option.score)}
              />
            ))}
            {mobile ? (
              <div
                className={`sticky bottom-0 -mx-3 mt-4 grid gap-2 border-t border-primary/30 bg-card/95 px-3 pt-3 backdrop-blur ${
                  onRequestExpand || onRequestCollapse ? 'grid-cols-2 pb-[calc(env(safe-area-inset-bottom)+8px)]' : 'grid-cols-1 pb-[calc(env(safe-area-inset-bottom)+8px)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setKnowledgeOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/15"
                >
                  <GraduationCap className="h-4 w-4" />
                  <span>{copy.knowledgeOpen}</span>
                </button>
                {onRequestExpand ? (
                  <button
                    type="button"
                    onClick={onRequestExpand}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted"
                  >
                    <Maximize2 className="h-4 w-4" />
                    <span>{copy.assistantExpand}</span>
                  </button>
                ) : null}
                {onRequestCollapse ? (
                  <button
                    type="button"
                    onClick={onRequestCollapse}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground hover:bg-muted"
                  >
                    <Minimize2 className="h-4 w-4" />
                    <span>{copy.assistantCollapse}</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    ) : null
  );

  const renderWorkspacePanel = () => (
    <div id="agent-live-workspace" className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <MessageCircleHeart className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase text-muted-foreground">{copy.latestReply}</div>
            <div className="mt-2 text-lg font-semibold leading-8 text-foreground">
              {latestAssistant || prompts.bootstrapPatient}
            </div>
            {latestUser ? (
              <div className="mt-3 rounded-md bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                {copy.youSaid}：{latestUser}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <TriageVoiceRecorder
          onStartScale={(scaleId) => void startAssessmentSession(scaleId)}
          onInterceptMessage={(message) => interceptHandoffDone(message)}
          language={language}
          mode="dock"
          layout="minimal"
          skillTokenOverride={agentToken}
          onStateChange={handleVoiceStateChange}
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
        <button onClick={() => setComposerOpen((prev) => !prev)} className="rounded-md border border-border bg-muted/50 px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted">
          {composerOpen ? copy.hideTyping : copy.typingEntry}
        </button>
        {composerOpen ? (
          <div className="mt-4 space-y-4">
            <textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder={language === 'en' ? 'For example: my child avoids eye contact and does not speak much.' : '比如：孩子不爱看人，也不太爱说话。'}
              className="min-h-[110px] w-full rounded-md border border-border bg-card px-4 py-4 text-base text-foreground outline-none focus:border-primary/50"
            />
            <button disabled={busy || !goal.trim() || !agentToken} onClick={() => void planGoal()} className="inline-flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background hover:bg-foreground/80 disabled:bg-muted">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              <span>{copy.send}</span>
            </button>
          </div>
        ) : null}
      </div>

      {lastCompletedResult ? (
        <div id="agent-assessment-result" className="rounded-lg border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="text-xs font-semibold uppercase text-emerald-600">
            {copy.completed}
          </div>
          <div className="mt-3 text-xl font-bold text-foreground">{lastCompletedResult.conclusion}</div>
          <div className="mt-2 text-sm text-emerald-600">{copy.scoreLabel}：{lastCompletedResult.totalScore}</div>
        </div>
      ) : null}
    </div>
  );

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-muted/50 ${mobileEmbedded ? 'h-full min-h-0' : 'min-h-screen'}`}>
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">{copy.preparing}</p>
        </div>
      </div>
    );
  }

  if (bootstrap?.account.accountType === 'DOCTOR') {
    return (
      <div className={`${mobileEmbedded ? 'h-full min-h-0 overflow-y-auto bg-muted/50' : 'min-h-screen bg-muted/50'}`}>
        <div className={`${mobileEmbedded ? 'px-4 py-6' : `mx-auto px-4 py-10 ${mobile ? 'max-w-lg' : 'max-w-3xl'}`}`}>
          <div className="rounded-[2rem] border border-border bg-card p-8 text-center shadow-sm">
            <Bot className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-4 text-2xl font-bold text-foreground">{copy.doctor}</h1>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <button onClick={() => router.push('/doctor')} className="rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background hover:bg-foreground/80">
                {copy.doctorPrimary}
              </button>
              <button onClick={() => router.push('/doctor/invites')} className="rounded-full border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground hover:bg-muted">
                {copy.doctorSecondary}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!mobile && !mobileEmbedded) {
    return (
      <div className="agent-desktop-shell min-h-screen bg-[#f4f7f5] text-slate-900">
        <div className="flex min-h-screen">
          <aside className="agent-companion-panel sticky top-0 flex h-screen w-[400px] shrink-0 flex-col border-r border-emerald-100 bg-white shadow-[8px_0_30px_rgba(31,92,76,0.06)]">
            <header className="shrink-0 border-b border-emerald-50 bg-white px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#2f7d68] text-base font-bold text-white shadow-[0_14px_30px_rgba(47,125,104,0.22)]">
                    安
                  </div>
                  <div className="min-w-0">
                    <h1 className="truncate text-base font-bold text-slate-900">{copy.companionTitle}</h1>
                    <p className="mt-1 flex items-center gap-2 text-xs font-medium text-[#2f7d68]">
                      <span className="h-2 w-2 rounded-full bg-[#2f7d68]" />
                      <span>{companionStatus}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => router.push('/')}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
                >
                  <Home className="h-3.5 w-3.5" />
                  <span>{copy.backHome}</span>
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto bg-[#f8fbf9] px-5 py-5">
              <div className="space-y-5">
                <div className="flex gap-3">
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2f7d68] text-xs font-bold text-white">
                    安
                  </div>
                  <div className="max-w-[92%] rounded-3xl rounded-tl-md border border-emerald-50 bg-white px-4 py-3 text-sm leading-7 text-slate-700 shadow-sm">
                    {assistantMessage}
                  </div>
                </div>

                {latestUser ? (
                  <div className="flex justify-end gap-3">
                    <div className="max-w-[92%] rounded-3xl rounded-tr-md bg-[#2f7d68] px-4 py-3 text-sm leading-7 text-white shadow-sm">
                      {latestUser}
                    </div>
                  </div>
                ) : null}

                {activeHandoffSession ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-7 text-amber-900">
                    {handoffCopy.pendingBody}
                  </div>
                ) : null}
              </div>
            </div>

            <footer className="shrink-0 border-t border-emerald-50 bg-white px-4 py-4">
              <div className="mb-3 rounded-3xl border border-emerald-100 bg-[#f6faf8] px-4 py-4">
                <TriageVoiceRecorder
                  onStartScale={(scaleId) => void startAssessmentSession(scaleId)}
                  onInterceptMessage={(message) => interceptHandoffDone(message)}
                  language={language}
                  mode="dock"
                  layout="minimal"
                  skillTokenOverride={agentToken}
                  onStateChange={handleVoiceStateChange}
                />
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-2 focus-within:border-[#2f7d68] focus-within:ring-4 focus-within:ring-emerald-50">
                <textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      void planGoal();
                    }
                  }}
                  rows={2}
                  placeholder={copy.desktopInputPlaceholder}
                  className="max-h-32 min-h-[56px] w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400"
                />
                <div className="flex items-center justify-between gap-3 px-1 pb-1">
                  <span className="text-xs text-slate-500">{copy.unsureHint}</span>
                  <button
                    type="button"
                    disabled={busy || !goal.trim() || !agentToken}
                    onClick={() => void planGoal()}
                    className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-[#2f7d68] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#245f50] disabled:cursor-not-allowed disabled:bg-slate-300"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    <span>{copy.send}</span>
                  </button>
                </div>
              </div>
            </footer>
          </aside>

          <main className="agent-task-canvas flex min-w-0 flex-1 flex-col">
            <header className="shrink-0 border-b border-emerald-100 bg-white/75 px-8 py-4 backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm">
                    {copy.currentProfile}：{currentMemberName}
                  </span>
                  {currentScaleTitle ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-[#2f7d68]">
                      {currentScaleTitle}
                    </span>
                  ) : null}
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-500">
                    {liveStatusLabel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setKnowledgeOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-[#243b35] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#2f7d68]"
                >
                  <GraduationCap className="h-4 w-4" />
                  <span>{copy.explainQuestion}</span>
                </button>
              </div>
            </header>

            {error ? (
              <div className="mx-8 mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            {realtimeBootstrap ? (
              <div className="mx-8 mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-sm text-[#245f50]">
                Hermes 实时层已就绪，可用工具数：{realtimeBootstrap.tools.length}。
              </div>
            ) : null}

            <div className="flex-1 overflow-y-auto px-8 py-7">
              <div className="mx-auto grid max-w-6xl gap-5">
                {assessmentSession && !assessmentSession.result ? (
                  <section id="agent-assessment-session" className="rounded-[1.75rem] border border-slate-100 bg-white p-8 shadow-[0_18px_48px_rgba(31,92,76,0.08)]">
                    <div className="mb-7 flex items-start justify-between gap-5">
                      <div className="min-w-0">
                        <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#2f7d68]">
                          {copy.taskCanvas}
                        </div>
                        <h2 className="mt-3 text-3xl font-bold leading-tight text-slate-950">
                          {currentScaleTitle || assessmentSession.scaleId}
                        </h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => void cancelAssessment()}
                        disabled={busy}
                        className="inline-flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                      >
                        <Square className="h-4 w-4" />
                        <span>{copy.stopAssessment}</span>
                      </button>
                    </div>

                    <div className="mb-8 rounded-2xl bg-[#f4f8f6] px-4 py-3">
                      <div className="flex items-center justify-between text-sm font-semibold text-slate-700">
                        <span>{copy.fillingProgress}</span>
                        <span>
                          {assessmentSession.interactionMode === 'web_handoff'
                            ? assessmentSession.progress.answered
                            : assessmentSession.progress.answered + 1}{' '}
                          / {assessmentSession.progress.total} · {Math.round(assessmentSession.progress.ratio * 100)}%
                        </span>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-emerald-100">
                        <div
                          className="h-full rounded-full bg-[#2f7d68] transition-all duration-500"
                          style={{ width: `${assessmentSession.progress.ratio * 100}%` }}
                        />
                      </div>
                    </div>

                    {assessmentSession.interactionMode === 'web_handoff' && assessmentSession.handoff ? (
                      <div id="agent-handoff-link" className="space-y-5 rounded-3xl border border-emerald-100 bg-[#f6faf8] p-5">
                        <div>
                          <div className="text-base font-bold text-[#245f50]">{handoffCopy.pending}</div>
                          <p className="mt-2 text-sm leading-7 text-slate-600">{handoffCopy.pendingBody}</p>
                        </div>
                        <InviteQrCard
                          url={assessmentSession.handoff.url}
                          title={handoffCopy.title}
                          subtitle={handoffCopy.body}
                        />
                        <div className="flex flex-wrap gap-3">
                          <a
                            href={assessmentSession.handoff.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-full bg-[#2f7d68] px-5 py-3 text-sm font-semibold text-white hover:bg-[#245f50]"
                          >
                            <span>{handoffCopy.open}</span>
                            <ArrowRight className="h-4 w-4" />
                          </a>
                          <button
                            type="button"
                            onClick={() => void pullHandoffResult()}
                            disabled={busy}
                            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-5 py-3 text-sm font-semibold text-[#245f50] hover:bg-emerald-50 disabled:opacity-50"
                          >
                            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                            <span>{copy.manualDone}</span>
                          </button>
                        </div>
                      </div>
                    ) : assessmentSession.currentQuestion ? (
                      <div id={`agent-question-${assessmentSession.currentQuestion.id}`} className="space-y-6">
                        <div className="rounded-3xl border border-slate-100 bg-[#fbfdfc] p-6">
                          <div className="text-sm font-semibold text-[#2f7d68]">
                            {language === 'en' ? 'Current question' : '当前题目'}
                          </div>
                          <div className="mt-3 text-2xl font-bold leading-10 text-slate-950">
                            {assessmentSession.currentQuestion.text}
                          </div>
                        </div>

                        {assessmentSession.currentQuestion.imageUrl ? (
                          <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={assessmentSession.currentQuestion.imageUrl}
                              alt={assessmentSession.currentQuestion.imageAlt || assessmentSession.currentQuestion.text}
                              className="w-full object-contain"
                            />
                          </div>
                        ) : null}

                        <div className="space-y-3">
                          {assessmentSession.currentQuestion.options.map((option) => (
                            <button
                              key={`${assessmentSession.currentQuestion?.id}-${option.score}`}
                              type="button"
                              onClick={() => void submitAnswer(option.score)}
                              disabled={busy}
                              className="group w-full rounded-3xl border-2 border-slate-100 bg-white px-5 py-4 text-left transition-all hover:border-[#2f7d68] hover:bg-[#f8fcfa] hover:shadow-[0_16px_32px_rgba(31,92,76,0.08)] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <div className="text-lg font-bold leading-7 text-slate-900 group-hover:text-[#245f50]">
                                {option.label}
                              </div>
                              {option.description ? (
                                <div className="mt-2 text-sm leading-7 text-slate-500">
                                  {option.description}
                                </div>
                              ) : null}
                            </button>
                          ))}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5">
                          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                            {copy.unsureHint}
                          </div>
                          <button
                            type="button"
                            onClick={() => setKnowledgeOpen(true)}
                            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-[#245f50] hover:bg-emerald-100"
                          >
                            <GraduationCap className="h-4 w-4" />
                            <span>{copy.explainQuestion}</span>
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </section>
                ) : (
                  <section id="agent-live-workspace" className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="rounded-[1.75rem] border border-slate-100 bg-white p-8 shadow-[0_18px_48px_rgba(31,92,76,0.08)]">
                      <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#2f7d68]">
                        {copy.taskCanvas}
                      </div>
                      <h2 className="mt-3 text-3xl font-bold text-slate-950">{copy.desktopIdleTitle}</h2>
                      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{copy.desktopIdleBody}</p>

                      <div className="mt-8 grid gap-3 sm:grid-cols-2">
                        {scaleLibrary.slice(0, 6).map((scale) => (
                          <button
                            key={scale.id}
                            type="button"
                            onClick={() => void startAssessmentSession(scale.id)}
                            disabled={busy}
                            className="flex min-h-[72px] items-center justify-between rounded-3xl border border-slate-100 bg-[#f8fbf9] px-4 py-3 text-left transition-colors hover:border-emerald-200 hover:bg-white disabled:opacity-50"
                          >
                            <span className="pr-3 text-sm font-bold leading-6 text-slate-800">{formatScaleTitle(scale.title, language)}</span>
                            <PlayCircle className="h-5 w-5 shrink-0 text-[#2f7d68]" />
                          </button>
                        ))}
                      </div>

                      {lastCompletedResult ? (
                        <div id="agent-assessment-result" className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4">
                          <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#2f7d68]">{copy.completed}</div>
                          <div className="mt-3 text-xl font-bold text-slate-950">{lastCompletedResult.conclusion}</div>
                          <div className="mt-2 text-sm text-[#2f7d68]">{copy.scoreLabel}：{lastCompletedResult.totalScore}</div>
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-[0_18px_48px_rgba(31,92,76,0.06)]">
                      <div className="mb-4 text-base font-bold text-slate-900">{copy.results}</div>
                      {assessmentSummary?.items?.length ? (
                        <div className="space-y-3">
                          {assessmentSummary.items.slice(0, 4).map((item) => (
                            <div key={item.id} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                              <div className="text-sm font-bold text-slate-900">{item.scaleId}</div>
                              <div className="mt-1 text-xs leading-5 text-slate-500">{item.conclusion}</div>
                              <div className="mt-2 text-xs text-slate-500">{formatDate(item.createdAt, language)} · {copy.scoreLabel}：{item.totalScore}</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                          {copy.noResults}
                        </div>
                      )}
                    </div>
                  </section>
                )}

                <details className="agent-support-drawer rounded-[1.5rem] border border-emerald-100 bg-white px-5 py-4 shadow-[0_14px_36px_rgba(31,92,76,0.05)]">
                  <summary className="cursor-pointer list-none text-sm font-bold text-slate-900">
                    {copy.supportDrawerTitle}
                  </summary>
                  <div className="mt-4 grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
                    <div>
                      <div className="grid grid-cols-2 gap-2">
                        <button type="button" onClick={() => void controlLive('pause')} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                          <Pause className="h-4 w-4" />
                          <span>{copy.pauseFilling}</span>
                        </button>
                        <button type="button" onClick={() => void controlLive('takeover')} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#243b35] px-3 py-2 text-sm font-semibold text-white hover:bg-[#2f7d68]">
                          <MousePointer2 className="h-4 w-4" />
                          <span>{copy.takeoverFilling}</span>
                        </button>
                        <button type="button" onClick={() => void controlLive('resume')} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                          <PlayCircle className="h-4 w-4" />
                          <span>{copy.resumeFilling}</span>
                        </button>
                        <button type="button" onClick={() => void controlLive('manual_complete')} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                          <Square className="h-4 w-4" />
                          <span>{copy.manualDone}</span>
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">{copy.latestActivity}</div>
                      {liveStreamError ? (
                        <div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                          {liveStreamError}
                        </div>
                      ) : null}
                      <div className="grid gap-2">
                        {recentLiveEvents.length ? (
                          recentLiveEvents.map((event) => (
                            <div key={event.seq} className="rounded-2xl border border-slate-100 bg-slate-50 px-3 py-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-bold uppercase text-[#2f7d68]">{event.type}</span>
                                <span className="text-[11px] text-slate-400">#{event.seq}</span>
                              </div>
                              <div className="mt-1 text-sm leading-6 text-slate-700">{event.message}</div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                            {copy.noActivity}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            </div>
          </main>
        </div>

        {renderKnowledgePanel ? (
          <PlatformKnowledgePanel
            isOpen={knowledgeOpen}
            onClose={() => setKnowledgeOpen(false)}
            authHeaders={authHeaders}
            deviceId={currentDeviceId}
            memberId={activeMemberId || bootstrap?.member.id || profile.id}
            memberSnapshot={memberSnapshot}
            language={language}
            mobile={mobile}
            scaleId={assessmentSession?.scaleId || ''}
            questionId={assessmentSession?.currentQuestion?.id || null}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className={`${mobileEmbedded ? 'h-full min-h-0 bg-background' : 'min-h-screen bg-background'}`}>
      <div
        className={
          mobileEmbedded
            ? 'h-full min-h-0 overflow-y-auto px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+18px)]'
            : `mx-auto px-4 ${mobile ? 'max-w-lg py-4 pb-[calc(env(safe-area-inset-bottom)+28px)]' : 'max-w-[1500px] py-6 sm:py-8'}`
        }
      >
        {showWorkspaceHeader ? (
          <div className={`mb-6 ${mobile ? 'flex items-center justify-between gap-3 rounded-[1.75rem] border border-border bg-card/85 p-4 shadow-sm backdrop-blur' : 'flex items-start justify-between gap-4'}`}>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h1 className={mobile ? 'text-lg font-bold text-foreground' : 'text-2xl font-bold text-foreground'}>{copy.title}</h1>
                <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
              </div>
            </div>
            <button onClick={() => router.push('/')} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted">
              <Home className="h-4 w-4" />
              <span className={mobile ? 'hidden sm:inline' : ''}>{copy.backHome}</span>
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        ) : null}

        {realtimeBootstrap ? (
          <div className="mb-5 rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-foreground shadow-sm">
            Hermes 实时层已就绪，当前仍保留 `voice-intent` 与现有语音链路作为兜底。已开放工具数：{realtimeBootstrap.tools.length}。
          </div>
        ) : null}

        <div className={`mb-5 rounded-[2rem] border border-border bg-card p-4 shadow-sm ${mobile ? 'space-y-3' : 'flex items-center justify-between'}`}>
          <span className="rounded-full bg-muted px-3 py-1 text-sm font-medium text-foreground">
            {copy.currentProfile}：{bootstrap?.member.nickname || profile.nickname}
          </span>
          <div className={`flex items-center gap-2 ${mobile ? 'justify-between' : ''}`}>
            {(bootstrap?.members || []).length > 1 ? (
              <select
                value={activeMemberId}
                onChange={(e) => void bootstrapAgent(e.target.value)}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground outline-none"
              >
                {(bootstrap?.members || []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nickname}
                  </option>
                ))}
              </select>
            ) : null}
            <button onClick={() => void bootstrapAgent(activeMemberId)} className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-muted">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className={`mb-5 rounded-[2rem] border border-accent/30 bg-accent/10 p-5 shadow-sm ${mobile ? 'space-y-4' : 'flex items-center justify-between gap-6'}`}>
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-accent">
              <GraduationCap className="h-3.5 w-3.5" />
              <span>{copy.knowledgeTitle}</span>
            </div>
            <div className="mt-3 text-sm leading-7 text-foreground">{copy.knowledgeBody}</div>
          </div>
          <button
            onClick={() => setKnowledgeOpen(true)}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-background hover:bg-accent"
          >
            <GraduationCap className="h-4 w-4" />
            <span>{copy.knowledgeOpen}</span>
          </button>
        </div>

        <div className="space-y-4">
          <aside className="rounded-lg border border-border bg-card p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                <Eye className="h-4 w-4 text-primary" />
                <span>{copy.liveTitle}</span>
              </div>
              <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">{liveStatusLabel}</span>
            </div>
            {liveStreamError ? (
              <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-600">
                {liveStreamError}
              </div>
            ) : null}
            <div className="max-h-[620px] space-y-2 overflow-y-auto pr-1">
              {liveState?.events?.length ? (
                liveState.events.slice(-30).map((event) => (
                  <div key={event.seq} className="rounded-md border border-border bg-muted/50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold uppercase text-primary">{event.type}</span>
                      <span className="text-[11px] text-muted-foreground">#{event.seq}</span>
                    </div>
                    <div className="mt-1 text-sm leading-6 text-foreground">{event.message}</div>
                    {event.view?.pendingAction ? (
                      <div className="mt-1 text-xs text-muted-foreground">{event.view.pendingAction}</div>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-md border border-dashed border-border bg-muted/50 px-3 py-8 text-center text-sm text-muted-foreground">
                  {copy.liveEmpty}
                </div>
              )}
            </div>
          </aside>

          <main className="min-w-0 rounded-lg border border-border bg-card/70 p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">{copy.liveMirror}</div>
                <div className="mt-1 text-xs text-muted-foreground">{liveState?.currentView?.title || copy.liveStatusIdle}</div>
              </div>
              {liveState?.currentView?.href ? (
                <a href={liveState.currentView.href} target={liveState.currentView.href.startsWith('/agent') ? undefined : '_blank'} rel="noreferrer" className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted">
                  <span>{copy.liveOpen}</span>
                  <ArrowRight className="h-4 w-4" />
                </a>
              ) : null}
            </div>
            {assessmentSession && !assessmentSession.result ? renderAssessmentPanel() : renderWorkspacePanel()}
          </main>

          <aside className="space-y-4">
            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="mb-3 text-sm font-semibold text-foreground">{copy.liveControl}</div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => void controlLive('pause')} className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted">
                  <Pause className="h-4 w-4" />
                  <span>{copy.livePause}</span>
                </button>
                <button onClick={() => void controlLive('takeover')} className="inline-flex items-center justify-center gap-2 rounded-md bg-foreground px-3 py-2 text-sm font-semibold text-background hover:bg-primary/90">
                  <MousePointer2 className="h-4 w-4" />
                  <span>{copy.liveTakeover}</span>
                </button>
                <button onClick={() => void controlLive('resume')} className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted">
                  <PlayCircle className="h-4 w-4" />
                  <span>{copy.liveResume}</span>
                </button>
                <button onClick={() => void controlLive('manual_complete')} className="inline-flex items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground hover:bg-muted">
                  <Square className="h-4 w-4" />
                  <span>{copy.liveManualDone}</span>
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="mb-4 text-sm font-semibold text-foreground">{copy.quickStart}</div>
              <div className="space-y-2">
                {scaleLibrary.slice(0, 4).map((scale) => (
                  <button key={scale.id} onClick={() => void startAssessmentSession(scale.id)} disabled={busy} className="flex w-full items-center justify-between rounded-md border border-border bg-muted/50 px-3 py-2 text-left text-sm font-medium text-foreground hover:border-primary/40 hover:bg-card disabled:opacity-50">
                    <span className="pr-3">{formatScaleTitle(scale.title, language)}</span>
                    <PlayCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="mb-4 text-sm font-semibold text-foreground">{copy.results}</div>
              {assessmentSummary?.items?.length ? (
                <div className="space-y-2">
                  {assessmentSummary.items.slice(0, 3).map((item) => (
                    <div key={item.id} className="rounded-md border border-border bg-muted/50 px-3 py-2">
                      <div className="text-sm font-semibold text-foreground">{item.scaleId}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.conclusion}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{formatDate(item.createdAt, language)} · {copy.scoreLabel}：{item.totalScore}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border bg-muted/50 px-3 py-6 text-center text-sm text-muted-foreground">
                  {copy.noResults}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
      {renderKnowledgePanel ? (
        <PlatformKnowledgePanel
          isOpen={knowledgeOpen}
          onClose={() => setKnowledgeOpen(false)}
          authHeaders={authHeaders}
          deviceId={currentDeviceId}
          memberId={activeMemberId || bootstrap?.member.id || profile.id}
          memberSnapshot={memberSnapshot}
          language={language}
          mobile={mobile}
          scaleId={assessmentSession?.scaleId || ''}
          questionId={assessmentSession?.currentQuestion?.id || null}
        />
      ) : null}
    </div>
  );
}
