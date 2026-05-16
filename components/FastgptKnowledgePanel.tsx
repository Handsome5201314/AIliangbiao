'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, ExternalLink, GraduationCap, RefreshCw, X } from 'lucide-react';

type MemberSnapshotInput = {
  nickname?: string;
  gender?: string;
  ageMonths?: number;
  relation?: string;
  languagePreference?: string;
  interests?: string[];
  fears?: string[];
  avatarConfig?: unknown;
};

type FastgptEmbedSessionResponse = {
  success: true;
  session: {
    uid: string;
    embedUrl: string;
    externalUrl: string;
    expiresAt: string;
    refreshAfterSeconds: number;
    expert: {
      key: string;
      label: string;
      description: string;
      tags: string[];
      recommended: boolean;
    };
    experts: Array<{
      key: string;
      label: string;
      description: string;
      tags: string[];
      recommended: boolean;
    }>;
    context: {
      memberId: string;
      memberNickname: string;
      relation: string | null;
      language: 'zh' | 'en';
      ageMonths: number | null;
      currentScaleId: string | null;
      latestAssessmentScaleId: string | null;
      hasActiveAssessment: boolean;
    };
  };
};

type FastgptEmbedSessionError = {
  success: false;
  error?: string;
};

type FastgptKnowledgePanelProps = {
  isOpen: boolean;
  onClose: () => void;
  authHeaders?: HeadersInit;
  deviceId: string;
  memberId: string;
  memberSnapshot: MemberSnapshotInput;
  language: 'zh' | 'en';
  mobile?: boolean;
  standalone?: boolean;
  closeHref?: string;
  initialExpertKey?: string;
};

function formatRemainingTime(expiresAt: string, language: 'zh' | 'en') {
  const remainingMs = new Date(expiresAt).getTime() - Date.now();
  if (remainingMs <= 0) {
    return language === 'en' ? 'Refreshing soon' : '即将刷新';
  }

  const minutes = Math.max(1, Math.round(remainingMs / 60000));
  return language === 'en' ? `Expires in ~${minutes} min` : `约 ${minutes} 分钟后过期`;
}

