'use client';

import { useEffect, useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type DoctorStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
type DoctorStatusFilter = 'ALL' | DoctorStatus;

type DoctorItem = {
  id: string;
  realName: string;
  hospitalName: string;
  departmentName: string;
  title: string;
  licenseNo: string;
  verificationStatus: DoctorStatus;
  reviewNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string | null;
  user?: {
    email?: string | null;
    phone?: string | null;
    createdAt?: string;
  } | null;
};

const FILTERS: Array<{ value: DoctorStatusFilter; label: string }> = [
  { value: 'ALL', label: '全部' },
  { value: 'PENDING', label: '待审核' },
  { value: 'APPROVED', label: '已通过' },
  { value: 'REJECTED', label: '已驳回' },
  { value: 'SUSPENDED', label: '已暂停' },
];

const STATUS_META: Record<DoctorStatus, { label: string; badgeClass: string }> = {
  PENDING: {
    label: '待审核',
    badgeClass: 'bg-amber-100 text-amber-700',
  },
  APPROVED: {
    label: '已通过',
    badgeClass: 'bg-emerald-100 text-emerald-700',
  },
  REJECTED: {
    label: '已驳回',
    badgeClass: 'bg-rose-100 text-rose-700',
  },
  SUSPENDED: {
    label: '已暂停',
    badgeClass: 'bg-slate-200 text-slate-700',
  },
};

function formatDateTime(value?: string | null) {
  if (!value) {
    return '暂无';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<DoctorItem[]>([]);
  const [filter, setFilter] = useState<DoctorStatusFilter>('ALL');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const load = async (nextFilter: DoctorStatusFilter) => {
    setLoading(true);

    try {
      const response = await fetch(`/api/admin/doctors?status=${encodeURIComponent(nextFilter)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '加载医生列表失败');
      }

      setDoctors(data.doctors || []);
    } catch (error) {
      setDoctors([]);
      setStatusMessage(error instanceof Error ? error.message : '加载医生列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(filter);
  }, [filter]);

  const review = async (doctorId: string, action: 'approve' | 'reject' | 'suspend') => {
    const reviewNotes = window.prompt('请输入审核备注（可选）') || '';
    const response = await fetch(`/api/admin/doctors/${doctorId}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewNotes }),
    });
    const data = await response.json();

    if (!response.ok) {
      setStatusMessage(data.error || '操作失败');
      return;
    }

    const actionLabel =
      action === 'approve' ? '审核通过' : action === 'reject' ? '已驳回' : '已暂停';
    setStatusMessage(`医生状态已更新：${actionLabel}`);
    await load(filter);
  };

  const deleteDoctor = async (doctorId: string, doctorName: string) => {
    if (!window.confirm(`确定要删除医生「${doctorName}」吗？此操作不可撤销，将同时删除其账号。`)) {
      return;
    }

    const response = await fetch(`/api/admin/doctors/${doctorId}/delete`, {
      method: 'DELETE',
    });
    const data = await response.json();

    if (!response.ok) {
      setStatusMessage(data.error || '删除失败');
      return;
    }

    setStatusMessage('医生已删除');
    await load(filter);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="医生审核" description="超级管理员可以查看全部医生申请记录，并按审核状态筛选。" />

      <div className="flex flex-wrap gap-3">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              filter === item.value
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {statusMessage && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          {statusMessage}
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-400">
            正在加载医生列表...
          </div>
        ) : doctors.length ? (
          doctors.map((doctor) => {
            const statusMeta = STATUS_META[doctor.verificationStatus];

            return (
              <Card key={doctor.id} className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <h3 className="text-lg font-semibold text-slate-900">{doctor.realName}</h3>
                    <p className="text-sm text-slate-500">
                      {doctor.hospitalName} · {doctor.departmentName} · {doctor.title}
                    </p>
                    <p className="text-sm text-slate-500">
                      邮箱：{doctor.user?.email || '未填写'} · 手机：{doctor.user?.phone || '未填写'}
                    </p>
                    <p className="text-sm text-slate-500">执业证号：{doctor.licenseNo}</p>
                    <p className="text-sm text-slate-500">
                      申请时间：{formatDateTime(doctor.user?.createdAt || doctor.createdAt)} · 最近更新：{formatDateTime(doctor.updatedAt)}
                    </p>
                    {doctor.approvedAt ? (
                      <p className="text-sm text-slate-500">通过时间：{formatDateTime(doctor.approvedAt)}</p>
                    ) : null}
                    {doctor.reviewNotes ? (
                      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                        审核备注：{doctor.reviewNotes}
                      </div>
                    ) : null}
                  </div>
                  <Badge className={statusMeta.badgeClass}>{statusMeta.label}</Badge>
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {doctor.verificationStatus !== 'APPROVED' ? (
                    <Button variant="accent" size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white" onClick={() => void review(doctor.id, 'approve')}>审核通过</Button>
                  ) : null}
                  {doctor.verificationStatus !== 'REJECTED' ? (
                    <Button variant="destructive" size="sm" onClick={() => void review(doctor.id, 'reject')}>驳回</Button>
                  ) : null}
                  {doctor.verificationStatus !== 'SUSPENDED' ? (
                    <Button size="sm" onClick={() => void review(doctor.id, 'suspend')}>暂停</Button>
                  ) : null}
                  <Button variant="outline" size="sm" className="border-rose-300 text-rose-600 hover:bg-rose-50" onClick={() => void deleteDoctor(doctor.id, doctor.realName)}>删除</Button>
                </div>
              </Card>
            );
          })
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-400">
            当前筛选条件下没有医生记录。
          </div>
        )}
      </div>
    </div>
  );
}
