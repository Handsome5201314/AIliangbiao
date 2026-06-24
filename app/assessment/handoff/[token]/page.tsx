'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';

import {
  QuestionnaireOptionButton,
  QuestionnaireProgress,
  QuestionnaireQuestionCard,
} from '@/components/questionnaire/Shared';

type LanguageCode = 'zh' | 'en';
type AnswerValue = number | null;

type AnswerDetailValue = {
  estimated?: boolean;
  selectedSymptomIds?: string[];
  primarySymptomId?: string;
  confidence?: number;
  evidence?: string;
  source?: 'manual' | 'ai_mapped' | 'user_confirmed_mapping';
  confirmedLowConfidence?: boolean;
};

type AnswerDetailMap = Record<number, AnswerDetailValue>;

type HandoffQuestion = {
  id: number;
  text: string;
  colloquial: string;
  fallback_examples: string[];
  sectionKey?: string;
  sectionLabel?: string;
  subsectionKey?: string;
  subsectionLabel?: string;
  ageBandLabel?: string;
  supportsEstimate?: boolean;
  domainKey?: string;
  localQuestionNumber?: number;
  symptomOptions?: Array<{
    id: string;
    label: string;
  }>;
  options: Array<{
    label: string;
    score: number;
    description?: string;
  }>;
};

type HandoffPayload = {
  session: {
    sessionId: string;
    scaleId: string;
    language: LanguageCode;
    interactionMode: string;
    resultDeliveryMode?: string;
    resultVisibleToRespondent?: boolean;
    status: string;
    answers: AnswerValue[];
    progress: {
      answered: number;
      total: number;
      remaining: number;
      ratio: number;
      currentQuestionIndex: number | null;
    };
    result: {
      totalScore: number;
      conclusion: string;
      details?: Record<string, unknown>;
    } | null;
  };
  scale: {
    id: string;
    title: string;
    description: string;
    resultDeliveryMode?: string;
    questions: HandoffQuestion[];
  };
};

type QuestionGroup = {
  key: string;
  title: string;
  subtitle?: string;
  questionIndexes: number[];
  ageBands: Array<{
    label: string;
    firstQuestionIndex: number;
  }>;
};

function createEmptyAnswerDetail(): AnswerDetailValue {
  return {
    estimated: false,
    selectedSymptomIds: [],
    primarySymptomId: undefined,
  };
}

function getMinimumOptionScore(question: HandoffQuestion) {
  return Math.min(...question.options.map((option) => option.score));
}

