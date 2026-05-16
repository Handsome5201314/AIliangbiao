'use client';

import type { ReactNode } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';

interface QuestionnaireProgressProps {
  answeredCount: number;
  total: number;
  progressPercent: number;
  language: 'zh' | 'en';
}

interface QuestionnaireQuestionCardProps {
  index: number;
  total: number;
  questionText: string;
  supportiveExplanation?: string;
  supportiveExplanationNote: string;
  originalItemLabel: string;
  supportiveExplanationLabel: string;
  questionLabel: string;
  questionHint: string;
  answeredLabel?: string;
  answered?: boolean;
  media?: ReactNode;
  children: ReactNode;
}

interface QuestionnaireOptionButtonProps {
  label: string;
  description?: string;
  selected: boolean;
  selectedLabel: string;
  selectedDescription?: string;
  emphasis?: 'default' | 'strong';
  showSelector?: boolean;
  disabled?: boolean;
  className?: string;
  onClick: () => void;
}

export function QuestionnaireProgress({
  answeredCount,
  total,
  progressPercent,
  language,
}: QuestionnaireProgressProps) {
  return (
    <div className="mb-6">
      <div className="flex justify-between text-sm text-slate-600 mb-2">
        <span>
          {language === 'en' ? 'Completed' : '已完成'} {answeredCount} / {total}
        </span>
        <span>{Math.round(progressPercent)}%</span>
      </div>
      <div className="w-full bg-slate-200 rounded-full h-2">
        <div
          className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}

export function QuestionnaireQuestionCard({
  index,
  total,
  questionText,
  supportiveExplanation,
  supportiveExplanationNote,
  originalItemLabel,
  supportiveExplanationLabel,
  questionLabel,
  questionHint,
  answeredLabel,
  answered,
  media,
  children,
}: QuestionnaireQuestionCardProps) {
  const hasSupportiveExplanation = Boolean(
    supportiveExplanation && supportiveExplanation !== questionText
  );

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="text-sm text-indigo-600 font-semibold mb-1">
            {questionLabel} {index} / {total}
          </div>
          <p className="text-sm text-slate-500">{questionHint}</p>
        </div>
        {answered && answeredLabel ? (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-600">
            {answeredLabel}
          </span>
        ) : null}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 mb-4">
        <div className="text-xs font-semibold tracking-wide text-slate-500">
          {originalItemLabel}
        </div>
        <h3 className="mt-2 text-xl font-semibold leading-8 text-slate-900">
          {questionText}
        </h3>
      </div>

      {media}

      {hasSupportiveExplanation ? (
        <div className="rounded-xl border border-amber-100 bg-amber-50/80 p-4 mb-6">
          <div className="text-xs font-semibold tracking-wide text-amber-700">
            {supportiveExplanationLabel}
          </div>
          <p className="mt-2 text-sm leading-7 text-amber-900">
            {supportiveExplanation}
          </p>
          <p className="mt-2 text-xs text-amber-700/80">
            {supportiveExplanationNote}
          </p>
        </div>
      ) : null}

      {children}
    </div>
  );
}

export function QuestionnaireOptionButton({
  label,
  description,
  selected,
  selectedLabel,
  selectedDescription,
  emphasis = 'default',
  showSelector = true,
  disabled = false,
  className = '',
  onClick,
}: QuestionnaireOptionButtonProps) {
  const baseClasses =
    'group relative w-full overflow-hidden rounded-2xl border text-left transition-all duration-200 active:scale-[0.995]';
  const emphasisClasses =
    emphasis === 'strong'
      ? selected
        ? 'border-indigo-600 bg-gradient-to-br from-indigo-50 via-white to-sky-50 shadow-[0_20px_40px_-24px_rgba(79,70,229,0.65)] ring-2 ring-indigo-100'
        : 'border-slate-300 bg-white shadow-[0_16px_30px_-26px_rgba(15,23,42,0.55)] hover:border-indigo-400 hover:bg-indigo-50/60 hover:shadow-[0_22px_40px_-24px_rgba(79,70,229,0.35)]'
      : selected
        ? 'border-indigo-500 bg-indigo-50 shadow-[0_16px_32px_-26px_rgba(79,70,229,0.55)] ring-1 ring-indigo-100'
        : 'border-slate-300 bg-white shadow-[0_10px_24px_-22px_rgba(15,23,42,0.35)] hover:border-indigo-300 hover:bg-indigo-50/50 hover:shadow-[0_18px_34px_-24px_rgba(79,70,229,0.25)]';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${emphasisClasses} ${
        disabled ? 'cursor-not-allowed opacity-50' : ''
      } ${className}`.trim()}
    >
      <span
        aria-hidden="true"
        className={`absolute inset-y-4 left-0 w-1.5 rounded-r-full transition-all ${
          selected
            ? 'bg-gradient-to-b from-indigo-500 to-sky-400 opacity-100'
            : 'bg-slate-200 opacity-70 group-hover:bg-indigo-200 group-hover:opacity-100'
        }`}
      />
      <div className="flex items-start gap-4 p-4 pl-5 sm:p-5 sm:pl-6">
        {showSelector ? (
          <div className="pt-0.5">
            {selected ? (
              <CheckCircle2 className="h-6 w-6 text-indigo-600" />
            ) : (
              <Circle className="h-6 w-6 text-slate-400 transition-colors group-hover:text-indigo-400" />
            )}
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold leading-7 text-slate-900">{label}</div>
          {description ? (
            <div className="mt-2 text-sm leading-7 text-slate-600">
              {description}
            </div>
          ) : null}
          {selected && selectedDescription ? (
            <div className="mt-3 text-xs font-medium uppercase tracking-[0.18em] text-indigo-600">
              {selectedDescription}
            </div>
          ) : null}
        </div>
        {selected ? (
          <span className="mt-0.5 shrink-0 rounded-full bg-indigo-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
            {selectedLabel}
          </span>
        ) : null}
      </div>
    </button>
  );
}
