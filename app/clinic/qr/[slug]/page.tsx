'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';

import { useAuthSession } from '@/contexts/AuthSessionContext';
import { getOrCreateGuestSessionId } from '@/lib/utils/guestSession';

type Step = 'identity' | 'questions' | 'submitted';

type ClinicQrPayload = {
  qr: { id: string; slug: string };
  point: { id: string; name: string; code: string; locationLabel?: string | null; departmentLabel?: string | null };
  doctor: { id: string; realName: string; hospitalName: string; departmentName: string; title: string };
  scale: {
    id: string;
    resultDeliveryMode?: string;
    title: { zh?: string; en?: string } | string;
    description: { zh?: string; en?: string } | string;
    questions: Array<{
      id: number;
      text: { zh?: string; en?: string } | string;
      colloquial?: { zh?: string; en?: string } | string;
      fallback_examples?: Array<{ zh?: string; en?: string } | string>;
      options: Array<{
        label: string;
        score: number;
        description?: { zh?: string; en?: string } | string;
      }>;
    }>;
  };
};

type SubmitPayload = {
  screeningCode: string;
  result: {
    totalScore: number;
    conclusion: string;
    details?: Record<string, unknown>;
  } | null;
  resultDeliveryMode?: string;
  resultVisibleToRespondent?: boolean;
};

function readText(value: { zh?: string; en?: string } | string) {
  return typeof value === 'string' ? value : value.zh || value.en || '';
}

