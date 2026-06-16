'use client';

import { useEffect, useState } from 'react';

import PageHeader from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type AuditActorType = 'ALL' | 'USER' | 'DOCTOR' | 'ADMIN' | 'SYSTEM';
type AuditTargetType = 'ALL' | 'MEMBER_PROFILE' | 'KNOWLEDGE_DOC' | 'QUESTION_EXPLANATION' | 'AGENT_SESSION';

type AuditLogItem = {
  id: string;
  organizationId?: string | null;
  actorType: Exclude<AuditActorType, 'ALL'>;
  actorLabel: string;
  actorUserId?: string | null;
  actorDoctorProfileId?: string | null;
  actorAdminId?: string | null;
  memberProfileId?: string | null;
  targetType: Exclude<AuditTargetType, 'ALL'>;
  targetId?: string | null;
  action: string;
  details?: unknown;
  detailsSummary?: string | null;
  createdAt: string;
};

const ACTOR_FILTERS: Array<{ value: AuditActorType; label: string }> = [
  { value: 'ALL', label: '全部操作者' },
  { value: 'ADMIN', label: '管理员' },
  { value: 'DOCTOR', label: '医生' },
  { value: 'USER', label: '用户' },
  { value: 'SYSTEM', label: '系统' },
];

const TARGET_FILTERS: Array<{ value: AuditTargetType; label: string }> = [
  { value: 'ALL', label: '全部目标' },
  { value: 'QUESTION_EXPLANATION', label: '题目解释' },
  { value: 'KNOWLEDGE_DOC', label: '知识文档' },
  { value: 'MEMBER_PROFILE', label: '成员档案' },
  { value: 'AGENT_SESSION', label: 'Agent 会话' },
];

const ACTOR_BADGE: Record<AuditLogItem['actorType'], 'default' | 'info' | 'warning' | 'secondary'> = {
  ADMIN: 'default',
  DOCTOR: 'info',
  USER: 'secondary',
  SYSTEM: 'warning',
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
    second: '2-digit',
  }).format(date);
}

function formatTargetLabel(targetType: AuditLogItem['targetType']) {
  switch (targetType) {
    case 'QUESTION_EXPLANATION':
      return '题目解释';
    case 'KNOWLEDGE_DOC':
      return '知识文档';
    case 'MEMBER_PROFILE':
      return '成员档案';
    case 'AGENT_SESSION':
      return 'Agent 会话';
    default:
      return targetType;
  }
}

export default function AdminAuditsPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [actorType, setActorType] = useState<AuditActorType>('ALL');
  const [targetType, setTargetType] = useState<AuditTargetType>('ALL');
  const [query, setQuery] = useState('');
  const [draftQuery, setDraftQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const load = async (nextActorType: AuditActorType, nextTargetType: AuditTargetType, nextQuery: string) => {
    setLoading(true);

    try {
      const search = new URLSearchParams();
      search.set('actorType', nextActorType);
      search.set('targetType', nextTargetType);
      if (nextQuery.trim()) {
        search.set('q', nextQuery.trim());
      }

      const response = await fetch(`/api/admin/audit-logs?${search.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '加载审计日志失败');
      }

      setLogs(data.logs || []);
      setStatusMessage('');
    } catch (error) {
      setLogs([]);
      setStatusMessage(error instanceof Error ? error.message : '加载审计日志失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(actorType, targetType, query);
  }, [actorType, targetType, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="审计日志"
        description="查看平台知识解释、敏感访问和治理动作的可追溯记录，供超级管理员和审计员复核。"
      />

      <Card className="p-4">
        <div className="grid gap-4 lg:grid-cols-[180px_180px_1fr_auto]">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">操作者</span>
            <select
              value={actorType}
              onChange={(event) => setActorType(event.target.value as AuditActorType)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            >
              {ACTOR_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">目标类型</span>
            <select
              value={targetType}
              onChange={(event) => setTargetType(event.target.value as AuditTargetType)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            >
              {TARGET_FILTERS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">关键词</span>
            <input
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              placeholder="搜索 action、targetId、memberId、organizationId"
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

      <div className="space-y-4">
        {loading ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-400">
            正在加载审计日志...
          </div>
        ) : logs.length ? (
          logs.map((log) => (
            <Card key={log.id} className="p-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">{log.action}</h3>
                    <Badge variant={ACTOR_BADGE[log.actorType]}>{log.actorType}</Badge>
                    <Badge variant="outline">{formatTargetLabel(log.targetType)}</Badge>
                  </div>

                  <div className="grid gap-3 text-sm text-slate-500 md:grid-cols-2">
                    <p>操作者：{log.actorLabel}</p>
                    <p>记录时间：{formatDateTime(log.createdAt)}</p>
                    <p>目标 ID：{log.targetId || '未记录'}</p>
                    <p>成员 ID：{log.memberProfileId || '未记录'}</p>
                    <p>组织 ID：{log.organizationId || '未记录'}</p>
                    <p>日志 ID：{log.id}</p>
                  </div>

                  {log.detailsSummary ? (
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                      details：{log.detailsSummary}
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-400">
            当前筛选条件下没有审计日志。
          </div>
        )}
      </div>
    </div>
  );
}
