import React from 'react';
import {
  ChevronLeft,
  CheckCircle,
  Home,
  Clock,
  Stethoscope,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Report as ReportType } from '@/types';

interface ReportScreenProps {
  report: ReportType;
  onGoHome: () => void;
  onViewHistory: () => void;
  onBack: () => void;
  fromHistory: boolean;
}

const riskLevelConfig: Record<
  string,
  { badge: string; barFill: string; label: string }
> = {
  low: {
    badge: 'bg-sage-50 text-sage-600',
    barFill: 'bg-sage-400',
    label: '低风险',
  },
  moderate: {
    badge: 'bg-warm-50 text-warm-500',
    barFill: 'bg-warm-400',
    label: '中等风险',
  },
  high: {
    badge: 'bg-red-100 text-red-600',
    barFill: 'bg-red-400',
    label: '高风险',
  },
};

const ReportScreen: React.FC<ReportScreenProps> = ({
  report,
  onGoHome,
  onViewHistory,
  onBack,
  fromHistory,
}) => {
  const overallRisk = riskLevelConfig[report.riskLevel];

  return (
    <section data-component="report-screen" className="px-5 py-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        {fromHistory && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="w-11 h-11 rounded-full -ml-2 min-h-touch"
          >
            <ChevronLeft className="w-5 h-5 text-foreground" />
          </Button>
        )}
        <h1 className="text-xl font-semibold text-foreground">测评报告</h1>
      </div>

      {/* Conclusion card */}
      <div className="bg-white rounded-card p-5">
        {/* Risk level badge */}
        <span
          className={cn(
            'text-xs px-3 py-1 rounded-pill font-medium',
            overallRisk.badge
          )}
        >
          {report.riskLabel}
        </span>

        {/* Score display */}
        <div className="mt-4">
          <span className="text-3xl font-bold text-foreground">
            {report.totalScore}
          </span>
          <span className="text-lg text-muted ml-1">/ {report.maxScore}</span>
        </div>

        {/* Risk label */}
        <p className="text-lg font-semibold text-foreground mt-2">
          {report.riskLabel}
        </p>

        {/* Summary text */}
        <p className="text-base leading-relaxed text-foreground mt-3">
          {report.summary}
        </p>
      </div>

      {/* Dimensions */}
      {report.dimensions.length > 0 && (
        <div className="mt-4">
          <h2 className="text-base font-semibold text-foreground">
            维度详情
          </h2>
          {report.dimensions.map((dim, idx) => {
            const dimRisk = riskLevelConfig[dim.level];
            const percentage =
              dim.maxScore > 0
                ? Math.round((dim.score / dim.maxScore) * 100)
                : 0;
            return (
              <div key={idx} className="bg-white rounded-card p-4 mt-3">
                <div className="flex items-center justify-between">
                  <span className="text-base font-medium text-foreground">
                    {dim.name}
                  </span>
                  <span
                    className={cn(
                      'text-xs px-2 py-0.5 rounded-pill',
                      dimRisk.badge
                    )}
                  >
                    {dimRisk.label}
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-2 bg-cream-100 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', dimRisk.barFill)}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <p className="text-xs text-muted mt-1.5">
                  {dim.score} / {dim.maxScore}
                </p>

                {/* Description */}
                <p className="text-sm text-muted mt-2">{dim.description}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div className="mt-4">
          <h2 className="text-base font-semibold text-foreground">
            专业建议
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {report.recommendations.map((rec, idx) => (
              <div key={idx} className="flex gap-3">
                <CheckCircle className="w-5 h-5 text-sage-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground leading-relaxed">
                  {rec}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p className="mt-4 text-xs text-muted text-center">
        本报告仅供筛查参考，不作为医学诊断依据。如有疑问请咨询专业医生。
      </p>

      {/* Action buttons */}
      <div className="mt-6 flex flex-col gap-3">
        <Button
          onClick={onGoHome}
          className="w-full h-button rounded-button bg-sage-400 text-white text-base font-medium flex items-center justify-center gap-2 min-h-touch"
        >
          <Home className="w-4 h-4" />
          返回首页
        </Button>

        <Button
          variant="outline"
          onClick={onViewHistory}
          className="w-full h-button rounded-button border-2 border-sage-400 text-sage-500 text-base font-medium flex items-center justify-center gap-2 min-h-touch"
        >
          <Clock className="w-4 h-4" />
          查看历史
        </Button>

        <Button
          className="w-full h-button rounded-button bg-sky-300 text-white text-base font-medium flex items-center justify-center gap-2 min-h-touch"
        >
          <Stethoscope className="w-4 h-4" />
          咨询医生
        </Button>
      </div>
    </section>
  );
};

export default ReportScreen;
