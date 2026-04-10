'use client';

import { Activity, CheckCircle2, Code, Layers3, PlugZap } from 'lucide-react';

const canonicalTools = [
  'recommend_assessment',
  'recommend_scale',
  'get_scale_questions',
  'create_assessment_session',
  'get_current_question',
  'submit_answer',
  'get_assessment_result',
  'pause_assessment_session',
  'resume_assessment_session',
  'cancel_assessment_session',
  'submit_and_evaluate',
  'add_growth_record',
  'get_growth_history',
  'evaluate_growth',
];

const compatibilityEndpoints = [
  '/api/mcp/scale',
  '/api/mcp/growth',
  '/api/mcp/memory',
];

export default function MCPPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Assessment Core · MCP 接口</h2>
        <p className="mt-1 text-sm text-slate-500">
          平台对外的正式能力层是统一的 MCP 入口。量表评估、生长曲线评估和会话式题目推进都归属同一个
          Assessment Core。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-indigo-100">正式入口</p>
              <p className="mt-1 text-3xl font-bold">1</p>
            </div>
            <Layers3 className="h-10 w-10 opacity-60" />
          </div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-100">核心工具</p>
              <p className="mt-1 text-3xl font-bold">{canonicalTools.length}</p>
            </div>
            <Code className="h-10 w-10 opacity-60" />
          </div>
        </div>
        <div className="rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-amber-100">兼容入口</p>
              <p className="mt-1 text-3xl font-bold">{compatibilityEndpoints.length}</p>
            </div>
            <PlugZap className="h-10 w-10 opacity-60" />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-indigo-50 p-3 text-indigo-600">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Canonical MCP 入口</h3>
            <p className="text-sm text-slate-500">外部智能体应优先接入这个统一入口，并使用 MCP Key 建立带鉴权的 SSE 会话。</p>
          </div>
        </div>

        <div className="mb-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-sm text-slate-700">
          /api/mcp
        </div>

        <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          canonical 入口要求 `Authorization: Bearer &lt;MCP Key&gt;`，并在建立 SSE 会话后继续使用同一凭证。
        </div>

        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">核心工具</p>
          <div className="flex flex-wrap gap-2">
            {canonicalTools.map((tool) => (
              <span
                key={tool}
                className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">兼容入口说明</h3>
        <div className="space-y-3 text-sm text-slate-600">
          <p>
            下面这些端点仍然保留，用于兼容历史接入方或过渡迁移，但它们不再代表目标架构的默认接入方式。
          </p>
          <div className="flex flex-wrap gap-2">
            {compatibilityEndpoints.map((endpoint) => (
              <code
                key={endpoint}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
              >
                {endpoint}
              </code>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-blue-600" />
          <div className="space-y-2 text-sm text-blue-900">
            <p className="font-semibold">当前架构约束</p>
            <p>1. Growth 已并入 Assessment Core，不再作为独立产品概念宣传。</p>
            <p>2. Recommendation 只是分诊/编排流程中的一个动作，不再单列为独立 Skill。</p>
            <p>3. 用户画像不是目标架构主干能力，评估只保留最小成员档案。</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">接入说明</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h4 className="mb-2 font-medium text-slate-900">MCP 调用说明书</h4>
            <p className="mb-3 text-sm text-slate-600">
              外部智能体的调用顺序和约束，统一写在 assessment-skill 的 README 中。
            </p>
            <code className="rounded bg-white px-2 py-1 text-xs text-slate-700">
              packages/assessment-skill/README.md
            </code>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h4 className="mb-2 font-medium text-slate-900">调用原则</h4>
            <p className="text-sm text-slate-600">
              原题是唯一评估依据；模型不能算分；每轮只处理一题；会话中断后必须继续使用同一个
              `sessionId` 恢复。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
