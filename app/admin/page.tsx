'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Activity,
  Building2,
  Calendar,
  Clock,
  Database,
  Key,
  NotebookPen,
  RadioTower,
  ScrollText,
  SlidersHorizontal,
  TrendingUp,
  User,
  Users,
} from 'lucide-react';

import PageHeader from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ADMIN_ROLE, canAccessAdminRoles, normalizeAdminRole, type AdminRole } from '@/lib/auth/admin-role';

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
    pendingKnowledgeReviews: number;
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

type QuickLink = {
  href: string;
  title: string;
  description: string;
  style: string;
  icon: ReactNode;
  roles?: readonly AdminRole[];
};

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
    pendingKnowledgeReviews: 0,
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
  const [currentRole, setCurrentRole] = useState<AdminRole | null>(null);
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

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('admin_user') || '{}') as { role?: string | null };
      setCurrentRole(normalizeAdminRole(stored.role));
    } catch {
      setCurrentRole(null);
    }
  }, []);

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

  const quickLinks: QuickLink[] = [
    {
      href: '/admin/organizations',
      title: '组织管理',
      description: '开通、停用机构租户并承接医生归属',
      style: 'from-cyan-600 to-sky-700',
      icon: <Building2 className="mb-3 h-8 w-8" />,
      roles: [ADMIN_ROLE.SUPER_ADMIN],
    },
    {
      href: '/admin/users',
      title: '成员管理',
      description: '查看用户、成员档案与评估关系',
      style: 'from-blue-500 to-blue-600',
      icon: <Users className="mb-3 h-8 w-8" />,
      roles: [ADMIN_ROLE.SUPER_ADMIN],
    },
    {
      href: '/admin/audits',
      title: '审计日志',
      description: '复核知识解释、敏感访问与治理动作',
      style: 'from-amber-500 to-orange-600',
      icon: <ScrollText className="mb-3 h-8 w-8" />,
      roles: [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.AUDITOR],
    },
    {
      href: '/admin/knowledge/reviews',
      title: '知识审核',
      description: '审核知识文档与题目解释，决定是否进入平台知识库',
      style: 'from-indigo-500 to-fuchsia-600',
      icon: <NotebookPen className="mb-3 h-8 w-8" />,
      roles: [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.KB_REVIEWER, ADMIN_ROLE.ORG_REVIEWER],
    },
    {
      href: '/admin/channels',
      title: '渠道接入',
      description: '维护 Web/H5、机器人和 AI 玩具入口的启用状态与网关路径',
      style: 'from-teal-500 to-cyan-700',
      icon: <RadioTower className="mb-3 h-8 w-8" />,
      roles: [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.OPS],
    },
    {
      href: '/admin/policies',
      title: '治理策略',
      description: '固化敏感访问、知识审核、量表治理与统一限流规则',
      style: 'from-slate-800 to-violet-700',
      icon: <SlidersHorizontal className="mb-3 h-8 w-8" />,
      roles: [ADMIN_ROLE.SUPER_ADMIN],
    },
    {
      href: '/admin/mcp',
      title: 'Assessment Core',
      description: '查看 canonical MCP 与兼容入口',
      style: 'from-emerald-500 to-emerald-600',
      icon: <Database className="mb-3 h-8 w-8" />,
      roles: [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.OPS],
    },
    {
      href: '/admin/mcpkeys',
      title: 'MCP 凭证',
      description: '管理外部智能体访问量表服务的凭证',
      style: 'from-slate-700 to-slate-900',
      icon: <Key className="mb-3 h-8 w-8" />,
      roles: [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.OPS],
    },
  ];
  const visibleQuickLinks = quickLinks.filter((item) => canAccessAdminRoles(currentRole, item.roles));

  return (
    <div className="space-y-6">
      <PageHeader title="系统概览" description="查看系统真实运行状态、核心数据和最近活动。" />

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {statCards.map((card) => (
          <Card key={card.title} className="p-6">
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
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <Card className="p-6">
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
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">待审核知识</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">{dashboard.userBreakdown.pendingKnowledgeReviews}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
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
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900">Assessment Core · MCP 状态</h3>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-slate-700">数据库连通</span>
                <Badge variant={dashboard.mcpStatus.databaseHealthy ? 'success' : 'destructive'}>
                  {dashboard.mcpStatus.databaseHealthy ? '正常' : '异常'}
                </Badge>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                <span className="text-sm font-medium text-slate-700">canonical MCP 鉴权</span>
                <Badge variant={dashboard.mcpStatus.canonicalAuthEnabled ? 'success' : 'warning'}>
                  {dashboard.mcpStatus.canonicalAuthEnabled ? '已启用' : '未启用'}
                </Badge>
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
          </Card>

          <Card className="p-6">
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
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {visibleQuickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-2xl bg-gradient-to-br ${link.style} p-6 text-white shadow-sm transition-shadow hover:shadow-lg`}
          >
            {link.icon}
            <h4 className="text-lg font-bold">{link.title}</h4>
            <p className="mt-1 text-sm text-white/80">{link.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
