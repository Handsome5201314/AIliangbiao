'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Code, Copy, Key, Plus, Trash2 } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface McpKey {
  id: string;
  keyName: string;
  secretPreview: string | null;
  secretConfigured?: boolean;
  isActive: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getCreateErrorMessage(status: number, data: unknown) {
  if (status === 401) {
    return '管理员登录已失效，请重新登录后再创建 MCP 密钥。';
  }

  if (isRecord(data) && typeof data.message === 'string' && data.message.trim()) {
    return data.message;
  }

  if (isRecord(data) && typeof data.error === 'string' && data.error.trim()) {
    return data.error;
  }

  if (status >= 500) {
    return '创建 MCP 密钥失败，请检查 BUSINESS_SECRET_ENCRYPTION_KEY、数据库迁移和服务器日志。';
  }

  return '创建 MCP 密钥失败，请稍后重试。';
}

export default function MCPKeysPage() {
  const [keys, setKeys] = useState<McpKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    void loadKeys();
  }, []);

  const loadKeys = async () => {
    try {
      const res = await fetch('/api/admin/mcpkeys');
      const data = await res.json();
      setKeys(data.keys || []);
    } catch (error) {
      console.error('Failed to load keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setCreatedKey(null);
    setCreateError(null);
    setShowAddModal(true);
  };

  const closeCreateModal = () => {
    if (creatingKey) {
      return;
    }

    setShowAddModal(false);
    setCreatedKey(null);
    setCreateError(null);
    setNewKeyName('');
  };

  const handleCreateKey = async () => {
    if (creatingKey) {
      return;
    }

    setCreatingKey(true);
    setCreateError(null);

    try {
      const res = await fetch('/api/admin/mcpkeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyName: newKeyName || 'Assessment Core MCP Key' }),
      });

      const data: unknown = await res.json().catch(() => null);
      if (
        res.ok &&
        isRecord(data) &&
        data.success === true &&
        isRecord(data.key) &&
        typeof data.key.keyValue === 'string'
      ) {
        setCreatedKey(data.key.keyValue);
        setCreateError(null);
        setNewKeyName('');
        void loadKeys();
        return;
      }

      setCreateError(getCreateErrorMessage(res.status, data));
    } catch (error) {
      console.error('Failed to create key:', error);
      setCreateError('网络请求失败，请检查登录状态和服务器连接后重试。');
    } finally {
      setCreatingKey(false);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('确定要删除这个 MCP 密钥吗？删除后将无法恢复。')) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/mcpkeys?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setKeys((prev) => prev.filter((key) => key.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete key:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    window.setTimeout(() => setCopiedKey(null), 2000);
  };

  const mcpEndpoint = typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="MCP API 密钥管理" description="管理外部智能体接入 Assessment Core MCP 服务时使用的专用密钥。" />
        <Button onClick={openCreateModal}>
          <Plus className="h-4 w-4" />
          <span>创建密钥</span>
        </Button>
      </div>

      <div className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
        <h3 className="mb-3 text-lg font-semibold">标准 MCP 入口</h3>
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-sm text-indigo-100">Endpoint</p>
            <code className="block rounded-lg bg-white/20 px-4 py-2 font-mono text-sm">
              {mcpEndpoint}
            </code>
          </div>
          <div>
            <p className="mb-1 text-sm text-indigo-100">认证方式</p>
            <code className="block rounded-lg bg-white/20 px-4 py-2 font-mono text-sm">
              Authorization: Bearer sk-your-api-key
            </code>
          </div>
          <div>
            <p className="mb-1 text-sm text-indigo-100">协议</p>
            <code className="block rounded-lg bg-white/20 px-4 py-2 font-mono text-sm">
              streamableHTTP（推荐） / SSE（兼容）
            </code>
          </div>
          <div>
            <p className="mb-1 text-sm text-indigo-100">推荐请求头</p>
            <code className="block rounded-lg bg-white/20 px-4 py-2 font-mono text-sm">
              Accept: application/json, text/event-stream
            </code>
          </div>
        </div>
      </div>

      <Card className="border-cyan-200 bg-cyan-50 p-4">
        <h4 className="mb-2 font-semibold text-cyan-900">使用说明</h4>
        <ol className="list-inside list-decimal space-y-1 text-sm text-cyan-800">
          <li>先创建一个 MCP 密钥。</li>
          <li>把密钥配置到外部智能体平台的 Bearer Token 中。</li>
          <li>外部平台协议优先选择 streamableHTTP；SSE 只作为兼容方案。</li>
          <li>统一使用标准入口 `/api/mcp`，不再使用旧的 FastGPT 专用兼容入口。</li>
          <li>工具调用顺序与规范以 `packages/assessment-skill/README.md` 为准。</li>
        </ol>
        <p className="mt-3 text-sm text-cyan-900">
          这里的 MCP 密钥只用于访问你的量表与 Assessment Core 服务，不等同于 OpenAI、
          DeepSeek、SiliconFlow 等模型服务商的 API Key。
        </p>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">加载中...</div>
        ) : keys.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Key className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>暂无 MCP API 密钥</p>
            <Button variant="link" onClick={openCreateModal} className="mt-4">创建第一个密钥</Button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {keys.map((key) => (
              <div key={key.id} className="p-6 transition-colors hover:bg-slate-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <h3 className="font-semibold text-slate-900">{key.keyName}</h3>
                      <Badge variant={key.isActive ? 'success' : 'secondary'}>{key.isActive ? '启用' : '禁用'}</Badge>
                    </div>

                  <div className="mb-3 flex items-center gap-2">
                      <code className="flex-1 break-all rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-mono">
                        {key.secretPreview || '需要重新创建'}
                      </code>
                    </div>

                    <div className="flex items-center gap-6 text-sm text-slate-500">
                      <span>调用次数：{key.usageCount}</span>
                      {key.lastUsedAt ? (
                        <span>最后使用：{new Date(key.lastUsedAt).toLocaleString()}</span>
                      ) : null}
                      <span>创建时间：{new Date(key.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      列表中显示的是打码后的密钥，只用于核对，不能直接复制去接入外部平台。
                      如需完整密钥，请重新创建一个新密钥，并在创建成功弹窗中一次性复制。
                    </div>
                  </div>

                  <Button variant="ghost" size="icon" className="ml-4 text-rose-600 hover:bg-rose-50" onClick={() => void handleDeleteKey(key.id)} title="删除">
                    <Trash2 className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {showAddModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">
              创建 Assessment Core MCP 密钥
            </h3>

            {!createdKey ? (
              <>
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    密钥名称
                  </label>
                  <Input
                    value={newKeyName}
                    onChange={(e) => {
                      setNewKeyName(e.target.value);
                      setCreateError(null);
                    }}
                    placeholder="例如：生产环境 MCP Key"
                    disabled={creatingKey}
                  />
                </div>

                {createError ? (
                  <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {createError}
                  </div>
                ) : null}

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={closeCreateModal}
                    disabled={creatingKey}
                  >
                    取消
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => void handleCreateKey()}
                    disabled={creatingKey}
                  >
                    {creatingKey ? '创建中...' : '创建'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <p className="mb-2 text-sm font-semibold text-emerald-800">密钥创建成功</p>
                  <p className="text-xs text-emerald-700">
                    请立即复制并妥善保存，这个密钥只会完整展示一次。
                  </p>
                </div>

                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    API 密钥
                  </label>
                  <div className="flex gap-2">
                    <code className="flex-1 break-all rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-mono">
                      {createdKey}
                    </code>
                    <button
                      onClick={() => copyToClipboard(createdKey)}
                      className="rounded-lg p-2 transition-colors hover:bg-slate-100"
                      title="复制"
                    >
                      {copiedKey === createdKey ? (
                        <CheckCircle className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <Copy className="h-5 w-5 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>

                <Button className="w-full" onClick={closeCreateModal}>
                  完成
                </Button>
              </>
            )}
          </Card>
        </div>
      ) : null}

      <Card className="p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Code className="h-5 w-5" />
          快速接入示例
        </h3>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">streamableHTTP JSON-RPC 调用</p>
            <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
{`curl -X POST ${mcpEndpoint} \\
  -H "Authorization: Bearer sk-your-api-key" \\
  -H "Content-Type: application/json" \\
  -H "Accept: application/json, text/event-stream" \\
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tools/list",
    "params": {}
  }'`}
            </pre>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">
              SSE 兼容会话
            </p>
            <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
{`curl -N ${mcpEndpoint} \\
  -D - \\
  -H "Accept: text/event-stream" \\
  -H "Authorization: Bearer sk-your-api-key"`}
            </pre>
          </div>

          <code className="inline-block rounded bg-slate-100 px-3 py-2 text-xs text-slate-700">
            packages/assessment-skill/README.md
          </code>
        </div>
      </Card>
    </div>
  );
}
