import { api, tokenStore } from './client';
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
    const result = await api.post<AuthResponse>('/auth/guest', {}, { skipAuth: true });
    tokenStore.set(result.accessToken);
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