export default function FastgptKnowledgePanel({
  isOpen,
  onClose,
  authHeaders,
  deviceId,
  memberId,
  memberSnapshot,
  language,
  mobile = false,
  standalone = false,
  closeHref = '/agent',
  initialExpertKey = '',
}: FastgptKnowledgePanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState<FastgptEmbedSessionResponse['session'] | null>(null);
  const [expertKey, setExpertKey] = useState(initialExpertKey);
  const [iframeKey, setIframeKey] = useState(0);
  const refreshTimerRef = useRef<number | null>(null);

  const copy = language === 'en'
    ? {
        title: 'Knowledge Copilot',
        subtitle: 'Guidelines, scale interpretation, and literature support stay isolated from your assessment flow.',
        empty: 'Open the knowledge panel when you need references or expert explanations.',
        loading: 'Preparing the FastGPT knowledge panel...',
        refresh: 'Refresh context',
        openExternal: 'Open externally',
        openStandalone: 'Standalone page',
        currentExpert: 'Current expert',
        currentMember: 'Current member',
        currentScale: 'Current scale',
        activeAssessment: 'An assessment is active. The knowledge panel stays read-only.',
        noScale: 'No recent scale context',
        expires: 'Session',
        switchExpert: 'Switch expert',
        blocked: 'The knowledge panel is unavailable right now.',
        fallback: 'If the embedded page does not load correctly, use the standalone page or open it externally.',
        close: 'Close',
      }
    : {
        title: '知识副脑',
        subtitle: '用于指南、量表解释和文献依据，不接管你当前的量表流程。',
        empty: '当你需要专家解释或文献依据时，再打开知识面板。',
        loading: '正在准备 FastGPT 知识面板...',
        refresh: '刷新知识面板',
        openExternal: '外部打开',
        openStandalone: '独立页面',
        currentExpert: '当前专家',
        currentMember: '当前成员',
        currentScale: '当前量表',
        activeAssessment: '当前有量表在进行中，知识面板保持只读，不会改动流程。',
        noScale: '暂无最近量表上下文',
        expires: '会话状态',
        switchExpert: '切换专家',
        blocked: '当前暂时无法打开知识面板。',
        fallback: '如果嵌入页加载不稳定，可以改用独立页面或外部打开。',
        close: '关闭',
      };

  async function loadSession(nextExpertKey?: string, forceReloadIframe = true) {
    if (!isOpen && !standalone) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/fastgpt/embed-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeaders || {}),
        },
        body: JSON.stringify({
          deviceId,
          memberId,
          expertKey: nextExpertKey || undefined,
          memberSnapshot,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as
        | FastgptEmbedSessionResponse
        | FastgptEmbedSessionError;

      if (!response.ok || !payload || !('success' in payload) || !payload.success) {
        throw new Error(payload && 'error' in payload ? payload.error || copy.blocked : copy.blocked);
      }

      setSession(payload.session);
      setExpertKey(payload.session.expert.key);
      if (forceReloadIframe) {
        setIframeKey((value) => value + 1);
      }
    } catch (loadError) {
      setSession(null);
      setError(loadError instanceof Error ? loadError.message : copy.blocked);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if ((isOpen || standalone) && deviceId && memberId) {
      void loadSession(expertKey || initialExpertKey || undefined, false);
    }
    // We intentionally only react to open/member/device changes.
    // Latest assessment changes should be pulled by the explicit refresh button.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, standalone, deviceId, memberId, initialExpertKey]);

  useEffect(() => {
    if (!session || (!isOpen && !standalone)) {
      return;
    }

    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
    }

    const timeoutMs = Math.max(30000, session.refreshAfterSeconds * 1000);
    refreshTimerRef.current = window.setTimeout(() => {
      void loadSession(expertKey || session.expert.key);
    }, timeoutMs);

    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [expertKey, isOpen, session, standalone]);

  useEffect(() => {
    if (standalone || !isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, standalone]);

  if (!isOpen && !standalone) {
    return null;
  }

  const shellClassName = standalone
    ? 'flex min-h-screen flex-col bg-slate-50'
    : mobile
      ? 'fixed inset-0 z-[140] flex h-[100dvh] flex-col overflow-hidden bg-white'
      : 'fixed inset-y-0 right-0 z-[140] flex h-[100dvh] w-full max-w-[540px] flex-col border-l border-slate-200 bg-white shadow-2xl';

  const headerClassName = mobile || standalone
    ? 'flex items-center justify-between border-b border-slate-200 px-4 py-3'
    : 'flex items-center justify-between border-b border-slate-200 px-5 py-4';

  return (
    <div className={shellClassName}>
      <div className={headerClassName}>
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">
            <GraduationCap className="h-3.5 w-3.5" />
            <span>{copy.title}</span>
          </div>
          <div className="mt-2 text-sm text-slate-600">{copy.subtitle}</div>
        </div>
        {standalone ? (
          <Link
            href={closeHref}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
            <span>{copy.close}</span>
          </Link>
        ) : (
          <button
            onClick={onClose}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
            <span>{copy.close}</span>
          </button>
        )}
      </div>

      <div className={`flex flex-1 flex-col overflow-hidden ${mobile ? 'pb-[env(safe-area-inset-bottom)]' : ''}`}>
        <div className="space-y-4 border-b border-slate-200 bg-slate-50 px-4 py-4">
          {session?.experts?.length ? (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {copy.switchExpert}
              </div>
              <div className="flex flex-wrap gap-2">
                {session.experts.map((expert) => (
                  <button
                    key={expert.key}
                    onClick={() => {
                      setExpertKey(expert.key);
                      void loadSession(expert.key);
                    }}
                    disabled={loading}
                    className={`rounded-full border px-3 py-2 text-sm font-medium transition ${
                      expert.key === expertKey
                        ? 'border-cyan-500 bg-cyan-600 text-white'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:text-cyan-700'
                    }`}
                  >
                    {expert.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{copy.currentExpert}</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {session?.expert.label || copy.empty}
              </div>
              {session?.expert.description ? (
                <div className="mt-1 text-sm text-slate-600">{session.expert.description}</div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{copy.currentMember}</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {session?.context.memberNickname || memberSnapshot.nickname || memberId}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {session?.context.relation || memberSnapshot.relation || '-'}
                {typeof session?.context.ageMonths === 'number'
                  ? language === 'en'
                    ? ` · ${session.context.ageMonths} months`
                    : ` · ${session.context.ageMonths} 月龄`
                  : ''}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{copy.currentScale}</div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {session?.context.currentScaleId || session?.context.latestAssessmentScaleId || copy.noScale}
              </div>
              <div className="mt-1 text-sm text-slate-600">
                {session?.context.hasActiveAssessment ? copy.activeAssessment : copy.expires}
              </div>
            </div>

            <button
              onClick={() => void loadSession(expertKey || undefined)}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>{copy.refresh}</span>
            </button>

            <div className="flex items-center gap-2">
              {session?.externalUrl ? (
                <a
                  href={session.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-700"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>{copy.openExternal}</span>
                </a>
              ) : null}
              {!standalone ? (
                <Link
                  href={`/agent/knowledge?memberId=${encodeURIComponent(memberId)}${expertKey ? `&expert=${encodeURIComponent(expertKey)}` : ''}`}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {copy.openStandalone}
                </Link>
              ) : null}
            </div>
          </div>

          {session?.expiresAt ? (
            <div className="text-xs text-slate-500">
              {copy.expires}: {formatRemainingTime(session.expiresAt, language)}
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="px-4 py-5">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
              <div className="flex items-start gap-2 font-semibold">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <span>{error}</span>
              </div>
              <div className="mt-2 text-sm text-rose-700">{copy.fallback}</div>
            </div>
          </div>
        ) : null}

        {!error && loading && !session ? (
          <div className="flex flex-1 items-center justify-center px-6 text-sm text-slate-500">
            {copy.loading}
          </div>
        ) : null}

        {!error && session ? (
          <div className="relative flex-1 overflow-hidden">
            <iframe
              key={iframeKey}
              src={session.embedUrl}
              title={session.expert.label}
              className="absolute inset-0 h-full w-full border-0 bg-white"
              allow="clipboard-read; clipboard-write"
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
