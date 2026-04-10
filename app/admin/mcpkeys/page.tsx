'use client';

import { useEffect, useState } from 'react';
import { CheckCircle, Code, Copy, Key, Plus, Trash2 } from 'lucide-react';

interface MCPKey {
  id: string;
  keyName: string;
  keyValue: string;
  isActive: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
}

export default function MCPKeysPage() {
  const [keys, setKeys] = useState<MCPKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  const handleCreateKey = async () => {
    try {
      const res = await fetch('/api/admin/mcpkeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyName: newKeyName || 'Assessment Core MCP Key' }),
      });

      const data = await res.json();
      if (data.success) {
        setCreatedKey(data.key.keyValue);
        void loadKeys();
        setNewKeyName('');
      }
    } catch (error) {
      console.error('Failed to create key:', error);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('确定要删除此密钥吗？删除后无法恢复。')) return;

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
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const mcpEndpoint = typeof window !== 'undefined' ? `${window.location.origin}/api/mcp` : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">MCP API 密钥管理</h2>
          <p className="mt-1 text-sm text-slate-500">管理外部智能体访问量表服务的服务凭证，不参与任何 AI 模型调用。</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" />
          <span>创建密钥</span>
        </button>
      </div>

      <div className="rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white">
        <h3 className="mb-3 text-lg font-semibold">MCP 端点信息</h3>
        <div className="space-y-3">
          <div>
            <p className="mb-1 text-sm text-indigo-100">正式入口</p>
            <code className="block rounded-lg bg-white/20 px-4 py-2 font-mono text-sm">{mcpEndpoint}</code>
          </div>
          <div>
            <p className="mb-1 text-sm text-indigo-100">认证方式</p>
            <code className="block rounded-lg bg-white/20 px-4 py-2 font-mono text-sm">
              Authorization: Bearer sk-your-api-key
            </code>
          </div>
          <div>
            <p className="mb-1 text-sm text-indigo-100">协议</p>
            <code className="block rounded-lg bg-white/20 px-4 py-2 font-mono text-sm">MCP JSON-RPC 2.0</code>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <h4 className="mb-2 font-semibold text-blue-900">使用方式</h4>
        <ol className="list-inside list-decimal space-y-1 text-sm text-blue-800">
          <li>创建 Assessment Core MCP 密钥。</li>
          <li>将密钥配置到外部智能体平台。</li>
          <li>先用 Bearer 密钥建立 canonical `/api/mcp` 的 SSE 会话，再通过 `X-Session-Id` 发送 JSON-RPC。</li>
          <li>优先参考 assessment-skill README 中的顺序调用说明。</li>
        </ol>
        <p className="mt-3 text-sm text-blue-900">
          这类密钥只负责授权外部智能体访问量表服务，不等同于 OpenAI、DeepSeek、SiliconFlow 等 AI 服务商密钥。
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        {loading ? (
          <div className="p-12 text-center text-slate-500">加载中...</div>
        ) : keys.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Key className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>暂无 API 密钥</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 font-medium text-indigo-600 hover:text-indigo-700"
            >
              创建第一个密钥
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {keys.map((key) => (
              <div key={key.id} className="p-6 transition-colors hover:bg-slate-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <h3 className="font-semibold text-slate-900">{key.keyName}</h3>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          key.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
                        }`}
                      >
                        {key.isActive ? '启用' : '禁用'}
                      </span>
                    </div>

                    <div className="mb-3 flex items-center gap-2">
                      <code className="flex-1 break-all rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-mono">
                        {key.keyValue}
                      </code>
                      <button
                        onClick={() => copyToClipboard(key.keyValue)}
                        className="rounded-lg p-2 transition-colors hover:bg-slate-100"
                        title="复制"
                      >
                        {copiedKey === key.keyValue ? (
                          <CheckCircle className="h-5 w-5 text-emerald-500" />
                        ) : (
                          <Copy className="h-5 w-5 text-slate-400" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-6 text-sm text-slate-500">
                      <span>调用次数：{key.usageCount}</span>
                      {key.lastUsedAt && <span>最后使用：{new Date(key.lastUsedAt).toLocaleString()}</span>}
                      <span>创建时间：{new Date(key.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => void handleDeleteKey(key.id)}
                    className="ml-4 rounded-lg p-2 text-red-600 transition-colors hover:bg-red-50"
                    title="删除"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">创建 Assessment Core MCP 密钥</h3>

            {!createdKey ? (
              <>
                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-slate-700">密钥名称（可选）</label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="例如：生产环境智能体"
                    className="w-full rounded-lg border border-slate-200 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    取消
                  </button>
                  <button
                    onClick={() => void handleCreateKey()}
                    className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
                  >
                    创建
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <p className="mb-2 text-sm font-semibold text-emerald-800">密钥创建成功</p>
                  <p className="text-xs text-emerald-700">请立即复制并妥善保存，此密钥只展示一次。</p>
                </div>

                <div className="mb-4">
                  <label className="mb-2 block text-sm font-medium text-slate-700">API 密钥</label>
                  <div className="flex gap-2">
                    <code className="flex-1 break-all rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-mono">
                      {createdKey}
                    </code>
                    <button
                      onClick={() => copyToClipboard(createdKey)}
                      className="rounded-lg p-2 transition-colors hover:bg-slate-100"
                    >
                      {copiedKey === createdKey ? (
                        <CheckCircle className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <Copy className="h-5 w-5 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setCreatedKey(null);
                  }}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-white transition-colors hover:bg-indigo-700"
                >
                  完成
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900">
          <Code className="h-5 w-5" />
          快速接入示例
        </h3>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">步骤 1：建立带鉴权的 SSE 会话</p>
            <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
{`curl -N ${mcpEndpoint} \\
  -D - \\
  -H "Accept: text/event-stream" \\
  -H "Authorization: Bearer sk-your-api-key"`}
            </pre>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">步骤 2：使用返回的 `X-Session-Id` 发送 JSON-RPC</p>
            <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
{`curl -X POST ${mcpEndpoint} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-your-api-key" \\
  -H "X-Session-Id: <session-id>" \\
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tools/list"
  }'`}
            </pre>
          </div>

          <code className="inline-block rounded bg-slate-100 px-3 py-2 text-xs text-slate-700">
            packages/assessment-skill/README.md
          </code>
        </div>
      </div>
    </div>
  );
}