function getDefaultCopy(language: LanguageCode) {
  if (language === 'en') {
    return {
      unavailableTitle: 'This assessment link is unavailable',
      activeHint: 'Please answer every item according to the standard question stem.',
      submittedTitle: 'Submitted successfully',
      submittedBody:
        'Your answers have been received. Please return to the chat and tell the agent that you have finished.',
      physicianReviewBody:
        'Your answers have been submitted successfully. Please wait for the physician to review the assessment result.',
      expiredTitle: 'This handoff session is no longer active',
      expiredBody:
        'The session may have expired, been cancelled, or already completed. Please return to the chat for the next step.',
      questionLabel: 'Question',
      questionHint: 'Please answer based on the standard original item below.',
      originalItemLabel: 'Standard Original Item',
      supportiveExplanationLabel: 'Supportive Explanation',
      supportiveExplanationNote:
        'For comprehension only. It does not replace the original item.',
      answeredLabel: 'Answered',
      selectedLabel: 'Selected',
      submitLabel: 'Submit assessment',
      submittingLabel: 'Submitting...',
      symptomTitle: 'Which symptoms are most relevant?',
      symptomHint:
        'You can select one or multiple symptoms. If there are multiple, mark the most severe one.',
      primarySymptomLabel: 'Primary Symptom',
      symptomRequired: 'Select at least one related symptom for highlighted items.',
      estimateLabel: 'Estimated',
      estimateHint: 'Tick this when the answer is an estimate rather than direct observation.',
      sectionNav: 'Jump to section',
      ageNav: 'Jump to age band',
      backLabel: 'Back',
      retryLabel: 'Retry',
      goBackLabel: 'Return to chat',
      expandLabel: 'Expand',
      collapseLabel: 'Collapse',
    };
  }

  return {
    unavailableTitle: '当前量表链接不可用',
    activeHint: '请根据标准原题完成全部作答。',
    submittedTitle: '提交成功',
    submittedBody: '系统已经收到你的答案。请回到对话里告诉智能体“我填完了”。',
    physicianReviewBody: '量表已提交，等待医生审核评估结果。',
    expiredTitle: '当前 handoff 会话已结束',
    expiredBody: '这次会话可能已经过期、取消或提交完成，请回到对话继续下一步。',
    questionLabel: '题目',
    questionHint: '请以标准原题为依据作答。',
    originalItemLabel: '标准原题',
    supportiveExplanationLabel: '辅助理解',
    supportiveExplanationNote: '仅用于帮助理解，不替代量表原题。',
    answeredLabel: '已作答',
    selectedLabel: '当前选择',
    submitLabel: '提交量表',
    submittingLabel: '提交中...',
    symptomTitle: '这一题主要涉及哪些症状？',
    symptomHint: '可以单选或多选；如果不止 1 个，请标记最主要的症状。',
    primarySymptomLabel: '主症状',
    symptomRequired: '存在症状明细题未补充，请至少选择 1 个相关症状。',
    estimateLabel: '估计',
    estimateHint: '如果这一题不是直接观察所得，而是基于了解进行估计，请勾选。',
    sectionNav: '跳转到分部',
    ageNav: '跳转到年龄段',
    backLabel: '返回上一页',
    retryLabel: '重试',
    goBackLabel: '返回对话',
    expandLabel: '展开',
    collapseLabel: '收起',
  };
}

function buildQuestionGroups(questions: HandoffQuestion[]) {
  const groups: QuestionGroup[] = [];
  const groupMap = new Map<string, QuestionGroup>();

  questions.forEach((question, questionIndex) => {
    const sectionTitle = question.sectionLabel || question.sectionKey || `Section ${questionIndex + 1}`;
    const subtitle = question.subsectionLabel;
    const groupKey = question.subsectionKey
      ? `${question.sectionKey || 'section'}:${question.subsectionKey}`
      : `${question.sectionKey || 'section'}`;

    let group = groupMap.get(groupKey);
    if (!group) {
      group = {
        key: groupKey,
        title: sectionTitle,
        subtitle,
        questionIndexes: [],
        ageBands: [],
      };
      groupMap.set(groupKey, group);
      groups.push(group);
    }

    group.questionIndexes.push(questionIndex);

    const ageLabel = question.ageBandLabel || '未分组';
    const lastAgeBand = group.ageBands[group.ageBands.length - 1];
    if (!lastAgeBand || lastAgeBand.label !== ageLabel) {
      group.ageBands.push({
        label: ageLabel,
        firstQuestionIndex: questionIndex,
      });
    }
  });

  return groups;
}

