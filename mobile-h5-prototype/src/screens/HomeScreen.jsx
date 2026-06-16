import React from 'react'
import {
  ClipboardList, Users, Clock, MessageCircleQuestion,
  ChevronRight, Baby
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function HomeScreen({
  currentChild,
  recentAssessment,
  onNavigate,
  onSelectChild,
}) {
  const quickActions = [
    { icon: ClipboardList, label: '开始测评', screen: 'scales', color: 'bg-sage-100 text-sage-600' },
    { icon: Users, label: '我的孩子', screen: 'children', color: 'bg-sky-100 text-sky-600' },
    { icon: Clock, label: '测评记录', screen: 'history', color: 'bg-warm-100 text-warm-600' },
    { icon: MessageCircleQuestion, label: 'AI 助手', screen: 'ai-demo', color: 'bg-sage-100 text-sage-500' },
  ]

  return (
    <section data-component="home-screen" className="flex flex-col min-h-full">
      {/* Header */}
      <div
        className="px-4 pt-6 pb-5"
        style={{
          background: 'linear-gradient(135deg, #F0F7F4 0%, #DCEEF8 100%)',
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              你好，{currentChild?.name ? `${currentChild.name}的家长` : '家长'}
            </h1>
            <p className="text-sm text-muted mt-1">关注孩子的成长每一步</p>
          </div>
          <Button
            onClick={() => onNavigate('children')}
            variant="ghost"
            size="icon"
            className="w-11 h-11 rounded-full bg-white/80 flex items-center justify-center shadow-sm"
          >
            <Baby className="w-5 h-5 text-sage-500" />
          </Button>
        </div>

        {/* Continue assessment CTA */}
        {recentAssessment && (
          <Button
            onClick={() => onNavigate('scales')}
            variant="ghost"
            className="w-full bg-white rounded-card p-4 shadow-sm flex items-center justify-between border border-cream-200 hover:border-sage-200 transition-smooth text-left"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-muted">继续测评</p>
              <p className="text-base font-medium text-foreground truncate mt-0.5">
                {recentAssessment.scaleName}
              </p>
              <p className="text-xs text-muted mt-1">上次：{recentAssessment.date}</p>
            </div>
            <ChevronRight className="w-5 h-5 text-muted flex-shrink-0 ml-2" />
          </Button>
        )}
      </div>

      {/* Quick actions */}
      <div className="px-4 py-5">
        <h2 className="text-lg font-semibold text-foreground mb-3">快捷入口</h2>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map(action => {
            const Icon = action.icon
            return (
              <Button
                key={action.screen}
                onClick={() => onNavigate(action.screen)}
                variant="ghost"
                className="flex items-center gap-3 p-4 bg-white rounded-card border border-cream-200 hover:border-sage-200 transition-smooth min-h-touch text-left"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${action.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-base font-medium text-foreground">{action.label}</span>
              </Button>
            )
          })}
        </div>
      </div>

      {/* Recent results */}
      <div className="px-4 pb-6">
        <h2 className="text-lg font-semibold text-foreground mb-3">最近报告</h2>
        {recentAssessment ? (
          <button
            onClick={() => onNavigate('report', { fromHistory: true })}
            className="w-full bg-white rounded-card p-4 border border-cream-200 hover:border-sage-200 transition-smooth text-left"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-base font-medium text-foreground">{recentAssessment.scaleName}</span>
              <span className={`text-xs px-2.5 py-1 rounded-pill font-medium ${
                recentAssessment.riskLevel === 'low'
                  ? 'bg-green-50 text-green-600'
                  : recentAssessment.riskLevel === 'moderate'
                    ? 'bg-yellow-50 text-yellow-700'
                    : 'bg-red-50 text-red-600'
              }`}>
                {recentAssessment.riskLevel === 'low' ? '正常' :
                 recentAssessment.riskLevel === 'moderate' ? '需关注' : '高风险'}
              </span>
            </div>
            <p className="text-sm text-muted">{recentAssessment.date} · {currentChild?.name || '未选择'}</p>
          </button>
        ) : (
          <div className="bg-white rounded-card p-6 border border-cream-200 text-center">
            <ClipboardList className="w-10 h-10 text-cream-400 mx-auto mb-2" />
            <p className="text-sm text-muted">暂无测评记录</p>
            <Button
              onClick={() => onNavigate('scales')}
              variant="ghost"
              size="sm"
              className="mt-3 text-sm text-sage-500 font-medium"
            >
              开始第一次测评 →
            </Button>
          </div>
        )}
      </div>
    </section>
  )
}
