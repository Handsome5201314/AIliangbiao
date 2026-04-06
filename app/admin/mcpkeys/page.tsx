'use client';

import { useState, useEffect } from 'react';
import { Key, Plus, Trash2, Copy, CheckCircle, Eye, EyeOff, Code, ExternalLink } from 'lucide-react';

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
    loadKeys();
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
        body: JSON.stringify({ keyName: newKeyName || 'MCP API Key' })
      });

      const data = await res.json();
      if (data.success) {
        setCreatedKey(data.key.keyValue);
        loadKeys();
        setNewKeyName('');
      }
    } catch (error) {
      console.error('Failed to create key:', error);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('确定要删除此密钥吗？删除后无法恢复！')) return;

    try {
      const res = await fetch(`/api/admin/mcpkeys?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setKeys(keys.filter(k => k.id !== id));
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

  const mcpEndpoint = typeof window !== 'undefined' ? `${window.location.origin}/api/mcp/scale` : '';

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">MCP API 密钥管理</h2>
          <p className="text-sm text-slate-500 mt-1">管理量表服务API密钥，供外部智能体调用</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>创建密钥</span>
        </button>
      </div>

      {/* 接入信息卡片 */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
        <h3 className="text-lg font-semibold mb-3">📡 MCP 端点信息</h3>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-indigo-100 mb-1">服务地址</p>
            <code className="bg-white/20 px-4 py-2 rounded-lg block font-mono text-sm">
              {mcpEndpoint}
            </code>
          </div>
          <div>
            <p className="text-sm text-indigo-100 mb-1">认证方式</p>
            <code className="bg-white/20 px-4 py-2 rounded-lg block font-mono text-sm">
              Authorization: Bearer sk-your-api-key
            </code>
          </div>
          <div>
            <p className="text-sm text-indigo-100 mb-1">协议标准</p>
            <code className="bg-white/20 px-4 py-2 rounded-lg block font-mono text-sm">
              MCP JSON-RPC 2.0
            </code>
          </div>
        </div>
      </div>

      {/* 使用说明 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">使用方式</h4>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>点击"创建密钥"生成API密钥</li>
          <li>复制密钥和端点地址</li>
          <li>在智能体平台配置HTTP插件</li>
          <li>调用MCP接口即可使用量表服务</li>
        </ol>
      </div>

      {/* API密钥列表 */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">加载中...</div>
        ) : keys.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>暂无API密钥</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
            >
              创建第一个密钥
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {keys.map((key) => (
              <div key={key.id} className="p-6 hover:bg-slate-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-slate-900">{key.keyName}</h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        key.isActive 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-slate-100 text-slate-800'
                      }`}>
                        {key.isActive ? '启用' : '禁用'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <code className="flex-1 bg-slate-50 px-4 py-2 rounded-lg text-sm font-mono border border-slate-200">
                        {key.keyValue}
                      </code>
                      <button
                        onClick={() => copyToClipboard(key.keyValue)}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title="复制"
                      >
                        {copiedKey === key.keyValue ? (
                          <CheckCircle className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <Copy className="w-5 h-5 text-slate-400" />
                        )}
                      </button>
                    </div>

                    <div className="flex items-center gap-6 text-sm text-slate-500">
                      <span>调用次数：{key.usageCount}</span>
                      {key.lastUsedAt && (
                        <span>最后使用：{new Date(key.lastUsedAt).toLocaleString()}</span>
                      )}
                      <span>创建时间：{new Date(key.createdAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDeleteKey(key.id)}
                    className="ml-4 p-2 hover:bg-red-50 rounded-lg transition-colors text-red-600"
                    title="删除"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 创建密钥弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">创建 MCP API 密钥</h3>
            
            {!createdKey ? (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    密钥名称（可选）
                  </label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="例如：生产环境密钥"
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleCreateKey}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    创建
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4">
                  <p className="text-sm text-emerald-800 font-semibold mb-2">✅ 密钥创建成功！</p>
                  <p className="text-xs text-emerald-700">请立即复制并妥善保管，此密钥只显示一次</p>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    API 密钥
                  </label>
                  <div className="flex gap-2">
                    <code className="flex-1 bg-slate-50 px-4 py-2 rounded-lg text-sm font-mono border border-slate-200 break-all">
                      {createdKey}
                    </code>
                    <button
                      onClick={() => copyToClipboard(createdKey)}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      {copiedKey === createdKey ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Copy className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setCreatedKey(null);
                  }}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  完成
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* 快速接入示例 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Code className="w-5 h-5" />
          快速接入示例
        </h3>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">curl 示例</p>
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs overflow-x-auto">
{`curl -X POST ${mcpEndpoint} \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer sk-your-api-key" \\
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "tools/call",
    "params": {
      "name": "list_scales",
      "arguments": {}
    }
  }'`}
            </pre>
          </div>

          <div className="flex items-center gap-4">
            <a 
              href="/AGENT_SCALE_INTEGRATION_GUIDE.md"
              className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              查看完整接入文档
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
