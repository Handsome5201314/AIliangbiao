'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import {
  Bot,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  MessagesSquare,
  PlugZap,
  QrCode,
  Save,
  ShieldCheck,
  Sparkles,
  TestTube2,
} from 'lucide-react';

import InviteQrCard from '@/components/InviteQrCard';
import { useAuthSession } from '@/contexts/AuthSessionContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type EligibleScale = {
  id: string;
  title: string;
  description: string;
  category: string | null;
  interactionMode: string;
  estimatedMinutes: number | null;
  resultDeliveryMode: string;
};

type RecentSession = {
  id: string;
  visitorSessionId: string;
  chatId: string;
  status: string;
  messageCount: number;
  lastError: string | null;
  lastActiveAt: string;
  member: {
    id: string;
    nickname: string;
    realName: string | null;
    contactPhone: string | null;
  } | null;
};

type DoctorWorkspaceResponse = {
  config: {
    id: string | null;
    assistantName: string;
    avatarUrl: string;
    welcomeMessage: string;
    publicSlug: string;
    fastgptBaseUrl: string;
    fastgptApiKeyConfigured: boolean;
    enabledScaleIds: string[];
    status: 'draft' | 'published' | 'disabled';
    hermesEnabled?: boolean;
    knowledgeMode?: 'platform_proxy' | 'direct_fastgpt';
    lastValidatedAt: string | null;
    validationStatus: string | null;
    lastValidationError: string | null;
    sharePath: string | null;
  };
  doctor: {
    realName: string;
    hospitalName: string;
    departmentName: string;
    title: string;
  };
  eligibleScales: EligibleScale[];
  recentSessions: RecentSession[];
};

type WorkspaceConfigForm = DoctorWorkspaceResponse['config'] & {
  fastgptApiKey: string;
};

