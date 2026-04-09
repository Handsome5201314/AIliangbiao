'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<'boy' | 'girl'>('boy');
  const [relation, setRelation] = useState('self');
  const [ageMonths, setAgeMonths] = useState(360);
  const [consentChecked, setConsentChecked] = useState(false);
  const [consentTitle, setConsentTitle] = useState('用户隐私风险知情同意书');
  const [consentVersion, setConsentVersion] = useState('');
  const [consentContent, setConsentContent] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/legal/privacy-consent/current')
      .then((res) => res.json())
      .then((data) => {
        setConsentTitle(data.title || '用户隐私风险知情同意书');
        setConsentVersion(data.version || '');
        setConsentContent(data.content || '');
      })
      .catch((loadError) => {
        console.error('Failed to load privacy consent:', loadError);
      });
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      let deviceId = localStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('device_id', deviceId);
      }

      const response = await fetch('/api/auth/register-patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          email,
          password,
          consentAccepted: consentChecked,
          consentVersion,
          profile: {
            nickname,
            gender,
            relation,
            ageMonths,
            languagePreference: 'zh',
          },
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '患者注册失败');
      }

      router.push('/');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '患者注册失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-slate-900">注册患者账号</h1>
        <p className="mt-2 text-sm text-slate-500">注册后成员档案、评测结果与历史记录将保存到云端。</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="邮箱" className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码（至少8位）" className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="首个成员昵称" className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
          <div className="grid grid-cols-3 gap-3">
            <select value={relation} onChange={(e) => setRelation(e.target.value)} className="rounded-2xl border border-slate-200 px-4 py-3">
              <option value="self">本人</option>
              <option value="child">孩子</option>
              <option value="parent">父母</option>
              <option value="spouse">配偶</option>
              <option value="sibling">兄弟姐妹</option>
              <option value="other">其他</option>
            </select>
            <select value={gender} onChange={(e) => setGender(e.target.value as 'boy' | 'girl')} className="rounded-2xl border border-slate-200 px-4 py-3">
              <option value="boy">男</option>
              <option value="girl">女</option>
            </select>
            <input type="number" min="0" value={ageMonths} onChange={(e) => setAgeMonths(Number.parseInt(e.target.value, 10) || 0)} placeholder="月龄" className="rounded-2xl border border-slate-200 px-4 py-3" />
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="font-semibold text-amber-900">{consentTitle}</p>
            <div className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-amber-800">
              {consentContent || '正在加载知情同意书...'}
            </div>
            <label className="mt-4 flex items-start gap-3 text-sm text-amber-900">
              <input type="checkbox" checked={consentChecked} onChange={(e) => setConsentChecked(e.target.checked)} className="mt-1 h-4 w-4" />
              <span>我已阅读并同意当前版本{consentVersion ? `（${consentVersion}）` : ''}的云端隐私风险知情同意书。</span>
            </label>
          </div>

          {error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}

          <button type="submit" disabled={submitting} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-white font-semibold disabled:bg-slate-400">
            {submitting ? '提交中...' : '注册患者账号'}
          </button>
        </form>
      </div>
    </div>
  );
}
