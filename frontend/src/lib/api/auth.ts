import { api, tokenStore } from './client';
import { readJson, writeJson } from '../storage';

/** Copy of the guest device token, for browsers that block the cross-site cookie. */
const GUEST_DEVICE_KEY = 'bitnbuild:guest-device';
const isToken = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{32,128}$/.test(v);
import type { AuthResponse, AuthUser, RegisterRequest } from '../types/api';

export const authApi = {
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const result = await api.post<AuthResponse>('/auth/register', data, { skipAuth: true });
    tokenStore.set(result.accessToken);
    return result;
  },

  login: async (email: string, password: string): Promise<AuthResponse> => {
    const result = await api.post<AuthResponse>('/auth/login', { email, password }, { skipAuth: true });
    tokenStore.set(result.accessToken);
    return result;
  },

  /** Starts a guest visit (no account). */
  guest: async (): Promise<AuthResponse> => {
    const deviceToken = readJson(GUEST_DEVICE_KEY, isToken);
    const result = await api.post<AuthResponse>('/auth/guest', deviceToken ? { deviceToken } : {}, { skipAuth: true });
    tokenStore.set(result.accessToken);
    if (result.deviceToken) writeJson(GUEST_DEVICE_KEY, result.deviceToken);
    return result;
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } finally {
      tokenStore.clear();
    }
  },

  me: () => api.get<AuthUser>('/auth/me'),
};
