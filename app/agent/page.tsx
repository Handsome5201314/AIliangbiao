import { Suspense } from 'react';

import AgentWorkspace from '@/components/AgentWorkspace';

export default function AgentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50">
          <div className="mx-auto max-w-5xl px-6 py-12">
            <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
            <div className="mt-6 h-96 animate-pulse rounded-3xl border border-slate-200 bg-white" />
          </div>
        </div>
      }
    >
      <AgentWorkspace />
    </Suspense>
  );
}
