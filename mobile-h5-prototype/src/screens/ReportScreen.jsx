import React, { useState } from 'react'
import {
  ArrowLeft, ChevronDown, ChevronUp, Download, Share2,
  Home, Clock, FileText, Stethoscope, Shield, AlertTriangle,
  Lightbulb, TrendingUp
} from 'lucide-react'
import { Button } from '@/components/ui/button'

function DimensionCard({ dimension }) {
  const [expanded, setExpanded] = useState(false)
  const levelColor = dimension.level === 'low' ? 'bg-green-100 text-green-700' :
    dimension.level === 'moderate' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'
  const levelLabel = dimension.level === 'low' ? '正常' : dimension.level === 'moderate' ? '需关注' : '高风险'
  const pct = Math.round((dimension.score / dimension.maxScore) * 100)

  return (
    <div className="bg-white rounded-card border border-cream-200 overflow-hidden">
      <Button
        onClick={() => setExpanded(!expanded)}
        variant="ghost"
        className="w-full flex items-center justify-between p-4 text-left min-h-touch"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base font-semibold text-foreground">{dimension.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-pill font-medium ${levelColor}`}>
              {levelLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-cream-200 overflow-hidden max-w-[200px]">
              <div
                className={`h-full rounded-full ${
                  dimension.level === 'low' ? 'bg-green-400' :
                  dimension.level === 'moderate' ? 'bg-yellow-400' : 'bg-red-400'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-sm text-muted font-medium">{dimension.score}/{dimension.maxScore}</span>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-muted" /> : <ChevronDown className="w-5 h-5 text-muted" />}
      </Button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-cream-100 pt-3 animate-fade-in">
          <p className="text-sm text-foreground leading-relaxed">{dimension.description}</p>
        </div>
      )}
    </div>
  )
}

export default function ReportScreen({ report, entrySource, onNavigate, onBack }) {
  if (!report) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <FileText className="w-12 h-12 text-cream-400 mb-3" />
        <p className="text-base text-muted">暂无报告数据</p>
      </div>
    )
  }

  const riskColor = report.riskLevel === 'low' ? 'bg-green-50 text-green-700 border-green-200' :
    report.riskLevel === 'moderate' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-red-50 text-red-700 border-red-200'

  const riskBg = report.riskLevel === 'low' ? 'bg-green-400' :
    report.riskLevel === 'moderate' ? 'bg-yellow-400' : 'bg-red-400'

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3">
        <Button onClick={onBack} variant="ghost" size="icon" className="p-2 -ml-2 rounded-full hover:bg-cream-100">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-lg font-semibold text-foreground flex-1">测评报告</h1>
      </div>

      <div className="flex-1 px-4 pb-6 space-y-4 overflow-y-auto no-scrollbar">
        {/* Summary card */}
        <div className={`rounded-card p-5 border ${riskColor}`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-lg font-bold">{report.riskLabel}</span>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              <span className="text-2xl font-bold">{report.totalScore}</span>
              <span className="text-sm opacity-70">/ {report.maxScore}</span>
            </div>
          </div>
          <p className="text-sm leading-relaxed opacity-80">{report.summary}</p>
          <div className="flex items-center gap-4 mt-3 text-xs opacity-60">
            <span>{report.scaleName}</span>
            <span>{report.childName}</span>
            <span>{new Date(report.completedAt).toLocaleDateString('zh-CN')}</span>
          </div>
        </div>

        {/* Dimensions */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">维度详情</h2>
          <div className="space-y-2.5">
            {report.dimensions.map(dim => (
              <DimensionCard key={dim.name} dimension={dim} />
            ))}
          </div>
        </div>

        {/* Recommendations */}
        <div>
          <h2 className="text-lg font-semibold text-foreground mb-3">建议</h2>
          <div className="bg-white rounded-card p-4 border border-cream-200 space-y-3">
            {report.recommendations.map((rec, i) => (
              <div key={i} className="flex gap-2.5">
                <div className="w-7 h-7 rounded-full bg-sage-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i < 3 ? (
                    <Lightbulb className="w-4 h-4 text-sage-600" />
                  ) : (
                    <Stethoscope className="w-4 h-4 text-sage-600" />
                  )}
                </div>
                <p className="text-sm text-foreground leading-relaxed flex-1">{rec}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="bg-cream-50 rounded-card p-4 border border-cream-200">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-muted flex-shrink-0 mt-0.5" />
            <div className="text-xs text-muted leading-relaxed">
              <p className="font-medium mb-1">免责声明</p>
              <p>本测评结果仅供筛查参考，不构成医疗诊断。如孩子存在明显的行为或发展异常，建议及时前往专业医疗机构进行全面评估。测评数据将严格保密。</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom actions - conditional based on entry source */}
      {entrySource === 'just-submitted' ? (
        <div
          className="grid grid-cols-2 gap-2 px-4 py-3 bg-white border-t border-cream-200"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <Button variant="outline" onClick={() => onNavigate('home')} className="text-sm">
            <Home className="w-4 h-4" />
            返回首页
          </Button>
          <Button variant="outline" onClick={() => onNavigate('history')} className="text-sm">
            <Clock className="w-4 h-4" />
            查看历史
          </Button>
          <Button variant="outline" className="text-sm">
            <Download className="w-4 h-4" />
            保存报告
          </Button>
          <Button className="text-sm">
            <Stethoscope className="w-4 h-4" />
            咨询医生
          </Button>
        </div>
      ) : (
        <div
          className="flex items-center gap-3 px-4 py-3 bg-white border-t border-cream-200"
          style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <Button variant="outline" className="flex-1 text-base">
            <Download className="w-4 h-4" />
            保存报告
          </Button>
          <Button className="flex-1 text-base">
            <Share2 className="w-4 h-4" />
            分享
          </Button>
        </div>
      )}
    </div>
  )
}
