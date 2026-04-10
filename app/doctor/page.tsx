'use client';

import { useEffect, useState } from 'react';
import { Activity, ClipboardList, FlaskConical, StickyNote } from 'lucide-react';

import { useAuthSession } from '@/contexts/AuthSessionContext';

export default function DoctorDashboardPage() {
  const { authHeaders } = useAuthSession();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/doctor/me/dashboard', { headers: authHeaders })
      .then((res) => res.json())
      .then(setData)
      .catch(console.error);
  }, [authHeaders]);

  const cards = [
    { title: '我的患者', value: data?.patientCount ?? 0, icon: <ClipboardList className="w-6 h-6" />, color: 'bg-blue-50 text-blue-700' },
    { title: '最近测评', value: data?.recentAssessmentCount ?? 0, icon: <Activity className="w-6 h-6" />, color: 'bg-purple-50 text-purple-700' },
    { title: '最近备注', value: data?.recentNotesCount ?? 0, icon: <StickyNote className="w-6 h-6" />, color: 'bg-amber-50 text-amber-700' },
    { title: '科研导出', value: data?.researchExportCount ?? 0, icon: <FlaskConical className="w-6 h-6" />, color: 'bg-emerald-50 text-emerald-700' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">医生仪表盘</h1>
        <p className="mt-2 text-sm text-slate-500">查看你的患者、最新测评、私有备注与科研导出情况。</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.title} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className={`inline-flex rounded-2xl p-3 ${card.color}`}>{card.icon}</div>
            <div className="mt-4 text-sm text-slate-500">{card.title}</div>
            <div className="mt-1 text-3xl font-bold text-slate-900">{card.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">最近测评</h2>
          <div className="mt-4 space-y-3">
            {(data?.recentAssessments || []).length ? data.recentAssessments.map((item: any) => (
              <div key={item.id} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                <div className="font-semibold text-slate-900">{item.scaleId}</div>
                <div className="text-slate-600">{item.conclusion}</div>
              </div>
            )) : <div className="text-sm text-slate-400">暂无测评数据</div>}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">最近备注</h2>
          <div className="mt-4 space-y-3">
            {(data?.recentNotes || []).length ? data.recentNotes.map((item: any) => (
              <div key={item.id} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                <div className="font-semibold text-slate-900">{item.noteType}</div>
                <div className="text-slate-600 line-clamp-2">{item.content}</div>
              </div>
            )) : <div className="text-sm text-slate-400">暂无医生备注</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
