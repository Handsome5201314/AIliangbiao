import React from 'react'

export default function ProgressBar({ current, total }) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-muted">
          第 <span className="text-sage-500 font-semibold text-base">{current}</span> / {total} 题
        </span>
        <span className="text-sm text-muted font-medium">{percentage}%</span>
      </div>
      <div className="w-full h-2 rounded-pill bg-cream-300 overflow-hidden">
        <div
          className="h-full rounded-pill bg-sage-400 progress-bar-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}
