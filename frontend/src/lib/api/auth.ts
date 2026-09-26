// ==============================================================================
// CogniScale Frontend — Auth API
// ==============================================================================

import { api, tokenStore } from './client';
import {
  AuthResponse,
  AuthUser,
  LoginRequest,
  RegisterRequest,
} from '../types/api';

// Mock fallback data
const MOCK_RESEARCHER: AuthResponse = {
  user: {
    id: 'user-mock-1',
    email: 'researcher@example.com',
    role: 'RESEARCHER',
    isEmailVerified: true,
    isActive: true,
    researcherProfile: {
      id: 'res-mock-1',
      userId: 'user-mock-1',
      institution: 'State University',
      department: 'Cognitive Science',
    },
    createdAt: new Date().toISOString(),
  },
  accessToken: 'mock-access-token',
};

const MOCK_PARTICIPANT: AuthResponse = {
  user: {
    id: 'user-mock-2',
    email: 'participant@example.com',
    role: 'PARTICIPANT',
    isEmailVerified: true,
    isActive: true,
    participantProfile: {
      id: 'part-mock-1',
      userId: 'user-mock-2',
      pseudonymousId: 'pseudo-abc123',
      age: 25,
      qualityRating: 85,
      totalRewardPoints: 120,
      completedSessionsCount: 12,
    },
    createdAt: new Date().toISOString(),
  },
  accessToken: 'mock-access-token',
};

export const authApi = {
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    if (api.useMock) {
      await new Promise(r => setTimeout(r, 600));
      const result = data.role === 'RESEARCHER' ? MOCK_RESEARCHER : MOCK_PARTICIPANT;
      tokenStore.set(result.accessToken);
      return result;
    }
    const result = await api.post<AuthResponse>('/auth/register', data, { skipAuth: true });
    tokenStore.set(result.accessToken);
    return result;
  },

  login: async (data: LoginRequest): Promise<AuthResponse> => {
    if (api.useMock) {
      await new Promise(r => setTimeout(r, 500));
      // Use researcher mock for demonstration
      const result = MOCK_RESEARCHER;
      tokenStore.set(result.accessToken);
      return result;
    }
    const result = await api.post<AuthResponse>('/auth/login', data, { skipAuth: true });
    tokenStore.set(result.accessToken);
    return result;
  },

  logout: async (): Promise<void> => {
    if (api.useMock) {
      tokenStore.clear();
      return;
    }
    try {
      await api.post('/auth/logout');
    } finally {
      tokenStore.clear();
    }
  },

  me: async (): Promise<AuthUser> => {
    if (api.useMock) {
      return MOCK_RESEARCHER.user;
    }
    return api.get<AuthUser>('/auth/me');
  },

  forgotPassword: async (email: string): Promise<void> => {
    if (api.useMock) return;
    await api.post('/auth/forgot-password', { email }, { skipAuth: true });
  },

  resetPassword: async (token: string, newPassword: string): Promise<void> => {
    if (api.useMock) return;
    await api.post('/auth/reset-password', { token, newPassword }, { skipAuth: true });
  },
};
