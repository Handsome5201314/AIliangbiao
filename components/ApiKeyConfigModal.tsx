/**
 * API 配置弹窗 - 支持硅基流动和算能服务商选择
 * 
 * 功能：
 * 1. 选择模型服务商（SiliconFlow / Sophon）
 * 2. 输入 API 密钥
 * 3. 保存到 LocalStorage（通过 ApiKeyContext）
 */

'use client';

import { useState, useEffect } from 'react';
import { X, Key, Database } from 'lucide-react';
import { useApiKey, ModelProvider } from '@/contexts/ApiKeyContext';

interface ApiKeyConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ApiKeyConfigModal({ isOpen, onClose }: ApiKeyConfigModalProps) {
  const { modelProvider, setModelProvider, apiKey, setApiKey } = useApiKey();
  const [inputProvider, setInputProvider] = useState<ModelProvider>(modelProvider);
  const [inputKey, setInputKey] = useState(apiKey);

  // 同步 Context 中的值到本地状态
  useEffect(() => {
    setInputProvider(modelProvider);
    setInputKey(apiKey);
  }, [modelProvider, apiKey]);

  if (!isOpen) return null;

  const handleSave = () => {
    // 保存到 Context（自动持久化到 LocalStorage）
    setModelProvider(inputProvider);
    setApiKey(inputKey.trim());
    onClose();
  };

  const handleCancel = () => {
    // 恢复为原始值
    setInputProvider(modelProvider);
    setInputKey(apiKey);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      {/* 黑色模糊遮罩层 */}
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={handleCancel} />
      
      {/* 弹窗主体 */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* 头部 */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-bold text-slate-800">大模型路由配置 (BYOK)</h2>
          </div>
          <button 
            onClick={handleCancel} 
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 表单内容区 */}
        <div className="p-6 space-y-6">
          {/* 模型服务商选择 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              选择模型服务商
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setInputProvider('siliconflow')}
                className={`py-2 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  inputProvider === 'siliconflow' 
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                硅基流动 (SiliconFlow)
              </button>
              <button 
                onClick={() => setInputProvider('sophon')}
                className={`py-2 px-3 rounded-xl border-2 text-sm font-medium transition-all ${
                  inputProvider === 'sophon' 
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                算能 (Sophon)
              </button>
            </div>
          </div>

          {/* API Key 输入框 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              API 密钥 (API Key)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Key className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="password"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="输入您的 sk-... 密钥"
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              您的密钥仅保存在本地浏览器中，绝不会上传至我们的服务器，保障您的隐私安全。
            </p>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
          <button 
            onClick={handleCancel} 
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handleSave} 
            className="px-5 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
          >
            保存配置
          </button>
        </div>

      </div>
    </div>
  );
}
