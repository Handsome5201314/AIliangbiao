'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Loader2,
  Mic,
  MicOff,
  Pause,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Volume2,
  X,
} from 'lucide-react';

import { useAuthSession } from '@/contexts/AuthSessionContext';
import { useProfile } from '@/contexts/ProfileContext';
import { useVoiceSession } from '@/lib/services/useVoiceSession';
import { generateUUID } from '@/lib/utils/uuid';
import type { ScaleQuestion, VoiceSessionMode } from '@/lib/schemas/core/types';

type BotPublicInfo = {
  id: string;
  assistantName: string;
  avatarUrl: string;
  welcomeMessage: string;
  publicSlug: string;
  doctor: {
    id: string;
    realName: string;
    hospitalName: string;
    departmentName: string;
    title: string;
  };
};

type AssessmentSession = {
  sessionId: string;
  scaleId: string;
  status: string;
  interactionMode?: string;
  resultDeliveryMode?: string;
  resultVisibleToRespondent?: boolean;
  progress: { ratio: number; answered: number; total: number };
  currentQuestion: {
    id: number;
    text: string;
    clinical_intent: string;
    colloquial: string;
    fallback_examples: string[];
    riskLevel?: ScaleQuestion['riskLevel'];
    options: Array<{ label: string; score: number; description?: string }>;
    imageUrl?: string;
    imageAlt?: string;
  } | null;
  result: {
    totalScore: number;
    conclusion: string;
    details?: {
      description?: string;
      [key: string]: unknown;
    };
  } | null;
};

type ChatReply = {
  text: string;
  actionCard: {
    type: 'assessment';
    scaleId: string;
    title: string;
    body: string;
    reason: string;
  } | null;
};

type DoctorBotRealtimeBootstrap = {
  runtime: {
    provider: 'internal';
    mode: 'sdk';
    fallbacks: {
      doctorBot: boolean;
    };
  };
  doctorBot: {
    slug: string;
    fallback: {
      enabled: boolean;
      provider: string | null;
    };
    enabledScales: Array<{ id: string }>;
  } | null;
};

type ChatMessageErrorPayload = {
  error?: string;
  code?: string;
  data?: {
    session?: AssessmentSession;
  };
  reply?: ChatReply;
};

type ChatMessage =
  | {
      id: string;
      role: 'assistant' | 'user';
      type: 'text';
      content: string;
    }
  | {
      id: string;
      role: 'assistant';
      type: 'action';
      action: {
        scaleId: string;
        title: string;
        body: string;
        reason: string;
      };
    };

const STORAGE_KEY_PREFIX = 'doctor-bot-chat';

function buildStorageKey(slug: string, visitorSessionId: string) {
  return `${STORAGE_KEY_PREFIX}:${slug}:${visitorSessionId}`;
}

function getOrCreateVisitorSessionId(slug: string) {
  const key = `${STORAGE_KEY_PREFIX}:${slug}:visitor`;
  const existing = localStorage.getItem(key);
  if (existing) {
    return existing;
  }

  const next = generateUUID();
  localStorage.setItem(key, next);
  return next;
}

function inferRecorderMimeType() {
  if (typeof MediaRecorder === 'undefined') {
    return '';
  }

  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) || '';
}

async function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function speakText(text: string, language: 'zh' | 'en') {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = language === 'en' ? 'en-US' : 'zh-CN';
  utterance.rate = 1;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
}

function createAssistantFallbackAfterAssessment(
  session: AssessmentSession,
  language: 'zh' | 'en'
) {
  if (!session.result) {
    return language === 'en' ? 'I received the completed assessment.' : '我收到这份量表结果了。';
  }

  if (session.resultDeliveryMode === 'physician_review') {
    return language === 'en'
      ? 'The assessment has been submitted. Please wait for the doctor to review the result.'
      : '量表已经提交，请等待医生审核结果。';
  }

  return language === 'en'
    ? `I received the result. The conclusion is: ${session.result.conclusion}`
    : `我收到结果了，当前结论是：${session.result.conclusion}`;
}

