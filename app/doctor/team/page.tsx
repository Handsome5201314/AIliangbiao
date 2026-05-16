'use client';

import { useEffect, useMemo, useState } from 'react';
import { RefreshCcw, Shield, UserPlus, Users } from 'lucide-react';

import { useAuthSession } from '@/contexts/AuthSessionContext';
import PageHeader from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type CareTeamSummary = {
  id: string;
  name: string;
  hospitalName: string;
  departmentName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  memberCount: number;
  leadCount: number;
  currentDoctorTeamRole?: 'LEAD' | 'MEMBER';
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

export default function DoctorTeamPage() {
  const { authHeaders } = useAuthSession();
  const [teams, setTeams] = useState<CareTeamSummary[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [approvedDoctors, setApprovedDoctors] = useState<DoctorOption[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'LEAD' | 'MEMBER'>('MEMBER');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const loadTeams = async () => {
    setLoadingTeams(true);
    setError('');
    try {
      const response = await fetch('/api/doctor/team', { headers: authHeaders });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '加载团队失败');
      }

      const nextTeams = Array.isArray(data.teams) ? (data.teams as CareTeamSummary[]) : [];
      setTeams(nextTeams);
      setSelectedTeamId((current) => (current && nextTeams.some((item) => item.id === current) ? current : nextTeams[0]?.id || null));
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '加载团队失败');
    } finally {
      setLoadingTeams(false);
    }
  };

  const loadMembers = async (teamId: string) => {
    setLoadingMembers(true);
    setError('');
    try {
      const response = await fetch(`/api/doctor/teams/${teamId}/members`, { headers: authHeaders });
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
    fetch('/api/doctors/search', { headers: authHeaders })
      .then((res) => res.json())
      .then((data) => setApprovedDoctors(data.doctors || []))
      .catch(console.error);
  }, [authHeaders]);

  useEffect(() => {
    if (!selectedTeamId) {
      setMembers([]);
      return;
    }

    void loadMembers(selectedTeamId);
  }, [authHeaders, selectedTeamId]);

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) || null,
    [selectedTeamId, teams],
  );

  const canManage = selectedTeam?.currentDoctorTeamRole === 'LEAD';

  const handleAddMember = async () => {
    if (!selectedTeamId || !selectedDoctorId) {
      return;
    }

    setError('');
    setStatus('');

    try {
      const response = await fetch(`/api/doctor/teams/${selectedTeamId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
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
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '添加团队成员失败');
    }
  };

  const handleUpdateRole = async (doctorProfileId: string, teamRole: 'LEAD' | 'MEMBER') => {
    if (!selectedTeamId) {
      return;
    }

    setError('');
    setStatus('');

    try {
      const response = await fetch(`/api/doctor/teams/${selectedTeamId}/members/${doctorProfileId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ teamRole }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '更新角色失败');
      }

      setStatus('成员角色已更新。');
      await loadMembers(selectedTeamId);
      await loadTeams();
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '更新角色失败');
    }
  };

  const handleRemoveMember = async (doctorProfileId: string) => {
    if (!selectedTeamId) {
      return;
    }

    setError('');
    setStatus('');

    try {
      const response = await fetch(`/api/doctor/teams/${selectedTeamId}/members/${doctorProfileId}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '移除团队成员失败');
      }

      setStatus('团队成员已移除。');
      await loadMembers(selectedTeamId);
      await loadTeams();
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '移除团队成员失败');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="团队协作" description="负责人可维护团队成员，并将患者档案或新生儿病房档案共享给团队医生。" />

      {status ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{status}</div> : null}
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[340px,minmax(0,1fr)]">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">我的团队</h2>
              <p className="mt-1 text-sm text-slate-500">团队由管理员创建，负责人维护成员。</p>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void loadTeams()}
            >
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
                    <Badge variant={team.currentDoctorTeamRole === 'LEAD' ? 'warning' : 'secondary'}>
                      {team.currentDoctorTeamRole === 'LEAD' ? '负责人' : '成员'}
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs leading-6 text-slate-500">
                    <div>{team.hospitalName} · {team.departmentName}</div>
                    <div>成员 {team.memberCount} 人 · 负责人 {team.leadCount} 人</div>
                  </div>
                </button>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                {loadingTeams ? '正在加载团队...' : '你当前还未加入任何团队。'}
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          {!selectedTeam ? (
            <div className="text-sm text-slate-500">请先在左侧选择一个团队。</div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{selectedTeam.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">{selectedTeam.hospitalName} · {selectedTeam.departmentName}</p>
                </div>
                <Badge variant={canManage ? 'warning' : 'secondary'}>
                  {canManage ? '你是团队负责人' : '你是普通成员'}
                </Badge>
              </div>

              {canManage ? (
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
                    <Button
                      variant="accent"
                      onClick={() => void handleAddMember()}
                    >
                      添加
                    </Button>
                  </div>
                </div>
              ) : null}

              <div>
                <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Users className="h-4 w-4 text-cyan-700" />
                  团队成员
                </div>
                <div className="space-y-3">
                  {members.length ? (
                    members.map((member) => (
                      <div key={member.doctorProfileId} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="font-semibold text-slate-900">{member.realName}</div>
                            <div className="mt-1 text-sm text-slate-500">{member.hospitalName} · {member.departmentName} · {member.title}</div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            {canManage ? (
                              <select
                                value={member.teamRole}
                                onChange={(event) =>
                                  void handleUpdateRole(member.doctorProfileId, event.target.value as 'LEAD' | 'MEMBER')
                                }
                                className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none"
                              >
                                <option value="LEAD">负责人</option>
                                <option value="MEMBER">成员</option>
                              </select>
                            ) : (
                              <Badge variant={member.teamRole === 'LEAD' ? 'warning' : 'secondary'}>
                                {member.teamRole === 'LEAD' ? '负责人' : '成员'}
                              </Badge>
                            )}

                            {canManage ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="border-rose-200 text-rose-600 hover:bg-rose-50"
                                onClick={() => void handleRemoveMember(member.doctorProfileId)}
                              >
                                移除
                              </Button>
                            ) : null}
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
