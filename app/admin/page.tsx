'use client';

import { useState, useEffect } from 'react';
import { Users, Activity, Database, TrendingUp, Calendar, Clock } from 'lucide-react';

interface DashboardStats {
  totalUsers: number;
  todayUsers: number;
  totalAssessments: number;
  todayAssessments: number;
  mcpCalls: number;
  activeProviders: string[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    todayUsers: 0,
    totalAssessments: 0,
    todayAssessments: 0,
    mcpCalls: 0,
    activeProviders: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 模拟加载数据
    setTimeout(() => {
      setStats({
        totalUsers: 1247,
        todayUsers: 89,
        totalAssessments: 3568,
        todayAssessments: 156,
        mcpCalls: 892,
        activeProviders: ['siliconflow', 'sophon']
      });
      setLoading(false);
    }, 500);
  }, []);

  const statCards = [
    {
      title: '总用户数',
      value: stats.totalUsers,
      todayValue: stats.todayUsers,
      icon: <Users className="w-6 h-6" />,
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600'
    },
    {
      title: '总评估次数',
      value: stats.totalAssessments,
      todayValue: stats.todayAssessments,
      icon: <Activity className="w-6 h-6" />,
      bgColor: 'bg-purple-50',
      iconColor: 'text-purple-600'
    },
    {
      title: 'MCP 调用次数',
      value: stats.mcpCalls,
      todayValue: null,
      icon: <Database className="w-6 h-6" />,
      bgColor: 'bg-emerald-50',
      iconColor: 'text-emerald-600'
    },
    {
      title: '活跃服务商',
      value: stats.activeProviders.length,
      todayValue: null,
      icon: <TrendingUp className="w-6 h-6" />,
      bgColor: 'bg-amber-50',
      iconColor: 'text-amber-600'
    }
  ];

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">系统概览</h2>
        <p className="text-sm text-slate-500 mt-1">查看系统运行状态和核心数据</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((card, index) => (
          <div key={index} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-start justify-between">
              <div className={`p-3 rounded-lg ${card.bgColor}`}>
                <div className={card.iconColor}>{card.icon}</div>
              </div>
              {card.todayValue !== null && (
                <div className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                  <TrendingUp className="w-3 h-3" />
                  <span>+{card.todayValue}</span>
                </div>
              )}
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-500">{card.title}</p>
              <p className="text-3xl font-bold text-slate-900 mt-1">
                {loading ? '...' : card.value.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* 快捷操作区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* MCP 服务状态 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">MCP 微服务状态</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="font-medium text-slate-700">Memory Skill</span>
              </div>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                运行中
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="font-medium text-slate-700">Growth Curve Skill</span>
              </div>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                运行中
              </span>
            </div>
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg opacity-60">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
                <span className="font-medium text-slate-700">Recommendation Skill</span>
              </div>
              <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
                开发中
              </span>
            </div>
          </div>
        </div>

        {/* 今日活跃度 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">今日活跃度</h3>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">新用户注册</span>
                <span className="text-sm font-semibold text-slate-900">23 人</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '45%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">量表评估</span>
                <span className="text-sm font-semibold text-slate-900">156 次</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: '78%' }}></div>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">MCP 调用</span>
                <span className="text-sm font-semibold text-slate-900">89 次</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '62%' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 最近活动 */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">最近活动</h3>
        <div className="space-y-4">
          {[
            { time: '10:23', action: '用户 #1247 完成了 CARS 量表评估', type: 'assessment' },
            { time: '10:18', action: 'Memory Skill 被调用 (get_user_memory)', type: 'mcp' },
            { time: '10:15', action: '新用户注册 (设备ID: abc123...)', type: 'user' },
            { time: '10:12', action: 'Growth Curve Skill 被调用 (add_growth_record)', type: 'mcp' },
            { time: '10:08', action: '用户 #1089 完成了 ABC 量表评估', type: 'assessment' },
          ].map((activity, index) => (
            <div key={index} className="flex items-start gap-3 pb-4 border-b border-slate-100 last:border-0 last:pb-0">
              <div className="flex-shrink-0 mt-0.5">
                {activity.type === 'assessment' && (
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <Activity className="w-4 h-4 text-purple-600" />
                  </div>
                )}
                {activity.type === 'mcp' && (
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                    <Database className="w-4 h-4 text-emerald-600" />
                  </div>
                )}
                {activity.type === 'user' && (
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700">{activity.action}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span className="text-xs text-slate-500">{activity.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 快速链接 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a href="/admin/users" className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white hover:shadow-lg transition-shadow">
          <Users className="w-8 h-8 mb-3" />
          <h4 className="text-lg font-bold mb-1">用户管理</h4>
          <p className="text-sm text-blue-100">查看和管理用户画像</p>
        </a>
        <a href="/admin/mcp" className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-6 text-white hover:shadow-lg transition-shadow">
          <Database className="w-8 h-8 mb-3" />
          <h4 className="text-lg font-bold mb-1">MCP 平台</h4>
          <p className="text-sm text-emerald-100">管理微服务和 API</p>
        </a>
        <a href="/admin/billing" className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white hover:shadow-lg transition-shadow">
          <TrendingUp className="w-8 h-8 mb-3" />
          <h4 className="text-lg font-bold mb-1">计费中心</h4>
          <p className="text-sm text-purple-100">查看用量和账单</p>
        </a>
      </div>
    </div>
  );
}
