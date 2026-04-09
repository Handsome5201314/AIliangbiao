'use client';

import { useEffect, useState } from 'react';

export default function DoctorResearchPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/doctor/research')
      .then((res) => res.json())
      .then((data) => {
        if (data.logs) {
          setLogs(data.logs);
        } else if (data.error) {
          setError(data.error);
        }
      })
      .catch((fetchError) => {
        setError(fetchError instanceof Error ? fetchError.message : '加载科研导出记录失败');
      });
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">科研导出记录</h1>
        <p className="mt-1 text-sm text-slate-500">查看自己发起的科研导出审计记录。</p>
      </div>

      {error && <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}

      <div className="space-y-3">
        {logs.map((log) => (
          <div key={log.id} className="rounded-3xl bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">{log.exportType.toUpperCase()}</div>
            <div className="mt-2 text-sm text-slate-500">
              成员关系：{String(log.memberProfile?.relation || '').toLowerCase()} · 性别：{log.memberProfile?.gender || '未知'} · 年龄（月龄）：{log.memberProfile?.ageMonths ?? '未知'}
            </div>
            <div className="mt-1 text-xs text-slate-400">
              导出时间：{new Date(log.createdAt).toLocaleString()} · 用途：{log.purpose || '未填写'}
            </div>
          </div>
        ))}
        {!logs.length && !error && (
          <div className="rounded-3xl bg-white p-6 text-sm text-slate-500 shadow-sm">暂无科研导出记录</div>
        )}
      </div>
    </div>
  );
}
