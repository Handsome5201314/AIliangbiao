import React from 'react';
import {
  ChevronLeft,
  ChevronDown,
  User,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Report, DoctorPatient, Dimension } from '@/types';

export interface DoctorReportScreenProps {
  report: Report;
  patient: DoctorPatient;
  onGoHome: () => void;
  onNewAssessment: () => void;
  onViewDetail: () => void;
}

const riskBadgeClass: Record<Report['riskLevel'], string> = {
  low: 'bg-sage-50 text-sage-600',
  moderate: 'bg-warm-50 text-warm-600',
  high: 'bg-red-50 text-red-600',
};

const dimensionLevelColor: Record<Dimension['level'], string> = {
  low: 'bg-sage-400',
  moderate: 'bg-warm-400',
  high: 'bg-red-500',
};

const DoctorReportScreen: React.FC<DoctorReportScreenProps> = ({
  report,
  patient,
  onGoHome,
  onNewAssessment,
  onViewDetail,
}) => {
  const [dimensionsExpanded, setDimensionsExpanded] = React.useState(true);

  return (
    <section data-component="doctor-report" className="px-5 py-4">
      {/* Header */}
      <h1 className="text-xl font-semibold text-foreground">测评报告</h1>

      {/* Patient info card */}
      <div className="mt-4 bg-white rounded-card p-4 shadow-sm flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-sage-50 flex items-center justify-center flex-shrink-0">
          {patient.avatar ? (
            <span className="text-base">{patient.avatar}</span>
          ) : (
            <User className="w-5 h-5 text-sage-300" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-foreground">{patient.name}</span>
            <span className="text-sm text-muted">
              {patient.ageLabel} · {patient.gender === 'male' ? '男' : '女'}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="bg-sage-50 text-sage-600 text-xs px-2 py-0.5 rounded-pill">
              {report.scaleName}
            </span>
            <span className="text-sm text-muted">{report.completedAt}</span>
          </div>
        </div>
      </div>

      {/* Risk summary */}
      <div className="mt-4 bg-white rounded-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              'inline-block text-sm px-3 py-1 rounded-pill font-medium',
              riskBadgeClass[report.riskLevel]
            )}
          >
            {report.riskLabel}
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-3xl font-bold text-foreground">{report.totalScore}</span>
          <span className="text-base text-muted">/ {report.maxScore}</span>
        </div>
        <p className="mt-2 text-sm text-foreground leading-relaxed">
          {report.summary}
        </p>
      </div>

      {/* Dimensions (collapsible) */}
      <div className="mt-4 bg-white rounded-card shadow-sm overflow-hidden">
        <Button
          variant="ghost"
          onClick={() => setDimensionsExpanded((prev) => !prev)}
          className="w-full px-4 py-3 flex items-center justify-between active:bg-cream-100 transition-smooth"
        >
          <span className="text-sm font-semibold text-foreground">维度详情</span>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-muted transition-transform',
              dimensionsExpanded && 'rotate-180'
            )}
          />
        </Button>
        {dimensionsExpanded && (
          <div className="px-4 pb-4 flex flex-col gap-3">
            {report.dimensions.map((dim, idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-foreground">{dim.name}</span>
                  <span className="text-sm font-medium text-foreground">
                    {dim.score}/{dim.maxScore}
                  </span>
                </div>
                <div className="w-full h-2 bg-cream-200 rounded-pill overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-pill animate-progress',
                      dimensionLevelColor[dim.level]
                    )}
                    style={{
                      '--progress-width': `${(dim.score / dim.maxScore) * 100}%`,
                    } as React.CSSProperties}
                  />
                </div>
                <p className="mt-1 text-xs text-muted">{dim.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommendations */}
      {report.recommendations.length > 0 && (
        <div className="mt-4 bg-white rounded-card p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-foreground mb-2">建议</h3>
          <div className="flex flex-col gap-2">
            {report.recommendations.map((rec, idx) => (
              <div key={idx} className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-sage-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-foreground">{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex flex-col gap-3">
        <Button
          onClick={onGoHome}
          className={cn(
            'w-full h-button bg-sage-400 text-white rounded-button font-medium text-base',
            'active:opacity-90 transition-smooth'
          )}
        >
          返回医生首页
        </Button>
        <Button
          variant="outline"
          onClick={onNewAssessment}
          className={cn(
            'w-full h-button border-2 border-sage-400 text-sage-600 rounded-button font-medium text-base',
            'active:bg-sage-50 transition-smooth'
          )}
        >
          继续发起测评
        </Button>
        <Button
          variant="ghost"
          onClick={onViewDetail}
          className={cn(
            'w-full h-button text-sage-500 rounded-button font-medium text-base',
            'flex items-center justify-center gap-1.5',
            'active:opacity-70 transition-smooth'
          )}
        >
          <FileText className="w-4 h-4" />
          查看详细报告
        </Button>
      </div>
    </section>
  );
};

export default DoctorReportScreen;
