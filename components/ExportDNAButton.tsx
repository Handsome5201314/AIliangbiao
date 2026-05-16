'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';

import { useAuthSession } from '@/contexts/AuthSessionContext';

interface ExportDNAButtonProps {
  profileId: string;
  className?: string;
  idleLabel?: string;
  exportingLabel?: string;
}

export default function ExportDNAButton({
  profileId,
  className = '',
  idleLabel = '导出人格快照 (Arena DNA)',
  exportingLabel = '正在提取数字基因...',
}: ExportDNAButtonProps) {
  const { authHeaders, isAuthenticated, isPatient } = useAuthSession();
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState('');

  const handleExport = async () => {
    setIsExporting(true);
    setStatus('');

    try {
      const response = await fetch(`/api/partner/v1/profiles/${encodeURIComponent(profileId)}/persona-snapshot`, {
        headers: authHeaders,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '导出失败');
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `Arena_DNA_${data.snapshotId || profileId}.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);

      setStatus('人格快照导出成功');
      setTimeout(() => setStatus(''), 3000);
    } catch (error) {
      console.error('导出人格快照失败:', error);
      setStatus(error instanceof Error ? error.message : '导出失败，请稍后重试');
    } finally {
      setIsExporting(false);
    }
  };

  if (!isAuthenticated || !isPatient) {
    return (
      <div className={className}>
        <a
          href="/auth/login"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
        >
          <Download className="h-4 w-4" />
          <span>登录后导出 Arena DNA</span>
        </a>
      </div>
    );
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void handleExport()}
        disabled={isExporting}
        className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-cyan-600 px-4 py-2 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-cyan-500/30 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-500 ${isExporting ? 'scale-[0.98]' : 'hover:scale-[1.01]'}`}
      >
        {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        <span>{isExporting ? exportingLabel : idleLabel}</span>
      </button>
      {status && <p className="mt-2 text-xs text-slate-500">{status}</p>}
    </div>
  );
}
