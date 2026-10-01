"use client";
// Authentication state. The access token stays in memory; on page load the
// session is restored from the HTTP-only refresh cookie.

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthUser, RegisterRequest, UserRole } from '@/lib/types/api';
import { authApi } from '@/lib/api/auth';
import { refreshAccessToken, tokenStore } from '@/lib/api/client';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (data: RegisterRequest) => Promise<AuthUser>;
  /** Signs in as a guest participant without an account. */
  continueAsGuest: () => Promise<AuthUser>;
  logout: () => Promise<void>;
  /** Re-reads the current user (e.g. after rating/reward changes). */
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, isLoading: true });

  const refreshUser = useCallback(async () => {
    try {
      const user = await authApi.me();
      setState({ user, isLoading: false });
    } catch {
      tokenStore.clear();
      setState({ user: null, isLoading: false });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const restored = await refreshAccessToken();
      if (cancelled) return;
      if (restored) await refreshUser();
      else setState({ user: null, isLoading: false });
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password);
    setState({ user: result.user, isLoading: false });
    return result.user;
  }, []);

  const register = useCallback(async (data: RegisterRequest) => {
    const result = await authApi.register(data);
    setState({ user: result.user, isLoading: false });
    return result.user;
  }, []);

  const continueAsGuest = useCallback(async () => {
    const result = await authApi.guest();
    setState({ user: result.user, isLoading: false });
    return result.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setState({ user: null, isLoading: false });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, isAuthenticated: !!state.user, login, register, continueAsGuest, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function homeForRole(role: UserRole): string {
  return role === 'PARTICIPANT' ? '/participant' : '/researcher/experiments';
}

/**
 * Redirects to /login when signed out and to the user's own area when the role
 * does not match. Returns true only once the user is allowed to see the page.
 * `signedOutTarget` replaces the login redirect after a deliberate sign-out.
 */
export function useRequireRole(roles: UserRole[], signedOutTarget: string | null = null): { allowed: boolean; user: AuthUser | null } {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const allowed = !!user && roles.includes(user.role);

  useEffect(() => {
    if (isLoading) return;
    if (!user && signedOutTarget) {
      router.replace(signedOutTarget);
    } else if (!user) {
      const next = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/';
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    } else if (!roles.includes(user.role)) {
      router.replace(homeForRole(user.role));
    }
  }, [isLoading, user, roles, router, signedOutTarget]);

  return { allowed, user };
}
