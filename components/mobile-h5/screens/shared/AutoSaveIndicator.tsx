import React from 'react';
import {
  Loader2,
  CheckCircle,
  CloudOff,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/components/mobile-h5/lib/utils';
import type { AutoSaveStatus } from '@/components/mobile-h5/types';

export interface AutoSaveIndicatorProps {
  status: AutoSaveStatus;
}

const statusConfig: Record<
  AutoSaveStatus,
  { icon: React.ReactNode; text: string; className: string }
> = {
  saving: {
    icon: <Loader2 size={14} className="animate-spin" />,
    text: '保存中...',
    className: 'text-muted',
  },
  saved: {
    icon: <CheckCircle size={14} />,
    text: '已保存',
    className: 'text-sage-500',
  },
  'saved-locally': {
    icon: <CloudOff size={14} />,
    text: '本地已暂存',
    className: 'text-warm-500',
  },
  syncing: {
    icon: <RefreshCw size={14} className="animate-spin" />,
    text: '同步中...',
    className: 'text-sky-500',
  },
  failed: {
    icon: <AlertCircle size={14} />,
    text: '保存失败',
    className: 'text-red-400',
  },
};

const AutoSaveIndicator: React.FC<AutoSaveIndicatorProps> = ({ status }) => {
  const config = statusConfig[status];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs',
        config.className,
      )}
    >
      {config.icon}
      {config.text}
    </span>
  );
};

export default AutoSaveIndicator;
