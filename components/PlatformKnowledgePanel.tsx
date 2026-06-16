'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, GraduationCap, RefreshCw, X } from 'lucide-react';

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

type PlatformKnowledgePanelProps = {
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
  scaleId?: string | null;
  questionId?: number | null;
};

type QuestionExplanationPayload = {
  scale: {
    id: string;
    title: string;
  };
  question: {
    id: number;
    text: string;
    colloquial: string;
  };
  exact: {
    platform: {
      source: 'scale_definition' | 'approved_question_explanation';
      title: string;
      content: string;
    };
    organization: Array<{
      id: string;
      scopeType: 'ORGANIZATION';
      title: string;
      content: string;
      sourceDocId: string | null;
      sourceDocTitle: string | null;
      priority: number;
    }>;
    doctor: Array<{
      id: string;
      scopeType: 'DOCTOR';
      title: string;
      content: string;
      sourceDocId: string | null;
      sourceDocTitle: string | null;
      priority: number;
    }>;
  };
  retrieval: Array<{
    chunkId: string;
    chunkIndex: number;
    docId: string;
    docTitle: string;
    scopeType: 'PLATFORM' | 'ORGANIZATION' | 'DOCTOR';
    scope: 'PLATFORM' | 'ORGANIZATION' | 'DOCTOR';
    score: number;
    contentText: string;
  }>;
  references: Array<{
    id: string;
    title: string;
    scopeType: 'PLATFORM' | 'ORGANIZATION' | 'DOCTOR';
  }>;
};

type QuestionExplanationResponse = {
  success: true;
  explanation: QuestionExplanationPayload;
};

type QuestionExplanationError = {
  error?: string;
};

function scopeLabel(scopeType: 'PLATFORM' | 'ORGANIZATION' | 'DOCTOR', language: 'zh' | 'en') {
  if (scopeType === 'DOCTOR') {
    return language === 'en' ? 'Doctor' : '医生';
  }

  if (scopeType === 'ORGANIZATION') {
    return language === 'en' ? 'Organization' : '机构';
  }

  return language === 'en' ? 'Platform' : '平台';
}

