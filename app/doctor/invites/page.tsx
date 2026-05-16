'use client';

import { useEffect, useMemo, useState } from 'react';
import { ClipboardPlus, Clock3, Link2 } from 'lucide-react';

import InviteQrCard from '@/components/InviteQrCard';
import { useAuthSession } from '@/contexts/AuthSessionContext';
import { resolveLocalizedText } from '@/lib/schemas/core/i18n';
import PageHeader from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DoctorInvitesPage() {
  const { authHeaders } = useAuthSession();
  const [scales, setScales] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [selectedScaleId, setSelectedScaleId] = useState('');
  const [latestInvite, setLatestInvite] = useState<any>(null);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const loadInvites = async () => {
    const response = await fetch('/api/doctor/invites', { headers: authHeaders });
    const data = await response.json();
    setInvites(data.invites || []);
  };

  useEffect(() => {
    fetch('/api/scales')
      .then((res) => res.json())
      .then((data) => {
        setScales(data.scales || []);
        if (data.scales?.length) {
          setSelectedScaleId((current) => current || data.scales[0].id);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    void loadInvites();
  }, [authHeaders]);

  const latestInviteUrl = useMemo(() => {
    if (!latestInvite || typeof window === 'undefined') {
      return '';
    }

    return `${window.location.origin}/invite/${latestInvite.token}`;
  }, [latestInvite]);

  const submitInvite = async () => {
    if (!selectedScaleId) {
      return;
    }

    setLoading(true);
    setStatus('');

    try {
      const response = await fetch('/api/doctor/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({ scaleId: selectedScaleId }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '创建邀请失败');
      }

      setLatestInvite(data.invite);
      setStatus('医生邀填链接已生成，可直接扫码或发送给患者。');
      await loadInvites();
    } catch (error) {
      console.error(error);
      setStatus(error instanceof Error ? error.message : '创建邀请失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="医生邀填" description="选择量表后生成 24 小时有效的邀填链接和二维码，患者扫码即可填写。" />

      <Card className="p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="mb-2 block text-sm font-medium text-slate-700">选择量表</label>
            <select
              value={selectedScaleId}
              onChange={(event) => setSelectedScaleId(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-300"
            >
              {scales.map((scale) => (
                <option key={scale.id} value={scale.id}>
                  {scale.id} · {resolveLocalizedText(scale.title, 'zh')}
                </option>
              ))}
            </select>
          </div>
          <Button
            onClick={() => void submitInvite()}
            disabled={!selectedScaleId || loading}
          >
            <ClipboardPlus className="h-4 w-4" />
            <span>{loading ? '生成中...' : '生成邀填二维码'}</span>
          </Button>
        </div>
        {status && <div className="mt-4 text-sm text-slate-500">{status}</div>}
      </Card>

      {latestInvite && latestInviteUrl && (
        <InviteQrCard
          url={latestInviteUrl}
          title={`${latestInvite.scaleId} 邀填二维码`}
          subtitle={`有效期至 ${new Date(latestInvite.expiresAt).toLocaleString()}`}
        />
      )}

      <Card className="p-6">
        <div className="flex items-center gap-2">
          <Link2 className="h-5 w-5 text-cyan-700" />
          <h2 className="text-lg font-semibold text-slate-900">最近生成</h2>
        </div>
        <div className="mt-4 space-y-3">
          {invites.length ? (
            invites.map((invite) => {
              const inviteUrl =
                typeof window === 'undefined' ? '' : `${window.location.origin}/invite/${invite.token}`;

              return (
                <div key={invite.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="font-semibold text-slate-900">
                        {invite.scale?.id || invite.scaleId} · {invite.scale ? resolveLocalizedText(invite.scale.title, 'zh') : invite.scaleId}
                      </div>
                      <div className="mt-1 text-sm text-slate-500">
                        状态：{invite.status} · 有效至 {new Date(invite.expiresAt).toLocaleString()}
                      </div>
                      {invite.linkedMember && (
                        <div className="mt-1 text-sm text-slate-600">
                          已关联：{invite.linkedMember.realName || invite.linkedMember.nickname}
                          {invite.linkedMember.contactPhone ? ` · ${invite.linkedMember.contactPhone}` : ''}
                        </div>
                      )}
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-slate-700">
                      <Clock3 className="h-4 w-4" />
                      <span>{inviteUrl || '邀请链接生成中'}</span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-sm text-slate-400">还没有生成过邀填链接。</div>
          )}
        </div>
      </Card>
    </div>
  );
}
