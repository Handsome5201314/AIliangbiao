'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  LanguageCode,
  ScaleDefinition,
  ScalePatientInfoField,
  ScaleScoreResult,
  VoiceSessionMode,
} from '@/lib/schemas/core/types';
import {
  resolveFallbackExamples,
  resolveLocalizedText,
  resolveQuestionColloquial,
  resolveQuestionText,
} from '@/lib/schemas/core/i18n';
import {
  answerSkillAssessmentSession,
  backSkillAssessmentSession,
  cancelSkillAssessmentSession,
  createSkillAssessmentSession,
  type AssessmentSessionClientState,
} from '@/lib/services/assessmentSessionClient';
import { ChevronLeft, Loader2, Mic, MicOff, Pause, Play, Sparkles, Volume2, Wand2 } from 'lucide-react';

import { useProfile } from '@/contexts/ProfileContext';
import { useConversationHistory } from '@/contexts/ConversationHistoryContext';
import { useSkillSession } from '@/contexts/SkillSessionContext';
import { useVoiceSession } from '@/lib/services/useVoiceSession';

import Avatar from './Avatar';
import AssessmentResult from './AssessmentResult';

interface QuestionnaireProps {
  scale: ScaleDefinition;
  language?: LanguageCode;
}

type AnswerValue = number | null;
type PatientInfoFormValue = Record<string, string>;
type SubmittedPatientInfo = Record<string, string | number | null>;

interface ConversationAnalysisResponse {
  coverage: {
    answered: number;
    total: number;
    ratio: number;
  };
  llmUsed: boolean;
  answers: AnswerValue[];
}

function createEmptyAnswers(questionCount: number): AnswerValue[] {
  return Array.from({ length: questionCount }, () => null);
}

function createEmptyPatientInfo(scale: ScaleDefinition): PatientInfoFormValue {
  return (scale.patientInfoFields ?? []).reduce<PatientInfoFormValue>((result, field) => {
    result[field.id] = '';
    return result;
  }, {});
}

function buildSubmittedPatientInfo(
  fields: ScalePatientInfoField[],
  values: PatientInfoFormValue
): SubmittedPatientInfo | undefined {
  if (!fields.length) {
    return undefined;
  }

  return fields.reduce<SubmittedPatientInfo>((result, field) => {
    const rawValue = values[field.id]?.trim() ?? '';
    result[field.id] = rawValue ? (field.type === 'number' ? Number(rawValue) : rawValue) : null;
    return result;
  }, {});
}

function validatePatientInfo(fields: ScalePatientInfoField[], values: PatientInfoFormValue): string | null {
  for (const field of fields) {
    const value = values[field.id]?.trim() ?? '';
    if (!value) {
      return `请填写${field.label}`;
    }
    if (field.type === 'number' && !Number.isFinite(Number(value))) {
      return `${field.label}需要填写数字`;
    }
    if (field.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return `${field.label}需要填写有效日期`;
    }
  }

  return null;
}

function resolveScaleVoiceMode(scale: ScaleDefinition): VoiceSessionMode {
  if (!scale.interactionMode || scale.interactionMode === 'manual_only') {
    return 'manual';
  }

  return scale.interactionMode;
}

function getDefaultVoiceStatus(language: LanguageCode, mode: VoiceSessionMode): string {
  if (language === 'en') {
    switch (mode) {
      case 'full_voice':
        return 'Full voice mode is ready. You can answer by voice or click an option.';
      case 'voice_guided':
        return 'Voice-guided mode is ready. You can ask me to repeat, explain, or go back.';
      case 'call_mode':
        return 'Call mode is ready. Voice prompts will guide you through the questionnaire.';
      default:
        return 'Voice answering is available. You can also answer manually.';
    }
  }

  switch (mode) {
    case 'full_voice':
      return '全语音模式已就绪，系统会自动播报题目，你也可以随时手动点选。';
    case 'voice_guided':
      return '语音引导模式已就绪，你可以直接回答，也可以说“重复一遍”“解释一下”“上一题”。';
    case 'call_mode':
      return '通话模式已就绪，系统会用语音一步步引导你完成量表。';
    default:
      return '语音答题助手已就绪，你也可以继续手动作答。';
  }
}

