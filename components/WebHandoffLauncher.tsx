'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { useSkillSession } from '@/contexts/SkillSessionContext';

type WebHandoffLauncherProps = {
  scaleId: string;
  language: 'zh' | 'en';
};

export default function WebHandoffLauncher({
  scaleId,
  language,
}: WebHandoffLauncherProps) {
  const { token: skillToken, memberId, loading, error: sessionError } = useSkillSession();
  const [error, setError] = useState('');
  const startedRef = useRef(false);

  const createSession = useCallback(async () => {
    if (!skillToken || loading || startedRef.current) {
      return;
    }

    startedRef.current = true;
    setError('');

    try {
      const response = await fetch(`/api/skill/v1/scales/${encodeURIComponent(scaleId)}/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${skillToken}`,
        },
        body: JSON.stringify({
          memberId,
          language,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || 'Failed to create assessment session');
      }

      const handoffUrl = payload.session?.handoff?.url;
      if (!handoffUrl) {
        throw new Error('Assessment handoff link is not available');
      }

      window.location.assign(handoffUrl);
    } catch (sessionError) {
      startedRef.current = false;
      setError(
        sessionError instanceof Error
          ? sessionError.message
          : language === 'en'
            ? 'Failed to open the assessment link.'
            : '打开量表链接失败。'
      );
    }
  }, [language, loading, memberId, scaleId, skillToken]);

  useEffect(() => {
    if (!loading && !skillToken && sessionError) {
      setError(sessionError);
      return;
    }

    void createSession();
  }, [createSession, loading, sessionError, skillToken]);

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <Loader2 className="mx-auto h-10 w-10 animate-spin text-indigo-600" />
        <h2 className="mt-4 text-2xl font-bold text-slate-900">
          {language === 'en' ? 'Preparing your assessment' : '正在准备量表'}
        </h2>
        <p className="mt-3 text-sm leading-7 text-slate-500">
          {language === 'en'
            ? 'We are creating a secure handoff link. You will be redirected in a moment.'
            : '系统正在生成安全的 handoff 链接，稍后会自动跳转。'}
        </p>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {error ? (
          <button
            type="button"
            onClick={() => void createSession()}
            className="mt-6 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-600"
          >
            {language === 'en' ? 'Retry' : '重试'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
