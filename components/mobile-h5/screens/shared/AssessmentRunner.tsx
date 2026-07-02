import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ChevronLeft,
  HelpCircle,
  Sparkles,
  X,
} from 'lucide-react';

import { Button } from '@/components/mobile-h5/components/ui/button';
import { cn } from '@/components/mobile-h5/lib/utils';
import {
  autoSaveLocal,
  autoSaveServer,
  clearLocalDraft,
  loadLatestLocalDraftForScale,
  loadLocalDraft,
} from '@/components/mobile-h5/services/assessmentService';
import type {
  Answer,
  AssessmentMode,
  AutoSaveStatus,
  Option,
  Question,
  Scale,
} from '@/components/mobile-h5/types';

import AutoSaveIndicator from './AutoSaveIndicator';
import OptionButton from './OptionButton';
import ProgressBar from './ProgressBar';
import QuestionCard from './QuestionCard';

export interface AssessmentRunnerProps {
  mode: AssessmentMode;
  questions: Question[];
  scale: Scale;
  patientInfo: { name: string; ageLabel: string };
  onComplete: (answers: Record<string, Answer>) => void | Promise<void>;
  onBack: () => void;
  showAi?: boolean;
  onOpenAi?: (question?: Question, questionNumber?: number) => void;
}

const SESSION_ID_PREFIX = 'session_';

