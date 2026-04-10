'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Eye, EyeOff, Lock, Mail, ShieldCheck, Stethoscope, UserRound } from 'lucide-react';

import { useAuthSession } from '@/contexts/AuthSessionContext';

type AuthMode = 'login' | 'register';
type AuthAccount = 'PATIENT' | 'DOCTOR';

interface AuthCardProps {
  mode: AuthMode;
  accountType: AuthAccount;
}

export default function AuthCard({ mode, accountType }: AuthCardProps) {
  const router = useRouter();
  const { login } = useAuthSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [realName, setRealName] = useState('');
  const [hospitalName, setHospitalName] = useState('');
  const [departmentName, setDepartmentName] = useState('');
  const [title, setTitle] = useState('');
  const [licenseNo, setLicenseNo] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isRegister = mode === 'register';
  const isDoctor = accountType === 'DOCTOR';

  const titleMap = {
    PATIENT: {
      login: '患者登录',
      register: '患者注册',
    },
    DOCTOR: {
      login: '医生登录',
      register: '医生注册',
    },
  } as const;

  const subtitleMap = {
    PATIENT: '登录后可绑定主治医生并管理家庭成员档案',
    DOCTOR: '注册后需后台审核通过，才能查看患者数据',
  } as const;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      let response: Response;

      if (isRegister) {
        response = await fetch(isDoctor ? '/api/auth/register-doctor' : '/api/auth/register-patient', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            password,
            phone: phone || undefined,
            realName,
            hospitalName,
            departmentName,
            title,
            licenseNo,
            deviceId: !isDoctor ? localStorage.getItem('device_id') || undefined : undefined,
          }),
        });
      } else {
        response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
      }

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed');
      }

      await login(data.token);

      if (data.user.accountType === 'DOCTOR') {
        router.push('/doctor');
      } else {
        router.push('/');
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-4 py-10">
      <div className="mx-auto max-w-md">
        <div className="mb-8 text-center text-white">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10">
            {isDoctor ? <Stethoscope className="h-8 w-8" /> : <UserRound className="h-8 w-8" />}
          </div>
          <h1 className="text-3xl font-bold">{titleMap[accountType][mode]}</h1>
          <p className="mt-2 text-sm text-white/70">{subtitleMap[accountType]}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 rounded-[2rem] border border-white/10 bg-white/10 p-8 backdrop-blur">
          {error && (
            <div className="flex items-start gap-2 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-medium text-white">邮箱</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-10 py-3 text-sm text-white outline-none focus:border-cyan-300"
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-white">密码</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-10 py-3 text-sm text-white outline-none focus:border-cyan-300"
                placeholder="至少 8 位"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="mb-2 block text-sm font-medium text-white">手机号（可选）</label>
              <input
                type="text"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300"
                placeholder="作为补充联系方式"
              />
            </div>
          )}

          {isRegister && isDoctor && (
            <>
              <div>
                <label className="mb-2 block text-sm font-medium text-white">真实姓名</label>
                <input
                  type="text"
                  value={realName}
                  onChange={(event) => setRealName(event.target.value)}
                  required
                  className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-white">医院</label>
                  <input
                    type="text"
                    value={hospitalName}
                    onChange={(event) => setHospitalName(event.target.value)}
                    required
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-white">科室</label>
                  <input
                    type="text"
                    value={departmentName}
                    onChange={(event) => setDepartmentName(event.target.value)}
                    required
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-white">职称</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    required
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-white">执业证号</label>
                  <input
                    type="text"
                    value={licenseNo}
                    onChange={(event) => setLicenseNo(event.target.value)}
                    required
                    className="w-full rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none focus:border-cyan-300"
                  />
                </div>
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-cyan-50 disabled:bg-slate-300"
          >
            {isDoctor && isRegister ? <ShieldCheck className="h-4 w-4" /> : null}
            <span>{loading ? '提交中...' : titleMap[accountType][mode]}</span>
          </button>

          <div className="text-center text-sm text-white/70">
            {mode === 'login' ? '还没有账号？' : '已经有账号？'}{' '}
            <a
              href={mode === 'login' ? (isDoctor ? '/doctor/register' : '/auth/register') : (isDoctor ? '/doctor/login' : '/auth/login')}
              className="font-semibold text-cyan-200 hover:text-white"
            >
              {mode === 'login' ? '去注册' : '去登录'}
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
