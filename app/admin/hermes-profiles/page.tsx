'use client';

import { useEffect, useState } from 'react';

import PageHeader from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type HermesProfileStatus = 'DRAFT' | 'READY' | 'DEGRADED' | 'DISABLED';
type HermesProfileStatusFilter = 'ALL' | HermesProfileStatus;
type HermesProfileOwnerType = 'ORGANIZATION' | 'DOCTOR';
type HermesProfileOwnerTypeFilter = 'ALL' | HermesProfileOwnerType;
type KnowledgeDefaultMode = 'platform_proxy' | 'direct_fastgpt';

type HermesProfileItem = {
  id: string;
  ownerType: HermesProfileOwnerType;
  organizationId?: string | null;
  organizationName?: string | null;
  organizationCode?: string | null;
  doctorProfileId?: string | null;
  doctorName?: string | null;
  doctorHospitalName?: string | null;
  displayName?: string | null;
  status: HermesProfileStatus;
  policyJson?: Record<string, unknown> | null;
  configJson?: Record<string, unknown> | null;
  knowledgeDefaultMode: KnowledgeDefaultMode;
  doctorBotFallbackEnabled: boolean;
  knowledgeDocCount: number;
  lastHealthAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type OrganizationCandidate = {
  id: string;
  name: string;
  orgCode?: string | null;
  status: 'ACTIVE' | 'DISABLED';
  doctorCount: number;
};

type DoctorCandidate = {
  id: string;
  realName: string;
  hospitalName: string;
  title: string;
  licenseNo: string;
  verificationStatus: string;
};

type HermesProfileFormState = {
  id: string | null;
  ownerType: HermesProfileOwnerType;
  ownerLabel: string;
  organizationId: string;
  doctorProfileId: string;
  displayName: string;
  status: HermesProfileStatus;
  knowledgeDefaultMode: KnowledgeDefaultMode;
  doctorBotFallbackEnabled: boolean;
  policyJsonText: string;
  configJsonText: string;
};

const OWNER_FILTERS: Array<{ value: HermesProfileOwnerTypeFilter; label: string }> = [
  { value: 'ALL', label: '全部归属' },
  { value: 'ORGANIZATION', label: '组织级' },
  { value: 'DOCTOR', label: '独立医生' },
];

const STATUS_FILTERS: Array<{ value: HermesProfileStatusFilter; label: string }> = [
  { value: 'ALL', label: '全部状态' },
  { value: 'DRAFT', label: '草稿' },
  { value: 'READY', label: '已就绪' },
  { value: 'DEGRADED', label: '降级中' },
  { value: 'DISABLED', label: '已停用' },
];

const STATUS_META: Record<
  HermesProfileStatus,
  { label: string; badge: 'success' | 'warning' | 'secondary' }
> = {
  DRAFT: { label: '草稿', badge: 'secondary' },
  READY: { label: '已就绪', badge: 'success' },
  DEGRADED: { label: '降级中', badge: 'warning' },
  DISABLED: { label: '已停用', badge: 'secondary' },
};

const EMPTY_FORM: HermesProfileFormState = {
  id: null,
  ownerType: 'ORGANIZATION',
  ownerLabel: '',
  organizationId: '',
  doctorProfileId: '',
  displayName: '',
  status: 'READY',
  knowledgeDefaultMode: 'platform_proxy',
  doctorBotFallbackEnabled: true,
  policyJsonText: '{\n}',
  configJsonText: '{\n}',
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

function stringifyEditorJson(value?: Record<string, unknown> | null) {
  return JSON.stringify(value || {}, null, 2);
}

function parseEditorJson(label: string, value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed === null) {
      return null;
    }

    if (typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error(`${label} 必须是 JSON 对象`);
    }

    return parsed as Record<string, unknown>;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : `${label} 不是有效的 JSON`);
  }
}

