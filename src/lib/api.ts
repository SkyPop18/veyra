import { supabase } from './supabase';

let cachedAccessToken: string | null = null;

export function setMemoryAuthToken(token: string | null) {
  cachedAccessToken = token;
}

export async function getActiveAccessToken(): Promise<string | null> {
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token ?? null;
      cachedAccessToken = token;
      return token;
    } catch {
      return cachedAccessToken;
    }
  }
  return cachedAccessToken;
}

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;

  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'X-Requested-With': 'VeyraClient',
    ...options.headers,
  };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const token = await getActiveAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    method: options.method || 'GET',
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    json = { error: text || 'Unexpected server response' };
  }

  if (!res.ok) {
    throw new ApiError(
      typeof json.error === 'string' ? json.error : `Request failed (${res.status})`,
      res.status,
      json
    );
  }
  return json as T;
}
