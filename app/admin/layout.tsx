'use client';

import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Activity, Database, Key, LayoutDashboard, LogOut, Settings, Shield, Users } from 'lucide-react';

const navItems = [
  { name: '系统概览', icon: <LayoutDashboard className="w-5 h-5" />, href: '/admin' },
  { name: '用户与成员', icon: <Users className="w-5 h-5" />, href: '/admin/users' },
  { name: '医生审核', icon: <Shield className="w-5 h-5" />, href: '/admin/doctors' },
  { name: 'Assessment Core · MCP', icon: <Activity className="w-5 h-5" />, href: '/admin/mcp' },
  { name: '量表 API 密钥', icon: <Key className="w-5 h-5" />, href: '/admin/mcpkeys' },
  { name: 'AI 服务商密钥', icon: <Key className="w-5 h-5" />, href: '/admin/apikeys' },
  { name: '大模型与计费', icon: <Database className="w-5 h-5" />, href: '/admin/billing' },
  { name: '系统设置', icon: <Settings className="w-5 h-5" />, href: '/admin/settings' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (pathname === '/admin/login') {
      setChecking(false);
      return;
    }

    const token = localStorage.getItem('admin_token');
    if (token) {
      setIsAuthenticated(Boolean(token));
      setChecking(false);
      return;
    }

    let cancelled = false;

    const verifyServerSession = async () => {
      try {
        const response = await fetch('/api/admin/settings');
        if (!cancelled && response.ok) {
          setIsAuthenticated(true);
        } else if (!cancelled) {
          router.push('/admin/login');
        }
      } catch (error) {
        if (!cancelled) {
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

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-slate-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (error) {
      console.error('Failed to clear admin session:', error);
    } finally {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      router.push('/admin/login');
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <aside className="flex h-screen w-72 shrink-0 flex-col overflow-y-auto bg-slate-950 text-white">
        <div className="sticky top-0 z-10 flex h-16 items-center border-b border-white/10 bg-slate-950 px-6">
          <a href="/" className="inline-flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 font-bold text-white">
              AI
            </div>
            <span className="text-lg font-bold">平台管理后台</span>
          </a>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-6">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                pathname === item.href
                  ? 'bg-indigo-600 text-white'
                  : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              {item.icon}
              <span>{item.name}</span>
            </a>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-5 w-5" />
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      <main className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white px-8">
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-indigo-600" />
            <h1 className="text-xl font-semibold text-slate-800">
              {navItems.find((item) => item.href === pathname)?.name || '管理后台'}
            </h1>
          </div>
          <div className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-sm text-emerald-600">
            Assessment Core 运行中
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">{children}</div>
      </main>
    </div>
  );
}
