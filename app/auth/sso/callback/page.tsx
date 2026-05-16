'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { useAuthSession } from '@/contexts/AuthSessionContext';

export default function AgentpitSsoCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuthSession();

  useEffect(() => {
    const finishLogin = async () => {
      const hash = window.location.hash.slice(1);
      const params = new URLSearchParams(hash);
      const token = params.get('token');
      const userStr = params.get('user');
      const returnUrl = searchParams.get('returnUrl') || '/';

      window.history.replaceState(null, '', window.location.pathname);

      if (!token || !userStr) {
        router.replace(`/auth/login?sso_error=missing_token&returnUrl=${encodeURIComponent(returnUrl)}`);
        return;
      }

      try {
        localStorage.setItem('agentpit_user', decodeURIComponent(userStr));
        await login(decodeURIComponent(token));
        router.replace(returnUrl);
      } catch (error) {
        console.error('[AgentPit SSO Callback Error]:', error);
        router.replace(`/auth/login?sso_error=parse_failed&returnUrl=${encodeURIComponent(returnUrl)}`);
      }
    };

    void finishLogin();
  }, [login, router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
      <div className="rounded-3xl border border-white/10 bg-white/5 px-8 py-6 text-center backdrop-blur">
        <div className="text-lg font-semibold">AgentPit 授权登录中...</div>
        <div className="mt-2 text-sm text-white/65">正在同步登录状态并返回工作台。</div>
      </div>
    </div>
  );
}
