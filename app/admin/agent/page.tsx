'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Bot,
  BrainCircuit,
  Database,
  Loader2,
  Mic,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Wand2,
} from 'lucide-react';

import Link from 'next/link';
import { DEFAULT_AGENT_WORKSPACE_CONFIG } from '@/lib/agent/config';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type AgentConfig = typeof DEFAULT_AGENT_WORKSPACE_CONFIG;

type ApiKeyRecord = {
  id: string;
  provider: string;
  keyName: string;
  keyValue: string;
  customEndpoint?: string | null;
  customModel?: string | null;
  serviceType?: string | null;
  isActive: boolean;
  userId?: string | null;
};

type ModelOption = {
  id: string;
  name: string;
  description?: string;
};

const PROVIDER_LABELS: Record<string, string> = {
  siliconflow: 'SiliconFlow',
  openai: 'OpenAI',
  qwen: '通义千问',
  deepseek: 'DeepSeek',
  sophon: 'Sophon',
  oneapi: 'OneAPI',
  custom: '自定义',
};

const PROMPT_FIELDS = [
  ['triageSystemPrompt', '分诊系统提示词'],
  ['bootstrapDoctor', '医生模式欢迎语'],
  ['bootstrapPatient', '患者模式欢迎语'],
  ['followUpUnknown', '目标不明确时的追问'],
  ['assessmentPlan', '量表计划说明'],
  ['exportProfilePlan', '画像导出计划说明'],
  ['doctorInvitePlan', '医生邀填计划说明'],
  ['completedAssessment', '量表完成后的反馈'],
  ['assessmentAdviceSystemZh', 'AI 建议系统提示词（中文）'],
  ['assessmentAdviceSystemEn', 'AI 建议系统提示词（英文）'],
] as const;

const UI_FIELDS = [
  ['workspaceTitle', '工作台标题'],
  ['workspaceDescription', '工作台描述'],
  ['goalPlaceholderDoctor', '医生输入框提示'],
  ['goalPlaceholderPatient', '患者输入框提示'],
  ['planningButtonLabel', '生成计划按钮'],
  ['confirmPlanLabel', '确认执行按钮'],
  ['cancelPlanLabel', '取消计划按钮'],
  ['exportSnapshotLabel', '导出快照按钮'],
] as const;

const VOICE_FIELDS = [
  ['introCallZh', '语音开场白（中文）'],
  ['introCallEn', '语音开场白（英文）'],
  ['voiceSessionPreparingZh', '语音会话准备中（中文）'],
  ['voiceSessionPreparingEn', '语音会话准备中（英文）'],
  ['triageFailedZh', '分诊失败（中文）'],
  ['triageFailedEn', '分诊失败（英文）'],
  ['transcriptionFailedZh', '转写失败（中文）'],
  ['transcriptionFailedEn', '转写失败（英文）'],
] as const;

const PROMPT_FIELD_HELP: Record<string, string> = {
  triageSystemPrompt: '控制分诊模型看到的系统角色与输出边界，是普通用户语音/文字筛查链路的底层提示词。',
  bootstrapDoctor: '医生进入相关智能体链路时的第一句欢迎语。',
  bootstrapPatient: '普通用户进入 /agent 时的第一句欢迎语，极简页默认会优先展示它。',
  followUpUnknown: '当用户表达太模糊时，agent 用这句继续追问。',
  assessmentPlan: 'agent 决定推荐量表时，对用户展示的下一步引导说明。',
  exportProfilePlan: '涉及画像导出时，对用户展示的计划说明。',
  doctorInvitePlan: '医生侧生成邀填时的计划说明。',
  completedAssessment: '量表完成后，对用户展示的结果反馈话术。',
  assessmentAdviceSystemZh: '控制评估结果页在中文界面下生成 AI 建议时的系统提示词和语气。',
  assessmentAdviceSystemEn: 'Controls the system prompt and tone for AI advice on the English assessment result page.',
};

const VOICE_FIELD_HELP: Record<string, string> = {
  introCallZh: '语音模式刚进入时对普通用户播报的第一句中文欢迎语。',
  introCallEn: '语音模式刚进入时对英文用户播报的第一句欢迎语。',
  voiceSessionPreparingZh: '语音链路尚未准备好时的中文提示。',
  voiceSessionPreparingEn: '语音链路尚未准备好时的英文提示。',
  triageFailedZh: '语音筛查失败时的中文提示。',
  triageFailedEn: '语音筛查失败时的英文提示。',
  transcriptionFailedZh: '语音转写失败时的中文提示。',
  transcriptionFailedEn: '语音转写失败时的英文提示。',
};

