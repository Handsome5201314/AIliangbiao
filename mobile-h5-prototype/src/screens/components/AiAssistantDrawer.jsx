import React, { useState, useEffect } from 'react'
import { X, ChevronUp, ChevronDown, MessageCircleQuestion, AlertCircle } from 'lucide-react'
import { getQuickExplanation, DISCLAIMER } from '../../services/aiExplanationService'
import { Button } from '@/components/ui/button'

export default function AiAssistantDrawer({
  open,
  onClose,
  onExpand,
  questionNumber,
  questionText,
  questionId,
  explanation,
  loading,
}) {
  const [expanded, setExpanded] = useState(false)
  const [quickAnswer, setQuickAnswer] = useState(null)
  const [quickLoading, setQuickLoading] = useState(false)

  useEffect(() => {
    setQuickAnswer(null)
    setExpanded(false)
  }, [questionId])

  const handleQuick = async (type) => {
    setQuickLoading(true)
    try {
      const answer = await getQuickExplanation(questionId, type)
      setQuickAnswer(answer)
    } catch {
      setQuickAnswer('抱歉，暂时无法获取解释，请稍后再试。')
    }
    setQuickLoading(false)
  }

  const quickButtons = [
    { type: 'meaning', label: '这题是什么意思？' },
    { type: 'options', label: '选项怎么理解？' },
    { type: 'example', label: '能举个例子吗？' },
    { type: 'unsure', label: '我不确定怎么选' },
  ]

  if (!open) return null

  const height = expanded ? '85vh' : '50vh'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-50 backdrop-enter"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-card drawer-enter flex flex-col"
        style={{
          height,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-cream-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <MessageCircleQuestion className="w-5 h-5 text-sage-500" />
            <span className="font-semibold text-base text-foreground">
              AI 助手 {questionNumber ? `· 第${questionNumber}题` : ''}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              onClick={() => setExpanded(!expanded)}
              variant="ghost"
              size="icon"
              className="p-2 rounded-full hover:bg-cream-100 transition-smooth"
              aria-label={expanded ? '收起' : '展开'}
            >
              {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </Button>
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
              className="p-2 rounded-full hover:bg-cream-100 transition-smooth"
              aria-label="关闭"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 no-scrollbar">
          {/* Quick question buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            {quickButtons.map(btn => (
              <Button
                key={btn.type}
                onClick={() => handleQuick(btn.type)}
                disabled={quickLoading}
                variant="outline"
                className="px-3 py-2 text-sm rounded-pill border border-cream-300 bg-cream-50 text-foreground hover:bg-sage-50 hover:border-sage-200 transition-smooth min-h-touch"
              >
                {btn.label}
              </Button>
            ))}
          </div>

          {/* Explanation content */}
          {loading && (
            <div className="flex items-center gap-2 py-4">
              <div className="w-5 h-5 border-2 border-sage-300 border-t-sage-500 rounded-full animate-spin" />
              <span className="text-sm text-muted">正在加载解释...</span>
            </div>
          )}

          {!loading && explanation && !quickAnswer && (
            <div className="bg-cream-50 rounded-button p-4 text-base leading-relaxed">
              {explanation}
            </div>
          )}

          {quickAnswer && (
            <div className="bg-cream-50 rounded-button p-4 text-base leading-relaxed animate-fade-in">
              {quickAnswer}
            </div>
          )}

          {quickLoading && !quickAnswer && (
            <div className="flex items-center gap-2 py-4">
              <div className="w-5 h-5 border-2 border-sage-300 border-t-sage-500 rounded-full animate-spin" />
              <span className="text-sm text-muted">正在生成回答...</span>
            </div>
          )}
        </div>

        {/* Disclaimer */}
        <div className="flex-shrink-0 px-4 py-2.5 border-t border-cream-200 bg-cream-50">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-muted flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted leading-relaxed">
              {DISCLAIMER}
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
