import type { AuthUser, DoctorProfile } from '@/types';

const STORAGE_KEY_TOKEN = 'app_user_token';
const STORAGE_KEY_PHONE = 'app_last_phone';

type ApiError = Error & {
  code?: string;
  status?: number;
};

type ServerDoctorProfile = {
  id: string;
  realName?: string | null;
  name?: string | null;
  hospitalName?: string | null;
  departmentName?: string | null;
  title?: string | null;
  verificationStatus?: string | null;
};

type ServerAuthUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  accountType?: 'PATIENT' | 'DOCTOR' | string | null;
  doctorProfile?: ServerDoctorProfile | null;
};

type AuthResponse = {
  success?: boolean;
  token?: string;
  user?: ServerAuthUser;
  error?: string;
};

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

function apiUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: text };
  }
}

function createApiError(message: string, status?: number): ApiError {
  const error = new Error(message) as ApiError;
  error.status = status;
  if (status === 404) {
    error.code = 'PHONE_NOT_REGISTERED';
  }
  return error;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(apiUrl(path), {
    ...init,
    headers,
  });
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    throw createApiError(
      String(data.error || data.message || `请求失败（${response.status}）`),
      response.status,
    );
  }

  return data as T;
}

function normalizeDoctorProfile(profile: ServerDoctorProfile | null | undefined): DoctorProfile | null {
  if (!profile) return null;

  return {
    id: profile.id,
    name: profile.realName || profile.name || '医生',
    department: profile.departmentName || undefined,
    verificationStatus:
      profile.verificationStatus === 'APPROVED' ||
      profile.verificationStatus === 'PENDING' ||
      profile.verificationStatus === 'REJECTED'
        ? profile.verificationStatus
        : 'PENDING',
  };
}

function normalizeAuthUser(user: ServerAuthUser): AuthUser {
  const accountType = user.accountType === 'DOCTOR' ? 'DOCTOR' : 'PATIENT';
  const doctorProfile = normalizeDoctorProfile(user.doctorProfile);

  return {
    id: user.id,
    phone: user.phone || '',
    email: user.email || undefined,
    name: doctorProfile?.name || user.phone || user.email || '用户',
    accountType,
    isDoctor: accountType === 'DOCTOR' || Boolean(doctorProfile),
    isPatient: accountType === 'PATIENT',
    doctorProfile,
  };
}

function storeSession(token: string, phone?: string) {
  localStorage.setItem(STORAGE_KEY_TOKEN, token);
  if (phone) {
    localStorage.setItem(STORAGE_KEY_PHONE, phone);
  }
}

function assertAuthPayload(data: AuthResponse): { token: string; user: AuthUser } {
  if (!data.token || !data.user) {
    throw createApiError(data.error || '登录响应缺少 token 或用户信息');
  }

  return {
    token: data.token,
    user: normalizeAuthUser(data.user),
  };
}

export async function sendSmsCode(phone: string): Promise<{ success: boolean }> {
  if (!/^1\d{10}$/.test(phone)) {
    throw createApiError('手机号格式不正确', 400);
  }

  await apiRequest('/api/auth/sms/send-code', {
    method: 'POST',
    body: JSON.stringify({ phone, purpose: 'login' }),
  });

  return { success: true };
}

export async function loginWithSms(
  phone: string,
  code: string,
): Promise<{ token: string; user: AuthUser }> {
  const session = assertAuthPayload(
    await apiRequest<AuthResponse>('/api/auth/login-sms', {
      method: 'POST',
      body: JSON.stringify({ phone, code }),
    }),
  );

  storeSession(session.token, phone);
  return session;
}

export async function loginWithPassword(
  identifier: string,
  password: string,
): Promise<{ token: string; user: AuthUser }> {
  const accountTypes: Array<'PATIENT' | 'DOCTOR'> = ['PATIENT', 'DOCTOR'];
  let lastError: unknown;

  for (const accountType of accountTypes) {
    try {
      const session = assertAuthPayload(
        await apiRequest<AuthResponse>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({
            accountType,
            identifier,
            phone: /^1\d{10}$/.test(identifier) ? identifier : undefined,
            email: identifier.includes('@') ? identifier : undefined,
            password,
          }),
        }),
      );

      storeSession(session.token, /^1\d{10}$/.test(identifier) ? identifier : undefined);
      return session;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : createApiError('登录失败，请检查账号和密码');
}

export async function loginAsGuest(): Promise<{
  token: string;
  user: AuthUser;
  deviceId: string;
}> {
  throw createApiError('游客模式需要后端签发真实会话，当前暂未开放', 501);
}

export async function restoreSession(): Promise<{
  token: string;
  user: AuthUser;
} | null> {
  const token =
    localStorage.getItem(STORAGE_KEY_TOKEN) ||
    sessionStorage.getItem(STORAGE_KEY_TOKEN);

  if (!token) return null;

  try {
    const data = await apiRequest<{ success?: boolean; user?: ServerAuthUser }>('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!data.user) {
      throw createApiError('会话响应缺少用户信息');
    }

    return {
      token,
      user: normalizeAuthUser(data.user),
    };
  } catch (error) {
    logout();
    return null;
  }
}

export function logout(): void {
  localStorage.removeItem(STORAGE_KEY_TOKEN);
  sessionStorage.removeItem(STORAGE_KEY_TOKEN);
}

export function getStoredPhone(): string {
  return localStorage.getItem(STORAGE_KEY_PHONE) || '';
}

export async function verifyDoctorPin(pin: string): Promise<boolean> {
  const data = await apiRequest<{ success?: boolean }>('/api/doctor/mobile/reauth', {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ pin }),
  });
  return Boolean(data.success);
}

export function getAuthHeaders(): HeadersInit {
  const token =
    localStorage.getItem(STORAGE_KEY_TOKEN) ||
    sessionStorage.getItem(STORAGE_KEY_TOKEN);
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
