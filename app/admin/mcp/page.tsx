'use client';

import { useState } from 'react';
import { Activity, Database, Zap, Code, ExternalLink, Copy, CheckCircle } from 'lucide-react';

interface MCPSkill {
  name: string;
  description: string;
  status: 'active' | 'development' | 'planned';
  endpoint: string;
  tools: string[];
  calls: number;
}

export default function MCPPage() {
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);

  const skills: MCPSkill[] = [
    {
      name: 'Memory Skill',
      description: '用户画像管理、对话记忆持久化、千人千面基础',
      status: 'active',
      endpoint: '/api/mcp/memory',
      tools: ['get_user_memory', 'save_user_memory'],
      calls: 892
    },
    {
      name: 'Growth Curve Skill',
      description: 'WHO标准新生儿生长曲线评估、发育监测',
      status: 'active',
      endpoint: '/api/mcp/growth',
      tools: ['add_growth_record', 'get_growth_history', 'evaluate_growth'],
      calls: 234
    },
    {
      name: 'Recommendation Skill',
      description: '智能量表推荐、个性化建议',
      status: 'development',
      endpoint: '/api/mcp/recommend',
      tools: ['recommend_scale', 'get_recommendations'],
      calls: 0
    }
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedEndpoint(text);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">MCP 开放平台</h2>
        <p className="text-sm text-slate-500 mt-1">管理和监控 MCP 微服务，提供开放 API 接入能力</p>
      </div>

      {/* 概览统计 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-100 text-sm">活跃服务</p>
              <p className="text-3xl font-bold mt-1">2</p>
            </div>
            <Activity className="w-10 h-10 opacity-50" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm">今日调用</p>
              <p className="text-3xl font-bold mt-1">1,126</p>
            </div>
            <Zap className="w-10 h-10 opacity-50" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-100 text-sm">可用工具</p>
              <p className="text-3xl font-bold mt-1">5</p>
            </div>
            <Code className="w-10 h-10 opacity-50" />
          </div>
        </div>
      </div>

      {/* MCP 服务列表 */}
      <div className="space-y-4">
        {skills.map((skill, index) => (
          <div key={index} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-slate-900">{skill.name}</h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      skill.status === 'active' 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : skill.status === 'development'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-800'
                    }`}>
                      {skill.status === 'active' ? '运行中' : skill.status === 'development' ? '开发中' : '计划中'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-4">{skill.description}</p>
                  
                  {/* Endpoint */}
                  <div className="flex items-center gap-2 mb-4">
                    <code className="flex-1 bg-slate-50 px-4 py-2 rounded-lg text-sm font-mono text-slate-700 border border-slate-200">
                      {skill.endpoint}
                    </code>
                    <button
                      onClick={() => copyToClipboard(skill.endpoint)}
                      className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                      title="复制"
                    >
                      {copiedEndpoint === skill.endpoint ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Copy className="w-5 h-5 text-slate-400" />
                      )}
                    </button>
                  </div>

                  {/* Tools */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 mb-2 uppercase">可用工具</p>
                    <div className="flex flex-wrap gap-2">
                      {skill.tools.map((tool, i) => (
                        <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="ml-6 text-right">
                  <p className="text-sm text-slate-500">调用次数</p>
                  <p className="text-2xl font-bold text-slate-900">{skill.calls.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* API 文档链接 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">快速接入</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="font-medium text-slate-900 mb-2">Memory Skill 接入指南</h4>
            <p className="text-sm text-slate-600 mb-3">了解如何接入记忆中枢服务</p>
            <a href="#" className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              查看文档 <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
            <h4 className="font-medium text-slate-900 mb-2">Growth Curve Skill 接入指南</h4>
            <p className="text-sm text-slate-600 mb-3">了解如何接入生长曲线服务</p>
            <a href="#" className="inline-flex items-center gap-2 text-sm text-indigo-600 hover:text-indigo-700 font-medium">
              查看文档 <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
