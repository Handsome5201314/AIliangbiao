/**
 * 对话历史管理 Context
 * 
 * 功能：
 * 1. 管理当前会话的对话历史
 * 2. 与用户画像关联，提供上下文
 * 3. 持久化到LocalStorage
 */

'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// 对话消息类型
interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  scaleId?: string;  // 如果涉及量表
  action?: 'scale_recommend' | 'scale_complete' | 'question' | 'triage' | 'recommend' | 'start_scale' | 'recommendation';
}

// 对话历史Context类型
interface ConversationHistoryContextType {
  messages: ConversationMessage[];
  addMessage: (message: Omit<ConversationMessage, 'id' | 'timestamp'>) => void;
  clearHistory: () => void;
  getContextWindow: (maxLength?: number) => string;
  getRecentTopics: () => string[];
}

const ConversationHistoryContext = createContext<ConversationHistoryContextType | undefined>(undefined);

const STORAGE_KEY = 'ai-scale-conversation-history';
const MAX_HISTORY_LENGTH = 50;  // 最多保存50条对话

export function ConversationHistoryProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  // 从LocalStorage加载历史
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setMessages(parsed);
      } catch (error) {
        console.error('Failed to load conversation history:', error);
      }
    }
  }, []);

  // 保存到LocalStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // 添加新消息
  const addMessage = useCallback((message: Omit<ConversationMessage, 'id' | 'timestamp'>) => {
    const newMessage: ConversationMessage = {
      ...message,
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => {
      const updated = [...prev, newMessage];
      // 限制历史长度
      if (updated.length > MAX_HISTORY_LENGTH) {
        return updated.slice(-MAX_HISTORY_LENGTH);
      }
      return updated;
    });
  }, []);

  // 清空历史
  const clearHistory = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // 获取上下文窗口（用于AI调用）
  const getContextWindow = useCallback((maxLength = 10): string => {
    const recentMessages = messages.slice(-maxLength);
    
    if (recentMessages.length === 0) {
      return '';
    }

    const contextLines = recentMessages.map(msg => {
      const role = msg.role === 'user' ? '用户' : '助手';
      return `[${role}]: ${msg.content}`;
    });

    return `【对话历史】\n${contextLines.join('\n')}`;
  }, [messages]);

  // 获取最近话题
  const getRecentTopics = useCallback((): string[] => {
    const topics: string[] = [];
    
    messages.slice(-10).forEach(msg => {
      if (msg.scaleId) {
        topics.push(msg.scaleId);
      }
      if (msg.action) {
        topics.push(msg.action);
      }
    });

    return [...new Set(topics)];
  }, [messages]);

  return (
    <ConversationHistoryContext.Provider value={{
      messages,
      addMessage,
      clearHistory,
      getContextWindow,
      getRecentTopics
    }}>
      {children}
    </ConversationHistoryContext.Provider>
  );
}

export function useConversationHistory() {
  const context = useContext(ConversationHistoryContext);
  if (!context) {
    throw new Error('useConversationHistory must be used within ConversationHistoryProvider');
  }
  return context;
}
