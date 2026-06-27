import React, { useEffect, useState } from 'react';
import { Bot, ChevronDown, ChevronUp, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/mobile-h5/components/ui/button';
import { cn } from '@/components/mobile-h5/lib/utils';
import type { AssessmentMode, QuickQuestionType } from '@/components/mobile-h5/types';
import {
  DISCLAIMER,
  getQuestionExplanation,
  getQuickExplanation,
} from '@/components/mobile-h5/services/aiExplanationService';

interface AiAssistantDrawerProps {
  open: boolean;
  onClose: () => void;
  questionNumber: number;
  questionText: string;
  questionId: string;
  scaleId: string;
  mode: AssessmentMode;
}

interface QuickQuestion {
  type: QuickQuestionType;
  label: string;
}

const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({
  open,
  onClose,
  questionNumber,
  questionText,
  questionId,
  scaleId,
  mode,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(false);
  const [quickAnswer, setQuickAnswer] = useState<string | null>(null);
  const [quickLoading, setQuickLoading] = useState(false);

  const quickQuestions: QuickQuestion[] =
    mode === 'doctor_assisted'
      ? [
          { type: 'explain-to-parent', label: '给家长解释这题' },
          { type: 'meaning', label: '这题是什么意思？' },
          { type: 'options', label: '选项怎么理解？' },
          { type: 'example', label: '能举个例子吗？' },
          { type: 'unsure', label: '我不确定怎么观察' },
        ]
      : [
          { type: 'meaning', label: '这题是什么意思？' },
          { type: 'options', label: '选项怎么理解？' },
          { type: 'example', label: '能举个例子吗？' },
          { type: 'unsure', label: '我不确定怎么观察' },
          { type: 'explain-to-parent', label: '给家长解释这题' },
        ];

  useEffect(() => {
    if (!open) return;

    // Reset state on question change
    setQuickAnswer(null);
    setExpanded(false);

    let cancelled = false;
    setLoading(true);

    getQuestionExplanation({
      scaleId,
      questionId,
      questionText,
      options: [],
      mode,
    }).then((result) => {
      if (!cancelled) {
        setExplanation(result.explanation);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [questionId, open, scaleId]);

  const handleQuickQuestion = async (quickType: QuickQuestionType) => {
    setQuickLoading(true);
    setQuickAnswer(null);

    try {
      const answer = await getQuickExplanation(questionId, quickType);
      setQuickAnswer(answer);
    } finally {
      setQuickLoading(false);
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-50 backdrop-enter"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50',
          'bg-white rounded-t-card',
          'flex flex-col',
          'max-w-[480px] mx-auto w-full',
          'drawer-enter',
        )}
        style={{
          height: expanded ? '85vh' : '50vh',
          maxHeight: '90vh',
          transition: 'height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        data-component="ai-drawer"
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 py-3 border-b border-cream-200">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-sage-400" />
            <span className="text-sm font-medium text-foreground">AI 助手</span>
            <span className="text-xs text-muted">· 第{questionNumber}题</span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExpanded((prev) => !prev)}
              className="w-8 h-8 rounded-full hover:bg-cream-100 transition-colors"
              aria-label={expanded ? '收起' : '展开'}
            >
              {expanded ? (
                <ChevronDown className="w-4 h-4 text-muted" />
              ) : (
                <ChevronUp className="w-4 h-4 text-muted" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-cream-100 transition-colors"
              aria-label="关闭"
            >
              <X className="w-4 h-4 text-muted" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Quick question buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            {quickQuestions.map((q) => {
              const isHighlighted =
                mode === 'doctor_assisted' && q.type === 'explain-to-parent';

              return (
                <Button
                  key={q.type}
                  onClick={() => handleQuickQuestion(q.type)}
                  className={cn(
                    'text-sm px-3 py-1.5 rounded-pill transition-colors',
                    isHighlighted
                      ? 'bg-sage-400 text-white'
                      : 'bg-cream-100 text-foreground hover:bg-cream-200',
                  )}
                >
                  {q.label}
                </Button>
              );
            })}
          </div>

          {/* Explanation area */}
          {loading ? (
            <div className="space-y-3">
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-4/5" />
              <div className="skeleton h-4 w-3/5" />
            </div>
          ) : (
            <>
              <div className="bg-cream-50 p-4 rounded-2xl">
                <p className="text-base leading-relaxed text-foreground whitespace-pre-line">
                  {explanation}
                </p>
              </div>

              {quickLoading && (
                <div className="mt-3 space-y-3">
                  <div className="skeleton h-4 w-full" />
                  <div className="skeleton h-4 w-4/5" />
                  <div className="skeleton h-4 w-3/5" />
                </div>
              )}

              {quickAnswer && !quickLoading && (
                <div className="mt-3 bg-sage-50 p-4 rounded-2xl">
                  <p className="text-base leading-relaxed text-foreground whitespace-pre-line">
                    {quickAnswer}
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 py-3 border-t border-cream-200 bg-cream-50">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-muted flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted leading-relaxed">{DISCLAIMER}</p>
          </div>
        </div>
      </div>
    </>
  );
};

export default AiAssistantDrawer;
