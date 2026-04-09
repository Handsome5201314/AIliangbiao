'use client';

import type { ReactNode } from 'react';
import { MoreHorizontal, PhoneCall, X } from 'lucide-react';

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
    <div className="fixed inset-0 z-[80] overflow-hidden bg-black text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.08),transparent_18%),radial-gradient(circle_at_bottom,rgba(217,70,239,0.08),transparent_22%),linear-gradient(180deg,#010101_0%,#07080d_50%,#010101_100%)]" />
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-5xl flex-col px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <div className="grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 sm:gap-4">
          <button
            type="button"
            disabled
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/6 text-white/45 opacity-60"
            aria-label="Call mode options"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>

          <div className="mx-auto inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-2.5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl sm:gap-3 sm:px-4 sm:py-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-100 sm:h-10 sm:w-10">
              <PhoneCall className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-base font-semibold text-white sm:text-xl">{title}</div>
              <div className="hidden truncate text-[11px] uppercase tracking-[0.28em] text-white/40 sm:block">{subtitle}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/6 text-white/80 transition-colors hover:bg-white/12 hover:text-white"
            aria-label="Close call mode"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
