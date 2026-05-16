'use client';

import { useEffect } from 'react';

export default function AgentpitSsoCallbackPage() {
  useEffect(() => {
    const target = new URL('/auth/sso/callback', window.location.origin);
    target.search = window.location.search;
    target.hash = window.location.hash;
    window.location.replace(target.toString());
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <div className="rounded-3xl border border-white/10 bg-white/5 px-8 py-6 text-center backdrop-blur">
        <div className="text-lg font-semibold">正在切换授权回调...</div>
        <div className="mt-2 text-sm text-white/65">我们正在把你带回新的登录回调页面。</div>
      </div>
    </div>
  );
}
