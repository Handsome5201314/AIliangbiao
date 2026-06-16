import React, { useState } from 'react'
import { Search, Clock, Hash, Star } from 'lucide-react'

const TABS = [
  { id: 'recommended', label: '推荐量表' },
  { id: 'all', label: '全部量表' },
  { id: 'history', label: '历史做过' },
]

export default function ScalesScreen({ scales, onSelectScale }) {
  const [activeTab, setActiveTab] = useState('recommended')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredScales = scales.filter(s => {
    if (activeTab === 'recommended' && !s.recommended) return false
    if (searchQuery && !s.name.includes(searchQuery) && !s.tags.some(t => t.includes(searchQuery))) return false
    return true
  })

  return (
    <div className="flex flex-col min-h-full">
      {/* Search */}
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-xl font-semibold text-foreground mb-3">选择量表</h1>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索量表名称或标签..."
            className="w-full h-11 pl-10 pr-4 rounded-pill border border-cream-300 bg-white text-base focus:outline-none focus:border-sage-400 transition-smooth"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 pb-3 flex gap-2">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-4 py-2 rounded-pill text-sm font-medium transition-smooth min-h-touch
              ${activeTab === tab.id
                ? 'bg-sage-500 text-white'
                : 'bg-cream-100 text-muted hover:bg-cream-200'
              }
            `}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scale cards */}
      <div className="flex-1 px-4 pb-6 space-y-3">
        {filteredScales.length === 0 ? (
          <div className="bg-white rounded-card p-8 border border-cream-200 text-center mt-8">
            <Search className="w-10 h-10 text-cream-400 mx-auto mb-2" />
            <p className="text-sm text-muted">未找到匹配的量表</p>
          </div>
        ) : (
          filteredScales.map(scale => (
            <button
              key={scale.id}
              onClick={() => onSelectScale(scale)}
              className="w-full bg-white rounded-card p-4 border border-cream-200 hover:border-sage-200 transition-smooth text-left min-h-touch"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {scale.recommended && (
                    <Star className="w-4 h-4 text-warm-400 fill-warm-400" />
                  )}
                  <h3 className="text-base font-semibold text-foreground leading-snug">{scale.shortName}</h3>
                </div>
              </div>
              <p className="text-sm text-foreground mb-2">{scale.name}</p>
              <p className="text-xs text-muted mb-3 leading-relaxed">{scale.description}</p>

              {/* Meta info */}
              <div className="flex items-center flex-wrap gap-2">
                <span className="text-xs px-2.5 py-1 rounded-pill bg-sage-50 text-sage-600 font-medium">
                  {scale.ageRange}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted">
                  <Clock className="w-3 h-3" />
                  {scale.duration}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted">
                  <Hash className="w-3 h-3" />
                  {scale.questionCount}题
                </span>
                {scale.tags.map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-pill bg-cream-100 text-muted">
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
