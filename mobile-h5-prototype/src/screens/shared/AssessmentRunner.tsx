import React, { useState, useCallback, useEffect } from 'react';
import {
  ChevronLeft,
  HelpCircle,
  X,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import ProgressBar from './ProgressBar';
import QuestionCard from './QuestionCard';
import OptionButton from './OptionButton';
import AutoSaveIndicator from './AutoSaveIndicator';
import { autoSaveLocal, autoSaveServer } from '@/services/assessmentService';
import type {
  AssessmentMode,
  Question,
  Scale,
  Answer,
  Option,
  AutoSaveStatus,
} from '@/types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface AssessmentRunnerProps {
  mode: AssessmentMode;
  questions: Question[];
  scale: Scale;
  patientInfo: { name: string; ageLabel: string };
  onComplete: (answers: Record<string, Answer>) => void;
  onBack: () => void;
  showAi?: boolean;
  onOpenAi?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SESSION_ID_PREFIX = 'session_';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

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
  /* ---------- state ---------- */
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [saveStatus, setSaveStatus] = useState<AutoSaveStatus>('saved');
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const isLocked = mode === 'caregiver_handoff_locked';
  const isDoctor = mode === 'doctor_assisted';
  const total = questions.length;
  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === total - 1;

  // Generate a stable session id for auto-save
  const [sessionId] = useState(
    () => `${SESSION_ID_PREFIX}${scale.id}_${Date.now()}`,
  );

  /* ---------- toast helper ---------- */
  const flashToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setShowToast(true);
  }, []);

  useEffect(() => {
    if (!showToast) return;
    const timer = setTimeout(() => setShowToast(false), 2000);
    return () => clearTimeout(timer);
  }, [showToast]);

  /* ---------- auto-save ---------- */
  const persistAnswers = useCallback(
    (updated: Record<string, Answer>) => {
      // 1. synchronous local save
      setSaveStatus('saving');
      autoSaveLocal(sessionId, updated);
      setSaveStatus('saved-locally');

      // 2. async server save
      setSaveStatus('syncing');
      autoSaveServer(sessionId, updated)
        .then(() => setSaveStatus('saved'))
        .catch(() => setSaveStatus('failed'));
    },
    [sessionId],
  );

  /* ---------- option select ---------- */
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
        },
      };
      setAnswers(updated);
      persistAnswers(updated);
    },
    [answers, currentQuestion, persistAnswers],
  );

  /* ---------- mark unsure (doctor mode) ---------- */
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
    flashToast('已标记"家长不确定"');
  }, [answers, currentQuestion, flashToast, persistAnswers]);

  /* ---------- navigation ---------- */
  const handleNext = useCallback(() => {
    if (!currentQuestion) return;
    if (!answers[currentQuestion.id]) {
      flashToast('请先选择一个选项');
      return;
    }
    if (isLastQuestion) {
      // submit
      onComplete(answers);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }, [answers, currentQuestion, flashToast, isLastQuestion, onComplete]);

  const handlePrev = useCallback(() => {
    if (currentIndex === 0) {
      // show exit confirm dialog
      setShowExitConfirm(true);
    } else {
      setCurrentIndex((i) => i - 1);
    }
  }, [currentIndex]);

  const handleExitConfirm = useCallback(() => {
    setShowExitConfirm(false);
    // Save current progress before leaving
    autoSaveLocal(sessionId, answers);
    onBack();
  }, [answers, onBack, sessionId]);

  /* ---------- render ---------- */
  return (
    <div
      data-component="assessment-runner"
      className={cn(
        'flex flex-col min-h-[100dvh] w-full max-w-lg mx-auto bg-[var(--seed-bg)]',
        isLocked && 'locked-mode',
      )}
    >
      {/* ============ Header ============ */}
      <header
        className="sticky top-0 z-30 bg-[var(--seed-bg)]/95 backdrop-blur-sm safe-top"
        data-hide-in-locked={isLocked || undefined}
      >
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          {/* Back arrow */}
          <button
            type="button"
            onClick={handlePrev}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-sage-50 transition-smooth"
            aria-label="返回"
            data-hide-in-locked={isLocked || undefined}
          >
            <ChevronLeft size={22} className="text-foreground" />
          </button>

          {/* Scale name + patient info */}
          <div className="flex-1 text-center px-2">
            <h1 className="text-sm font-medium text-foreground truncate">
              {scale.name}
            </h1>
            {isDoctor && (
              <p className="text-xs text-muted truncate">
                {patientInfo.name} {patientInfo.ageLabel}
              </p>
            )}
          </div>

          {/* Auto-save indicator */}
          <AutoSaveIndicator status={saveStatus} />
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-3">
          <ProgressBar current={currentIndex + 1} total={total} />
        </div>
      </header>

      {/* ============ Question area ============ */}
      <main className="flex-1 px-4 pt-2 pb-28 overflow-y-auto no-scrollbar">
        {/* Question card with slide animation */}
        <QuestionCard
          questionNumber={currentIndex + 1}
          questionText={currentQuestion?.text ?? ''}
          animationKey={String(currentIndex)}
        />

        {/* Option list */}
        <div className="flex flex-col gap-3 mt-5">
          {currentQuestion?.options.map((opt) => (
            <OptionButton
              key={opt.id}
              option={opt}
              selected={answers[currentQuestion.id]?.optionId === opt.id}
              onSelect={handleSelect}
            />
          ))}
        </div>

        {/* AI helper button (optional) */}
        {showAi && onOpenAi && (
          <button
            type="button"
            onClick={onOpenAi}
            className="mt-5 mx-auto flex items-center gap-1.5 text-sm text-sky-500 hover:text-sky-600 transition-smooth"
            data-hide-in-locked={isLocked || undefined}
          >
            <Sparkles size={16} />
            <span>AI 辅助解释</span>
          </button>
        )}
      </main>

      {/* ============ Bottom action bar ============ */}
      <footer
        className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-sm border-t border-[var(--seed-border)] safe-bottom"
        data-hide-in-locked={isLocked || undefined}
      >
        <div className="max-w-lg mx-auto flex items-center gap-3 px-4 py-3">
          {/* Previous */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePrev}
            className="flex-1"
          >
            上一题
          </Button>

          {/* Doctor: mark unsure */}
          {isDoctor && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkUnsure}
              className="flex-shrink-0"
            >
              <HelpCircle size={16} className="mr-1" />
              家长不确定
            </Button>
          )}

          {/* Next / Submit */}
          <Button
            variant="default"
            size="sm"
            onClick={handleNext}
            className="flex-1"
          >
            {isLastQuestion ? '提交' : '下一题'}
          </Button>
        </div>
      </footer>

      {/* ============ Toast ============ */}
      {showToast && (
        <div className="fixed top-16 left-0 right-0 z-50 flex justify-center pointer-events-none">
          <div className="toast-enter bg-foreground/90 text-white text-sm px-5 py-2.5 rounded-pill shadow-lg">
            {toastMsg}
          </div>
        </div>
      )}

      {/* ============ Exit confirm dialog ============ */}
      {showExitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-enter">
          <div className="bg-white rounded-card p-6 mx-6 w-full max-w-sm shadow-xl float-up">
            {/* Close icon */}
            <div className="flex justify-end -mt-1 -mr-1">
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-sage-50 transition-smooth"
              >
                <X size={18} className="text-muted" />
              </button>
            </div>

            {/* Warning icon */}
            <div className="flex justify-center mb-3">
              <div className="w-12 h-12 rounded-full bg-warm-50 flex items-center justify-center">
                <AlertTriangle size={24} className="text-warm-400" />
              </div>
            </div>

            <h3 className="text-base font-medium text-foreground text-center mb-2">
              确定离开吗？
            </h3>
            <p className="text-sm text-muted text-center mb-6">
              已为你暂存进度，确定离开吗？
            </p>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowExitConfirm(false)}
              >
                取消
              </Button>
              <Button
                variant="default"
                className="flex-1"
                onClick={handleExitConfirm}
              >
                确定
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssessmentRunner;
