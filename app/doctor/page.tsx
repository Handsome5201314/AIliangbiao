'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  Baby,
  Bot,
  ClipboardCheck,
  ClipboardList,
  FlaskConical,
  Link2,
  Sparkles,
  StickyNote,
  UserRound,
  Users,
} from 'lucide-react';

import { useAuthSession } from '@/contexts/AuthSessionContext';
import PageHeader from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';

export default function DoctorDashboardPage() {
  const { authHeaders } = useAuthSession();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/doctor/me/dashboard', { headers: authHeaders })
      .then((res) => res.json())
      .then(setData)
      .catch(console.error);
  }, [authHeaders]);

  const cards = [
    { title: '我的患者', value: data?.patientCount ?? 0, icon: <ClipboardList className="h-6 w-6" />, color: 'bg-blue-50 text-blue-700' },
    { title: '最近评估', value: data?.recentAssessmentCount ?? 0, icon: <Activity className="h-6 w-6" />, color: 'bg-purple-50 text-purple-700' },
    { title: '待复核', value: data?.pendingReviewCount ?? 0, icon: <ClipboardCheck className="h-6 w-6" />, color: 'bg-cyan-50 text-cyan-700' },
    { title: '最近备注', value: data?.recentNotesCount ?? 0, icon: <StickyNote className="h-6 w-6" />, color: 'bg-amber-50 text-amber-600' },
    { title: '科研导出', value: data?.researchExportCount ?? 0, icon: <FlaskConical className="h-6 w-6" />, color: 'bg-emerald-50 text-emerald-600' },
  ];

  const quickActions = [
    { title: '配置 AI 分身', description: '接入你在 FastGPT 配好的知识库、提示词和工作流，生成专属患者聊天页和二维码。', href: '/doctor/workspace', icon: <Sparkles className="h-5 w-5" />, tone: 'bg-violet-50 text-violet-700' },
    { title: '新生儿病房', description: '面向病房随访多个宝宝，独立管理档案、三围记录表和三联生长图。', href: '/doctor/neonates', icon: <Baby className="h-5 w-5" />, tone: 'bg-rose-50 text-rose-600' },
    { title: '处理待复核', description: '查看已完成量表的原始答案、总分和结论，记录医生复核决策。', href: '/doctor/reviews', icon: <ClipboardCheck className="h-5 w-5" />, tone: 'bg-cyan-50 text-cyan-700' },
    { title: '患者管理', description: '查看主责与协作患者档案、量表时间线、备注和共享状态。', href: '/doctor/patients', icon: <ClipboardList className="h-5 w-5" />, tone: 'bg-primary/10 text-primary' },
    { title: '团队协作', description: '维护团队成员，并在患者档案和新生儿病房之间建立共享协作关系。', href: '/doctor/team', icon: <Users className="h-5 w-5" />, tone: 'bg-accent/10 text-accent' },
    { title: '医生邀请', description: '继续使用现有直链量表邀请链路，快速生成二维码与分享链接。', href: '/doctor/invites', icon: <Link2 className="h-5 w-5" />, tone: 'bg-amber-50 text-amber-600' },
    { title: '维护个人资料', description: '更新医生个人资料、执业信息和审核相关信息。', href: '/doctor/profile', icon: <UserRound className="h-5 w-5" />, tone: 'bg-emerald-50 text-emerald-600' },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="医生仪表盘" description="查看患者概览、最近评估、私人备注与科研导出情况。" />

      <Card className="border-accent/30 bg-accent/10 p-6">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-card p-3 text-accent">
            <Bot className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">医生工作流已扩展到团队协作</h2>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">
              现在除了患者管理、邀请量表和新生儿病房外，你还可以在团队内共享患者档案和病房宝宝档案。
            </p>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className="p-6">
            <div className={`inline-flex rounded-2xl p-3 ${card.color}`}>{card.icon}</div>
            <div className="mt-4 text-sm text-muted-foreground">{card.title}</div>
            <div className="mt-1 text-3xl font-bold text-foreground">{card.value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <ArrowRight className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold text-foreground">快捷入口</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="group rounded-3xl border border-border bg-muted/50 p-5 transition-all hover:border-primary/30 hover:bg-card hover:shadow-sm"
            >
              <div className={`inline-flex rounded-2xl p-3 ${action.tone}`}>{action.icon}</div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-foreground">{action.title}</h3>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{action.description}</p>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
