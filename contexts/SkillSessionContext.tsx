'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { useAuthSession } from '@/contexts/AuthSessionContext';
import { useProfile } from '@/contexts/ProfileContext';
import { peekGuestSessionId, getOrCreateGuestSessionId } from '@/lib/utils/guestSession';
import { generateUUID } from '@/lib/utils/uuid';

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

function resolveSkillSessionDeviceId(isAuthenticated: boolean) {
  if (isAuthenticated) {
    return peekGuestSessionId() || generateUUID();
  }

  return getOrCreateGuestSessionId();
}

export function SkillSessionProvider({ children }: { children: ReactNode }) {
  const { authHeaders: appAuthHeaders, isAuthenticated, loading: authLoading } = useAuthSession();
  const { profile, activeProfileId } = useProfile();
  const [state, setState] = useState<SkillSessionState>({
    token: '',
    loading: true,
    error: '',
    memberId: activeProfileId,
  });

  const refreshSkillSession = useCallback(async () => {
    if (authLoading) {
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: '' }));

    try {
      const response = await fetch('/api/agent/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...appAuthHeaders },
        body: JSON.stringify({
          deviceId: resolveSkillSessionDeviceId(isAuthenticated),
          entrypoint: 'app',
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
    appAuthHeaders,
    authLoading,
    isAuthenticated,
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
    if (authLoading) {
      return;
    }

    void refreshSkillSession();
  }, [authLoading, refreshSkillSession]);

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
    throw new Error('useSkillSession must be used within a SkillSessionProvider');
  }
  return context;
}
