'use client';

import { useEffect, useState } from 'react';
import { Loader2, RadioTower, Save, Waypoints } from 'lucide-react';

import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type ChannelSurface = 'WEB' | 'DESKTOP' | 'BOT' | 'DEVICE';
type ChannelRolloutStage = 'ACTIVE' | 'PILOT' | 'PLANNED';

type ChannelItem = {
  key: string;
  label: string;
  description: string;
  surface: ChannelSurface;
  authMode: string;
  sessionPath: string;
  webhookPath: string | null;
  enabled: boolean;
  rolloutStage: ChannelRolloutStage;
  notes: string;
};

const SURFACE_BADGE: Record<ChannelSurface, 'default' | 'info' | 'warning' | 'success'> = {
  WEB: 'info',
  DESKTOP: 'default',
  BOT: 'warning',
  DEVICE: 'success',
};

const ROLLOUT_OPTIONS: Array<{ value: ChannelRolloutStage; label: string }> = [
  { value: 'ACTIVE', label: '已上线' },
  { value: 'PILOT', label: '灰度中' },
  { value: 'PLANNED', label: '规划中' },
];

export default function AdminChannelsPage() {
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadChannels();
  }, []);

  const loadChannels = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/channels');
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '加载渠道接入配置失败');
      }

      setChannels(data.channels || []);
    } catch (error) {
      alert(error instanceof Error ? error.message : '加载渠道接入配置失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channels: channels.map((item) => ({
            key: item.key,
            enabled: item.enabled,
            rolloutStage: item.rolloutStage,
            notes: item.notes,
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '保存渠道接入配置失败');
      }

      setChannels(data.channels || []);
      alert('渠道接入配置已保存');
    } catch (error) {
      alert(error instanceof Error ? error.message : '保存渠道接入配置失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="渠道接入"
        description="统一维护 Web/H5、医生工作台、机器人和 AI 玩具入口的启用状态、发布阶段与网关路径。"
      />

      <Card className="border-cyan-200 bg-cyan-50 p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-white p-3 text-cyan-700">
            <Waypoints className="h-5 w-5" />
          </div>
          <div className="space-y-2 text-sm leading-7 text-slate-600">
            <div className="font-semibold text-slate-900">统一平台入口是第一阶段默认策略</div>
            <p>所有外部入口先进入平台后端，再做组织、医生、用户和成员上下文解析，最后转给 Hermes Runtime。</p>
            <p>Webhook 类型渠道会显示固定回调路径，Web/H5 与医生工作台则复用 `/api/agent/session` 这一条会话签发链路。</p>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="p-6">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>正在加载渠道配置...</span>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {channels.map((channel) => (
            <Card key={channel.key} className="p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-slate-900">{channel.label}</h3>
                    <Badge variant={SURFACE_BADGE[channel.surface]}>{channel.surface}</Badge>
                  </div>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{channel.description}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 text-slate-600">
                  <RadioTower className="h-5 w-5" />
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <div className="font-medium text-slate-900">启用状态</div>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={channel.enabled}
                      onChange={(event) =>
                        setChannels((current) =>
                          current.map((item) =>
                            item.key === channel.key ? { ...item, enabled: event.target.checked } : item
                          )
                        )
                      }
                    />
                    <span>{channel.enabled ? '已启用' : '已关闭'}</span>
                  </div>
                </label>

                <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <div className="font-medium text-slate-900">发布阶段</div>
                  <select
                    value={channel.rolloutStage}
                    onChange={(event) =>
                      setChannels((current) =>
                        current.map((item) =>
                          item.key === channel.key
                            ? { ...item, rolloutStage: event.target.value as ChannelRolloutStage }
                            : item
                        )
                      )
                    }
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-cyan-400"
                  >
                    {ROLLOUT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <div className="font-medium text-slate-900">会话签发路径</div>
                  <div className="mt-2 font-mono text-xs text-slate-600">{channel.sessionPath}</div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <div className="font-medium text-slate-900">Webhook</div>
                  <div className="mt-2 font-mono text-xs text-slate-600">
                    {channel.webhookPath || '当前渠道不走 Webhook'}
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="text-sm font-medium text-slate-900">鉴权方式</div>
                <div className="mt-2 text-sm text-slate-600">{channel.authMode}</div>
              </div>

              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">运维备注</label>
                <textarea
                  rows={3}
                  value={channel.notes}
                  onChange={(event) =>
                    setChannels((current) =>
                      current.map((item) =>
                        item.key === channel.key ? { ...item, notes: event.target.value } : item
                      )
                    )
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400"
                  placeholder="例如：等待渠道签名开通、先在某机构灰度、由共享 supervisor 接管。"
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={() => void handleSave()} disabled={saving || loading}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>{saving ? '保存中...' : '保存渠道配置'}</span>
        </Button>
      </div>
    </div>
  );
}
