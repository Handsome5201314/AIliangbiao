'use client';

import { useEffect, useState } from 'react';
import { UserRound } from 'lucide-react';

import { useAuthSession } from '@/contexts/AuthSessionContext';
import PageHeader from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function DoctorProfilePage() {
  const { authHeaders } = useAuthSession();
  const [profile, setProfile] = useState<any>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    fetch('/api/doctor/profile', { headers: authHeaders })
      .then((res) => res.json())
      .then((data) => setProfile(data.doctorProfile))
      .catch(console.error);
  }, [authHeaders]);

  const saveProfile = async () => {
    const response = await fetch('/api/doctor/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        realName: profile.realName,
        hospitalName: profile.hospitalName,
        departmentName: profile.departmentName,
        title: profile.title,
      }),
    });
    const data = await response.json();
    setStatus(response.ok ? '保存成功' : data.error || '保存失败');
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-cyan-300 border-t-transparent" />
          <p className="text-sm text-slate-500">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="医生资料"
        description="维护医生公开信息与审核资料。"
        actions={
          <Badge variant={profile.verificationStatus === 'APPROVED' ? 'success' : 'warning'}>
            {profile.verificationStatus === 'APPROVED' ? '已通过审核' : `审核状态：${profile.verificationStatus}`}
          </Badge>
        }
      />

      <Card className="p-6">
        <div className="mb-5 flex items-start gap-4">
          <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700">
            <UserRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">基本信息</h2>
            <p className="mt-1 text-sm text-slate-500">更新你的执业信息，审核通过后对患者可见。</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="text-sm">
            <span className="mb-2 block font-medium text-slate-700">真实姓名</span>
            <Input value={profile.realName} onChange={(e) => setProfile({ ...profile, realName: e.target.value })} />
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium text-slate-700">医院</span>
            <Input value={profile.hospitalName} onChange={(e) => setProfile({ ...profile, hospitalName: e.target.value })} />
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium text-slate-700">科室</span>
            <Input value={profile.departmentName} onChange={(e) => setProfile({ ...profile, departmentName: e.target.value })} />
          </label>
          <label className="text-sm">
            <span className="mb-2 block font-medium text-slate-700">职称</span>
            <Input value={profile.title} onChange={(e) => setProfile({ ...profile, title: e.target.value })} />
          </label>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Button onClick={() => void saveProfile()}>保存资料</Button>
          {status && (
            <span className={`text-sm ${status === '保存成功' ? 'text-emerald-600' : 'text-rose-600'}`}>
              {status}
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}
