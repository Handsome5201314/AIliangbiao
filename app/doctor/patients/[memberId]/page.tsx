'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  Loader2,
  PlayCircle,
  Printer,
  Share2,
  StickyNote,
  UserRound,
  XCircle,
} from 'lucide-react';

import { useAuthSession } from '@/contexts/AuthSessionContext';
import {
  type DoctorAssessmentExportData,
  downloadDoctorAssessmentCsv,
  downloadDoctorAssessmentJson,
  downloadDoctorAssessmentPdf,
  downloadDoctorAssessmentWord,
  printDoctorAssessmentReport,
} from '@/lib/utils/doctorAssessmentExport';
import { resolveLocalizedText } from '@/lib/schemas/core/i18n';
import type { LocalizedTextValue } from '@/lib/schemas/core/types';
import { Button } from '@/components/ui/button';

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

type PatientDetail = {
  effectiveAccessRole?: 'OWNER' | 'COLLABORATOR' | 'READONLY';
  memberProfile: {
    id: string;
    nickname: string;
    realName: string | null;
    contactPhone: string | null;
    relation: string;
    pendingClaim: boolean;
    gender: string;
    ageMonths: number | null;
  };
};

type DoctorScaleOption = {
  id: string;
  title?: LocalizedTextValue;
};

type PatientTimelineEvent = {
  type: 'ASSESSMENT' | 'DOCTOR_NOTE';
  id: string;
  createdAt: string;
  scaleId?: string;
  totalScore?: number;
  conclusion?: string;
  source?: string | null;
  respondentRealName?: string | null;
  respondentPhone?: string | null;
  respondentGender?: string | null;
  respondentAgeMonths?: number | null;
  noteType?: string;
  content?: string;
  doctorName?: string;
  review?: {
    id: string;
    status: string;
    reviewConclusion: string | null;
    reviewNotes: string | null;
    allowParentVisible: boolean;
    completedAt: string | null;
  } | null;
};

type FollowUpTaskItem = {
  id: string;
  scaleId: string;
  taskType: 'ONE_MONTH' | 'THREE_MONTH' | 'CUSTOM';
  dueDate: string;
  windowStartAt: string;
  windowEndAt: string;
  status: 'PENDING' | 'REMINDED' | 'COMPLETED' | 'CANCELLED' | 'LOST_TO_FOLLOWUP';
  reminderLogs?: Array<{
    id: string;
    reminderChannel: string;
    status: string;
    messageSummary: string | null;
    recordedAt: string;
  }>;
};

