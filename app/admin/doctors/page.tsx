'use client';

import { useEffect, useState } from 'react';

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [status, setStatus] = useState('');

  const load = async () => {
    const response = await fetch('/api/admin/doctors/pending');
    const data = await response.json();
    setDoctors(data.doctors || []);
  };

  useEffect(() => {
    void load();
  }, []);

  const review = async (doctorId: string, action: 'approve' | 'reject' | 'suspend') => {
    const reviewNotes = window.prompt('请输入审核备注（可选）') || '';
    const response = await fetch(`/api/admin/doctors/${doctorId}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewNotes }),
    });
    const data = await response.json();
    setStatus(response.ok ? `医生已${action}` : data.error || '操作失败');
    await load();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">医生审核</h2>
        <p className="mt-1 text-sm text-slate-500">审核医生注册资料，决定是否允许其查看患者数据。</p>
      </div>

      {status && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {status}
        </div>
      )}

      <div className="space-y-4">
        {doctors.length ? doctors.map((doctor) => (
          <div key={doctor.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{doctor.realName}</h3>
                <p className="text-sm text-slate-500">{doctor.hospitalName} · {doctor.departmentName} · {doctor.title}</p>
                <p className="mt-1 text-sm text-slate-500">邮箱：{doctor.user?.email || '未填写'} · 证号：{doctor.licenseNo}</p>
              </div>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                {doctor.verificationStatus}
              </span>
            </div>
            <div className="mt-4 flex gap-3">
              <button onClick={() => void review(doctor.id, 'approve')} className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
                审核通过
              </button>
              <button onClick={() => void review(doctor.id, 'reject')} className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white">
                驳回
              </button>
              <button onClick={() => void review(doctor.id, 'suspend')} className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                暂停
              </button>
            </div>
          </div>
        )) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-400">
            当前没有待审核医生
          </div>
        )}
      </div>
    </div>
  );
}
