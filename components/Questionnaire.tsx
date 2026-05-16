'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  ScaleAnswerDetailMap,
  LanguageCode,
  ScaleDefinition,
  ScaleResultDeliveryMode,
  ScaleScoreResult,
  ScaleSymptomOption,
  VoiceSessionMode,
} from '@/lib/schemas/core/types';
import {
  resolveFallbackExamples,
  resolveLocalizedText,
  resolveOptionDescription,
  resolveQuestionColloquial,
  resolveQuestionText,
  resolveSymptomOptionLabel,
} from '@/lib/schemas/core/i18n';
import { ChevronLeft, Mic, MicOff, Pause, Play, Volume2, Loader2, Sparkles, Wand2 } from 'lucide-react';

import { useProfile } from '@/contexts/ProfileContext';
import { useConversationHistory } from '@/contexts/ConversationHistoryContext';
import { useSkillSession } from '@/contexts/SkillSessionContext';
import { useVoiceSession } from '@/lib/services/useVoiceSession';
import { peekGuestSessionId } from '@/lib/utils/guestSession';

import Avatar from './Avatar';
import AssessmentResult from './AssessmentResult';
import { QuestionnaireOptionButton } from './questionnaire/Shared';

interface QuestionnaireProps {
  scale: ScaleDefinition;
  language?: LanguageCode;
}

type AnswerValue = number | null;

type AnswerDetailMap = Record<number, ScaleAnswerDetailMap[string]>;

function createEmptyAnswerDetail(): ScaleAnswerDetailMap[string] {
  return {
    estimated: false,
    selectedSymptomIds: [],
    primarySymptomId: undefined,
  };
}

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

function isCompletedAnswers(answers: AnswerValue[]): answers is number[] {
  return answers.every((answer) => answer !== null);
}

function updateAnswerAtIndex(
  answers: AnswerValue[],
  targetIndex: number,
  score: number
): AnswerValue[] {
  return answers.map((answer, index) => (index === targetIndex ? score : answer));
}

function getMinimumOptionScore(scale: ScaleDefinition, questionIndex: number): number {
  const question = scale.questions[questionIndex];
  return Math.min(...question.options.map((option) => option.score));
}

