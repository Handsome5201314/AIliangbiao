'use client';

import { Bot, ChevronUp, Sparkles } from 'lucide-react';

type AiAssistantLauncherProps = {
  ctaLabel: string;
  hidden?: boolean;
  subtitle: string;
  title: string;
  onOpen: () => void;
};

export default function AiAssistantLauncher({
  ctaLabel,
  hidden = false,
  subtitle,
  title,
  onOpen,
}: AiAssistantLauncherProps) {
  if (hidden) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(env(safe-area-inset-bottom)+18px)]">
      <div className="pointer-events-auto mx-auto max-w-lg rounded-[2rem] border border-slate-200 bg-white/95 p-4 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.55)] backdrop-blur">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-indigo-700">
              <Sparkles className="h-3.5 w-3.5" />
              <span>AI Assistant</span>
            </div>
            <div className="mt-3 text-base font-semibold leading-7 text-slate-900">{title}</div>
            <div className="mt-2 text-sm leading-6 text-slate-500">{subtitle}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpen}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
        >
          <span>{ctaLabel}</span>
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
