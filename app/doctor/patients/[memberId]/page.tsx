'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function DoctorPatientDetailPage() {
  const params = useParams<{ memberId: string }>();
  const memberId = params?.memberId || '';
  const [detail, setDetail] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [noteContent, setNoteContent] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!memberId) {
      return;
    }

    Promise.all([
      fetch(`/api/doctor/patients/${memberId}`).then((res) => res.json()),
      fetch(`/api/doctor/patients/${memberId}/timeline`).then((res) => res.json()),
    ])
      .then(([detailData, timelineData]) => {
        if (detailData.error) {
          setError(detailData.error);
          return;
        }
        setDetail(detailData);
        setTimeline(timelineData.timeline || []);
      })
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : '加载患者详情失败');
      });
  }, [memberId]);

  const submitNote = async (event: FormEvent) => {
    event.preventDefault();
    if (!memberId || !noteContent.trim()) {
      return;
    }

    const response = await fetch(`/api/doctor/patients/${memberId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: noteContent, noteType: 'CLINICAL' }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error || '保存备注失败');
      return;
    }

    setNoteContent('');
    const refreshed = await fetch(`/api/doctor/patients/${memberId}/timeline`).then((res) => res.json());
    setTimeline(refreshed.timeline || []);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">患者详情</h1>
        <p className="mt-1 text-sm text-slate-500">查看成员画像、测评时间线、科研授权和医生私有备注。</p>
      </div>

      {error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}

      {detail?.member && (
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <div className="text-xl font-semibold text-slate-900">{detail.member.nickname}</div>
          <div className="mt-2 text-sm text-slate-500">
            {String(detail.member.relation || '').toLowerCase()} · {detail.member.gender} · {detail.member.ageMonths ?? '未知'} 月
          </div>
          <div className="mt-3 text-sm text-slate-600">
            主治绑定开始：{detail.careAssignment ? new Date(detail.careAssignment.startedAt).toLocaleString() : '未绑定'}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            科研授权状态：{detail.researchConsent?.status || 'REVOKED'}
          </div>
          <div className="mt-1 text-sm text-slate-600">患者邮箱：{detail.member.user?.email || '未提供'}</div>
        </div>
      )}

      <form onSubmit={submitNote} className="rounded-3xl bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">新增医生备注</h2>
        <textarea
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          placeholder="输入本次随访或科研备注..."
          className="mt-4 min-h-[120px] w-full rounded-2xl border border-slate-200 px-4 py-3"
        />
        <button type="submit" className="mt-4 rounded-2xl bg-slate-900 px-4 py-3 text-white font-semibold">
          保存备注
        </button>
      </form>

      <div className="rounded-3xl bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">时间线</h2>
          {memberId && (
            <a
              href={`/api/doctor/patients/${memberId}/export?type=csv&purpose=${encodeURIComponent('doctor-research')}`}
              className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
            >
              下载科研 CSV
            </a>
          )}
        </div>
        <div className="mt-4 space-y-3">
          {timeline.map((item, index) => (
            <div key={`${item.type}-${index}`} className="rounded-2xl border border-slate-200 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">{item.type}</div>
              <div className="mt-2 text-sm text-slate-500">{new Date(item.createdAt).toLocaleString()}</div>
              <pre className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{JSON.stringify(item.payload, null, 2)}</pre>
            </div>
          ))}
          {!timeline.length && <div className="text-sm text-slate-500">暂无时间线事件</div>}
        </div>
      </div>
    </div>
  );
}
