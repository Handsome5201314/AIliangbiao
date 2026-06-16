import React from 'react'
import { ArrowLeft, Clock, Hash, Users, Shield, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AssessmentIntroScreen({
  scale,
  currentChild,
  onStart,
  onBack,
  onSwitchChild,
}) {
  if (!scale) return null

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <Button onClick={onBack} variant="ghost" size="icon" className="p-2 -ml-2 rounded-full hover:bg-cream-100 transition-smooth">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground flex-1 truncate">测评说明</h1>
      </div>

      <div className="flex-1 px-4 pb-6 space-y-4 overflow-y-auto no-scrollbar">
        {/* Child confirmation */}
        <div className="bg-sage-50 rounded-card p-4 border border-sage-200">
          <p className="text-sm text-sage-600 font-medium mb-2">当前测评对象</p>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              currentChild?.gender === 'male' ? 'bg-sky-100' : 'bg-pink-100'
            }`}>
              <span className="text-base">{currentChild?.gender === 'male' ? '👦' : '👧'}</span>
            </div>
            <div className="flex-1">
              <p className="text-base font-semibold text-foreground">{currentChild?.name || '未选择'}</p>
              <p className="text-sm text-muted">{currentChild?.ageLabel} · {currentChild?.gender === 'male' ? '男' : '女'}</p>
            </div>
            <Button
              onClick={onSwitchChild}
              variant="outline"
              size="sm"
              className="flex items-center gap-1.5 text-sm text-sage-600 font-medium px-3 py-1.5 rounded-pill bg-white border border-sage-200"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              切换
            </Button>
          </div>
        </div>

        {/* Scale info */}
        <div className="bg-white rounded-card p-4 border border-cream-200">
          <h2 className="text-lg font-semibold text-foreground mb-2">{scale.name}</h2>
          <p className="text-sm text-foreground leading-relaxed mb-4">{scale.description}</p>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5 text-sm text-muted">
              <Users className="w-4 h-4" />
              <span>{scale.ageRange}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted">
              <Clock className="w-4 h-4" />
              <span>{scale.duration}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-muted">
              <Hash className="w-4 h-4" />
              <span>{scale.questionCount}题</span>
            </div>
          </div>
        </div>

        {/* Privacy disclaimer */}
        <div className="bg-cream-50 rounded-card p-4 border border-cream-200">
          <div className="flex items-start gap-2 mb-2">
            <Shield className="w-5 h-5 text-sage-500 flex-shrink-0 mt-0.5" />
            <h3 className="text-base font-semibold text-foreground">隐私与测评说明</h3>
          </div>
          <ul className="space-y-2 text-sm text-foreground leading-relaxed">
            <li className="flex gap-2">
              <span className="text-sage-500 flex-shrink-0">•</span>
              <span>本测评为筛查辅助工具，不替代专业医生的诊断。</span>
            </li>
            <li className="flex gap-2">
              <span className="text-sage-500 flex-shrink-0">•</span>
              <span>测评结果仅供参考，如有疑虑请及时就医。</span>
            </li>
            <li className="flex gap-2">
              <span className="text-sage-500 flex-shrink-0">•</span>
              <span>您的测评数据将严格保密，仅用于评估目的。</span>
            </li>
            <li className="flex gap-2">
              <span className="text-sage-500 flex-shrink-0">•</span>
              <span>填写过程中可随时暂停，进度会自动保存。</span>
            </li>
          </ul>
        </div>

        {/* Start button */}
        <Button
          onClick={onStart}
          className="w-full h-button font-semibold text-base"
        >
          开始测评
        </Button>
      </div>
    </div>
  )
}
