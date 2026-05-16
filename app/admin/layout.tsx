'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Activity,
  Bot,
  Database,
  Key,
  LayoutDashboard,
  LogOut,
  Settings,
  Shield,
  Users,
} from 'lucide-react';

import SidebarShell from '@/components/layout/SidebarShell';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { name: '系统总览', icon: <LayoutDashboard className="h-5 w-5" />, href: '/admin' },
  { name: '用户与成员', icon: <Users className="h-5 w-5" />, href: '/admin/users' },
  { name: '医生审核', icon: <Shield className="h-5 w-5" />, href: '/admin/doctors' },
  { name: '团队管理', icon: <Users className="h-5 w-5" />, href: '/admin/teams' },
  { name: '门诊二维码', icon: <Users className="h-5 w-5" />, href: '/admin/clinic' },
  { name: 'Agent 配置', icon: <Bot className="h-5 w-5" />, href: '/admin/agent' },
  { name: 'MCP 监控', icon: <Activity className="h-5 w-5" />, href: '/admin/mcp' },
  { name: '量表 API 密钥', icon: <Key className="h-5 w-5" />, href: '/admin/mcpkeys' },
  { name: 'AI 服务商密钥', icon: <Key className="h-5 w-5" />, href: '/admin/apikeys' },
  { name: '大模型与计费', icon: <Database className="h-5 w-5" />, href: '/admin/billing' },
  { name: '系统设置', icon: <Settings className="h-5 w-5" />, href: '/admin/settings' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (pathname === '/admin/login') { setChecking(false); return; }

    const localToken = localStorage.getItem('admin_token');
    if (localToken) { setIsAuthenticated(true); setChecking(false); return; }

    let cancelled = false;
    const verifyServerSession = async () => {
      try {
        const response = await fetch('/api/admin/settings');
        if (!cancelled && response.ok) setIsAuthenticated(true);
        else if (!cancelled) router.push('/admin/login');
      } catch {
        if (!cancelled) router.push('/admin/login');
      } finally {
        if (!cancelled) setChecking(false);
      }
    };
    void verifyServerSession();
    return () => { cancelled = true; };
  }, [pathname, router]);

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

  if (!isAuthenticated) return null;

  const handleLogout = async () => {
    try { await fetch('/api/admin/logout', { method: 'POST' }); }
    finally { localStorage.removeItem('admin_token'); localStorage.removeItem('admin_user'); router.push('/admin/login'); }
  };

  return (
    <SidebarShell
      navItems={navItems}
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
              {navItems.find((item) => item.href === pathname)?.name || '管理后台'}
            </h1>
          </div>
          <Badge variant="success">Assessment Core 运行中</Badge>
        </>
      }
    >
      {children}
    </SidebarShell>
  );
}