function getOwnerLabel(profile: HermesProfileItem) {
  if (profile.ownerType === 'ORGANIZATION') {
    return profile.organizationName || profile.organizationId || '未绑定组织';
  }

  return profile.doctorName || profile.doctorProfileId || '未绑定医生';
}

export default function AdminHermesProfilesPage() {
  const [profiles, setProfiles] = useState<HermesProfileItem[]>([]);
  const [organizationCandidates, setOrganizationCandidates] = useState<OrganizationCandidate[]>([]);
  const [doctorCandidates, setDoctorCandidates] = useState<DoctorCandidate[]>([]);
  const [statusFilter, setStatusFilter] = useState<HermesProfileStatusFilter>('ALL');
  const [ownerFilter, setOwnerFilter] = useState<HermesProfileOwnerTypeFilter>('ALL');
  const [query, setQuery] = useState('');
  const [draftQuery, setDraftQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [form, setForm] = useState<HermesProfileFormState>(EMPTY_FORM);

  const load = async (
    nextStatus: HermesProfileStatusFilter,
    nextOwnerType: HermesProfileOwnerTypeFilter,
    nextQuery: string
  ) => {
    setLoading(true);

    try {
      const search = new URLSearchParams();
      search.set('status', nextStatus);
      search.set('ownerType', nextOwnerType);
      if (nextQuery.trim()) {
        search.set('q', nextQuery.trim());
      }

      const response = await fetch(`/api/admin/hermes-profiles?${search.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '加载 Hermes Profile 列表失败');
      }

      setProfiles(data.profiles || []);
      setOrganizationCandidates(data.organizationCandidates || []);
      setDoctorCandidates(data.doctorCandidates || []);
      setStatusMessage('');
    } catch (error) {
      setProfiles([]);
      setOrganizationCandidates([]);
      setDoctorCandidates([]);
      setStatusMessage(error instanceof Error ? error.message : '加载 Hermes Profile 列表失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(statusFilter, ownerFilter, query);
  }, [ownerFilter, query, statusFilter]);

  const resetForm = () => {
    setForm(EMPTY_FORM);
  };

  const submitForm = async () => {
    try {
      const policyJson = parseEditorJson('policyJson', form.policyJsonText);
      const configJson = parseEditorJson('configJson', form.configJsonText);
      const method = form.id ? 'PATCH' : 'POST';

      if (!form.id && form.ownerType === 'ORGANIZATION' && !form.organizationId) {
        throw new Error('请先选择组织');
      }

      if (!form.id && form.ownerType === 'DOCTOR' && !form.doctorProfileId) {
        throw new Error('请先选择独立医生');
      }

      setSubmitting(true);

      const response = await fetch('/api/admin/hermes-profiles', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(form.id ? { id: form.id } : {}),
          ownerType: form.ownerType,
          organizationId: form.ownerType === 'ORGANIZATION' ? form.organizationId || null : null,
          doctorProfileId: form.ownerType === 'DOCTOR' ? form.doctorProfileId || null : null,
          displayName: form.displayName,
          status: form.status,
          knowledgeDefaultMode: form.knowledgeDefaultMode,
          doctorBotFallbackEnabled: form.doctorBotFallbackEnabled,
          policyJson,
          configJson,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '保存 Hermes Profile 失败');
      }

      setStatusMessage(form.id ? 'Hermes Profile 已更新' : 'Hermes Profile 已创建');
      resetForm();
      await load(statusFilter, ownerFilter, query);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : '保存 Hermes Profile 失败');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (profile: HermesProfileItem) => {
    setForm({
      id: profile.id,
      ownerType: profile.ownerType,
      ownerLabel: getOwnerLabel(profile),
      organizationId: profile.organizationId || '',
      doctorProfileId: profile.doctorProfileId || '',
      displayName: profile.displayName || '',
      status: profile.status,
      knowledgeDefaultMode: profile.knowledgeDefaultMode,
      doctorBotFallbackEnabled: profile.doctorBotFallbackEnabled,
      policyJsonText: stringifyEditorJson(profile.policyJson),
      configJsonText: stringifyEditorJson(profile.configJson),
    });
  };

  const toggleStatus = async (profile: HermesProfileItem) => {
    const nextStatus: HermesProfileStatus =
      profile.status === 'DISABLED' ? 'READY' : 'DISABLED';

    try {
      const response = await fetch('/api/admin/hermes-profiles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: profile.id,
          status: nextStatus,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Hermes Profile 状态更新失败');
      }

      setStatusMessage(nextStatus === 'READY' ? 'Hermes Profile 已启用' : 'Hermes Profile 已停用');
      await load(statusFilter, ownerFilter, query);
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : 'Hermes Profile 状态更新失败');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hermes Profile"
        description="管理组织级默认 profile 与独立医生 profile 的 Hermes 运行策略。这里只控制知识模式、fallback 和归属，不承载上游模型供应商或 API Key。"
      />

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {form.id ? '编辑 Hermes Profile' : '新建 Hermes Profile'}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                运行时配置会写入 configJson，并统一归一化到 knowledgeDefaultMode 与 doctorBotFallbackEnabled；这里不保存 provider、model 或 API Key。
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
              <span className="text-sm font-medium text-slate-700">归属层级</span>
              <select
                value={form.ownerType}
                disabled={Boolean(form.id)}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    ownerType: event.target.value as HermesProfileOwnerType,
                    organizationId: '',
                    doctorProfileId: '',
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 disabled:bg-slate-50"
              >
                <option value="ORGANIZATION">组织级默认 Profile</option>
                <option value="DOCTOR">独立医生 Profile</option>
              </select>
            </label>

            {form.id ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                当前归属：{form.ownerLabel}
              </div>
            ) : form.ownerType === 'ORGANIZATION' ? (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">选择组织</span>
                <select
                  value={form.organizationId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      organizationId: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="">请选择组织</option>
                  {organizationCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} · {candidate.doctorCount} 名医生
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-700">选择独立医生</span>
                <select
                  value={form.doctorProfileId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      doctorProfileId: event.target.value,
                    }))
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                >
                  <option value="">请选择独立医生</option>
                  {doctorCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.realName} · {candidate.hospitalName}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">显示名称</span>
              <input
                value={form.displayName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, displayName: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder="例如：平台默认儿发评估助手"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">状态</span>
              <select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value as HermesProfileStatus,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              >
                <option value="DRAFT">草稿</option>
                <option value="READY">已就绪</option>
                <option value="DEGRADED">降级中</option>
                <option value="DISABLED">已停用</option>
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">默认知识模式</span>
              <select
                value={form.knowledgeDefaultMode}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    knowledgeDefaultMode: event.target.value as KnowledgeDefaultMode,
                  }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
              >
                <option value="platform_proxy">platform_proxy</option>
                <option value="direct_fastgpt">direct_fastgpt</option>
              </select>
              <p className="text-xs text-slate-500">
                决定当前 Profile 默认走平台知识代理还是直连已配置的 FastGPT 通道。
              </p>
            </label>

            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-3">
              <input
                type="checkbox"
                checked={form.doctorBotFallbackEnabled}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    doctorBotFallbackEnabled: event.target.checked,
                  }))
                }
                className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
              />
              <span className="text-sm text-slate-700">
                允许 Doctor Bot 回退
                <span className="mt-1 block text-xs text-slate-500">
                  当 Hermes 路径不可用时，允许 doctor bot 回退到既有知识通道。
                </span>
              </span>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">策略扩展 JSON</span>
              <textarea
                rows={6}
                value={form.policyJsonText}
                onChange={(event) =>
                  setForm((current) => ({ ...current, policyJsonText: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder='例如：{"maxConcurrentSessions": 3}'
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-slate-700">运行时扩展 JSON</span>
              <textarea
                rows={6}
                value={form.configJsonText}
                onChange={(event) =>
                  setForm((current) => ({ ...current, configJsonText: event.target.value }))
                }
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 font-mono text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                placeholder='例如：{"knowledgeDefaultMode":"platform_proxy","doctorBotFallbackEnabled":true}'
              />
              <p className="text-xs text-slate-500">
                仅用于少量运行时扩展字段，不保存 provider、model 或 API Key。
              </p>
            </label>
          </div>

          <div className="mt-6 flex gap-3">
            <Button
              variant="accent"
              className="bg-cyan-600 text-white hover:bg-cyan-500"
              onClick={() => void submitForm()}
              disabled={submitting}
            >
              {submitting ? '保存中...' : form.id ? '保存修改' : '创建 Profile'}
            </Button>
            <Button variant="outline" onClick={resetForm} disabled={submitting}>
              重置
            </Button>
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500">
            当前可创建候选：组织 {organizationCandidates.length} 个，独立医生 {doctorCandidates.length} 个。Hermes 上游模型供应商配置仍位于 Hermes 自己的数据目录。
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="p-4">
            <div className="grid gap-4 lg:grid-cols-[160px_160px_1fr_auto]">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">归属筛选</span>
                <select
                  value={ownerFilter}
                  onChange={(event) =>
                    setOwnerFilter(event.target.value as HermesProfileOwnerTypeFilter)
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                >
                  {OWNER_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">状态筛选</span>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value as HermesProfileStatusFilter)
                  }
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                >
                  {STATUS_FILTERS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">关键词</span>
                <input
                  value={draftQuery}
                  onChange={(event) => setDraftQuery(event.target.value)}
                  placeholder="搜索 Profile、组织、医生"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
                />
              </label>

              <div className="flex items-end">
                <Button variant="outline" onClick={() => setQuery(draftQuery)}>
                  搜索
                </Button>
              </div>
            </div>
          </Card>

          {statusMessage ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
              {statusMessage}
            </div>
          ) : null}

          {loading ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-400">
              正在加载 Hermes Profile 列表...
            </div>
          ) : profiles.length ? (
            profiles.map((profile) => {
              const statusMeta = STATUS_META[profile.status];

              return (
                <Card key={profile.id} className="p-6">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-lg font-semibold text-slate-900">
                          {profile.displayName || getOwnerLabel(profile)}
                        </h3>
                        <Badge variant={statusMeta.badge}>{statusMeta.label}</Badge>
                        <Badge variant="info">
                          {profile.ownerType === 'ORGANIZATION' ? '组织级默认 Profile' : '独立医生 Profile'}
                        </Badge>
                        <Badge variant="outline">{profile.knowledgeDefaultMode}</Badge>
                      </div>

                      <div className="grid gap-3 text-sm text-slate-500 md:grid-cols-2">
                        <p>归属对象：{getOwnerLabel(profile)}</p>
                        <p>知识文档：{profile.knowledgeDocCount} 份</p>
                        <p>doctorBotFallbackEnabled：{profile.doctorBotFallbackEnabled ? '开启' : '关闭'}</p>
                        <p>最后健康上报：{formatDateTime(profile.lastHealthAt)}</p>
                        <p>创建时间：{formatDateTime(profile.createdAt)}</p>
                        <p>最后更新：{formatDateTime(profile.updatedAt)}</p>
                        <p>组织编码：{profile.organizationCode || '无'}</p>
                        <p>医生机构：{profile.doctorHospitalName || '不适用'}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Button variant="outline" size="sm" onClick={() => startEdit(profile)}>
                        编辑
                      </Button>
                      <Button size="sm" onClick={() => void toggleStatus(profile)}>
                        {profile.status === 'DISABLED' ? '启用' : '停用'}
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-400">
              当前筛选条件下没有 Hermes Profile 记录。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
