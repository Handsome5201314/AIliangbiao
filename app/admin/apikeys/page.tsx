'use client';

import { useState, useEffect } from 'react';
import {
  Key, Plus, Trash2, Eye, EyeOff, Copy, CheckCircle,
  Zap, RefreshCw, Wifi, WifiOff, Clock, AlertCircle,
  Loader2
} from 'lucide-react';

// 支持的AI服务商配置
const PROVIDER_OPTIONS = [
  { value: 'siliconflow', label: '硅基流动 (SiliconFlow)', description: '推荐，新用户送14元' },
  { value: 'sophon', label: '算能 (Sophon)', description: '备选服务商' },
  { value: 'deepseek', label: 'DeepSeek', description: '深度求索，性价比高' },
  { value: 'qwen', label: '通义千问 (Qwen)', description: '阿里云出品' },
  { value: 'openai', label: 'OpenAI', description: '国际领先' },
  { value: 'oneapi', label: 'OneAPI (OpenAI兼容)', description: '支持 OneAPI 网关与 Gemini 系列模型' },
  { value: 'custom', label: '自定义 (OpenAI兼容)', description: '支持OpenAI格式API' }
];

// 默认endpoint配置
const DEFAULT_ENDPOINTS: Record<string, string> = {
  siliconflow: 'https://api.siliconflow.cn/v1/chat/completions',
  sophon: 'https://api.sophon.cn/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  qwen: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
  openai: 'https://api.openai.com/v1/chat/completions',
  oneapi: 'http://104.197.139.51:3000/v1/chat/completions',
  custom: ''
};

interface ApiKeyItem {
  id: string;
  provider: string;
  keyName: string;
  keyValue: string;
  serviceType?: string; // 添加服务类型
  customEndpoint?: string;
  customModel?: string;
  isActive: boolean;
  usageCount: number;
  connectionStatus?: string;
  lastTestedAt?: string | null;
  responseTime?: number | null;
  lastUsedAt: string | null;
  createdAt: string;
  userId?: string | null; // 添加 userId 字段
}

