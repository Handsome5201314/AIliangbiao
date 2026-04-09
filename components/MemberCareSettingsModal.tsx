'use client';

import { useEffect, useMemo, useState } from 'react';

interface MemberCareSettingsModalProps {
  open: boolean;
  memberId: string;
  memberName: string;
  onClose: () => void;
}

export default function MemberCareSettingsModal({
  open,
  memberId,
  memberName,
  onClose,
}: MemberCareSettingsModalProps) {
  const [isPatientUser, setIsPatientUser] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [doctors, setDoctors] = useState<any[]>([]);
  const [assignment, setAssignment] = useState<any>(null);
  const [consent, setConsent] = useState<any>(null);
  const [error, setError] = useState('');

  const canSearch = useMemo(() => open && isPatientUser, [isPatientUser, open]);

  const loadState = async () => {
    setLoading(true);
    setError('');
    try {
      const me = await fetch('/api/auth/me').then((res) => res.json());
      const patient = me.user?.accountType === 'PATIENT';
      setIsPatientUser(patient);

      if (!patient) {
        setDoctors([]);
        setAssignment(null);
        setConsent(null);
        return;
      }

      const [doctorState, consentState] = await Promise.all([
        fetch(`/api/me/members/${memberId}/attending-doctor`).then((res) => res.json()),
        fetch(`/api/me/members/${memberId}/research-consent`).then((res) => res.json()),
      ]);

      setAssignment(doctorState.assignment || null);
      setConsent(consentState.consent || null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载主治设置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }
    void loadState();
  }, [memberId, open]);

  useEffect(() => {
    if (!canSearch) {
      return;
    }

    const params = new URLSearchParams();
    if (search.trim()) {
      params.set('q', search.trim());
    }

    fetch(`/api/doctors/search?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        setDoctors(data.doctors || []);
      })
      .catch((loadError) => {
        setError(loadError instanceof Error ? loadError.message : '搜索医生失败');
      });
  }, [canSearch, search]);

  if (!open) {
    return null;
  }

  const bindDoctor = async (doctorProfileId: string) => {
    setError('');
    try {
      const response = await fetch(`/api/me/members/${memberId}/attending-doctor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doctorProfileId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '绑定主治医生失败');
      }
      await loadState();
    } catch (bindError) {
      setError(bindError instanceof Error ? bindError.message : '绑定主治医生失败');
    }
  };

  const clearDoctor = async () => {
    setError('');
    try {
      const response = await fetch(`/api/me/members/${memberId}/attending-doctor`, {
        method: 'DELETE',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '解除主治医生失败');
      }
      await loadState();
    } catch (clearError) {
      setError(clearError instanceof Error ? clearError.message : '解除主治医生失败');
    }
  };

  const toggleConsent = async (nextGranted: boolean) => {
    setError('');
    try {
      const response = await fetch(`/api/me/members/${memberId}/research-consent`, {
        method: nextGranted ? 'POST' : 'DELETE',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '更新科研授权失败');
      }
      setConsent(data.consent || null);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : '更新科研授权失败');
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">{memberName} 的主治与科研设置</h2>
            <p className="mt-1 text-sm text-slate-500">为当前成员绑定主治医生，并控制科研导出授权。</p>
          </div>
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">
            关闭
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">加载中...</div>
        ) : !isPatientUser ? (
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            只有已注册并登录的患者账号才能绑定主治医生。请先通过“注册患者账号”完成升级。
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-900">当前主治医生</div>
                {assignment?.doctorProfile ? (
                  <div className="mt-3">
                    <div className="text-lg font-semibold text-slate-900">{assignment.doctorProfile.realName}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {assignment.doctorProfile.hospitalName} · {assignment.doctorProfile.departmentName} · {assignment.doctorProfile.title}
                    </div>
                    <button onClick={() => void clearDoctor()} className="mt-4 rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">
                      解除绑定
                    </button>
                  </div>
                ) : (
                  <div className="mt-3 text-sm text-slate-500">当前未绑定主治医生</div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="text-sm font-semibold text-slate-900">科研导出授权</div>
                <div className="mt-3 text-sm text-slate-500">
                  当前状态：{consent?.status || 'REVOKED'}
                </div>
                <div className="mt-4 flex gap-3">
                  <button onClick={() => void toggleConsent(true)} className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm text-white">
                    开启授权
                  </button>
                  <button onClick={() => void toggleConsent(false)} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm text-slate-600">
                    关闭授权
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-sm font-semibold text-slate-900">选择主治医生</div>
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="搜索医生姓名、医院或科室"
                className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3"
              />
              <div className="mt-4 space-y-3 max-h-[420px] overflow-y-auto">
                {doctors.map((doctor) => (
                  <div key={doctor.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="font-semibold text-slate-900">{doctor.realName}</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {doctor.hospitalName} · {doctor.departmentName} · {doctor.title}
                    </div>
                    <button
                      onClick={() => void bindDoctor(doctor.id)}
                      className="mt-3 rounded-2xl bg-slate-900 px-4 py-2 text-sm text-white"
                    >
                      设为主治医生
                    </button>
                  </div>
                ))}
                {!doctors.length && <div className="text-sm text-slate-500">暂无可选医生</div>}
              </div>
            </div>
          </div>
        )}

        {error && <div className="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>}
      </div>
    </div>
  );
}