function resolveAssessmentVoiceMode(interactionMode?: string): VoiceSessionMode {
  if (
    interactionMode === 'full_voice' ||
    interactionMode === 'voice_guided' ||
    interactionMode === 'call_mode'
  ) {
    return interactionMode;
  }

  return 'voice_guided';
}

function persistMessages(slug: string, visitorSessionId: string, messages: ChatMessage[]) {
  localStorage.setItem(buildStorageKey(slug, visitorSessionId), JSON.stringify(messages));
}

function loadPersistedMessages(slug: string, visitorSessionId: string): ChatMessage[] {
  const raw = localStorage.getItem(buildStorageKey(slug, visitorSessionId));
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as ChatMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function AssessmentSheet({
  isOpen,
  onClose,
  session,
  onSubmitAnswer,
  submitting,
  language,
  visitorSessionId,
}: {
  isOpen: boolean;
  onClose: () => void;
  session: AssessmentSession | null;
  onSubmitAnswer: (score: number) => void;
  submitting: boolean;
  language: 'zh' | 'en';
  visitorSessionId: string;
}) {
  if (!isOpen || !session) {
    return null;
  }

  const voiceQuestion = session.currentQuestion;
  const voiceMode = resolveAssessmentVoiceMode(session.interactionMode);

  const transcribeAssessmentAudio = useCallback(
    async (audioBlob: Blob) => {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'assessment-voice.webm');
      formData.append('deviceId', visitorSessionId);
      formData.append('context', 'questionnaire');

      const response = await fetch('/api/speech/transcribe', {
        method: 'POST',
        body: formData,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.text) {
        throw new Error(payload.error || (language === 'en' ? 'Failed to transcribe audio.' : '语音识别失败。'));
      }

      return String(payload.text);
    },
    [language, visitorSessionId]
  );

  const resolveAssessmentIntent = useCallback(
    async (input: {
      scaleId: string;
      question: ScaleQuestion;
      language: 'zh' | 'en';
      transcript: string;
    }) => {
      const response = await fetch('/api/voice-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'questionnaire',
          scaleId: input.scaleId,
          questionId: input.question.id,
          transcript: input.transcript,
          language: input.language,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.result) {
        throw new Error(payload.error || (language === 'en' ? 'Failed to resolve voice intent.' : '语音意图解析失败。'));
      }

      return payload.result;
    },
    [language]
  );

  const {
    session: voiceSession,
    isSupported,
    toggleRecording,
    speakCurrentQuestion,
    speakExplanation,
    togglePause,
    confirmPendingAnswer,
  } = useVoiceSession({
    scaleId: session.scaleId,
    language,
    mode: voiceMode,
    requiresConfirmation: voiceMode !== 'full_voice' || voiceQuestion?.riskLevel === 'high',
    question: voiceQuestion || {
      id: 0,
      text: '',
      clinical_intent: '',
      colloquial: '',
      fallback_examples: [],
      options: [],
    },
    questionIndex: Math.max(session.progress.answered, 0),
    questionCount: session.progress.total,
    currentAnswer: null,
    onAnswer: onSubmitAnswer,
    transcribeAudio: transcribeAssessmentAudio,
    resolveQuestionnaireIntentOverride: resolveAssessmentIntent,
  });

  return (
    <div className="fixed inset-0 z-[160] flex h-[100dvh] flex-col overflow-hidden bg-foreground/55 backdrop-blur-sm">
      <div className="flex min-h-0 flex-1 items-end justify-center">
        <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-card sm:h-[92dvh] sm:max-w-2xl sm:rounded-t-[2rem]">
          <div className="flex items-center justify-between border-b border-border px-4 py-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">Assessment</div>
              <div className="mt-1 text-lg font-semibold text-foreground">{session.scaleId}</div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-muted/50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="border-b border-border bg-muted/50 px-4 py-3 text-sm text-foreground">
            <div className="flex items-center justify-between gap-3">
              <span>
                {session.progress.answered + (session.currentQuestion ? 1 : 0)} / {session.progress.total}
              </span>
              <span className="font-semibold text-foreground">{Math.round(session.progress.ratio * 100)}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${session.progress.ratio * 100}%` }} />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+24px)]">
            {session.currentQuestion ? (
              <div className="space-y-4">
                <div className="text-lg font-semibold leading-8 text-foreground">{session.currentQuestion.text}</div>
                {isSupported ? (
                  <div className="rounded-[1.5rem] border border-primary/20 bg-accent/10 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleRecording}
                        disabled={submitting || voiceSession.isTranscribing}
                        className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white transition-colors ${
                          voiceSession.isRecording
                            ? 'bg-rose-600 hover:bg-rose-700'
                            : 'bg-accent hover:bg-accent'
                        } disabled:bg-muted-foreground`}
                      >
                        {voiceSession.isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        <span>
                          {voiceSession.isRecording
                            ? (language === 'en' ? 'Stop voice answer' : '停止语音作答')
                            : (language === 'en' ? 'Voice answer' : '语音作答')}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={speakCurrentQuestion}
                        className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-card px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/10"
                      >
                        <Volume2 className="h-4 w-4" />
                        <span>{language === 'en' ? 'Repeat question' : '重播题目'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={speakExplanation}
                        className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-card px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50"
                      >
                        <Sparkles className="h-4 w-4" />
                        <span>{language === 'en' ? 'Explain question' : '解释题意'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={togglePause}
                        className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/50"
                      >
                        {voiceSession.state === 'paused' ? <PlayCircle className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                        <span>{voiceSession.state === 'paused' ? (language === 'en' ? 'Resume' : '继续') : (language === 'en' ? 'Pause' : '暂停')}</span>
                      </button>
                    </div>
                    <div className="mt-3 rounded-2xl bg-card px-4 py-3 text-sm text-muted-foreground">
                      {voiceSession.statusText ||
                        (language === 'en'
                          ? 'You can answer by voice or tap an option below.'
                          : '你可以直接语音回答，也可以点击下方选项。')}
                    </div>
                    {voiceSession.pendingConfirmation ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void confirmPendingAnswer(true)}
                          className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                        >
                          {language === 'en' ? 'Yes, choose it' : '对，就选这个'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void confirmPendingAnswer(false)}
                          className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/50"
                        >
                          {language === 'en' ? 'No, ask again' : '不对，请再问一遍'}
                        </button>
                      </div>
                    ) : null}
                    {voiceSession.error ? (
                      <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                        {voiceSession.error}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <div className="space-y-3">
                  {session.currentQuestion.options.map((option) => (
                    <button
                      key={`${session.currentQuestion?.id}-${option.score}`}
                      type="button"
                      disabled={submitting}
                      onClick={() => onSubmitAnswer(option.score)}
                      className="w-full rounded-[1.5rem] border border-border bg-muted/50 px-4 py-4 text-left text-sm text-foreground hover:border-accent/50 hover:bg-card disabled:opacity-50"
                    >
                      <div className="font-semibold text-foreground">{option.label}</div>
                      {option.description ? <div className="mt-1 text-muted-foreground">{option.description}</div> : null}
                    </button>
                  ))}
                </div>
              </div>
            ) : session.result ? (
              <div className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50 px-5 py-5">
                <div className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
                  {language === 'en' ? 'Completed' : '已完成'}
                </div>
                <div className="mt-3 text-xl font-bold text-emerald-950">{session.result.conclusion}</div>
                <div className="mt-2 text-sm text-emerald-600">
                  {language === 'en' ? 'Score' : '得分'}: {session.result.totalScore}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">{language === 'en' ? 'Loading assessment...' : '正在载入量表...'}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DoctorBotChatExperience({
  slugOverride,
  showBackToHall = false,
}: {
  slugOverride?: string;
  showBackToHall?: boolean;
}) {
  const params = useParams();
  const slug = slugOverride || String(params?.slug || '');
  const [language] = useState<'zh' | 'en'>('zh');
  const { isAuthenticated, isPatient, authHeaders } = useAuthSession();
  const { profile } = useProfile();

  const [bot, setBot] = useState<BotPublicInfo | null>(null);
  const [visitorSessionId, setVisitorSessionId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [pageError, setPageError] = useState('');
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [assessmentOpen, setAssessmentOpen] = useState(false);
  const [assessmentSession, setAssessmentSession] = useState<AssessmentSession | null>(null);
  const [assessmentBusy, setAssessmentBusy] = useState(false);
  const [bindPromptOpen, setBindPromptOpen] = useState(false);
  const [bindBusy, setBindBusy] = useState(false);
  const [bindStatus, setBindStatus] = useState('');
  const [boundToCurrentDoctor, setBoundToCurrentDoctor] = useState(false);
  const [hasEffectiveInteraction, setHasEffectiveInteraction] = useState(false);
  const [realtimeBootstrap, setRealtimeBootstrap] = useState<DoctorBotRealtimeBootstrap | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const assessmentInProgress = Boolean(
    assessmentSession && !assessmentSession.result && assessmentSession.status !== 'COMPLETED'
  );

  useEffect(() => {
    if (!visitorSessionId || !slug) {
      return;
    }

    persistMessages(slug, visitorSessionId, messages);
  }, [messages, slug, visitorSessionId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, typingMessageId]);

  useEffect(() => {
    let cancelled = false;

    async function loadBindStatus() {
      if (!isAuthenticated || !isPatient || !profile.id || !bot?.doctor.id) {
        setBoundToCurrentDoctor(false);
        return;
      }

      try {
        const response = await fetch(`/api/me/members/${encodeURIComponent(profile.id)}/agent-status`, {
          headers: authHeaders,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load member agent status');
        }

        if (!cancelled) {
          setBoundToCurrentDoctor(Boolean(payload?.doctor?.id && payload.doctor.id === bot.doctor.id));
        }
      } catch {
        if (!cancelled) {
          setBoundToCurrentDoctor(false);
        }
      }
    }

    void loadBindStatus();

    return () => {
      cancelled = true;
    };
  }, [authHeaders, bot?.doctor.id, isAuthenticated, isPatient, profile.id]);

  useEffect(() => {
    if (!isAuthenticated || !isPatient || !bot?.doctor.id) {
      return;
    }

    if (hasEffectiveInteraction && !boundToCurrentDoctor) {
      setBindPromptOpen(true);
    }
  }, [boundToCurrentDoctor, bot?.doctor.id, hasEffectiveInteraction, isAuthenticated, isPatient]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setLoading(true);
      setPageError('');

      try {
        const nextVisitorSessionId = getOrCreateVisitorSessionId(slug);
        try {
          const realtimeRes = await fetch('/api/realtime/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              surface: 'doctor_bot',
              deviceId: nextVisitorSessionId,
              doctorBotSlug: slug,
            }),
          });
          const realtimePayload = await realtimeRes.json().catch(() => ({}));
          if (!cancelled && realtimeRes.ok) {
            setRealtimeBootstrap(realtimePayload as DoctorBotRealtimeBootstrap);
          }
        } catch {
          // Keep current doctor-bot flow as fallback.
        }

        const [botRes, sessionRes] = await Promise.all([
          fetch(`/api/chat/${encodeURIComponent(slug)}`),
          fetch(`/api/chat/${encodeURIComponent(slug)}/session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ visitorSessionId: nextVisitorSessionId }),
          }),
        ]);

        const botPayload = await botRes.json().catch(() => ({}));
        const sessionPayload = await sessionRes.json().catch(() => ({}));

        if (!botRes.ok || !botPayload.bot) {
          throw new Error(botPayload.error || 'Doctor assistant is not available');
        }
        if (!sessionRes.ok || !sessionPayload.session) {
          throw new Error(sessionPayload.error || 'Failed to initialize the chat session');
        }

        if (cancelled) {
          return;
        }

        setBot(botPayload.bot as BotPublicInfo);
        setVisitorSessionId(nextVisitorSessionId);
        if (sessionPayload.activeAssessment) {
          setAssessmentSession(sessionPayload.activeAssessment as AssessmentSession);
          setAssessmentOpen(true);
        }

        const restored = loadPersistedMessages(slug, nextVisitorSessionId);
        if (restored.length > 0) {
          setMessages(restored);
        } else {
          const welcome = botPayload.bot.welcomeMessage || `你好，我是${botPayload.bot.assistantName}。`;
          setMessages([
            {
              id: generateUUID(),
              role: 'assistant',
              type: 'text',
              content: welcome,
            },
          ]);
          speakText(welcome, language);
        }
      } catch (bootstrapError) {
        if (!cancelled) {
          setPageError(bootstrapError instanceof Error ? bootstrapError.message : 'Failed to load the assistant');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (slug) {
      void bootstrap();
    }

    return () => {
      cancelled = true;
      window.speechSynthesis?.cancel?.();
      mediaRecorderRef.current?.stop?.();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [language, slug]);

  const appendAssistantReply = useCallback(
    async (reply: ChatReply) => {
      if (reply.text) {
        const messageId = generateUUID();
        setTypingMessageId(messageId);
        setMessages((prev) => [...prev, { id: messageId, role: 'assistant', type: 'text', content: '' }]);

        let next = '';
        for (const char of reply.text) {
          next += char;
          setMessages((prev) =>
            prev.map((item) =>
              item.id === messageId && item.type === 'text'
                ? { ...item, content: next }
                : item
            )
          );
          await sleep(10);
        }
        setTypingMessageId(null);
        speakText(reply.text, language);
      }

      if (reply.actionCard) {
        const actionCard = reply.actionCard;
        setMessages((prev) => [
          ...prev,
          {
            id: generateUUID(),
            role: 'assistant',
            type: 'action',
            action: {
              scaleId: actionCard.scaleId,
              title: actionCard.title,
              body: actionCard.body,
              reason: actionCard.reason,
            },
          },
        ]);
      }
    },
    [language]
  );

  const sendMessage = useCallback(
    async (content: string, renderUser = true) => {
      if (!content.trim() || !visitorSessionId || sending) {
        return;
      }

      if (assessmentSession && !assessmentSession.result && assessmentSession.status !== 'COMPLETED') {
        setAssessmentOpen(true);
        setPageError(
          language === 'en'
            ? 'An assessment is in progress. Please finish the current assessment first.'
            : '当前有进行中的量表，请先完成当前量表。'
        );
        return;
      }

      const finalContent = content.trim();
      if (renderUser) {
        setMessages((prev) => [
          ...prev,
          {
            id: generateUUID(),
            role: 'user',
            type: 'text',
            content: finalContent,
          },
        ]);
      }
      setDraft('');
      setSending(true);
      setPageError('');

      try {
        const response = await fetch(`/api/chat/${encodeURIComponent(slug)}/message`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitorSessionId,
            content: finalContent,
            language,
          }),
        });
        const rawText = await response.text();
        let payload: ChatMessageErrorPayload = {};
        try {
          payload = rawText ? (JSON.parse(rawText) as ChatMessageErrorPayload) : {};
        } catch {
          // fall through to status-based error handling
        }

        if (!response.ok || !payload.reply) {
          if (payload.code === 'ASSESSMENT_IN_PROGRESS' && payload.data?.session) {
            setAssessmentSession(payload.data.session);
            setAssessmentOpen(true);
            setPageError('当前有进行中的量表，请先完成当前量表。');
            return;
          }
          if (payload.error) {
            throw new Error(payload.error);
          }
          if (response.status === 504) {
            throw new Error('医生分身响应超时，请稍后重试。');
          }
          if (/^\s*<!doctype html/i.test(rawText) || /^\s*<html/i.test(rawText)) {
            throw new Error('医生分身暂时不可用，请稍后重试。');
          }
          throw new Error('医生分身暂时不可用，请稍后重试。');
        }

        await appendAssistantReply(payload.reply as ChatReply);
        setHasEffectiveInteraction(true);
      } catch (sendError) {
        setPageError(sendError instanceof Error ? sendError.message : 'Failed to send chat message');
      } finally {
        setSending(false);
      }
    },
    [appendAssistantReply, assessmentSession, language, sending, slug, visitorSessionId]
  );

  const startAssessment = useCallback(
    async (scaleId: string) => {
      setAssessmentBusy(true);
      setPageError('');

      try {
        const response = await fetch(`/api/chat/${encodeURIComponent(slug)}/assessment/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visitorSessionId,
            scaleId,
            language,
          }),
        });
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || !payload.session) {
          throw new Error(payload.error || 'Failed to start assessment');
        }

        setAssessmentSession(payload.session as AssessmentSession);
        setAssessmentOpen(true);
      } catch (startError) {
        setPageError(startError instanceof Error ? startError.message : 'Failed to start assessment');
      } finally {
        setAssessmentBusy(false);
      }
    },
    [language, slug, visitorSessionId]
  );

  const submitAssessmentAnswer = useCallback(
    async (score: number) => {
      if (!assessmentSession?.currentQuestion) {
        return;
      }

      setAssessmentBusy(true);
      try {
        const response = await fetch(
          `/api/chat/${encodeURIComponent(slug)}/assessment/${encodeURIComponent(assessmentSession.sessionId)}/answer`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              visitorSessionId,
              questionId: assessmentSession.currentQuestion.id,
              score,
              language,
            }),
          }
        );
        const payload = await response.json().catch(() => ({}));

        if (!response.ok || !payload.session) {
          throw new Error(payload.error || 'Failed to submit assessment answer');
        }

        const nextSession = payload.session as AssessmentSession;
        setAssessmentSession(nextSession);

        if (nextSession.result || nextSession.status === 'COMPLETED') {
          setAssessmentOpen(false);
          const followUp = payload.followUp as ChatReply | null;
          if (followUp) {
            await appendAssistantReply(followUp);
          } else {
            const fallback = createAssistantFallbackAfterAssessment(nextSession, language);
            await appendAssistantReply({ text: fallback, actionCard: null });
          }
          setHasEffectiveInteraction(true);
        }
      } catch (submitError) {
        setPageError(submitError instanceof Error ? submitError.message : 'Failed to submit assessment answer');
      } finally {
        setAssessmentBusy(false);
      }
    },
    [appendAssistantReply, assessmentSession, language, slug, visitorSessionId]
  );

  const handleRecordToggle = useCallback(async () => {
    if (assessmentInProgress) {
      setAssessmentOpen(true);
      setPageError(
        language === 'en'
          ? 'An assessment is in progress. Please answer inside the assessment panel.'
          : '当前有进行中的量表，请在量表面板内继续作答。'
      );
      return;
    }

    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }

    if (transcribing || sending) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      chunksRef.current = [];

      const mimeType = inferRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' });
        mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;

        if (!blob.size) {
          return;
        }

        setTranscribing(true);
        try {
          const formData = new FormData();
          formData.append('audio', blob, 'voice.webm');
          formData.append('deviceId', visitorSessionId);
          formData.append('context', 'doctor_bot_chat');

          const response = await fetch('/api/speech/transcribe', {
            method: 'POST',
            body: formData,
          });
          const payload = await response.json().catch(() => ({}));

          if (!response.ok || !payload.text) {
            throw new Error(payload.error || 'Failed to transcribe audio');
          }

          setDraft(payload.text);
          await sendMessage(payload.text, true);
        } catch (recordError) {
          setPageError(recordError instanceof Error ? recordError.message : 'Failed to transcribe audio');
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      setRecording(true);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Unable to start recording');
    }
  }, [assessmentInProgress, language, recording, sending, transcribing, sendMessage, visitorSessionId]);

  const bindCurrentDoctor = useCallback(async () => {
    if (!isAuthenticated || !isPatient || !profile.id || !bot?.doctor.id) {
      return;
    }

    setBindBusy(true);
    setBindStatus('');

    try {
      const response = await fetch(`/api/me/members/${encodeURIComponent(profile.id)}/attending-doctor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          doctorProfileId: bot.doctor.id,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to bind current doctor');
      }

      setBoundToCurrentDoctor(true);
      setBindPromptOpen(false);
      setBindStatus('已绑定当前医生，之后从量表大厅进入 /agent 会默认加载该医生智能体。');
    } catch (error) {
      setBindStatus(error instanceof Error ? error.message : 'Failed to bind current doctor');
    } finally {
      setBindBusy(false);
    }
  }, [authHeaders, bot?.doctor.id, isAuthenticated, isPatient, profile.id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-accent" />
          <p className="mt-3 text-sm text-muted-foreground">正在加载医生分身...</p>
        </div>
      </div>
    );
  }

  if (pageError && !bot) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/50 px-4">
        <div className="w-full max-w-xl rounded-[2rem] border border-border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-foreground">当前分身不可用</h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{pageError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-4 pb-[calc(env(safe-area-inset-bottom)+20px)] sm:px-6">
        <div className="rounded-[2rem] border border-border bg-card/90 p-4 shadow-sm backdrop-blur">
          <div className="flex items-center gap-4">
            {showBackToHall ? (
              <a
                href="/"
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-muted/50"
              >
                <ArrowLeft className="h-4 w-4" />
              </a>
            ) : null}
            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-accent/10 text-accent">
              {bot?.avatarUrl ? (
                <img src={bot.avatarUrl} alt={bot.assistantName} className="h-full w-full object-cover" />
              ) : (
                <Bot className="h-6 w-6" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-accent">
                <Sparkles className="h-3.5 w-3.5" />
                <span>{bot?.assistantName}</span>
              </div>
              <div className="mt-2 text-lg font-semibold text-foreground">
                {bot?.doctor.realName} · {bot?.doctor.title}
              </div>
              <div className="text-sm text-muted-foreground">
                {bot?.doctor.hospitalName} · {bot?.doctor.departmentName}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                let lastAssistantContent = '';
                for (const item of [...messages].reverse()) {
                  if (item.role === 'assistant' && item.type === 'text') {
                    lastAssistantContent = item.content;
                    break;
                  }
                }
                if (lastAssistantContent) {
                  speakText(lastAssistantContent, language);
                }
              }}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-muted/50"
            >
              <Volume2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {realtimeBootstrap?.doctorBot ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600">
            医生分身会话已准备就绪；当前公开聊天页使用 {realtimeBootstrap.doctorBot.fallback.provider || '平台'} 知识服务。
          </div>
        ) : null}

        {pageError ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {pageError}
          </div>
        ) : null}

        {bindStatus ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-600">
            {bindStatus}
          </div>
        ) : null}

        {bindPromptOpen ? (
          <div className="mt-4 rounded-[1.75rem] border border-accent/30 bg-accent/10 px-4 py-4">
            <div className="text-sm font-semibold text-accent">绑定该医生后，量表大厅可直接进入医生智能体</div>
            <p className="mt-1 text-sm text-accent">
              你当前正在体验 {bot?.doctor.realName} 的智能体分身。绑定后，后续从 `/agent` 进入会默认加载该医生分身。
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void bindCurrentDoctor()}
                disabled={bindBusy}
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-white hover:bg-accent disabled:bg-muted-foreground"
              >
                {bindBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                <span>{bindBusy ? '绑定中...' : '绑定当前医生'}</span>
              </button>
              <button
                type="button"
                onClick={() => setBindPromptOpen(false)}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted/50"
              >
                暂不绑定
              </button>
            </div>
          </div>
        ) : null}

        {assessmentSession && !assessmentOpen && !assessmentSession.result ? (
          <div className="mt-4 rounded-[1.75rem] border border-accent/30 bg-accent/10 px-4 py-4">
            <div className="text-sm font-semibold text-accent">当前有一份进行中的量表</div>
            <p className="mt-1 text-sm text-accent">{assessmentSession.scaleId} 尚未完成，你可以继续填写。</p>
            <button
              type="button"
              onClick={() => setAssessmentOpen(true)}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-white hover:bg-accent"
            >
              <PlayCircle className="h-4 w-4" />
              <span>继续评估</span>
            </button>
          </div>
        ) : null}

        <div className="mt-4 flex-1 space-y-4 overflow-y-auto pb-6">
          {messages.map((message) =>
            message.type === 'text' ? (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-[1.75rem] px-4 py-3 text-sm leading-7 shadow-sm ${
                    message.role === 'user'
                      ? 'bg-foreground text-white'
                      : 'border border-border bg-card text-foreground'
                  }`}
                >
                  {message.content || (typingMessageId === message.id ? '...' : '')}
                </div>
              </div>
            ) : (
              <div key={message.id} className="flex justify-start">
                <div className="w-full max-w-[92%] rounded-[1.75rem] border border-accent/30 bg-card px-5 py-5 shadow-sm">
                  <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-accent">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    <span>Action Card</span>
                  </div>
                  <div className="mt-3 text-lg font-semibold text-foreground">{message.action.title}</div>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{message.action.body}</p>
                  <div className="mt-3 rounded-2xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
                    推荐原因：{message.action.reason}
                  </div>
                  <button
                    type="button"
                    disabled={assessmentBusy}
                    onClick={() => void startAssessment(message.action.scaleId)}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-white hover:bg-accent disabled:bg-muted-foreground"
                  >
                    {assessmentBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                    <span>开始评估</span>
                  </button>
                </div>
              </div>
            )
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="sticky bottom-0 rounded-[2rem] border border-border bg-card/95 p-4 shadow-sm backdrop-blur">
          <div className="mb-3 rounded-2xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
            {assessmentInProgress
              ? '当前已进入量表模式，请直接在量表面板内继续语音或点击作答。'
              : '你可以直接描述情况，也可以按住语音按钮说给医生分身听。'}
          </div>

          <div className="flex items-end gap-3">
            <button
              type="button"
              onClick={() => void handleRecordToggle()}
              disabled={transcribing || sending}
              className={`inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${
                recording ? 'bg-rose-600 text-white' : 'bg-accent text-accent-foreground'
              }`}
            >
              {recording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>

            <div className="min-w-0 flex-1 rounded-[1.5rem] border border-border bg-muted/50 px-4 py-3">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={2}
                placeholder={
                  assessmentInProgress
                    ? '量表进行中，请先完成当前量表...'
                    : '例如：王医生，我家宝宝最近晚上老是哭醒，是不是缺钙啊？'
                }
                disabled={assessmentInProgress}
                className="min-h-[56px] w-full resize-none bg-transparent text-sm leading-7 text-foreground outline-none"
              />
            </div>

            <button
              type="button"
              onClick={() => void sendMessage(draft, true)}
              disabled={!draft.trim() || sending || transcribing || assessmentInProgress}
              className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-semibold text-white hover:bg-foreground disabled:bg-muted-foreground"
            >
              {sending || transcribing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              <span>{sending ? '发送中...' : transcribing ? '识别中...' : '发送'}</span>
            </button>
          </div>
        </div>
      </div>

      <AssessmentSheet
        isOpen={assessmentOpen}
        onClose={() => setAssessmentOpen(false)}
        session={assessmentSession}
        onSubmitAnswer={submitAssessmentAnswer}
        submitting={assessmentBusy}
        language={language}
        visitorSessionId={visitorSessionId}
      />
    </div>
  );
}
