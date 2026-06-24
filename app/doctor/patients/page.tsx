'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Loader2, PlusCircle, Search, UserRound } from 'lucide-react';

import { useAuthSession } from '@/contexts/AuthSessionContext';
import PageHeader from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type PatientListItem = {
  assignmentId: string | null;
  memberId: string;
  nickname: string;
  realName?: string | null;
  contactPhone?: string | null;
  pendingClaim?: boolean;
  relation: string;
  gender: string;
  ageMonths?: number | null;
  patientEmail?: string | null;
  researchConsent: string;
  latestAssessment: {
    scaleId: string;
    conclusion: string;
    totalScore: number;
    createdAt: string;
  } | null;
  accessRole: 'OWNER' | 'COLLABORATOR' | 'READONLY';
  accessSource: string;
  ownerDoctor?: {
    realName: string;
    hospitalName: string;
    departmentName: string;
    title: string;
  } | null;
};

export default function DoctorPatientsPage() {
  const { authHeaders } = useAuthSession();
  const [patients, setPatients] = useState<PatientListItem[]>([]);
  const [query, setQuery] = useState('');
  const [consent, setConsent] = useState<'ALL' | 'GRANTED' | 'REVOKED'>('ALL');
  const [creating, setCreating] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [createForm, setCreateForm] = useState({
    name: '',
    gender: 'male' as 'male' | 'female',
    ageMonths: '36',
    contact: '',
    note: '',
  });

  const loadPatients = useCallback(async () => {
    const url = new URL('/api/doctor/patients', window.location.origin);
    if (query) url.searchParams.set('q', query);
    if (consent !== 'ALL') url.searchParams.set('consent', consent);

    const response = await fetch(url.toString(), { headers: authHeaders });
    const data = await response.json().catch(() => ({}));
    setPatients(data.patients || []);
  }, [authHeaders, consent, query]);

  useEffect(() => {
    void loadPatients().catch(console.error);
  }, [loadPatients]);

  const createPatient = async () => {
    if (!createForm.name.trim()) {
      setStatusMessage('请先填写儿童姓名或门诊临时称呼');
      return;
    }

    setCreating(true);
    setStatusMessage('');
    try {
      const response = await fetch('/api/doctor/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          name: createForm.name,
          gender: createForm.gender,
          ageMonths: Number(createForm.ageMonths),
          contact: createForm.contact || undefined,
          note: createForm.note || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '创建儿童档案失败');
      }

      setStatusMessage('儿童档案已创建，可在列表中选择后发起评估');
      setCreateForm({ name: '', gender: 'male', ageMonths: '36', contact: '', note: '' });
      await loadPatients();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '创建儿童档案失败');
    } finally {
      setCreating(false);
    }
  };

  const emptyLabel = useMemo(() => {
    if (query) return '没有找到匹配的患者记录。';
    return '当前还没有你可访问的患者档案。';
  }, [query]);

  return (
    <div className="space-y-6">
      <PageHeader title="患者管理" description="展示当前由你主责或通过团队授权共享给你的患者成员档案与最近评估。" />

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2">
          <PlusCircle className="h-5 w-5 text-cyan-700" />
          <h2 className="text-lg font-semibold text-slate-900">创建儿童档案</h2>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_160px_160px_1fr]">
          <Input
            value={createForm.name}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="儿童姓名或临时称呼"
          />
          <select
            value={createForm.gender}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, gender: event.target.value as 'male' | 'female' }))}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-400"
          >
            <option value="male">男</option>
            <option value="female">女</option>
          </select>
          <Input
            type="number"
            min={0}
            max={216}
            value={createForm.ageMonths}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, ageMonths: event.target.value }))}
            placeholder="月龄"
          />
          <Input
            value={createForm.contact}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, contact: event.target.value }))}
            placeholder="联系电话，可选"
          />
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
          <Input
            value={createForm.note}
            onChange={(event) => setCreateForm((prev) => ({ ...prev, note: event.target.value }))}
            placeholder="备注，可选"
          />
          <Button onClick={() => void createPatient()} disabled={creating}>
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
            <span>{creating ? '创建中' : '创建档案'}</span>
          </Button>
        </div>
        {statusMessage ? <div className="mt-3 text-sm text-slate-500">{statusMessage}</div> : null}
      </Card>

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索姓名、昵称或手机号"
              className="pl-10"
            />
          </div>
          <select
            value={consent}
            onChange={(event) => setConsent(event.target.value as 'ALL' | 'GRANTED' | 'REVOKED')}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-400"
          >
            <option value="ALL">全部科研状态</option>
            <option value="GRANTED">已授权科研导出</option>
            <option value="REVOKED">已撤销科研授权</option>
          </select>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {patients.length ? (
          patients.map((patient) => (
            <Link
              key={patient.memberId}
              href={`/doctor/patients/${patient.memberId}`}
              className="block"
            >
              <Card className="p-5 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-slate-900">
                        {patient.realName || patient.nickname}
                      </h2>
                      <p className="text-sm text-slate-500">
                        {patient.contactPhone || '未填写手机号'} · {patient.relation}
                        {patient.pendingClaim ? ' · 待认领' : ''}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {patient.latestAssessment
                          ? `${patient.latestAssessment.scaleId} · ${patient.latestAssessment.conclusion}`
                          : '暂无评估记录'}
                      </p>
                      {patient.ownerDoctor && patient.accessRole !== 'OWNER' ? (
                        <p className="mt-1 text-xs text-slate-500">
                          主责医生：{patient.ownerDoctor.realName} · {patient.ownerDoctor.departmentName}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <Badge variant={patient.accessRole === 'OWNER' ? 'info' : patient.accessRole === 'COLLABORATOR' ? 'warning' : 'secondary'}>
                      {patient.accessSource}
                    </Badge>
                    <Badge variant={patient.researchConsent === 'GRANTED' ? 'success' : 'secondary'}>
                      {patient.researchConsent === 'GRANTED' ? '已科研授权' : '未科研授权'}
                    </Badge>
                  </div>
                </div>
              </Card>
            </Link>
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-400">
            {emptyLabel}
          </div>
        )}
      </div>
    </div>
  );
}
