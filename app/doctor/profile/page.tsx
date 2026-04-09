'use client';

import { FormEvent, useEffect, useState } from 'react';

export default function DoctorProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/doctor/profile')
      .then((res) => res.json())
      .then((data) => {
        if (data.profile) {
          setProfile(data.profile);
        } else if (data.error) {
          setError(data.error);
        }
      })
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : '加载医生资料失败');
      });
  }, []);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/doctor/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '保存医生资料失败');
      }
      setProfile(data.profile);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '保存医生资料失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">我的资料</h1>
        <p className="mt-1 text-sm text-slate-500">维护医生基础资料与审核状态。</p>
      </div>

      {error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}

      {profile && (
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 rounded-3xl bg-white p-6 shadow-sm sm:grid-cols-2">
          <input value={profile.realName || ''} onChange={(e) => setProfile((current: any) => ({ ...current, realName: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3" />
          <input value={profile.title || ''} onChange={(e) => setProfile((current: any) => ({ ...current, title: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3" />
          <input value={profile.hospitalName || ''} onChange={(e) => setProfile((current: any) => ({ ...current, hospitalName: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3" />
          <input value={profile.departmentName || ''} onChange={(e) => setProfile((current: any) => ({ ...current, departmentName: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3" />
          <input value={profile.licenseNo || ''} onChange={(e) => setProfile((current: any) => ({ ...current, licenseNo: e.target.value }))} className="rounded-2xl border border-slate-200 px-4 py-3 sm:col-span-2" />
          <div className="text-sm text-slate-500 sm:col-span-2">审核状态：{profile.verificationStatus}</div>
          <button type="submit" disabled={saving} className="rounded-2xl bg-slate-900 px-4 py-3 text-white font-semibold disabled:bg-slate-400 sm:col-span-2">
            {saving ? '保存中...' : '保存资料'}
          </button>
        </form>
      )}
    </div>
  );
}
