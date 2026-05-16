'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LanguageCode } from '@/lib/schemas/core/types';
import { AlertCircle, ArrowRight, Loader2, MessageCircle, Mic, MicOff, Pause, Play, Volume2 } from 'lucide-react';

import { useConversationHistory, useProfile } from '@/contexts';
import { useSkillSession } from '@/contexts/SkillSessionContext';
import { DEFAULT_AGENT_WORKSPACE_CONFIG } from '@/lib/agent/config';
import type { TriageAIResponse, TriageContext, TriageState } from '@/lib/services/triageFlow';

interface TriageVoiceRecorderProps {
  onStartScale: (scaleId: string) => void;
  onInterceptMessage?: (message: string) => Promise<string | null> | string | null;
  language?: LanguageCode;
  mode?: 'dock' | 'call';
  layout?: 'standard' | 'floating' | 'minimal';
  onStateChange?: (state: TriageVoiceUiState) => void;
  skillTokenOverride?: string;
}

export type TriageVoicePhase = 'idle' | 'recording' | 'thinking' | 'speaking' | 'paused' | 'consent';

export interface TriageVoiceUiState {
  phase: TriageVoicePhase;
  triageState: TriageState;
  isRecording: boolean;
  isTranscribing: boolean;
  isProcessing: boolean;
  isSpeaking: boolean;
  transcript: string;
  assistantText: string;
  statusText: string;
  recommendedScale?: string;
  remainingQuota: number | null;
  error?: string | null;
}

function getVoiceText(
  config: any,
  keyBase: string,
  language: LanguageCode,
  fallbackZh: string,
  fallbackEn: string
) {
  const voiceUi = config?.voiceUi || DEFAULT_AGENT_WORKSPACE_CONFIG.voiceUi;
  return voiceUi[`${keyBase}${language === 'en' ? 'En' : 'Zh'}`] || (language === 'en' ? fallbackEn : fallbackZh);
}

function buildTriageContextLabel(state: TriageState, language: LanguageCode, config: any) {
  switch (state) {
    case 'initial':
      return getVoiceText(config, 'initial', language, '点击麦克风，告诉我最近最困扰的情况。', 'Tap the microphone and tell me what has been happening recently.');
    case 'triage':
      return getVoiceText(config, 'triage', language, '我正在帮你梳理最关键的症状表现。', 'I am narrowing down the main concerns.');
    case 'consent':
      return getVoiceText(config, 'consent', language, '已经推荐好量表，正在等待你的确认。', 'A recommended scale is ready and waiting for your confirmation.');
    case 'handoff':
      return getVoiceText(config, 'handoff', language, '即将开始推荐的量表评估。', 'Starting the recommended assessment...');
    case 'paused':
      return getVoiceText(config, 'paused', language, '分诊会话已暂停。', 'The triage session is paused.');
    default:
      return getVoiceText(config, 'default', language, '分诊进行中。', 'Triage is in progress.');
  }
}

function getTriageCardClasses(mode: 'dock' | 'call') {
  return mode === 'call'
    ? 'mb-4 w-full rounded-2xl border border-white/10 bg-white/5 p-4'
    : 'mb-4 w-full rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50 p-4';
}