export default function AssessmentHandoffPage() {
  const params = useParams();
  const token = String(params?.token || '');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [payload, setPayload] = useState<HandoffPayload | null>(null);
  const [answers, setAnswers] = useState<AnswerValue[]>([]);
  const [answerDetails, setAnswerDetails] = useState<AnswerDetailMap>({});
  const [error, setError] = useState('');
  const [validationError, setValidationError] = useState('');
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const language = payload?.session.language || 'zh';
  const copy = useMemo(() => getDefaultCopy(language), [language]);

  const loadPayload = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/assessment/handoff/${token}`);
      const nextPayload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(nextPayload.error || copy.unavailableTitle);
      }

      const parsed = nextPayload as HandoffPayload;
      setPayload(parsed);
      setAnswers(
        parsed.session.answers.length
          ? parsed.session.answers
          : Array.from({ length: parsed.scale.questions.length }, () => null)
      );

      const groups = buildQuestionGroups(parsed.scale.questions);
      setCollapsedGroups(
        groups.reduce<Record<string, boolean>>((result, group, index) => {
          result[group.key] = index !== 0;
          return result;
        }, {})
      );
      setAnswerDetails({});
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy.unavailableTitle);
    } finally {
      setLoading(false);
    }
  }, [copy.unavailableTitle, token]);

  useEffect(() => {
    void loadPayload();
  }, [loadPayload]);

  const questionList = payload?.scale.questions || [];
  const groups = useMemo(() => buildQuestionGroups(questionList), [questionList]);
  const answeredCount = answers.filter((answer) => answer !== null).length;
  const progressPercent = questionList.length ? (answeredCount / questionList.length) * 100 : 0;

  const unresolvedSymptomQuestionIds = questionList
    .filter((question, index) => {
      const selectedScore = answers[index];
      if (selectedScore === null || !question.symptomOptions?.length) {
        return false;
      }

      return (
        selectedScore > getMinimumOptionScore(question) &&
        ((answerDetails[question.id]?.selectedSymptomIds || []).length || 0) === 0
      );
    })
    .map((question) => question.id);

  const persistDraft = useCallback(async (
    nextAnswers: AnswerValue[],
    nextAnswerDetails: AnswerDetailMap = answerDetails
  ) => {
    if (!payload || !token || payload.session.status === 'COMPLETED') {
      return;
    }

    try {
      const response = await fetch(`/api/assessment/handoff/${token}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          answers: nextAnswers,
          answerDetails: nextAnswerDetails,
        }),
      });
      const nextPayload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(nextPayload.error || copy.unavailableTitle);
      }
    } catch (draftError) {
      setValidationError(
        draftError instanceof Error ? draftError.message : copy.unavailableTitle
      );
    }
  }, [answerDetails, copy.unavailableTitle, payload, token]);

  const handleAnswer = useCallback((questionIndex: number, score: number) => {
    const question = questionList[questionIndex];
    const requiresSymptoms =
      Boolean(question.symptomOptions?.length) &&
      score > getMinimumOptionScore(question);

    setAnswers((previous) => {
      const nextAnswers = previous.map((answer, index) =>
        index === questionIndex ? score : answer
      );
      void persistDraft(nextAnswers);
      return nextAnswers;
    });
    setValidationError('');

    setAnswerDetails((previous) => {
      if (requiresSymptoms) {
        const nextAnswerDetails = {
          ...previous,
          [question.id]: previous[question.id] || createEmptyAnswerDetail(),
        };
        void persistDraft(answers.map((answer, index) =>
          index === questionIndex ? score : answer
        ), nextAnswerDetails);
        return nextAnswerDetails;
      }

      if (!(question.id in previous)) {
        return previous;
      }

      const existing = previous[question.id];
      if (existing?.estimated) {
        const nextAnswerDetails = {
          ...previous,
          [question.id]: {
            estimated: true,
            selectedSymptomIds: [],
            primarySymptomId: undefined,
          },
        };
        void persistDraft(answers.map((answer, index) =>
          index === questionIndex ? score : answer
        ), nextAnswerDetails);
        return nextAnswerDetails;
      }

      const { [question.id]: _removed, ...rest } = previous;
      void persistDraft(answers.map((answer, index) =>
        index === questionIndex ? score : answer
      ), rest);
      return rest;
    });
  }, [answers, persistDraft, questionList]);

  const toggleEstimated = useCallback((questionId: number) => {
    setAnswerDetails((previous) => {
      const current = previous[questionId] || createEmptyAnswerDetail();
      const nextAnswerDetails = {
        ...previous,
        [questionId]: {
          ...current,
          estimated: !current.estimated,
          selectedSymptomIds: current.selectedSymptomIds || [],
        },
      };
      void persistDraft(answers, nextAnswerDetails);
      return nextAnswerDetails;
    });
  }, [answers, persistDraft]);

  const toggleSymptomSelection = useCallback((questionId: number, symptomId: string) => {
    setValidationError('');
    setAnswerDetails((previous) => {
      const current = previous[questionId] || createEmptyAnswerDetail();
      const selectedSymptomIds = current.selectedSymptomIds || [];
      const exists = selectedSymptomIds.includes(symptomId);

      if (exists) {
        const nextSelected = selectedSymptomIds.filter((item) => item !== symptomId);
        const nextAnswerDetails = {
          ...previous,
          [questionId]: {
            ...current,
            selectedSymptomIds: nextSelected,
            primarySymptomId:
              current.primarySymptomId === symptomId ? nextSelected[0] : current.primarySymptomId,
          },
        };
        void persistDraft(answers, nextAnswerDetails);
        return nextAnswerDetails;
      }

      const nextSelected = [...selectedSymptomIds, symptomId];
      const nextAnswerDetails = {
        ...previous,
        [questionId]: {
          ...current,
          selectedSymptomIds: nextSelected,
          primarySymptomId: current.primarySymptomId || symptomId,
        },
      };
      void persistDraft(answers, nextAnswerDetails);
      return nextAnswerDetails;
    });
  }, [answers, persistDraft]);

  const setPrimarySymptom = useCallback((questionId: number, symptomId: string) => {
    setAnswerDetails((previous) => {
      const current = previous[questionId] || createEmptyAnswerDetail();
      const selectedSymptomIds = current.selectedSymptomIds || [];
      if (!selectedSymptomIds.includes(symptomId)) {
        return previous;
      }

      const nextAnswerDetails = {
        ...previous,
        [questionId]: {
          ...current,
          primarySymptomId: symptomId,
        },
      };
      void persistDraft(answers, nextAnswerDetails);
      return nextAnswerDetails;
    });
  }, [answers, persistDraft]);

  const toggleGroup = useCallback((groupKey: string) => {
    setCollapsedGroups((previous) => ({
      ...previous,
      [groupKey]: !previous[groupKey],
    }));
  }, []);

  const jumpToQuestion = useCallback((questionIndex: number) => {
    if (typeof window === 'undefined') {
      return;
    }

    const question = questionList[questionIndex];
    if (!question) {
      return;
    }

    const groupKey = question.subsectionKey
      ? `${question.sectionKey || 'section'}:${question.subsectionKey}`
      : `${question.sectionKey || 'section'}`;

    setCollapsedGroups((previous) => ({
      ...previous,
      [groupKey]: false,
    }));

    window.requestAnimationFrame(() => {
      const element = document.getElementById(`handoff-question-${question.id}`);
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [questionList]);

  const handleSubmit = useCallback(async () => {
    if (!payload) {
      return;
    }

    setAttemptedSubmit(true);

    if (answers.some((answer) => answer === null)) {
      setValidationError(
        language === 'en'
          ? 'Please finish every question before submitting.'
          : '请先完成全部题目后再提交。'
      );
      return;
    }

    if (unresolvedSymptomQuestionIds.length > 0) {
      setValidationError(copy.symptomRequired);
      return;
    }

    setSubmitting(true);
    setValidationError('');

    try {
      const response = await fetch(`/api/assessment/handoff/${token}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          answers,
          answerDetails,
        }),
      });
      const nextPayload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(nextPayload.error || copy.unavailableTitle);
      }

      setPayload(nextPayload as HandoffPayload);
    } catch (submitError) {
      setValidationError(
        submitError instanceof Error ? submitError.message : copy.unavailableTitle
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    answerDetails,
    answers,
    copy.symptomRequired,
    copy.unavailableTitle,
    language,
    payload,
    token,
    unresolvedSymptomQuestionIds.length,
  ]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
          <p className="mt-3 text-sm text-slate-500">
            {language === 'en' ? 'Loading assessment...' : '正在加载量表...'}
          </p>
        </div>
      </div>
    );
  }

  if (error && !payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">{copy.unavailableTitle}</h1>
          <p className="mt-3 text-sm leading-7 text-slate-500">{error}</p>
          <button
            type="button"
            onClick={() => void loadPayload()}
            className="mt-6 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-600"
          >
            {copy.retryLabel}
          </button>
        </div>
      </div>
    );
  }

  if (!payload) {
    return null;
  }

  const isSubmitted = payload.session.status === 'COMPLETED';
  const isTerminal = ['CANCELLED', 'EXPIRED'].includes(payload.session.status);
  const physicianReviewMode =
    payload.session.resultDeliveryMode === 'physician_review' ||
    payload.session.resultVisibleToRespondent === false ||
    payload.scale.resultDeliveryMode === 'physician_review';

  if (isSubmitted || isTerminal) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            {isSubmitted ? copy.submittedTitle : copy.expiredTitle}
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            {isSubmitted
              ? (physicianReviewMode ? copy.physicianReviewBody : copy.submittedBody)
              : copy.expiredBody}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-600"
            >
              {copy.goBackLabel}
            </button>
            <button
              type="button"
              onClick={() => void loadPayload()}
              className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {copy.retryLabel}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id="agent-handoff-page"
      data-agent-live-kind="handoff"
      data-agent-live-session={payload.session.sessionId}
      data-agent-live-scale={payload.session.scaleId}
      data-agent-live-status={payload.session.status}
      data-agent-live-answered={answeredCount}
      data-agent-live-total={questionList.length}
      className="min-h-screen bg-slate-50 px-4 py-8"
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">{payload.scale.title}</h1>
              <p className="mt-3 text-sm leading-7 text-slate-500">
                {payload.scale.description}
              </p>
              <p className="mt-3 text-sm text-indigo-700">{copy.activeHint}</p>
            </div>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{copy.backLabel}</span>
            </button>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <QuestionnaireProgress
            answeredCount={answeredCount}
            total={questionList.length}
            progressPercent={progressPercent}
            language={language}
          />

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {copy.sectionNav}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {groups.map((group) => (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => jumpToQuestion(group.questionIndexes[0])}
                    className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    {group.title}
                    {group.subtitle ? ` · ${group.subtitle}` : ''}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {copy.ageNav}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {groups.flatMap((group) =>
                  group.ageBands.map((ageBand) => (
                    <button
                      key={`${group.key}-${ageBand.label}`}
                      type="button"
                      onClick={() => jumpToQuestion(ageBand.firstQuestionIndex)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      {ageBand.label}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {groups.map((group) => {
              const isCollapsed = collapsedGroups[group.key];
              const groupAnswered = group.questionIndexes.filter(
                (questionIndex) => answers[questionIndex] !== null
              ).length;

              return (
                <section
                  key={group.key}
                  className="rounded-3xl border border-slate-200 bg-slate-50/60 p-4"
                >
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    className="flex w-full items-center justify-between gap-4 text-left"
                  >
                    <div>
                      <div className="text-lg font-semibold text-slate-900">
                        {group.title}
                        {group.subtitle ? ` · ${group.subtitle}` : ''}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        {groupAnswered} / {group.questionIndexes.length}
                      </div>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                      {isCollapsed ? copy.expandLabel : copy.collapseLabel}
                      {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                    </span>
                  </button>

                  {!isCollapsed ? (
                    <div className="mt-4 space-y-5">
                      {group.questionIndexes.map((questionIndex) => {
                        const question = questionList[questionIndex];
                        const currentAnswer = answers[questionIndex];
                        const requiresSymptomDetail =
                          currentAnswer !== null &&
                          Boolean(question.symptomOptions?.length) &&
                          currentAnswer > getMinimumOptionScore(question);
                        const currentAnswerDetail = answerDetails[question.id] || createEmptyAnswerDetail();
                        const showSymptomWarning =
                          attemptedSubmit &&
                          requiresSymptomDetail &&
                          (currentAnswerDetail.selectedSymptomIds || []).length === 0;

                        return (
                          <div
                            key={question.id}
                            id={`handoff-question-${question.id}`}
                            data-agent-live-kind="handoff-question"
                            data-agent-live-question-id={question.id}
                            data-agent-live-question-index={questionIndex + 1}
                            data-agent-live-answered={currentAnswer !== null}
                          >
                            <QuestionnaireQuestionCard
                              index={questionIndex + 1}
                              total={questionList.length}
                              questionText={question.text}
                              supportiveExplanation={
                                question.colloquial && question.colloquial !== question.text
                                  ? question.colloquial
                                  : undefined
                              }
                              supportiveExplanationNote={copy.supportiveExplanationNote}
                              originalItemLabel={copy.originalItemLabel}
                              supportiveExplanationLabel={copy.supportiveExplanationLabel}
                              questionLabel={copy.questionLabel}
                              questionHint={`${copy.questionHint}${question.ageBandLabel ? ` · ${question.ageBandLabel}` : ''}`}
                              answered={currentAnswer !== null}
                              answeredLabel={copy.answeredLabel}
                              media={
                                question.supportsEstimate ? (
                                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                    <label className="flex cursor-pointer items-start gap-3">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(currentAnswerDetail.estimated)}
                                        onChange={() => toggleEstimated(question.id)}
                                        className="mt-1 h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                                      />
                                      <span>
                                        <span className="font-semibold">{copy.estimateLabel}</span>
                                        <span className="mt-1 block text-xs leading-6 text-amber-800/80">
                                          {copy.estimateHint}
                                        </span>
                                      </span>
                                    </label>
                                  </div>
                                ) : null
                              }
                            >
                              <div className="space-y-3">
                                {question.options.map((option) => (
                                  <QuestionnaireOptionButton
                                    key={`${question.id}-${option.score}`}
                                    label={option.label}
                                    description={option.description}
                                    selected={currentAnswer === option.score}
                                    selectedLabel={copy.selectedLabel}
                                    selectedDescription={language === 'en' ? 'Current answer' : '当前答案'}
                                    emphasis="strong"
                                    showSelector
                                    onClick={() => handleAnswer(questionIndex, option.score)}
                                  />
                                ))}
                              </div>

                              {requiresSymptomDetail && question.symptomOptions?.length ? (
                                <div className="mt-5 rounded-2xl border border-cyan-100 bg-cyan-50/70 p-4">
                                  <div className="text-sm font-semibold text-cyan-900">
                                    {copy.symptomTitle}
                                  </div>
                                  <p className="mt-1 text-xs leading-6 text-cyan-800/80">
                                    {copy.symptomHint}
                                  </p>

                                  <div className="mt-4 flex flex-wrap gap-2">
                                    {question.symptomOptions.map((symptom) => {
                                      const selected =
                                        (currentAnswerDetail.selectedSymptomIds || []).includes(symptom.id);
                                      const isPrimary =
                                        currentAnswerDetail.primarySymptomId === symptom.id;
                                      return (
                                        <button
                                          key={symptom.id}
                                          type="button"
                                          onClick={() => toggleSymptomSelection(question.id, symptom.id)}
                                          className={`rounded-full border px-3 py-2 text-sm font-medium transition-colors ${
                                            selected
                                              ? 'border-cyan-300 bg-cyan-600 text-white'
                                              : 'border-cyan-200 bg-white text-cyan-900 hover:bg-cyan-50'
                                          }`}
                                        >
                                          {symptom.label}
                                          {isPrimary
                                            ? ` ${language === 'en' ? '(Primary)' : '（主症状）'}`
                                            : ''}
                                        </button>
                                      );
                                    })}
                                  </div>

                                  {(currentAnswerDetail.selectedSymptomIds || []).length > 1 ? (
                                    <div className="mt-4">
                                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
                                        {copy.primarySymptomLabel}
                                      </div>
                                      <div className="mt-2 flex flex-wrap gap-2">
                                        {question.symptomOptions
                                          .filter((symptom) =>
                                            (currentAnswerDetail.selectedSymptomIds || []).includes(symptom.id)
                                          )
                                          .map((symptom) => {
                                            const active =
                                              currentAnswerDetail.primarySymptomId === symptom.id;
                                            return (
                                              <button
                                                key={`${symptom.id}-primary`}
                                                type="button"
                                                onClick={() => setPrimarySymptom(question.id, symptom.id)}
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
                                  ) : null}

                                  {showSymptomWarning ? (
                                    <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                                      {copy.symptomRequired}
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </QuestionnaireQuestionCard>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </section>
              );
            })}
          </div>

          {validationError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {validationError}
            </div>
          ) : null}

          <div
            id="handoff-submit"
            data-agent-live-kind="handoff-submit"
            data-agent-live-pending-action="submit_assessment"
            className="mt-6 flex justify-end"
          >
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-600 disabled:bg-slate-400"
            >
              {submitting ? copy.submittingLabel : copy.submitLabel}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
