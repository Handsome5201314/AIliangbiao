'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { LanguageCode } from '@/lib/schemas/core/types';
import {
  AlertCircle,
  ArrowRight,
  FileUp,
  Loader2,
  MessageCircle,
  Mic,
  MicOff,
  Pause,
  Play,
  Volume2,
  X,
} from 'lucide-react';

import { useProfile, useConversationHistory } from '@/contexts';
import { useSkillSession } from '@/contexts/SkillSessionContext';
import { MAX_FALLBACKS, MAX_REPROMPTS, NO_INPUT_TIMEOUT_MS } from '@/lib/services/voiceRules';
import Avatar from '@/components/Avatar';
import {
  TriageAIResponse,
  TriageContext,
  TriageState,
  buildScaleRecommendationCopy,
  defaultTriageContext,
  detectLocalTriageIntent,
  extractSymptomsFromTranscript,
  generateTriagePrompt,
  parseAIResponse,
  recommendScaleFromSymptoms,
  TRIAGE_SYSTEM_PROMPT,
} from '@/lib/services/triageFlow';
import { useSpeechPlayback } from '@/lib/services/useSpeechPlayback';

interface TriageVoiceRecorderProps {
  onStartScale: (scaleId: string) => void;
  language?: LanguageCode;
  mode?: 'dock' | 'call';
  onClose?: () => void;
}

function buildTriageContextLabel(state: TriageState, language: LanguageCode) {
  if (language === 'en') {
    switch (state) {
      case 'initial':
        return 'Tap the microphone and tell me what has been happening recently.';
      case 'triage':
        return 'I am narrowing down the main concerns.';
      case 'consent':
        return 'A recommended scale is ready and waiting for your confirmation.';
      case 'handoff':
        return 'Starting the recommended assessment...';
      case 'paused':
        return 'The triage session is paused.';
      default:
        return 'Triage is in progress.';
    }
  }

  switch (state) {
    case 'initial':
      return '点击麦克风，告诉我最近最困扰的情况。';
    case 'triage':
      return '我正在帮你梳理最关键的症状表现。';
    case 'consent':
      return '已经推荐好量表，正在等待你的确认。';
    case 'handoff':
      return '即将开始推荐的量表评估。';
    case 'paused':
      return '分诊会话已暂停。';
    default:
      return '分诊进行中。';
  }
}

function buildQwenPayload(model: string, systemPrompt: string, userPrompt: string) {
  return {
    model,
    input: {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    },
    parameters: {
      temperature: 0.4,
      max_tokens: 400,
    },
  };
}

function buildOpenAICompatiblePayload(model: string, systemPrompt: string, userPrompt: string) {
  return {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.4,
    max_tokens: 400,
  };
}

function extractProviderResponseText(provider: string, data: any): string {
  if (provider === 'qwen') {
    return data?.output?.text?.trim?.() || data?.output?.choices?.[0]?.message?.content?.trim?.() || '';
  }

  return data?.choices?.[0]?.message?.content?.trim?.() || '';
}

function getTriageCardClasses(mode: 'dock' | 'call') {
  return mode === 'call'
    ? 'mb-4 w-full rounded-2xl border border-white/10 bg-white/5 p-4'
    : 'mb-4 w-full rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-purple-50 p-4';
}

