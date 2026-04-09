'use client';

import { ReactNode, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const doctorNav = [
  { href: '/doctor', label: '工作台' },
  { href: '/doctor/patients', label: '患者列表' },
  { href: '/doctor/profile', label: '我的资料' },
  { href: '/doctor/research', label: '科研导出' },
];

export default function DoctorLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [statusMessage, setStatusMessage] = useState('');
  const isAuthPage = pathname === '/doctor/login' || pathname === '/doctor/register';

  useEffect(() => {
    if (isAuthPage) {
      setChecking(false);
      return;
    }

    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (!data.user) {
          router.push('/doctor/login');
          return;
        }
        if (data.user.accountType !== 'DOCTOR') {
          router.push('/auth/login');
          return;
        }
        if (data.user.doctorProfile?.verificationStatus !== 'APPROVED') {
          setStatusMessage('您的医生账号已登录，但尚未通过平台审核，当前仅可查看资料状态。');
        }
      })
      .finally(() => setChecking(false));
  }, [isAuthPage, router]);

  if (isAuthPage) {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-500">正在校验医生会话...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-8">
        <aside className="w-56 shrink-0 rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-900">医生工作台</h2>
          <div className="mt-4 space-y-2">
            {doctorNav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className={`block rounded-2xl px-4 py-3 text-sm font-medium ${
                  pathname === item.href ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </a>
            ))}
          </div>
          <button
            type="button"
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' });
              router.push('/doctor/login');
              router.refresh();
            }}
            className="mt-6 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600 hover:bg-slate-100"
          >
            退出登录
          </button>
        </aside>

        <main className="flex-1">
          {statusMessage && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {statusMessage}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