export default function ClinicQrPage() {
  const params = useParams();
  const { isAuthenticated, isPatient, authHeaders } = useAuthSession();
  const slug = String(params?.slug || '');

  const [data, setData] = useState<ClinicQrPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [step, setStep] = useState<Step>('identity');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitResult, setSubmitResult] = useState<SubmitPayload | null>(null);

  const [respondentName, setRespondentName] = useState('');
  const [gender, setGender] = useState<'boy' | 'girl'>('boy');
  const [ageValue, setAgeValue] = useState('6');
  const [ageUnit, setAgeUnit] = useState<'months' | 'years'>('years');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(`/api/clinic/qr/${slug}`);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || 'Clinic QR not found');
        }

        if (!cancelled) {
          setData(payload);
          setAnswers(Array.from({ length: payload.scale.questions.length }, () => -1));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '加载失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [slug]);

  const ageMonths = useMemo(() => {
    const value = Number.parseInt(ageValue, 10) || 0;
    return ageUnit === 'months' ? value : value * 12;
  }, [ageUnit, ageValue]);

  const currentQuestion = data?.scale.questions[currentIndex];
  const questionText = currentQuestion ? readText(currentQuestion.text) : '';
  const supportiveExplanation = currentQuestion?.colloquial ? readText(currentQuestion.colloquial) : '';
  const fallbackExamples = (currentQuestion?.fallback_examples || []).map(readText).filter(Boolean);
  const hasSupportiveExplanation = Boolean(supportiveExplanation && supportiveExplanation !== questionText);
  const physicianReviewMode =
    data?.scale.resultDeliveryMode === 'physician_review' ||
    submitResult?.resultDeliveryMode === 'physician_review' ||
    submitResult?.resultVisibleToRespondent === false;

  const startQuestions = () => {
    if (!respondentName.trim()) {
      setError('请先填写姓名');
      return;
    }
    if (ageMonths < 0) {
      setError('请填写有效年龄');
      return;
    }
    setError('');
    setStep('questions');
  };

  const selectAnswer = (score: number) => {
    const nextAnswers = answers.map((value, index) => (index === currentIndex ? score : value));
    setAnswers(nextAnswers);
    if (currentIndex < nextAnswers.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const submitAssessment = async () => {
    if (!data) return;
    if (answers.some((item) => item < 0)) {
      setError('请先完成全部题目');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(`/api/clinic/qr/${slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestSessionId: getOrCreateGuestSessionId(),
          respondentName: respondentName.trim(),
          respondentGender: gender,
          respondentAgeMonths: ageMonths,
          answers,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || '提交失败');
      }
      setSubmitResult(payload);
      setStep('submitted');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const claimSubmission = async () => {
    if (!submitResult) return;
    setClaiming(true);
    setStatus('');
    try {
      const response = await fetch('/api/clinic/screenings/claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          screeningCode: submitResult.screeningCode,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || '认领失败');
      }
      setStatus('本次记录已认领到当前账号');
    } catch (claimError) {
      setStatus(claimError instanceof Error ? claimError.message : '认领失败');
    } finally {
      setClaiming(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-600" />
          <p className="mt-3 text-sm text-slate-500">正在加载门诊量表二维码页面...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">二维码不可用</h1>
          <p className="mt-3 text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                <ShieldCheck className="h-4 w-4" />
                <span>门诊长期二维码 · 固定量表入口</span>
              </div>
              <h1 className="text-3xl font-bold text-slate-900">{readText(data.scale.title)}</h1>
              <p className="text-sm leading-7 text-slate-500">{readText(data.scale.description)}</p>
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                点位：{data.point.name}
                {data.point.locationLabel ? ` · ${data.point.locationLabel}` : ''}
                {data.point.departmentLabel ? ` · ${data.point.departmentLabel}` : ''}
              </div>
            </div>
          </div>
        </section>

        {step === 'identity' && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">填写基础信息</h2>
            <p className="mt-2 text-sm text-slate-500">
              系统会先以匿名临时身份完成筛查。填写完成后，后续可以通过手机号/邮箱加密码登录或注册来认领本次记录。
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">姓名</label>
                <input value={respondentName} onChange={(event) => setRespondentName(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-300" placeholder="请输入本人/孩子姓名" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">年龄</label>
                <div className="flex gap-3">
                  <input value={ageValue} onChange={(event) => setAgeValue(event.target.value)} type="number" min="0" className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-300" placeholder="请输入年龄" />
                  <select value={ageUnit} onChange={(event) => setAgeUnit(event.target.value as 'months' | 'years')} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-300">
                    <option value="years">岁</option>
                    <option value="months">月</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">性别</label>
                <div className="grid grid-cols-2 gap-3">
                  <button type="button" onClick={() => setGender('boy')} className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${gender === 'boy' ? 'border-cyan-300 bg-cyan-50 text-cyan-700' : 'border-slate-200 bg-white text-slate-600'}`}>男</button>
                  <button type="button" onClick={() => setGender('girl')} className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${gender === 'girl' ? 'border-cyan-300 bg-cyan-50 text-cyan-700' : 'border-slate-200 bg-white text-slate-600'}`}>女</button>
                </div>
              </div>
            </div>

            {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}

            <div className="mt-6 flex items-center justify-end">
              <button type="button" onClick={startQuestions} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-600">
                <span>开始填写量表</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}

        {step === 'questions' && currentQuestion && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6">
              <div className="mb-2 flex justify-between text-sm text-slate-500">
                <span>已完成 {answers.filter((value) => value >= 0).length} / {data.scale.questions.length}</span>
                <span>{Math.round(((answers.filter((value) => value >= 0).length) / data.scale.questions.length) * 100)}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200">
                <div
                  className="h-2 rounded-full bg-cyan-600 transition-all duration-300"
                  style={{ width: `${((answers.filter((value) => value >= 0).length) / data.scale.questions.length) * 100}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-cyan-700">第 {currentIndex + 1} / {data.scale.questions.length} 题</div>
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">标准题干</div>
                  <h2 className="mt-2 text-2xl font-semibold leading-9 text-slate-900">{questionText}</h2>
                </div>
                {hasSupportiveExplanation && (
                  <div className="mt-3 rounded-2xl border border-cyan-100 bg-cyan-50/80 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700">辅助理解</div>
                    <p className="mt-2 text-sm leading-7 text-slate-700">{supportiveExplanation}</p>
                    <div className="mt-2 text-xs text-cyan-700/80">仅用于帮助理解，不替代量表原题。</div>
                    {fallbackExamples.length > 0 && (
                      <div className="mt-3 text-xs leading-6 text-slate-500">
                        例如：{fallbackExamples.join('；')}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="hidden text-sm text-slate-500 md:block">已完成 {answers.filter((value) => value >= 0).length} 题</div>
            </div>

            <div className="mt-6 space-y-3">
              {currentQuestion.options.map((option) => {
                const selected = answers[currentIndex] === option.score;
                return (
                  <button key={`${currentQuestion.id}-${option.score}`} type="button" onClick={() => selectAnswer(option.score)} className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${selected ? 'border-cyan-300 bg-cyan-50' : 'border-slate-200 bg-white hover:border-cyan-200 hover:bg-slate-50'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{option.label}</div>
                        {option.description ? (
                          <div className="mt-1 text-sm leading-6 text-slate-500">{readText(option.description)}</div>
                        ) : null}
                      </div>
                      {selected ? (
                        <span className="mt-0.5 text-xs font-semibold text-cyan-700">
                          当前选择
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}

            <div className="mt-6 flex items-center justify-between">
              <button type="button" onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))} disabled={currentIndex === 0} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40">
                <ArrowLeft className="h-4 w-4" />
                <span>上一题</span>
              </button>
              <button type="button" onClick={() => void submitAssessment()} disabled={submitting || answers.some((value) => value < 0)} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-600 disabled:bg-slate-400">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                <span>{submitting ? '提交中...' : '提交量表'}</span>
              </button>
            </div>
          </section>
        )}

        {step === 'submitted' && submitResult && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <CheckCircle2 className="h-12 w-12 text-emerald-500" />
            <h2 className="mt-4 text-2xl font-bold text-slate-900">量表已提交</h2>
            <p className="mt-2 text-sm text-slate-500">本次筛查记录已进入门诊记录池和医生后台。内测阶段不向前端展示量表分数或结论，请记录下方筛查编号，后续可登录认领。</p>

            {physicianReviewMode ? (
              <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
                量表已提交，等待医师审核评估结果。
              </div>
            ) : null}

            <div className="mt-6 rounded-3xl bg-slate-50 p-5">
              <div className="text-sm text-slate-500">筛查编号</div>
              <div className="mt-2 text-xl font-bold text-slate-900">{submitResult.screeningCode}</div>
              <div className="mt-4 text-sm text-slate-500">状态</div>
              <div className="mt-2 text-xl font-semibold text-slate-900">已提交</div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {isAuthenticated && isPatient ? (
                <button type="button" onClick={() => void claimSubmission()} disabled={claiming} className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-600 disabled:bg-slate-400">
                  {claiming ? '认领中...' : '认领到当前账号'}
                </button>
              ) : (
                <>
                  <Link href="/auth/login" className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-600">登录后认领记录</Link>
                  <Link href="/auth/register" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">注册后认领记录</Link>
                </>
              )}
              <Link href="/" className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">返回首页</Link>
            </div>

            {status && <div className="mt-4 text-sm text-slate-500">{status}</div>}
          </section>
        )}
      </div>
    </div>
  );
}
