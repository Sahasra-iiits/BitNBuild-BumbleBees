// ==============================================================================
// Centralized API client
// ==============================================================================
// All HTTP communication goes through this module. The access token lives in
// memory only; the refresh token is an HTTP-only cookie.

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api/v1';

let accessToken: string | null = null;

export const tokenStore = {
  get: () => accessToken,
  set: (token: string) => {
    accessToken = token;
  },
  clear: () => {
    accessToken = null;
  },
};

export class ApiRequestError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(message: string, code: string, statusCode: number, requestId?: string, details?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.code = code;
    this.statusCode = statusCode;
    this.requestId = requestId;
    this.details = details;
  }
}

/** A readable message for any thrown value, for display in the UI. */
export function errorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (error instanceof ApiRequestError) return error.message;
  if (error instanceof TypeError) return 'Cannot reach the server. Check your connection and try again.';
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Send FormData/Blob as-is instead of JSON. */
  rawBody?: BodyInit;
  skipAuth?: boolean;
  signal?: AbortSignal;
  keepalive?: boolean;
}

let refreshInFlight: Promise<boolean> | null = null;

/** Exchanges the refresh cookie for a new access token. Concurrent callers share one request. */
export function refreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) return false;
        const data = (await res.json()) as { accessToken: string };
        tokenStore.set(data.accessToken);
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => {
          refreshInFlight = null;
        }, 0);
      }
    })();
  }
  return refreshInFlight;
}

async function send(endpoint: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const token = tokenStore.get();
  if (token && !options.skipAuth) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_BASE}${endpoint}`, {
    method: options.method ?? 'GET',
    credentials: 'include',
    headers,
    body: options.rawBody ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
    signal: options.signal,
    keepalive: options.keepalive,
  });
}

async function toError(response: Response): Promise<ApiRequestError> {
  const requestId = response.headers.get('X-Request-Id') || undefined;
  let code = 'SERVER_ERROR';
  let message = `Request failed (HTTP ${response.status})`;
  let details: unknown;
  try {
    const data = (await response.json()) as { error?: { code?: string; message?: string; details?: unknown } };
    code = data.error?.code || code;
    message = data.error?.message || message;
    details = data.error?.details;
  } catch {
    // Non-JSON error body (e.g. proxy error page); keep the generic message.
  }
  return new ApiRequestError(message, code, response.status, requestId, details);
}

/** Performs a request, refreshing the access token once on 401. Returns the raw response. */
export async function apiFetch(endpoint: string, options: RequestOptions = {}): Promise<Response> {
  let response = await send(endpoint, options);
  if (response.status === 401 && !options.skipAuth) {
    if (await refreshAccessToken()) {
      response = await send(endpoint, options);
    } else {
      tokenStore.clear();
      throw new ApiRequestError('Your session has expired. Please log in again.', 'SESSION_EXPIRED', 401);
    }
  }
  if (!response.ok) throw await toError(response);
  return response;
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const response = await apiFetch(endpoint, options);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const api = {
  get: <T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) => apiRequest<T>(endpoint, { ...options, method: 'GET' }),
  post: <T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'POST', body }),
  put: <T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'PUT', body }),
  patch: <T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'PATCH', body }),
  delete: <T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) => apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),
};
