'use client';

import { useEffect, useState } from 'react';

export default function DoctorPatientsPage() {
  const [query, setQuery] = useState('');
  const [patients, setPatients] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) {
      params.set('q', query.trim());
    }

    fetch(`/api/doctor/patients?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.patients) {
          setPatients(data.patients);
        } else if (data.error) {
          setError(data.error);
        }
      })
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : '加载患者列表失败');
      });
  }, [query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">患者列表</h1>
        <p className="mt-1 text-sm text-slate-500">仅显示当前与您处于 ACTIVE 绑定关系的成员。</p>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="搜索昵称、邮箱或关系"
        className="w-full rounded-2xl border border-slate-200 px-4 py-3"
      />

      {error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}

      <div className="space-y-3">
        {patients.map((patient) => (
          <a key={patient.memberId} href={`/doctor/patients/${patient.memberId}`} className="block rounded-3xl bg-white p-5 shadow-sm hover:shadow-md">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">{patient.nickname}</div>
                <div className="mt-1 text-sm text-slate-500">
                  {patient.relation} · {patient.gender} · {patient.ageMonths ?? '未知'} 月
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  患者邮箱：{patient.patientEmail || '未提供'} · 科研授权：{patient.researchConsentStatus}
                </div>
              </div>
              <div className="text-right text-sm text-slate-500">
                <div>绑定时间</div>
                <div className="mt-1">{new Date(patient.startedAt).toLocaleString()}</div>
                {patient.latestAssessment && (
                  <div className="mt-2 text-xs text-indigo-600">
                    最近测评：{patient.latestAssessment.scaleId} / {patient.latestAssessment.conclusion}
                  </div>
                )}
              </div>
            </div>
          </a>
        ))}
        {!patients.length && !error && (
          <div className="rounded-3xl bg-white p-6 text-sm text-slate-500 shadow-sm">暂无患者数据</div>
        )}
      </div>
    </div>
  );
}
