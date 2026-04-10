'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Calendar,
  Clock,
  Database,
  Key,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';

type ActivityType = 'user' | 'assessment' | 'mcp';

interface DashboardActivity {
  id: string;
  type: ActivityType;
  occurredAt: string;
  title: string;
  description: string | null;
}

interface DashboardData {
  summary: {
    totalUsers: number;
    todayUsers: number;
    totalMembers: number;
    totalAssessments: number;
    todayAssessments: number;
    totalMcpCalls: number;
    todayMcpCalls: number;
    onlineAiProviderCount: number;
    activeMcpKeyCount: number;
  };
  userBreakdown: {
    guests: number;
    registeredPatients: number;
    doctorAccounts: number;
    pendingDoctors: number;
  };
  activityDelta: {
    users: number;
    assessments: number;
    mcpCalls: number;
  };
  recentActivities: DashboardActivity[];
  mcpStatus: {
    databaseHealthy: boolean;
    canonicalAuthEnabled: boolean;
    canonical: {
      key: string;
      label: string;
      callsLast24h: number;
      lastCalledAt: string | null;
    };
    compatibility: Array<{
      key: string;
      label: string;
      callsLast24h: number;
      lastCalledAt: string | null;
    }>;
    onlineProviders: Array<{
      id: string;
      name: string;
    }>;
  };
}

const emptyDashboard: DashboardData = {
  summary: {
    totalUsers: 0,
    todayUsers: 0,
    totalMembers: 0,
    totalAssessments: 0,
    todayAssessments: 0,
    totalMcpCalls: 0,
    todayMcpCalls: 0,
    onlineAiProviderCount: 0,
    activeMcpKeyCount: 0,
  },
  userBreakdown: {
    guests: 0,
    registeredPatients: 0,
    doctorAccounts: 0,
    pendingDoctors: 0,
  },
  activityDelta: {
    users: 0,
    assessments: 0,
    mcpCalls: 0,
  },
  recentActivities: [],
  mcpStatus: {
    databaseHealthy: false,
    canonicalAuthEnabled: false,
    canonical: {
      key: 'canonical',
      label: '/api/mcp',
      callsLast24h: 0,
      lastCalledAt: null,
    },
    compatibility: [],
    onlineProviders: [],
  },
};

function formatDelta(value: number) {
  if (value === 0) return '较昨日持平';
  return `较昨日 ${value > 0 ? '+' : ''}${value}`;
}

function formatDateTime(value: string | null) {
  if (!value) return '暂无记录';
  return new Date(value).toLocaleString('zh-CN');
}

