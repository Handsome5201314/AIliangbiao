'use client';

import { useEffect, useMemo, useState } from 'react';
import { Building2, Plus, RefreshCcw, Shield, UserPlus, Users } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

type TeamSummary = {
  id: string;
  name: string;
  hospitalName: string;
  departmentName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  leadCount: number;
};

type TeamMember = {
  doctorProfileId: string;
  realName: string;
  hospitalName: string;
  departmentName: string;
  title: string;
  verificationStatus: string;
  teamRole: 'LEAD' | 'MEMBER';
  createdAt: string;
};

type DoctorOption = {
  id: string;
  realName: string;
  hospitalName: string;
  departmentName: string;
  title: string;
  verificationStatus: string;
};

function emptyCreateForm() {
  return {
    name: '',
    hospitalName: '',
    departmentName: '',
    leadDoctorProfileId: '',
  };
}

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [approvedDoctors, setApprovedDoctors] = useState<DoctorOption[]>([]);
  const [createForm, setCreateForm] = useState(emptyCreateForm());
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'LEAD' | 'MEMBER'>('MEMBER');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadTeams = async () => {
    setLoadingTeams(true);
    setError('');
    try {
      const response = await fetch('/api/admin/teams');
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '加载团队列表失败');
      }

      const nextTeams = Array.isArray(data.teams) ? (data.teams as TeamSummary[]) : [];
      setTeams(nextTeams);
      setSelectedTeamId((current) => (current && nextTeams.some((item) => item.id === current) ? current : nextTeams[0]?.id || null));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '加载团队列表失败');
    } finally {
      setLoadingTeams(false);
    }
  };

  const loadMembers = async (teamId: string) => {
    setLoadingMembers(true);
    try {
      const response = await fetch(`/api/admin/teams/${teamId}/members`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '加载团队成员失败');
      }
      setMembers(Array.isArray(data.members) ? (data.members as TeamMember[]) : []);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '加载团队成员失败');
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    void loadTeams();
    fetch('/api/admin/doctors?status=APPROVED')
      .then((res) => res.json())
      .then((data) => setApprovedDoctors(data.doctors || []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedTeamId) {
      setMembers([]);
      return;
    }

    void loadMembers(selectedTeamId);
  }, [selectedTeamId]);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) || null,
    [selectedTeamId, teams],
  );

  const handleCreate = async () => {
    setSubmitting(true);
    setError('');
    setStatus('');

    try {
      const response = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: createForm.name,
          hospitalName: createForm.hospitalName,
          departmentName: createForm.departmentName,
          leadDoctorProfileId: createForm.leadDoctorProfileId,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '创建团队失败');
      }

      setCreateForm(emptyCreateForm());
      setStatus('团队已创建。');
      await loadTeams();
      setSelectedTeamId(data.team.id);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '创建团队失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleTeam = async (team: TeamSummary) => {
    setError('');
    setStatus('');

    try {
      const response = await fetch(`/api/admin/teams/${team.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !team.isActive,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '更新团队状态失败');
      }

      setStatus(team.isActive ? '团队已停用。' : '团队已启用。');
      await loadTeams();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '更新团队状态失败');
    }
  };

  const handleAddMember = async () => {
    if (!selectedTeamId || !selectedDoctorId) {
      return;
    }

    setError('');
    setStatus('');

    try {
      const response = await fetch(`/api/admin/teams/${selectedTeamId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          doctorProfileId: selectedDoctorId,
          teamRole: selectedRole,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '添加团队成员失败');
      }

      setStatus('团队成员已更新。');
      await loadMembers(selectedTeamId);
      await loadTeams();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '添加团队成员失败');
    }
  };

  const handleRemoveMember = async (doctorProfileId: string) => {
    if (!selectedTeamId) {
      return;
    }

    setError('');
    setStatus('');

    try {
      const response = await fetch(`/api/admin/teams/${selectedTeamId}/members/${doctorProfileId}`, {
        method: 'DELETE',
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '移除团队成员失败');
      }

      setStatus('团队成员已移除。');
      await loadMembers(selectedTeamId);
      await loadTeams();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '移除团队成员失败');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="团队管理" description="由管理员创建团队，锁定医院科室边界，并指定初始负责人医生。" />

      {status ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{status}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[380px,minmax(0,1fr)]">
        <section className="space-y-5">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">创建团队</h3>
                <p className="mt-1 text-sm text-slate-500">团队成员必须与团队处于同医院同科室。</p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <Input
                value={createForm.name}
                onChange={(event) => setCreateForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="团队名称"
              />
              <select
                value={createForm.leadDoctorProfileId}
                onChange={(event) => {
                  const doctorId = event.target.value;
                  const doctor = approvedDoctors.find((d) => d.id === doctorId);
                  setCreateForm((current) => ({
                    ...current,
                    leadDoctorProfileId: doctorId,
                    hospitalName: doctor?.hospitalName || '',
                    departmentName: doctor?.departmentName || '',
                  }));
                }}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-300"
              >
                <option value="">请先选择负责人医生（自动填充医院科室）</option>
                {approvedDoctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.realName} · {doctor.hospitalName} · {doctor.departmentName}
                  </option>
                ))}
              </select>
              <Input
                value={createForm.hospitalName}
                readOnly
                placeholder="医院名称（选择医生后自动填充）"
                className="bg-slate-50 text-slate-500"
              />
              <Input
                value={createForm.departmentName}
                readOnly
                placeholder="科室名称（选择医生后自动填充）"
                className="bg-slate-50 text-slate-500"
              />

              <Button className="w-full" onClick={() => void handleCreate()} disabled={submitting}>
                {submitting ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                <span>{submitting ? '创建中...' : '创建团队'}</span>
              </Button>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">团队列表</h3>
                <p className="mt-1 text-sm text-slate-500">点击团队查看成员。</p>
              </div>
              <Button variant="outline" size="icon" className="rounded-full" onClick={() => void loadTeams()}>
                <RefreshCcw className={`h-4 w-4 ${loadingTeams ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              {teams.length ? (
                teams.map((team) => (
                  <button
                    key={team.id}
                    type="button"
                    onClick={() => setSelectedTeamId(team.id)}
                    className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                      selectedTeamId === team.id ? 'border-cyan-200 bg-cyan-50' : 'border-slate-200 bg-slate-50 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-slate-900">{team.name}</div>
                      <Badge variant={team.isActive ? 'success' : 'secondary'}>{team.isActive ? '启用中' : '已停用'}</Badge>
                    </div>
                    <div className="mt-2 text-xs leading-6 text-slate-500">
                      <div>{team.hospitalName} · {team.departmentName}</div>
                      <div>成员 {team.memberCount} 人 · 负责人 {team.leadCount} 人</div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  {loadingTeams ? '正在加载团队...' : '还没有团队。'}
                </div>
              )}
            </div>
          </Card>
        </section>

        <Card className="p-6">
          {!selectedTeam ? (
            <div className="text-sm text-slate-500">请先在左侧选择一个团队。</div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-slate-900">{selectedTeam.name}</h3>
                  <p className="mt-1 text-sm text-slate-500">{selectedTeam.hospitalName} · {selectedTeam.departmentName}</p>
                </div>
                <Button onClick={() => void handleToggleTeam(selectedTeam)} className={selectedTeam.isActive ? '' : 'bg-emerald-600 hover:bg-emerald-500'}>
                  {selectedTeam.isActive ? '停用团队' : '启用团队'}
                </Button>
              </div>

              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <UserPlus className="h-4 w-4 text-cyan-700" />
                  添加成员
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr),180px,160px]">
                  <select
                    value={selectedDoctorId}
                    onChange={(event) => setSelectedDoctorId(event.target.value)}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-300"
                  >
                    <option value="">选择医生</option>
                    {approvedDoctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        {doctor.realName} · {doctor.hospitalName} · {doctor.departmentName}
                      </option>
                    ))}
                  </select>
                  <select
                    value={selectedRole}
                    onChange={(event) => setSelectedRole(event.target.value as 'LEAD' | 'MEMBER')}
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-300"
                  >
                    <option value="MEMBER">普通成员</option>
                    <option value="LEAD">负责人</option>
                  </select>
                  <Button variant="accent" onClick={() => void handleAddMember()}>添加</Button>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Users className="h-4 w-4 text-cyan-700" />
                  团队成员
                </div>
                <div className="mt-4 space-y-3">
                  {members.length ? (
                    members.map((member) => (
                      <div key={member.doctorProfileId} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="font-semibold text-slate-900">{member.realName}</div>
                            <div className="mt-1 text-sm text-slate-500">{member.hospitalName} · {member.departmentName} · {member.title}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant={member.teamRole === 'LEAD' ? 'warning' : 'secondary'}>{member.teamRole === 'LEAD' ? '负责人' : '成员'}</Badge>
                            <Button variant="outline" size="sm" className="border-rose-200 text-rose-600 hover:bg-rose-50" onClick={() => void handleRemoveMember(member.doctorProfileId)}>移除</Button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                      {loadingMembers ? '正在加载团队成员...' : '当前团队还没有成员。'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
