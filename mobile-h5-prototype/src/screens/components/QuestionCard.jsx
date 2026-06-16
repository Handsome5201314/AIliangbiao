import React from 'react'

export default function QuestionCard({ questionNumber, text, animationKey }) {
  return (
    <div
      key={animationKey}
      className="bg-white rounded-card p-5 shadow-sm border border-cream-300 question-enter"
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-sage-100 text-sage-600 text-sm font-semibold">
          {questionNumber}
        </span>
        <span className="text-sm text-muted">请根据孩子近期表现选择</span>
      </div>
      <p className="text-base leading-relaxed text-foreground" style={{ wordBreak: 'break-word' }}>
        {text}
      </p>
    </div>
  )
}
