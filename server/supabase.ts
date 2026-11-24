import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

// Polyfill WebSocket constructor for Node < 22 environments where Supabase Realtime checks for native WebSocket
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = class WebSocket {} as unknown as typeof globalThis.WebSocket;
}

let publicClient: SupabaseClient | null = null;
let adminClient: SupabaseClient | null = null;

export function getSupabaseUrl(): string {
  return (
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''
  ).trim();
}

export function getSupabaseAnonKey(): string {
  return (
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
  ).trim();
}

export function getSupabaseServiceRoleKey(): string {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseAnonKey());
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabaseServiceRoleKey());
}

export function getSupabasePublic(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const anon = getSupabaseAnonKey();
  if (!url || !anon) return null;
  if (!publicClient) {
    publicClient = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return publicClient;
}

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = getSupabaseUrl();
  const serviceKey = getSupabaseServiceRoleKey();
  if (!url || !serviceKey) return null;
  if (!adminClient) {
    adminClient = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return adminClient;
}

export function getSupabaseUserClient(token?: string): SupabaseClient | null {
  const url = getSupabaseUrl();
  const anon = getSupabaseAnonKey();
  if (!url || !anon) return null;
  if (!token) return getSupabasePublic();
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}

export interface VerifiedSupabaseSession {
  user: User;
  aal: 'aal1' | 'aal2';
  emailVerified: boolean;
  token: string;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const raw = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Cryptographically verifies a Bearer JWT with Supabase Auth (no local forging possible)
 * and extracts the verified user, email confirmation status, and MFA Authenticator Assurance Level (aal1/aal2).
 */
export async function verifySupabaseJwt(token: string): Promise<VerifiedSupabaseSession | null> {
  const client = getSupabaseAdmin() || getSupabasePublic();
  if (!client || !token || token.length < 20) return null;

  try {
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) return null;

    // Payload is only inspected AFTER Supabase verified the JWT signature & expiry above
    const payload = decodeJwtPayload(token);
    const rawAal = typeof payload?.aal === 'string' ? payload.aal : 'aal1';
    const aal: 'aal1' | 'aal2' = rawAal === 'aal2' ? 'aal2' : 'aal1';
    const emailVerified = Boolean(data.user.email_confirmed_at || data.user.confirmed_at);

    return {
      user: data.user,
      aal,
      emailVerified,
      token,
    };
  } catch {
    return null;
  }
}
