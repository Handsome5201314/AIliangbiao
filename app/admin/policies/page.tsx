'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save, ShieldCheck } from 'lucide-react';

import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

type PoliciesState = {
  sensitiveAccess: {
    requireConfirmation: boolean;
    ticketTtlMinutes: number;
    blockOnAuditFailure: boolean;
  };
  knowledgeReview: {
    requireAdminReview: boolean;
    allowOrganizationReviewer: boolean;
    pendingSlaHours: number;
  };
  explanation: {
    knowledgeDefaultMode: 'platform_proxy' | 'direct_fastgpt';
    allowDoctorSupplement: boolean;
    fallbackToStandardExplanation: boolean;
  };
  runtime: {
    hermesDegradeThresholdPercent: number;
    enableDoctorBotFallback: boolean;
    enforceTenantIsolation: boolean;
  };
  rateLimits: {
    agentSessionPerDevicePerMinute: number;
    questionExplanationPerMinute: number;
    webhookPerChannelPerMinute: number;
  };
};

const DEFAULT_POLICIES: PoliciesState = {
  sensitiveAccess: {
    requireConfirmation: true,
    ticketTtlMinutes: 30,
    blockOnAuditFailure: true,
  },
  knowledgeReview: {
    requireAdminReview: true,
    allowOrganizationReviewer: false,
    pendingSlaHours: 24,
  },
  explanation: {
    knowledgeDefaultMode: 'platform_proxy',
    allowDoctorSupplement: true,
    fallbackToStandardExplanation: true,
  },
  runtime: {
    hermesDegradeThresholdPercent: 5,
    enableDoctorBotFallback: true,
    enforceTenantIsolation: true,
  },
  rateLimits: {
    agentSessionPerDevicePerMinute: 20,
    questionExplanationPerMinute: 60,
    webhookPerChannelPerMinute: 120,
  },
};

