'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

// 1. 定义用户画像数据结构
export interface AvatarState {
  baseModel: string;
  headwear: 'none' | 'hu_tou_mao' | 'flower';
  clothing: 'tang_suit' | 'hanfu_blue';
  mood: 'happy' | 'nervous' | 'curious' | 'normal';
}

export interface UserProfile {
  nickname: string;
  gender: 'boy' | 'girl';
  ageMonths: number;
  interests: string[];
  fears: string[];
  avatarState: AvatarState;
  completedScales: string[];
}

// 默认画像（新用户初始状态）
const DEFAULT_PROFILE: UserProfile = {
  nickname: '宝宝',
  gender: 'boy',
  ageMonths: 36,
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

// 2. 创建 Context
interface ProfileContextType {
  profile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => void;
  updateAvatar: (updates: Partial<AvatarState>) => void;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

// 3. Provider 组件
export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [isLoaded, setIsLoaded] = useState(false);

  // 页面加载时从 LocalStorage 读取记忆，并尝试从数据库同步
  useEffect(() => {
    const loadProfile = async () => {
      // 获取或生成 deviceId
      let deviceId = localStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('device_id', deviceId);
      }

      // 尝试从数据库加载画像（优先级高于本地）
      try {
        const response = await fetch(`/api/profile/sync?deviceId=${deviceId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.profile) {
            // 数据库有数据，使用数据库数据
            setProfile({
              nickname: data.profile.nickname,
              gender: data.profile.gender,
              ageMonths: data.profile.ageMonths || 36,
              interests: data.profile.interests || [],
              fears: data.profile.fears || [],
              avatarState: data.profile.avatarConfig || DEFAULT_PROFILE.avatarState,
              completedScales: DEFAULT_PROFILE.completedScales,
            });
            setIsLoaded(true);
            return;
          }
        }
      } catch (error) {
        console.error('Failed to load profile from database:', error);
      }

      // 数据库无数据或加载失败，使用本地存储
      const saved = localStorage.getItem('child_profile');
      if (saved) {
        try {
          setProfile(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse profile", e);
        }
      }
      setIsLoaded(true);
    };

    loadProfile();
  }, []);

  // 🔧 修复：使用 useCallback 稳定函数，防止无限循环
  // 保存更新到 LocalStorage 并同步到数据库（使用函数式更新，无需依赖 profile）
  const updateProfile = useCallback((updates: Partial<UserProfile>) => {
    setProfile(prev => {
      const next = { ...prev, ...updates };
      localStorage.setItem('child_profile', JSON.stringify(next));
      
      // 异步同步到数据库（不阻塞UI）
      const deviceId = localStorage.getItem('device_id');
      if (deviceId) {
        fetch('/api/profile/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId,
            nickname: next.nickname,
            gender: next.gender,
            ageMonths: next.ageMonths,
            interests: next.interests,
            fears: next.fears,
            avatarConfig: next.avatarState,
          }),
        }).catch(err => console.error('Failed to sync profile:', err));
      }
      
      return next;
    });
  }, []); // 👈 空依赖数组，函数永不改变

  // 更新头像状态（使用函数式更新，无需依赖 profile）
  const updateAvatar = useCallback((updates: Partial<AvatarState>) => {
    setProfile(prev => {
      const next = {
        ...prev,
        avatarState: { ...prev.avatarState, ...updates }
      };
      localStorage.setItem('child_profile', JSON.stringify(next));
      
      // 异步同步到数据库
      const deviceId = localStorage.getItem('device_id');
      if (deviceId) {
        fetch('/api/profile/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId,
            nickname: next.nickname,
            gender: next.gender,
            ageMonths: next.ageMonths,
            interests: next.interests,
            fears: next.fears,
            avatarConfig: next.avatarState,
          }),
        }).catch(err => console.error('Failed to sync avatar:', err));
      }
      
      return next;
    });
  }, []); // 👈 空依赖数组，函数永不改变

  if (!isLoaded) return null; // 防止 hydration 不匹配

  return (
    <ProfileContext.Provider value={{ profile, updateProfile, updateAvatar }}>
      {children}
    </ProfileContext.Provider>
  );
}

// 4. Hook 导出
export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
