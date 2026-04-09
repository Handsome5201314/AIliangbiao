'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DoctorLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '医生登录失败');
      }

      if (data.user?.accountType !== 'DOCTOR') {
        throw new Error('当前账号不是医生账号');
      }

      router.push('/doctor');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '医生登录失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md rounded-3xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-slate-900">医生登录</h1>
        <p className="mt-2 text-sm text-slate-500">登录后若尚未审核通过，将看到审核状态提示。</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="邮箱" className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码" className="w-full rounded-2xl border border-slate-200 px-4 py-3" />
          {error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}
          <button type="submit" disabled={submitting} className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-white font-semibold disabled:bg-slate-400">
            {submitting ? '登录中...' : '登录医生工作台'}
          </button>
        </form>
      </div>
    </div>
  );
}