export default function TriageVoiceRecorder({
  onStartScale,
  onInterceptMessage,
  language = 'zh',
  mode = 'dock',
  layout = 'standard',
  onStateChange,
  skillTokenOverride,
}: TriageVoiceRecorderProps) {
  const { profile } = useProfile();
  const { addMessage } = useConversationHistory();
  const { token: skillToken } = useSkillSession();
  const effectiveSkillToken = skillTokenOverride || skillToken;

  const [agentConfig, setAgentConfig] = useState<any>(null);
  const [triageContext, setTriageContext] = useState<TriageContext>({
    state: 'initial',
    symptoms: [],
    conversationHistory: [],
    consentGiven: false,
    language,
  });
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [remainingQuota, setRemainingQuota] = useState<number | null>(null);
  const [assistantReply, setAssistantReply] = useState<TriageAIResponse | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAssistantPromptRef = useRef('');
  const welcomedRef = useRef(false);

  const tokenReady = Boolean(effectiveSkillToken);

  const loadAgentConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/agent/config');
      const data = await response.json().catch(() => ({}));
      if (response.ok && data.config) {
        setAgentConfig(data.config);
      }
    } catch {
      // keep defaults
    }
  }, []);

  const fetchQuota = useCallback(async () => {
    if (!effectiveSkillToken) return;

    try {
      const response = await fetch('/api/skill/v1/me/quota', {
        headers: {
          Authorization: `Bearer ${effectiveSkillToken}`,
        },
      });
      if (!response.ok) return;

      const data = await response.json();
      setRemainingQuota(data.remaining);
    } catch (quotaError) {
      console.error('Failed to fetch quota:', quotaError);
    }
  }, [effectiveSkillToken]);

  const speakText = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) {
      return;
    }

    window.speechSynthesis.cancel();
    setIsSpeaking(true);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'en' ? 'en-US' : 'zh-CN';
    utterance.rate = 0.92;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    lastAssistantPromptRef.current = text;
    window.speechSynthesis.speak(utterance);
  }, [language]);

  useEffect(() => {
    void loadAgentConfig();
    void fetchQuota();

    setTriageContext((prev) => ({
      ...prev,
      language,
      userProfile: {
        childName: profile.nickname,
        childAge: profile.ageMonths,
        relation: profile.relation,
        recentConcerns: profile.fears,
      },
    }));

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      setIsSpeaking(false);
    };
  }, [fetchQuota, language, loadAgentConfig, profile.ageMonths, profile.fears, profile.nickname, profile.relation]);

  useEffect(() => {
    if (mode !== 'call' || welcomedRef.current) {
      return;
    }

    const intro = getVoiceText(
      agentConfig,
      'introCall',
      language,
      '通话模式已开启。你可以直接告诉我{memberName}最近的情况，我会一步步引导到合适的量表。',
      'Call mode is ready. Tell me about {memberName} and I will guide you to the right assessment.'
    ).replace('{memberName}', profile.nickname || (language === 'en' ? 'the family member' : '当前家庭成员'));

    const reply: TriageAIResponse = {
      text: intro,
      action: 'acknowledge',
      confidence: 1,
    };

    setAssistantReply(reply);
    speakText(intro);
    welcomedRef.current = true;
  }, [agentConfig, language, mode, profile.nickname, speakText]);

  const handleUserMessage = useCallback(async (userMessage: string) => {
    if (!effectiveSkillToken) {
      setError(getVoiceText(agentConfig, 'voiceSessionPreparing', language, '语音会话还在准备中，请稍候再试。', 'Voice session is still initializing.'));
      return;
    }

    setIsProcessing(true);
    setError(null);
    setTranscript(userMessage);

    try {
      const interceptedReply = await onInterceptMessage?.(userMessage);
      if (interceptedReply) {
        const reply: TriageAIResponse = {
          text: interceptedReply,
          action: 'acknowledge',
          confidence: 1,
        };

        setAssistantReply(reply);
        addMessage({ role: 'user', content: userMessage, action: 'triage' });
        addMessage({ role: 'assistant', content: interceptedReply, action: 'acknowledge' });
        speakText(interceptedReply);
        return;
      }

      const contextForAI: TriageContext = {
        ...triageContext,
        language,
        conversationHistory: [
          ...triageContext.conversationHistory,
          { role: 'user', content: userMessage, timestamp: Date.now() },
        ],
      };

      const response = await fetch('/api/skill/v1/voice-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${effectiveSkillToken}`,
        },
        body: JSON.stringify({
          mode: 'triage',
          transcript: userMessage,
          language,
          triageContext: contextForAI,
          userProfile: {
            nickname: profile.nickname,
            ageMonths: profile.ageMonths,
            relation: profile.relation,
          },
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || getVoiceText(agentConfig, 'triageFailed', language, '分诊处理失败。', 'Triage failed.'));
      }

      const parsed = payload.result as TriageAIResponse;
      const replyText =
        parsed.text ||
        getVoiceText(agentConfig, 'letMeHelp', language, '我来继续帮你梳理。', 'Let me help with that.');

      const nextContext: TriageContext = {
        ...contextForAI,
        symptoms: parsed.symptoms?.length ? parsed.symptoms : contextForAI.symptoms,
        lastAssistantPrompt: replyText,
        lastIntent: parsed.meta?.userIntent,
        recommendedScale: parsed.scaleId || contextForAI.recommendedScale,
        state:
          parsed.action === 'recommend_scale'
            ? 'consent'
            : parsed.action === 'start_scale'
              ? 'handoff'
              : parsed.action === 'pause_session'
                ? 'paused'
                : parsed.action === 'resume_session'
                  ? 'triage'
                  : contextForAI.state === 'initial'
                    ? 'triage'
                    : contextForAI.state,
        conversationHistory: [
          ...contextForAI.conversationHistory,
          { role: 'assistant', content: replyText, timestamp: Date.now() },
        ],
      };

      setAssistantReply({
        ...parsed,
        text: replyText,
      });
      setTriageContext(nextContext);

      addMessage({ role: 'user', content: userMessage, action: 'triage' });
      addMessage({ role: 'assistant', content: replyText, action: parsed.action });
      speakText(replyText);

      if (parsed.action === 'start_scale' && parsed.scaleId) {
        window.setTimeout(() => onStartScale(parsed.scaleId!), 1000);
      }
    } catch (triageError) {
      console.error('Triage error:', triageError);
      setError(triageError instanceof Error ? triageError.message : getVoiceText(agentConfig, 'triageFailed', language, '分诊处理失败。', 'Triage failed.'));
    } finally {
      setIsProcessing(false);
    }
  }, [addMessage, agentConfig, effectiveSkillToken, language, onInterceptMessage, onStartScale, profile.ageMonths, profile.nickname, profile.relation, speakText, triageContext]);

  const uploadAndTranscribe = useCallback(async (audioBlob: Blob) => {
    if (!effectiveSkillToken) {
      setError(getVoiceText(agentConfig, 'voiceSessionPreparing', language, '语音会话还在准备中，请稍候再试。', 'Voice session is still initializing.'));
      return;
    }

    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('context', 'triage');

      const response = await fetch('/api/skill/v1/speech/transcribe', {
        method: 'POST',
        headers: { Authorization: `Bearer ${effectiveSkillToken}` },
        body: formData,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || getVoiceText(agentConfig, 'transcriptionFailed', language, '语音识别失败。', 'Transcription failed.'));
      }

      if (!data.success || !data.text) {
        throw new Error(getVoiceText(agentConfig, 'noValidSpeech', language, '未识别到有效语音。', 'No valid speech was detected.'));
      }

      setRemainingQuota(data.remaining);
      await handleUserMessage(data.text);
    } catch (transcriptionError) {
      console.error('Transcription error:', transcriptionError);
      setError(
        transcriptionError instanceof Error
          ? transcriptionError.message
          : getVoiceText(agentConfig, 'transcriptionFailed', language, '语音识别失败。', 'Transcription failed.')
      );
    } finally {
      setIsTranscribing(false);
    }
  }, [agentConfig, effectiveSkillToken, handleUserMessage, language]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      if (!effectiveSkillToken) {
        setError(getVoiceText(agentConfig, 'voiceSessionPreparing', language, '语音会话还在准备中，请稍候再试。', 'Voice session is still initializing.'));
        return;
      }

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
        },
      });

      streamRef.current = stream;
      audioChunksRef.current = [];

      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav'];
      const mimeType = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) || 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 64000,
      });

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await uploadAndTranscribe(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError(null);
      window.setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording();
        }
      }, 60000);
    } catch (recordError: any) {
      const isMobileBrowser = typeof window !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent);
      let errorMessage = getVoiceText(agentConfig, 'startRecordingFailed', language, '录音启动失败。', 'Failed to start recording.');
      if (recordError?.name === 'NotAllowedError') {
        errorMessage = getVoiceText(agentConfig, 'microphoneDenied', language, '麦克风权限被拒绝，请允许后重试。', 'Microphone permission was denied.');
      } else if (recordError?.name === 'NotFoundError') {
        errorMessage = getVoiceText(agentConfig, 'microphoneMissing', language, '未检测到麦克风设备。', 'No microphone device was found.');
      }
      if (recordError?.name === 'NotReadableError') {
        errorMessage = language === 'en'
          ? 'The microphone is busy or blocked by another overlay. Please close any floating tools and try again.'
          : '麦克风当前被其他程序或悬浮工具占用，请先关闭系统悬浮球、录屏悬浮条或翻译气泡后再试。';
      }

      if (recordError?.name === 'NotAllowedError' && isMobileBrowser) {
        errorMessage += language === 'en'
          ? ' If Chrome asks you to close floating overlays, please disable any screen recorder bubbles, translate bubbles, accessibility floating balls, or chat heads and try again.'
          : ' 如果 Chrome 提示请关闭多余悬浮窗，请先关闭系统悬浮球、录屏悬浮条、翻译气泡或聊天气泡后再试。';
      }

      setError(errorMessage);
      setIsRecording(false);
    }
  }, [agentConfig, effectiveSkillToken, language, stopRecording, uploadAndTranscribe]);

  const toggleRecording = useCallback(() => {
    if (isTranscribing || isProcessing) return;
    if (!effectiveSkillToken) {
      setError(getVoiceText(agentConfig, 'voiceSessionPreparing', language, '语音会话还在准备中，请稍候再试。', 'Voice session is still initializing.'));
      return;
    }
    setError(null);
    if (isRecording) {
      stopRecording();
      return;
    }
    setTranscript('');
    void startRecording();
  }, [agentConfig, effectiveSkillToken, isProcessing, isRecording, isTranscribing, language, startRecording, stopRecording]);

  const handlePauseToggle = useCallback(() => {
    const prompt =
      triageContext.state === 'paused'
        ? getVoiceText(agentConfig, 'continuePrompt', language, '继续刚才的分诊。', 'Continue the triage session.')
        : getVoiceText(agentConfig, 'pausePrompt', language, '先暂停一下。', 'Pause for now.');

    void handleUserMessage(prompt);
  }, [agentConfig, handleUserMessage, language, triageContext.state]);

  const phase: TriageVoicePhase = isRecording
    ? 'recording'
    : isTranscribing || isProcessing
      ? 'thinking'
      : triageContext.state === 'paused'
        ? 'paused'
        : triageContext.state === 'consent'
          ? 'consent'
          : isSpeaking
            ? 'speaking'
            : 'idle';

  const phaseLabelMap: Record<TriageVoicePhase, string> = {
    idle: getVoiceText(agentConfig, 'phaseIdle', language, '待命中', 'Ready'),
    recording: getVoiceText(agentConfig, 'phaseRecording', language, '正在听你说', 'Listening'),
    thinking: getVoiceText(agentConfig, 'phaseThinking', language, '正在理解', 'Thinking'),
    speaking: getVoiceText(agentConfig, 'phaseSpeaking', language, '正在播报', 'Speaking'),
    paused: getVoiceText(agentConfig, 'phasePaused', language, '已暂停', 'Paused'),
    consent: getVoiceText(agentConfig, 'phaseConsent', language, '已推荐量表', 'Ready To Start'),
  };

  const floatingStatusText =
    (!tokenReady ? getVoiceText(agentConfig, 'preparingWorkspace', language, '正在准备语音工作区，请稍候...', 'Preparing the voice workspace...') : '') ||
    error ||
    assistantReply?.text ||
    (transcript ? `${getVoiceText(agentConfig, 'youSaid', language, '你刚刚说：', 'You said:')} ${transcript}` : '') ||
    buildTriageContextLabel(triageContext.state, language, agentConfig);

  useEffect(() => {
    onStateChange?.({
      phase,
      triageState: triageContext.state,
      isRecording,
      isTranscribing,
      isProcessing,
      isSpeaking,
      transcript,
      assistantText: assistantReply?.text || '',
      statusText: buildTriageContextLabel(triageContext.state, language, agentConfig),
      recommendedScale: triageContext.recommendedScale,
      remainingQuota,
      error,
    });
  }, [agentConfig, assistantReply?.text, error, isProcessing, isRecording, isSpeaking, isTranscribing, onStateChange, phase, remainingQuota, transcript, triageContext.recommendedScale, triageContext.state, language]);

  const orbTone =
    phase === 'recording'
      ? 'from-rose-500 to-orange-500'
      : phase === 'thinking'
        ? 'from-indigo-500 to-cyan-500'
        : phase === 'speaking'
          ? 'from-emerald-500 to-teal-500'
          : phase === 'paused'
            ? 'from-slate-400 to-slate-500'
            : phase === 'consent'
              ? 'from-emerald-500 to-emerald-600'
              : 'from-indigo-500 to-purple-600';

  if (layout === 'minimal') {
    return (
      <div className="flex w-full flex-col items-center">
        {assistantReply?.text && !isProcessing ? (
          <div className="mb-4 w-full rounded-[1.5rem] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-7 text-slate-700">
            {assistantReply.text}
          </div>
        ) : null}

        {error ? (
          <div className="mb-3 w-full rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {triageContext.state === 'consent' && triageContext.recommendedScale ? (
          <button
            onClick={() => onStartScale(triageContext.recommendedScale!)}
            className="mb-4 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:bg-emerald-600 active:scale-95"
          >
            <span>
              {getVoiceText(agentConfig, 'startScaleNow', language, '直接开始 {scaleId} 评估', 'Start {scaleId} now').replace('{scaleId}', triageContext.recommendedScale)}
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : null}

        <button
          onClick={toggleRecording}
          disabled={!tokenReady || isTranscribing || isProcessing}
          className={`relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br ${orbTone} text-white shadow-[0_18px_50px_-18px_rgba(79,70,229,0.55)] transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60`}
        >
          {isTranscribing || isProcessing ? (
            <Loader2 className="h-9 w-9 animate-spin" />
          ) : isRecording ? (
            <MicOff className="h-9 w-9" />
          ) : (
            <Mic className="h-9 w-9" />
          )}
        </button>

        <div className="mt-4 text-sm font-medium text-slate-700">
          {buildTriageContextLabel(triageContext.state, language, agentConfig)}
        </div>

        {transcript && !isProcessing ? (
          <div className="mt-2 text-xs text-slate-500">
            {getVoiceText(agentConfig, 'youSaid', language, '你刚刚说：', 'You said:')} {transcript}
          </div>
        ) : null}
      </div>
    );
  }

  if (layout === 'floating') {
    return (
      <div className="pointer-events-none fixed right-4 bottom-28 z-30 flex w-[calc(100vw-2rem)] max-w-sm flex-col items-end gap-3 sm:bottom-24 md:right-6 md:bottom-6 md:w-auto">
        <div className="pointer-events-auto rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {phaseLabelMap[phase]}
            </div>
            <div className="min-w-0 flex-1 text-sm leading-7 text-slate-700">
              {floatingStatusText}
            </div>
          </div>
          {remainingQuota !== null && (
            <div className="mt-3 text-xs text-slate-500">
              {getVoiceText(agentConfig, 'remainingQuota', language, '今日剩余：', 'Remaining today:')} {remainingQuota}
            </div>
          )}
          {triageContext.state === 'consent' && triageContext.recommendedScale && (
            <button
              onClick={() => onStartScale(triageContext.recommendedScale!)}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-bold text-white shadow-md transition-all hover:bg-emerald-600 active:scale-95"
            >
              <span>
                {getVoiceText(agentConfig, 'startScaleShort', language, '开始 {scaleId}', 'Start {scaleId}').replace('{scaleId}', triageContext.recommendedScale)}
              </span>
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={handlePauseToggle}
            disabled={!tokenReady || isRecording || isTranscribing || isProcessing}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg transition-colors hover:bg-slate-50 disabled:opacity-50"
            aria-label={triageContext.state === 'paused'
              ? getVoiceText(agentConfig, 'resumeAria', language, '继续分诊', 'Resume triage')
              : getVoiceText(agentConfig, 'pauseAria', language, '暂停分诊', 'Pause triage')}
          >
            {triageContext.state === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>

          <button
            onClick={() => speakText(lastAssistantPromptRef.current || assistantReply?.text || buildTriageContextLabel(triageContext.state, language, agentConfig))}
            disabled={!tokenReady || isRecording || isTranscribing}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-lg transition-colors hover:bg-slate-50 disabled:opacity-50"
            aria-label={getVoiceText(agentConfig, 'repeatReply', language, '重复播报', 'Repeat assistant reply')}
          >
            <Volume2 className="h-4 w-4" />
          </button>

          <button
            onClick={toggleRecording}
            disabled={!tokenReady || isTranscribing || isProcessing}
            className={`relative flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br ${orbTone} text-white shadow-[0_18px_50px_-18px_rgba(79,70,229,0.55)] transition-all hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {isTranscribing || isProcessing ? (
              <Loader2 className="relative z-10 h-8 w-8 animate-spin" />
            ) : isRecording ? (
              <MicOff className="relative z-10 h-8 w-8" />
            ) : (
              <Mic className="relative z-10 h-8 w-8" />
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center ${mode === 'call' ? 'mx-auto max-w-3xl' : 'mx-auto max-w-md'}`}>
      {assistantReply?.text && !isProcessing && (
        <div className={getTriageCardClasses(mode)}>
          <div className="flex items-start gap-2">
            <MessageCircle className={`mt-0.5 h-4 w-4 flex-shrink-0 ${mode === 'call' ? 'text-cyan-300' : 'text-blue-600'}`} />
            <p className={`text-sm leading-relaxed ${mode === 'call' ? 'text-white/90' : 'text-slate-700'}`}>{assistantReply.text}</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-2 flex max-w-xs items-center gap-2 text-center text-xs text-rose-600">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {(isTranscribing || isProcessing) && (
        <div className="mb-2 flex items-center gap-2 text-indigo-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className={`text-xs font-medium ${mode === 'call' ? 'text-cyan-200' : ''}`}>
            {isTranscribing
              ? getVoiceText(agentConfig, 'transcribing', language, '正在识别语音...', 'Transcribing...')
              : getVoiceText(agentConfig, 'analyzing', language, '正在分析分诊内容...', 'Analyzing...')}
          </span>
        </div>
      )}

      {transcript && !isProcessing && (
        <div className={`mb-2 max-w-xs text-center text-xs ${mode === 'call' ? 'text-white/60' : 'text-slate-600'}`}>
          {getVoiceText(agentConfig, 'youSaid', language, '你刚刚说：', 'You said:')} "{transcript}"
        </div>
      )}

      {remainingQuota !== null && !isRecording && !isTranscribing && !isProcessing && (
        <div className={`mb-2 text-xs ${mode === 'call' ? 'text-white/55' : 'text-slate-500'}`}>
          {getVoiceText(agentConfig, 'remainingQuota', language, '今日剩余：', 'Remaining today:')} {remainingQuota}
        </div>
      )}

      <div className={`mb-3 text-center text-xs ${mode === 'call' ? 'text-white/60' : 'text-slate-500'}`}>
        {buildTriageContextLabel(triageContext.state, language, agentConfig)}
      </div>

      {triageContext.state === 'consent' && triageContext.recommendedScale && (
        <button
          onClick={() => onStartScale(triageContext.recommendedScale!)}
          className="mt-3 flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-2.5 font-bold text-white shadow-md transition-all hover:bg-emerald-600 active:scale-95"
        >
          <span>
            {getVoiceText(agentConfig, 'startScaleNow', language, '直接开始 {scaleId} 评估', 'Start {scaleId} now').replace('{scaleId}', triageContext.recommendedScale)}
          </span>
          <ArrowRight className="h-4 w-4" />
        </button>
      )}

      <div className={`mt-3 flex items-center gap-2 ${mode === 'call' ? 'rounded-full border border-white/10 bg-white/5 px-4 py-3' : ''}`}>
        <button
          onClick={toggleRecording}
          disabled={!tokenReady || isTranscribing || isProcessing}
          className={`relative flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-all ${
            !tokenReady || isTranscribing || isProcessing
              ? 'cursor-not-allowed bg-slate-400'
              : isRecording
                ? 'animate-pulse bg-rose-500 hover:bg-rose-600'
                : 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700'
          }`}
        >
          {isTranscribing || isProcessing ? (
            <Loader2 className="h-7 w-7 animate-spin text-white" />
          ) : isRecording ? (
            <MicOff className="h-7 w-7 text-white" />
          ) : (
            <Mic className="h-7 w-7 text-white" />
          )}
        </button>

        <button
          onClick={handlePauseToggle}
          disabled={!tokenReady || isRecording || isTranscribing || isProcessing}
          className={`flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-50 ${
            mode === 'call'
              ? 'border border-white/10 bg-white/10 text-white hover:bg-white/15'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
          aria-label={
            triageContext.state === 'paused'
              ? getVoiceText(agentConfig, 'resumeAria', language, '继续分诊', 'Resume triage')
              : getVoiceText(agentConfig, 'pauseAria', language, '暂停分诊', 'Pause triage')
          }
        >
          {triageContext.state === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>

        <button
          onClick={() => speakText(lastAssistantPromptRef.current || assistantReply?.text || buildTriageContextLabel(triageContext.state, language, agentConfig))}
          disabled={!tokenReady || isRecording || isTranscribing}
          className={`flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-50 ${
            mode === 'call'
              ? 'border border-white/10 bg-white/10 text-white hover:bg-white/15'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
          aria-label={getVoiceText(agentConfig, 'repeatReply', language, '重复播报', 'Repeat assistant reply')}
        >
          <Volume2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