export default function TriageVoiceRecorder({
  onStartScale,
  language = 'zh',
  mode = 'dock',
  onClose,
}: TriageVoiceRecorderProps) {
  const { profile } = useProfile();
  const { addMessage } = useConversationHistory();
  const { token: skillToken } = useSkillSession();

  const [triageContext, setTriageContext] = useState<TriageContext>(defaultTriageContext);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [remainingQuota, setRemainingQuota] = useState<number | null>(null);
  const [assistantReply, setAssistantReply] = useState<TriageAIResponse | null>(null);
  const [repromptCount, setRepromptCount] = useState(0);
  const [fallbackCount, setFallbackCount] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const lastAssistantPromptRef = useRef('');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const welcomedRef = useRef(false);
  const speechPlayback = useSpeechPlayback(language, {
    onError: (message) => {
      setError((current) => current || message);
    },
  });

  const speakText = useCallback(
    async (text: string, source: 'auto' | 'manual' = 'auto') => {
      if (!text) {
        return;
      }

      lastAssistantPromptRef.current = text;
      const result = await speechPlayback.speakText(text, {
        queueIfLocked: source === 'auto',
        fromUserGesture: source === 'manual',
      });

      if (result.queued && mode === 'call') {
        setError(null);
      }
    },
    [mode, speechPlayback]
  );

  const fetchQuota = useCallback(async () => {
    try {
      if (!skillToken) {
        return;
      }

      const response = await fetch('/api/skill/v1/me/quota', {
        headers: {
          Authorization: `Bearer ${skillToken}`,
        },
      });
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      setRemainingQuota(data.remaining);
    } catch (quotaError) {
      console.error('Failed to fetch quota:', quotaError);
    }
  }, [skillToken]);

  const buildProfileContext = useCallback(() => ({
    childName: profile.nickname,
    childAge: profile.ageMonths,
    relation: profile.relation,
    recentConcerns: profile.fears,
  }), [profile.ageMonths, profile.fears, profile.nickname, profile.relation]);

  const initTriage = useCallback(() => {
    setTriageContext({
      ...defaultTriageContext,
      state: 'initial',
      language,
      userProfile: buildProfileContext(),
    });
    setAssistantReply(null);
    setTranscript('');
    setRepromptCount(0);
    setFallbackCount(0);
  }, [buildProfileContext, language]);

  const saveSession = useCallback(async (
    nextContext: TriageContext,
    statusOverride?: string
  ) => {
    try {
      const deviceId = localStorage.getItem('device_id');
      if (!deviceId) {
        return;
      }

      if (!skillToken) {
        return;
      }

      const response = await fetch('/api/skill/v1/me/triage-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${skillToken}`,
        },
        body: JSON.stringify({
          sessionId,
          status: statusOverride || (nextContext.state === 'consent' ? 'CONSENT' : nextContext.state === 'paused' ? 'PAUSED' : 'ONGOING'),
          symptoms: nextContext.symptoms,
          conversationHistory: nextContext.conversationHistory,
          recommendedScale: nextContext.recommendedScale,
        }),
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (data.session && !sessionId) {
        setSessionId(data.session.id);
      }
    } catch (saveError) {
      console.error('[Save Session Error]:', saveError);
    }
  }, [sessionId, skillToken]);

  const completeSession = useCallback(async () => {
    if (!sessionId) {
      return;
    }

    try {
      if (!skillToken) {
        return;
      }

      await fetch(`/api/skill/v1/me/triage-session?sessionId=${sessionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${skillToken}` },
      });
    } catch (completeError) {
      console.error('[Complete Session Error]:', completeError);
    }
  }, [sessionId, skillToken]);

  const loadSession = useCallback(async () => {
    try {
      if (!skillToken) {
        return;
      }

      const response = await fetch('/api/skill/v1/me/triage-session', {
        headers: {
          Authorization: `Bearer ${skillToken}`,
        },
      });
      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (!data.session) {
        return;
      }

      const session = data.session;
      const lastAssistantMessage = Array.isArray(session.conversationHistory)
        ? [...session.conversationHistory].reverse().find((item: any) => item.role === 'assistant')
        : undefined;

      setSessionId(session.id);
      setTriageContext({
        state:
          session.status === 'CONSENT'
            ? 'consent'
            : session.status === 'PAUSED'
              ? 'paused'
              : 'triage',
        symptoms: session.symptoms || [],
        conversationHistory: session.conversationHistory || [],
        recommendedScale: session.recommendedScale || undefined,
        consentGiven: false,
        language,
        pausedFromState: session.status === 'PAUSED' ? 'triage' : undefined,
        lastAssistantPrompt: lastAssistantMessage?.content,
        userProfile: buildProfileContext(),
      });

      if (lastAssistantMessage?.content) {
        lastAssistantPromptRef.current = lastAssistantMessage.content;
      }
    } catch (loadError) {
      console.error('[Load Session Error]:', loadError);
    }
  }, [buildProfileContext, language, skillToken]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!window.MediaRecorder) {
        setError(language === 'en' ? 'This browser does not support recording.' : '当前浏览器不支持录音。');
        return;
      }

      const mimeTypes = ['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg', 'audio/wav'];
      const supportedType = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type));
      if (!supportedType) {
        setError(language === 'en' ? 'No supported audio format was found.' : '浏览器不支持当前音频格式。');
        return;
      }
    }

    void fetchQuota();
    initTriage();
    void loadSession();

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
      speechPlayback.stopPlayback();
    };
  }, [fetchQuota, initTriage, language, loadSession, speechPlayback]);

  useEffect(() => {
    if (mode !== 'call' || welcomedRef.current) {
      return;
    }

    const introText =
      language === 'en'
        ? `Call mode is ready. Tell me about ${profile.nickname || 'the family member'} and I will guide you to the right assessment.`
        : `通话模式已开启。你可以直接告诉我${profile.nickname || '当前家庭成员'}最近的情况，我会一步步引导到合适的量表。`;

    const introReply: TriageAIResponse = {
      text: introText,
      action: 'acknowledge',
      confidence: 1,
    };

    setAssistantReply(introReply);
    void speakText(introText, 'auto');
    welcomedRef.current = true;
  }, [language, mode, profile.nickname, speakText]);

  useEffect(() => {
    if (mode !== 'call') {
      return;
    }

    if (
      isRecording ||
      isTranscribing ||
      isProcessing ||
      triageContext.state === 'paused' ||
      triageContext.state === 'handoff'
    ) {
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      if (repromptCount + 1 >= MAX_REPROMPTS) {
        const pauseText =
          language === 'en'
            ? 'I have not heard a response yet, so I will pause here. You can tap the microphone or say continue when you are ready.'
            : '我暂时还没有听到你的回应，我们先停在这里。准备好了再点麦克风，或者直接说“继续”就可以。';

        setRepromptCount((count) => count + 1);
        setAssistantReply({
          text: pauseText,
          action: 'pause_session',
          confidence: 1,
          meta: { reason: 'timeout pause' },
        });
        setTriageContext((prev) => ({
          ...prev,
          state: 'paused',
          pausedFromState: prev.state === 'paused' ? prev.pausedFromState : prev.state,
        }));
        void speakText(pauseText, 'auto');
        return;
      }

      const repromptText =
        language === 'en'
          ? 'I am still here. You can briefly describe the symptom, or ask me to repeat the last prompt.'
          : '我还在这儿。你可以直接说症状表现，也可以让我重复刚才的问题。';

      setRepromptCount((count) => count + 1);
      setAssistantReply({
        text: repromptText,
        action: 'ask_followup',
        confidence: 0.92,
        meta: { reason: 'timeout reprompt' },
      });
      void speakText(repromptText, 'auto');
    }, NO_INPUT_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isProcessing, isRecording, isTranscribing, language, mode, repromptCount, speakText, triageContext.state]);

  const startRecording = useCallback(async () => {
    try {
      speechPlayback.stopPlayback();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      speechPlayback.primePlayback();

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
      setRepromptCount(0);

      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording();
        }
      }, 60000);
    } catch (recordError: any) {
      let errorMessage = language === 'en' ? 'Failed to start recording.' : '录音启动失败。';

      if (recordError?.name === 'NotAllowedError') {
        errorMessage = language === 'en' ? 'Microphone permission was denied.' : '麦克风权限被拒绝，请允许后重试。';
      } else if (recordError?.name === 'NotFoundError') {
        errorMessage = language === 'en' ? 'No microphone device was found.' : '未检测到麦克风设备。';
      }

      setError(errorMessage);
      setIsRecording(false);
    }
  }, [language, speechPlayback]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  const callTriageAI = useCallback(async (userMessage: string, context: TriageContext): Promise<TriageAIResponse> => {
    const systemKeyRes = await fetch('/api/system/apikey');
    const systemKeyData = await systemKeyRes.json();

    if (!systemKeyData.success) {
      throw new Error(systemKeyData.error || (language === 'en' ? 'No system API key is configured.' : '系统未配置可用的 API Key。'));
    }

    const { provider, apiKey, endpoint, model } = systemKeyData;
    const userPrompt = generateTriagePrompt(userMessage, context, {
      nickname: profile.nickname,
      ageMonths: profile.ageMonths,
      relation: profile.relation,
    });

    const payload =
      provider === 'qwen'
        ? buildQwenPayload(model, TRIAGE_SYSTEM_PROMPT, userPrompt)
        : buildOpenAICompatiblePayload(model, TRIAGE_SYSTEM_PROMPT, userPrompt);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || errorData.error || `API request failed: ${response.status}`);
    }

    const data = await response.json();
    const rawContent = extractProviderResponseText(provider, data);
    if (!rawContent) {
      throw new Error(language === 'en' ? 'The AI returned an empty response.' : 'AI 返回了空响应。');
    }

    return parseAIResponse(rawContent);
  }, [language, profile.ageMonths, profile.nickname, profile.relation]);

  const fetchTriageIntent = useCallback(async (userMessage: string, context: TriageContext): Promise<TriageAIResponse> => {
    if (!skillToken) {
      throw new Error('Skill session is not ready yet.');
    }

    const response = await fetch('/api/skill/v1/voice-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${skillToken}`,
      },
      body: JSON.stringify({
        mode: 'triage',
        transcript: userMessage,
        language,
        triageContext: context,
        userProfile: {
          nickname: profile.nickname,
          ageMonths: profile.ageMonths,
          relation: profile.relation,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to resolve triage voice intent.');
    }

    const payload = await response.json();
    return payload.result as TriageAIResponse;
  }, [language, profile.ageMonths, profile.nickname, profile.relation, skillToken]);

  const applyParsedResponse = useCallback(async (
    parsed: TriageAIResponse,
    contextForUpdate: TriageContext,
    userMessage: string
  ) => {
    const defaultAssistantText =
      parsed.text || (language === 'en' ? 'Let me help with that.' : '我来继续帮你梳理。');

    let replyText = defaultAssistantText;
    const symptomsChanged = contextForUpdate.symptoms.length !== triageContext.symptoms.length;

    const updatedHistory = [
      ...contextForUpdate.conversationHistory,
      { role: 'assistant' as const, content: defaultAssistantText, timestamp: Date.now() },
    ];

    let nextContext: TriageContext = {
      ...contextForUpdate,
      conversationHistory: updatedHistory,
      symptoms: parsed.symptoms?.length ? parsed.symptoms : contextForUpdate.symptoms,
      lastAssistantPrompt: defaultAssistantText,
      lastIntent: parsed.meta?.userIntent,
    };

    switch (parsed.action) {
      case 'repeat_question':
      case 'explain':
        break;
      case 'pause_session':
        nextContext = {
          ...nextContext,
          pausedFromState: contextForUpdate.state === 'paused' ? contextForUpdate.pausedFromState : contextForUpdate.state,
          state: 'paused',
        };
        break;
      case 'resume_session':
        nextContext = {
          ...nextContext,
          state: contextForUpdate.pausedFromState || 'triage',
          pausedFromState: undefined,
        };
        break;
      case 'recommend_scale':
        nextContext = {
          ...nextContext,
          state: 'consent',
          recommendedScale: parsed.scaleId || contextForUpdate.recommendedScale,
        };
        break;
      case 'start_scale':
        nextContext = {
          ...nextContext,
          state: 'handoff',
          consentGiven: true,
          recommendedScale: parsed.scaleId || contextForUpdate.recommendedScale,
        };
        break;
      case 'risk_escalation':
        nextContext = {
          ...nextContext,
          state: 'triage',
        };
        break;
      case 'acknowledge':
      case 'ask_followup':
      default: {
        const fallbackRecommendation =
          contextForUpdate.recommendedScale || recommendScaleFromSymptoms(contextForUpdate.symptoms, userMessage);
        const isFallbackTurn =
          parsed.action === 'acknowledge' &&
          !fallbackRecommendation &&
          !symptomsChanged &&
          (parsed.meta?.reason?.includes('irrelevant') || parsed.meta?.reason?.includes('plain'));

        const nextFallbackCount = isFallbackTurn ? fallbackCount + 1 : 0;
        setFallbackCount(nextFallbackCount);

        if (nextFallbackCount >= MAX_FALLBACKS) {
          replyText =
            language === 'en'
              ? 'Let us keep it simple. You can say things like: not speaking much, repeating actions, poor eye contact, or cannot sit still.'
              : '我们可以说得更简单一些。你可以直接说：不爱说话、重复动作、眼神少、坐不住。';
        }

        nextContext = {
          ...nextContext,
          state: fallbackRecommendation ? 'consent' : 'triage',
          recommendedScale: fallbackRecommendation,
          lastAssistantPrompt: replyText,
        };
        break;
      }
    }

    const finalReply: TriageAIResponse = {
      ...parsed,
      text: replyText,
    };

    lastAssistantPromptRef.current = replyText;
    setAssistantReply(finalReply);
    setTriageContext(nextContext);
    await saveSession(nextContext);

    addMessage({
      role: 'user',
      content: userMessage,
      action: 'triage',
    });
    addMessage({
      role: 'assistant',
      content: replyText,
      action: parsed.action,
    });

    void speakText(replyText, 'auto');

    if (parsed.action === 'start_scale' && parsed.scaleId) {
      await saveSession(nextContext, 'COMPLETED');
      await completeSession();
      setTimeout(() => {
        onStartScale(parsed.scaleId!);
      }, 1200);
    }
  }, [addMessage, completeSession, fallbackCount, language, onStartScale, saveSession, speakText, triageContext.symptoms.length]);

  const handleUserMessage = useCallback(async (userMessage: string) => {
    setIsProcessing(true);
    setError(null);
    setRepromptCount(0);

    try {
      const nextSymptoms = extractSymptomsFromTranscript(userMessage, triageContext.symptoms);
      const contextForAI: TriageContext = {
        ...triageContext,
        symptoms: nextSymptoms,
        language,
        lastAssistantPrompt: lastAssistantPromptRef.current || triageContext.lastAssistantPrompt,
        conversationHistory: [
          ...triageContext.conversationHistory,
          { role: 'user', content: userMessage, timestamp: Date.now() },
        ],
      };

      let parsed: TriageAIResponse;
      try {
        parsed = await fetchTriageIntent(userMessage, contextForAI);
      } catch {
        const localIntent = detectLocalTriageIntent(userMessage, contextForAI, language);
        parsed = localIntent || (await callTriageAI(userMessage, contextForAI));
      }

      const patchedParsed =
        parsed.action === 'acknowledge' && !parsed.scaleId && nextSymptoms.length >= 2
          ? {
              ...parsed,
              action: 'recommend_scale' as const,
              scaleId: parsed.scaleId || contextForAI.recommendedScale || recommendScaleFromSymptoms(nextSymptoms, userMessage),
              text:
                parsed.text ||
                buildScaleRecommendationCopy(
                  contextForAI.recommendedScale || recommendScaleFromSymptoms(nextSymptoms, userMessage) || 'SRS',
                  language
                ),
            }
          : parsed;

      setTranscript(userMessage);
      await applyParsedResponse(
        patchedParsed.action === 'recommend_scale' && !patchedParsed.scaleId
          ? {
              ...patchedParsed,
              scaleId: contextForAI.recommendedScale || recommendScaleFromSymptoms(nextSymptoms, userMessage) || undefined,
            }
          : patchedParsed,
        contextForAI,
        userMessage
      );
    } catch (triageError) {
      console.error('Triage error:', triageError);
      setError(triageError instanceof Error ? triageError.message : (language === 'en' ? 'Triage failed.' : '分诊处理失败。'));
    } finally {
      setIsProcessing(false);
    }
  }, [applyParsedResponse, callTriageAI, fetchTriageIntent, language, triageContext]);

  const uploadAndTranscribe = useCallback(async (audioBlob: Blob) => {
    setIsTranscribing(true);

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('context', 'triage');

      if (!skillToken) {
        throw new Error('Skill session is not ready yet.');
      }

      const response = await fetch('/api/skill/v1/speech/transcribe', {
        method: 'POST',
        headers: { Authorization: `Bearer ${skillToken}` },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || (language === 'en' ? 'Transcription failed.' : '语音识别失败。'));
      }

      const data = await response.json();
      if (!data.success || !data.text) {
        throw new Error(language === 'en' ? 'No valid speech was detected.' : '未识别到有效语音。');
      }

      setRemainingQuota(data.remaining);
      await handleUserMessage(data.text);
    } catch (transcriptionError) {
      console.error('Transcription error:', transcriptionError);
      setError(
        transcriptionError instanceof Error
          ? transcriptionError.message
          : (language === 'en' ? 'Transcription failed.' : '语音识别失败。')
      );
    } finally {
      setIsTranscribing(false);
    }
  }, [handleUserMessage, language, skillToken]);

  const toggleRecording = useCallback(() => {
    if (isTranscribing || isProcessing) {
      return;
    }

    setError(null);
    if (isRecording) {
      stopRecording();
      return;
    }

    setTranscript('');
    void startRecording();
  }, [isProcessing, isRecording, isTranscribing, startRecording, stopRecording]);

  const handlePauseToggle = useCallback(() => {
    const prompt =
      triageContext.state === 'paused'
        ? (language === 'en' ? 'Continue the triage session.' : '继续刚才的分诊。')
        : (language === 'en' ? 'Pause for now.' : '先暂停一下。');

    void handleUserMessage(prompt);
  }, [handleUserMessage, language, triageContext.state]);

  const handleReplayAssistant = useCallback(() => {
    const playbackSource =
      speechPlayback.pendingText ||
      lastAssistantPromptRef.current ||
      assistantReply?.text ||
      buildTriageContextLabel(triageContext.state, language);

    void speakText(playbackSource, 'manual');
  }, [assistantReply?.text, language, speakText, speechPlayback.pendingText, triageContext.state]);

  const handleUploadPlaceholder = useCallback(() => {
    const uploadHint =
      language === 'en'
        ? 'File upload is coming soon. You can directly describe the recent symptoms for now.'
        : '资料上传功能即将开放。你现在也可以直接口述最近的症状与困扰。';

    const uploadReply: TriageAIResponse = {
      text: uploadHint,
      action: 'acknowledge',
      confidence: 1,
      meta: {
        reason: 'upload_placeholder',
      },
    };

    setAssistantReply(uploadReply);
    lastAssistantPromptRef.current = uploadHint;
    setError(null);
    void speakText(uploadHint, 'manual');
  }, [language, speakText]);

  const callAssistantText =
    assistantReply?.text ||
    lastAssistantPromptRef.current ||
    (language === 'en'
      ? `Hello, I am your assessment assistant. Start with the most important recent change for ${profile.nickname || 'this family member'}.`
      : `你好，我是你的评测助手。你可以先从${profile.nickname || '当前家庭成员'}最近最困扰的情况开始说起。`);

  const callStatusText = isRecording
    ? (language === 'en' ? 'Listening...' : '正在听…')
    : isTranscribing
      ? (language === 'en' ? 'Transcribing...' : '正在识别…')
      : isProcessing
        ? (language === 'en' ? 'Analyzing...' : '正在分析…')
        : speechPlayback.isSpeaking
          ? (language === 'en' ? 'Speaking...' : '正在播报…')
          : triageContext.state === 'paused'
            ? (language === 'en' ? 'Paused' : '已暂停')
            : (language === 'en' ? 'Ready to listen' : '准备聆听');

  const callHintText = error ||
    speechPlayback.lastError ||
    (speechPlayback.pendingText && !speechPlayback.isUnlocked
      ? (language === 'en'
          ? 'Tap the play button once to start the voice guidance.'
          : '先点一次播放按钮，开启语音引导。')
      : language === 'en'
        ? 'You can talk naturally, or say repeat, explain, pause, and continue.'
        : '你可以自然描述情况，也可以直接说“重复一遍”“解释一下”“暂停”“继续”。');

  const canCloseCall = typeof onClose === 'function';

  if (mode === 'call') {
    return (
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_28%),radial-gradient(circle_at_center,rgba(236,72,153,0.10),transparent_24%),linear-gradient(180deg,#040404_0%,#08090f_52%,#020202_100%)]" />
        <div className="absolute inset-x-0 top-[12vh] mx-auto h-[42vw] w-[42vw] max-h-64 max-w-64 rounded-full bg-fuchsia-500/10 blur-[120px]" />
        <div className="absolute bottom-[18vh] left-1/2 h-[38vw] w-[38vw] max-h-56 max-w-56 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-[120px]" />

        <div className="relative flex min-h-0 flex-1 flex-col px-2 pt-3 sm:px-6">
          <div className="mx-auto flex min-h-0 w-full max-w-[min(100%,46rem)] flex-1 flex-col">
            <div className="flex-1 overflow-y-auto pb-4">
              <div className="space-y-4 sm:space-y-5">
                <div className="flex items-center justify-center">
                  <div className="inline-flex max-w-full items-center gap-3 rounded-full border border-white/10 bg-white/8 px-3 py-2 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:px-4 sm:py-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-400/15 text-xl sm:h-10 sm:w-10">
                      <span role="img" aria-label="briefcase">💼</span>
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-base font-semibold text-white sm:text-2xl">
                        {language === 'en' ? 'Voice Intake' : '模拟通话'}
                      </div>
                      <div className="truncate text-[10px] uppercase tracking-[0.24em] text-white/40 sm:text-[11px]">
                        {language === 'en' ? 'AI Assessment Assistant' : 'AI 语音评测助手'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-center text-[10px] uppercase tracking-[0.38em] text-white/35 sm:text-xs sm:tracking-[0.42em]">
                  {triageContext.state === 'consent'
                    ? (language === 'en' ? 'Recommended scale ready' : '推荐量表已就绪')
                    : triageContext.state === 'paused'
                      ? (language === 'en' ? 'Session paused' : '会话已暂停')
                      : (language === 'en' ? 'Live triage call' : '实时语音分诊')}
                </div>

                <div className="mx-auto max-h-[clamp(8rem,24vh,14rem)] max-w-[min(100%,21rem)] overflow-y-auto px-2 text-center text-[clamp(1.9rem,6.4vw,3rem)] font-medium leading-[1.34] text-white/92 sm:max-h-none sm:max-w-3xl sm:text-[clamp(2.4rem,4vw,3.5rem)] sm:leading-[1.42]">
                  {callAssistantText}
                </div>

                <div className="flex justify-center py-2 sm:py-6">
                  <div className="relative flex h-[min(72vw,18.5rem)] w-[min(72vw,18.5rem)] items-center justify-center sm:h-[min(46vw,24rem)] sm:w-[min(46vw,24rem)]">
                    <div
                      className={`absolute inset-0 rounded-full border border-white/8 bg-white/[0.03] transition-all ${
                        speechPlayback.isSpeaking || isRecording ? 'scale-[1.03] shadow-[0_0_70px_rgba(99,102,241,0.24)]' : 'scale-100'
                      }`}
                    />
                    <div
                      className={`absolute inset-[11%] rounded-full border transition-all ${
                        isRecording
                          ? 'border-emerald-300/35 animate-pulse'
                          : speechPlayback.isSpeaking
                            ? 'border-cyan-300/35 animate-pulse'
                            : 'border-white/10'
                      }`}
                    />
                    <div
                      className={`absolute inset-[23%] rounded-full blur-3xl transition-all ${
                        isRecording
                          ? 'bg-emerald-400/20'
                          : speechPlayback.isSpeaking
                            ? 'bg-fuchsia-400/16'
                            : 'bg-indigo-400/12'
                      }`}
                    />

                    <div className="relative flex h-[58%] w-[58%] items-center justify-center rounded-full border border-white/10 bg-[#12131a]/85 shadow-[0_30px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
                      <Avatar
                        state={{
                          ...profile.avatarState,
                          mood: isRecording ? 'curious' : speechPlayback.isSpeaking ? 'happy' : profile.avatarState.mood,
                        }}
                        gender={profile.gender}
                        className="h-[66%] w-[66%]"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-center gap-2">
                    {[0, 1, 2].map((dot) => (
                      <span
                        key={dot}
                        className={`h-3 w-3 rounded-full transition-all ${
                          isRecording || isProcessing || isTranscribing || speechPlayback.isSpeaking
                            ? 'animate-bounce bg-white'
                            : 'bg-white/25'
                        }`}
                        style={{ animationDelay: `${dot * 120}ms` }}
                      />
                    ))}
                  </div>

                  <div className="text-center text-[clamp(1.7rem,6vw,2.4rem)] font-medium tracking-tight text-white">
                    {callStatusText}
                  </div>

                  <div className="mx-auto max-w-[min(100%,20rem)] text-center text-sm leading-6 text-white/60 sm:max-w-2xl sm:text-base">
                    {callHintText}
                  </div>

                  {remainingQuota !== null && (
                    <div className="text-center text-[11px] uppercase tracking-[0.24em] text-white/35 sm:text-xs sm:tracking-[0.28em]">
                      {language === 'en' ? 'Remaining today' : '今日剩余'} · {remainingQuota}
                    </div>
                  )}

                  {triageContext.state === 'consent' && triageContext.recommendedScale && (
                    <div className="flex justify-center">
                      <button
                        onClick={() => onStartScale(triageContext.recommendedScale!)}
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_20px_50px_rgba(16,185,129,0.25)] transition-transform hover:scale-[1.02] hover:bg-emerald-400"
                      >
                        <span>
                          {language === 'en'
                            ? `Start ${triageContext.recommendedScale}`
                            : `开始 ${triageContext.recommendedScale} 评估`}
                        </span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="shrink-0 border-t border-white/6 pt-4 pb-[max(0.25rem,env(safe-area-inset-bottom))]">
              <div className="mx-auto flex w-full max-w-[22.5rem] items-end justify-between gap-3 sm:max-w-[26rem] sm:gap-4">
                <button
                  type="button"
                  onClick={toggleRecording}
                  disabled={isTranscribing || isProcessing}
                  className={`group flex h-[5.25rem] w-[5.25rem] items-center justify-center rounded-full transition-all sm:h-24 sm:w-24 ${
                    isTranscribing || isProcessing
                      ? 'cursor-not-allowed bg-white/10 text-white/40'
                      : isRecording
                        ? 'bg-emerald-500 text-white shadow-[0_0_40px_rgba(16,185,129,0.35)]'
                        : 'bg-white/10 text-white hover:bg-white/16'
                  }`}
                  aria-label={language === 'en' ? 'Toggle microphone' : '切换麦克风'}
                >
                  {isTranscribing || isProcessing ? (
                    <Loader2 className="h-8 w-8 animate-spin" />
                  ) : isRecording ? (
                    <MicOff className="h-8 w-8" />
                  ) : (
                    <Mic className="h-8 w-8" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleUploadPlaceholder}
                  className="flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-full bg-white/8 text-white/80 transition-colors hover:bg-white/14 sm:h-[4.5rem] sm:w-[4.5rem]"
                  aria-label={language === 'en' ? 'Upload supporting material' : '上传补充资料'}
                >
                  <FileUp className="h-6 w-6 sm:h-7 sm:w-7" />
                </button>

                <button
                  type="button"
                  onClick={speechPlayback.isSpeaking ? speechPlayback.stopPlayback : handleReplayAssistant}
                  disabled={!speechPlayback.pendingText && !lastAssistantPromptRef.current && !assistantReply?.text}
                  className="flex h-[3.75rem] w-[3.75rem] items-center justify-center rounded-full bg-white/8 text-white/80 transition-colors hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-40 sm:h-[4.5rem] sm:w-[4.5rem]"
                  aria-label={language === 'en' ? 'Play or stop assistant voice' : '播放或停止语音播报'}
                >
                  {speechPlayback.isSpeaking ? <Pause className="h-6 w-6 sm:h-7 sm:w-7" /> : <Volume2 className="h-6 w-6 sm:h-7 sm:w-7" />}
                </button>

                <button
                  type="button"
                  onClick={() => onClose?.()}
                  disabled={!canCloseCall}
                  className="flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-full bg-[#19191d] text-rose-500 transition-colors hover:bg-[#232329] hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-35 sm:h-24 sm:w-24"
                  aria-label={language === 'en' ? 'Close call mode' : '关闭通话模式'}
                >
                  <X className="h-9 w-9 sm:h-10 sm:w-10" />
                </button>
              </div>

              <div className="mt-5 text-center text-xs text-white/24">
                {language === 'en' ? 'AI-generated guidance' : '内容由 AI 生成'}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center">
      {assistantReply?.text && !isProcessing && (
        <div className={getTriageCardClasses('dock')}>
          <div className="flex items-start gap-2">
            <MessageCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
            <p className="text-sm leading-relaxed text-gray-700">{assistantReply.text}</p>
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
          <span className="text-xs font-medium">
            {isTranscribing
              ? (language === 'en' ? 'Transcribing...' : '正在识别语音...')
              : (language === 'en' ? 'Analyzing...' : '正在分析分诊内容...')}
          </span>
        </div>
      )}

      {transcript && !isProcessing && (
        <div className="mb-2 max-w-xs text-center text-xs text-gray-600">
          {language === 'en' ? 'You said:' : '您刚刚说：'} "{transcript}"
        </div>
      )}

      {remainingQuota !== null && !isRecording && !isTranscribing && !isProcessing && (
        <div className="mb-2 text-xs text-gray-500">
          {language === 'en' ? 'Remaining today:' : '今日剩余：'} {remainingQuota}
        </div>
      )}

      <div className="mb-3 text-center text-xs text-gray-500">
        {buildTriageContextLabel(triageContext.state, language)}
      </div>

      {triageContext.state === 'consent' && triageContext.recommendedScale && (
        <button
          onClick={() => onStartScale(triageContext.recommendedScale!)}
          className="mt-3 flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-2.5 font-bold text-white shadow-md transition-all hover:bg-emerald-600 active:scale-95"
        >
          <span>
            {language === 'en'
              ? `Start ${triageContext.recommendedScale} now`
              : `直接开始 ${triageContext.recommendedScale} 评估`}
          </span>
          <ArrowRight className="h-4 w-4" />
        </button>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={toggleRecording}
          disabled={isTranscribing || isProcessing}
          className={`relative flex h-16 w-16 items-center justify-center rounded-full shadow-lg transition-all ${
            isTranscribing || isProcessing
              ? 'cursor-not-allowed bg-gray-400'
              : isRecording
                ? 'animate-pulse bg-red-500 hover:bg-red-600'
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

          {isRecording && (
            <div className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping" />
          )}
        </button>

        <button
          onClick={handlePauseToggle}
          disabled={isRecording || isTranscribing || isProcessing}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 disabled:opacity-50 hover:bg-slate-50"
          aria-label={triageContext.state === 'paused' ? 'Resume triage' : 'Pause triage'}
        >
          {triageContext.state === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>

        <button
          onClick={() => void speakText(
            lastAssistantPromptRef.current || assistantReply?.text || buildTriageContextLabel(triageContext.state, language),
            'manual'
          )}
          disabled={isRecording || isTranscribing}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 disabled:opacity-50 hover:bg-slate-50"
          aria-label={language === 'en' ? 'Repeat assistant reply' : '重复播报'}
        >
          <Volume2 className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-2 text-center text-xs font-medium text-slate-500">
        {isTranscribing || isProcessing
          ? (language === 'en' ? 'Processing...' : '处理中...')
          : isRecording
            ? (language === 'en' ? 'Tap to stop recording' : '点击停止录音')
            : (language === 'en'
              ? 'Tap to speak. You can also say repeat, explain, pause, or continue.'
              : '点击开始说话。你也可以直接说“重复一遍”“解释一下”“暂停”“继续”。')}
      </p>

    </div>
  );
}