export default function AdminPoliciesPage() {
  const [policies, setPolicies] = useState<PoliciesState>(DEFAULT_POLICIES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadPolicies();
  }, []);

  const loadPolicies = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/policies');
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '加载治理策略失败');
      }

      setPolicies(data.policies || DEFAULT_POLICIES);
    } catch (error) {
      alert(error instanceof Error ? error.message : '加载治理策略失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ policies }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || '保存治理策略失败');
      }

      setPolicies(data.policies || DEFAULT_POLICIES);
      alert('治理策略已保存');
    } catch (error) {
      alert(error instanceof Error ? error.message : '保存治理策略失败');
    } finally {
      setSaving(false);
    }
  };

  const updateSection = <T extends keyof PoliciesState>(
    section: T,
    patch: Partial<PoliciesState[T]>
  ) => {
    setPolicies((current) => ({
      ...current,
      [section]: {
        ...current[section],
        ...patch,
      },
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="治理策略"
        description="把敏感访问、知识审核、Hermes 降级与统一限流固化成平台级 Source of Truth。"
      />

      <Card className="border-cyan-200 bg-cyan-50 p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-white p-3 text-cyan-700">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-2 text-sm leading-7 text-slate-600">
            <div className="font-semibold text-slate-900">这里保存的是平台治理策略，而不是页面临时状态</div>
            <p>敏感访问、知识审核、解释优先级和渠道限流都应该以这里为准，而不是散落在页面 if 分支和默认值里。</p>
          </div>
        </div>
      </Card>

      {loading ? (
        <Card className="p-6">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>正在加载治理策略...</span>
          </div>
        </Card>
      ) : (
        <>
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900">敏感访问</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <div className="font-medium text-slate-900">访问前必须二次确认</div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={policies.sensitiveAccess.requireConfirmation}
                    onChange={(event) =>
                      updateSection('sensitiveAccess', { requireConfirmation: event.target.checked })
                    }
                  />
                  <span>{policies.sensitiveAccess.requireConfirmation ? '已启用' : '未启用'}</span>
                </div>
              </label>
              <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <div className="font-medium text-slate-900">审计失败时阻断访问</div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={policies.sensitiveAccess.blockOnAuditFailure}
                    onChange={(event) =>
                      updateSection('sensitiveAccess', { blockOnAuditFailure: event.target.checked })
                    }
                  />
                  <span>{policies.sensitiveAccess.blockOnAuditFailure ? '阻断' : '仅告警'}</span>
                </div>
              </label>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">访问票据 TTL（分钟）</label>
                <Input
                  type="number"
                  value={policies.sensitiveAccess.ticketTtlMinutes}
                  onChange={(event) =>
                    updateSection('sensitiveAccess', {
                      ticketTtlMinutes: Number(event.target.value || 0),
                    })
                  }
                />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900">知识审核</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <div className="font-medium text-slate-900">医生补充知识必须审核</div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={policies.knowledgeReview.requireAdminReview}
                    onChange={(event) =>
                      updateSection('knowledgeReview', { requireAdminReview: event.target.checked })
                    }
                  />
                  <span>{policies.knowledgeReview.requireAdminReview ? '已启用' : '未启用'}</span>
                </div>
              </label>
              <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <div className="font-medium text-slate-900">允许组织级 reviewer 协助审核</div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={policies.knowledgeReview.allowOrganizationReviewer}
                    onChange={(event) =>
                      updateSection('knowledgeReview', {
                        allowOrganizationReviewer: event.target.checked,
                      })
                    }
                  />
                  <span>{policies.knowledgeReview.allowOrganizationReviewer ? '允许' : '仅平台管理员'}</span>
                </div>
              </label>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">待审核 SLA（小时）</label>
                <Input
                  type="number"
                  value={policies.knowledgeReview.pendingSlaHours}
                  onChange={(event) =>
                    updateSection('knowledgeReview', {
                      pendingSlaHours: Number(event.target.value || 0),
                    })
                  }
                />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900">解释与降级</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <div className="font-medium text-slate-900">默认知识模式</div>
                <select
                  value={policies.explanation.knowledgeDefaultMode}
                  onChange={(event) =>
                    updateSection('explanation', {
                      knowledgeDefaultMode: event.target.value as 'platform_proxy' | 'direct_fastgpt',
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 outline-none focus:border-cyan-400"
                >
                  <option value="platform_proxy">platform_proxy</option>
                  <option value="direct_fastgpt">direct_fastgpt</option>
                </select>
              </label>
              <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <div className="font-medium text-slate-900">Hermes 异常时回退标准解释</div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={policies.explanation.fallbackToStandardExplanation}
                    onChange={(event) =>
                      updateSection('explanation', {
                        fallbackToStandardExplanation: event.target.checked,
                      })
                    }
                  />
                  <span>{policies.explanation.fallbackToStandardExplanation ? '已启用' : '未启用'}</span>
                </div>
              </label>
              <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <div className="font-medium text-slate-900">允许医生补充解释</div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={policies.explanation.allowDoctorSupplement}
                    onChange={(event) =>
                      updateSection('explanation', { allowDoctorSupplement: event.target.checked })
                    }
                  />
                  <span>{policies.explanation.allowDoctorSupplement ? '允许' : '仅平台标准解释'}</span>
                </div>
              </label>
              <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <div className="font-medium text-slate-900">Hermes doctor bot fallback</div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={policies.runtime.enableDoctorBotFallback}
                    onChange={(event) =>
                      updateSection('runtime', { enableDoctorBotFallback: event.target.checked })
                    }
                  />
                  <span>{policies.runtime.enableDoctorBotFallback ? '已启用' : '未启用'}</span>
                </div>
              </label>
              <label className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <div className="font-medium text-slate-900">强制租户隔离</div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={policies.runtime.enforceTenantIsolation}
                    onChange={(event) =>
                      updateSection('runtime', { enforceTenantIsolation: event.target.checked })
                    }
                  />
                  <span>{policies.runtime.enforceTenantIsolation ? '严格执行' : '仅监控告警'}</span>
                </div>
              </label>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Hermes 降级阈值（%）</label>
                <Input
                  type="number"
                  value={policies.runtime.hermesDegradeThresholdPercent}
                  onChange={(event) =>
                    updateSection('runtime', {
                      hermesDegradeThresholdPercent: Number(event.target.value || 0),
                    })
                  }
                />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900">统一限流</h3>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Agent Session / 设备 / 分钟</label>
                <Input
                  type="number"
                  value={policies.rateLimits.agentSessionPerDevicePerMinute}
                  onChange={(event) =>
                    updateSection('rateLimits', {
                      agentSessionPerDevicePerMinute: Number(event.target.value || 0),
                    })
                  }
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">题目解释 / 分钟</label>
                <Input
                  type="number"
                  value={policies.rateLimits.questionExplanationPerMinute}
                  onChange={(event) =>
                    updateSection('rateLimits', {
                      questionExplanationPerMinute: Number(event.target.value || 0),
                    })
                  }
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Webhook / 渠道 / 分钟</label>
                <Input
                  type="number"
                  value={policies.rateLimits.webhookPerChannelPerMinute}
                  onChange={(event) =>
                    updateSection('rateLimits', {
                      webhookPerChannelPerMinute: Number(event.target.value || 0),
                    })
                  }
                />
              </div>
            </div>
          </Card>
        </>
      )}

      <div className="flex justify-end">
        <Button onClick={() => void handleSave()} disabled={saving || loading}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span>{saving ? '保存中...' : '保存治理策略'}</span>
        </Button>
      </div>
    </div>
  );
}
