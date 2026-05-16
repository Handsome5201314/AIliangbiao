'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';

import FastgptKnowledgePanel from '@/components/FastgptKnowledgePanel';
import { useAuthSession } from '@/contexts/AuthSessionContext';
import { useProfile } from '@/contexts/ProfileContext';
import { getOrCreateGuestSessionId, peekGuestSessionId } from '@/lib/utils/guestSession';
import { generateUUID } from '@/lib/utils/uuid';

function getSessionDeviceId(isAuthenticated: boolean) {
  if (isAuthenticated) {
    return peekGuestSessionId() || generateUUID();
  }

  return getOrCreateGuestSessionId();
}

export default function AgentKnowledgePage() {
  const searchParams = useSearchParams();
  const { authHeaders, isAuthenticated } = useAuthSession();
  const { profile } = useProfile();
  const language = (profile.languagePreference || 'zh') as 'zh' | 'en';

  const deviceId = useMemo(() => getSessionDeviceId(isAuthenticated), [isAuthenticated]);
  const memberId = searchParams.get('memberId') || profile.id;
  const initialExpertKey = searchParams.get('expert') || '';

  return (
    <FastgptKnowledgePanel
      isOpen
      standalone
      onClose={() => {}}
      authHeaders={authHeaders}
      deviceId={deviceId}
      memberId={memberId}
      memberSnapshot={{
        nickname: profile.nickname,
        gender: profile.gender,
        ageMonths: profile.ageMonths,
        relation: profile.relation,
        languagePreference: profile.languagePreference,
        interests: profile.interests,
        fears: profile.fears,
        avatarConfig: profile.avatarState,
      }}
      language={language}
      closeHref="/agent"
      initialExpertKey={initialExpertKey}
    />
  );
}
