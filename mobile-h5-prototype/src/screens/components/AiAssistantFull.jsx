import React, { useState } from 'react'
import { X, Send, AlertCircle } from 'lucide-react'
import { DISCLAIMER } from '../../services/aiExplanationService'

export default function AiAssistantFull({ open, onClose, questionText }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: questionText
        ? `我是你的 AI 助手，可以帮你理解当前的题目。你现在正在回答：\n\n"${questionText}"\n\n有什么需要我帮忙解释的吗？`
        : '请先进入量表题目页，我才能为你提供题目解释。',
    },
  ])
  const [input, setInput] = useState('')

  if (!open) return null

  const handleSend = () => {
    if (!input.trim()) return
    const userMsg = { role: 'user', content: input.trim() }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    // Mock response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '这道题观察的是孩子在日常生活中的行为表现。请根据孩子最近几周的实际表现来选择最符合的选项。记住，我只能解释题意，不能替你作答。',
      }])
    }, 800)
  }

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-cream-200 flex-shrink-0">
        <span className="font-semibold text-base text-foreground">AI 助手</span>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-cream-100">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 no-scrollbar">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-base leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-sage-500 text-white rounded-br-md'
                  : 'bg-cream-100 text-foreground rounded-bl-md'
              }`}
              style={{ whiteSpace: 'pre-wrap' }}
            >
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      {/* Disclaimer */}
      <div className="px-4 py-1.5 bg-cream-50 border-t border-cream-200 flex-shrink-0">
        <div className="flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 text-muted flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted">{DISCLAIMER}</p>
        </div>
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-cream-200 flex-shrink-0" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          placeholder="输入你的问题..."
          className="flex-1 h-11 px-4 rounded-pill border border-cream-300 text-base bg-white focus:outline-none focus:border-sage-400"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim()}
          className="w-11 h-11 rounded-full bg-sage-500 text-white flex items-center justify-center disabled:opacity-40 hover:bg-sage-600 transition-smooth"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