interface ModelOption {
  id: string;
  name: string;
  description: string;
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newKey, setNewKey] = useState({
    provider: 'siliconflow',
    keyName: '',
    keyValue: '',
    customEndpoint: '',
    customModel: '',
    serviceType: 'text' // text 或 speech
  });
  const [isUserManualInput, setIsUserManualInput] = useState(false); // 标记用户是否手动输入了模型
  const [availableModels, setAvailableModels] = useState<ModelOption[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [testingConnection, setTestingConnection] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    loadApiKeys();
  }, []);

  const loadApiKeys = async () => {
    try {
      const res = await fetch('/api/admin/apikeys');
      const data = await res.json();
      setApiKeys(data.keys || []);
    } catch (error) {
      console.error('Failed to load API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  // 当选择服务商或输入 API Key 后，获取模型列表
  const fetchModels = async () => {
    if (!newKey.keyValue) return;

    setLoadingModels(true);
    try {
      const res = await fetch('/api/admin/apikeys/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: newKey.provider,
          endpoint: newKey.customEndpoint || DEFAULT_ENDPOINTS[newKey.provider],
          apiKey: newKey.keyValue,
          serviceType: newKey.serviceType // 传递服务类型
        })
      });

      const data = await res.json();
      if (data.success) {
        setAvailableModels(data.models);
        // ✅ 修复：只有在用户没有手动输入且未选择模型时，才自动选择第一个
        if (data.models.length > 0 && !newKey.customModel && !isUserManualInput) {
          setNewKey(prev => ({ ...prev, customModel: data.models[0].id }));
        }
        // 显示来源提示
        if (data.source === 'fallback') {
          console.log('使用备用模型列表:', data.message);
        }
        if (data.source === 'speech_models') {
          console.log('使用语音模型列表');
        }
      } else {
        alert(data.error || '获取模型列表失败');
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
      alert('获取模型列表失败，请重试');
    } finally {
      setLoadingModels(false);
    }
  };

  // 当 API Key 或服务类型改变时自动获取模型
  useEffect(() => {
    if (newKey.keyValue && newKey.keyValue.length > 10) {
      const timer = setTimeout(() => {
        fetchModels();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [newKey.keyValue, newKey.provider, newKey.serviceType]);

  const handleAddKey = async () => {
    try {
      const res = await fetch('/api/admin/apikeys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: newKey.provider,
          keyName: newKey.keyName,
          keyValue: newKey.keyValue,
          customEndpoint: newKey.provider === 'custom' || newKey.provider === 'oneapi' ? newKey.customEndpoint : null,
          customModel: newKey.customModel || null,
          serviceType: newKey.serviceType // 保存服务类型
        })
      });

      const data = await res.json();
      if (data.success) {
        setApiKeys([...apiKeys, data.key]);
        setShowAddModal(false);
        setNewKey({
          provider: 'siliconflow',
          keyName: '',
          keyValue: '',
          customEndpoint: '',
          customModel: '',
          serviceType: 'text'
        });
        setAvailableModels([]);
        setIsUserManualInput(false); // 重置手动输入标记
      }
    } catch (error) {
      console.error('Failed to add API key:', error);
    }
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm('确定要删除此API密钥吗？')) return;

    try {
      const res = await fetch(`/api/admin/apikeys?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setApiKeys(apiKeys.filter(k => k.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete API key:', error);
    }
  };

  const testConnection = async (key: ApiKeyItem) => {
    setTestingConnection(key.id);
    try {
      const res = await fetch('/api/admin/apikeys/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: key.provider,
          endpoint: key.customEndpoint || DEFAULT_ENDPOINTS[key.provider],
          apiKey: key.keyValue,
          model: key.customModel,
          keyId: key.id,
          serviceType: key.serviceType || 'text' // 传递服务类型，默认为文本
        })
      });

      const data = await res.json();

      if (data.success) {
        alert(`✅ ${data.message}\n响应时间: ${data.responseTime}ms${data.note ? '\n' + data.note : ''}`);
        // 刷新列表以更新状态
        await loadApiKeys();
      } else {
        alert(`❌ ${data.error}\n响应时间: ${data.responseTime}ms`);
      }
    } catch (error) {
      alert('测试失败，请重试');
    } finally {
      setTestingConnection(null);
    }
  };

  const toggleKeyVisibility = (id: string) => {
    const newVisible = new Set(visibleKeys);
    if (newVisible.has(id)) {
      newVisible.delete(id);
    } else {
      newVisible.add(id);
    }
    setVisibleKeys(newVisible);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return '••••••••';
    return key.substring(0, 4) + '••••••••' + key.substring(key.length - 4);
  };

  const getConnectionStatusIcon = (status?: string) => {
    switch (status) {
      case 'online':
        return <Wifi className="w-4 h-4 text-green-500" />;
      case 'offline':
        return <WifiOff className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
  };

  const getConnectionStatusText = (status?: string) => {
    switch (status) {
      case 'online':
        return <span className="text-green-600">在线</span>;
      case 'offline':
        return <span className="text-red-600">离线</span>;
      default:
        return <span className="text-gray-400">未测试</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">API 密钥管理</h2>
          <p className="text-sm text-slate-500 mt-1">仅管理 AI 服务商密钥，用于文本模型与语音识别调用，不包含 MCP 服务凭证。</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>添加密钥</span>
        </button>
      </div>

      {/* 提示信息 */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>💡 功能说明：</strong>
        </p>
        <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
          <li>填写 API Key 后自动获取可用模型列表</li>
          <li>支持自定义接口 URL（OpenAI 兼容格式）</li>
          <li>点击"测速"按钮测试连接状态和响应速度</li>
          <li>系统会自动使用在线的密钥进行 AI 服务调用</li>
        </ul>
      </div>

      {/* API Keys 列表 */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500">
            加载中...
          </div>
        ) : apiKeys.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Key className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>暂无API密钥</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 text-indigo-600 hover:text-indigo-700 font-medium"
            >
              添加第一个密钥
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {apiKeys.map(key => (
              <div key={key.id} className="p-6 hover:bg-slate-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {/* 标题行 */}
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-slate-900">{key.keyName}</h3>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                        {PROVIDER_OPTIONS.find(p => p.value === key.provider)?.label || key.provider}
                      </span>
                      {key.isActive && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          启用
                        </span>
                      )}
                      {key.userId === null && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          系统默认
                        </span>
                      )}
                    </div>

                    {/* 连接状态 */}
                    <div className="flex items-center gap-4 mb-3 text-sm">
                      <div className="flex items-center gap-1.5">
                        {getConnectionStatusIcon(key.connectionStatus)}
                        {getConnectionStatusText(key.connectionStatus)}
                      </div>
                      {key.responseTime && (
                        <div className="flex items-center gap-1 text-slate-600">
                          <Clock className="w-3.5 h-3.5" />
                          {key.responseTime}ms
                        </div>
                      )}
                      {key.lastTestedAt && (
                        <span className="text-xs text-slate-500">
                          测试于 {new Date(key.lastTestedAt).toLocaleString('zh-CN')}
                        </span>
                      )}
                    </div>

                    {/* API Key */}
                    <div className="flex items-center gap-2 mb-3">
                      <code className="flex-1 bg-slate-50 px-4 py-2 rounded-lg text-sm font-mono border border-slate-200">
                        {visibleKeys.has(key.id) ? key.keyValue : maskApiKey(key.keyValue)}
                      </code>
                      <button
                        onClick={() => toggleKeyVisibility(key.id)}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title={visibleKeys.has(key.id) ? '隐藏' : '显示'}
                      >
                        {visibleKeys.has(key.id) ? (
                          <EyeOff className="w-5 h-5 text-slate-400" />
                        ) : (
                          <Eye className="w-5 h-5 text-slate-400" />
                        )}
                      </button>
                      <button
                        onClick={() => copyToClipboard(key.keyValue, key.id)}
                        className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        title="复制"
                      >
                        {copiedKey === key.id ? (
                          <CheckCircle className="w-5 h-5 text-emerald-500" />
                        ) : (
                          <Copy className="w-5 h-5 text-slate-400" />
                        )}
                      </button>
                    </div>

                    {/* 自定义配置 */}
                    {(key.customEndpoint || key.customModel) && (
                      <div className="mb-3 space-y-1 text-sm">
                        {key.customEndpoint && (
                          <div className="text-slate-600">
                            <span className="font-medium">Endpoint:</span>{' '}
                            <code className="bg-slate-50 px-2 py-0.5 rounded text-xs">{key.customEndpoint}</code>
                          </div>
                        )}
                        {key.customModel && (
                          <div className="text-slate-600">
                            <span className="font-medium">Model:</span>{' '}
                            <code className="bg-slate-50 px-2 py-0.5 rounded text-xs">{key.customModel}</code>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => testConnection(key)}
                        disabled={testingConnection === key.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 transition-colors text-sm font-medium disabled:opacity-50"
                      >
                        {testingConnection === key.id ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            测试中...
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4" />
                            测速
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteKey(key.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                      >
                        <Trash2 className="w-4 h-4" />
                        删除
                      </button>
                    </div>

                    {/* 使用统计 */}
                    <div className="flex items-center gap-6 mt-3 text-xs text-slate-500">
                      <span>使用次数：{key.usageCount}</span>
                      {key.lastUsedAt && (
                        <span>最后使用：{key.lastUsedAt}</span>
                      )}
                      <span>创建时间：{key.createdAt}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 添加密钥弹窗 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">添加 API 密钥</h3>

            <div className="space-y-4">
              {/* 服务商选择 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  服务商 <span className="text-red-500">*</span>
                </label>
                <select
                  value={newKey.provider}
                  onChange={(e) => {
                    const provider = e.target.value;
                    setNewKey({
                      ...newKey,
                      provider,
                      customEndpoint: DEFAULT_ENDPOINTS[provider] || '',
                      customModel: ''
                    });
                    setAvailableModels([]);
                  }}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {PROVIDER_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {newKey.provider && (
                  <p className="text-xs text-slate-500 mt-1">
                    {PROVIDER_OPTIONS.find(p => p.value === newKey.provider)?.description}
                  </p>
                )}
              </div>

              {/* 服务类型选择 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  服务类型 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="serviceType"
                      value="text"
                      checked={newKey.serviceType === 'text'}
                      onChange={(e) => {
                        setNewKey({
                          ...newKey,
                          serviceType: e.target.value,
                          customModel: ''
                        });
                        setAvailableModels([]);
                        setIsUserManualInput(false); // 重置手动输入标记
                      }}
                      className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700">文本对话模型</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="serviceType"
                      value="speech"
                      checked={newKey.serviceType === 'speech'}
                      onChange={(e) => {
                        setNewKey({
                          ...newKey,
                          serviceType: e.target.value,
                          customModel: ''
                        });
                        setAvailableModels([]);
                        setIsUserManualInput(false); // 重置手动输入标记
                      }}
                      className="w-4 h-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700">语音识别模型</span>
                  </label>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {newKey.serviceType === 'text' 
                    ? '用于 AI 对话、分诊推荐等功能'
                    : '用于语音识别转文本功能'}
                </p>
              </div>

              {/* 密钥名称 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  密钥名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newKey.keyName}
                  onChange={(e) => setNewKey({ ...newKey, keyName: e.target.value })}
                  placeholder="例如：生产环境密钥"
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* API 密钥 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  API 密钥 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newKey.keyValue}
                  onChange={(e) => setNewKey({ ...newKey, keyValue: e.target.value })}
                  placeholder="sk-..."
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                />
                <p className="text-xs text-slate-500 mt-1">
                  填写 API Key 后将自动获取可用模型列表
                </p>
              </div>

              {/* 自定义接口配置（仅自定义服务商且为文本模型显示） */}
              {(newKey.provider === 'custom' || newKey.provider === 'oneapi') && newKey.serviceType === 'text' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      接口地址 (Endpoint) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newKey.customEndpoint}
                      onChange={(e) => setNewKey({ ...newKey, customEndpoint: e.target.value })}
                      placeholder={newKey.provider === 'oneapi' ? 'http://your-oneapi-host:3000/v1/chat/completions' : 'https://api.example.com/v1/chat/completions'}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      {newKey.provider === 'oneapi'
                        ? 'OneAPI 基地址必须兼容 /v1/chat/completions，模型名需与 OneAPI 后台别名完全一致'
                        : '支持 OpenAI 兼容的 API 格式'}
                    </p>
                  </div>
                </>
              )}

              {/* 语音模型的自定义端点 */}
              {newKey.serviceType === 'speech' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-sm text-blue-800">
                    <strong>💡 提示：</strong>语音识别模型使用标准的 API 端点，无需自定义配置。
                    {newKey.provider === 'siliconflow' && (
                      <span className="block mt-1">端点：https://api.siliconflow.cn/v1/audio/transcriptions</span>
                    )}
                  </p>
                </div>
              )}

              {/* 模型选择 */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  模型
                </label>
                {loadingModels ? (
                  <div className="flex items-center gap-2 text-slate-600 text-sm py-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    正在从官方API获取模型列表...
                  </div>
                ) : availableModels.length > 0 ? (
                  <>
                    {/* 下拉选择 + 手动输入切换 */}
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <select
                          value={isUserManualInput ? '' : newKey.customModel}
                          onChange={(e) => {
                            setIsUserManualInput(false);
                            setNewKey({ ...newKey, customModel: e.target.value });
                          }}
                          className="flex-1 px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          disabled={isUserManualInput}
                        >
                          <option value="">选择模型...</option>
                          {availableModels.map(model => (
                            <option key={model.id} value={model.id}>
                              {model.name} - {model.description}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            if (isUserManualInput) {
                              // 切换回下拉模式
                              setIsUserManualInput(false);
                              setNewKey({ ...newKey, customModel: availableModels[0]?.id || '' });
                            } else {
                              // 切换到手动输入模式
                              setIsUserManualInput(true);
                              setNewKey({ ...newKey, customModel: '' });
                            }
                          }}
                          className="px-3 py-2 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
                        >
                          {isUserManualInput ? '下拉选择' : '手动输入'}
                        </button>
                      </div>
                      
                      {/* 手动输入框 */}
                      {isUserManualInput && (
                        <input
                          type="text"
                          value={newKey.customModel}
                          onChange={(e) => {
                            setNewKey({ ...newKey, customModel: e.target.value });
                          }}
                          placeholder="输入模型名称（如：FunAudioLLM/SenseVoiceSmall）"
                          className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                          autoFocus
                        />
                      )}
                    </div>
                    
                    <p className="text-xs text-green-600 mt-1">
                      ✅ 已获取 {availableModels.length} 个可用模型，也可点击"手动输入"自定义
                    </p>
                  </>
                ) : (
                  <>
                    <input
                      type="text"
                      value={newKey.customModel}
                      onChange={(e) => {
                        setIsUserManualInput(true);
                        setNewKey({ ...newKey, customModel: e.target.value });
                      }}
                      placeholder={newKey.provider === 'custom' || newKey.provider === 'oneapi' ? '输入模型名称' : '将使用默认模型'}
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-sm"
                    />
                    {newKey.keyValue && !loadingModels && (
                      <p className="text-xs text-amber-600 mt-1">
                        ⚠️ 无法获取模型列表，请手动输入
                      </p>
                    )}
                  </>
                )}
              </div>

              {/* 快速测试连接 */}
              {newKey.keyValue && (
                <div className="bg-slate-50 rounded-lg p-4">
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch('/api/admin/apikeys/test', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            provider: newKey.provider,
                            endpoint: newKey.customEndpoint || DEFAULT_ENDPOINTS[newKey.provider],
                            apiKey: newKey.keyValue,
                            model: newKey.customModel,
                            serviceType: newKey.serviceType // 传递服务类型
                          })
                        });
                        const data = await res.json();
                        if (data.success) {
                          alert(`✅ ${data.message}\n响应时间: ${data.responseTime}ms${data.note ? '\n' + data.note : ''}`);
                        } else {
                          alert(`❌ ${data.error}`);
                        }
                      } catch (error) {
                        alert('测试失败');
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Zap className="w-4 h-4" />
                    测试连接
                  </button>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNewKey({
                    provider: 'siliconflow',
                    keyName: '',
                    keyValue: '',
                    customEndpoint: '',
                    customModel: '',
                    serviceType: 'text'
                  });
                  setAvailableModels([]);
                  setIsUserManualInput(false); // 重置手动输入标记
                }}
                className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleAddKey}
                disabled={!newKey.keyName || !newKey.keyValue || ((newKey.provider === 'custom' || newKey.provider === 'oneapi') && !newKey.customEndpoint)}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                添加
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
