'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, Copy, Download, ExternalLink, Link2, QrCode } from 'lucide-react';

import { Button } from '@/components/ui/button';

type ClinicQrListCardProps = {
  pointName: string;
  scaleLabel: string;
  createdAt: string;
  isActive: boolean;
  screeningCount: number;
  url: string;
  onToggle: () => Promise<void> | void;
};

export default function ClinicQrListCard({
  pointName,
  scaleLabel,
  createdAt,
  isActive,
  screeningCount,
  url,
  onToggle,
}: ClinicQrListCardProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const qrImageUrl = useMemo(() => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(url)}`;
  }, [url]);

  const createdAtLabel = useMemo(() => {
    return new Date(createdAt).toLocaleString();
  }, [createdAt]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const downloadQr = async () => {
    setDownloading(true);
    try {
      const response = await fetch(qrImageUrl);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${pointName}-${scaleLabel}-qr.png`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      window.open(qrImageUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-semibold text-slate-900">
              {pointName} · {scaleLabel}
            </div>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                isActive
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-slate-200 text-slate-600'
              }`}
            >
              {isActive ? 'ACTIVE' : 'INACTIVE'}
            </span>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500">
            <span>创建时间：{createdAtLabel}</span>
            <span>提交数：{screeningCount}</span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
            <div className="mb-1 flex items-center gap-2 font-medium text-slate-900">
              <Link2 className="h-4 w-4" />
              <span>公开链接</span>
            </div>
            <div className="break-all">{url}</div>
          </div>

          {!isActive ? (
            <div className="text-xs text-amber-600">
              当前二维码已停用。重新启用后，患者才可以通过该链接访问。
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                <span>打开</span>
              </Link>
            </Button>

            <Button variant="outline" size="sm" onClick={() => void copyLink()}>
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? '已复制' : '复制链接'}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              disabled={downloading}
              onClick={() => void downloadQr()}
            >
              <Download className="h-4 w-4" />
              <span>{downloading ? '下载中...' : '下载二维码'}</span>
            </Button>

            <Button variant="outline" size="sm" onClick={() => void onToggle()}>
              <QrCode className="h-4 w-4" />
              <span>{isActive ? '停用' : '启用'}</span>
            </Button>
          </div>
        </div>

        <div className="flex h-36 w-36 shrink-0 items-center justify-center rounded-3xl border border-slate-200 bg-white p-3">
          <img
            src={qrImageUrl}
            alt={`${pointName} ${scaleLabel} QR`}
            className="h-full w-full rounded-2xl object-contain"
          />
        </div>
      </div>
    </div>
  );
}
