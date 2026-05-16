'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { useAuthSession } from '@/contexts/AuthSessionContext';
import type { LanguageCode } from '@/lib/schemas/core/types';
import { getOrCreateGuestSessionId } from '@/lib/utils/guestSession';

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
  realName?: string;
  contactPhone?: string;
  pendingClaim?: boolean;
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
    mood: 'normal',
  },
  completedScales: [],
};

const GUEST_STORAGE_KEY = 'guest_temp_subject_state';
const LEGACY_STORAGE_KEY = 'member_profiles_state';
const LEGACY_PROFILE_KEY = 'child_profile';

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
    phone: string;
    password: string;
    email?: string;
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

function getInitialState(overrides?: Partial<StoredProfileState>): StoredProfileState {
  return {
    profiles: [DEFAULT_PROFILE],
    activeProfileId: DEFAULT_PROFILE.id,
    accountRole: 'GUEST',
    isGuest: true,
    dailyLimit: 5,
    ...overrides,
  };
}

function resolveActiveProfile(state: StoredProfileState): UserProfile {
  return state.profiles.find((item) => item.id === state.activeProfileId) || state.profiles[0] || DEFAULT_PROFILE;
}

function persistGuestState(state: StoredProfileState) {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(state));
}

function loadGuestState(): StoredProfileState {
  if (typeof window === 'undefined') {
    return getInitialState();
  }

  const current = window.sessionStorage.getItem(GUEST_STORAGE_KEY);
  if (current) {
    try {
      const parsed = JSON.parse(current) as StoredProfileState;
      return {
        ...parsed,
        profiles: parsed.profiles.map(ensureProfileDefaults),
      };
    } catch (error) {
      console.error('Failed to parse guest temp state', error);
    }
  }

  const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (legacy) {
    try {
      const parsed = JSON.parse(legacy) as StoredProfileState;
      const migrated = {
        ...parsed,
        profiles: parsed.profiles.map(ensureProfileDefaults),
        isGuest: true,
        accountRole: 'GUEST' as const,
      };
      persistGuestState(migrated);
      return migrated;
    } catch (error) {
      console.error('Failed to parse legacy profile state', error);
    }
  }

  const legacyProfile = window.localStorage.getItem(LEGACY_PROFILE_KEY);
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
      const migratedState = getInitialState({
        profiles: [migratedProfile],
        activeProfileId: migratedProfile.id,
      });
      persistGuestState(migratedState);
      return migratedState;
    } catch (error) {
      console.error('Failed to migrate legacy profile', error);
    }
  }

  const fallback = getInitialState();
  persistGuestState(fallback);
  return fallback;
}

