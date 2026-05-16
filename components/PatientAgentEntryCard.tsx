'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Bot, Link2, Loader2, Sparkles, Stethoscope } from 'lucide-react';

import { useAuthSession } from '@/contexts/AuthSessionContext';
import { useProfile } from '@/contexts/ProfileContext';

type MemberAgentStatus = {
  hasBoundDoctor: boolean;
  doctor: {
    id: string;
    realName: string;
    hospitalName: string;
    departmentName: string;
    title: string;
  } | null;
  doctorBotStatus: 'published' | 'disabled' | 'missing';
  doctorBotSlug: string | null;
  doctorBot: {
    id: string;
    assistantName: string;
    avatarUrl: string;
    publicSlug: string;
  } | null;
  agentMode: 'doctor_bot' | 'generic_self_service';
};

export default function PatientAgentEntryCard() {
  const { isAuthenticated, isPatient, isDoctor, authHeaders } = useAuthSession();
  const { profile } = useProfile();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<MemberAgentStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      if (!isAuthenticated || !isPatient || !profile.id) {
        setStatus(null);
        return;
      }

      setLoading(true);
      try {
        const response = await fetch(`/api/me/members/${encodeURIComponent(profile.id)}/agent-status`, {
          headers: authHeaders,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error || 'Failed to load member agent status');
        }

        if (!cancelled) {
          setStatus(payload as MemberAgentStatus);
        }
      } catch {
        if (!cancelled) {
          setStatus(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadStatus();

    return () => {
      cancelled = true;
    };
  }, [authHeaders, isAuthenticated, isPatient, profile.id]);

  if (isDoctor) {
    return null;
  }

  const primary = isAuthenticated && isPatient && status?.doctorBotStatus === 'published'
    ? {
        title: '进入医生智能体',
        description: `当前成员已绑定 ${status.doctor?.realName}，可直接进入医生分身模式。`,
        href: '/agent?mode=doctor_bot',
        icon: <Stethoscope className="h-5 w-5" />,
        tone: 'bg-cyan-50 text-cyan-700',
      }
    : isAuthenticated && isPatient && status?.hasBoundDoctor
      ? {
          title: '当前医生未设置智能体',
          description: `${status.doctor?.realName} 当前还没有发布医生智能体，你仍可继续使用自助智能体。`,
          href: '#user-center',
          icon: <Link2 className="h-5 w-5" />,
          tone: 'bg-amber-50 text-amber-700',
        }
      : isAuthenticated && isPatient
        ? {
            title: '绑定医生可体验医生智能体',
            description: '先为当前成员绑定主治医生，绑定后若医生已发布分身，即可进入医生智能体。',
            href: '#user-center',
            icon: <Link2 className="h-5 w-5" />,
            tone: 'bg-indigo-50 text-indigo-700',
          }
        : {
            title: '自助智能体',
            description: '未登录时可先体验自助智能体；登录并绑定医生后，还可进入医生专属智能体。',
            href: '/agent?mode=self_service',
            icon: <Bot className="h-5 w-5" />,
            tone: 'bg-slate-100 text-slate-700',
          };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-slate-900">
        <Sparkles className="h-5 w-5 text-indigo-600" />
        <h2 className="text-lg font-semibold">智能体入口</h2>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>正在同步当前成员的智能体状态...</span>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <a
            href={primary.href}
            className="group rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5 transition-all hover:border-cyan-300 hover:bg-white hover:shadow-sm"
          >
            <div className={`inline-flex rounded-2xl p-3 ${primary.tone}`}>{primary.icon}</div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">{primary.title}</h3>
              <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-700" />
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">{primary.description}</p>
          </a>

          <a
            href="/agent?mode=self_service"
            className="group rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5 transition-all hover:border-indigo-300 hover:bg-white hover:shadow-sm"
          >
            <div className="inline-flex rounded-2xl bg-indigo-50 p-3 text-indigo-700">
              <Bot className="h-5 w-5" />
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900">进入自助智能体</h3>
              <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-indigo-700" />
            </div>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              保留原有 `/agent` 自助版功能，用于自助分诊、推荐量表和站内无感填表。
            </p>
          </a>
        </div>
      )}
    </div>
  );
}
