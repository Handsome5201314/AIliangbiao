'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Bot, Database, Loader2, Save, Settings, Sparkles } from 'lucide-react';

import PageHeader from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const AGENT_CONFIG_KEY = 'agentWorkspaceConfig';

type SettingsState = {
  siteName: string;
  siteDescription: string;
  defaultDailyLimit: string;
  enableGuestMode: boolean;
  enableAPIKeyManagement: boolean;
  requireLogin: boolean;
  enableNotifications: boolean;
  enableDataExport: boolean;
  agentWorkspaceConfig: string;
};

const DEFAULT_SETTINGS: SettingsState = {
  siteName: 'AI 临床辅助评估系统',
  siteDescription: '基于 MCP 协议与确定性量表引擎的 AI 评估平台',
  defaultDailyLimit: '1',
  enableGuestMode: true,
  enableAPIKeyManagement: true,
  requireLogin: false,
  enableNotifications: true,
  enableDataExport: true,
  agentWorkspaceConfig: '{}',
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsState>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [configError, setConfigError] = useState('');

  useEffect(() => {
    void loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/settings');
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '加载系统设置失败');
      }

      setSettings({
        siteName: data.settings.siteName || DEFAULT_SETTINGS.siteName,
        siteDescription: data.settings.siteDescription || DEFAULT_SETTINGS.siteDescription,
        defaultDailyLimit: data.settings.defaultDailyLimit || DEFAULT_SETTINGS.defaultDailyLimit,
        enableGuestMode: data.settings.enableGuestMode !== 'false',
        enableAPIKeyManagement: data.settings.enableAPIKeyManagement !== 'false',
        requireLogin: data.settings.requireLogin === 'true',
        enableNotifications: data.settings.enableNotifications !== 'false',
        enableDataExport: data.settings.enableDataExport !== 'false',
        agentWorkspaceConfig: data.settings[AGENT_CONFIG_KEY] || DEFAULT_SETTINGS.agentWorkspaceConfig,
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : '加载系统设置失败');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    try {
      JSON.parse(settings.agentWorkspaceConfig);
      setConfigError('');
    } catch (error) {
      setConfigError(error instanceof Error ? error.message : 'Agent JSON 解析失败');
    }
  }, [settings.agentWorkspaceConfig]);

  const parsedAgentConfig = useMemo(() => {
    try {
      return JSON.parse(settings.agentWorkspaceConfig);
    } catch {
      return null;
    }
  }, [settings.agentWorkspaceConfig]);

  const handleSave = async () => {
    if (!parsedAgentConfig) {
      alert('Agent 原始 JSON 当前无法解析，请先修正后再保存。');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            siteName: settings.siteName,
            siteDescription: settings.siteDescription,
            defaultDailyLimit: settings.defaultDailyLimit,
            enableGuestMode: settings.enableGuestMode,
            enableAPIKeyManagement: settings.enableAPIKeyManagement,
            requireLogin: settings.requireLogin,
            enableNotifications: settings.enableNotifications,
            enableDataExport: settings.enableDataExport,
            [AGENT_CONFIG_KEY]: settings.agentWorkspaceConfig,
          },
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '保存系统设置失败');
      }

      alert('系统设置已保存');
      await loadSettings();
    } catch (error) {
      alert(error instanceof Error ? error.message : '保存系统设置失败');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="系统设置" description="这里保留平台级设置与 Agent 原始 JSON 兜底入口。结构化的 Agent 配置管理已经迁移到独立页面。" />

      <Card className="border-cyan-200 bg-cyan-50 p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-white p-3 text-cyan-700">
            <Bot className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900">Agent 配置已迁移到独立后台</h3>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              如果你想像应用配置面板那样选择模型、修改提示词、管理工具风控和 agent 专属配额，请直接前往
              <Link href="/admin/agent" className="mx-1 font-semibold text-cyan-700 underline-offset-4 hover:underline">
                /admin/agent
              </Link>
              。那里配置的是 Agent 的 provider/model 偏好，底层仍然复用“AI 服务商密钥”中的可用系统密钥池；不会直接改 Hermes 容器自己的上游模型配置。本页保留原始 JSON 编辑入口，主要用于排查和紧急兜底。
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Settings className="h-5 w-5 text-slate-600" />
          <h3 className="text-lg font-semibold text-slate-900">基础设置</h3>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>正在加载设置...</span>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">站点名称</label>
              <Input
                value={settings.siteName}
                onChange={(event) => setSettings((prev) => ({ ...prev, siteName: event.target.value }))}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">站点描述</label>
              <textarea
                rows={3}
                value={settings.siteDescription}
                onChange={(event) => setSettings((prev) => ({ ...prev, siteDescription: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">游客默认日额度</label>
              <Input
                type="number"
                value={settings.defaultDailyLimit}
                onChange={(event) => setSettings((prev) => ({ ...prev, defaultDailyLimit: event.target.value }))}
              />
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-cyan-600" />
          <h3 className="text-lg font-semibold text-slate-900">Agent 原始 JSON 兜底入口</h3>
        </div>
        <p className="mb-4 text-sm leading-7 text-slate-500">
          这份 JSON 与 <code>/admin/agent</code> 读写的是同一个 <code>agentWorkspaceConfig</code>。其中模型部分保存的是 Agent 的 provider/model 偏好，不是某条具体 API Key 的绑定关系，也不会直接改 Hermes 容器自己的上游模型配置。正常运营建议用结构化页面，这里保留给高级调试和紧急回滚。
        </p>
        <textarea
          value={settings.agentWorkspaceConfig}
          onChange={(event) => setSettings((prev) => ({ ...prev, agentWorkspaceConfig: event.target.value }))}
          rows={26}
          className="w-full rounded-2xl border border-slate-200 bg-slate-950 px-4 py-4 font-mono text-xs text-slate-100 outline-none focus:border-cyan-400"
        />
        {configError ? (
          <div className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            JSON 校验失败：{configError}
          </div>
        ) : (
          <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            当前 JSON 可以正常解析并保存。
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <Database className="h-5 w-5 text-slate-600" />
          <h3 className="text-lg font-semibold text-slate-900">遗留画像与记忆能力索引</h3>
        </div>

        <div className="space-y-3 text-sm text-slate-600">
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="font-medium text-slate-900">Legacy Profile Context API</div>
            <div className="mt-1">旧的 `/api/profile/context` 与 `lib/services/userContext.ts`，维护 traits / interests / fears / behaviors 这类画像上下文。</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="font-medium text-slate-900">Legacy Memory MCP Skill</div>
            <div className="mt-1">`lib/mcp/skills/memory/handlers.ts` 中仍有一套记忆技能，用于读写用户记忆标签。</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="font-medium text-slate-900">Persona Snapshot v1</div>
            <div className="mt-1">当前对外导出的 Arena / Persona Snapshot 协议，仍然是实际在用的兼容输出。</div>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3">
            <div className="font-medium text-slate-900">Agent Profile State</div>
            <div className="mt-1">新的 `/agent` 活体画像状态层，用于在自主工作台中汇总画像、状态效果和评估历史。</div>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={() => void handleSave()}
          disabled={isSaving || Boolean(configError)}
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>{isSaving ? '保存中...' : '保存设置'}</span>
        </Button>
      </div>
    </div>
  );
}
