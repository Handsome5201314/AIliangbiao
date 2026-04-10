'use client';

import { useEffect, useMemo, useState } from 'react';
import { FlaskConical, Search, Stethoscope } from 'lucide-react';

import { useAuthSession } from '@/contexts/AuthSessionContext';
import { useProfile } from '@/contexts/ProfileContext';

export default function PatientDoctorPanel() {
  const { user, isAuthenticated, isPatient, authHeaders } = useAuthSession();
  const { profile } = useProfile();

  const [assignment, setAssignment] = useState<any>(null);
  const [consent, setConsent] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [doctors, setDoctors] = useState<any[]>([]);
  const [status, setStatus] = useState('');

  const memberId = profile.id;

  const loadCurrentState = async () => {
    if (!isAuthenticated || !isPatient) {
      return;
    }

    const [assignmentRes, consentRes] = await Promise.all([
      fetch(`/api/me/members/${memberId}/attending-doctor`, { headers: authHeaders }),
      fetch(`/api/me/members/${memberId}/research-consent`, { headers: authHeaders }),
    ]);

    const assignmentData = await assignmentRes.json().catch(() => ({}));
    const consentData = await consentRes.json().catch(() => ({}));
    setAssignment(assignmentData.assignment || null);
    setConsent(consentData.consent || null);
  };

  useEffect(() => {
    void loadCurrentState();
  }, [isAuthenticated, isPatient, memberId]);

  useEffect(() => {
    if (!isAuthenticated || !isPatient) {
      return;
    }

    const url = new URL('/api/doctors/search', window.location.origin);
    if (search.trim()) url.searchParams.set('q', search.trim());

    fetch(url.toString(), { headers: authHeaders })
      .then((res) => res.json())
      .then((data) => setDoctors(data.doctors || []))
      .catch(console.error);
  }, [authHeaders, isAuthenticated, isPatient, search]);

  const consentGranted = consent?.status === 'GRANTED';

  const actionHint = useMemo(() => {
    if (!isAuthenticated || !isPatient) {
      return '患者登录后可为当前成员选择主治医生，并单独控制科研授权。';
    }
    if (!assignment) {
      return '当前成员尚未绑定主治医生。';
    }
    return '当前成员已绑定主治医生，可切换或撤销绑定。';
  }, [assignment, isAuthenticated, isPatient]);

  const bindDoctor = async (doctorProfileId: string) => {
    const response = await fetch(`/api/me/members/${memberId}/attending-doctor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({ doctorProfileId }),
    });
    const data = await response.json();
    setStatus(response.ok ? '主治医生已更新' : data.error || '绑定失败');
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
      <div className="flex items-center gap-2 text-slate-800">
        <Stethoscope className="h-4 w-4 text-cyan-600" />
        <h3 className="text-base font-semibold">主治医生与科研授权</h3>
      </div>

      <p className="mt-2 text-sm text-slate-500">{actionHint}</p>

      {!isAuthenticated || !isPatient ? (
        <div className="mt-4 flex gap-3">
          <a href="/auth/login" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">患者登录</a>
          <a href="/auth/register" className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">患者注册</a>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-sm font-medium text-slate-900">当前主治医生</div>
            {assignment ? (
              <div className="mt-2 text-sm text-slate-600">
                <div>{assignment.doctor.realName} · {assignment.doctor.title}</div>
                <div>{assignment.doctor.hospitalName} · {assignment.doctor.departmentName}</div>
                <button type="button" onClick={() => void revokeDoctor()} className="mt-3 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  撤销绑定
                </button>
              </div>
            ) : <div className="mt-2 text-sm text-slate-400">暂无绑定</div>}
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-900">
              <Search className="h-4 w-4 text-cyan-600" />
              <span>选择已审核医生</span>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索医生姓名、医院、科室"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-300"
            />
            <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
              {doctors.map((doctor) => (
                <button
                  key={doctor.id}
                  type="button"
                  onClick={() => void bindDoctor(doctor.id)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm hover:border-cyan-300"
                >
                  <div className="font-semibold text-slate-900">{doctor.realName} · {doctor.title}</div>
                  <div className="text-slate-500">{doctor.hospitalName} · {doctor.departmentName}</div>
                </button>
              ))}
              {!doctors.length && <div className="text-sm text-slate-400">暂无匹配医生</div>}
            </div>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-900">
              <FlaskConical className="h-4 w-4 text-emerald-600" />
              <span>科研导出授权</span>
            </div>
            <p className="text-sm text-slate-500">默认关闭。只有你明确同意后，主治医生才能导出去标识测评数据用于科研。</p>
            <button
              type="button"
              onClick={() => void toggleResearchConsent()}
              className={`mt-3 rounded-full px-4 py-2 text-sm font-semibold ${
                consentGranted ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {consentGranted ? '撤销科研授权' : '开启科研授权'}
            </button>
          </div>
        </div>
      )}

      {status && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          {status}
        </div>
      )}
    </div>
  );
}