function deepCloneConfig(config: AgentConfig): AgentConfig {
  return JSON.parse(JSON.stringify(config)) as AgentConfig;
}

function updateAtPath<T extends object>(source: T, path: string, value: unknown): T {
  const next = deepCloneConfig(source as AgentConfig) as Record<string, any>;
  const parts = path.split('.');
  let cursor: Record<string, any> = next;

  for (let index = 0; index < parts.length - 1; index += 1) {
    const key = parts[index];
    cursor[key] = typeof cursor[key] === 'object' && cursor[key] !== null ? { ...cursor[key] } : {};
    cursor = cursor[key];
  }

  cursor[parts[parts.length - 1]] = value;
  return next as T;
}

function formatProvider(provider: string) {
  return PROVIDER_LABELS[provider] || provider;
}

function SectionCard({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="p-6">
      <div className="mb-5 flex items-start gap-4">
        <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">{icon}</div>
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {description ? <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p> : null}
        </div>
      </div>
      {children}
    </Card>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-2 block text-sm font-medium text-slate-700">{children}</label>;
}

export default function AdminAgentPage() {
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_AGENT_WORKSPACE_CONFIG);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [textModels, setTextModels] = useState<ModelOption[]>([]);
  const [speechModels, setSpeechModels] = useState<ModelOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [modelLoading, setModelLoading] = useState<{ text: boolean; speech: boolean }>({
    text: false,
    speech: false,
  });

  const providerOptions = useMemo(() => {
    const providers = new Set<string>([
      config.models.textProvider,
      config.models.speechProvider,
      ...apiKeys
        .filter((item) => item.isActive && !item.userId)
        .map((item) => item.provider),
    ]);

    return Array.from(providers).map((provider) => ({
      value: provider,
      label: formatProvider(provider),
    }));
  }, [apiKeys, config.models.speechProvider, config.models.textProvider]);

  const loadModelsByKeys = useCallback(
    async (
      provider: string,
      serviceType: 'text' | 'speech',
      sourceKeys: ApiKeyRecord[]
    ) => {
      const matchingKey =
        sourceKeys.find(
          (item) =>
            item.provider === provider &&
            item.serviceType === serviceType &&
            item.isActive &&
            !item.userId
        ) || null;

      if (!matchingKey) {
        if (serviceType === 'text') {
          setTextModels([]);
        } else {
          setSpeechModels([]);
        }
        return;
      }

      setModelLoading((prev) => ({ ...prev, [serviceType]: true }));
      try {
        const response = await fetch('/api/admin/apikeys/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            endpoint: matchingKey.customEndpoint || '',
            apiKey: matchingKey.keyValue,
            serviceType,
          }),
        });

        const data = await response.json().catch(() => ({}));
        const models = Array.isArray(data.models) ? data.models : [];

        if (serviceType === 'text') {
          setTextModels(models);
        } else {
          setSpeechModels(models);
        }
      } catch {
        if (serviceType === 'text') {
          setTextModels([]);
        } else {
          setSpeechModels([]);
        }
      } finally {
        setModelLoading((prev) => ({ ...prev, [serviceType]: false }));
      }
    },
    []
  );

  const loadModels = useCallback(
    async (provider: string, serviceType: 'text' | 'speech') => {
      await loadModelsByKeys(provider, serviceType, apiKeys);
    },
    [apiKeys, loadModelsByKeys]
  );

  const loadPage = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [configRes, keysRes] = await Promise.all([
        fetch('/api/admin/agent/config'),
        fetch('/api/admin/apikeys'),
      ]);

      const [configData, keysData] = await Promise.all([
        configRes.json().catch(() => ({})),
        keysRes.json().catch(() => ({})),
      ]);

      if (!configRes.ok) {
        throw new Error(configData.error || '加载 Agent 配置失败');
      }

      if (!keysRes.ok) {
        throw new Error(keysData.error || '加载 AI 密钥失败');
      }

      const nextConfig = (configData.config || DEFAULT_AGENT_WORKSPACE_CONFIG) as AgentConfig;
      const nextKeys = Array.isArray(keysData.keys) ? (keysData.keys as ApiKeyRecord[]) : [];

      setConfig(nextConfig);
      setApiKeys(nextKeys);

      await Promise.all([
        loadModelsByKeys(nextConfig.models.textProvider, 'text', nextKeys),
        loadModelsByKeys(nextConfig.models.speechProvider, 'speech', nextKeys),
      ]);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : '加载 Agent 配置失败');
    } finally {
      setLoading(false);
    }
  }, [loadModelsByKeys]);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  const updateConfig = useCallback((path: string, value: unknown) => {
    setConfig((prev) => updateAtPath(prev, path, value));
    setSaveMessage('');
  }, []);

  const handleProviderChange = useCallback(
    async (serviceType: 'text' | 'speech', provider: string) => {
      updateConfig(`models.${serviceType === 'text' ? 'textProvider' : 'speechProvider'}`, provider);
      await loadModels(provider, serviceType);
    },
    [loadModels, updateConfig]
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveMessage('');

    try {
      const response = await fetch('/api/admin/agent/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '保存 Agent 配置失败');
      }

      setConfig((data.config || config) as AgentConfig);
      setSaveMessage('Agent 配置已保存，新的工作台请求会立即读取最新配置。');
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : '保存 Agent 配置失败');
    } finally {
      setSaving(false);
    }
  }, [config]);

  const toolEntries = useMemo(
    () => Object.entries(config.toolRules.tools || {}),
    [config.toolRules.tools]
  );

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-600 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>正在加载 Agent 配置中心...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.16),_transparent_34%),linear-gradient(135deg,_#ffffff,_#f8fbff_58%,_#eef6ff)] p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/80 px-3 py-1 text-xs font-semibold text-cyan-700">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Agent 配置中心</span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
              管理模型、提示词、工具规则和专属配额
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              这里是独立的 Agent 管理后台，不再和全局系统设置混在一起。你可以单独配置智能体使用的文本模型、语音模型、引导话术、工具风控和游客每日 agent 量表次数。
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:min-w-[320px] lg:items-end">
            <Button
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>{saving ? '保存中...' : '保存 Agent 配置'}</span>
            </Button>
            <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-600">
              MCP 监控已拆到 <Link href="/admin/mcp" className="font-semibold text-cyan-700 underline-offset-4 hover:underline">/admin/mcp</Link>，系统级设置仍保留在 <Link href="/admin/settings" className="font-semibold text-cyan-700 underline-offset-4 hover:underline">/admin/settings</Link>。
            </div>
            {saveMessage ? (
              <div className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700">
                {saveMessage}
              </div>
            ) : null}
            {loadError ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {loadError}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="p-5">
          <div className="text-sm font-semibold text-slate-900">普通用户主链</div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            当前 <code>/agent</code> 面向普通用户极简筛查入口，主要吃 <code>prompts</code> 和 <code>voiceUi</code>，不再依赖前端硬编码业务文案。
          </p>
        </Card>
        <Card className="p-5">
          <div className="text-sm font-semibold text-slate-900">医生侧能力</div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            医生相关复杂能力已经挪回医生工作台。这里保留医生模式欢迎语、医生邀填计划说明等配置，供医生链路继续复用。
          </p>
        </Card>
        <Card className="p-5">
          <div className="text-sm font-semibold text-slate-900">配置思路</div>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            想改"用户看到什么"，优先看 <code>prompts</code> 与 <code>voiceUi</code>；想改"系统怎么做"，优先看 <code>toolRules</code>。
          </p>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <SectionCard
            title="AI 配置"
            description="这里为 Agent 单独选择文本与语音的 provider/model 偏好。AI 服务商密钥负责管理可用密钥池，Agent 配置中心只选择要优先使用的服务商和模型；运行时会从密钥池中挑选同 provider、同 serviceType 的可用系统密钥执行。"
            icon={<BrainCircuit className="h-5 w-5" />}
          >
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <FieldLabel>文本服务商（来自 AI 服务商密钥）</FieldLabel>
                <select
                  value={config.models.textProvider}
                  onChange={(event) => void handleProviderChange('text', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-400"
                >
                  {providerOptions.map((option) => (
                    <option key={`text-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>文本模型（基于所选服务商可用模型）</FieldLabel>
                <div className="space-y-2">
                  <select
                    value={config.models.textModel}
                    onChange={(event) => updateConfig('models.textModel', event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-400"
                  >
                    <option value={config.models.textModel}>{config.models.textModel}</option>
                    {textModels
                      .filter((model) => model.id !== config.models.textModel)
                      .map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                  </select>
                  {modelLoading.text ? <p className="text-xs text-slate-500">正在拉取文本模型列表...</p> : null}
                </div>
              </div>
              <div>
                <FieldLabel>语音服务商（来自 AI 服务商密钥）</FieldLabel>
                <select
                  value={config.models.speechProvider}
                  onChange={(event) => void handleProviderChange('speech', event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-400"
                >
                  {providerOptions.map((option) => (
                    <option key={`speech-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <FieldLabel>语音模型（基于所选服务商可用模型）</FieldLabel>
                <div className="space-y-2">
                  <select
                    value={config.models.speechModel}
                    onChange={(event) => updateConfig('models.speechModel', event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-400"
                  >
                    <option value={config.models.speechModel}>{config.models.speechModel}</option>
                    {speechModels
                      .filter((model) => model.id !== config.models.speechModel)
                      .map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                  </select>
                  {modelLoading.speech ? <p className="text-xs text-slate-500">正在拉取语音模型列表...</p> : null}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-4 text-sm leading-7 text-cyan-900">
              当前采用"按 provider + model"方式运行，而不是绑定某一条具体 API Key。
              Agent 配置中心只保存模型偏好；真正执行时，系统会去 "AI 服务商密钥" 中选择同 provider、同 serviceType 的可用系统密钥。
              如果当前没有匹配的可用密钥，且允许回退，则会使用系统默认可用模型。
            </div>

            <label className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(config.models.allowFallbackToSystemDefault)}
                onChange={(event) => updateConfig('models.allowFallbackToSystemDefault', event.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-cyan-600"
              />
              <span>当 Agent 选择的 provider/model 当前不可用时，回退到系统默认可用模型</span>
            </label>
          </SectionCard>

          <SectionCard
            title="提示词与引导文案"
            description="这里控制 agent 的系统提示词、计划说明和主要引导话术。修改后新的 /agent 与语音入口会直接读取最新内容。"
            icon={<Wand2 className="h-5 w-5" />}
          >
            <div className="space-y-5">
              {PROMPT_FIELDS.map(([field, label]) => (
                <div key={field}>
                  <FieldLabel>{label}</FieldLabel>
                  {PROMPT_FIELD_HELP[field] ? (
                    <p className="mb-2 text-xs leading-6 text-slate-500">{PROMPT_FIELD_HELP[field]}</p>
                  ) : null}
                  <textarea
                    value={String(config.prompts[field] || '')}
                    onChange={(event) => updateConfig(`prompts.${field}`, event.target.value)}
                    rows={field === 'triageSystemPrompt' ? 10 : 4}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 outline-none focus:border-cyan-400"
                  />
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="工具与执行规则"
            description={'第一版自主工作台采用"建议 → 确认 → 自动执行"。你可以在这里控制每个工具的风险等级、执行前确认，以及给计划器展示的步骤摘要模板。'}
            icon={<ShieldCheck className="h-5 w-5" />}
          >
            <div className="space-y-4">
              {toolEntries.map(([toolId, toolConfig]) => (
                <div key={toolId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="lg:max-w-[280px]">
                      <div className="font-mono text-xs text-slate-500">{toolId}</div>
                      <div className="mt-1 text-sm text-slate-700">
                        {toolId.includes('doctor')
                          ? '医生专属工具'
                          : toolId.includes('profile')
                            ? '画像相关工具'
                            : toolId.includes('assessment')
                              ? '量表相关工具'
                              : '上下文工具'}
                      </div>
                    </div>

                    <div className="grid flex-1 gap-4 md:grid-cols-[minmax(0,1fr)_180px_180px]">
                      <div>
                        <FieldLabel>计划摘要模板</FieldLabel>
                        <Input
                          value={String(toolConfig.summaryTemplate || '')}
                          onChange={(event) => updateConfig(`toolRules.tools.${toolId}.summaryTemplate`, event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-400"
                        />
                      </div>

                      <div>
                        <FieldLabel>风险等级</FieldLabel>
                        <select
                          value={String(toolConfig.riskLevel || 'low')}
                          onChange={(event) => updateConfig(`toolRules.tools.${toolId}.riskLevel`, event.target.value)}
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-cyan-400"
                        >
                          <option value="low">低风险</option>
                          <option value="medium">中风险</option>
                          <option value="high">高风险</option>
                        </select>
                      </div>

                      <div>
                        <FieldLabel>执行前确认</FieldLabel>
                        <label className="flex h-[46px] items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            checked={Boolean(toolConfig.confirmBeforeExecute)}
                            onChange={(event) =>
                              updateConfig(`toolRules.tools.${toolId}.confirmBeforeExecute`, event.target.checked)
                            }
                            className="h-4 w-4 rounded border-slate-300 text-cyan-600"
                          />
                          <span>需要确认</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard
            title="工作台文案"
            description="控制 /agent 页面上的标题、描述、输入框提示和主要操作按钮。"
            icon={<Bot className="h-5 w-5" />}
          >
            <div className="space-y-4">
              {UI_FIELDS.map(([field, label]) => (
                <div key={field}>
                  <FieldLabel>{label}</FieldLabel>
                  {field.includes('Description') ? (
                    <textarea
                      value={String(config.ui[field] || '')}
                      onChange={(event) => updateConfig(`ui.${field}`, event.target.value)}
                      rows={4}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none focus:border-cyan-400"
                    />
                  ) : (
                    <input
                      value={String(config.ui[field] || '')}
                      onChange={(event) => updateConfig(`ui.${field}`, event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400"
                    />
                  )}
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="语音播报与错误提示"
            description="控制录音入口和 voice-intent 的主要状态提示。更细的 phase 文案仍然写在同一份配置里。"
            icon={<Mic className="h-5 w-5" />}
          >
            <div className="space-y-4">
              {VOICE_FIELDS.map(([field, label]) => (
                <div key={field}>
                  <FieldLabel>{label}</FieldLabel>
                  {VOICE_FIELD_HELP[field] ? (
                    <p className="mb-2 text-xs leading-6 text-slate-500">{VOICE_FIELD_HELP[field]}</p>
                  ) : null}
                  <textarea
                    value={String(config.voiceUi[field] || '')}
                    onChange={(event) => updateConfig(`voiceUi.${field}`, event.target.value)}
                    rows={3}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 outline-none focus:border-cyan-400"
                  />
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Agent 专属配额"
            description="这里只限制通过 /agent 启动的新量表会话。普通量表页面不限量，恢复已有 agent 会话也不会重复扣次。"
            icon={<Settings2 className="h-5 w-5" />}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>游客每日 agent 量表次数</FieldLabel>
                <Input
                  type="number"
                  value={config.quota.guestAgentDailyLimit}
                  onChange={(event) => updateConfig('quota.guestAgentDailyLimit', Number(event.target.value || 0))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <FieldLabel>注册用户每日 agent 量表次数</FieldLabel>
                <Input
                  type="number"
                  value={config.quota.registeredAgentDailyLimit}
                  onChange={(event) => updateConfig('quota.registeredAgentDailyLimit', Number(event.target.value || 0))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <FieldLabel>VIP 每日 agent 量表次数</FieldLabel>
                <Input
                  type="number"
                  value={config.quota.vipAgentDailyLimit}
                  onChange={(event) => updateConfig('quota.vipAgentDailyLimit', Number(event.target.value || 0))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <FieldLabel>剩余量提醒阈值</FieldLabel>
                <Input
                  type="number"
                  value={config.quota.warnAtRemaining}
                  onChange={(event) => updateConfig('quota.warnAtRemaining', Number(event.target.value || 0))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Legacy 能力说明"
            description="这些能力不会被本次配置直接驱动，但需要在后台看得见，避免后续排查时把遗留能力和主路径混淆。"
            icon={<Database className="h-5 w-5" />}
          >
            <div className="space-y-3">
              {Object.entries(config.legacyFeatures).map(([key, item]) => (
                <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                  <div className="font-medium text-slate-900">{item.title}</div>
                  <div className="mt-1 text-sm leading-6 text-slate-600">{item.description}</div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
