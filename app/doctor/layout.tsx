'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  Baby,
  ClipboardCheck,
  ClipboardList,
  FlaskConical,
  LayoutDashboard,
  Link2,
  LogOut,
  Sparkles,
  Stethoscope,
  UserRound,
  Users,
} from 'lucide-react';

import { useAuthSession } from '@/contexts/AuthSessionContext';
import SidebarShell from '@/components/layout/SidebarShell';

const navItems = [
  { name: '医生概览', href: '/doctor', icon: <LayoutDashboard className="h-5 w-5" /> },
  { name: 'AI 分身工作台', href: '/doctor/workspace', icon: <Sparkles className="h-5 w-5" /> },
  { name: '医生邀请', href: '/doctor/invites', icon: <Link2 className="h-5 w-5" /> },
  { name: '门诊筛查', href: '/doctor/clinic-screenings', icon: <ClipboardList className="h-5 w-5" /> },
  { name: '待复核', href: '/doctor/reviews', icon: <ClipboardCheck className="h-5 w-5" /> },
  { name: '新生儿病房', href: '/doctor/neonates', icon: <Baby className="h-5 w-5" /> },
  { name: '患者管理', href: '/doctor/patients', icon: <ClipboardList className="h-5 w-5" /> },
  { name: '团队协作', href: '/doctor/team', icon: <Users className="h-5 w-5" /> },
  { name: '科研导出', href: '/doctor/research', icon: <FlaskConical className="h-5 w-5" /> },
  { name: '个人资料', href: '/doctor/profile', icon: <UserRound className="h-5 w-5" /> },
];

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, isAuthenticated, isDoctor, logout } = useAuthSession();

  useEffect(() => {
    if (pathname === '/doctor/login' || pathname === '/doctor/register') return;
    if (!loading && (!isAuthenticated || !isDoctor)) router.push('/doctor/login');
  }, [isAuthenticated, isDoctor, loading, pathname, router]);

  if (pathname === '/doctor/login' || pathname === '/doctor/register') {
    return <>{children}</>;
  }

  if (loading || !isAuthenticated || !isDoctor) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-cyan-300 border-t-transparent" />
          <p className="text-sm text-white/70">医生端加载中...</p>
        </div>
      </div>
    );
  }

  const doctorApproved = user?.doctorProfile?.verificationStatus === 'APPROVED';

  return (
    <SidebarShell
      navItems={navItems}
      header={
        <>
          <div className="inline-flex items-center gap-3">
            <div className="rounded-2xl bg-cyan-500/15 p-3">
              <Stethoscope className="h-6 w-6 text-cyan-300" />
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Doctor</div>
              <div className="text-base font-bold">{user?.doctorProfile?.realName || user?.email}</div>
            </div>
          </div>
          <div className="mt-4 rounded-2xl bg-white/5 px-4 py-3 text-sm text-white/70">
            审核状态：{user?.doctorProfile?.verificationStatus}
            {!doctorApproved && <div className="mt-2 text-xs text-amber-200">审核通过前不能查看患者数据。</div>}
          </div>
        </>
      }
      footer={
        <button
          type="button"
          onClick={() => { logout(); router.push('/doctor/login'); }}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-5 w-5" />
          <span>退出登录</span>
        </button>
      }
    >
      {children}
    </SidebarShell>
  );
}
