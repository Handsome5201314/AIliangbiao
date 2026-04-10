'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, UserRound } from 'lucide-react';

import { useAuthSession } from '@/contexts/AuthSessionContext';

export default function DoctorPatientsPage() {
  const { authHeaders } = useAuthSession();
  const [patients, setPatients] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [consent, setConsent] = useState<'ALL' | 'GRANTED' | 'REVOKED'>('ALL');

  useEffect(() => {
    const url = new URL('/api/doctor/patients', window.location.origin);
    if (query) url.searchParams.set('q', query);
    if (consent !== 'ALL') url.searchParams.set('consent', consent);

    fetch(url.toString(), { headers: authHeaders })
      .then((res) => res.json())
      .then((data) => setPatients(data.patients || []))
      .catch(console.error);
  }, [authHeaders, consent, query]);

  const emptyLabel = useMemo(() => {
    if (query) return '未找到匹配的患者';
    return '当前暂无已绑定患者';
  }, [query]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">患者管理</h1>
        <p className="mt-2 text-sm text-slate-500">只展示当前医生 ACTIVE 绑定的成员档案。</p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索成员昵称或患者邮箱"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-10 py-3 text-sm outline-none focus:border-cyan-300"
            />
          </div>
          <select
            value={consent}
            onChange={(event) => setConsent(event.target.value as 'ALL' | 'GRANTED' | 'REVOKED')}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
          >
            <option value="ALL">全部科研状态</option>
            <option value="GRANTED">已科研授权</option>
            <option value="REVOKED">已撤销科研授权</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {patients.length ? patients.map((patient) => (
          <a
            key={patient.memberId}
            href={`/doctor/patients/${patient.memberId}`}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{patient.nickname}</h2>
                  <p className="text-sm text-slate-500">{patient.patientEmail || '未填写邮箱'} · {patient.relation}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {patient.latestAssessment ? `${patient.latestAssessment.scaleId} · ${patient.latestAssessment.conclusion}` : '暂无测评记录'}
                  </p>
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                patient.researchConsent === 'GRANTED'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-100 text-slate-600'
              }`}>
                {patient.researchConsent === 'GRANTED' ? '已科研授权' : '未科研授权'}
              </span>
            </div>
          </a>
        )) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-400">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  );
}
