'use client';

import { useMemo, useState } from 'react';
import { Check, Copy, QrCode } from 'lucide-react';

interface InviteQrCardProps {
  url: string;
  title?: string;
  subtitle?: string;
}

export default function InviteQrCard({
  url,
  title = '扫码填写量表',
  subtitle = '患者可扫码或直接打开链接进入邀填页面。',
}: InviteQrCardProps) {
  const [copied, setCopied] = useState(false);

  const qrImageUrl = useMemo(() => {
    return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(url)}`;
  }, [url]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700">
          <QrCode className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-center">
        <div className="flex h-[240px] w-[240px] items-center justify-center rounded-3xl border border-slate-200 bg-slate-50 p-3">
          <img src={qrImageUrl} alt="Invite QR Code" className="h-full w-full rounded-2xl bg-white object-contain" />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <div className="font-medium text-slate-900">邀请链接</div>
            <div className="mt-1 break-all">{url}</div>
          </div>

          <button
            type="button"
            onClick={() => void copyLink()}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-600"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            <span>{copied ? '已复制链接' : '复制链接'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
