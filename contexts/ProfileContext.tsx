'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import type { LanguageCode } from '@/lib/schemas/core/types';

export interface AvatarState {
  baseModel: string;
  headwear: 'none' | 'hu_tou_mao' | 'flower';
  clothing: 'tang_suit' | 'hanfu_blue';
  mood: 'happy' | 'nervous' | 'curious' | 'normal';
}

export type MemberRelation = 'self' | 'child' | 'parent' | 'spouse' | 'sibling' | 'other';
export type AccountRole = 'GUEST' | 'REGISTERED' | 'VIP';

export interface UserProfile {
  id: string;
  relation: MemberRelation;
  languagePreference: LanguageCode;
  nickname: string;
  gender: 'boy' | 'girl';
  ageMonths: number;
  interests: string[];
  fears: string[];
  avatarState: AvatarState;
  completedScales: string[];
}

interface StoredProfileState {
  profiles: UserProfile[];
  activeProfileId: string;
  accountRole: AccountRole;
  isGuest: boolean;
  dailyLimit: number;
  phone?: string;
  email?: string;
}

const DEFAULT_PROFILE: UserProfile = {
  id: 'local-self',
  relation: 'self',
  languagePreference: 'zh',
  nickname: '本人',
  gender: 'boy',
  ageMonths: 360,
  interests: [],
  fears: [],
  avatarState: {
    baseModel: 'default',
    headwear: 'none',
    clothing: 'tang_suit',
    mood: 'normal'
  },
  completedScales: []
};

const STORAGE_KEY = 'member_profiles_state';
const LEGACY_STORAGE_KEY = 'child_profile';

interface ProfileContextType {
  profile: UserProfile;
  profiles: UserProfile[];
  activeProfileId: string;
  accountRole: AccountRole;
  isGuest: boolean;
  dailyLimit: number;
  phone?: string;
  email?: string;
  updateProfile: (updates: Partial<UserProfile>) => void;
  updateAvatar: (updates: Partial<AvatarState>) => void;
  selectProfile: (profileId: string) => void;
  createProfile: (profile: Partial<UserProfile>) => Promise<void>;
  upgradeAccount: (payload: {
    email?: string;
    password: string;
    consentAccepted: boolean;
    consentVersion: string;
    profile?: Partial<UserProfile>;
  }) => Promise<void>;
  refreshProfiles: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

function ensureProfileDefaults(profile: Partial<UserProfile> & { id?: string }): UserProfile {
  return {
    ...DEFAULT_PROFILE,
    ...profile,
    id: profile.id || crypto.randomUUID(),
    relation: profile.relation || DEFAULT_PROFILE.relation,
    languagePreference: profile.languagePreference || DEFAULT_PROFILE.languagePreference,
    nickname: profile.nickname || DEFAULT_PROFILE.nickname,
    gender: profile.gender || DEFAULT_PROFILE.gender,
    ageMonths: profile.ageMonths ?? DEFAULT_PROFILE.ageMonths,
    interests: profile.interests || [],
    fears: profile.fears || [],
    avatarState: { ...DEFAULT_PROFILE.avatarState, ...(profile.avatarState || {}) },
    completedScales: profile.completedScales || [],
  };
}

function getInitialState(): StoredProfileState {
  return {
    profiles: [DEFAULT_PROFILE],
    activeProfileId: DEFAULT_PROFILE.id,
    accountRole: 'GUEST',
    isGuest: true,
    dailyLimit: 5,
  };
}

function getDeviceId(): string {
  let deviceId = localStorage.getItem('device_id');
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem('device_id', deviceId);
  }
  return deviceId;
}

function resolveActiveProfile(state: StoredProfileState): UserProfile {
  return state.profiles.find((item) => item.id === state.activeProfileId) || state.profiles[0] || DEFAULT_PROFILE;
}

