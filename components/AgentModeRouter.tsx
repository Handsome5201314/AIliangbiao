'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { useAuthSession } from '@/contexts/AuthSessionContext';
import { useProfile } from '@/contexts/ProfileContext';
import ConversationShell from '@/components/ConversationShell';

type MemberAgentStatus = {
  hasBoundDoctor: boolean;
  doctorBotStatus: 'published' | 'disabled' | 'missing';
  doctorBotSlug: string | null;
  agentMode: 'doctor_bot' | 'generic_self_service';
};

export default function AgentModeRouter() {
  const searchParams = useSearchParams();
  const { isAuthenticated, isPatient, authHeaders } = useAuthSession();
  const { profile } = useProfile();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<MemberAgentStatus | null>(null);

  const forcedMode = searchParams.get('mode');
  const explicitDoctorBotSlug = searchParams.get('doctorBotSlug') || searchParams.get('slug') || '';
  const publicShareSlug = forcedMode === 'public_share' ? explicitDoctorBotSlug : '';

  useEffect(() => {
    let cancelled = false;

    async function loadStatus() {
      if (forcedMode === 'public_share' && publicShareSlug) {
        setStatus({
          hasBoundDoctor: false,
          doctorBotStatus: 'published',
          doctorBotSlug: publicShareSlug,
          agentMode: 'doctor_bot',
        });
        setLoading(false);
        return;
      }

      if (forcedMode === 'self_service') {
        setStatus(null);
        setLoading(false);
        return;
      }

      if (explicitDoctorBotSlug) {
        setStatus({
          hasBoundDoctor: false,
          doctorBotStatus: 'published',
          doctorBotSlug: explicitDoctorBotSlug,
          agentMode: 'doctor_bot',
        });
        setLoading(false);
        return;
      }

      if (!isAuthenticated || !isPatient || !profile.id) {
        setStatus(null);
        setLoading(false);
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
  }, [authHeaders, explicitDoctorBotSlug, forcedMode, isAuthenticated, isPatient, profile.id, publicShareSlug]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-indigo-600" />
          <p className="mt-3 text-sm text-slate-500">正在准备患者智能体...</p>
        </div>
      </div>
    );
  }

  if (forcedMode === 'doctor_bot' && status?.doctorBotSlug) {
    return <ConversationShell mode="doctor_bot" slug={status.doctorBotSlug} />;
  }

  if (forcedMode === 'public_share' && publicShareSlug) {
    return <ConversationShell mode="public_share" slug={publicShareSlug} />;
  }

  if (status?.agentMode === 'doctor_bot' && status.doctorBotSlug && forcedMode !== 'self_service') {
    return <ConversationShell mode="doctor_bot" slug={status.doctorBotSlug} />;
  }

  return <ConversationShell mode="self_service" />;
}
