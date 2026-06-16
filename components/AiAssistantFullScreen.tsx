'use client';

import { ChevronDown, X } from 'lucide-react';

type AiAssistantFullScreenProps = {
  closeAriaLabel?: string;
  collapseLabel: string;
  subtitle: string;
  title: string;
  onCollapse: () => void;
  onClose: () => void;
};

export default function AiAssistantFullScreen({
  closeAriaLabel = '关闭助手',
  collapseLabel,
  subtitle,
  title,
  onCollapse,
  onClose,
}: AiAssistantFullScreenProps) {
  return (
    <div className="border-b border-slate-200 bg-white/96 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-lg font-semibold text-slate-900">{title}</div>
          <div className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onCollapse}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <ChevronDown className="h-4 w-4" />
            <span>{collapseLabel}</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            aria-label={closeAriaLabel}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
