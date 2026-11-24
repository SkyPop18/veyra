import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const isSupabaseClientReady = isSupabaseConfigured;

let client: SupabaseClient | null = null;

if (isSupabaseConfigured) {
  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      // Prevents Chromium/Brave navigator.locks deadlocks when switching windows/tabs
      lock: async (_name, _timeout, fn) => await fn(),
    },
  });
}

export const supabase = client;

/**
 * Returns the canonical origin for Supabase Auth email and OAuth redirects so
 * preview deployments always route back to the primary production domain.
 */
export function getAuthBaseOrigin(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return window.location.origin;
    }
    return 'https://veyra-global.vercel.app';
  }
  return 'https://veyra-global.vercel.app';
}
