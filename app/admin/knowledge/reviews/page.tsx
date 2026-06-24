'use client';

import { useEffect, useState } from 'react';

import PageHeader from '@/components/layout/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type ReviewItemType = 'ALL' | 'KNOWLEDGE_DOC' | 'QUESTION_EXPLANATION' | 'EDUCATION_CONTENT';
type ReviewStatus = 'ALL' | 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | 'ARCHIVED';

type KnowledgeReviewItem = {
  id: string;
  itemType: Exclude<ReviewItemType, 'ALL'>;
  title: string;
  summary?: string | null;
  status: Exclude<ReviewStatus, 'ALL'>;
  scopeType: 'PLATFORM' | 'ORGANIZATION' | 'DOCTOR';
  language: string;
  organizationId?: string | null;
  doctorProfileId?: string | null;
  organizationName?: string | null;
  doctorName?: string | null;
  sourceDocId?: string | null;
  sourceDocTitle?: string | null;
  questionId?: number | null;
  scaleId?: string | null;
  uploadedByUserId?: string | null;
  sourceFileName?: string | null;
  dimensionKey?: string | null;
  riskLevel?: string | null;
  audience?: string | null;
  chunkCount: number;
  reviewedByAdminId?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

const TYPE_FILTERS: Array<{ value: ReviewItemType; label: string }> = [
  { value: 'ALL', label: '全部类型' },
  { value: 'KNOWLEDGE_DOC', label: '知识文档' },
  { value: 'QUESTION_EXPLANATION', label: '题目解释' },
  { value: 'EDUCATION_CONTENT', label: '健康教育' },
];

const STATUS_FILTERS: Array<{ value: ReviewStatus; label: string }> = [
  { value: 'PENDING_REVIEW', label: '待审核' },
  { value: 'ALL', label: '全部状态' },
  { value: 'DRAFT', label: '草稿' },
  { value: 'APPROVED', label: '已通过' },
  { value: 'REJECTED', label: '已驳回' },
  { value: 'ARCHIVED', label: '已归档' },
];

const STATUS_META: Record<KnowledgeReviewItem['status'], { label: string; badge: 'warning' | 'success' | 'destructive' | 'secondary' | 'outline' }> = {
  DRAFT: { label: '草稿', badge: 'outline' },
  PENDING_REVIEW: { label: '待审核', badge: 'warning' },
  APPROVED: { label: '已通过', badge: 'success' },
  REJECTED: { label: '已驳回', badge: 'destructive' },
  ARCHIVED: { label: '已归档', badge: 'secondary' },
};

const TYPE_LABEL: Record<KnowledgeReviewItem['itemType'], string> = {
  KNOWLEDGE_DOC: '知识文档',
  QUESTION_EXPLANATION: '题目解释',
  EDUCATION_CONTENT: '健康教育',
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

function formatScope(scopeType: KnowledgeReviewItem['scopeType']) {
  switch (scopeType) {
    case 'PLATFORM':
      return '平台';
    case 'ORGANIZATION':
      return '机构';
    case 'DOCTOR':
      return '医生';
    default:
      return scopeType;
  }
}

export default function AdminKnowledgeReviewsPage() {
  const [items, setItems] = useState<KnowledgeReviewItem[]>([]);
  const [itemType, setItemType] = useState<ReviewItemType>('ALL');
  const [status, setStatus] = useState<ReviewStatus>('PENDING_REVIEW');
  const [query, setQuery] = useState('');
  const [draftQuery, setDraftQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const load = async (nextItemType: ReviewItemType, nextStatus: ReviewStatus, nextQuery: string) => {
    setLoading(true);

    try {
      const search = new URLSearchParams();
      search.set('itemType', nextItemType);
      search.set('status', nextStatus);
      if (nextQuery.trim()) {
        search.set('q', nextQuery.trim());
      }

      const response = await fetch(`/api/admin/knowledge/reviews?${search.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '加载知识审核队列失败');
      }

      setItems(data.items || []);
      setStatusMessage('');
    } catch (error) {
      setItems([]);
      setStatusMessage(error instanceof Error ? error.message : '加载知识审核队列失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(itemType, status, query);
  }, [itemType, status, query]);

  const review = async (item: KnowledgeReviewItem, action: 'approve' | 'reject') => {
    const promptLabel = action === 'approve' ? '可选填写通过备注' : '请填写驳回原因';
    const notes = window.prompt(promptLabel) ?? '';
    if (action === 'reject' && !notes.trim()) {
      setStatusMessage('驳回时必须填写审核原因');
      return;
    }

    const response = await fetch('/api/admin/knowledge/reviews', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemType: item.itemType,
        itemId: item.id,
        action,
        reviewNotes: notes,
      }),
    });
    const data = await response.json();

    if (!response.ok) {
      setStatusMessage(data.error || '审核操作失败');
      return;
    }

    setStatusMessage(action === 'approve' ? '知识条目已审核通过' : '知识条目已驳回');
    await load(itemType, status, query);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="知识审核"
        description="审核医生或机构提交的知识文档与题目解释，只有通过审核的内容才能进入平台知识检索。"
      />

      <Card className="p-4">
        <div className="grid gap-4 lg:grid-cols-[180px_180px_1fr_auto]">
          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">条目类型</span>
            <select
              value={itemType}
              onChange={(event) => setItemType(event.target.value as ReviewItemType)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
            >
              {TYPE_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-slate-700">审核状态</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as ReviewStatus)}
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
              placeholder="搜索标题、量表 ID、文件名"
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
            正在加载知识审核队列...
          </div>
        ) : items.length ? (
          items.map((item) => {
            const statusMeta = STATUS_META[item.status];
            return (
              <Card key={`${item.itemType}-${item.id}`} className="p-6">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold text-slate-900">{item.title}</h3>
                      <Badge variant="info">{TYPE_LABEL[item.itemType]}</Badge>
                      <Badge variant={statusMeta.badge}>{statusMeta.label}</Badge>
                      <Badge variant="outline">{formatScope(item.scopeType)}</Badge>
                    </div>

                    <p className="text-sm leading-6 text-slate-600">{item.summary || '暂无摘要'}</p>

                    <div className="grid gap-3 text-sm text-slate-500 md:grid-cols-2">
                      <p>语言：{item.language}</p>
                      <p>机构：{item.organizationName || item.organizationId || '平台默认'}</p>
                      <p>医生：{item.doctorName || item.doctorProfileId || '未绑定'}</p>
                      <p>更新时间：{formatDateTime(item.updatedAt)}</p>
                      <p>创建时间：{formatDateTime(item.createdAt)}</p>
                      <p>来源文件：{item.sourceFileName || item.sourceDocTitle || '无'}</p>
                      {item.itemType === 'QUESTION_EXPLANATION' ? (
                        <p>题目定位：{item.scaleId} · 第 {item.questionId} 题</p>
                      ) : item.itemType === 'EDUCATION_CONTENT' ? (
                        <p>
                          健康教育匹配：{item.scaleId || '通用'} · {item.riskLevel || '全风险'} ·{' '}
                          {item.dimensionKey || '全维度'}
                        </p>
                      ) : (
                        <p>切块数量：{item.chunkCount}</p>
                      )}
                      <p>审核时间：{formatDateTime(item.reviewedAt)}</p>
                    </div>
                  </div>

                  {item.status === 'PENDING_REVIEW' ? (
                    <div className="flex flex-wrap gap-3">
                      <Button
                        variant="accent"
                        size="sm"
                        className="bg-emerald-600 text-white hover:bg-emerald-500"
                        onClick={() => void review(item, 'approve')}
                      >
                        审核通过
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => void review(item, 'reject')}>
                        驳回
                      </Button>
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-400">
            当前筛选条件下没有知识审核条目。
          </div>
        )}
      </div>
    </div>
  );
}