function mapServerProfile(profile: any): UserProfile {
  return ensureProfileDefaults({
    id: profile.id,
    relation: (profile.relation || 'self').toLowerCase(),
    languagePreference: (profile.languagePreference || 'zh').toLowerCase(),
    nickname: profile.nickname,
    realName: profile.realName || undefined,
    contactPhone: profile.contactPhone || undefined,
    pendingClaim: profile.pendingClaim ?? false,
    gender: profile.gender === 'girl' ? 'girl' : 'boy',
    ageMonths: profile.ageMonths ?? DEFAULT_PROFILE.ageMonths,
    interests: profile.interests || [],
    fears: profile.fears || [],
    avatarState: profile.avatarConfig || DEFAULT_PROFILE.avatarState,
    completedScales: profile.completedScales || [],
  });
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { authHeaders, isAuthenticated, isPatient, isDoctor, loading: authLoading, user } = useAuthSession();
  const [state, setState] = useState<StoredProfileState>(getInitialState());
  const [isLoaded, setIsLoaded] = useState(false);

  const applyServerPayload = useCallback((payload: any) => {
    const serverProfiles = Array.isArray(payload?.profiles) && payload.profiles.length > 0
      ? payload.profiles.map(mapServerProfile)
      : [DEFAULT_PROFILE];

    setState({
      profiles: serverProfiles,
      activeProfileId: payload?.activeProfileId || serverProfiles[0].id,
      accountRole: payload?.user?.role || 'REGISTERED',
      isGuest: payload?.user?.isGuest ?? false,
      dailyLimit: payload?.user?.dailyLimit ?? 10,
      phone: payload?.user?.phone || undefined,
      email: payload?.user?.email || undefined,
    });
  }, []);

  const syncMember = useCallback(async (payload: Partial<UserProfile> & { id?: string }) => {
    if (!isAuthenticated || !isPatient) {
      return;
    }

    const response = await fetch('/api/skill/v1/profile/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        memberId: payload.id,
        relation: payload.relation,
        languagePreference: payload.languagePreference,
        nickname: payload.nickname,
        realName: payload.realName,
        contactPhone: payload.contactPhone,
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
  }, [applyServerPayload, authHeaders, isAuthenticated, isPatient]);

  const refreshProfiles = useCallback(async () => {
    if (authLoading) {
      return;
    }

    if (isAuthenticated && isPatient) {
      const response = await fetch('/api/skill/v1/profile/sync', {
        headers: authHeaders,
      });

      if (!response.ok) {
        throw new Error('获取成员档案失败');
      }

      const data = await response.json();
      applyServerPayload(data);
      return;
    }

    if (isAuthenticated && isDoctor) {
      setState(getInitialState({
        accountRole: (user?.role as AccountRole) || 'REGISTERED',
        isGuest: false,
        dailyLimit: 10,
        phone: user?.phone || undefined,
        email: user?.email || undefined,
      }));
      return;
    }

    setState(loadGuestState());
  }, [applyServerPayload, authHeaders, authLoading, isAuthenticated, isDoctor, isPatient, user]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    let active = true;

    void refreshProfiles()
      .catch((error) => {
        console.error('Failed to initialize profile context:', error);
        if (!active) {
          return;
        }
        if (!isAuthenticated) {
          setState(loadGuestState());
        } else {
          setState(getInitialState({
            accountRole: (user?.role as AccountRole) || 'REGISTERED',
            isGuest: false,
            dailyLimit: 10,
            phone: user?.phone || undefined,
            email: user?.email || undefined,
          }));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, [authLoading, isAuthenticated, refreshProfiles, user]);

  const selectProfile = useCallback((profileId: string) => {
    setState((prev) => {
      const next = { ...prev, activeProfileId: profileId };
      if (prev.isGuest) {
        persistGuestState(next);
      }
      return next;
    });
  }, []);

  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setState((prev) => {
      const activeProfile = resolveActiveProfile(prev);
      const nextProfile = ensureProfileDefaults({ ...activeProfile, ...updates });
      const nextProfiles = prev.profiles.map((item) => (item.id === nextProfile.id ? nextProfile : item));
      const nextState = { ...prev, profiles: nextProfiles };

      if (prev.isGuest || !isAuthenticated || !isPatient) {
        persistGuestState(nextState);
      } else {
        void syncMember(nextProfile).catch((error) => {
          console.error('Failed to sync member profile:', error);
        });
      }

      return nextState;
    });
  }, [isAuthenticated, isPatient, syncMember]);

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
      const nextProfiles = prev.profiles.map((item) => (item.id === nextProfile.id ? nextProfile : item));
      const nextState = { ...prev, profiles: nextProfiles };

      if (prev.isGuest || !isAuthenticated || !isPatient) {
        persistGuestState(nextState);
      } else {
        void syncMember(nextProfile).catch((error) => {
          console.error('Failed to sync avatar state:', error);
        });
      }

      return nextState;
    });
  }, [isAuthenticated, isPatient, syncMember]);

  const createProfile = useCallback(async (profileInput: Partial<UserProfile>) => {
    if (!isAuthenticated || !isPatient) {
      throw new Error('请先登录后再创建家庭成员档案');
    }

    const nextProfile = ensureProfileDefaults({
      ...DEFAULT_PROFILE,
      ...profileInput,
      id: profileInput.id || crypto.randomUUID(),
    });

    setState((prev) => ({
      ...prev,
      profiles: [...prev.profiles, nextProfile],
      activeProfileId: nextProfile.id,
    }));

    await syncMember(nextProfile);
  }, [isAuthenticated, isPatient, syncMember]);

  const upgradeAccount = useCallback(async (payload: {
    phone: string;
    password: string;
    email?: string;
    profile?: Partial<UserProfile>;
  }) => {
    const guestSessionId = getOrCreateGuestSessionId();
    const response = await fetch('/api/skill/v1/account/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guestSessionId,
        phone: payload.phone,
        password: payload.password,
        email: payload.email,
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

  const value = useMemo<ProfileContextType>(() => ({
    profile: resolveActiveProfile(state),
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
  }), [createProfile, refreshProfiles, selectProfile, state, updateAvatar, updateProfile, upgradeAccount]);

  if (!isLoaded) {
    return null;
  }

  return (
    <ProfileContext.Provider value={value}>
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
