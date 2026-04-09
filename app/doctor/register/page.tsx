'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DoctorRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    email: '',
    password: '',
    realName: '',
    hospitalName: '',
    departmentName: '',
    title: '',
    licenseNo: '',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (key: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const response = await fetch('/api/auth/register-doctor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '医生注册失败');
      }

      router.push('/doctor');
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '医生注册失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-slate-900">医生注册</h1>
        <p className="mt-2 text-sm text-slate-500">注册后需经平台审核通过，才能进入医生工作台。</p>

        <form onSubmit={handleSubmit} className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input value={form.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="邮箱" className="rounded-2xl border border-slate-200 px-4 py-3 sm:col-span-2" />
          <input type="password" value={form.password} onChange={(e) => handleChange('password', e.target.value)} placeholder="密码（至少8位）" className="rounded-2xl border border-slate-200 px-4 py-3 sm:col-span-2" />
          <input value={form.realName} onChange={(e) => handleChange('realName', e.target.value)} placeholder="真实姓名" className="rounded-2xl border border-slate-200 px-4 py-3" />
          <input value={form.title} onChange={(e) => handleChange('title', e.target.value)} placeholder="职称" className="rounded-2xl border border-slate-200 px-4 py-3" />
          <input value={form.hospitalName} onChange={(e) => handleChange('hospitalName', e.target.value)} placeholder="医院名称" className="rounded-2xl border border-slate-200 px-4 py-3" />
          <input value={form.departmentName} onChange={(e) => handleChange('departmentName', e.target.value)} placeholder="科室名称" className="rounded-2xl border border-slate-200 px-4 py-3" />
          <input value={form.licenseNo} onChange={(e) => handleChange('licenseNo', e.target.value)} placeholder="执业证号" className="rounded-2xl border border-slate-200 px-4 py-3 sm:col-span-2" />
          {error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 sm:col-span-2">{error}</div>}
          <button type="submit" disabled={submitting} className="rounded-2xl bg-slate-900 px-4 py-3 text-white font-semibold disabled:bg-slate-400 sm:col-span-2">
            {submitting ? '提交中...' : '提交医生注册'}
          </button>
        </form>
      </div>
    </div>
  );
}
