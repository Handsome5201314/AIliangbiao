import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import type { AuthUser } from '@/components/mobile-h5/types';
import * as authApi from '@/components/mobile-h5/services/authService';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isDoctor: boolean;
  isPatient: boolean;
  isGuest: boolean;
  isSharedDevice: boolean;
  isLocked: boolean;
  authHeaders: HeadersInit;
  loading: boolean;
  login: (token: string, user: AuthUser) => void;
  loginAsGuest: () => Promise<void>;
  logout: () => void;
  lockScreen: () => void;
  unlockScreen: () => void;
  setSharedDevice: (value: boolean) => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

// ─── Provider ──────────────────────────────────────────────────────────────────

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isSharedDevice, setIsSharedDevice] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const session = await authApi.restoreSession();
        if (session) {
          setUser(session.user);
          setToken(session.token);
        }
      } catch {
        // Token invalid — stay unauthenticated
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Doctor idle timer — lock after 30 minutes of inactivity
  useEffect(() => {
    if (!user?.isDoctor || !token) return;

    const resetTimer = () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        setIsLocked(true);
      }, 30 * 60 * 1000); // 30 minutes
    };

    const events = ['touchstart', 'keydown', 'scroll'];
    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [user?.isDoctor, token]);

  // Cross-tab sync: if another tab logs out, sync
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'app_user_token' && !e.newValue) {
        setUser(null);
        setToken(null);
        setIsLocked(false);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const login = useCallback((newToken: string, newUser: AuthUser) => {
    setToken(newToken);
    setUser(newUser);
    setIsLocked(false);
  }, []);

  const loginAsGuest = useCallback(async () => {
    const result = await authApi.loginAsGuest();
    setToken(result.token);
    setUser(result.user);
    setIsLocked(false);
  }, []);

  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
    setToken(null);
    setIsLocked(false);
    setIsSharedDevice(false);
  }, []);

  const lockScreen = useCallback(() => setIsLocked(true), []);
  const unlockScreen = useCallback(() => setIsLocked(false), []);

  const authHeaders: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

  const value: AuthState = {
    user,
    token,
    isAuthenticated: !!token && !!user,
    isDoctor: user?.isDoctor ?? false,
    isPatient: user?.isPatient ?? false,
    isGuest: user?.isGuest ?? false,
    isSharedDevice,
    isLocked,
    authHeaders,
    loading,
    login,
    loginAsGuest,
    logout,
    lockScreen,
    unlockScreen,
    setSharedDevice: setIsSharedDevice,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useAuthSession(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuthSession must be used within AuthSessionProvider');
  }
  return ctx;
}
