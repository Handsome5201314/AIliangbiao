import React, { useEffect, useState } from 'react';
import { ArrowLeft, Bot, Send, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DISCLAIMER,
  getQuestionExplanation,
} from '@/services/aiExplanationService';

interface AiAssistantFullProps {
  open: boolean;
  onClose: () => void;
  questionText: string;
  questionId: string;
  scaleId: string;
}

interface Message {
  id: string;
  role: 'ai' | 'user';
  text: string;
}

const AiAssistantFull: React.FC<AiAssistantFullProps> = ({
  open,
  onClose,
  questionText,
  questionId,
  scaleId,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setMessages([]);

    getQuestionExplanation({
      scaleId,
      questionId,
      questionText,
      options: [],
      mode: 'parent_self',
    }).then((result) => {
      if (!cancelled) {
        setMessages([
          {
            id: 'initial',
            role: 'ai',
            text: result.explanation,
          },
        ]);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [questionId, open, scaleId]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    // Prototype only: add user message, no real chat logic
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: 'user',
        text: inputValue.trim(),
      },
    ]);
    setInputValue('');
  };

  if (!open) return null;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 bg-white',
        'max-w-[480px] mx-auto',
        'flex flex-col',
      )}
      data-component="ai-full"
    >
      {/* Header */}
      <div className="flex items-center px-5 py-4 border-b border-cream-200 flex-shrink-0">
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-cream-100 transition-colors mr-3"
          aria-label="返回"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-base font-medium text-foreground">AI 助手</h1>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {loading ? (
          <div className="space-y-3">
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-4/5" />
            <div className="skeleton h-4 w-3/5" />
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'flex',
                msg.role === 'user' ? 'justify-end' : 'justify-start',
              )}
            >
              {msg.role === 'ai' && (
                <div className="w-7 h-7 rounded-full bg-sage-50 flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                  <Bot className="w-4 h-4 text-sage-400" />
                </div>
              )}
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl p-3',
                  msg.role === 'ai'
                    ? 'bg-cream-50 text-foreground'
                    : 'bg-sage-400 text-white',
                )}
              >
                <p className="text-base leading-relaxed whitespace-pre-line">
                  {msg.text}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer disclaimer */}
      <div className="flex-shrink-0 px-5 py-2 border-t border-cream-200 bg-cream-50">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-muted flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted leading-relaxed">{DISCLAIMER}</p>
        </div>
      </div>

      {/* Input bar */}
      <div className="flex-shrink-0 flex items-center gap-2 px-4 py-3 border-t border-cream-200 bg-white">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          placeholder="输入问题..."
          className={cn(
            'flex-1 bg-cream-100 rounded-pill px-4 py-2',
            'text-base text-foreground placeholder:text-muted',
            'outline-none focus:ring-2 focus:ring-sage-400/40',
            'transition-shadow',
          )}
        />
        <button
          onClick={handleSend}
          className={cn(
            'w-10 h-10 flex items-center justify-center',
            'rounded-full bg-sage-400 text-white',
            'active:scale-95 transition-transform',
          )}
          aria-label="发送"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default AiAssistantFull;
