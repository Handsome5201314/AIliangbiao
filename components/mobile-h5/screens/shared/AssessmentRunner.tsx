import React, { useState, useCallback, useEffect } from 'react';
import {
  ChevronLeft,
  HelpCircle,
  X,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/components/mobile-h5/lib/utils';
import { Button } from '@/components/mobile-h5/components/ui/button';
import ProgressBar from './ProgressBar';
import QuestionCard from './QuestionCard';
import OptionButton from './OptionButton';
import AutoSaveIndicator from './AutoSaveIndicator';
import {
  autoSaveLocal,
  autoSaveServer,
  clearLocalDraft,
  confirmMappedAnswer,
  loadLatestLocalDraftForScale,
  loadLocalDraft,
  mapNaturalLanguageAnswer,
} from '@/components/mobile-h5/services/assessmentService';
import type {
  AssessmentMode,
  Question,
  Scale,
  Answer,
  Option,
  AutoSaveStatus,
} from '@/components/mobile-h5/types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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

type MappingSuggestion = Awaited<ReturnType<typeof mapNaturalLanguageAnswer>>;

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
  const [mappingText, setMappingText] = useState('');
  const [mappingSuggestion, setMappingSuggestion] = useState<MappingSuggestion | null>(null);
  const [mappingStatus, setMappingStatus] = useState<'idle' | 'mapping' | 'confirming'>('idle');

  const isLocked = mode === 'caregiver_handoff_locked';
  const isDoctor = mode === 'doctor_assisted';
  const total = questions.length;
  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === total - 1;

  // Generate a stable session id for auto-save
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

  useEffect(() => {
    setMappingText('');
    setMappingSuggestion(null);
    setMappingStatus('idle');
  }, [currentQuestion?.id]);

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
          source: 'manual',
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

  const saveMappedAnswer = useCallback(
    (option: Option, detail: {
      confidence: number;
      evidence: string;
      source: 'ai_mapped' | 'user_confirmed_mapping';
      confirmedLowConfidence?: boolean;
    }) => {
      if (!currentQuestion) return;

      const updated: Record<string, Answer> = {
        ...answers,
        [currentQuestion.id]: {
          questionId: currentQuestion.id,
          optionId: option.id,
          value: option.value,
          unsure: false,
          confidence: detail.confidence,
          evidence: detail.evidence,
          source: detail.source,
          confirmedLowConfidence: detail.confirmedLowConfidence,
        },
      };
      setAnswers(updated);
      persistAnswers(updated);
    },
    [answers, currentQuestion, persistAnswers],
  );

  const handleMapCurrentQuestion = useCallback(async () => {
    if (!currentQuestion) return;
    const text = mappingText.trim();
    if (!text) {
      flashToast('请先写一句孩子的实际表现');
      return;
    }

    setMappingStatus('mapping');
    setMappingSuggestion(null);

    try {
      const suggestion = await mapNaturalLanguageAnswer({
        scaleId: scale.id,
        questionId: currentQuestion.id,
        text,
      });
      setMappingSuggestion(suggestion);
      if (suggestion.mapping.score === null) {
        flashToast('AI 暂时无法匹配，请手动选择');
      }
    } catch (error) {
      flashToast(error instanceof Error ? error.message : 'AI 匹配失败，请手动选择');
    } finally {
      setMappingStatus('idle');
    }
  }, [currentQuestion, flashToast, mappingText, scale.id]);

  const handleApplyMappedSuggestion = useCallback(async () => {
    if (!currentQuestion || !mappingSuggestion || mappingSuggestion.mapping.score === null) {
      return;
    }

    const option = currentQuestion.options.find((item) => item.value === mappingSuggestion.mapping.score);
    if (!option) {
      flashToast('AI 建议的分值不在当前题选项中');
      return;
    }

    if (mappingSuggestion.needsConfirmation) {
      setMappingStatus('confirming');
      try {
        const confirmed = await confirmMappedAnswer({
          scaleId: scale.id,
          questionId: currentQuestion.id,
          score: option.value,
          confidence: mappingSuggestion.mapping.confidence,
          evidence: mappingSuggestion.mapping.evidence,
        });

        saveMappedAnswer(option, {
          confidence: confirmed.confirmedAnswer.confidence,
          evidence: confirmed.confirmedAnswer.evidence,
          source: 'user_confirmed_mapping',
          confirmedLowConfidence: true,
        });
        flashToast('已确认并选择该答案');
      } catch (error) {
        flashToast(error instanceof Error ? error.message : '确认失败，请手动选择');
      } finally {
        setMappingStatus('idle');
      }
      return;
    }

    saveMappedAnswer(option, {
      confidence: mappingSuggestion.mapping.confidence,
      evidence: mappingSuggestion.mapping.evidence,
      source: 'ai_mapped',
    });
    flashToast('已应用 AI 建议，请确认后继续');
  }, [currentQuestion, flashToast, mappingSuggestion, saveMappedAnswer, scale.id]);

  /* ---------- navigation ---------- */
  const handleNext = useCallback(async () => {
    if (!currentQuestion) return;
    if (!answers[currentQuestion.id]) {
      flashToast('请先选择一个选项');
      return;
    }
    if (isLastQuestion) {
      // submit
      await Promise.resolve(onComplete(answers));
      await clearLocalDraft(sessionId, scale.id);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }, [answers, currentQuestion, flashToast, isLastQuestion, onComplete, scale.id, sessionId]);

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

        {showAi && currentQuestion && !isLocked && (
          <section
            data-component="ai-answer-mapping-panel"
            className="mt-5 rounded-card bg-white/80 border border-sage-100 p-4 shadow-sm"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-sage-700">
              <Sparkles size={16} />
              <span>AI 帮我匹配答案</span>
            </div>
            <textarea
              value={mappingText}
              onChange={(event) => setMappingText(event.target.value)}
              placeholder="例如：最近做作业时经常坐不住，会离开座位。"
              className="mt-3 min-h-[76px] w-full resize-none rounded-2xl border border-cream-200 bg-cream-50 px-3 py-2 text-sm leading-6 text-foreground outline-none transition-smooth placeholder:text-muted focus:border-sage-300 focus:ring-2 focus:ring-sage-200"
            />
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs leading-5 text-muted">
                AI 只给候选答案，最终选择仍由你确认。
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleMapCurrentQuestion}
                disabled={mappingStatus !== 'idle'}
                className="shrink-0"
              >
                {mappingStatus === 'mapping' ? '匹配中' : '匹配'}
              </Button>
            </div>

            {mappingSuggestion && mappingSuggestion.mapping.score !== null && (
              <div className="mt-3 rounded-2xl bg-sage-50 p-3">
                <p className="text-sm text-foreground">
                  建议选择：
                  <span className="font-medium text-sage-700">
                    {currentQuestion.options.find((item) => item.value === mappingSuggestion.mapping.score)?.label || `分值 ${mappingSuggestion.mapping.score}`}
                  </span>
                </p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  置信度 {Math.round(mappingSuggestion.mapping.confidence * 100)}%
                  {mappingSuggestion.mapping.evidence ? ` · 依据：${mappingSuggestion.mapping.evidence}` : ''}
                </p>
                <Button
                  type="button"
                  variant={mappingSuggestion.needsConfirmation ? 'default' : 'outline'}
                  size="sm"
                  onClick={handleApplyMappedSuggestion}
                  disabled={mappingStatus !== 'idle'}
                  className="mt-3 w-full"
                >
                  {mappingSuggestion.needsConfirmation
                    ? (mappingStatus === 'confirming' ? '确认中' : '确认并选择')
                    : '应用建议'}
                </Button>
              </div>
            )}
          </section>
        )}

        {/* AI helper button (optional) */}
        {showAi && onOpenAi && (
          <button
            type="button"
            onClick={() => onOpenAi(currentQuestion, currentIndex + 1)}
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
