import React from 'react';
import { cn } from '@/components/mobile-h5/lib/utils';

export interface ProgressBarProps {
  current: number;
  total: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ current, total }) => {
  const pct = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="flex items-center gap-3 w-full">
      {/* Bar container */}
      <div className="flex-1 h-2 bg-cream-200 rounded-pill overflow-hidden">
        <div
          className="h-full bg-sage-400 rounded-pill transition-all duration-[400ms] ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Text counter */}
      <span className={cn('text-sm text-muted whitespace-nowrap tabular-nums')}>
        {current}/{total}
      </span>
    </div>
  );
};

export default ProgressBar;
