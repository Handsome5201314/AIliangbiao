import React from 'react';
import { Stethoscope, Plus, Activity, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DoctorStats, DoctorHistoryRecord } from '@/types';

export interface DoctorHomeScreenProps {
  stats: DoctorStats;
  recentHistory: DoctorHistoryRecord[];
  onStartAssessment: () => void;
}

const riskBadgeClass: Record<DoctorHistoryRecord['riskLevel'], string> = {
  low: 'bg-sage-50 text-sage-600',
  moderate: 'bg-warm-50 text-warm-600',
  high: 'bg-red-50 text-red-600',
};

const riskLabel: Record<DoctorHistoryRecord['riskLevel'], string> = {
  low: '低风险',
  moderate: '中风险',
  high: '高风险',
};

const fillModeBadgeClass: Record<DoctorHistoryRecord['fillMode'], string> = {
  doctor_assisted: 'bg-sky-50 text-sky-600',
  caregiver_handoff_locked: 'bg-sage-50 text-sage-600',
};

const fillModeLabel: Record<DoctorHistoryRecord['fillMode'], string> = {
  doctor_assisted: '医生辅助',
  caregiver_handoff_locked: '家长填写',
};

const DoctorHomeScreen: React.FC<DoctorHomeScreenProps> = ({
  stats,
  recentHistory,
  onStartAssessment,
}) => {
  const [loading] = React.useState(false);

  if (loading) {
    return (
      <section data-component="doctor-home" className="px-5 py-5">
        <div className="skeleton h-8 w-32 mb-2" />
        <div className="skeleton h-4 w-48 mb-5" />
        <div className="grid grid-cols-2 gap-3">
          <div className="skeleton h-24 rounded-card" />
          <div className="skeleton h-24 rounded-card" />
        </div>
        <div className="skeleton h-14 rounded-button mt-5" />
      </section>
    );
  }

  const displayRecords = recentHistory.slice(0, 5);

  return (
    <section data-component="doctor-home" className="px-5 py-5">
      {/* Greeting */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-sage-50 flex items-center justify-center">
          <Stethoscope className="w-5 h-5 text-sage-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">张医生</h1>
          <p className="text-sm text-muted">主治医师 · 儿童发育科</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="bg-white rounded-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <Activity className="w-4 h-4 text-sage-400" />
            <span className="text-sm text-muted">今日测评</span>
          </div>
          <span className="text-3xl font-bold text-sage-500">{stats.todayCount}</span>
        </div>
        <div className="bg-white rounded-card p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-4 h-4 text-sage-400" />
            <span className="text-sm text-muted">本月测评</span>
          </div>
          <span className="text-3xl font-bold text-sage-500">{stats.monthCount}</span>
        </div>
      </div>

      {/* Primary action */}
      <button
        onClick={onStartAssessment}
        className={cn(
          'mt-5 w-full h-14 bg-sage-400 text-white rounded-button text-base font-medium',
          'flex items-center justify-center gap-2 active:opacity-90 transition-smooth'
        )}
      >
        <Plus className="w-5 h-5" />
        发起测评
      </button>

      {/* Recent assessments */}
      <div className="mt-6">
        <h2 className="text-base font-semibold text-foreground">最近门诊记录</h2>
        <div className="mt-3 flex flex-col">
          {displayRecords.length === 0 && (
            <p className="text-sm text-muted text-center py-8">暂无门诊记录</p>
          )}
          {displayRecords.map((record) => (
            <div key={record.id} className="bg-white rounded-card p-4 mb-3 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-foreground">{record.patientName}</span>
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-pill',
                    fillModeBadgeClass[record.fillMode]
                  )}
                >
                  {fillModeLabel[record.fillMode]}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted">
                <span>{record.scaleName}</span>
                <span>·</span>
                <span>{record.date}</span>
              </div>
              <div className="mt-2">
                <span
                  className={cn(
                    'inline-block text-xs px-2.5 py-0.5 rounded-pill font-medium',
                    riskBadgeClass[record.riskLevel]
                  )}
                >
                  {riskLabel[record.riskLevel]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default DoctorHomeScreen;
