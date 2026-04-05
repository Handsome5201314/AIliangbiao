/**
 * API Key 上下文 - 管理 API 密钥配置和服务商选择
 * 
 * 功能：
 * 1. 管理 modelProvider（模型服务商）：siliconflow / sophon
 * 2. 管理 apiKey（API 密钥）：sk-...
 * 3. 持久化到 LocalStorage
 * 4. 提供 isConfigured 状态判断
 */

'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

export type ModelProvider = 'siliconflow' | 'sophon';

interface ApiKeyContextType {
  modelProvider: ModelProvider;
  setModelProvider: (provider: ModelProvider) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  isConfigured: boolean;
  showConfigModal: boolean;
  setShowConfigModal: (show: boolean) => void;
}

const ApiKeyContext = createContext<ApiKeyContextType | undefined>(undefined);

const STORAGE_KEY_PROVIDER = 'ai-scale-model-provider';
const STORAGE_KEY_API = 'ai-scale-api-key';

export function ApiKeyProvider({ children }: { children: ReactNode }) {
  const [modelProvider, setModelProviderState] = useState<ModelProvider>('siliconflow');
  const [apiKey, setApiKeyState] = useState<string>('');
  const [showConfigModal, setShowConfigModal] = useState(false);

  // 从 localStorage 加载配置
  useEffect(() => {
    const savedProvider = localStorage.getItem(STORAGE_KEY_PROVIDER) as ModelProvider | null;
    const savedKey = localStorage.getItem(STORAGE_KEY_API);
    
    if (savedProvider && (savedProvider === 'siliconflow' || savedProvider === 'sophon')) {
      setModelProviderState(savedProvider);
    }
    
    if (savedKey) {
      setApiKeyState(savedKey);
    }
  }, []);

  // 设置模型服务商
  const setModelProvider = useCallback((provider: ModelProvider) => {
    setModelProviderState(provider);
    localStorage.setItem(STORAGE_KEY_PROVIDER, provider);
  }, []);

  // 设置 API Key
  const setApiKey = useCallback((key: string) => {
    setApiKeyState(key);
    if (key) {
      localStorage.setItem(STORAGE_KEY_API, key);
    } else {
      localStorage.removeItem(STORAGE_KEY_API);
    }
  }, []);

  // 判断是否已配置（有有效的 apiKey）
  const isConfigured = Boolean(apiKey && apiKey.trim().length > 0);

  return (
    <ApiKeyContext.Provider value={{ 
      modelProvider,
      setModelProvider,
      apiKey, 
      setApiKey, 
      isConfigured, 
      showConfigModal, 
      setShowConfigModal 
    }}>
      {children}
    </ApiKeyContext.Provider>
  );
}

export function useApiKey() {
  const context = useContext(ApiKeyContext);
  if (context === undefined) {
    throw new Error('useApiKey must be used within an ApiKeyProvider');
  }
  return context;
}
