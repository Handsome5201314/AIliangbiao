'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ShieldCheck, Sparkles, UserRound, Users } from 'lucide-react';

import { useProfile, type MemberRelation, type UserProfile } from '@/contexts/ProfileContext';

type ModalReason = 'quota' | 'history' | 'member' | 'manual';

interface AccountOnboardingModalProps {
  open: boolean;
  onClose: () => void;
  reason?: ModalReason;
}

const REASON_COPY: Record<ModalReason, { title: string; description: string }> = {
  quota: {
    title: '免费额度已用完',
    description: '注册账号后每天可使用更多免费额度，并保留当前设备上的历史评估记录。',
  },
  history: {
    title: '解锁历史记录与家庭树',
    description: '注册后可管理多个家庭成员档案，并逐步开放时间线与长期追踪能力。',
  },
  member: {
    title: '新增家庭成员档案',
    description: '为自己、孩子、父母或配偶建立独立档案，后续量表和分诊都会按成员隔离。',
  },
  manual: {
    title: '注册并建立成员档案',
    description: '绑定手机号后，可把当前游客数据升级为正式账号，并建立首个成员档案。',
  },
};

function createDefaultProfile(relation: MemberRelation): Partial<UserProfile> {
  return {
    relation,
    languagePreference: 'zh',
    nickname: '',
    realName: '',
    gender: relation === 'child' ? 'boy' : 'boy',
    ageMonths: relation === 'child' ? 36 : 360,
    interests: [],
    fears: [],
  };
}

export default function AccountOnboardingModal({
  open,
  onClose,
  reason = 'manual',
}: AccountOnboardingModalProps) {
  const { isGuest, upgradeAccount, createProfile } = useProfile();
  const copy = REASON_COPY[reason];
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profileDraft, setProfileDraft] = useState<Partial<UserProfile>>(createDefaultProfile(reason === 'member' ? 'child' : 'self'));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const actionLabel = isGuest ? '注册并升级账号' : '新增家庭成员';
  const showContactFields = isGuest;

  const ageHint = useMemo(() => {
    return profileDraft.relation === 'child'
      ? '儿童建议填写月龄，例如 36 表示 3 岁。'
      : '成人/老人可以先填写近似月龄，后续再细化。';
  }, [profileDraft.relation]);

  if (!open) {
    return null;
  }

  if (isGuest) {
    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
        <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
          <div className="bg-gradient-to-r from-slate-900 via-indigo-700 to-cyan-500 px-6 py-6 text-white">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-white/10 p-3">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-xl font-bold">登录后解锁正式档案</h2>
                <p className="mt-1 text-sm text-white/85">
                  游客模式只保留当前页临时受测对象，不再创建家庭成员档案。登录后即可管理正式成员、历史记录与医生协作能力。
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-5 px-6 py-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              当前建议直接进入登录或注册页面完成账号操作；患者端当前使用手机号/邮箱加密码登录，注册后也会继续使用密码登录。
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auth/login"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-600"
              >
                <span>去登录</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/auth/register"
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <span>去注册</span>
                <Sparkles className="h-4 w-4" />
              </Link>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="rounded-full px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100"
              >
                先这样
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!profileDraft.nickname?.trim()) {
      setError('请先填写成员昵称');
      return;
    }

    if (showContactFields) {
      if (!phone.trim()) {
        setError('请输入手机号');
        return;
      }
      if (!password.trim() || password.trim().length < 8) {
        setError('请输入至少 8 位密码');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      if (isGuest) {
        await upgradeAccount({
          phone: phone.trim(),
          email: email.trim() || undefined,
          password: password.trim(),
          profile: {
            ...profileDraft,
            realName: profileDraft.realName || profileDraft.nickname,
            contactPhone: phone.trim(),
          },
        });
      } else {
        await createProfile(profileDraft);
      }

      setPhone('');
      setEmail('');
      setPassword('');
      setProfileDraft(createDefaultProfile(reason === 'member' ? 'child' : 'self'));
      onClose();
    } catch (submitError) {
      console.error('Account onboarding failed:', submitError);
      setError(submitError instanceof Error ? submitError.message : '提交失败，请稍后重试');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="bg-gradient-to-r from-slate-900 via-indigo-700 to-cyan-500 px-6 py-6 text-white">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-white/10 p-3">
              {reason === 'member' ? <Users className="h-6 w-6" /> : <ShieldCheck className="h-6 w-6" />}
            </div>
            <div>
              <h2 className="text-xl font-bold">{copy.title}</h2>
              <p className="mt-1 text-sm text-white/85">{copy.description}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-6">
          {showContactFields && (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Sparkles className="h-4 w-4 text-indigo-500" />
                <span>患者账号注册</span>
              </div>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="请输入手机号"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-indigo-400"
              />
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="邮箱（可选）"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-indigo-400"
              />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请输入至少 8 位密码"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-indigo-400"
              />
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <UserRound className="h-4 w-4 text-indigo-500" />
              <span>家庭成员档案</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select
                value={profileDraft.relation}
                onChange={(event) =>
                  setProfileDraft((prev) => ({
                    ...prev,
                    relation: event.target.value as MemberRelation,
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-indigo-400"
              >
                <option value="self">本人</option>
                <option value="child">孩子</option>
                <option value="parent">父母</option>
                <option value="spouse">配偶</option>
                <option value="sibling">兄弟姐妹</option>
                <option value="other">其他</option>
              </select>

              <select
                value={profileDraft.languagePreference}
                onChange={(event) =>
                  setProfileDraft((prev) => ({
                    ...prev,
                    languagePreference: event.target.value as UserProfile['languagePreference'],
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-indigo-400"
              >
                <option value="zh">中文</option>
                <option value="en">English</option>
              </select>
            </div>

            <input
              value={profileDraft.nickname || ''}
              onChange={(event) => setProfileDraft((prev) => ({ ...prev, nickname: event.target.value }))}
              placeholder="成员昵称，例如：本人 / 儿子 / 妈妈"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-indigo-400"
            />

            <input
              value={profileDraft.realName || ''}
              onChange={(event) => setProfileDraft((prev) => ({ ...prev, realName: event.target.value }))}
              placeholder="真实姓名（可选）"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-indigo-400"
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select
                value={profileDraft.gender}
                onChange={(event) =>
                  setProfileDraft((prev) => ({
                    ...prev,
                    gender: event.target.value as UserProfile['gender'],
                  }))
                }
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-indigo-400"
              >
                <option value="boy">男</option>
                <option value="girl">女</option>
              </select>

              <input
                type="number"
                min="0"
                value={profileDraft.ageMonths ?? ''}
                onChange={(event) =>
                  setProfileDraft((prev) => ({
                    ...prev,
                    ageMonths: Number.parseInt(event.target.value, 10) || 0,
                  }))
                }
                placeholder="月龄"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-indigo-400"
              />
            </div>
            <p className="text-xs text-slate-500">{ageHint}</p>
          </div>

          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100"
            >
              稍后再说
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-600 disabled:bg-slate-400"
            >
              <span>{isSubmitting ? '提交中...' : actionLabel}</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