function getPatientFieldInputProps(field: ScalePatientInfoField) {
  if (field.type === 'number') {
    return { type: 'number', inputMode: 'numeric' as const };
  }

  if (field.type === 'date') {
    return { type: 'date', inputMode: undefined };
  }

  return { type: 'text', inputMode: undefined };
}

export default function Questionnaire({ scale, language = 'zh' }: QuestionnaireProps) {
  const { profile, updateProfile, updateAvatar } = useProfile();
  const { messages, addMessage } = useConversationHistory();
  const { token: skillToken, memberId: skillMemberId } = useSkillSession();

  const patientInfoFields = scale.patientInfoFields ?? [];
  const requiresPatientInfo = patientInfoFields.length > 0;
  const voiceMode = resolveScaleVoiceMode(scale);

  const [patientInfo, setPatientInfo] = useState<PatientInfoFormValue>(() => createEmptyPatientInfo(scale));
  const [submittedPatientInfo, setSubmittedPatientInfo] = useState<SubmittedPatientInfo | undefined>(() =>
    buildSubmittedPatientInfo(patientInfoFields, createEmptyPatientInfo(scale))
  );
  const [assessmentSession, setAssessmentSession] = useState<AssessmentSessionClientState | null>(null);
  const [answers, setAnswers] = useState<AnswerValue[]>(() => createEmptyAnswers(scale.questions.length));
  const [isPatientInfoStepActive, setIsPatientInfoStepActive] = useState(requiresPatientInfo);
  const [patientInfoError, setPatientInfoError] = useState('');
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [sessionError, setSessionError] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [result, setResult] = useState<ScaleScoreResult | null>(null);
  const [remainingQuota, setRemainingQuota] = useState<number | null>(null);
  const [isAnalyzingHistory, setIsAnalyzingHistory] = useState(false);
  const [historyStatus, setHistoryStatus] = useState('');

  const voiceTranscriptLoggedRef = useRef('');

  const currentIndex = assessmentSession?.currentQuestionIndex ?? 0;
  const currentQuestion =
    assessmentSession?.currentQuestion ??
    scale.questions[Math.max(0, Math.min(currentIndex, scale.questions.length - 1))];
  const questionText = resolveQuestionText(currentQuestion, language);
  const colloquialText = resolveQuestionColloquial(currentQuestion, language);
  const fallbackExamples = resolveFallbackExamples(currentQuestion, language);
  const answeredCount = assessmentSession?.answeredCount ?? answers.filter((answer) => answer !== null).length;
  const progress = scale.questions.length === 0 ? 0 : (answeredCount / scale.questions.length) * 100;

  const syncSessionState = useCallback((nextSession: AssessmentSessionClientState) => {
    setAssessmentSession(nextSession);
    setAnswers(nextSession.answers);
    if (nextSession.formData) {
      setSubmittedPatientInfo(nextSession.formData);
    }

    if (nextSession.status === 'completed' && nextSession.result) {
      setResult(nextSession.result);
      setIsComplete(true);
    } else {
      setResult(null);
      setIsComplete(false);
    }
  }, []);

  const bootstrapSession = useCallback(
    async (nextFormData?: SubmittedPatientInfo) => {
      if (!skillToken) {
        return false;
      }

      setIsLoadingSession(true);
      setSessionError('');

      try {
        const nextSession = await createSkillAssessmentSession({
          scaleId: scale.id,
          skillToken,
          memberId: skillMemberId || profile.id,
          formData: nextFormData,
          channel: voiceMode === 'manual' ? 'web' : 'voice',
        });
        syncSessionState(nextSession);
        return true;
      } catch (error) {
        setSessionError(error instanceof Error ? error.message : '无法创建评估会话');
        return false;
      } finally {
        setIsLoadingSession(false);
      }
    },
    [profile.id, scale.id, skillMemberId, skillToken, syncSessionState, voiceMode]
  );

  useEffect(() => {
    const nextPatientInfo = createEmptyPatientInfo(scale);
    setPatientInfo(nextPatientInfo);
    setSubmittedPatientInfo(buildSubmittedPatientInfo(scale.patientInfoFields ?? [], nextPatientInfo));
    setAssessmentSession(null);
    setAnswers(createEmptyAnswers(scale.questions.length));
    setIsPatientInfoStepActive(Boolean(scale.patientInfoFields?.length));
    setPatientInfoError('');
    setSessionError('');
    setIsComplete(false);
    setResult(null);
    setHistoryStatus('');
    voiceTranscriptLoggedRef.current = '';
  }, [scale]);

  useEffect(() => {
    if (!skillToken || requiresPatientInfo || assessmentSession || isComplete) {
      return;
    }

    void bootstrapSession();
  }, [assessmentSession, bootstrapSession, isComplete, requiresPatientInfo, skillToken]);

  useEffect(() => {
    if (!currentQuestion || isComplete || isPatientInfoStepActive) {
      return;
    }

    const normalizedQuestionText = questionText.toLowerCase();
    const normalizedColloquialText = colloquialText.toLowerCase();

    if (
      normalizedQuestionText.includes('社交') ||
      normalizedQuestionText.includes('退缩') ||
      normalizedColloquialText.includes('不理') ||
      normalizedColloquialText.includes('害怕') ||
      normalizedQuestionText.includes('焦虑')
    ) {
      updateAvatar({ mood: 'nervous' });
    } else if (
      normalizedQuestionText.includes('兴趣') ||
      normalizedQuestionText.includes('喜欢') ||
      normalizedColloquialText.includes('喜欢') ||
      normalizedColloquialText.includes('有趣')
    ) {
      updateAvatar({ mood: 'curious' });
    } else if (
      normalizedQuestionText.includes('快乐') ||
      normalizedQuestionText.includes('开心') ||
      normalizedColloquialText.includes('开心') ||
      normalizedColloquialText.includes('笑')
    ) {
      updateAvatar({ mood: 'happy' });
    } else {
      updateAvatar({ mood: 'normal' });
    }
  }, [colloquialText, currentQuestion, isComplete, isPatientInfoStepActive, questionText, updateAvatar]);

  useEffect(() => {
    if (!isComplete || profile.completedScales.includes(scale.id)) {
      return;
    }

    updateProfile({
      completedScales: [...profile.completedScales, scale.id],
    });
    updateAvatar({
      mood: 'happy',
      headwear: 'hu_tou_mao',
    });
  }, [isComplete, profile.completedScales, scale.id, updateAvatar, updateProfile]);

  const fetchQuota = useCallback(async () => {
    if (typeof window === 'undefined' || !skillToken) {
      return;
    }

    try {
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
    } catch (error) {
      console.error('Failed to fetch quota:', error);
    }
  }, [skillToken]);

  useEffect(() => {
    void fetchQuota();
  }, [fetchQuota]);

  const handlePatientInfoChange = useCallback((fieldId: string, value: string) => {
    setPatientInfo((current) => ({
      ...current,
      [fieldId]: value,
    }));
    setPatientInfoError('');
  }, []);

  const handlePatientInfoSubmit = useCallback(async () => {
    const validationError = validatePatientInfo(patientInfoFields, patientInfo);
    if (validationError) {
      setPatientInfoError(validationError);
      return;
    }

    const nextFormData = buildSubmittedPatientInfo(patientInfoFields, patientInfo);
    setSubmittedPatientInfo(nextFormData);
    setPatientInfoError('');

    if (assessmentSession && skillToken) {
      try {
        await cancelSkillAssessmentSession({
          sessionId: assessmentSession.sessionId,
          skillToken,
        });
      } catch (error) {
        console.error('Failed to cancel stale session before recreating:', error);
      }
    }

    const success = await bootstrapSession(nextFormData);
    if (success) {
      setIsPatientInfoStepActive(false);
    }
  }, [assessmentSession, bootstrapSession, patientInfo, patientInfoFields, skillToken]);

  const submitCurrentAnswer = useCallback(
    async (score: number) => {
      if (!assessmentSession || !skillToken || !currentQuestion) {
        throw new Error('Assessment session is not ready yet.');
      }

      setIsLoadingSession(true);
      setSessionError('');

      try {
        const nextSession = await answerSkillAssessmentSession({
          sessionId: assessmentSession.sessionId,
          skillToken,
          score,
          questionId: currentQuestion.id,
        });
        syncSessionState(nextSession);
      } catch (error) {
        const message = error instanceof Error ? error.message : '提交答案失败';
        setSessionError(message);
        throw error;
      } finally {
        setIsLoadingSession(false);
      }
    },
    [assessmentSession, currentQuestion, skillToken, syncSessionState]
  );

  const handleAnswer = useCallback(
    async (score: number) => {
      try {
        await submitCurrentAnswer(score);
      } catch (error) {
        console.error('Failed to submit answer:', error);
      }
    },
    [submitCurrentAnswer]
  );

  const handlePrevious = useCallback(async () => {
    if (!assessmentSession || !skillToken) {
      return;
    }

    if ((assessmentSession.currentQuestionIndex ?? 0) === 0 && requiresPatientInfo) {
      setIsPatientInfoStepActive(true);
      return;
    }

    setIsLoadingSession(true);
    setSessionError('');

    try {
      const nextSession = await backSkillAssessmentSession({
        sessionId: assessmentSession.sessionId,
        skillToken,
      });
      syncSessionState(nextSession);
    } catch (error) {
      setSessionError(error instanceof Error ? error.message : '返回上一题失败');
    } finally {
      setIsLoadingSession(false);
    }
  }, [assessmentSession, requiresPatientInfo, skillToken, syncSessionState]);

  const {
    session: voiceSession,
    isSupported,
    toggleRecording,
    speakCurrentQuestion,
    speakExplanation,
    togglePause,
    confirmPendingAnswer,
  } = useVoiceSession({
    scaleId: scale.id,
    skillToken,
    language,
    mode: isPatientInfoStepActive || !assessmentSession ? 'manual' : voiceMode,
    requiresConfirmation: scale.requiresConfirmation ?? voiceMode === 'voice_guided',
    question: currentQuestion,
    questionIndex: currentIndex,
    questionCount: scale.questions.length,
    currentAnswer: answers[currentIndex] ?? null,
    onAnswer: handleAnswer,
    onPrevious: () => void handlePrevious(),
  });

  useEffect(() => {
    if (
      isPatientInfoStepActive ||
      !voiceSession.lastUserTranscript ||
      voiceSession.lastUserTranscript === voiceTranscriptLoggedRef.current
    ) {
      return;
    }

    addMessage({
      role: 'user',
      content: voiceSession.lastUserTranscript,
      scaleId: scale.id,
      action: 'question',
    });
    voiceTranscriptLoggedRef.current = voiceSession.lastUserTranscript;
    void fetchQuota();
  }, [addMessage, fetchQuota, isPatientInfoStepActive, scale.id, voiceSession.lastUserTranscript]);

  const handleAnalyzeHistory = useCallback(async () => {
    if (!messages.length || !assessmentSession || !skillToken) {
      setHistoryStatus(language === 'en' ? 'No conversation history is available yet.' : '还没有可分析的聊天记录。');
      return;
    }

    setIsAnalyzingHistory(true);
    setHistoryStatus('');

    try {
      const response = await fetch(`/api/skill/v1/scales/${encodeURIComponent(scale.id)}/analyze-conversation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${skillToken}`,
        },
        body: JSON.stringify({
          messages: messages.slice(-20).map((message) => ({
            role: message.role,
            content: message.content,
            timestamp: message.timestamp,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || (language === 'en' ? 'Conversation analysis failed.' : '聊天记录分析失败'));
      }

      const data: ConversationAnalysisResponse = await response.json();
      let nextSession = assessmentSession;
      let autoApplied = 0;

      while (
        nextSession.status === 'questioning' &&
        nextSession.currentQuestionIndex !== null &&
        data.answers[nextSession.currentQuestionIndex] !== null &&
        nextSession.currentQuestion
      ) {
        const suggestedScore = data.answers[nextSession.currentQuestionIndex];
        if (suggestedScore === null || suggestedScore === undefined) {
          break;
        }

        nextSession = await answerSkillAssessmentSession({
          sessionId: nextSession.sessionId,
          skillToken,
          score: suggestedScore,
          questionId: nextSession.currentQuestion.id,
        });
        autoApplied += 1;
      }

      syncSessionState(nextSession);
      setHistoryStatus(
        language === 'en'
          ? `Applied ${autoApplied} suggested answers in sequence. Extracted evidence for ${data.coverage.answered}/${data.coverage.total} items.`
          : `已顺序应用 ${autoApplied} 个建议答案，共从聊天记录识别 ${data.coverage.answered}/${data.coverage.total} 题。`
      );
    } catch (error) {
      console.error('Failed to analyze conversation history:', error);
      setHistoryStatus(error instanceof Error ? error.message : (language === 'en' ? 'Conversation analysis failed.' : '聊天记录分析失败'));
    } finally {
      setIsAnalyzingHistory(false);
    }
  }, [assessmentSession, language, messages, scale.id, skillToken, syncSessionState]);

  const voiceStatus = voiceSession.statusText || getDefaultVoiceStatus(language, voiceMode);

  if (isLoadingSession && !assessmentSession && !isPatientInfoStepActive) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">正在准备评估会话...</h2>
          <p className="text-gray-600">系统正在初始化量表会话并同步当前成员信息，请稍候。</p>
        </div>
      </div>
    );
  }

  if (isComplete && result) {
    let deviceId = '';
    if (typeof window !== 'undefined') {
      deviceId = localStorage.getItem('device_id') || '';
    }

    return (
      <AssessmentResult
        result={result}
        scale={scale}
        answers={answers.filter((answer): answer is number => answer !== null)}
        deviceId={deviceId}
        language={language}
        formData={submittedPatientInfo}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 relative">
      <div className="fixed top-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-2xl p-3 shadow-lg">
        <Avatar state={profile.avatarState} gender={profile.gender} className="w-16 h-16" />
        <div className="text-center mt-1 text-xs font-medium text-gray-600">{profile.nickname}</div>
      </div>

      {sessionError && (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {sessionError}
        </div>
      )}

      {(scale.importantNotice || scale.instructions || scale.reference) && (
        <div className="bg-white rounded-2xl shadow-lg p-5 mb-4 border border-slate-100">
          <h2 className="text-xl font-bold text-slate-900 mb-3">{resolveLocalizedText(scale.title, language)}</h2>
          <div className="space-y-3 text-sm text-slate-700">
            {scale.importantNotice && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
                <p className="font-semibold mb-1">重要提示</p>
                <p className="whitespace-pre-wrap">{resolveLocalizedText(scale.importantNotice, language)}</p>
              </div>
            )}
            {scale.instructions && (
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="font-semibold mb-1 text-slate-900">填写说明</p>
                <p className="whitespace-pre-wrap">{resolveLocalizedText(scale.instructions, language)}</p>
              </div>
            )}
            {scale.reference && (
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="font-semibold mb-1 text-slate-900">参考文献</p>
                <p className="whitespace-pre-wrap">{resolveLocalizedText(scale.reference, language)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>
            {language === 'en' ? 'Completed' : '已完成'} {answeredCount} / {scale.questions.length}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-indigo-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {isPatientInfoStepActive ? (
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
          <div className="mb-5">
            <div className="text-sm text-indigo-600 font-semibold mb-1">步骤 1 / 2</div>
            <h3 className="text-xl font-bold text-slate-900">填写基础信息</h3>
            <p className="mt-2 text-sm text-slate-500">该量表要求先填写受测者基础信息，以下字段均为必填。</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {patientInfoFields.map((field) => {
              const inputProps = getPatientFieldInputProps(field);
              return (
                <label key={field.id} className="block">
                  <span className="block text-sm font-medium text-slate-700 mb-2">{field.label}</span>
                  <input
                    {...inputProps}
                    value={patientInfo[field.id] || ''}
                    onChange={(event) => handlePatientInfoChange(field.id, event.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition-colors focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </label>
              );
            })}
          </div>

          {patientInfoError && (
            <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{patientInfoError}</div>
          )}

          <div className="mt-6 flex justify-end">
            <button
              onClick={() => void handlePatientInfoSubmit()}
              disabled={isLoadingSession}
              className="px-5 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:bg-slate-400"
            >
              {isLoadingSession ? '创建会话中...' : '开始答题'}
            </button>
          </div>
        </div>
      ) : !assessmentSession ? (
        <div className="bg-white rounded-2xl shadow-lg p-6 text-center text-sm text-slate-500">
          正在等待评估会话初始化...
        </div>
      ) : (
        <>
          {messages.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-4 mb-4 border border-indigo-100">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2 text-indigo-700 font-semibold">
                    <Sparkles className="w-4 h-4" />
                    <span>{language === 'en' ? 'Generate draft answers from conversation' : '聊天记录自动生成建议答案'}</span>
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    {language === 'en'
                      ? 'The system extracts useful evidence from recent chat history and submits sequential answers through the session engine.'
                      : '系统会先抽取聊天中的有效信息，再通过统一会话引擎顺序提交建议答案。'}
                  </p>
                </div>
                <button
                  onClick={() => void handleAnalyzeHistory()}
                  disabled={isAnalyzingHistory || isLoadingSession}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:bg-slate-400 transition-colors"
                >
                  {isAnalyzingHistory ? (language === 'en' ? 'Analyzing...' : '分析中...') : language === 'en' ? 'Analyze conversation' : '分析聊天记录'}
                </button>
              </div>
              {historyStatus && <div className="mt-3 text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2">{historyStatus}</div>}
            </div>
          )}

          <div key={currentQuestion.id} className="bg-white rounded-2xl shadow-lg p-6 mb-4">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="text-sm text-indigo-600 font-semibold mb-1">
                  {language === 'en' ? 'Question' : '第'} {currentIndex + 1} {language === 'en' ? '' : '题'}
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{colloquialText}</h3>
              </div>
              {answers[currentIndex] !== null && (
                <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600">
                  {language === 'en' ? 'Answered' : '已有答案'}
                </span>
              )}
            </div>

            <p className="text-sm text-gray-500 mb-6 italic">
              {language === 'en' ? 'Original item:' : '原题：'} {questionText}
            </p>

            <div className="space-y-3">
              {currentQuestion.options.map((option, idx) => {
                const selected = answers[currentIndex] === option.score;
                return (
                  <button
                    key={`${currentQuestion.id}-${idx}`}
                    onClick={() => void handleAnswer(option.score)}
                    disabled={isLoadingSession}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                      selected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:bg-indigo-50'
                    } disabled:opacity-60`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{option.label}</div>
                        {option.description && (
                          <div className="mt-1 text-sm leading-6 text-slate-500">{option.description}</div>
                        )}
                      </div>
                      {selected && <span className="text-xs text-indigo-600 font-semibold">{language === 'en' ? 'Selected' : '当前选择'}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {isSupported && (
            <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-4 mb-4 border border-indigo-100">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-indigo-600" />
                  <span className="text-sm font-medium text-gray-700">
                    {voiceMode === 'full_voice'
                      ? language === 'en'
                        ? 'Full voice mode'
                        : '全语音模式'
                      : voiceMode === 'voice_guided'
                        ? language === 'en'
                          ? 'Voice-guided mode'
                          : '语音引导模式'
                        : voiceMode === 'call_mode'
                          ? language === 'en'
                            ? 'Call mode'
                            : '通话模式'
                          : language === 'en'
                            ? 'Voice answer assistant'
                            : '语音答题助手'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={speakCurrentQuestion} className="px-3 py-1.5 bg-white rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors text-sm text-indigo-700">播放题目</button>
                  <button onClick={speakExplanation} className="px-3 py-1.5 bg-white rounded-lg border border-amber-200 hover:bg-amber-50 transition-colors text-sm text-amber-700 inline-flex items-center gap-1">
                    <Wand2 className="w-4 h-4" />
                    {language === 'en' ? 'Explain' : '解释题意'}
                  </button>
                  <button onClick={togglePause} className="px-3 py-1.5 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-sm text-slate-700 inline-flex items-center gap-1">
                    {voiceSession.state === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    {voiceSession.state === 'paused' ? (language === 'en' ? 'Resume' : '继续') : language === 'en' ? 'Pause' : '暂停'}
                  </button>
                  <button
                    onClick={toggleRecording}
                    disabled={voiceSession.isTranscribing || isLoadingSession}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                      voiceSession.isTranscribing
                        ? 'bg-gray-400 text-white cursor-not-allowed'
                        : voiceSession.isRecording
                          ? 'bg-red-500 text-white animate-pulse'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                  >
                    {voiceSession.isTranscribing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {language === 'en' ? 'Parsing...' : '识别中'}
                      </>
                    ) : voiceSession.isRecording ? (
                      <>
                        <MicOff className="w-4 h-4" />
                        {language === 'en' ? 'Stop' : '停止'}
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4" />
                        {language === 'en' ? 'Voice answer' : '语音答题'}
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div
                className={`text-sm text-center py-3 px-3 rounded-lg ${
                  voiceSession.error || voiceSession.riskSignal
                    ? 'bg-red-100 text-red-700'
                    : voiceSession.pendingConfirmation
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-white text-gray-700'
                }`}
              >
                {voiceStatus}
              </div>

              {voiceSession.pendingConfirmation && (
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  <button onClick={() => void confirmPendingAnswer(true)} className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors">
                    {language === 'en' ? 'Yes, that is correct' : '对，就是这个选项'}
                  </button>
                  <button onClick={() => void confirmPendingAnswer(false)} className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">
                    {language === 'en' ? 'No, ask again' : '不对，请再问一遍'}
                  </button>
                </div>
              )}

              {remainingQuota !== null && (
                <div className="mt-2 text-xs text-gray-500 text-center">
                  {language === 'en' ? 'Remaining today:' : '今日剩余：'} {remainingQuota}
                </div>
              )}
            </div>
          )}

          {fallbackExamples.length > 0 && (
            <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-semibold mb-1">{language === 'en' ? 'Follow-up hint' : '追问提示'}</p>
              <p>{fallbackExamples[0]}</p>
            </div>
          )}

          <button
            onClick={() => void handlePrevious()}
            disabled={isLoadingSession}
            className="mt-4 flex items-center text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50"
          >
            <ChevronLeft className="w-5 h-5 mr-1" />
            {language === 'en' ? 'Previous question' : '上一题'}
          </button>
        </>
      )}
    </div>
  );
}
