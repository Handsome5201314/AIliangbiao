'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type AiEvent = {
  id: string;
  eventType: string;
  scaleId?: string | null;
  questionId?: number | null;
  provider?: string | null;
  model?: string | null;
  confidence?: number | null;
  confirmedLowConfidence?: boolean;
  transcriptText?: string | null;
  assistantText?: string | null;
  summary?: string | null;
  errorMessage?: string | null;
  fallbackReason?: string | null;
  createdAt: string;
};

type AiSession = {
  id: string;
  userId?: string | null;
  memberProfileId?: string | null;
  assessmentSessionId?: string | null;
  assessmentHistoryId?: string | null;
  scaleId?: string | null;
  questionId?: number | null;
  provider?: string | null;
  model?: string | null;
  status?: string | null;
  createdAt: string;
  events?: AiEvent[];
};

type DetailPayload = {
  session: AiSession;
  events: AiEvent[];
};

export default function AdminAiLogsPage() {
  const [items, setItems] = useState<AiSession[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    memberProfileId: '',
    scaleId: '',
    provider: '',
    lowConfidence: '',
    confirmed: '',
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) {
        params.set(key, value);
      }
    }
    return params.toString();
  }, [filters]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/ai-conversations${queryString ? `?${queryString}` : ''}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '加载 AI 会话日志失败');
      }
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载 AI 会话日志失败');
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  const loadDetail = useCallback(async (id: string) => {
    if (!id) {
      setDetail(null);
      return;
    }

    setDetailLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/ai-conversations/${encodeURIComponent(id)}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '加载 AI 会话详情失败');
      }
      setDetail(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载 AI 会话详情失败');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    void loadDetail(selectedId);
  }, [loadDetail, selectedId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">AI 会话日志中心</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            查看家长语音答题的 ASR、确认、fallback、TTS 和最终答案写入轨迹。科研导出以项目数据库为准。
          </p>
        </div>
        <Button onClick={() => void loadList()} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          <span>刷新</span>
        </Button>
      </div>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <Input
            value={filters.memberProfileId}
            onChange={(event) => setFilters((prev) => ({ ...prev, memberProfileId: event.target.value }))}
            placeholder="成员 ID"
          />
          <Input
            value={filters.scaleId}
            onChange={(event) => setFilters((prev) => ({ ...prev, scaleId: event.target.value }))}
            placeholder="量表 ID"
          />
          <Input
            value={filters.provider}
            onChange={(event) => setFilters((prev) => ({ ...prev, provider: event.target.value }))}
            placeholder="provider"
          />
          <select
            value={filters.lowConfidence}
            onChange={(event) => setFilters((prev) => ({ ...prev, lowConfidence: event.target.value }))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">低置信度：全部</option>
            <option value="true">低置信度</option>
            <option value="false">非低置信度</option>
          </select>
          <select
            value={filters.confirmed}
            onChange={(event) => setFilters((prev) => ({ ...prev, confirmed: event.target.value }))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">已确认状态：全部</option>
            <option value="true">已确认</option>
            <option value="false">未确认</option>
          </select>
        </div>
      </Card>

      {error ? <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">会话列表</div>
          <div className="divide-y divide-slate-200">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={`block w-full px-4 py-3 text-left hover:bg-slate-50 ${selectedId === item.id ? 'bg-cyan-50' : ''}`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs text-slate-500">{item.id}</span>
                  {item.status ? <Badge variant="info">{item.status}</Badge> : null}
                  {item.scaleId ? <Badge variant="secondary">{item.scaleId}</Badge> : null}
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  成员 {item.memberProfileId || '-'} · provider {item.provider || '-'} · {new Date(item.createdAt).toLocaleString('zh-CN')}
                </div>
              </button>
            ))}
            {!items.length && !loading ? <div className="px-4 py-10 text-center text-sm text-slate-500">暂无 AI 会话日志</div> : null}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700">每轮事件与最终答案写入轨迹</div>
          {detailLoading ? (
            <div className="flex items-center gap-2 px-4 py-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              加载详情中...
            </div>
          ) : detail ? (
            <div className="divide-y divide-slate-200">
              {detail.events.map((event) => (
                <div key={event.id} className="px-4 py-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={event.eventType === 'error' ? 'destructive' : 'secondary'}>{event.eventType}</Badge>
                    {event.confirmedLowConfidence ? <Badge variant="warning">低置信度已确认</Badge> : null}
                    {event.confidence !== null && event.confidence !== undefined ? (
                      <span className="text-xs text-slate-500">confidence {event.confidence.toFixed(2)}</span>
                    ) : null}
                    <span className="text-xs text-slate-400">{new Date(event.createdAt).toLocaleString('zh-CN')}</span>
                  </div>
                  {event.transcriptText ? <p className="mt-2 text-sm text-slate-700">家长原话：{event.transcriptText}</p> : null}
                  {event.assistantText ? <p className="mt-1 text-sm text-slate-700">助手追问/播报：{event.assistantText}</p> : null}
                  {event.summary ? <p className="mt-1 text-xs text-slate-500">{event.summary}</p> : null}
                  {event.errorMessage ? <p className="mt-1 text-xs text-rose-600">错误：{event.errorMessage}</p> : null}
                  {event.fallbackReason ? <p className="mt-1 text-xs text-amber-700">fallback：{event.fallbackReason}</p> : null}
                </div>
              ))}
            </div>
          ) : (
            <div className="px-4 py-10 text-center text-sm text-slate-500">请选择左侧会话查看逐轮事件</div>
          )}
        </Card>
      </div>
    </div>
  );
}
