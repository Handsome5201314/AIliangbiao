'use client';

import type { ReactNode } from 'react';
import { PhoneCall, X } from 'lucide-react';

interface CallModePanelProps {
  open: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}

export default function CallModePanel({
  open,
  title,
  subtitle,
  onClose,
  children,
}: CallModePanelProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/70 backdrop-blur-md px-4 py-6 md:px-8">
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-white/10 px-6 py-5 md:px-8">
          <div className="min-w-0">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
              <PhoneCall className="h-3.5 w-3.5" />
              <span>Call Mode</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/70">{subtitle}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close call mode"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 md:px-8 md:py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
