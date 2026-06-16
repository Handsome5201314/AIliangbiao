import React from 'react'
import { Plus, User, Check } from 'lucide-react'

export default function ChildrenScreen({ children, selectedChildId, onSelectChild }) {
  return (
    <div className="flex flex-col min-h-full px-4 pt-5 pb-6">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-semibold text-foreground">我的孩子</h1>
        <span className="text-sm text-muted">{children.length} 个孩子</span>
      </div>

      {/* Child cards */}
      <div className="space-y-3 mb-4">
        {children.length === 0 ? (
          <div className="bg-white rounded-card p-8 border border-cream-200 text-center">
            <User className="w-12 h-12 text-cream-400 mx-auto mb-3" />
            <p className="text-base font-medium text-foreground mb-1">还没有添加孩子</p>
            <p className="text-sm text-muted">添加孩子信息后即可开始测评</p>
          </div>
        ) : (
          children.map(child => {
            const isSelected = child.id === selectedChildId
            return (
              <button
                key={child.id}
                onClick={() => onSelectChild(child)}
                className={`
                  w-full p-4 rounded-card border-2 text-left transition-smooth min-h-touch
                  ${isSelected
                    ? 'border-sage-400 bg-sage-50'
                    : 'border-cream-200 bg-white hover:border-sage-200'
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0
                    ${child.gender === 'male' ? 'bg-sky-100' : 'bg-pink-100'}
                  `}>
                    <span className="text-lg font-semibold">
                      {child.gender === 'male' ? '👦' : '👧'}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-semibold text-foreground">{child.name}</span>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-sage-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted mt-0.5">{child.ageLabel} · {child.gender === 'male' ? '男' : '女'}</p>
                    {child.latestAssessment ? (
                      <p className="text-xs text-muted mt-1">
                        最近：{child.latestAssessment.scaleName}
                      </p>
                    ) : (
                      <p className="text-xs text-warm-500 mt-1">暂无测评记录</p>
                    )}
                  </div>

                  {/* Status badge */}
                  {child.latestAssessment && (
                    <span className={`
                      text-xs px-2 py-1 rounded-pill font-medium flex-shrink-0
                      ${child.latestAssessment.riskLevel === 'low'
                        ? 'bg-green-50 text-green-600'
                        : 'bg-yellow-50 text-yellow-700'
                      }
                    `}>
                      {child.latestAssessment.riskLevel === 'low' ? '正常' : '需关注'}
                    </span>
                  )}
                </div>
              </button>
            )
          })
        )}
      </div>

      {/* Add child */}
      <button className="w-full p-4 rounded-card border-2 border-dashed border-cream-300 flex items-center justify-center gap-2 hover:border-sage-300 hover:bg-sage-50 transition-smooth min-h-touch">
        <Plus className="w-5 h-5 text-muted" />
        <span className="text-base text-muted font-medium">添加孩子</span>
      </button>
    </div>
  )
}
