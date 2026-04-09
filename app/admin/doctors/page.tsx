'use client';

import { useEffect, useState } from 'react';

type DoctorRecord = {
  id: string;
  realName: string;
  hospitalName: string;
  departmentName: string;
  title: string;
  licenseNo: string;
  verificationStatus: string;
  user?: {
    email?: string;
    createdAt?: string;
  };
};

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<DoctorRecord[]>([]);
  const [error, setError] = useState('');

  const loadDoctors = async () => {
    const token = localStorage.getItem('admin_token');
    const response = await fetch('/api/admin/doctors/pending', {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || '加载待审核医生失败');
    }
    setDoctors(data.doctors || []);
  };

  useEffect(() => {
    loadDoctors().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : '加载待审核医生失败');
    });
  }, []);

  const mutateDoctor = async (doctorId: string, action: 'approve' | 'reject' | 'suspend') => {
    const token = localStorage.getItem('admin_token');
    const response = await fetch(`/api/admin/doctors/${doctorId}/${action}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || `医生${action}失败`);
    }
    await loadDoctors();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">医生审核</h2>
        <p className="text-sm text-slate-500 mt-1">审核医生注册申请，控制医生账号的接诊权限。</p>
      </div>

      {error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}

      <div className="space-y-3">
        {doctors.map((doctor) => (
          <div key={doctor.id} className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">{doctor.realName}</div>
                <div className="mt-1 text-sm text-slate-500">
                  {doctor.hospitalName} · {doctor.departmentName} · {doctor.title}
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  邮箱：{doctor.user?.email || '未提供'} · 执业证号：{doctor.licenseNo}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => void mutateDoctor(doctor.id, 'approve')} className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm text-white">
                  通过
                </button>
                <button onClick={() => void mutateDoctor(doctor.id, 'reject')} className="rounded-2xl bg-amber-500 px-4 py-2 text-sm text-white">
                  拒绝
                </button>
                <button onClick={() => void mutateDoctor(doctor.id, 'suspend')} className="rounded-2xl bg-rose-600 px-4 py-2 text-sm text-white">
                  暂停
                </button>
              </div>
            </div>
          </div>
        ))}
        {!doctors.length && !error && (
          <div className="rounded-3xl bg-white p-6 text-sm text-slate-500 shadow-sm">暂无待审核医生</div>
        )}
      </div>
    </div>
  );
}