const AssessmentRunner: React.FC<AssessmentRunnerProps> = ({
  mode,
  questions,
  scale,
  patientInfo,
  onComplete,
  onBack,
  showAi = false,
  onOpenAi,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [saveStatus, setSaveStatus] = useState<AutoSaveStatus>('saved');
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const isLocked = mode === 'caregiver_handoff_locked';
  const isDoctor = mode === 'doctor_assisted';
  const total = questions.length;
  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === total - 1;

  const [sessionId] = useState(
    () => `${SESSION_ID_PREFIX}${scale.id}:${mode}:${patientInfo.name || 'unknown'}`,
  );

  useEffect(() => {
    let cancelled = false;

    async function restoreDraft() {
      const draft =
        (await loadLocalDraft(sessionId)) ||
        (await loadLatestLocalDraftForScale(scale.id));

      if (!cancelled && draft && Object.keys(draft).length > 0) {
        setAnswers(draft);
        setSaveStatus('saved-locally');
      }
    }

    void restoreDraft();

    return () => {
      cancelled = true;
    };
  }, [scale.id, sessionId]);

  const flashToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
  }, []);

  useEffect(() => {
    if (!showToast) return;
    const timer = setTimeout(() => setShowToast(false), 2400);
    return () => clearTimeout(timer);
  }, [showToast]);

  const persistAnswers = useCallback(
    (updated: Record<string, Answer>) => {
      setSaveStatus('saving');
      autoSaveLocal(sessionId, updated);
      setSaveStatus('saved-locally');

      setSaveStatus('syncing');
      autoSaveServer(sessionId, updated)
        .then(() => setSaveStatus('saved'))
        .catch(() => setSaveStatus('failed'));
    },
    [sessionId],
  );

  const handleSelect = useCallback(
    (option: Option) => {
      if (!currentQuestion) return;

      const updated: Record<string, Answer> = {
        ...answers,
        [currentQuestion.id]: {
          questionId: currentQuestion.id,
          optionId: option.id,
          value: option.value,
          unsure: false,
          source: 'manual',
        },
      };

      setAnswers(updated);
      persistAnswers(updated);
    },
    [answers, currentQuestion, persistAnswers],
  );

  const handleMarkUnsure = useCallback(() => {
    if (!currentQuestion) return;
    const existing = answers[currentQuestion.id];
    if (!existing) {
      flashToast('请先选择一个选项');
      return;
    }

    const updated: Record<string, Answer> = {
      ...answers,
      [currentQuestion.id]: { ...existing, unsure: true },
    };

    setAnswers(updated);
    persistAnswers(updated);
    flashToast('已标记“家长不确定”');
  }, [answers, currentQuestion, flashToast, persistAnswers]);

  const handleNext = useCallback(async () => {
    if (!currentQuestion || submitting) return;
    if (!answers[currentQuestion.id]) {
      flashToast('请先选择一个选项');
      return;
    }

    if (!isLastQuestion) {
      setCurrentIndex((value) => value + 1);
      return;
    }

    setSubmitting(true);
    try {
      await Promise.resolve(onComplete(answers));
      await clearLocalDraft(sessionId, scale.id);
    } catch (error) {
      flashToast(error instanceof Error ? error.message : '提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }, [answers, currentQuestion, flashToast, isLastQuestion, onComplete, scale.id, sessionId, submitting]);

  const handlePrev = useCallback(() => {
    if (currentIndex === 0) {
      setShowExitConfirm(true);
    } else {
      setCurrentIndex((value) => value - 1);
    }
  }, [currentIndex]);

  const handleExitConfirm = useCallback(() => {
    setShowExitConfirm(false);
    autoSaveLocal(sessionId, answers);
    onBack();
  }, [answers, onBack, sessionId]);

  return (
    <div
      data-component="assessment-runner"
      className={cn(
        'flex min-h-[100dvh] w-full max-w-lg flex-col bg-[var(--seed-bg)] mx-auto',
        isLocked && 'locked-mode',
      )}
    >
      <header
        className="sticky top-0 z-30 bg-[var(--seed-bg)]/95 backdrop-blur-sm safe-top"
        data-hide-in-locked={isLocked || undefined}
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-3">
          <button
            type="button"
            onClick={handlePrev}
            disabled={submitting}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-smooth hover:bg-sage-50 disabled:opacity-50"
            aria-label="返回"
            data-hide-in-locked={isLocked || undefined}
          >
            <ChevronLeft size={22} className="text-foreground" />
          </button>

          <div className="flex-1 px-2 text-center">
            <h1 className="truncate text-sm font-medium text-foreground">{scale.name}</h1>
            {isDoctor && (
              <p className="truncate text-xs text-muted">
                {patientInfo.name} {patientInfo.ageLabel}
              </p>
            )}
          </div>

          <AutoSaveIndicator status={saveStatus} />
        </div>

        <div className="px-4 pb-3">
          <ProgressBar current={currentIndex + 1} total={total} />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pb-28 pt-2 no-scrollbar">
        <QuestionCard
          questionNumber={currentIndex + 1}
          questionText={currentQuestion?.text ?? ''}
          animationKey={String(currentIndex)}
        />

        <div className="mt-5 flex flex-col gap-3">
          {currentQuestion?.options.map((option) => (
            <OptionButton
              key={option.id}
              option={option}
              selected={answers[currentQuestion.id]?.optionId === option.id}
              onSelect={handleSelect}
            />
          ))}
        </div>

        {showAi && onOpenAi && currentQuestion && (
          <button
            type="button"
            onClick={() => onOpenAi(currentQuestion, currentIndex + 1)}
            className="mx-auto mt-5 flex items-center gap-1.5 text-sm text-sky-500 transition-smooth hover:text-sky-600"
            data-hide-in-locked={isLocked || undefined}
          >
            <Sparkles size={16} />
            <span>AI 辅助解释</span>
          </button>
        )}
      </main>

      <footer
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--seed-border)] bg-white/95 backdrop-blur-sm safe-bottom"
        data-hide-in-locked={isLocked || undefined}
      >
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePrev}
            disabled={submitting}
            className="flex-1"
          >
            上一题
          </Button>

          {isDoctor && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkUnsure}
              disabled={submitting}
              className="shrink-0"
            >
              <HelpCircle size={16} className="mr-1" />
              家长不确定
            </Button>
          )}

          <Button
            variant="default"
            size="sm"
            onClick={handleNext}
            disabled={submitting}
            className="flex-1"
          >
            {submitting ? '提交中...' : isLastQuestion ? '提交' : '下一题'}
          </Button>
        </div>
      </footer>

      {showToast && (
        <div className="pointer-events-none fixed left-0 right-0 top-16 z-50 flex justify-center">
          <div className="rounded-pill bg-foreground px-4 py-2 text-sm text-background shadow-soft">
            {toastMsg}
          </div>
        </div>
      )}

      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-6">
          <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-soft">
            <button
              type="button"
              onClick={() => setShowExitConfirm(false)}
              className="ml-auto flex h-8 w-8 items-center justify-center rounded-full hover:bg-cream-100"
              aria-label="关闭"
            >
              <X size={18} className="text-muted" />
            </button>

            <div className="mt-2 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-warm-50">
                <AlertTriangle size={24} className="text-warm-400" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">离开当前测评？</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                当前进度已保存在本机草稿中，下次进入同一量表时可以继续填写。
              </p>
            </div>

            <div className="mt-5 flex gap-3">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setShowExitConfirm(false)}
              >
                继续填写
              </Button>
              <Button
                type="button"
                variant="default"
                className="flex-1"
                onClick={handleExitConfirm}
              >
                保存并离开
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssessmentRunner;