function buildInitialForm(data: DoctorWorkspaceResponse['config']): WorkspaceConfigForm {
  return {
    ...data,
    fastgptApiKey: '',
  };
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function DoctorWorkspacePage() {
  const { authHeaders } = useAuthSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [copiedTemplate, setCopiedTemplate] = useState(false);
  const [doctor, setDoctor] = useState<DoctorWorkspaceResponse['doctor'] | null>(null);
  const [eligibleScales, setEligibleScales] = useState<EligibleScale[]>([]);
  const [recentSessions, setRecentSessions] = useState<RecentSession[]>([]);
  const [form, setForm] = useState<WorkspaceConfigForm | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWorkspace() {
      setLoading(true);
      setError('');

      try {
        const response = await fetch('/api/doctor/workspace', { headers: authHeaders });
        const payload = (await response.json().catch(() => ({}))) as Partial<DoctorWorkspaceResponse> & {
          error?: string;
        };

        if (!response.ok || !payload.config || !payload.doctor || !payload.eligibleScales) {
          throw new Error(payload.error || 'Failed to load doctor workspace');
        }

        if (!cancelled) {
          setDoctor(payload.doctor);
          setEligibleScales(payload.eligibleScales);
          setRecentSessions(payload.recentSessions || []);
          setForm(buildInitialForm(payload.config));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load doctor workspace');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [authHeaders]);

  const shareUrl = useMemo(() => {
    if (!form?.sharePath || form.status !== 'published' || typeof window === 'undefined') {
      return '';
    }
    return `${window.location.origin}${form.sharePath}`;
  }, [form?.sharePath, form?.status]);

  const enabledScaleTitles = useMemo(
    () =>
      eligibleScales
        .filter((scale) => form?.enabledScaleIds.includes(scale.id))
        .map((scale) => `${scale.id}: ${scale.title}`),
    [eligibleScales, form?.enabledScaleIds]
  );

  const fastgptTemplate = useMemo(
    () =>
      [
        '【FastGPT 侧推荐模板】',
        `你是${form?.assistantName || '医生分身'}。`,
        '你的职责是先做知识解释、安抚和判断，再在必要时建议量表。',
        '你不能直接开始量表，不能自己计算量表分数，不能假装已经拿到了平台里的患者数据。',
        '默认优先返回给患者看的自然语言文本。',
        '如果需要建议量表，优先使用标准 OpenAI tool_calls 调用 suggest_assessment。',
        '不要把 {"patientReply":"...","action":"SPEAK_ONLY"} 这一类 JSON 直接打印在消息正文里。',
        '',
        '【唯一允许的平台函数】',
        '函数名：suggest_assessment',
        '参数结构：',
        '{',
        '  "scaleId": "量表ID，必须来自允许列表",',
        '  "reason": "推荐该量表的原因",',
        '  "cardTitle": "可选，患者看到的卡片标题",',
        '  "cardBody": "可选，患者看到的卡片说明"',
        '}',
        '',
        '【允许调用的量表】',
        enabledScaleTitles.length ? enabledScaleTitles.join('\n') : '（请先在平台勾选至少一个量表）',
        '',
        '【调用规则】',
        '- 只有当进一步结构化评估会帮助理解情况时才调用',
        '- 一次回复最多调用一个量表',
        '- 如果只是做知识问答、结果解释、情绪安抚，则不要调用函数',
        '',
        '【禁止事项】',
        '- 不要把 JSON 原样输出给患者',
        '- 不要调用未授权量表',
        '- 不要声称量表已经完成，除非平台已经回注了结果',
      ].join('\n'),
    [enabledScaleTitles, form?.assistantName]
  );

  const updateField = <K extends keyof WorkspaceConfigForm>(key: K, value: WorkspaceConfigForm[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    setStatusMessage('');
  };

  const toggleScale = (scaleId: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      const exists = prev.enabledScaleIds.includes(scaleId);
      return {
        ...prev,
        enabledScaleIds: exists
          ? prev.enabledScaleIds.filter((item) => item !== scaleId)
          : [...prev.enabledScaleIds, scaleId],
      };
    });
  };

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await fileToDataUrl(file);
      updateField('avatarUrl', dataUrl);
    } catch {
      setError('头像读取失败，请重试');
    }
  };

  const handleTest = async () => {
    if (!form?.fastgptBaseUrl.trim() || !form.fastgptApiKey.trim()) {
      setError('请先填写 FastGPT API URL 和 API Key');
      return;
    }

    setTesting(true);
    setError('');
    setStatusMessage('');

    try {
      const response = await fetch('/api/doctor/workspace/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          fastgptBaseUrl: form.fastgptBaseUrl,
          fastgptApiKey: form.fastgptApiKey,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload.error || 'FastGPT connection test failed');
      }

      setStatusMessage(`连接成功：${payload.preview || 'OK'}。注意：这只代表接口连通，不代表 FastGPT 当前提示词已经符合公开聊天页协议。`);
    } catch (testError) {
      setError(testError instanceof Error ? testError.message : 'FastGPT connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!form) return;

    setSaving(true);
    setError('');
    setStatusMessage('');

    try {
      const response = await fetch('/api/doctor/workspace', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          assistantName: form.assistantName,
          avatarUrl: form.avatarUrl,
          welcomeMessage: form.welcomeMessage,
          publicSlug: form.publicSlug,
          fastgptBaseUrl: form.fastgptBaseUrl,
          fastgptApiKey: form.fastgptApiKey,
          enabledScaleIds: form.enabledScaleIds,
          status: form.status,
        }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || !payload.config) {
        throw new Error(payload.error || 'Failed to save doctor assistant');
      }

      setForm(buildInitialForm(payload.config));

      const reload = await fetch('/api/doctor/workspace', { headers: authHeaders });
      const reloadPayload = (await reload.json().catch(() => ({}))) as Partial<DoctorWorkspaceResponse>;
      if (reload.ok) {
        if (reloadPayload.recentSessions) {
          setRecentSessions(reloadPayload.recentSessions);
        }
        if (reloadPayload.eligibleScales) {
          setEligibleScales(reloadPayload.eligibleScales);
        }
      }

      setStatusMessage('医生分身已保存');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save doctor assistant');
    } finally {
      setSaving(false);
    }
  };

  const copyTemplate = async () => {
    await navigator.clipboard.writeText(fastgptTemplate);
    setCopiedTemplate(true);
    window.setTimeout(() => setCopiedTemplate(false), 1500);
  };

  if (loading || !form) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-600 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>正在加载医生工作台...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.16),_transparent_34%),linear-gradient(135deg,_#ffffff,_#f8fbff_58%,_#eefaff)] p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-white/80 px-3 py-1 text-xs font-semibold text-cyan-700">
              <Sparkles className="h-3.5 w-3.5" />
              <span>医生数字分身工作台</span>
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">配置你自己的 FastGPT 分身</h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
              平台负责患者聊天体验、语音交互、量表工具和分享分发；知识库、提示词和工作流依然由你在 FastGPT 侧维护。
            </p>
          </div>

          <div className="flex flex-col gap-3 lg:items-end">
            <Button
              onClick={() => void handleSave()}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              <span>{saving ? '保存中...' : '保存医生分身'}</span>
            </Button>
            {statusMessage ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {statusMessage}
              </div>
            ) : null}
            {error ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-start gap-4">
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">基础信息</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">这些内容会直接出现在患者进入的专属聊天页里。</p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="text-sm">
                <span className="mb-2 block font-medium text-slate-700">分身名称</span>
                <Input
                  value={form.assistantName}
                  onChange={(event) => updateField('assistantName', event.target.value)}
                />
              </label>

              <label className="text-sm">
                <span className="mb-2 block font-medium text-slate-700">公开访问 slug</span>
                <Input
                  value={form.publicSlug}
                  onChange={(event) => updateField('publicSlug', event.target.value)}
                />
              </label>

              <div className="md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">头像</span>
                <div className="flex flex-col gap-4 md:flex-row md:items-center">
                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
                    {form.avatarUrl ? (
                      <img src={form.avatarUrl} alt={form.assistantName} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs text-slate-400">暂无头像</span>
                    )}
                  </div>
                  <div className="flex-1 space-y-3">
                    <Input
                      value={form.avatarUrl}
                      onChange={(event) => updateField('avatarUrl', event.target.value)}
                      placeholder="也可以直接粘贴头像 URL"
                    />
                    <input type="file" accept="image/*" onChange={(event) => void handleAvatarUpload(event)} className="block text-sm text-slate-500" />
                  </div>
                </div>
              </div>

              <label className="text-sm md:col-span-2">
                <span className="mb-2 block font-medium text-slate-700">欢迎语</span>
                <textarea
                  value={form.welcomeMessage}
                  onChange={(event) => updateField('welcomeMessage', event.target.value)}
                  rows={4}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 leading-6 outline-none focus:border-cyan-400"
                />
              </label>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-start gap-4">
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                <PlugZap className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">FastGPT 接入</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">填写医生自己的 FastGPT OpenAI 兼容接口地址和 API Key。支持填写 `.../api`、`.../api/v1` 或完整的 `.../api/v1/chat/completions`。</p>
              </div>
            </div>

            <div className="grid gap-5">
              <label className="text-sm">
                <span className="mb-2 block font-medium text-slate-700">FastGPT API URL</span>
                <Input
                  value={form.fastgptBaseUrl}
                  onChange={(event) => updateField('fastgptBaseUrl', event.target.value)}
                  placeholder="https://xxx/api 或 https://xxx/api/v1/chat/completions"
                />
              </label>

              <label className="text-sm">
                <span className="mb-2 block font-medium text-slate-700">FastGPT API Key</span>
                <Input
                  type="password"
                  value={form.fastgptApiKey}
                  onChange={(event) => updateField('fastgptApiKey', event.target.value)}
                  placeholder={form.fastgptApiKeyConfigured ? '已保存，如需更换请重新输入' : 'fastgpt-xxxxxx'}
                />
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => void handleTest()}
                  disabled={testing}
                >
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube2 className="h-4 w-4" />}
                  <span>{testing ? '测试中...' : '测试连接'}</span>
                </Button>

                <div className="inline-flex items-center gap-2 text-sm text-slate-600">
                  <ShieldCheck className="h-4 w-4 text-cyan-700" />
                  <span>API Key 只存服务端，不在前端回显。</span>
                </div>
                <div className="text-sm text-slate-500">
                  测试连接只验证 API 是否可访问；真正上线前，仍需保证 FastGPT 返回自然语言或标准 `tool_calls`，不要直接输出 JSON 包裹文本。
                </div>
              </div>

              <div className="rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-4">
                <div className="text-sm font-semibold text-cyan-900">Hermes 主脑灰度</div>
                <p className="mt-1 text-sm leading-6 text-cyan-800">
                  对话交互可逐步切到 Hermes；FastGPT 继续作为知识库底座。默认推荐走平台代理，保留高级直连模式作为兜底。
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="text-sm text-slate-700">
                    <span className="mb-2 block font-medium">Hermes 主脑</span>
                    <select
                      value={form.hermesEnabled ? 'enabled' : 'disabled'}
                      onChange={(event) => updateField('hermesEnabled', event.target.value === 'enabled')}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-cyan-400"
                    >
                      <option value="disabled">关闭</option>
                      <option value="enabled">开启</option>
                    </select>
                  </label>

                  <label className="text-sm text-slate-700">
                    <span className="mb-2 block font-medium">知识调用模式</span>
                    <select
                      value={form.knowledgeMode || 'platform_proxy'}
                      onChange={(event) =>
                        updateField('knowledgeMode', event.target.value as WorkspaceConfigForm['knowledgeMode'])
                      }
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-cyan-400"
                    >
                      <option value="platform_proxy">平台代理 FastGPT</option>
                      <option value="direct_fastgpt">高级直连 FastGPT</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5 flex items-start gap-4">
              <div className="rounded-2xl bg-slate-100 p-3 text-slate-700">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">工具授权</h2>
                <p className="mt-1 text-sm leading-6 text-slate-500">患者聊天页里，FastGPT 只能建议和启动你勾选过的量表。</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {eligibleScales.map((scale) => (
                <label key={scale.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={form.enabledScaleIds.includes(scale.id)}
                      onChange={() => toggleScale(scale.id)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-cyan-600"
                    />
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-900">{scale.id}</div>
                      <div className="mt-1 text-sm text-slate-600">{scale.title}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {scale.category || '未分类'}
                        {scale.estimatedMinutes ? ` · 约 ${scale.estimatedMinutes} 分钟` : ''}
                      </div>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-slate-900">
              <QrCode className="h-5 w-5 text-cyan-700" />
              <h2 className="text-lg font-semibold">分发矩阵</h2>
            </div>
            <div className="space-y-4 text-sm text-slate-600">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="font-medium text-slate-900">当前医生</div>
                <div className="mt-1">{doctor?.realName} · {doctor?.title}</div>
                <div>{doctor?.hospitalName} · {doctor?.departmentName}</div>
              </div>

              <label className="text-sm">
                <span className="mb-2 block font-medium text-slate-700">发布状态</span>
                <select
                  value={form.status}
                  onChange={(event) => updateField('status', event.target.value as WorkspaceConfigForm['status'])}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-cyan-400"
                >
                  <option value="draft">草稿</option>
                  <option value="published">已发布</option>
                  <option value="disabled">已停用</option>
                </select>
              </label>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="font-medium text-slate-900">公开 Web 链接</div>
                <div className="mt-1 break-all">{shareUrl || '保存并发布后生成'}</div>
              </div>

              {form.validationStatus ? (
                <div
                  className={`rounded-2xl border px-4 py-3 ${
                    form.validationStatus === 'valid'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                  }`}
                >
                  <div className="font-medium">
                    {form.validationStatus === 'valid' ? '最近验证：连接有效' : '最近验证：连接异常'}
                  </div>
                  {form.lastValidatedAt ? (
                    <div className="mt-1">时间：{new Date(form.lastValidatedAt).toLocaleString()}</div>
                  ) : null}
                  {form.lastValidationError ? <div className="mt-1">{form.lastValidationError}</div> : null}
                </div>
              ) : null}

              {shareUrl ? (
                <>
                  <InviteQrCard
                    url={shareUrl}
                    title={`${form.assistantName} 分发二维码`}
                    subtitle="患者扫码或打开链接后，将进入医生专属聊天页。"
                  />
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-700"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>预览患者聊天页</span>
                  </a>
                </>
              ) : null}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-slate-900">
              <PlugZap className="h-5 w-5 text-cyan-700" />
              <h2 className="text-lg font-semibold">FastGPT 模板</h2>
            </div>
            <p className="text-sm leading-6 text-slate-500">
              把下面这段说明复制到 FastGPT 的系统提示词或工具说明里，能更稳定地触发平台量表卡片。
            </p>
            <pre className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-slate-950 p-4 text-xs leading-6 text-slate-100">
              {fastgptTemplate}
            </pre>
            <Button
              variant="outline"
              onClick={() => void copyTemplate()}
            >
              {copiedTemplate ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              <span>{copiedTemplate ? '已复制模板' : '复制 FastGPT 模板'}</span>
            </Button>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-slate-900">
              <MessagesSquare className="h-5 w-5 text-cyan-700" />
              <h2 className="text-lg font-semibold">最近公开聊天会话</h2>
            </div>
            {recentSessions.length ? (
              <div className="space-y-3">
                {recentSessions.map((session) => (
                  <div key={session.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900">
                          {session.member?.realName || session.member?.nickname || `访客 ${session.visitorSessionId.slice(0, 8)}`}
                        </div>
                        <div className="mt-1 break-all text-xs text-slate-500">{session.chatId}</div>
                        <div className="mt-2 text-xs text-slate-500">
                          消息数：{session.messageCount} · 最近活跃：{new Date(session.lastActiveAt).toLocaleString()}
                        </div>
                      </div>
                      <Badge variant={session.status === 'active' ? 'success' : 'secondary'}>
                        {session.status}
                      </Badge>
                    </div>
                    {session.member?.contactPhone ? (
                      <div className="mt-2 text-xs text-slate-500">手机号：{session.member.contactPhone}</div>
                    ) : null}
                    {session.lastError ? (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                        最近错误：{session.lastError}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                还没有公开聊天会话，发布后把链接发给患者就会在这里看到活跃记录。
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
