'use client';

import { useEffect, useMemo, useState } from 'react';
import { Download, StickyNote, UserRound } from 'lucide-react';

import { useAuthSession } from '@/contexts/AuthSessionContext';

export default function DoctorPatientDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { authHeaders } = useAuthSession();
  const [memberId, setMemberId] = useState('');
  const [patient, setPatient] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [note, setNote] = useState('');
  const [noteType, setNoteType] = useState<'CLINICAL' | 'RESEARCH'>('CLINICAL');
  const [status, setStatus] = useState('');

  useEffect(() => {
    params.then((resolved) => setMemberId(resolved.memberId));
  }, [params]);

  useEffect(() => {
    if (!memberId) return;
    fetch(`/api/doctor/patients/${memberId}`, { headers: authHeaders })
      .then((res) => res.json())
      .then((data) => setPatient(data.patient))
      .catch(console.error);
    fetch(`/api/doctor/patients/${memberId}/timeline`, { headers: authHeaders })
      .then((res) => res.json())
      .then((data) => setEvents(data.events || []))
      .catch(console.error);
  }, [authHeaders, memberId]);

  const submitNote = async () => {
    if (!note.trim()) return;

    const response = await fetch(`/api/doctor/patients/${memberId}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        noteType,
        content: note.trim(),
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      setStatus(data.error || '添加备注失败');
      return;
    }

    setStatus('备注已保存');
    setNote('');
    const timeline = await fetch(`/api/doctor/patients/${memberId}/timeline`, { headers: authHeaders }).then((res) => res.json());
    setEvents(timeline.events || []);
  };

  const exportHref = useMemo(() => {
    if (!memberId) return '#';
    return `/api/doctor/patients/${memberId}/export?format=CSV&purpose=research`;
  }, [memberId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">患者时间线</h1>
        <p className="mt-2 text-sm text-slate-500">查看测评记录、添加私有备注、下载科研导出。</p>
      </div>

      {patient && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{patient.memberProfile.nickname}</h2>
                <p className="text-sm text-slate-500">
                  {patient.memberProfile.relation} · {patient.memberProfile.gender} · {patient.memberProfile.ageMonths ?? '未知'} 月
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  科研授权：{patient.memberProfile.researchConsent?.status || '未授权'}
                </p>
              </div>
            </div>
            <a
              href={exportHref}
              className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600"
            >
              <Download className="h-4 w-4" />
              <span>科研导出 CSV</span>
            </a>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">医生备注</h2>
        <div className="mt-4 flex flex-col gap-3">
          <select
            value={noteType}
            onChange={(event) => setNoteType(event.target.value as 'CLINICAL' | 'RESEARCH')}
            className="max-w-xs rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
          >
            <option value="CLINICAL">临床备注</option>
            <option value="RESEARCH">科研备注</option>
          </select>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="添加备注，默认仅医生端和平台管理员可见。"
            className="min-h-[120px] rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-300"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void submitNote()}
              className="inline-flex items-center gap-2 rounded-full bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700"
            >
              <StickyNote className="h-4 w-4" />
              <span>保存备注</span>
            </button>
            {status && <span className="text-sm text-slate-500">{status}</span>}
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">时间线</h2>
        <div className="mt-4 space-y-4">
          {events.length ? events.map((event) => (
            <div key={`${event.type}-${event.id}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-900">
                  {event.type === 'ASSESSMENT' ? event.scaleId : `${event.noteType} 备注`}
                </div>
                <div className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</div>
              </div>
              <div className="mt-2 text-sm text-slate-600">
                {event.type === 'ASSESSMENT'
                  ? `${event.conclusion} · ${event.totalScore}`
                  : event.content}
              </div>
            </div>
          )) : <div className="text-sm text-slate-400">暂无时间线事件</div>}
        </div>
      </section>
    </div>
  );
}