function resolveScaleVoiceMode(scale: ScaleDefinition): VoiceSessionMode {
  if (
    !scale.interactionMode ||
    scale.interactionMode === 'manual_only' ||
    scale.interactionMode === 'web_handoff'
  ) {
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

export default function Questionnaire({ scale, language = 'zh' }: QuestionnaireProps) {
  const { profile, updateProfile, updateAvatar, isGuest } = useProfile();
  const { messages, addMessage } = useConversationHistory();
  const { token: skillToken, memberId: skillMemberId } = useSkillSession();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswerValue[]>(() => createEmptyAnswers(scale.questions.length));
  const [answerDetails, setAnswerDetails] = useState<AnswerDetailMap>({});
  const [isComplete, setIsComplete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<ScaleScoreResult | null>(null);
  const [resultDeliveryMode, setResultDeliveryMode] = useState<ScaleResultDeliveryMode>(
    scale.resultDeliveryMode || 'immediate'
  );
  const [resultVisibleToRespondent, setResultVisibleToRespondent] = useState(
    (scale.resultDeliveryMode || 'immediate') === 'immediate'
  );
  const [remainingQuota, setRemainingQuota] = useState<number | null>(null);
  const [isAnalyzingHistory, setIsAnalyzingHistory] = useState(false);
  const [historyStatus, setHistoryStatus] = useState('');
  const [error, setError] = useState('');

  const voiceTranscriptLoggedRef = useRef<string>('');

  const currentQuestion = scale.questions[currentIndex];
  const voiceMode = resolveScaleVoiceMode(scale);
  const questionText = resolveQuestionText(currentQuestion, language);
  const colloquialText = resolveQuestionColloquial(currentQuestion, language);
  const fallbackExamples = resolveFallbackExamples(currentQuestion, language);
  const symptomOptions =
    currentQuestion?.symptomOptions?.map((option: ScaleSymptomOption) => ({
      id: option.id,
      label: resolveSymptomOptionLabel(option, language),
    })) || [];
  const currentAnswerDetail = answerDetails[currentQuestion?.id || -1] || createEmptyAnswerDetail();
  const hasSupportiveExplanation = Boolean(colloquialText && colloquialText !== questionText);
  const originalItemLabel = language === 'en' ? 'Standard Original Item' : '标准原题';
  const supportiveExplanationLabel = language === 'en' ? 'Supportive Explanation' : '辅助理解';
  const supportiveExplanationNote = language === 'en'
    ? 'For comprehension only. It does not replace the original item.'
    : '仅用于帮助理解，不替代量表原题。';
  const answeredCount = answers.filter((answer) => answer !== null).length;
  const progress = (answeredCount / scale.questions.length) * 100;
  const currentAnswerScore = answers[currentIndex];
  const requiresSymptomDetail =
    currentQuestion &&
    symptomOptions.length > 0 &&
    currentAnswerScore !== null &&
    currentAnswerScore > getMinimumOptionScore(scale, currentIndex);
  const canContinueWithSymptomDetail =
    !requiresSymptomDetail || (currentAnswerDetail.selectedSymptomIds || []).length > 0;

  useEffect(() => {
    setCurrentIndex(0);
    setAnswers(createEmptyAnswers(scale.questions.length));
    setAnswerDetails({});
    setIsComplete(false);
    setIsSaving(false);
    setResult(null);
    setResultDeliveryMode(scale.resultDeliveryMode || 'immediate');
    setResultVisibleToRespondent((scale.resultDeliveryMode || 'immediate') === 'immediate');
    setError('');
    setHistoryStatus('');
    voiceTranscriptLoggedRef.current = '';
  }, [scale.id, scale.questions.length]);

  useEffect(() => {
    if (!currentQuestion || isComplete) {
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
  }, [colloquialText, currentQuestion, isComplete, questionText, updateAvatar]);

  const fetchQuota = useCallback(async () => {
    if (typeof window === 'undefined') {
      return;
    }

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
    } catch (error) {
      console.error('Failed to fetch quota:', error);
    }
  }, [skillToken]);

  useEffect(() => {
    void fetchQuota();
  }, [fetchQuota]);

  const finalizeAssessment = useCallback(async (finalAnswers: number[], finalAnswerDetails: AnswerDetailMap) => {
    setIsSaving(true);

    try {
      if (!skillToken) {
        throw new Error(language === 'en' ? 'Skill session is not ready yet.' : 'Skill 会话尚未准备好，请稍后再试。');
      }

      const evaluateResponse = await fetch(`/api/skill/v1/scales/${encodeURIComponent(scale.id)}/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${skillToken}`,
        },
        body: JSON.stringify({
          memberId: skillMemberId || profile.id,
          answers: finalAnswers,
          answerDetails: finalAnswerDetails,
        }),
      });

      if (!evaluateResponse.ok) {
        const errorData = await evaluateResponse.json().catch(() => ({}));
        throw new Error(errorData.error || '量表评分失败');
      }

      const evaluationData = await evaluateResponse.json();
      const nextMode: ScaleResultDeliveryMode =
        evaluationData.resultDeliveryMode || scale.resultDeliveryMode || 'immediate';
      const nextVisible =
        typeof evaluationData.resultVisibleToRespondent === 'boolean'
          ? evaluationData.resultVisibleToRespondent
          : nextMode === 'immediate';
      const nextResult: ScaleScoreResult | null = evaluationData.result || null;

      setResult(nextResult);
      setResultDeliveryMode(nextMode);
      setResultVisibleToRespondent(nextVisible);
      setIsComplete(true);

      if (!profile.completedScales.includes(scale.id)) {
        updateProfile({
          completedScales: [...profile.completedScales, scale.id],
        });
      }

      updateAvatar({
        mood: 'happy',
        headwear: 'hu_tou_mao',
      });
      return;

      const deviceId = localStorage.getItem('device_id') ?? crypto.randomUUID();
      localStorage.setItem('device_id', deviceId);

      const saveResponse = await fetch(`/api/skill/v1/scales/${encodeURIComponent(scale.id)}/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${skillToken}`,
        },
        body: JSON.stringify({
          memberId: skillMemberId || profile.id,
          answers: finalAnswers,
        }),
      });

      if (!saveResponse.ok) {
        const errorData = await saveResponse.json().catch(() => ({}));
        throw new Error(errorData.error || '评估结果保存失败');
      }

      setResult(nextResult);
      setIsComplete(true);

      if (!profile.completedScales.includes(scale.id)) {
        updateProfile({
          completedScales: [...profile.completedScales, scale.id],
        });
      }

      updateAvatar({
        mood: 'happy',
        headwear: 'hu_tou_mao',
      });
    } catch (error) {
      console.error('Failed to finalize assessment:', error);
      const errorMessage = error instanceof Error ? error.message : '评估处理失败，请稍后重试';
      alert(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }, [language, profile.completedScales, profile.id, scale.id, skillMemberId, skillToken, updateAvatar, updateProfile]);

  const proceedToNextStep = useCallback(async (
    nextAnswers: AnswerValue[],
    nextAnswerDetails: AnswerDetailMap
  ) => {
    if (isCompletedAnswers(nextAnswers)) {
      await finalizeAssessment(nextAnswers, nextAnswerDetails);
      return;
    }

    if (currentIndex < scale.questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      return;
    }

    const fallbackUnansweredIndex = nextAnswers.findIndex((answer) => answer === null);
    if (fallbackUnansweredIndex !== -1) {
      setCurrentIndex(fallbackUnansweredIndex);
    }
  }, [currentIndex, finalizeAssessment, scale.questions.length]);

  const handleAnswer = useCallback(async (score: number) => {
    const nextAnswers = updateAnswerAtIndex(answers, currentIndex, score);
    setAnswers(nextAnswers);

    const shouldCollectSymptoms =
      symptomOptions.length > 0 &&
      score > getMinimumOptionScore(scale, currentIndex);

    if (shouldCollectSymptoms) {
      setError(language === 'en' ? 'Select relevant symptoms, then continue.' : '请选择相关症状后再继续。');
      return;
    }

    setError('');
    setAnswerDetails((previous) => {
      if (!(currentQuestion.id in previous)) {
        void proceedToNextStep(nextAnswers, previous);
        return previous;
      }

      const { [currentQuestion.id]: _removed, ...rest } = previous;
      void proceedToNextStep(nextAnswers, rest);
      return rest;
    });
  }, [answers, currentIndex, currentQuestion.id, language, proceedToNextStep, scale, symptomOptions.length]);

  const toggleSymptomSelection = useCallback((symptomId: string) => {
    setError('');
    setAnswerDetails((previous) => {
      const current = previous[currentQuestion.id] || createEmptyAnswerDetail();
      const selectedSymptomIds = current.selectedSymptomIds || [];
      const exists = selectedSymptomIds.includes(symptomId);

      if (exists) {
        const nextSelected = selectedSymptomIds.filter((item) => item !== symptomId);
        const nextPrimary =
          current.primarySymptomId === symptomId
            ? nextSelected[0]
            : current.primarySymptomId;

        return {
          ...previous,
          [currentQuestion.id]: {
            selectedSymptomIds: nextSelected,
            primarySymptomId: nextPrimary,
          },
        };
      }

      const nextSelected = [...selectedSymptomIds, symptomId];
      return {
        ...previous,
        [currentQuestion.id]: {
          ...current,
          selectedSymptomIds: nextSelected,
          primarySymptomId: current.primarySymptomId || symptomId,
        },
      };
    });
  }, [currentQuestion.id, language]);

  const setPrimarySymptom = useCallback((symptomId: string) => {
    setAnswerDetails((previous) => {
      const current = previous[currentQuestion.id] || createEmptyAnswerDetail();
      const selectedSymptomIds = current.selectedSymptomIds || [];
      if (!selectedSymptomIds.includes(symptomId)) {
        return previous;
      }

      return {
        ...previous,
        [currentQuestion.id]: {
          ...current,
          primarySymptomId: symptomId,
        },
      };
    });
  }, [currentQuestion.id]);

  const continueAfterSymptomSelection = useCallback(async () => {
    if (!canContinueWithSymptomDetail) {
      setError(language === 'en' ? 'Please choose at least 1 symptom.' : '请至少选择 1 个症状。');
      return;
    }

    setError('');
    await proceedToNextStep(answers, answerDetails);
  }, [answerDetails, answers, canContinueWithSymptomDetail, language, proceedToNextStep]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  }, [currentIndex]);

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
    mode: voiceMode,
    requiresConfirmation: scale.requiresConfirmation ?? voiceMode === 'voice_guided',
    question: currentQuestion,
    questionIndex: currentIndex,
    questionCount: scale.questions.length,
    currentAnswer: answers[currentIndex],
    onAnswer: handleAnswer,
    onPrevious: handlePrevious,
  });

  useEffect(() => {
    if (!voiceSession.lastUserTranscript || voiceSession.lastUserTranscript === voiceTranscriptLoggedRef.current) {
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
  }, [addMessage, fetchQuota, scale.id, voiceSession.lastUserTranscript]);

  const handleAnalyzeHistory = useCallback(async () => {
    if (!messages.length) {
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
          ...(skillToken ? { Authorization: `Bearer ${skillToken}` } : {}),
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
      const mergedAnswers = answers.map((answer, index) => answer ?? data.answers[index] ?? null);
      setAnswers(mergedAnswers);

      const firstUnansweredIndex = mergedAnswers.findIndex((answer) => answer === null);
      setHistoryStatus(
        language === 'en'
          ? `Extracted answers for ${data.coverage.answered}/${data.coverage.total} items${data.llmUsed ? ' with LLM support.' : ' using rule-based parsing.'}`
          : `已从聊天记录识别 ${data.coverage.answered}/${data.coverage.total} 题${data.llmUsed ? '，并结合了 LLM 提取。' : '，当前使用规则引擎兜底。'}`
      );

      if (firstUnansweredIndex === -1 && isCompletedAnswers(mergedAnswers)) {
        await finalizeAssessment(mergedAnswers, answerDetails);
        return;
      }

      if (firstUnansweredIndex !== -1) {
        setCurrentIndex(firstUnansweredIndex);
      }
    } catch (error) {
      console.error('Failed to analyze conversation history:', error);
      setHistoryStatus(error instanceof Error ? error.message : (language === 'en' ? 'Conversation analysis failed.' : '聊天记录分析失败'));
    } finally {
      setIsAnalyzingHistory(false);
    }
  }, [answers, finalizeAssessment, language, messages, scale.id, skillToken]);

  const voiceStatus = voiceSession.statusText || getDefaultVoiceStatus(language, voiceMode);

  if (isSaving) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-900 mb-2">
            {language === 'en' ? 'Generating assessment result...' : '正在生成评估结果...'}
          </h2>
          <p className="text-slate-600">
            {language === 'en'
              ? 'The final score is still calculated by the deterministic scoring engine. Please wait a moment.'
              : '系统仍会交给确定性评分引擎完成最终计算，请稍候。'}
          </p>
        </div>
      </div>
    );
  }

  if (isComplete) {
    let deviceId = '';
    if (typeof window !== 'undefined') {
      deviceId = peekGuestSessionId() || '';
    }

    return (
      <AssessmentResult
        result={result}
        scale={{
          id: scale.id,
          name: resolveLocalizedText(scale.title, language),
          resultDeliveryMode,
          questions: scale.questions.map((question) => ({
            id: question.id,
            text: resolveLocalizedText(question.text, language),
            options: question.options,
          })),
        }}
        answers={answers.filter((answer): answer is number => answer !== null)}
        deviceId={deviceId}
        language={language}
        resultDeliveryMode={resultDeliveryMode}
        resultVisibleToRespondent={resultVisibleToRespondent}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 relative">
      {isGuest && (
        <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {language === 'en'
            ? 'Guest self-assessment results are for reference only and do not carry medical or legal effect.'
            : '游客自测量表结果仅供参考，不具有医疗法律效应。'}
        </div>
      )}

      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:hidden">
        <Avatar
          state={profile.avatarState}
          gender={profile.gender}
          className="w-14 h-14"
        />
        <div>
          <div className="text-sm font-semibold text-slate-900">{profile.nickname}</div>
          <div className="text-xs text-slate-500">
            {language === 'en' ? 'Current subject' : '当前受测对象'}
          </div>
        </div>
      </div>

      <div className="fixed top-4 left-4 z-10 hidden rounded-2xl bg-white/90 p-3 shadow-lg backdrop-blur md:block">
        <Avatar
          state={profile.avatarState}
          gender={profile.gender}
          className="w-16 h-16"
        />
        <div className="text-center mt-1 text-xs font-medium text-slate-600">
          {profile.nickname}
        </div>
      </div>

      <div className="mb-6">
        <div className="flex justify-between text-sm text-slate-600 mb-2">
          <span>
            {language === 'en' ? 'Completed' : '已完成'} {answeredCount} / {scale.questions.length}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

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
                  ? 'The system extracts useful evidence from recent chat history and still hands the final scoring to the deterministic engine.'
                  : '系统会先抽取聊天中的有效信息，再交给确定性评分引擎计算最终结果。'}
              </p>
            </div>
            <button
              onClick={() => void handleAnalyzeHistory()}
              disabled={isAnalyzingHistory}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:bg-slate-400 transition-colors"
            >
              {isAnalyzingHistory
                ? (language === 'en' ? 'Analyzing...' : '分析中...')
                : (language === 'en' ? 'Analyze conversation' : '分析聊天记录')}
            </button>
          </div>
          {historyStatus && (
            <div className="mt-3 text-sm text-slate-600 bg-slate-50 rounded-xl px-3 py-2">
              {historyStatus}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div key={currentQuestion.id} className="bg-white rounded-2xl shadow-lg p-6 mb-4">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <div className="text-sm text-indigo-600 font-semibold mb-1">
              {language === 'en' ? 'Question' : '第'} {currentIndex + 1} {language === 'en' ? '' : '题'}
            </div>
            <p className="text-sm text-slate-500">
              {language === 'en'
                ? 'Please answer based on the standard original item below.'
                : '请以标准原题为依据作答。'}
            </p>
          </div>
          {answers[currentIndex] !== null && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600">
              {language === 'en' ? 'Answered' : '已有答案'}
            </span>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 mb-4">
          <div className="text-xs font-semibold tracking-wide text-slate-500">
            {originalItemLabel}
          </div>
          <h3 className="mt-2 text-xl font-semibold leading-8 text-slate-900">
            {questionText}
          </h3>
        </div>

        {currentQuestion.imageUrl ? (
          <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <img
              src={currentQuestion.imageUrl}
              alt={resolveLocalizedText(currentQuestion.imageAlt || currentQuestion.text, language)}
              className="w-full object-contain"
            />
          </div>
        ) : null}

        {hasSupportiveExplanation && (
          <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-4 mb-6">
            <div className="text-xs font-semibold tracking-wide text-amber-700">
              {supportiveExplanationLabel}
            </div>
            <p className="mt-2 text-sm leading-7 text-amber-900">
              {colloquialText}
            </p>
            <p className="mt-2 text-xs text-amber-700/80">
              {supportiveExplanationNote}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {currentQuestion.options.map((option, idx) => {
            const selected = answers[currentIndex] === option.score;
            const optionDescription = resolveOptionDescription(option, language);

            return (
              <QuestionnaireOptionButton
                key={`${currentQuestion.id}-${idx}`}
                label={option.label}
                description={optionDescription}
                selected={selected}
                selectedLabel={language === 'en' ? 'Selected' : '当前选择'}
                selectedDescription={language === 'en' ? 'Current answer' : '当前答案'}
                emphasis="strong"
                showSelector
                onClick={() => void handleAnswer(option.score)}
              />
            );
          })}
        </div>

        {requiresSymptomDetail && (
          <div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">
            <div className="text-sm font-semibold text-cyan-900">
              {language === 'en' ? 'Which symptoms are most relevant?' : '这一题主要涉及哪些症状？'}
            </div>
            <p className="mt-1 text-xs leading-6 text-cyan-800/80">
              {language === 'en'
                ? 'You can select one or multiple symptoms. If there are multiple, mark the most severe one.'
                : '可以单选或多选；如果不止 1 个，请标记最重的主症状。'}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              {symptomOptions.map((symptom) => {
                const selected = (currentAnswerDetail.selectedSymptomIds || []).includes(symptom.id);
                const isPrimary = currentAnswerDetail.primarySymptomId === symptom.id;
                return (
                  <button
                    key={symptom.id}
                    type="button"
                    onClick={() => toggleSymptomSelection(symptom.id)}
                    className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                      selected
                        ? 'border-cyan-300 bg-cyan-600 text-white'
                        : 'border-cyan-200 bg-white text-cyan-900 hover:bg-cyan-50'
                    }`}
                  >
                    {symptom.label}
                    {isPrimary ? ` ${language === 'en' ? '(Primary)' : '（主症状）'}` : ''}
                  </button>
                );
              })}
            </div>

            {(currentAnswerDetail.selectedSymptomIds || []).length > 1 && (
              <div className="mt-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                  {language === 'en' ? 'Primary Symptom' : '主症状'}
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {symptomOptions
                    .filter((symptom) => (currentAnswerDetail.selectedSymptomIds || []).includes(symptom.id))
                    .map((symptom) => {
                      const active = currentAnswerDetail.primarySymptomId === symptom.id;
                      return (
                        <button
                          key={`${symptom.id}-primary`}
                          type="button"
                          onClick={() => setPrimarySymptom(symptom.id)}
                          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                            active
                              ? 'border-slate-900 bg-slate-900 text-white'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {symptom.label}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => void continueAfterSymptomSelection()}
                disabled={!canContinueWithSymptomDetail}
                className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:bg-slate-400"
              >
                {currentIndex === scale.questions.length - 1
                  ? (language === 'en' ? 'Confirm and submit' : '确认并提交')
                  : (language === 'en' ? 'Confirm and continue' : '确认并继续')}
              </button>
            </div>
          </div>
        )}
      </div>

      {isSupported && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-4 mb-4 border border-indigo-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-indigo-600" />
              <span className="text-sm font-medium text-slate-700">
                {voiceMode === 'full_voice'
                  ? (language === 'en' ? 'Full voice mode' : '全语音模式')
                  : voiceMode === 'voice_guided'
                    ? (language === 'en' ? 'Voice-guided mode' : '语音引导模式')
                    : voiceMode === 'call_mode'
                      ? (language === 'en' ? 'Call mode' : '通话模式')
                      : (language === 'en' ? 'Voice answer assistant' : '语音答题助手')}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={speakCurrentQuestion}
                className="px-3 py-1.5 bg-white rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors text-sm text-indigo-700"
              >
                {language === 'en' ? 'Play prompt' : '播放题目'}
              </button>
              <button
                onClick={speakExplanation}
                className="px-3 py-1.5 bg-white rounded-lg border border-amber-200 hover:bg-amber-50 transition-colors text-sm text-amber-700 inline-flex items-center gap-1"
              >
                <Wand2 className="w-4 h-4" />
                {language === 'en' ? 'Explain' : '解释题意'}
              </button>
              <button
                onClick={togglePause}
                className="px-3 py-1.5 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-sm text-slate-700 inline-flex items-center gap-1"
              >
                {voiceSession.state === 'paused' ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {voiceSession.state === 'paused'
                  ? (language === 'en' ? 'Resume' : '继续')
                  : (language === 'en' ? 'Pause' : '暂停')}
              </button>
              <button
                onClick={toggleRecording}
                disabled={voiceSession.isTranscribing}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  voiceSession.isTranscribing
                    ? 'bg-slate-400 text-white cursor-not-allowed'
                    : voiceSession.isRecording
                      ? 'bg-rose-500 text-white animate-pulse'
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
                ? 'bg-rose-100 text-rose-700'
                : voiceSession.pendingConfirmation
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-white text-slate-700'
            }`}
          >
            {voiceStatus}
          </div>

          {voiceSession.pendingConfirmation && (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => void confirmPendingAnswer(true)}
                className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                {language === 'en' ? 'Yes, that is correct' : '对，就是这个选项'}
              </button>
              <button
                onClick={() => void confirmPendingAnswer(false)}
                className="px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                {language === 'en' ? 'No, ask again' : '不对，请再问一遍'}
              </button>
            </div>
          )}

          {remainingQuota !== null && (
            <div className="mt-2 text-xs text-slate-500 text-center">
              {language === 'en' ? 'Remaining today:' : '今日剩余：'} {remainingQuota}
            </div>
          )}

          <div className="mt-2 text-xs text-slate-500 text-center">
            {language === 'en'
              ? 'You can say things like “repeat”, “explain”, “previous”, or answer directly with the option text.'
              : '你可以说“重复一遍”“解释一下”“上一题”，也可以直接说选项内容。'}
          </div>
        </div>
      )}

      {fallbackExamples.length > 0 && (
        <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">{language === 'en' ? 'Follow-up hint' : '追问提示'}</p>
          <p>{fallbackExamples[0]}</p>
        </div>
      )}

      {currentIndex > 0 && (
        <button
          onClick={handlePrevious}
          className="mt-4 flex items-center text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          {language === 'en' ? 'Previous question' : '上一题'}
        </button>
      )}
    </div>
  );
}
