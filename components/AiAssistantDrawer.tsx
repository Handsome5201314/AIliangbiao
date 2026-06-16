'use client';

import type { ReactNode } from 'react';
import { ChevronUp, X } from 'lucide-react';

import type { MobileAssistantStage } from '@/lib/agent/mobile-assistant';
import { isMobileAssistantOpen } from '@/lib/agent/mobile-assistant';
import { cn } from '@/lib/utils';

type AiAssistantDrawerProps = {
  children: ReactNode;
  closeAriaLabel?: string;
  collapseLabel: string;
  expandLabel: string;
  fullscreenHeader?: ReactNode;
  mounted: boolean;
  stage: MobileAssistantStage;
  subtitle: string;
  title: string;
  onClose: () => void;
  onCollapse: () => void;
  onExpand: () => void;
};

export default function AiAssistantDrawer({
  children,
  closeAriaLabel = '关闭助手',
  collapseLabel,
  expandLabel,
  fullscreenHeader,
  mounted,
  stage,
  subtitle,
  title,
  onClose,
  onCollapse,
  onExpand,
}: AiAssistantDrawerProps) {
  if (!mounted) {
    return null;
  }

  const open = isMobileAssistantOpen(stage);
  const fullscreen = stage === 'full';

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-end">
      <div
        className={cn(
          'absolute inset-0 bg-slate-950/40 transition-opacity duration-300',
          open ? 'pointer-events-auto opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />

      <section
        aria-hidden={!open}
        className={cn(
          'pointer-events-auto relative flex w-full flex-col overflow-hidden bg-slate-50 shadow-[0_-24px_80px_-32px_rgba(15,23,42,0.6)] transition-all duration-300',
          fullscreen
            ? 'h-[100dvh] rounded-none'
            : 'h-[68vh] rounded-t-[32px] border border-slate-200 border-b-0',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        {fullscreen ? (
          fullscreenHeader
        ) : (
          <div className="border-b border-slate-200 bg-white/96 px-4 pb-4 pt-3 backdrop-blur">
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-slate-900">{title}</div>
                <div className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onExpand}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <ChevronUp className="h-4 w-4" />
                  <span>{expandLabel}</span>
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
        )}

        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>

        {!fullscreen ? (
          <div className="border-t border-slate-200 bg-white/96 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur">
            <button
              type="button"
              onClick={onCollapse}
              className="w-full rounded-full border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-white"
            >
              {collapseLabel}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
