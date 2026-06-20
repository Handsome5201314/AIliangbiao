import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { HistoryRecord } from '@/types';

interface HistoryScreenProps {
  history: HistoryRecord[];
  onViewReport: (sessionId: string) => void;
  onBack: () => void;
}

const riskLevelStyles: Record<string, string> = {
  low: 'bg-sage-50 text-sage-600',
  moderate: 'bg-warm-50 text-warm-500',
  high: 'bg-red-100 text-red-600',
};

const statusConfig: Record<string, { style: string; label: string }> = {
  completed: { style: 'bg-sage-50 text-sage-600', label: '已完成' },
  in_progress: { style: 'bg-sky-50 text-sky-500', label: '进行中' },
};

function groupByMonth(records: HistoryRecord[]): Map<string, HistoryRecord[]> {
  const groups = new Map<string, HistoryRecord[]>();
  for (const record of records) {
    const date = new Date(record.completedAt);
    const key = `${date.getFullYear()}年${date.getMonth() + 1}月`;
    const existing = groups.get(key);
    if (existing) {
      existing.push(record);
    } else {
      groups.set(key, [record]);
    }
  }
  return groups;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month}月${day}日 ${hours}:${minutes}`;
}

/* Skeleton placeholder */
const SkeletonCard: React.FC = () => (
  <div className="bg-white rounded-card p-4 mb-3 animate-pulse">
    <div className="flex items-center justify-between">
      <div className="h-4 bg-cream-200 rounded w-32" />
      <div className="h-5 bg-cream-200 rounded-pill w-14" />
    </div>
    <div className="h-3 bg-cream-100 rounded w-48 mt-3" />
    <div className="h-3 bg-cream-100 rounded w-20 mt-2" />
  </div>
);

const HistoryScreen: React.FC<HistoryScreenProps> = ({
  history,
  onViewReport,
  onBack,
}) => {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const groupedHistory = useMemo(() => groupByMonth(history), [history]);

  return (
    <section data-component="history-screen" className="px-5 py-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-11 h-11 flex items-center justify-center rounded-full -ml-2 min-h-touch"
        >
          <ChevronLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-xl font-semibold text-foreground">测评历史</h1>
      </div>

      {/* Loading state */}
      {loading && (
        <div className="mt-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* Content */}
      {!loading && (
        <>
          {history.length > 0 ? (
            Array.from(groupedHistory.entries()).map(([month, records]) => (
              <div key={month}>
                <h2 className="text-sm font-medium text-muted mt-4 mb-2">
                  {month}
                </h2>
                {records.map((record) => {
                  const risk = riskLevelStyles[record.riskLevel];
                  const status = statusConfig[record.status];
                  return (
                    <button
                      key={record.id}
                      onClick={() => onViewReport(record.sessionId)}
                      className="bg-white rounded-card p-4 mb-3 w-full text-left min-h-touch"
                    >
                      {/* Top row */}
                      <div className="flex items-center justify-between">
                        <span className="text-base font-medium text-foreground truncate flex-1">
                          {record.scaleName}
                        </span>
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-pill flex-shrink-0 ml-2',
                            risk
                          )}
                        >
                          {record.riskLabel}
                        </span>
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-2 mt-2 text-sm text-muted">
                        <span>{record.childName}</span>
                        <span>·</span>
                        <span>{formatDate(record.completedAt)}</span>
                      </div>

                      {/* Status */}
                      <div className="mt-2">
                        <span
                          className={cn(
                            'text-xs px-2 py-0.5 rounded-pill',
                            status.style
                          )}
                        >
                          {status.label}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ))
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center justify-center mt-20">
              <div className="w-16 h-16 rounded-full bg-cream-100 flex items-center justify-center mb-4">
                <Clock className="w-8 h-8 text-muted" />
              </div>
              <p className="text-base font-medium text-foreground">
                暂无测评记录
              </p>
              <p className="text-sm text-muted mt-2 text-center">
                完成第一次测评后，结果将显示在这里
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
};

export default HistoryScreen;
