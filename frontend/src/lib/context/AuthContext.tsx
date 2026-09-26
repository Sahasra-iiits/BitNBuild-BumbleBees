"use client";
// ==============================================================================
// CogniScale Frontend — Authentication Context
// ==============================================================================
// Provides auth state throughout the app.
// Access token stays in memory only — never in localStorage.

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AuthUser } from '@/lib/types/api';
import { authApi } from '@/lib/api/auth';
import { tokenStore } from '@/lib/api/client';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  const refreshUser = useCallback(async () => {
    try {
      // Try to restore session via /auth/me (uses existing access token in memory
      // or triggers token refresh via refresh_token cookie)
      const user = await authApi.me();
      setState({ user, isLoading: false, isAuthenticated: true });
    } catch {
      tokenStore.clear();
      setState({ user: null, isLoading: false, isAuthenticated: false });
    }
  }, []);

  // On mount, attempt to restore session using HTTP-only refresh_token cookie
  useEffect(() => {
    // First try token refresh silently, then fetch user
    const restoreSession = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1'}/auth/refresh`,
          { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' } }
        );
        if (response.ok) {
          const data: { accessToken: string } = await response.json();
          tokenStore.set(data.accessToken);
          await refreshUser();
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } catch {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    };

    restoreSession();
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const result = await authApi.login({ email, password });
    setState({ user: result.user, isLoading: false, isAuthenticated: true });
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setState({ user: null, isLoading: false, isAuthenticated: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
