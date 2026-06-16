import React from 'react'
import { Loader2, Check, CloudOff, RefreshCw, AlertTriangle } from 'lucide-react'

const statusConfig = {
  saving: {
    icon: Loader2,
    text: '保存中...',
    color: 'text-muted',
    spin: true,
  },
  saved: {
    icon: Check,
    text: '已保存',
    color: 'text-success',
    spin: false,
  },
  'saved-locally': {
    icon: CloudOff,
    text: '已暂存，待同步',
    color: 'text-warning',
    spin: false,
  },
  syncing: {
    icon: RefreshCw,
    text: '同步中...',
    color: 'text-sky-500',
    spin: true,
  },
  failed: {
    icon: AlertTriangle,
    text: '保存失败',
    color: 'text-destructive',
    spin: false,
  },
}

export default function AutoSaveIndicator({ status = 'saved' }) {
  const config = statusConfig[status] || statusConfig.saved
  const Icon = config.icon

  return (
    <div className={`flex items-center gap-1.5 text-xs ${config.color}`}>
      <Icon className={`w-3.5 h-3.5 ${config.spin ? 'animate-spin' : ''}`} />
      <span>{config.text}</span>
    </div>
  )
}
