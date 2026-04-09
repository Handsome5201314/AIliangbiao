'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
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
    description: '注册患者账号后，每日免费评测额度提升到 10 次，并可保留当前设备历史记录。',
  },
  history: {
    title: '解锁历史记录与家庭树',
    description: '注册后可以管理多个家庭成员档案，并把评测结果安全保存到云端做长期追踪。',
  },
  member: {
    title: '新增家庭成员档案',
    description: '为自己、孩子、父母或配偶建立独立评测档案，后续分诊与量表结果将按成员隔离。',
  },
  manual: {
    title: '注册患者账号并建立档案',
    description: '注册后可把当前游客数据升级为正式患者账号，并把成员资料和评测记录保存到云端。',
  },
};

function createDefaultProfile(relation: MemberRelation): Partial<UserProfile> {
  return {
    relation,
    languagePreference: 'zh',
    nickname: '',
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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profileDraft, setProfileDraft] = useState<Partial<UserProfile>>(
    createDefaultProfile(reason === 'member' ? 'child' : 'self')
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentVersion, setConsentVersion] = useState('');
  const [consentTitle, setConsentTitle] = useState('用户隐私风险知情同意书');
  const [consentContent, setConsentContent] = useState('');

  const actionLabel = isGuest ? '注册患者账号并建立档案' : '新增家庭成员';
  const ageHint = useMemo(() => {
    return profileDraft.relation === 'child' ? '儿童建议填月龄，如 36 代表 3 岁。' : '成人/老人可先保留默认值，后续再细化。';
  }, [profileDraft.relation]);

  useEffect(() => {
    if (!open || !isGuest) {
      return;
    }

    fetch('/api/legal/privacy-consent/current')
      .then((response) => response.json())
      .then((payload) => {
        setConsentVersion(payload.version || '');
        setConsentTitle(payload.title || '用户隐私风险知情同意书');
        setConsentContent(payload.content || '');
      })
      .catch((loadError) => {
        console.error('Failed to load privacy consent:', loadError);
      });
  }, [isGuest, open]);

  if (!open) {
    return null;
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!profileDraft.nickname?.trim()) {
      setError('请先填写成员昵称');
      return;
    }

    if (isGuest && !email.trim()) {
      setError('请填写邮箱');
      return;
    }

    if (isGuest && password.trim().length < 8) {
      setError('密码至少需要 8 位');
      return;
    }

    if (isGuest && !consentChecked) {
      setError('请先勾选隐私风险知情同意书');
      return;
    }

    setIsSubmitting(true);

    try {
      if (isGuest) {
        await upgradeAccount({
          email: email.trim(),
          password: password.trim(),
          consentAccepted: consentChecked,
          consentVersion,
          profile: profileDraft,
        });
      } else {
        await createProfile(profileDraft);
      }

      setEmail('');
      setPassword('');
      setConsentChecked(false);
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
          {isGuest && (
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Sparkles className="h-4 w-4 text-indigo-500" />
                患者账号注册
              </div>
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="请输入邮箱"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-indigo-400"
              />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="请设置密码（至少8位）"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-indigo-400"
              />
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold mb-2">{consentTitle}</p>
                <div className="max-h-40 overflow-y-auto whitespace-pre-wrap text-xs leading-6 text-amber-800">
                  {consentContent || '正在加载知情同意书...'}
                </div>
                <label className="mt-3 flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={consentChecked}
                    onChange={(event) => setConsentChecked(event.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-amber-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs leading-5">
                    我已阅读并知悉：注册后账号资料、成员档案与测评结果会保存到云端；我同意当前版本
                    {consentVersion ? `（${consentVersion}）` : ''}的隐私风险知情说明。
                  </span>
                </label>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <UserRound className="h-4 w-4 text-indigo-500" />
              家庭成员档案
            </div>

            <div className="grid grid-cols-2 gap-3">
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
              placeholder="成员昵称，例如：本人 / 儿子 / 父亲"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-indigo-400"
            />

            <div className="grid grid-cols-2 gap-3">
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
