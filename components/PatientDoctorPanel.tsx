'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, FlaskConical, Search, ShieldCheck, Stethoscope, X } from 'lucide-react';

import ExportDNAButton from '@/components/ExportDNAButton';
import { useAuthSession } from '@/contexts/AuthSessionContext';
import { useProfile } from '@/contexts/ProfileContext';

type DoctorOption = {
  id: string;
  realName: string;
  title: string;
  hospitalName: string;
  departmentName: string;
};

type DoctorAssignment = {
  doctor: DoctorOption;
};

type ResearchConsent = {
  status: 'GRANTED' | 'REVOKED' | 'PENDING' | null;
};

type MemberAgentStatus = {
  doctorBotStatus: 'published' | 'disabled' | 'missing';
  doctorBotSlug: string | null;
};

export default function PatientDoctorPanel() {
  const { isAuthenticated, isPatient, isDoctor, authHeaders } = useAuthSession();
  const { profile } = useProfile();

  const [assignment, setAssignment] = useState<DoctorAssignment | null>(null);
  const [consent, setConsent] = useState<ResearchConsent | null>(null);
  const [agentStatus, setAgentStatus] = useState<MemberAgentStatus | null>(null);
  const [search, setSearch] = useState('');
  const [doctors, setDoctors] = useState<DoctorOption[]>([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [doctorPickerOpen, setDoctorPickerOpen] = useState(false);
  const [researchPanelOpen, setResearchPanelOpen] = useState(false);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [status, setStatus] = useState('');

  const memberId = profile.id;
  const consentGranted = consent?.status === 'GRANTED';

  const loadCurrentState = async () => {
    if (!isAuthenticated || !isPatient) {
      return;
    }

    const [assignmentRes, consentRes, agentRes] = await Promise.all([
      fetch(`/api/me/members/${memberId}/attending-doctor`, { headers: authHeaders }),
      fetch(`/api/me/members/${memberId}/research-consent`, { headers: authHeaders }),
      fetch(`/api/me/members/${memberId}/agent-status`, { headers: authHeaders }),
    ]);

    const assignmentData = await assignmentRes.json().catch(() => ({}));
    const consentData = await consentRes.json().catch(() => ({}));
    const agentData = await agentRes.json().catch(() => ({}));

    setAssignment(assignmentData.assignment || null);
    setConsent(consentData.consent || null);
    setAgentStatus(agentRes.ok ? (agentData as MemberAgentStatus) : null);
  };

  useEffect(() => {
    void loadCurrentState();
  }, [isAuthenticated, isPatient, memberId]);

  useEffect(() => {
    if (!doctorPickerOpen || !isAuthenticated || !isPatient) {
      return;
    }

    const controller = new AbortController();
    const url = new URL('/api/doctors/search', window.location.origin);

    if (search.trim()) {
      url.searchParams.set('q', search.trim());
    }

    setLoadingDoctors(true);

    fetch(url.toString(), { headers: authHeaders, signal: controller.signal })
      .then((res) => res.json())
      .then((data) => setDoctors(data.doctors || []))
      .catch((error) => {
        if (error.name !== 'AbortError') {
          console.error(error);
        }
      })
      .finally(() => setLoadingDoctors(false));

    return () => controller.abort();
  }, [authHeaders, doctorPickerOpen, isAuthenticated, isPatient, search]);

  useEffect(() => {
    if (!doctorPickerOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [doctorPickerOpen]);

  const actionHint = useMemo(() => {
    if (isDoctor) {
      return '当前登录的是医生账号。患者侧的主治医生绑定与数据授权仅对患者账号开放，请前往医生工作台查看患者管理。';
    }
    if (!isAuthenticated || !isPatient) {
      return '登录后可按需绑定主治医生；数据授权默认关闭，并且可以随时调整。';
    }
    if (!assignment) {
      return '主治医生和数据授权都属于成员设置，默认收起，不影响量表与筛查主流程。';
    }
    return '已绑定主治医生。你可以在这里更换医生，并按需管理数据授权。';
  }, [assignment, isAuthenticated, isPatient, isDoctor]);

  const summaryText = useMemo(() => {
    if (isDoctor) {
      return '医生账号请前往医生工作台处理患者协作。';
    }
    if (!isAuthenticated || !isPatient) {
      return '登录后可按需绑定主治医生，并管理数据授权。';
    }
    if (assignment) {
      return `${assignment.doctor.realName} · ${assignment.doctor.hospitalName} · ${assignment.doctor.departmentName}`;
    }
    return '当前未绑定主治医生，数据授权默认关闭。';
  }, [assignment, isAuthenticated, isPatient, isDoctor]);

  const bindDoctor = async (doctorProfileId: string) => {
    const response = await fetch(`/api/me/members/${memberId}/attending-doctor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ doctorProfileId }),
    });

    const data = await response.json().catch(() => ({}));
    setStatus(response.ok ? '主治医生已更新' : data.error || '绑定失败');

    if (response.ok) {
      setDoctorPickerOpen(false);
      setSearch('');
      setPanelOpen(true);
    }

    await loadCurrentState();
  };

  const revokeDoctor = async () => {
    const response = await fetch(`/api/me/members/${memberId}/attending-doctor`, {
      method: 'DELETE',
      headers: authHeaders,
    });

    const data = await response.json().catch(() => ({}));
    setStatus(response.ok ? '主治医生绑定已撤销' : data.error || '撤销失败');
    await loadCurrentState();
  };

  const toggleResearchConsent = async () => {
    const response = await fetch(`/api/me/members/${memberId}/research-consent`, {
      method: consentGranted ? 'DELETE' : 'POST',
      headers: authHeaders,
    });

    const data = await response.json().catch(() => ({}));
    setStatus(response.ok ? (consentGranted ? '科研授权已撤销' : '科研授权已开启') : data.error || '操作失败');
    await loadCurrentState();
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
      <button
        type="button"
        onClick={() => setPanelOpen((current) => !current)}
        className="flex w-full items-start gap-3 text-left"
      >
        <div className="mt-0.5 rounded-2xl bg-cyan-100 p-2 text-cyan-700">
          <Stethoscope className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-slate-800">
            <h3 className="text-base font-semibold">成员协作设置</h3>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${assignment ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-200 text-slate-600'}`}>
              {assignment ? '已绑医生' : '未绑医生'}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${consentGranted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
              {consentGranted ? '授权已开' : '授权关闭'}
            </span>
          </div>
          <p className="mt-2 text-sm text-slate-500">{summaryText}</p>
        </div>
        <div className="flex items-center gap-2 pt-1 text-sm font-semibold text-slate-500">
          <span>{panelOpen ? '收起' : '展开'}</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${panelOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {panelOpen ? (
        <>
          <p className="mt-4 text-sm text-slate-500">{actionHint}</p>

          {isAuthenticated && isDoctor ? (
            <div className="mt-4 flex gap-3">
              <a
                href="/doctor"
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600"
              >
                前往医生工作台
              </a>
              <a
                href="/doctor/invites"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                打开医生邀填
              </a>
            </div>
          ) : !isAuthenticated || !isPatient ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-600">
                登录后可为当前成员绑定主治医生，并按需开启科研数据授权。
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <a
                  href="/auth/login"
                  className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600"
                >
                  去登录后管理
                </a>
                <a
                  href="/auth/register"
                  className="text-sm font-semibold text-cyan-700 hover:text-cyan-800"
                >
                  还没有账号？去注册
                </a>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/90">
                <div className="flex items-start gap-3 px-4 py-4">
                  <div className="mt-0.5 rounded-2xl bg-cyan-100 p-2 text-cyan-700">
                    <Stethoscope className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-slate-900">主治医生</div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${assignment ? 'bg-cyan-100 text-cyan-700' : 'bg-slate-200 text-slate-600'}`}>
                        {assignment ? '已绑定' : '未绑定'}
                      </span>
                    </div>
                    {assignment ? (
                      <div className="mt-2 text-sm text-slate-600">
                        <div className="font-medium text-slate-800">
                          {assignment.doctor.realName} · {assignment.doctor.title}
                        </div>
                        <div className="mt-1 text-slate-500">
                          {assignment.doctor.hospitalName} · {assignment.doctor.departmentName}
                        </div>
                        {agentStatus?.doctorBotStatus === 'published' ? (
                          <a
                            href="/agent?mode=doctor_bot"
                            className="mt-3 inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600"
                          >
                            <Stethoscope className="h-4 w-4" />
                            <span>进入医生智能体</span>
                          </a>
                        ) : (
                          <div className="mt-3 text-xs text-slate-500">当前医生未设置智能体，你仍可继续使用自助智能体。</div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 text-sm text-slate-500">
                        仅在需要长期随访或门诊协作时再选择医生，不影响当前量表使用。
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <button
                      type="button"
                      onClick={() => setDoctorPickerOpen(true)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-cyan-300 hover:bg-cyan-50"
                    >
                      <span>{assignment ? '更换医生' : '选择医生'}</span>
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    {assignment ? (
                      <button
                        type="button"
                        onClick={() => void revokeDoctor()}
                        className="text-xs font-semibold text-slate-500 hover:text-rose-600"
                      >
                        撤销绑定
                      </button>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/90">
                <button
                  type="button"
                  onClick={() => setResearchPanelOpen((current) => !current)}
                  className="flex w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-white/70"
                >
                  <div className="mt-0.5 rounded-2xl bg-emerald-100 p-2 text-emerald-700">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-slate-900">数据授权（可选）</div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${consentGranted ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                        {consentGranted ? '已开启' : '默认关闭'}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-slate-500">
                      只有你明确同意后，主治医生才能导出脱敏评估数据用于科研；不授权也不影响正常筛查与量表。
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                    <span>{researchPanelOpen ? '收起' : '查看'}</span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${researchPanelOpen ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {researchPanelOpen ? (
                  <div className="border-t border-slate-200 bg-white px-4 py-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">科研导出授权</div>
                          <p className="mt-1 text-sm text-slate-500">
                            授权后，医生仅可导出脱敏后的评估结果用于科研分析；你可以随时撤销。
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void toggleResearchConsent()}
                          className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                            consentGranted
                              ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                              : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          }`}
                        >
                          {consentGranted ? '撤销科研授权' : '开启科研授权'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </section>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-900">
                  <FlaskConical className="h-4 w-4 text-indigo-600" />
                  <span>人格快照导出</span>
                </div>
                <p className="text-sm text-slate-500">
                  为当前成员导出符合 Persona Snapshot v1.0 协议的 JSON 文件，用于对接主角人生竞技场（Digital Twin Arena）。
                </p>
                <ExportDNAButton
                  profileId={memberId}
                  className="mt-3"
                  idleLabel="导出 Persona Snapshot"
                  exportingLabel="正在提取 Persona Snapshot..."
                />
              </div>
            </div>
          )}

          {status ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {status}
            </div>
          ) : null}
        </>
      ) : null}

      {doctorPickerOpen ? (
        <div className="fixed inset-0 z-[80]">
          <button
            type="button"
            aria-label="关闭医生选择"
            onClick={() => setDoctorPickerOpen(false)}
            className="absolute inset-0 bg-slate-950/35 backdrop-blur-[2px]"
          />

          <div className="absolute inset-x-4 bottom-0 rounded-t-[2rem] border border-slate-200 bg-white p-4 shadow-[0_-24px_80px_-24px_rgba(15,23,42,0.45)] sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(680px,calc(100vw-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-[2rem]">
            <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" />

            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-slate-900">选择已审核医生</div>
                <p className="mt-1 text-sm text-slate-500">
                  按姓名、医院或科室搜索，绑定后可随时更换。
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDoctorPickerOpen(false)}
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索医生姓名、医院、科室"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition-colors focus:border-cyan-300 focus:bg-white"
              />
            </div>

            <div className="mt-4 max-h-[min(55vh,24rem)] space-y-2 overflow-y-auto pr-1">
              {loadingDoctors ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                  正在加载可选医生...
                </div>
              ) : doctors.length ? (
                doctors.map((doctor) => (
                  <button
                    key={doctor.id}
                    type="button"
                    onClick={() => void bindDoctor(doctor.id)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm transition-colors hover:border-cyan-300 hover:bg-cyan-50/40"
                  >
                    <div className="font-semibold text-slate-900">
                      {doctor.realName} · {doctor.title}
                    </div>
                    <div className="mt-1 text-slate-500">
                      {doctor.hospitalName} · {doctor.departmentName}
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                  暂无匹配医生
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setDoctorPickerOpen(false)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
