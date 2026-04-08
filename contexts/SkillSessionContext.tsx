'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useProfile } from '@/contexts/ProfileContext';

type SkillSessionState = {
  token: string;
  loading: boolean;
  error: string;
  memberId: string;
};

type SkillSessionContextValue = SkillSessionState & {
  authHeaders: HeadersInit;
  refreshSkillSession: () => Promise<void>;
};

const SkillSessionContext = createContext<SkillSessionContextValue | undefined>(undefined);

function getDeviceId() {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}

export function SkillSessionProvider({ children }: { children: ReactNode }) {
  const { profile, activeProfileId } = useProfile();
  const [state, setState] = useState<SkillSessionState>({
    token: '',
    loading: true,
    error: '',
    memberId: activeProfileId,
  });

  const refreshSkillSession = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: '' }));

    try {
      const response = await fetch('/api/agent/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId: getDeviceId(),
          memberId: activeProfileId,
          memberSnapshot: {
            nickname: profile.nickname,
            gender: profile.gender,
            ageMonths: profile.ageMonths,
            relation: profile.relation,
            languagePreference: profile.languagePreference,
            interests: profile.interests,
            fears: profile.fears,
            avatarConfig: profile.avatarState,
          },
        }),
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to create skill session');
      }

      setState({
        token: payload.token,
        loading: false,
        error: '',
        memberId: payload.member?.id || activeProfileId,
      });
    } catch (error) {
      setState({
        token: '',
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to create skill session',
        memberId: activeProfileId,
      });
    }
  }, [
    activeProfileId,
    profile.ageMonths,
    profile.avatarState,
    profile.fears,
    profile.gender,
    profile.interests,
    profile.languagePreference,
    profile.nickname,
    profile.relation,
  ]);

  useEffect(() => {
    void refreshSkillSession();
  }, [refreshSkillSession]);

  const value = useMemo<SkillSessionContextValue>(() => ({
    ...state,
    authHeaders: state.token ? ({ Authorization: `Bearer ${state.token}` } as Record<string, string>) : {},
    refreshSkillSession,
  }), [refreshSkillSession, state]);

  return (
    <SkillSessionContext.Provider value={value}>
      {children}
    </SkillSessionContext.Provider>
  );
}

export function useSkillSession() {
  const context = useContext(SkillSessionContext);
  if (!context) {
    throw new Error('useSkillSession must be used within SkillSessionProvider');
  }
  return context;
}
