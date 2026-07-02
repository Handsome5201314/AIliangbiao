'use client';

import { useEffect, useState } from 'react';

import PageHeader from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type OrganizationStatus = 'ACTIVE' | 'DISABLED';
type OrganizationStatusFilter = 'ALL' | OrganizationStatus;

type OrganizationItem = {
  id: string;
  name: string;
  orgCode?: string | null;
  status: OrganizationStatus;
  contactName?: string | null;
  contactPhone?: string | null;
  createdByAdminId?: string | null;
  createdAt: string;
  updatedAt: string;
  doctorCount: number;
};

type OrganizationFormState = {
  id: string | null;
  name: string;
  orgCode: string;
  contactName: string;
  contactPhone: string;
  status: OrganizationStatus;
};

const FILTERS: Array<{ value: OrganizationStatusFilter; label: string }> = [
  { value: 'ALL', label: '全部组织' },
  { value: 'ACTIVE', label: '启用中' },
  { value: 'DISABLED', label: '已停用' },
];

const STATUS_META: Record<OrganizationStatus, { label: string; badge: 'success' | 'secondary' }> = {
  ACTIVE: { label: '启用中', badge: 'success' },
  DISABLED: { label: '已停用', badge: 'secondary' },
};

const EMPTY_FORM: OrganizationFormState = {
  id: null,
  name: '',
  orgCode: '',
  contactName: '',
  contactPhone: '',
  status: 'ACTIVE',
};

function formatDateTime(value: string) {
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

export default function AdminOrganizationsPage() {
  const [organizations, setOrganizations] = useState<OrganizationItem[]>([]);
  const [filter, setFilter] = useState<OrganizationStatusFilter>('ALL');
  const [query, setQuery] = useState('');
  const [draftQuery, setDraftQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [form, setForm] = useState<OrganizationFormState>(EMPTY_FORM);

  const load = async (nextFilter: OrganizationStatusFilter, nextQuery: string) => {
    setLoading(true);

    try {
      const search = new URLSearchParams();
      search.set('status', nextFilter);
      if (nextQuery.trim()) {
        search.set('q', nextQuery.trim());
      }

      const response = await fetch(`/api/admin/organizations?${search.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '加载组织列表失败');
      }

      setOrganizations(data.organizations || []);
      setStatusMessage('');
    } catch (error) {
      setOrganizations([]);
      setStatusMessage(error instanceof Error ? error.message : '加载组织列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(filter, query);
  }, [filter, query]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
  };

  const submitForm = async () => {
    if (!form.name.trim()) {
      setStatusMessage('请先填写组织名称');
      return;
    }

    setSubmitting(true);

    try {
      const method = form.id ? 'PATCH' : 'POST';
      const response = await fetch('/api/admin/organizations', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(form.id ? { id: form.id } : {}),
          name: form.name,
          orgCode: form.orgCode,
          contactName: form.contactName,
          contactPhone: form.contactPhone,
          status: form.status,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '保存组织失败');
      }

      setStatusMessage(form.id ? '组织信息已更新' : '组织已创建');
      resetForm();
      await load(filter, query);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '保存组织失败');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (organization: OrganizationItem) => {
    setForm({
      id: organization.id,
      name: organization.name,
      orgCode: organization.orgCode || '',
      contactName: organization.contactName || '',
      contactPhone: organization.contactPhone || '',
      status: organization.status,
    });
  };

  const toggleStatus = async (organization: OrganizationItem) => {
    const nextStatus: OrganizationStatus = organization.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';

    try {
      const response = await fetch('/api/admin/organizations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: organization.id,
          status: nextStatus,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '组织状态更新失败');
      }

      setStatusMessage(nextStatus === 'ACTIVE' ? '组织已重新启用' : '组织已停用');
      await load(filter, query);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '组织状态更新失败');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="组织管理"
        description="维护机构租户、联系人和启停状态，为知识审核与医生归属提供主租户入口。"
      />

      <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {form.id ? '编辑组织' : '新建组织'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                先落组织主租户，后续知识审核和医生归属都以此为准。
              </p>
            </div>
            {form.id ? (
              <Button variant="outline" size="sm" onClick={resetForm}>
                取消编辑
              </Button>
            ) : null}
          </div>

          <div className="mt-6 space-y-4">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">组织名称</span>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder="例如：上海儿童发育评估中心"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">机构编码</span>
              <input
                value={form.orgCode}
                onChange={(event) => setForm((current) => ({ ...current, orgCode: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder="可选，用于渠道或外部系统映射"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">联系人</span>
              <input
                value={form.contactName}
                onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder="可选"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">联系电话</span>
              <input
                value={form.contactPhone}
                onChange={(event) => setForm((current) => ({ ...current, contactPhone: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder="可选"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">状态</span>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as OrganizationStatus,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              >
                <option value="ACTIVE">启用中</option>
                <option value="DISABLED">已停用</option>
              </select>
            </label>
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              variant="accent"
              className="bg-cyan-600 text-white hover:bg-cyan-500"
              onClick={() => void submitForm()}
              disabled={submitting}
            >
              {submitting ? '保存中...' : form.id ? '保存修改' : '创建组织'}
            </Button>
            <Button variant="outline" onClick={resetForm} disabled={submitting}>
              重置
            </Button>
          </div>

          {statusMessage ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              {statusMessage}
            </div>
          ) : null}
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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

              <div className="flex gap-3">
                <input
                  value={draftQuery}
                  onChange={(event) => setDraftQuery(event.target.value)}
                  placeholder="搜索组织、编码、联系人"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 lg:w-72"
                />
                <Button variant="outline" onClick={() => setQuery(draftQuery)}>
                  搜索
                </Button>
              </div>
            </div>
          </Card>

          {loading ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-400">
              正在加载组织列表...
            </div>
          ) : organizations.length ? (
            organizations.map((organization) => {
              const statusMeta = STATUS_META[organization.status];

              return (
                <Card key={organization.id} className="p-6">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold text-slate-900">{organization.name}</h3>
                        <Badge variant={statusMeta.badge}>{statusMeta.label}</Badge>
                        {organization.orgCode ? (
                          <Badge variant="outline">编码：{organization.orgCode}</Badge>
                        ) : null}
                      </div>

                      <div className="grid gap-3 text-sm text-slate-500 md:grid-cols-2">
                        <p>联系人：{organization.contactName || '未填写'}</p>
                        <p>联系电话：{organization.contactPhone || '未填写'}</p>
                        <p>归属医生：{organization.doctorCount} 人</p>
                        <p>创建时间：{formatDateTime(organization.createdAt)}</p>
                        <p>最后更新：{formatDateTime(organization.updatedAt)}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button variant="outline" size="sm" onClick={() => startEdit(organization)}>
                        编辑
                      </Button>
                      <Button size="sm" onClick={() => void toggleStatus(organization)}>
                        {organization.status === 'ACTIVE' ? '停用' : '启用'}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-400">
              当前筛选条件下没有组织记录。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
