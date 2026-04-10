'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { ClipboardList, FlaskConical, LayoutDashboard, LogOut, Stethoscope, UserRound } from 'lucide-react';

import { useAuthSession } from '@/contexts/AuthSessionContext';

const navItems = [
  { name: '医生概览', href: '/doctor', icon: <LayoutDashboard className="w-5 h-5" /> },
  { name: '患者管理', href: '/doctor/patients', icon: <ClipboardList className="w-5 h-5" /> },
  { name: '科研导出', href: '/doctor/research', icon: <FlaskConical className="w-5 h-5" /> },
  { name: '个人资料', href: '/doctor/profile', icon: <UserRound className="w-5 h-5" /> },
];

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, isAuthenticated, isDoctor, logout } = useAuthSession();

  useEffect(() => {
    if (pathname === '/doctor/login' || pathname === '/doctor/register') {
      return;
    }

    if (!loading && (!isAuthenticated || !isDoctor)) {
      router.push('/doctor/login');
    }
  }, [isAuthenticated, isDoctor, loading, pathname, router]);

  if (pathname === '/doctor/login' || pathname === '/doctor/register') {
    return <>{children}</>;
  }

  if (loading || !isAuthenticated || !isDoctor) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-cyan-300 border-t-transparent" />
          <p>医生端加载中...</p>
        </div>
      </div>
    );
  }

  const doctorApproved = user?.doctorProfile?.verificationStatus === 'APPROVED';

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="w-72 shrink-0 bg-slate-950 text-white">
        <div className="border-b border-white/10 px-6 py-5">
          <div className="inline-flex items-center gap-3">
            <div className="rounded-2xl bg-cyan-500/15 p-3">
              <Stethoscope className="h-6 w-6 text-cyan-300" />
            </div>
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">Doctor</div>
              <div className="text-lg font-bold">{user?.doctorProfile?.realName || user?.email}</div>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/70">
            审核状态：{user?.doctorProfile?.verificationStatus}
            {!doctorApproved && <div className="mt-2 text-xs text-amber-200">审核通过前不能查看患者数据。</div>}
          </div>
        </div>

        <nav className="space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-colors ${
                pathname === item.href
                  ? 'bg-cyan-500 text-slate-950'
                  : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              {item.icon}
              <span>{item.name}</span>
            </a>
          ))}
        </nav>

        <div className="mt-auto p-4">
          <button
            type="button"
            onClick={() => {
              logout();
              router.push('/doctor/login');
            }}
            className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-white/75 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-5 w-5" />
            <span>退出登录</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