export default function AdminDashboard() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardData>(emptyDashboard);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const response = await fetch('/api/admin/dashboard');
        if (response.status === 401) {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_user');
          router.push('/admin/login');
          return;
        }

        if (!response.ok) {
          throw new Error('加载系统概览失败');
        }

        const data = (await response.json()) as DashboardData;
        setDashboard(data);
        setError(null);
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : '加载系统概览失败');
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, [router]);

  const statCards = [
    {
      title: '用户总数',
      value: dashboard.summary.totalUsers,
      helper: `今日新增 ${dashboard.summary.todayUsers}`,
      icon: <Users className="h-6 w-6" />,
      accent: 'bg-blue-50 text-blue-600',
    },
    {
      title: '成员档案',
      value: dashboard.summary.totalMembers,
      helper: `游客 ${dashboard.userBreakdown.guests}`,
      icon: <User className="h-6 w-6" />,
      accent: 'bg-cyan-50 text-cyan-600',
    },
    {
      title: '评估总次数',
      value: dashboard.summary.totalAssessments,
      helper: `今日 ${dashboard.summary.todayAssessments}`,
      icon: <Activity className="h-6 w-6" />,
      accent: 'bg-violet-50 text-violet-600',
    },
    {
      title: 'MCP 成功调用',
      value: dashboard.summary.totalMcpCalls,
      helper: `今日 ${dashboard.summary.todayMcpCalls}`,
      icon: <Database className="h-6 w-6" />,
      accent: 'bg-emerald-50 text-emerald-600',
    },
    {
      title: '在线 AI 服务商',
      value: dashboard.summary.onlineAiProviderCount,
      helper: dashboard.mcpStatus.onlineProviders.map((item) => item.name).join(' / ') || '暂无在线服务商',
      icon: <TrendingUp className="h-6 w-6" />,
      accent: 'bg-amber-50 text-amber-600',
    },
    {
      title: '启用中的 MCP Key',
      value: dashboard.summary.activeMcpKeyCount,
      helper: '仅统计 MCP 服务凭证',
      icon: <Key className="h-6 w-6" />,
      accent: 'bg-rose-50 text-rose-600',
    },
  ];

  const quickLinks = [
    {
      href: '/admin/users',
      title: '成员管理',
      description: '查看用户、成员档案与评估关系',
      style: 'from-blue-500 to-blue-600',
      icon: <Users className="mb-3 h-8 w-8" />,
    },
    {
      href: '/admin/mcp',
      title: 'Assessment Core',
      description: '查看 canonical MCP 与兼容入口',
      style: 'from-emerald-500 to-emerald-600',
      icon: <Database className="mb-3 h-8 w-8" />,
    },
    {
      href: '/admin/mcpkeys',
      title: 'MCP 凭证',
      description: '管理外部智能体访问量表服务的凭证',
      style: 'from-slate-700 to-slate-900',
      icon: <Key className="mb-3 h-8 w-8" />,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">系统概览</h2>
        <p className="mt-1 text-sm text-slate-500">查看系统真实运行状态、核心数据和最近活动。</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {statCards.map((card) => (
          <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div className={`rounded-xl p-3 ${card.accent}`}>{card.icon}</div>
              {loading ? (
                <span className="text-xs text-slate-400">同步中...</span>
              ) : (
                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs text-slate-500">{card.helper}</span>
              )}
            </div>
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-500">{card.title}</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">
                {loading ? '...' : card.value.toLocaleString('zh-CN')}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900">用户构成</h3>
            <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">游客</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{dashboard.userBreakdown.guests}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">注册患者</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{dashboard.userBreakdown.registeredPatients}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">医生账户</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{dashboard.userBreakdown.doctorAccounts}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">待审核医生</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{dashboard.userBreakdown.pendingDoctors}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900">今日活跃度</h3>
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="font-medium text-slate-900">新用户注册</p>
                    <p className="text-sm text-slate-500">{formatDelta(dashboard.activityDelta.users)}</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-slate-900">{dashboard.summary.todayUsers}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Activity className="h-5 w-5 text-violet-600" />
                  <div>
                    <p className="font-medium text-slate-900">量表评估</p>
                    <p className="text-sm text-slate-500">{formatDelta(dashboard.activityDelta.assessments)}</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-slate-900">{dashboard.summary.todayAssessments}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Database className="h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="font-medium text-slate-900">MCP 调用</p>
                    <p className="text-sm text-slate-500">{formatDelta(dashboard.activityDelta.mcpCalls)}</p>
                  </div>
                </div>
                <span className="text-lg font-bold text-slate-900">{dashboard.summary.todayMcpCalls}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900">Assessment Core · MCP 状态</h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-slate-700">数据库连通</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${dashboard.mcpStatus.databaseHealthy ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                  {dashboard.mcpStatus.databaseHealthy ? '正常' : '异常'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-slate-700">canonical MCP 鉴权</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${dashboard.mcpStatus.canonicalAuthEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {dashboard.mcpStatus.canonicalAuthEnabled ? '已启用' : '未启用'}
                </span>
              </div>
              <div className="rounded-2xl border border-slate-200 px-4 py-4">
                <p className="text-sm font-semibold text-slate-900">{dashboard.mcpStatus.canonical.label}</p>
                <p className="mt-1 text-sm text-slate-500">24h 调用 {dashboard.mcpStatus.canonical.callsLast24h}</p>
                <p className="mt-2 text-xs text-slate-500">最近调用：{formatDateTime(dashboard.mcpStatus.canonical.lastCalledAt)}</p>
              </div>
              {dashboard.mcpStatus.compatibility.map((entry) => (
                <div key={entry.key} className="rounded-2xl border border-slate-200 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-900">{entry.label}</p>
                  <p className="mt-1 text-sm text-slate-500">24h 调用 {entry.callsLast24h}</p>
                  <p className="mt-2 text-xs text-slate-500">最近调用：{formatDateTime(entry.lastCalledAt)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900">最近活动</h3>
            <div className="mt-4 space-y-4">
              {loading ? (
                <div className="text-sm text-slate-500">加载中...</div>
              ) : dashboard.recentActivities.length === 0 ? (
                <div className="text-sm text-slate-500">暂无活动记录</div>
              ) : (
                dashboard.recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                    <div className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-full ${
                      activity.type === 'user'
                        ? 'bg-blue-100 text-blue-600'
                        : activity.type === 'assessment'
                          ? 'bg-violet-100 text-violet-600'
                          : 'bg-emerald-100 text-emerald-600'
                    }`}>
                      {activity.type === 'user' ? <Users className="h-4 w-4" /> : activity.type === 'assessment' ? <Activity className="h-4 w-4" /> : <Database className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-800">{activity.title}</p>
                      {activity.description && <p className="mt-1 text-xs text-slate-500">{activity.description}</p>}
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{formatDateTime(activity.occurredAt)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {quickLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className={`rounded-xl bg-gradient-to-br ${link.style} p-6 text-white shadow-sm transition-shadow hover:shadow-lg`}
          >
            {link.icon}
            <h4 className="text-lg font-bold">{link.title}</h4>
            <p className="mt-1 text-sm text-white/80">{link.description}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
