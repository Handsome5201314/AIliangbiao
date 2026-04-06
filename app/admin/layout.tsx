'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { LayoutDashboard, Users, Database, Activity, Settings, LogOut, Key, Shield } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

// 左侧导航菜单配置
const navItems = [
  { name: '系统概览', icon: <LayoutDashboard className="w-5 h-5" />, href: '/admin' },
  { name: '用户与画像', icon: <Users className="w-5 h-5" />, href: '/admin/users' },
  { name: 'MCP 开放平台', icon: <Activity className="w-5 h-5" />, href: '/admin/mcp' },
  { name: '量表API密钥', icon: <Key className="w-5 h-5" />, href: '/admin/mcpkeys' },
  { name: 'AI服务商密钥', icon: <Key className="w-5 h-5" />, href: '/admin/apikeys' },
  { name: '大模型与计费', icon: <Database className="w-5 h-5" />, href: '/admin/billing' },
  { name: '系统设置', icon: <Settings className="w-5 h-5" />, href: '/admin/settings' },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // 检查是否已登录
    const token = localStorage.getItem('admin_token');
    if (!token && pathname !== '/admin/login') {
      router.push('/admin/login');
    } else {
      setIsAuthenticated(!!token);
    }
    setChecking(false);
  }, [pathname, router]);

  // 登录页面不需要layout
  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-600">加载中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    router.push('/admin/login');
  };

  return (
    <div className="flex h-screen bg-slate-50">
      {/* 侧边导航栏 (SaaS 风格深色左导) */}
      <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col shrink-0 h-screen overflow-y-auto">
        {/* Logo 区域 */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800 shrink-0 sticky top-0 bg-slate-900 z-10">
          <a href="/" className="flex items-center">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center mr-3">
              <span className="text-white font-bold">AI</span>
            </div>
            <span className="text-lg font-bold text-white tracking-wider">超级管理控制台</span>
          </a>
        </div>

        {/* 菜单区域 */}
        <nav className="flex-1 py-6 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <a
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3 px-3 py-3 rounded-lg transition-colors ${
                  isActive 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'hover:bg-slate-800 hover:text-white'
                }`}
              >
                {item.icon}
                <span className="font-medium">{item.name}</span>
              </a>
            );
          })}
        </nav>

        {/* 底部退出区域 */}
        <div className="p-4 border-t border-slate-800 sticky bottom-0 bg-slate-900">
          <button
            onClick={handleLogout}
            className="flex items-center space-x-3 px-3 py-2 w-full rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
          >
            <LogOut className="w-5 h-5" />
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      {/* 右侧主内容区域 */}
      <main className="flex-1 flex flex-col min-h-screen">
        {/* 顶部简单的顶栏 */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-indigo-600" />
            <h1 className="text-xl font-semibold text-slate-800">
              {navItems.find(item => item.href === pathname)?.name || '管理后台'}
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="flex items-center text-sm text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
              MCP 引擎运行中
            </span>
          </div>
        </header>

        {/* 页面内容区（带滚动条） */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
          {children}
        </div>
      </main>
    </div>
  );
}
