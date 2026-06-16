'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  Bot,
  Building2,
  Database,
  Key,
  LayoutDashboard,
  LogOut,
  NotebookPen,
  RadioTower,
  ScrollText,
  Settings,
  Shield,
  SlidersHorizontal,
  Users,
} from 'lucide-react';

import SidebarShell from '@/components/layout/SidebarShell';
import { Badge } from '@/components/ui/badge';
import {
  ADMIN_ROLE,
  canAccessAdminRoles,
  getAdminRoleLabel,
  normalizeAdminRole,
  type AdminRole,
} from '@/lib/auth/admin-role';

type AdminNavItem = {
  name: string;
  href: string;
  icon: ReactNode;
  roles?: readonly AdminRole[];
};

type AdminShellUser = {
  id: string;
  username: string;
  email?: string | null;
  role: AdminRole;
};

const navItems: AdminNavItem[] = [
  { name: '系统总览', icon: <LayoutDashboard className="h-5 w-5" />, href: '/admin' },
  {
    name: '组织管理',
    icon: <Building2 className="h-5 w-5" />,
    href: '/admin/organizations',
    roles: [ADMIN_ROLE.SUPER_ADMIN],
  },
  {
    name: 'Hermes Profile',
    icon: <Bot className="h-5 w-5" />,
    href: '/admin/hermes-profiles',
    roles: [ADMIN_ROLE.SUPER_ADMIN],
  },
  {
    name: '渠道接入',
    icon: <RadioTower className="h-5 w-5" />,
    href: '/admin/channels',
    roles: [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.OPS],
  },
  {
    name: '治理策略',
    icon: <SlidersHorizontal className="h-5 w-5" />,
    href: '/admin/policies',
    roles: [ADMIN_ROLE.SUPER_ADMIN],
  },
  {
    name: '用户与成员',
    icon: <Users className="h-5 w-5" />,
    href: '/admin/users',
    roles: [ADMIN_ROLE.SUPER_ADMIN],
  },
  {
    name: '审计日志',
    icon: <ScrollText className="h-5 w-5" />,
    href: '/admin/audits',
    roles: [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.AUDITOR],
  },
  {
    name: '医生审核',
    icon: <Shield className="h-5 w-5" />,
    href: '/admin/doctors',
    roles: [ADMIN_ROLE.SUPER_ADMIN],
  },
  {
    name: '知识审核',
    icon: <NotebookPen className="h-5 w-5" />,
    href: '/admin/knowledge/reviews',
    roles: [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.KB_REVIEWER, ADMIN_ROLE.ORG_REVIEWER],
  },
  {
    name: '团队管理',
    icon: <Users className="h-5 w-5" />,
    href: '/admin/teams',
    roles: [ADMIN_ROLE.SUPER_ADMIN],
  },
  {
    name: '门诊二维码',
    icon: <Users className="h-5 w-5" />,
    href: '/admin/clinic',
    roles: [ADMIN_ROLE.SUPER_ADMIN],
  },
  {
    name: 'Agent 配置',
    icon: <Bot className="h-5 w-5" />,
    href: '/admin/agent',
    roles: [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.OPS],
  },
  {
    name: 'MCP 监控',
    icon: <Activity className="h-5 w-5" />,
    href: '/admin/mcp',
    roles: [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.OPS],
  },
  {
    name: '量表 API 密钥',
    icon: <Key className="h-5 w-5" />,
    href: '/admin/mcpkeys',
    roles: [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.OPS],
  },
  {
    name: 'AI 服务商密钥',
    icon: <Key className="h-5 w-5" />,
    href: '/admin/apikeys',
    roles: [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.OPS],
  },
  {
    name: '大模型与计费',
    icon: <Database className="h-5 w-5" />,
    href: '/admin/billing',
    roles: [ADMIN_ROLE.SUPER_ADMIN, ADMIN_ROLE.OPS],
  },
  {
    name: '系统设置',
    icon: <Settings className="h-5 w-5" />,
    href: '/admin/settings',
    roles: [ADMIN_ROLE.SUPER_ADMIN],
  },
];

function parseStoredAdminUser(raw: string | null): AdminShellUser | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as {
      id?: string;
      username?: string;
      email?: string | null;
      role?: string | null;
    };
    const role = normalizeAdminRole(parsed.role);

    if (!parsed.id || !parsed.username || !role) {
      return null;
    }

    return {
      id: parsed.id,
      username: parsed.username,
      email: parsed.email || null,
      role,
    };
  } catch {
    return null;
  }
}

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentAdmin, setCurrentAdmin] = useState<AdminShellUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (pathname === '/admin/login') {
      setChecking(false);
      return;
    }

    let cancelled = false;
    const verifyServerSession = async () => {
      try {
        const storedUser = parseStoredAdminUser(localStorage.getItem('admin_user'));
        if (!cancelled && storedUser) {
          setCurrentAdmin(storedUser);
        }

        const response = await fetch('/api/admin/session');
        if (!response.ok) {
          throw new Error('Unauthorized');
        }

        const data = (await response.json()) as {
          admin?: {
            id?: string;
            username?: string;
            email?: string | null;
            role?: string | null;
          };
        };
        const sessionAdmin = parseStoredAdminUser(JSON.stringify(data.admin || {}));
        if (!sessionAdmin) {
          throw new Error('Unauthorized');
        }

        if (!cancelled) {
          localStorage.setItem('admin_user', JSON.stringify(data.admin));
          setCurrentAdmin(sessionAdmin);
        }
      } catch {
        if (!cancelled) {
          localStorage.removeItem('admin_token');
          localStorage.removeItem('admin_user');
          setCurrentAdmin(null);
          router.push('/admin/login');
        }
      } finally {
        if (!cancelled) {
          setChecking(false);
        }
      }
    };

    void verifyServerSession();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  const visibleNavItems = navItems.filter((item) => canAccessAdminRoles(currentAdmin?.role, item.roles));

  useEffect(() => {
    if (checking || pathname === '/admin/login' || !currentAdmin) {
      return;
    }

    const routeExists = navItems.some((item) => item.href === pathname);
    if (!routeExists) {
      return;
    }

    const hasPermission = navItems.some(
      (item) => item.href === pathname && canAccessAdminRoles(currentAdmin.role, item.roles)
    );
    if (!hasPermission) {
      router.replace('/admin');
    }
  }, [checking, currentAdmin, pathname, router]);

  if (pathname === '/admin/login') return <>{children}</>;

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <p className="text-sm text-slate-500">正在加载管理后台...</p>
        </div>
      </div>
    );
  }

  if (!currentAdmin) return null;

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } finally {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      router.push('/admin/login');
    }
  };

  return (
    <SidebarShell
      navItems={visibleNavItems}
      header={
        <div className="inline-flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-500 text-sm font-bold text-white">
            AI
          </div>
          <span className="text-lg font-bold">平台管理后台</span>
        </div>
      }
      footer={
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-5 w-5" />
          <span>退出登录</span>
        </button>
      }
      topBar={
        <>
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-cyan-600" />
            <h1 className="text-lg font-semibold text-slate-800">
              {visibleNavItems.find((item) => item.href === pathname)?.name || '管理后台'}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="info">{getAdminRoleLabel(currentAdmin.role)}</Badge>
            <Badge variant="success">Assessment Core 运行中</Badge>
          </div>
        </>
      }
    >
      {children}
    </SidebarShell>
  );
}
