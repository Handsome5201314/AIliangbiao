'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { LanguageCode } from '@/lib/schemas/core/types';
import { AlertCircle, ArrowRight, Loader2, MessageCircle, Mic, MicOff, Pause, Play, Volume2 } from 'lucide-react';

import { useProfile, useConversationHistory } from '@/contexts';
import { useSkillSession } from '@/contexts/SkillSessionContext';
import { MAX_FALLBACKS, MAX_REPROMPTS, NO_INPUT_TIMEOUT_MS } from '@/lib/services/voiceRules';
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

interface TriageVoiceRecorderProps {
  onStartScale: (scaleId: string) => void;
  language?: LanguageCode;
  mode?: 'dock' | 'call';
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

  const speakText = useCallback((text: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'en' ? 'en-US' : 'zh-CN';
    utterance.rate = 0.92;
    lastAssistantPromptRef.current = text;
    window.speechSynthesis.speak(utterance);
  }, [language]);

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
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [fetchQuota, initTriage, language, loadSession]);

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
    speakText(introText);
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
        speakText(pauseText);
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
      speakText(repromptText);
    }, NO_INPUT_TIMEOUT_MS);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [isProcessing, isRecording, isTranscribing, language, mode, repromptCount, speakText, triageContext.state]);

  const startRecording = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
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
  }, [language]);

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

    speakText(replyText);

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

  return (
    <div className={`flex flex-col items-center ${mode === 'call' ? 'mx-auto max-w-3xl' : 'mx-auto max-w-md'}`}>
      {assistantReply?.text && !isProcessing && (
        <div className={getTriageCardClasses(mode)}>
          <div className="flex items-start gap-2">
            <MessageCircle className={`mt-0.5 h-4 w-4 flex-shrink-0 ${mode === 'call' ? 'text-cyan-300' : 'text-blue-600'}`} />
            <p className={`text-sm leading-relaxed ${mode === 'call' ? 'text-white/90' : 'text-gray-700'}`}>{assistantReply.text}</p>
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
              ? (language === 'en' ? 'Transcribing...' : '正在识别语音...')
              : (language === 'en' ? 'Analyzing...' : '正在分析分诊内容...')}
          </span>
        </div>
      )}

      {transcript && !isProcessing && (
        <div className={`mb-2 max-w-xs text-center text-xs ${mode === 'call' ? 'text-white/60' : 'text-gray-600'}`}>
          {language === 'en' ? 'You said:' : '您刚刚说：'} "{transcript}"
        </div>
      )}

      {remainingQuota !== null && !isRecording && !isTranscribing && !isProcessing && (
        <div className={`mb-2 text-xs ${mode === 'call' ? 'text-white/55' : 'text-gray-500'}`}>
          {language === 'en' ? 'Remaining today:' : '今日剩余：'} {remainingQuota}
        </div>
      )}

      <div className={`mb-3 text-center text-xs ${mode === 'call' ? 'text-white/60' : 'text-gray-500'}`}>
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

      <div className={`mt-3 flex items-center gap-2 ${mode === 'call' ? 'rounded-full border border-white/10 bg-white/5 px-4 py-3' : ''}`}>
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
          className={`flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-50 ${
            mode === 'call'
              ? 'border border-white/10 bg-white/10 text-white hover:bg-white/15'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
          aria-label={triageContext.state === 'paused' ? 'Resume triage' : 'Pause triage'}
        >
          {triageContext.state === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
        </button>

        <button
          onClick={() => speakText(lastAssistantPromptRef.current || assistantReply?.text || buildTriageContextLabel(triageContext.state, language))}
          disabled={isRecording || isTranscribing}
          className={`flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-50 ${
            mode === 'call'
              ? 'border border-white/10 bg-white/10 text-white hover:bg-white/15'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
          aria-label={language === 'en' ? 'Repeat assistant reply' : '重复播报'}
        >
          <Volume2 className="h-4 w-4" />
        </button>
      </div>

      <p className={`mt-2 text-center text-xs font-medium ${mode === 'call' ? 'text-white/55' : 'text-slate-500'}`}>
        {isTranscribing || isProcessing
          ? (language === 'en' ? 'Processing...' : '处理中...')
          : isRecording
            ? (language === 'en' ? 'Tap to stop recording' : '点击停止录音')
            : (language === 'en'
              ? 'Tap to speak. You can also say repeat, explain, pause, or continue.'
              : '点击开始说话。你也可以直接说“重复一遍”“解释一下”“暂停”“继续”。')}
      </p>

      {mode === 'call' && (
        <div className="mt-6 grid w-full gap-3 text-left text-sm text-white/70 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">No-Input</div>
            <p>
              {language === 'en'
                ? `If you stay silent for ${NO_INPUT_TIMEOUT_MS / 1000} seconds, I will gently reprompt and eventually pause.`
                : `如果 ${NO_INPUT_TIMEOUT_MS / 1000} 秒内没有回应，我会轻柔重问，并在多次无回应后自动暂停。`}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">No-Match</div>
            <p>
              {language === 'en'
                ? `If I still cannot understand after ${MAX_FALLBACKS} fallback tries, I will switch to simpler prompts.`
                : `如果连续 ${MAX_FALLBACKS} 次都没理解，我会自动切换成更简单的话术来引导。`}
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="mb-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Meta Intents</div>
            <p>
              {language === 'en'
                ? 'You can interrupt anytime and say repeat, explain, pause, continue, or start now.'
                : '你可以随时打断并直接说“重复一遍”“解释一下”“暂停”“继续”或“现在开始”。'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
