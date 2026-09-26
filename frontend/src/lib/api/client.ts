// ==============================================================================
// CogniScale Frontend — Centralized API Client
// ==============================================================================
// All HTTP communication goes through this module.
// Never import fetch/axios directly in components.

import { ApiError, ApiErrorCode } from '../types/api';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1';
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

// Token store — memory-only, NOT localStorage (security)
// Access token lives in memory. Refresh token is in HTTP-only cookie.
let _accessToken: string | null = null;

export const tokenStore = {
  get: () => _accessToken,
  set: (token: string) => { _accessToken = token; },
  clear: () => { _accessToken = null; },
};

// =============================================================================
// Typed API Error
// =============================================================================

export class ApiRequestError extends Error {
  public code: ApiErrorCode | string;
  public statusCode: number;
  public requestId?: string;

  constructor(message: string, code: string, statusCode: number, requestId?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.statusCode = statusCode;
    this.requestId = requestId;
  }
}

// =============================================================================
// Core fetch wrapper
// =============================================================================

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipAuth?: boolean;
}

export async function apiRequest<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { body, skipAuth = false, ...rest } = options;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((rest.headers as Record<string, string>) || {}),
  };

  // Attach Bearer token if available
  const token = tokenStore.get();
  if (token && !skipAuth) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    ...rest,
    credentials: 'include', // Include cookies for refresh_token
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Handle 401 — attempt token refresh once
  if (response.status === 401 && !skipAuth && token) {
    const refreshed = await attemptTokenRefresh();
    if (refreshed) {
      // Retry original request with new token
      const retryHeaders = {
        ...headers,
        Authorization: `Bearer ${tokenStore.get()}`,
      };
      const retryResponse = await fetch(url, {
        ...rest,
        credentials: 'include',
        headers: retryHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      return parseResponse<T>(retryResponse);
    } else {
      // Refresh failed — clear token and throw
      tokenStore.clear();
      throw new ApiRequestError('Session expired. Please log in again.', 'SESSION_EXPIRED', 401);
    }
  }

  return parseResponse<T>(response);
}

async function parseResponse<T>(response: Response): Promise<T> {
  const requestId = response.headers.get('X-Request-Id') || undefined;

  if (!response.ok) {
    let errorCode = 'SERVER_ERROR';
    let errorMessage = `HTTP ${response.status}`;
    
    try {
      const errorData: ApiError = await response.json();
      errorCode = errorData.error?.code || errorCode;
      errorMessage = errorData.error?.message || errorMessage;
    } catch {
      // Could not parse error body
    }

    throw new ApiRequestError(errorMessage, errorCode, response.status, requestId);
  }

  // 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  const text = await response.text();
  if (!text) return {} as T;
  
  return JSON.parse(text) as T;
}

// =============================================================================
// Token refresh
// =============================================================================

async function attemptTokenRefresh(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      credentials: 'include', // Uses refresh_token cookie
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      const data: { accessToken: string } = await response.json();
      tokenStore.set(data.accessToken);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// =============================================================================
// Convenience methods
// =============================================================================

export const api = {
  get: <T>(endpoint: string, options?: FetchOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: FetchOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'POST', body }),

  patch: <T>(endpoint: string, body?: unknown, options?: FetchOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T>(endpoint: string, options?: FetchOptions) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
  
  // Expose base for special cases
  baseUrl: API_BASE,
  useMock: USE_MOCK,
};
