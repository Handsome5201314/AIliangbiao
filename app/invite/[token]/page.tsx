'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, Loader2, ShieldCheck, Stethoscope } from 'lucide-react';

import { useAuthSession } from '@/contexts/AuthSessionContext';

type InviteStep = 'identity' | 'questions' | 'submitted';

type InvitePayload = {
  invite: {
    id: string;
    token: string;
    status: string;
    expiresAt: string;
    usedAt?: string | null;
    doctor: {
      realName: string;
      hospitalName: string;
      departmentName: string;
      title: string;
    };
  };
  scale: {
    id: string;
    title: { zh?: string; en?: string } | string;
    description: { zh?: string; en?: string } | string;
    questions: Array<{
      id: number;
      text: { zh?: string; en?: string } | string;
      options: Array<{
        label: string;
        score: number;
      }>;
    }>;
  };
};

type SubmitResult = {
  resultDeliveryMode?: string;
  resultVisibleToRespondent?: boolean;
  nextAction: 'login' | 'register' | 'none';
};

function readText(value: { zh?: string; en?: string } | string) {
  if (typeof value === 'string') {
    return value;
  }

  return value.zh || value.en || '';
}

function getDeviceId() {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}

export default function PublicInvitePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const { isAuthenticated } = useAuthSession();

  const token = String(params?.token || '');
  const claimed = searchParams.get('claimed') === '1';

  const [inviteData, setInviteData] = useState<InvitePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState<InviteStep>('identity');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);

  const [realName, setRealName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [gender, setGender] = useState<'boy' | 'girl'>('boy');
  const [ageValue, setAgeValue] = useState('6');
  const [ageUnit, setAgeUnit] = useState<'months' | 'years'>('years');

  useEffect(() => {
    let cancelled = false;

    const loadInvite = async () => {
      setLoading(true);
      setError('');

      try {
        const response = await fetch(`/api/invites/${token}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || '邀请不存在');
        }

        if (!cancelled) {
          setInviteData(data);
          setAnswers(Array.from({ length: data.scale.questions.length }, () => -1));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : '邀请加载失败');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadInvite();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const inviteUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return '';
    }

    return `${window.location.origin}/invite/${token}`;
  }, [token]);

  const ageMonths = useMemo(() => {
    const value = Number.parseInt(ageValue, 10) || 0;
    return ageUnit === 'months' ? value : value * 12;
  }, [ageUnit, ageValue]);

  const currentQuestion = inviteData?.scale.questions[currentIndex];
  const answeredCount = answers.filter((value) => value >= 0).length;
  const physicianReviewMode =
    submitResult?.resultDeliveryMode === 'physician_review' ||
    submitResult?.resultVisibleToRespondent === false;

  const startQuestions = () => {
    if (!realName.trim() || !contactPhone.trim() || ageMonths < 0) {
      setError('请先填写姓名、手机号和年龄。');
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

  const submitInvite = async () => {
    if (!inviteData) {
      return;
    }

    if (answers.some((value) => value < 0)) {
      setError('请先完成全部题目。');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(`/api/invites/${token}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deviceId: getDeviceId(),
          realName: realName.trim(),
          contactPhone: contactPhone.trim(),
          gender,
          ageMonths,
          nickname: realName.trim(),
          answers,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '提交失败');
      }

      setSubmitResult({
        resultDeliveryMode: data.resultDeliveryMode,
        resultVisibleToRespondent: data.resultVisibleToRespondent,
        nextAction: data.nextAction,
      });
      setStep('submitted');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-cyan-600" />
          <p className="mt-3 text-sm text-slate-500">正在加载医生邀填页面...</p>
        </div>
      </div>
    );
  }

  if (error && !inviteData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">邀请不可用</h1>
          <p className="mt-3 text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!inviteData) {
    return null;
  }

  if (inviteData.invite.status !== 'ACTIVE' && step !== 'submitted') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">
            {claimed && isAuthenticated ? '记录已回到你的账户' : '邀请已失效或已被使用'}
          </h1>
          <p className="mt-3 text-sm leading-7 text-slate-500">
            {claimed && isAuthenticated
              ? '你刚刚完成了登录/注册，本次量表记录已经按手机号优先规则尝试归档到你的成员时间线。'
              : '当前链接不能再次提交。如需重新填写，请联系医生生成新的 24 小时邀填二维码。'}
          </p>
          <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
            邀请链接：{inviteUrl}
          </div>
        </div>
      </div>
    );
  }

  const returnUrl = `/invite/${token}?claimed=1`;

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">
                <ShieldCheck className="h-4 w-4" />
                <span>24 小时有效 · 单次提交</span>
              </div>
              <h1 className="text-3xl font-bold text-slate-900">{readText(inviteData.scale.title)}</h1>
              <p className="text-sm leading-7 text-slate-500">{readText(inviteData.scale.description)}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
              <div className="flex items-center gap-2 font-semibold text-slate-900">
                <Stethoscope className="h-4 w-4 text-cyan-700" />
                <span>{inviteData.invite.doctor.realName} · {inviteData.invite.doctor.title}</span>
              </div>
              <div className="mt-2">{inviteData.invite.doctor.hospitalName}</div>
              <div>{inviteData.invite.doctor.departmentName}</div>
              <div className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500">
                <Clock3 className="h-4 w-4" />
                <span>有效至 {new Date(inviteData.invite.expiresAt).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </section>

        {step === 'identity' && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">先填写量表对象信息</h2>
            <p className="mt-2 text-sm text-slate-500">
              系统会用 姓名、手机号、年龄、性别 做严格匹配，帮助把本次量表归到正确的成员时间线。
            </p>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">姓名</label>
                <input
                  value={realName}
                  onChange={(event) => setRealName(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-300"
                  placeholder="请输入本人/孩子姓名"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">手机号</label>
                <input
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-300"
                  placeholder="用于匹配和后续认领"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">年龄</label>
                <div className="flex gap-3">
                  <input
                    value={ageValue}
                    onChange={(event) => setAgeValue(event.target.value)}
                    type="number"
                    min="0"
                    className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-300"
                    placeholder="请输入年龄"
                  />
                  <select
                    value={ageUnit}
                    onChange={(event) => setAgeUnit(event.target.value as 'months' | 'years')}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-300"
                  >
                    <option value="years">岁</option>
                    <option value="months">月</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">性别</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setGender('boy')}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
                      gender === 'boy' ? 'border-cyan-300 bg-cyan-50 text-cyan-700' : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    男
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender('girl')}
                    className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition-colors ${
                      gender === 'girl' ? 'border-cyan-300 bg-cyan-50 text-cyan-700' : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    女
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {error}
              </div>
            )}

            <div className="mt-6 flex items-center justify-end">
              <button
                type="button"
                onClick={startQuestions}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-600"
              >
                <span>开始填写量表</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </section>
        )}

        {step === 'questions' && currentQuestion && (
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-cyan-700">
                  第 {currentIndex + 1} / {inviteData.scale.questions.length} 题
                </div>
                <h2 className="mt-2 text-2xl font-semibold leading-9 text-slate-900">
                  {readText(currentQuestion.text)}
                </h2>
              </div>
              <div className="text-sm text-slate-500">已完成 {answeredCount} 题</div>
            </div>

            <div className="mt-6 space-y-3">
              {currentQuestion.options.map((option) => {
                const selected = answers[currentIndex] === option.score;

                return (
                  <button
                    key={`${currentQuestion.id}-${option.score}`}
                    type="button"
                    onClick={() => selectAnswer(option.score)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors ${
                      selected ? 'border-cyan-300 bg-cyan-50' : 'border-slate-200 bg-white hover:border-cyan-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-sm font-semibold text-slate-900">{option.label}</div>
                  </button>
                );
              })}
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
                {error}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))}
                disabled={currentIndex === 0}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>上一题</span>
              </button>
              <button
                type="button"
                onClick={() => void submitInvite()}
                disabled={submitting || answers.some((value) => value < 0)}
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-600 disabled:bg-slate-400"
              >
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
            <p className="mt-2 text-sm text-slate-500">
              结果已经进入医生可见的临床时间线。若你还没登录/注册，可继续用手机号认领这次记录。
            </p>

            {physicianReviewMode ? (
              <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-800">
                量表已提交，等待医师审核评估结果。
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                公开邀请链接只用于提交复测。正式报告需要登录并通过复核/二次校验后查看。
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              {submitResult.nextAction === 'login' && (
                <a
                  href={`/auth/login?returnUrl=${encodeURIComponent(returnUrl)}`}
                  className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-600"
                >
                  登录并认领记录
                </a>
              )}
              {submitResult.nextAction === 'register' && (
                <a
                  href={`/auth/register?returnUrl=${encodeURIComponent(returnUrl)}`}
                  className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-cyan-600"
                >
                  注册并认领记录
                </a>
              )}
              <a
                href="/"
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                返回首页
              </a>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
