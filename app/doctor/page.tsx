'use client';

import { useEffect, useState } from 'react';

export default function DoctorDashboardPage() {
  const [dashboard, setDashboard] = useState<{ patientCount: number; recentAssessments: number; recentNotes: number } | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/doctor/me/dashboard')
      .then((res) => res.json())
      .then((data) => {
        if (data.dashboard) {
          setDashboard(data.dashboard);
        } else if (data.error) {
          setError(data.error);
        }
      })
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : '加载医生工作台失败');
      });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">医生工作台</h1>
        <p className="mt-1 text-sm text-slate-500">查看当前患者数、最近测评与备注动态。</p>
      </div>

      {error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">当前患者数</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{dashboard?.patientCount ?? '-'}</div>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">近 7 天新增测评</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{dashboard?.recentAssessments ?? '-'}</div>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="text-sm text-slate-500">近 7 天新增备注</div>
          <div className="mt-2 text-3xl font-bold text-slate-900">{dashboard?.recentNotes ?? '-'}</div>
        </div>
      </div>
    </div>
  );
}
