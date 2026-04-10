'use client';

import { useEffect, useState } from 'react';

import { useAuthSession } from '@/contexts/AuthSessionContext';

export default function DoctorProfilePage() {
  const { authHeaders } = useAuthSession();
  const [profile, setProfile] = useState<any>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetch('/api/doctor/profile', { headers: authHeaders })
      .then((res) => res.json())
      .then((data) => setProfile(data.doctorProfile))
      .catch(console.error);
  }, [authHeaders]);

  const saveProfile = async () => {
    const response = await fetch('/api/doctor/profile', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        realName: profile.realName,
        hospitalName: profile.hospitalName,
        departmentName: profile.departmentName,
        title: profile.title,
      }),
    });
    const data = await response.json();
    setStatus(response.ok ? '保存成功' : data.error || '保存失败');
  };

  if (!profile) {
    return <div className="text-sm text-slate-500">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">医生资料</h1>
        <p className="mt-2 text-sm text-slate-500">维护医生公开信息与审核资料。</p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-2 block font-medium text-slate-700">真实姓名</span>
            <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" value={profile.realName} onChange={(e) => setProfile({ ...profile, realName: e.target.value })} />
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium text-slate-700">医院</span>
            <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" value={profile.hospitalName} onChange={(e) => setProfile({ ...profile, hospitalName: e.target.value })} />
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium text-slate-700">科室</span>
            <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" value={profile.departmentName} onChange={(e) => setProfile({ ...profile, departmentName: e.target.value })} />
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium text-slate-700">职称</span>
            <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" value={profile.title} onChange={(e) => setProfile({ ...profile, title: e.target.value })} />
          </label>
        </div>

        <div className="mt-4 text-sm text-slate-500">审核状态：{profile.verificationStatus}</div>
        <div className="mt-4 flex items-center gap-3">
          <button type="button" onClick={() => void saveProfile()} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
            保存资料
          </button>
          {status && <span className="text-sm text-slate-500">{status}</span>}
        </div>
      </div>
    </div>
  );
}