function persistState(state: StoredProfileState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function mapServerProfile(profile: any): UserProfile {
  return ensureProfileDefaults({
    id: profile.id,
    relation: (profile.relation || 'self').toLowerCase(),
    languagePreference: (profile.languagePreference || 'zh').toLowerCase(),
    nickname: profile.nickname,
    gender: profile.gender === 'girl' ? 'girl' : 'boy',
    ageMonths: profile.ageMonths ?? DEFAULT_PROFILE.ageMonths,
    interests: profile.interests || [],
    fears: profile.fears || [],
    avatarState: profile.avatarConfig || DEFAULT_PROFILE.avatarState,
    completedScales: profile.completedScales || [],
  });
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<StoredProfileState>(getInitialState());

  const applyServerPayload = useCallback((payload: any) => {
    const serverProfiles = Array.isArray(payload?.profiles) && payload.profiles.length > 0
      ? payload.profiles.map(mapServerProfile)
      : [DEFAULT_PROFILE];
    const nextState: StoredProfileState = {
      profiles: serverProfiles,
      activeProfileId: payload?.activeProfileId || serverProfiles[0].id,
      accountRole: payload?.user?.role || 'GUEST',
      isGuest: payload?.user?.isGuest ?? true,
      dailyLimit: payload?.user?.dailyLimit ?? 5,
      phone: payload?.user?.phone || undefined,
      email: payload?.user?.email || undefined,
    };
    setState(nextState);
    persistState(nextState);
  }, []);

  const refreshProfiles = useCallback(async () => {
    const deviceId = getDeviceId();
    const response = await fetch(`/api/skill/v1/profile/sync?deviceId=${deviceId}`);
    if (!response.ok) {
      throw new Error('获取成员档案失败');
    }
    const data = await response.json();
    if (data.profiles?.length) {
      applyServerPayload(data);
    }
  }, [applyServerPayload]);

  useEffect(() => {
    const loadLocalProfileState = () => {
      const savedState = localStorage.getItem(STORAGE_KEY);
      if (savedState) {
        try {
          const parsed = JSON.parse(savedState) as StoredProfileState;
          setState({
            ...parsed,
            profiles: parsed.profiles.map(ensureProfileDefaults),
          });
          return;
        } catch (error) {
          console.error('Failed to parse profile state', error);
        }
      }

      const legacyProfile = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacyProfile) {
        try {
          const parsed = JSON.parse(legacyProfile);
          const migratedProfile = ensureProfileDefaults({
            id: 'local-migrated',
            relation: 'child',
            languagePreference: 'zh',
            nickname: parsed.nickname,
            gender: parsed.gender,
            ageMonths: parsed.ageMonths,
            interests: parsed.interests,
            fears: parsed.fears,
            avatarState: parsed.avatarState,
            completedScales: parsed.completedScales,
          });
          const migratedState: StoredProfileState = {
            profiles: [migratedProfile],
            activeProfileId: migratedProfile.id,
            accountRole: 'GUEST',
            isGuest: true,
            dailyLimit: 5,
          };
          setState(migratedState);
          persistState(migratedState);
          return;
        } catch (error) {
          console.error('Failed to migrate legacy profile', error);
        }
      }

      const fallbackState = getInitialState();
      setState(fallbackState);
      persistState(fallbackState);
    };

    const loadRemoteProfileState = async () => {
      const deviceId = getDeviceId();

      try {
        const response = await fetch(`/api/skill/v1/profile/sync?deviceId=${deviceId}`);
        if (!response.ok) {
          return;
        }

        const data = await response.json();
        if (data.profiles?.length) {
          applyServerPayload(data);
        }
      } catch (error) {
        console.error('Failed to load profiles from database:', error);
      }
    };

    loadLocalProfileState();
    void loadRemoteProfileState();
  }, [applyServerPayload]);

  const selectProfile = useCallback((profileId: string) => {
    setState((prev) => {
      const next = { ...prev, activeProfileId: profileId };
      persistState(next);
      return next;
    });
  }, []);

  const syncMember = useCallback(async (payload: Partial<UserProfile> & { id?: string }) => {
    const deviceId = getDeviceId();
    const response = await fetch('/api/skill/v1/profile/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        memberId: payload.id,
        relation: payload.relation,
        languagePreference: payload.languagePreference,
        nickname: payload.nickname,
        gender: payload.gender,
        ageMonths: payload.ageMonths,
        interests: payload.interests,
        fears: payload.fears,
        avatarConfig: payload.avatarState,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || '同步成员档案失败');
    }

    const data = await response.json();
    if (data.profiles?.length) {
      applyServerPayload(data);
    }
  }, [applyServerPayload]);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setState((prev) => {
      const activeProfile = resolveActiveProfile(prev);
      const nextProfile = ensureProfileDefaults({ ...activeProfile, ...updates });
      const nextProfiles = prev.profiles.map((item) => item.id === nextProfile.id ? nextProfile : item);
      const nextState = { ...prev, profiles: nextProfiles };
      persistState(nextState);

      void syncMember(nextProfile).catch((error) => {
        console.error('Failed to sync member profile:', error);
      });

      return nextState;
    });
  }, [syncMember]);

  const updateAvatar = useCallback((updates: Partial<AvatarState>) => {
    setState((prev) => {
      const activeProfile = resolveActiveProfile(prev);
      const nextProfile = ensureProfileDefaults({
        ...activeProfile,
        avatarState: {
          ...activeProfile.avatarState,
          ...updates,
        },
      });
      const nextProfiles = prev.profiles.map((item) => item.id === nextProfile.id ? nextProfile : item);
      const nextState = { ...prev, profiles: nextProfiles };
      persistState(nextState);

      void syncMember(nextProfile).catch((error) => {
        console.error('Failed to sync avatar state:', error);
      });

      return nextState;
    });
  }, [syncMember]);

  const createProfile = useCallback(async (profileInput: Partial<UserProfile>) => {
    const nextProfile = ensureProfileDefaults({
      ...DEFAULT_PROFILE,
      ...profileInput,
      id: profileInput.id || crypto.randomUUID(),
    });

    setState((prev) => {
      const nextState = {
        ...prev,
        profiles: [...prev.profiles, nextProfile],
        activeProfileId: nextProfile.id,
      };
      persistState(nextState);
      return nextState;
    });

    await syncMember(nextProfile);
  }, [syncMember]);

  const upgradeAccount = useCallback(async (payload: {
    email?: string;
    password: string;
    consentAccepted: boolean;
    consentVersion: string;
    profile?: Partial<UserProfile>;
  }) => {
    const deviceId = getDeviceId();
    const response = await fetch('/api/skill/v1/account/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        email: payload.email,
        password: payload.password,
        consentAccepted: payload.consentAccepted,
        consentVersion: payload.consentVersion,
        profile: payload.profile,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || '注册/登录失败');
    }

    const data = await response.json();
    applyServerPayload(data);
  }, [applyServerPayload]);

  const activeProfile = resolveActiveProfile(state);

  return (
    <ProfileContext.Provider
      value={{
        profile: activeProfile,
        profiles: state.profiles,
        activeProfileId: state.activeProfileId,
        accountRole: state.accountRole,
        isGuest: state.isGuest,
        dailyLimit: state.dailyLimit,
        phone: state.phone,
        email: state.email,
        updateProfile,
        updateAvatar,
        selectProfile,
        createProfile,
        upgradeAccount,
        refreshProfiles,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