export default function PlatformKnowledgePanel({
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
  scaleId = '',
  questionId = null,
}: PlatformKnowledgePanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [explanation, setExplanation] = useState<QuestionExplanationPayload | null>(null);

  const copy = language === 'en'
    ? {
        title: 'Platform Explanation',
        subtitle: 'Platform-standard interpretation first, followed by organization or doctor supplements when approved.',
        loading: 'Loading the current question explanation...',
        refresh: 'Refresh',
        close: 'Close',
        currentScale: 'Current scale',
        currentQuestion: 'Current question',
        platform: 'Platform standard explanation',
        organization: 'Organization supplements',
        doctor: 'Doctor supplements',
        retrieval: 'Knowledge retrieval supplements',
        noQuestion: 'Open this while an assessment question is active, and the current question explanation will appear here.',
        references: 'Reference sources',
        standalone: 'Standalone page',
      }
    : {
        title: '平台题目解释',
        subtitle: '先看平台标准解释，再叠加机构或医生审核通过的补充说明。',
        loading: '正在加载当前题目的解释...',
        refresh: '刷新解释',
        close: '关闭',
        currentScale: '当前量表',
        currentQuestion: '当前题目',
        platform: '平台标准解释',
        organization: '机构补充',
        doctor: '医生补充',
        retrieval: '检索补充片段',
        noQuestion: '请在量表进行到某一题时打开这里，这里会展示当前题的标准解释和补充说明。',
        references: '引用来源',
        standalone: '独立页面',
      };

  async function loadExplanation() {
    if ((!isOpen && !standalone) || !scaleId || !questionId) {
      setExplanation(null);
      setError('');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/platform/v1/ai/explanations/question', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authHeaders || {}),
        },
        body: JSON.stringify({
          deviceId,
          memberId,
          scaleId,
          questionId,
          language,
          memberSnapshot,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as
        | QuestionExplanationResponse
        | QuestionExplanationError;

      if (!response.ok || !payload || !('success' in payload) || !payload.success) {
        throw new Error(payload && 'error' in payload ? payload.error || 'Failed to load explanation' : 'Failed to load explanation');
      }

      setExplanation(payload.explanation);
    } catch (loadError) {
      setExplanation(null);
      setError(loadError instanceof Error ? loadError.message : 'Failed to load explanation');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadExplanation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, standalone, deviceId, memberId, scaleId, questionId, language]);

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
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{copy.currentScale}</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {explanation?.scale.title || scaleId || '-'}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{copy.currentQuestion}</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {questionId ? `Q${questionId}` : '-'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {!standalone && scaleId && questionId ? (
                <Link
                  href={`/agent/knowledge?memberId=${encodeURIComponent(memberId)}&scaleId=${encodeURIComponent(scaleId)}&questionId=${questionId}`}
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  {copy.standalone}
                </Link>
              ) : null}
              <button
                onClick={() => void loadExplanation()}
                disabled={loading || !scaleId || !questionId}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>{copy.refresh}</span>
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="px-4 py-5">
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">
              <div className="flex items-start gap-2 font-semibold">
                <AlertCircle className="mt-0.5 h-4 w-4" />
                <span>{error}</span>
              </div>
            </div>
          </div>
        ) : null}

        {!scaleId || !questionId ? (
          <div className="flex flex-1 items-center justify-center px-6 text-center text-sm leading-7 text-slate-500">
            {copy.noQuestion}
          </div>
        ) : null}

        {!error && loading && !explanation && scaleId && questionId ? (
          <div className="flex flex-1 items-center justify-center px-6 text-sm text-slate-500">
            {copy.loading}
          </div>
        ) : null}

        {!error && explanation ? (
          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="space-y-4">
              <section className="rounded-2xl border border-cyan-200 bg-cyan-50/70 p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">{copy.currentQuestion}</div>
                <div className="mt-2 text-base font-semibold leading-7 text-slate-900">
                  {explanation.question.text}
                </div>
                <div className="mt-2 text-sm leading-7 text-slate-600">
                  {explanation.question.colloquial}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{copy.platform}</div>
                <div className="mt-2 text-base font-semibold text-slate-900">
                  {explanation.exact.platform.title}
                </div>
                <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                  {explanation.exact.platform.content}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{copy.organization}</div>
                {explanation.exact.organization.length ? (
                  <div className="mt-3 space-y-3">
                    {explanation.exact.organization.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{item.title}</span>
                          <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            {scopeLabel(item.scopeType, language)}
                          </span>
                          {item.sourceDocTitle ? (
                            <span className="rounded-full bg-white px-2 py-1 text-[11px] text-slate-500">
                              {item.sourceDocTitle}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                          {item.content}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    {language === 'en'
                      ? 'No approved organization supplement is available for this question yet.'
                      : '当前题目还没有审核通过的机构补充说明。'}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{copy.doctor}</div>
                {explanation.exact.doctor.length ? (
                  <div className="mt-3 space-y-3">
                    {explanation.exact.doctor.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{item.title}</span>
                          <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            {scopeLabel(item.scopeType, language)}
                          </span>
                          {item.sourceDocTitle ? (
                            <span className="rounded-full bg-white px-2 py-1 text-[11px] text-slate-500">
                              {item.sourceDocTitle}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                          {item.content}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    {language === 'en'
                      ? 'No approved doctor supplement is available for this question yet.'
                      : '当前题目还没有审核通过的医生补充说明。'}
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{copy.retrieval}</div>
                {explanation.retrieval.length ? (
                  <div className="mt-3 space-y-3">
                    {explanation.retrieval.map((item) => (
                      <div key={item.chunkId} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-slate-900">{item.docTitle}</span>
                          <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                            {scopeLabel(item.scopeType, language)}
                          </span>
                        </div>
                        <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                          {item.contentText}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                    {language === 'en'
                      ? 'No approved retrieval supplement is available for this question yet.'
                      : '当前题目还没有命中的审核通过知识片段。'}
                  </div>
                )}
              </section>

              {explanation.references.length ? (
                <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{copy.references}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {explanation.references.map((reference) => (
                      <span key={`${reference.scopeType}-${reference.id}`} className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {scopeLabel(reference.scopeType, language)} · {reference.title}
                      </span>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
