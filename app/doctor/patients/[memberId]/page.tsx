'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Loader2,
  Share2,
  StickyNote,
  UserRound,
} from 'lucide-react';

import { useAuthSession } from '@/contexts/AuthSessionContext';
import {
  type DoctorAssessmentExportData,
  downloadDoctorAssessmentCsv,
  downloadDoctorAssessmentJson,
  downloadDoctorAssessmentPdf,
  downloadDoctorAssessmentWord,
} from '@/lib/utils/doctorAssessmentExport';

type AccessGrant = {
  id: string;
  accessRole: 'COLLABORATOR' | 'READONLY';
  sourceTeam: {
    id: string;
    name: string;
    hospitalName: string;
    departmentName: string;
  };
  targetDoctor: {
    doctorProfileId: string;
    realName: string;
    hospitalName: string;
    departmentName: string;
    title: string;
  };
};

type ShareableTeam = {
  id: string;
  name: string;
  members: Array<{
    doctorProfileId: string;
    realName: string;
    hospitalName: string;
    departmentName: string;
    title: string;
    teamRole: 'LEAD' | 'MEMBER';
  }>;
};

export default function DoctorPatientDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { authHeaders } = useAuthSession();
  const [memberId, setMemberId] = useState('');
  const [patient, setPatient] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [accessData, setAccessData] = useState<{
    effectiveAccessRole: 'OWNER' | 'COLLABORATOR' | 'READONLY';
    ownerDoctorProfile: {
      id: string;
      realName: string;
      hospitalName: string;
      departmentName: string;
      title: string;
    } | null;
    grants: AccessGrant[];
    shareableTeams: ShareableTeam[];
  } | null>(null);
  const [note, setNote] = useState('');
  const [noteType, setNoteType] = useState<'CLINICAL' | 'RESEARCH'>('CLINICAL');
  const [status, setStatus] = useState('');
  const [exportingKey, setExportingKey] = useState<string | null>(null);
  const [shareTeamId, setShareTeamId] = useState('');
  const [shareDoctorId, setShareDoctorId] = useState('');
  const [shareRole, setShareRole] = useState<'COLLABORATOR' | 'READONLY'>('COLLABORATOR');

  useEffect(() => {
    params.then((resolved) => setMemberId(resolved.memberId));
  }, [params]);

  const loadAll = async (nextMemberId: string) => {
    const [patientRes, timelineRes, accessRes] = await Promise.all([
      fetch(`/api/doctor/patients/${nextMemberId}`, { headers: authHeaders }),
      fetch(`/api/doctor/patients/${nextMemberId}/timeline`, { headers: authHeaders }),
      fetch(`/api/doctor/patients/${nextMemberId}/access`, { headers: authHeaders }),
    ]);

    const patientData = await patientRes.json().catch(() => ({}));
    const timelineData = await timelineRes.json().catch(() => ({}));
    const accessData = await accessRes.json().catch(() => ({}));

    if (patientRes.ok) {
      setPatient(patientData.patient);
    }
    if (timelineRes.ok) {
      setEvents(timelineData.events || []);
    }
    if (accessRes.ok) {
      setAccessData(accessData);
      setShareTeamId((current) => current || accessData.shareableTeams?.[0]?.id || '');
    }
  };

  useEffect(() => {
    if (!memberId) return;
    void loadAll(memberId).catch(console.error);
  }, [authHeaders, memberId]);

  const accessRole = accessData?.effectiveAccessRole || patient?.effectiveAccessRole || 'READONLY';
  const canWriteNotes = accessRole !== 'READONLY';
  const canManageAccess = accessRole === 'OWNER';
  const canExportResearch = accessRole === 'OWNER';

  const shareTeamOptions = accessData?.shareableTeams || [];
  const currentShareTeam = shareTeamOptions.find((team) => team.id === shareTeamId) || shareTeamOptions[0] || null;
  const currentShareDoctors = currentShareTeam?.members || [];

  useEffect(() => {
    setShareDoctorId((current) =>
      currentShareDoctors.some((doctor) => doctor.doctorProfileId === current)
        ? current
        : currentShareDoctors[0]?.doctorProfileId || '',
    );
  }, [shareTeamId, currentShareDoctors]);

  const submitNote = async () => {
    if (!note.trim() || !canWriteNotes) return;

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

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.error || '添加备注失败');
      return;
    }

    setStatus('备注已保存');
    setNote('');
    await loadAll(memberId);
  };

  const submitGrant = async () => {
    if (!canManageAccess || !shareTeamId || !shareDoctorId) {
      return;
    }

    const response = await fetch(`/api/doctor/patients/${memberId}/access`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        targetDoctorProfileId: shareDoctorId,
        sourceTeamId: shareTeamId,
        accessRole: shareRole,
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.error || '共享失败');
      return;
    }

    setStatus('共享权限已更新');
    await loadAll(memberId);
  };

  const updateGrantRole = async (grantId: string, accessRole: 'COLLABORATOR' | 'READONLY') => {
    const response = await fetch(`/api/doctor/patients/${memberId}/access/${grantId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ accessRole }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.error || '更新共享角色失败');
      return;
    }

    setStatus('共享角色已更新');
    await loadAll(memberId);
  };

  const revokeGrant = async (grantId: string) => {
    const response = await fetch(`/api/doctor/patients/${memberId}/access/${grantId}`, {
      method: 'DELETE',
      headers: authHeaders,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setStatus(data.error || '撤销共享失败');
      return;
    }

    setStatus('共享权限已撤销');
    await loadAll(memberId);
  };

  const exportHref = useMemo(() => {
    if (!memberId) return '#';
    return `/api/doctor/patients/${memberId}/export?format=CSV&purpose=research`;
  }, [memberId]);

  const exportAssessment = async (
    assessmentId: string,
    format: 'pdf' | 'json' | 'word' | 'csv',
  ) => {
    const exportKey = `${assessmentId}:${format}`;
    setExportingKey(exportKey);
    setStatus('');

    try {
      const response = await fetch(`/api/doctor/patients/${memberId}/assessments/${assessmentId}/report`, {
        headers: authHeaders,
      });
      const data = (await response.json()) as DoctorAssessmentExportData | { error?: string };

      if (!response.ok) {
        throw new Error('error' in data ? data.error || '导出失败' : '导出失败');
      }

      const report = data as DoctorAssessmentExportData;

      if (format === 'json') {
        downloadDoctorAssessmentJson(report);
      } else if (format === 'csv') {
        downloadDoctorAssessmentCsv(report);
      } else if (format === 'word') {
        downloadDoctorAssessmentWord(report);
      } else {
        await downloadDoctorAssessmentPdf(report);
      }

      setStatus(`已导出 ${report.scale.name} 报告（${format.toUpperCase()}）`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '导出失败');
    } finally {
      setExportingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">患者时间线</h1>
        <p className="mt-2 text-sm text-slate-500">查看评估记录、医生备注、共享关系和单次报告导出。</p>
      </div>

      {status ? <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">{status}</div> : null}

      {patient && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex gap-3">
              <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {patient.memberProfile.realName || patient.memberProfile.nickname}
                </h2>
                <p className="text-sm text-slate-500">
                  {patient.memberProfile.contactPhone || '未填写手机号'} · {patient.memberProfile.relation}
                  {patient.memberProfile.pendingClaim ? ' · 待认领' : ''}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {patient.memberProfile.gender} · {patient.memberProfile.ageMonths ?? '未知'} 月
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  当前权限：
                  <span className={`ml-2 rounded-full px-2.5 py-1 text-xs font-semibold ${accessRole === 'OWNER' ? 'bg-cyan-100 text-cyan-700' : accessRole === 'COLLABORATOR' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>
                    {accessRole === 'OWNER' ? '主责' : accessRole === 'COLLABORATOR' ? '协作' : '只读'}
                  </span>
                </p>
                {accessData?.ownerDoctorProfile ? (
                  <p className="mt-1 text-sm text-slate-600">
                    主责医生：{accessData.ownerDoctorProfile.realName} · {accessData.ownerDoctorProfile.departmentName}
                  </p>
                ) : null}
              </div>
            </div>
            <a
              href={canExportResearch ? exportHref : '#'}
              onClick={(event) => {
                if (!canExportResearch) {
                  event.preventDefault();
                  setStatus('只有主责任医生可以执行科研导出');
                }
              }}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                canExportResearch ? 'bg-slate-900 text-white hover:bg-cyan-600' : 'bg-slate-200 text-slate-500'
              }`}
            >
              <Download className="h-4 w-4" />
              <span>科研导出 CSV</span>
            </a>
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <Share2 className="h-5 w-5 text-cyan-700" />
          <h2 className="text-lg font-semibold text-slate-900">团队协作</h2>
        </div>

        {!accessData ? (
          <div className="text-sm text-slate-400">正在加载共享信息...</div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              主责医生：{accessData.ownerDoctorProfile?.realName || '未设置'}
            </div>

            {canManageAccess ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="grid gap-3 lg:grid-cols-[220px,1fr,160px,140px]">
                  <select
                    value={shareTeamId}
                    onChange={(event) => setShareTeamId(event.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-300"
                  >
                    <option value="">选择团队</option>
                    {shareTeamOptions.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={shareDoctorId}
                    onChange={(event) => setShareDoctorId(event.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-300"
                  >
                    <option value="">选择医生</option>
                    {currentShareDoctors.map((doctor) => (
                      <option key={doctor.doctorProfileId} value={doctor.doctorProfileId}>
                        {doctor.realName} · {doctor.departmentName}
                      </option>
                    ))}
                  </select>
                  <select
                    value={shareRole}
                    onChange={(event) => setShareRole(event.target.value as 'COLLABORATOR' | 'READONLY')}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-300"
                  >
                    <option value="COLLABORATOR">协作医生</option>
                    <option value="READONLY">只读</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void submitGrant()}
                    className="rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-cyan-500"
                  >
                    共享
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                只有主责任医生可以管理该患者档案的共享权限。
              </div>
            )}

            <div className="space-y-3">
              {accessData.grants.length ? (
                accessData.grants.map((grant) => (
                  <div key={grant.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">{grant.targetDoctor.realName}</div>
                        <div className="mt-1 text-sm text-slate-500">
                          {grant.targetDoctor.hospitalName} · {grant.targetDoctor.departmentName} · {grant.sourceTeam.name}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {canManageAccess ? (
                          <select
                            value={grant.accessRole}
                            onChange={(event) => void updateGrantRole(grant.id, event.target.value as 'COLLABORATOR' | 'READONLY')}
                            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                          >
                            <option value="COLLABORATOR">协作医生</option>
                            <option value="READONLY">只读</option>
                          </select>
                        ) : (
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${grant.accessRole === 'COLLABORATOR' ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-600'}`}>
                            {grant.accessRole === 'COLLABORATOR' ? '协作医生' : '只读'}
                          </span>
                        )}

                        {canManageAccess ? (
                          <button
                            type="button"
                            onClick={() => void revokeGrant(grant.id)}
                            className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                          >
                            撤销
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400">当前还没有共享给其他团队成员。</div>
              )}
            </div>
          </div>
        )}
      </section>

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
            placeholder={canWriteNotes ? '仅医生端和平台管理端可见。' : '当前只读权限下不能新增备注。'}
            disabled={!canWriteNotes}
            className="min-h-[120px] rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void submitNote()}
              disabled={!canWriteNotes}
              className="inline-flex items-center gap-2 rounded-full bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-700 disabled:bg-slate-400"
            >
              <StickyNote className="h-4 w-4" />
              <span>保存备注</span>
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">时间线</h2>
        <div className="mt-4 space-y-4">
          {events.length ? (
            events.map((event) => (
              <div key={`${event.type}-${event.id}`} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">
                    {event.type === 'ASSESSMENT' ? event.scaleId : `${event.noteType} 备注`}
                  </div>
                  <div className="text-xs text-slate-500">{new Date(event.createdAt).toLocaleString()}</div>
                </div>

                <div className="mt-2 text-sm text-slate-600">
                  {event.type === 'ASSESSMENT' ? `${event.conclusion} · ${event.totalScore}` : event.content}
                </div>

                {event.type === 'DOCTOR_NOTE' && event.doctorName ? (
                  <div className="mt-2 text-xs text-slate-500">记录医生：{event.doctorName}</div>
                ) : null}

                {event.type === 'ASSESSMENT' && (
                  <>
                    {(event.respondentRealName || event.respondentPhone || event.source) && (
                      <div className="mt-3 rounded-2xl bg-white px-4 py-3 text-xs text-slate-500">
                        来源：{event.source || 'DIRECT'}
                        {event.respondentRealName ? ` · 姓名：${event.respondentRealName}` : ''}
                        {event.respondentPhone ? ` · 手机号：${event.respondentPhone}` : ''}
                        {event.respondentGender ? ` · 性别：${event.respondentGender}` : ''}
                        {event.respondentAgeMonths !== null && event.respondentAgeMonths !== undefined
                          ? ` · 年龄：${event.respondentAgeMonths} 月`
                          : ''}
                      </div>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        { key: 'pdf' as const, label: 'PDF', icon: <FileText className="h-4 w-4" /> },
                        { key: 'json' as const, label: 'JSON', icon: <FileJson className="h-4 w-4" /> },
                        { key: 'word' as const, label: 'Word', icon: <FileText className="h-4 w-4" /> },
                        { key: 'csv' as const, label: 'CSV', icon: <FileSpreadsheet className="h-4 w-4" /> },
                      ].map((item) => {
                        const active = exportingKey === `${event.id}:${item.key}`;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => void exportAssessment(event.id, item.key)}
                            disabled={Boolean(exportingKey)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {active ? <Loader2 className="h-4 w-4 animate-spin" /> : item.icon}
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-400">暂无时间线事件。</div>
          )}
        </div>
      </section>
    </div>
  );
}