export default function DoctorPatientDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  const { authHeaders } = useAuthSession();
  const [memberId, setMemberId] = useState('');
  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [events, setEvents] = useState<PatientTimelineEvent[]>([]);
  const [followUpTasks, setFollowUpTasks] = useState<FollowUpTaskItem[]>([]);
  const [scales, setScales] = useState<DoctorScaleOption[]>([]);
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
  const [startingAssessment, setStartingAssessment] = useState(false);
  const [assessmentScaleId, setAssessmentScaleId] = useState('');
  const [assessmentMode, setAssessmentMode] = useState<'doctor_assisted' | 'caregiver_handoff'>('doctor_assisted');
  const [handoffUrl, setHandoffUrl] = useState('');
  const [submittingReviewId, setSubmittingReviewId] = useState('');
  const [submittingFollowUpKey, setSubmittingFollowUpKey] = useState('');
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, string>>({});
  const [shareTeamId, setShareTeamId] = useState('');
  const [shareDoctorId, setShareDoctorId] = useState('');
  const [shareRole, setShareRole] = useState<'COLLABORATOR' | 'READONLY'>('COLLABORATOR');

  useEffect(() => {
    params.then((resolved) => setMemberId(resolved.memberId));
  }, [params]);

  const loadAll = useCallback(async (nextMemberId: string) => {
    const [patientRes, timelineRes, accessRes, followUpRes] = await Promise.all([
      fetch(`/api/doctor/patients/${nextMemberId}`, { headers: authHeaders }),
      fetch(`/api/doctor/patients/${nextMemberId}/timeline`, { headers: authHeaders }),
      fetch(`/api/doctor/patients/${nextMemberId}/access`, { headers: authHeaders }),
      fetch(`/api/doctor/patients/${nextMemberId}/follow-up-tasks`, { headers: authHeaders }),
    ]);

    const patientData = await patientRes.json().catch(() => ({}));
    const timelineData = await timelineRes.json().catch(() => ({}));
    const accessData = await accessRes.json().catch(() => ({}));
    const followUpData = await followUpRes.json().catch(() => ({}));

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
    if (followUpRes.ok) {
      setFollowUpTasks(followUpData.tasks || []);
    }
  }, [authHeaders]);

  useEffect(() => {
    if (!memberId) return;
    void loadAll(memberId).catch(console.error);
  }, [loadAll, memberId]);

  useEffect(() => {
    fetch('/api/doctor/scales', { headers: authHeaders })
      .then((res) => res.json())
      .then((data) => {
        const nextScales = data.scales || [];
        setScales(nextScales);
        setAssessmentScaleId((current) => current || nextScales[0]?.id || '');
      })
      .catch(console.error);
  }, [authHeaders]);

  const accessRole = accessData?.effectiveAccessRole || patient?.effectiveAccessRole || 'READONLY';
  const canWriteNotes = accessRole !== 'READONLY';
  const canManageAccess = accessRole === 'OWNER';
  const canExportResearch = accessRole === 'OWNER';

  const shareTeamOptions = useMemo(() => accessData?.shareableTeams || [], [accessData?.shareableTeams]);
  const currentShareTeam = useMemo(
    () => shareTeamOptions.find((team) => team.id === shareTeamId) || shareTeamOptions[0] || null,
    [shareTeamId, shareTeamOptions]
  );
  const currentShareDoctors = useMemo(() => currentShareTeam?.members || [], [currentShareTeam?.members]);

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

  const startAssessment = async () => {
    if (!memberId || !assessmentScaleId) {
      setStatus('请先选择量表');
      return;
    }

    setStartingAssessment(true);
    setStatus('');
    setHandoffUrl('');
    try {
      const response = await fetch(`/api/doctor/patients/${memberId}/assessments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          scaleId: assessmentScaleId,
          mode: assessmentMode,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '发起评估失败');
      }

      const path = data.session?.handoff?.path;
      if (path && typeof window !== 'undefined') {
        const url = `${window.location.origin}${path}`;
        setHandoffUrl(url);
        setStatus('H5 填写链接已生成');
      } else {
        setStatus('评估会话已创建，请在医生端或移动端继续完成量表');
      }
      await loadAll(memberId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '发起评估失败');
    } finally {
      setStartingAssessment(false);
    }
  };

  const copyHandoffUrl = async () => {
    if (!handoffUrl) return;
    await navigator.clipboard.writeText(handoffUrl);
    setStatus('H5 链接已复制');
  };

  const completeDoctorReview = async (
    reviewId: string,
    nextStatus: 'APPROVED' | 'REJECTED'
  ) => {
    const reviewNotes = reviewDrafts[reviewId] || '';
    if (nextStatus === 'REJECTED' && !reviewNotes.trim()) {
      setStatus('拒绝复核必须填写备注');
      return;
    }

    setSubmittingReviewId(reviewId);
    setStatus('');
    try {
      const response = await fetch(`/api/doctor/reviews/${reviewId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          status: nextStatus,
          reviewConclusion: nextStatus === 'APPROVED' ? '同意本次量表结果' : undefined,
          reviewNotes,
          allowParentVisible: nextStatus === 'APPROVED',
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '复核失败');
      }

      setStatus(nextStatus === 'APPROVED' ? '已复核通过' : '已拒绝并记录备注');
      setReviewDrafts((prev) => ({ ...prev, [reviewId]: '' }));
      await loadAll(memberId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '复核失败');
    } finally {
      setSubmittingReviewId('');
    }
  };

  const createFollowUpTasksForAssessment = async (assessmentId: string, scaleId?: string) => {
    if (!canWriteNotes || !scaleId) {
      setStatus('只有有写入权限的医生可以创建复测任务');
      return;
    }

    const submitKey = `follow-up:${assessmentId}`;
    setSubmittingFollowUpKey(submitKey);
    setStatus('');
    try {
      const response = await fetch(`/api/doctor/patients/${memberId}/follow-up-tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          baselineAssessmentHistoryId: assessmentId,
          scaleId,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '创建复测任务失败');
      }

      setStatus('1 个月/3 个月复测任务已创建');
      await loadAll(memberId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '创建复测任务失败');
    } finally {
      setSubmittingFollowUpKey('');
    }
  };

  const deliverEducationForAssessment = async (assessmentId: string) => {
    if (!canWriteNotes) {
      setStatus('只有有写入权限的医生可以触达健康教育');
      return;
    }

    const submitKey = `education:${assessmentId}`;
    setSubmittingFollowUpKey(submitKey);
    setStatus('');
    try {
      const response = await fetch(`/api/doctor/patients/${memberId}/education`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          assessmentHistoryId: assessmentId,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '触达健康教育失败');
      }

      setStatus(`已触达 ${data.deliveries?.length ?? 0} 条健康教育内容`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '触达健康教育失败');
    } finally {
      setSubmittingFollowUpKey('');
    }
  };

  const recordReminder = async (taskId: string, status: 'RECORDED' | 'FAILED') => {
    if (!canWriteNotes) {
      setStatus('只有有写入权限的医生可以记录手工提醒');
      return;
    }

    const messageSummary =
      window.prompt(status === 'FAILED' ? '记录失败原因' : '记录本次手工提醒摘要') || '';
    if (status === 'FAILED' && !messageSummary.trim()) {
      setStatus('提醒失败必须记录原因，不能当作成功');
      return;
    }

    setSubmittingFollowUpKey(`reminder:${taskId}:${status}`);
    setStatus('');
    try {
      const response = await fetch(`/api/doctor/follow-up-tasks/${taskId}/reminders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          reminderChannel: 'MANUAL_PHONE',
          status,
          messageSummary,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '记录手工提醒失败');
      }

      setStatus(status === 'FAILED' ? '已记录提醒失败，任务状态未自动推进' : '手工提醒已记录');
      await loadAll(memberId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '记录手工提醒失败');
    } finally {
      setSubmittingFollowUpKey('');
    }
  };

  const exportHref = useMemo(() => {
    if (!memberId) return '#';
    return `/api/doctor/patients/${memberId}/export?format=CSV&purpose=research`;
  }, [memberId]);

  const exportAssessment = async (
    assessmentId: string,
    format: 'pdf' | 'print' | 'json' | 'word' | 'csv',
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
      } else if (format === 'print') {
        printDoctorAssessmentReport(report);
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
          <PlayCircle className="h-5 w-5 text-cyan-700" />
          <h2 className="text-lg font-semibold text-slate-900">发起门诊评估</h2>
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
          <select
            value={assessmentScaleId}
            onChange={(event) => setAssessmentScaleId(event.target.value)}
            disabled={!canWriteNotes || !scales.length}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-300 disabled:bg-slate-100"
          >
            {!scales.length ? (
              <option value="">暂无可用量表</option>
            ) : (
              scales.map((scale) => (
                <option key={scale.id} value={scale.id}>
                  {scale.id} · {resolveLocalizedText(scale.title, 'zh')}
                </option>
              ))
            )}
          </select>
          <select
            value={assessmentMode}
            onChange={(event) => setAssessmentMode(event.target.value as 'doctor_assisted' | 'caregiver_handoff')}
            disabled={!canWriteNotes}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-300 disabled:bg-slate-100"
          >
            <option value="doctor_assisted">医生现场填写</option>
            <option value="caregiver_handoff">生成 H5 链接</option>
          </select>
          <Button
            onClick={() => void startAssessment()}
            disabled={!canWriteNotes || startingAssessment || !assessmentScaleId}
          >
            {startingAssessment ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
            <span>{startingAssessment ? '发起中' : '发起评估'}</span>
          </Button>
        </div>
        {!canWriteNotes ? (
          <div className="mt-3 text-sm text-slate-500">当前只读权限下不能发起新的门诊评估。</div>
        ) : null}
        {handoffUrl ? (
          <div className="mt-4 rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
            <div className="font-semibold">H5 链接</div>
            <div className="mt-1 break-all">{handoffUrl}</div>
            <button
              type="button"
              onClick={() => void copyHandoffUrl()}
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-cyan-700 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-800"
            >
              <Copy className="h-4 w-4" />
              <span>复制链接</span>
            </button>
          </div>
        ) : null}
      </section>

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
        <h2 className="text-lg font-semibold text-slate-900">随访任务与复测提醒</h2>
        <p className="mt-2 text-sm text-slate-500">
          医生复核后可为评估创建 1 个月/3 个月复测任务；这里只记录手工提醒，不连接外部消息通道。
        </p>

        <div className="mt-4 space-y-3">
          {followUpTasks.length ? (
            followUpTasks.map((task) => {
              const reminding = submittingFollowUpKey.startsWith(`reminder:${task.id}:`);
              return (
                <div key={task.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {task.scaleId} · {task.taskType === 'ONE_MONTH' ? '1 个月复测' : task.taskType === 'THREE_MONTH' ? '3 个月复测' : '自定义复测'}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        到期：{new Date(task.dueDate).toLocaleDateString()} · 窗口：
                        {new Date(task.windowStartAt).toLocaleDateString()} - {new Date(task.windowEndAt).toLocaleDateString()}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        状态：{task.status}
                        {task.reminderLogs?.[0]
                          ? ` · 最近手工提醒：${task.reminderLogs[0].status} · ${new Date(task.reminderLogs[0].recordedAt).toLocaleString()}`
                          : ''}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void recordReminder(task.id, 'RECORDED')}
                        disabled={!canWriteNotes || reminding}
                        className="rounded-full bg-cyan-700 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-800 disabled:bg-slate-400"
                      >
                        手工提醒已完成
                      </button>
                      <button
                        type="button"
                        onClick={() => void recordReminder(task.id, 'FAILED')}
                        disabled={!canWriteNotes || reminding}
                        className="rounded-full border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      >
                        记录提醒失败
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-400">
              暂无随访任务。可在下方评估时间线中为已复核报告创建 1 个月/3 个月复测任务。
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">时间线</h2>
        <div className="mt-4 space-y-4">
          {events.length ? (
            events.map((event) => {
              const review = event.type === 'ASSESSMENT' ? event.review ?? null : null;

              return (
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
                    {review ? (
                      <div className="mt-3 rounded-2xl border border-cyan-100 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">
                        <div className="flex flex-wrap items-center gap-2">
                          <ClipboardCheck className="h-4 w-4" />
                          <span className="font-semibold">医生复核：{review.status}</span>
                          {review.allowParentVisible ? (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              家长可见
                            </span>
                          ) : null}
                        </div>
                        {review.reviewNotes ? (
                          <div className="mt-2 text-sm leading-6 text-cyan-800">{review.reviewNotes}</div>
                        ) : null}
                        {['PENDING', 'IN_REVIEW', 'NEEDS_MORE_INFO'].includes(review.status) && (
                          <div className="mt-3 space-y-3">
                            <textarea
                              value={reviewDrafts[review.id] || ''}
                              onChange={(changeEvent) =>
                                setReviewDrafts((prev) => ({
                                  ...prev,
                                  [review.id]: changeEvent.target.value,
                                }))
                              }
                              rows={3}
                              placeholder="复核备注；拒绝时必填"
                              className="w-full rounded-2xl border border-cyan-100 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-400"
                            />
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void completeDoctorReview(review.id, 'APPROVED')}
                                disabled={submittingReviewId === review.id}
                                className="inline-flex items-center gap-2 rounded-full bg-cyan-700 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-800 disabled:bg-slate-400"
                              >
                                {submittingReviewId === review.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                <span>通过并允许家长查看</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => void completeDoctorReview(review.id, 'REJECTED')}
                                disabled={submittingReviewId === review.id}
                                className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                              >
                                <XCircle className="h-4 w-4" />
                                <span>拒绝</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                        当前评估尚未生成医生复核项。
                      </div>
                    )}
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
                        { key: 'print' as const, label: '打印', icon: <Printer className="h-4 w-4" /> },
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
                      <button
                        type="button"
                        onClick={() => void createFollowUpTasksForAssessment(event.id, event.scaleId)}
                        disabled={!canWriteNotes || submittingFollowUpKey === `follow-up:${event.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-xs font-semibold text-cyan-700 transition-colors hover:bg-cyan-100 disabled:opacity-50"
                      >
                        {submittingFollowUpKey === `follow-up:${event.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ClipboardCheck className="h-4 w-4" />
                        )}
                        <span>创建复测任务</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void deliverEducationForAssessment(event.id)}
                        disabled={!canWriteNotes || submittingFollowUpKey === `education:${event.id}`}
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                      >
                        {submittingFollowUpKey === `education:${event.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                        <span>推送健康教育</span>
                      </button>
                    </div>
                  </>
                )}
                </div>
              );
            })
          ) : (
            <div className="text-sm text-slate-400">暂无时间线事件。</div>
          )}
        </div>
      </section>
    </div>
  );
}
