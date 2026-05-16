'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Activity, Clock3, Database, Filter, Loader2, RefreshCw, TerminalSquare, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type McpSummary = {
  generatedAt: string;
  windows: {
    last5m: number;
    last1h: number;
    last24h: number;
  };
  latestCalledAt: string | null;
  topActions: Array<{ name: string; count: number }>;
  topScales: Array<{ name: string; count: number }>;
  topEntrypoints: Array<{ key: string; label: string; count: number }>;
  recentCalls: Array<{
    id: string;
    clientId: string;
    apiKeyName: string | null;
    apiKeyProvider: string | null;
    action: string;
    scaleId: string | null;
    entrypoint: string;
    entrypointLabel: string;
    createdAt: string;
  }>;
};

type McpLogsResponse = {
  items: McpSummary['recentCalls'];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters: {
    entrypoints: Array<{ value: string; label: string }>;
  };
};

function formatDateTime(value: string | null) {
  if (!value) return '暂无记录';
  return new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function SummaryCard({
  title,
  value,
  helper,
  icon,
}: {
  title: string;
  value: string | number;
  helper?: string;
  icon: ReactNode;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
          {helper ? <p className="mt-2 text-xs leading-6 text-slate-500">{helper}</p> : null}
        </div>
        <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">{icon}</div>
      </div>
    </Card>
  );
}

export default function AdminMcpPage() {
  const [summary, setSummary] = useState<McpSummary | null>(null);
  const [logs, setLogs] = useState<McpLogsResponse | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    entrypoint: 'all',
    action: '',
    scaleId: '',
    clientId: '',
    timeRange: '24h',
    page: 1,
  });

  const loadSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const response = await fetch('/api/admin/mcp/summary');
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '加载 MCP 概览失败');
      }
      setSummary(data);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载 MCP 概览失败');
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const params = new URLSearchParams({
        entrypoint: filters.entrypoint,
        action: filters.action,
        scaleId: filters.scaleId,
        clientId: filters.clientId,
        timeRange: filters.timeRange,
        page: String(filters.page),
        pageSize: '20',
      });

      const response = await fetch(`/api/admin/mcp/logs?${params.toString()}`);
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '加载 MCP 历史记录失败');
      }
      setLogs(data);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载 MCP 历史记录失败');
    } finally {
      setLoadingLogs(false);
    }
  }, [filters.action, filters.clientId, filters.entrypoint, filters.page, filters.scaleId, filters.timeRange]);

  useEffect(() => {
    void loadSummary();
    const timer = window.setInterval(() => {
      void loadSummary();
    }, 8000);

    return () => window.clearInterval(timer);
  }, [loadSummary]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const entrypointOptions = useMemo(
    () => [{ value: 'all', label: '全部入口' }, ...(logs?.filters.entrypoints || [])],
    [logs?.filters.entrypoints]
  );

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_right,_rgba(34,197,94,0.14),_transparent_35%),linear-gradient(135deg,_#ffffff,_#f9fbff_55%,_#f4fff9)] p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/80 px-3 py-1 text-xs font-semibold text-emerald-700">
              <Activity className="h-3.5 w-3.5" />
              <span>MCP 调用监控</span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
              实时概览 + 历史记录
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              第一版通过后台轮询展示最近 5 分钟、1 小时和 24 小时的 MCP 调用情况，同时保留可筛选、可分页的历史记录表。后续如果需要更强的实时性，再升级为 SSE 或 WebSocket。
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              void loadSummary();
              void loadLogs();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
          >
            <RefreshCw className="h-4 w-4" />
            <span>立即刷新</span>
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          title="最近 5 分钟"
          value={loadingSummary && !summary ? '...' : summary?.windows.last5m ?? 0}
          helper="用于观察是否有实时流量进入"
          icon={<Zap className="h-5 w-5" />}
        />
        <SummaryCard
          title="最近 1 小时"
          value={loadingSummary && !summary ? '...' : summary?.windows.last1h ?? 0}
          helper="适合观察近期波峰与后台任务"
          icon={<Clock3 className="h-5 w-5" />}
        />
        <SummaryCard
          title="最近 24 小时"
          value={loadingSummary && !summary ? '...' : summary?.windows.last24h ?? 0}
          helper="用于日级监控和复盘"
          icon={<Database className="h-5 w-5" />}
        />
        <SummaryCard
          title="最近一次调用"
          value={loadingSummary && !summary ? '...' : formatDateTime(summary?.latestCalledAt || null)}
          helper="轮询每 8 秒自动刷新一次"
          icon={<TerminalSquare className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">实时分布</h2>
              <p className="mt-1 text-sm text-slate-500">查看最近一段时间最常被调用的工具、量表和入口。</p>
            </div>
            {loadingSummary ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
          </div>

          <div className="space-y-5">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Top Actions</p>
              <div className="flex flex-wrap gap-2">
                {(summary?.topActions || []).map((item) => (
                  <span key={item.name} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {item.name} · {item.count}
                  </span>
                ))}
                {!summary?.topActions?.length ? <span className="text-sm text-slate-400">暂无记录</span> : null}
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Top Scales</p>
              <div className="flex flex-wrap gap-2">
                {(summary?.topScales || []).map((item) => (
                  <span key={item.name} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    {item.name} · {item.count}
                  </span>
                ))}
                {!summary?.topScales?.length ? <span className="text-sm text-slate-400">暂无量表维度记录</span> : null}
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Top Entrypoints</p>
              <div className="flex flex-wrap gap-2">
                {(summary?.topEntrypoints || []).map((item) => (
                  <span key={item.key} className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-medium text-cyan-700">
                    {item.label} · {item.count}
                  </span>
                ))}
                {!summary?.topEntrypoints?.length ? <span className="text-sm text-slate-400">暂无入口维度记录</span> : null}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">最近调用</h2>
              <p className="mt-1 text-sm text-slate-500">这个列表跟着实时概览一起刷新，适合快速查看当前有没有流量。</p>
            </div>
            {loadingSummary ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
          </div>

          <div className="space-y-3">
            {(summary?.recentCalls || []).map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-900">{item.action}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {item.entrypointLabel}
                      {item.scaleId ? ` · ${item.scaleId}` : ''}
                    </div>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <div>{item.apiKeyName || item.clientId}</div>
                    <div>{formatDateTime(item.createdAt)}</div>
                  </div>
                </div>
              </div>
            ))}
            {!summary?.recentCalls?.length ? <div className="text-sm text-slate-400">暂无最近调用</div> : null}
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">历史调用记录</h2>
            <p className="mt-1 text-sm text-slate-500">支持按入口、动作、量表、客户端密钥和时间范围筛选。</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="text-sm text-slate-600">
              <span className="mb-1 block">入口</span>
              <select
                value={filters.entrypoint}
                onChange={(event) => setFilters((prev) => ({ ...prev, entrypoint: event.target.value, page: 1 }))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-cyan-400"
              >
                {entrypointOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-600">
              <span className="mb-1 block">动作</span>
              <Input
                value={filters.action}
                onChange={(event) => setFilters((prev) => ({ ...prev, action: event.target.value, page: 1 }))}
                placeholder="如 create_assessment_session"
              />
            </label>

            <label className="text-sm text-slate-600">
              <span className="mb-1 block">量表</span>
              <Input
                value={filters.scaleId}
                onChange={(event) => setFilters((prev) => ({ ...prev, scaleId: event.target.value, page: 1 }))}
                placeholder="如 GAD-7"
              />
            </label>

            <label className="text-sm text-slate-600">
              <span className="mb-1 block">客户端</span>
              <Input
                value={filters.clientId}
                onChange={(event) => setFilters((prev) => ({ ...prev, clientId: event.target.value, page: 1 }))}
                placeholder="密钥 ID 或片段"
              />
            </label>

            <label className="text-sm text-slate-600">
              <span className="mb-1 block">时间范围</span>
              <select
                value={filters.timeRange}
                onChange={(event) => setFilters((prev) => ({ ...prev, timeRange: event.target.value, page: 1 }))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-cyan-400"
              >
                <option value="5m">最近 5 分钟</option>
                <option value="1h">最近 1 小时</option>
                <option value="24h">最近 24 小时</option>
                <option value="7d">最近 7 天</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          <Filter className="h-4 w-4" />
          <span>
            当前共 {logs?.pagination.total ?? 0} 条记录，正在查看第 {logs?.pagination.page ?? 1} / {logs?.pagination.totalPages ?? 1} 页。
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">时间</th>
                <th className="px-4 py-3 font-medium">入口</th>
                <th className="px-4 py-3 font-medium">动作</th>
                <th className="px-4 py-3 font-medium">量表</th>
                <th className="px-4 py-3 font-medium">客户端</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loadingLogs ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>正在加载历史调用...</span>
                    </div>
                  </td>
                </tr>
              ) : logs?.items.length ? (
                logs.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 text-slate-600">{formatDateTime(item.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-700">{item.entrypointLabel}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700">{item.action}</td>
                    <td className="px-4 py-3 text-slate-600">{item.scaleId || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{item.apiKeyName || item.clientId}</div>
                      {item.apiKeyProvider ? <div className="text-xs text-slate-400">{item.apiKeyProvider}</div> : null}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                    当前筛选条件下没有 MCP 调用记录。
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={() => setFilters((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
            disabled={(logs?.pagination.page || 1) <= 1}
          >
            上一页
          </Button>

          <div className="text-sm text-slate-500">
            第 {logs?.pagination.page || 1} / {logs?.pagination.totalPages || 1} 页
          </div>

          <Button
            variant="outline"
            onClick={() =>
              setFilters((prev) => ({
                ...prev,
                page: Math.min(logs?.pagination.totalPages || 1, prev.page + 1),
              }))
            }
            disabled={(logs?.pagination.page || 1) >= (logs?.pagination.totalPages || 1)}
          >
            下一页
          </Button>
        </div>
      </Card>
    </div>
  );
}
