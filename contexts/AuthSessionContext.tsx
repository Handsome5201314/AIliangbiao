'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

type AuthUser = {
  id: string;
  email?: string;
  phone?: string;
  role: 'GUEST' | 'REGISTERED' | 'VIP';
  accountType: 'PATIENT' | 'DOCTOR';
  doctorProfile?: {
    id: string;
    verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
    realName: string;
    hospitalName: string;
    departmentName: string;
    title: string;
  } | null;
};

interface AuthSessionContextValue {
  token: string;
  user: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  isDoctor: boolean;
  isPatient: boolean;
  authHeaders: HeadersInit;
  login: (token: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const STORAGE_KEY = 'app_user_token';
const AuthSessionContext = createContext<AuthSessionContextValue | undefined>(undefined);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState('');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const currentToken = localStorage.getItem(STORAGE_KEY);
    if (!currentToken) {
      setToken('');
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${currentToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Session expired');
      }

      const data = await response.json();
      setToken(currentToken);
      setUser(data.user);
    } catch (error) {
      localStorage.removeItem(STORAGE_KEY);
      setToken('');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (nextToken: string) => {
    localStorage.setItem(STORAGE_KEY, nextToken);
    setToken(nextToken);
    await refresh();
  }, [refresh]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setToken('');
    setUser(null);
  }, []);

  const value = useMemo<AuthSessionContextValue>(() => ({
    token,
    user,
    loading,
    isAuthenticated: Boolean(token && user),
    isDoctor: user?.accountType === 'DOCTOR',
    isPatient: user?.accountType === 'PATIENT',
    authHeaders: token ? ({ Authorization: `Bearer ${token}` } as Record<string, string>) : {},
    login,
    logout,
    refresh,
  }), [login, loading, logout, refresh, token, user]);

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);
  if (!context) {
    throw new Error('useAuthSession must be used within AuthSessionProvider');
  }
  return context;
}
