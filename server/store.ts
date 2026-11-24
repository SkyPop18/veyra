import crypto from 'node:crypto';
import type { SupabaseClient, User as SupabaseAuthUser } from '@supabase/supabase-js';
import { getSupabaseAdmin, getSupabaseUserClient } from './supabase.ts';
import { isEmailInAdminAllowlist } from './security.ts';

function getDbClient(token?: string): SupabaseClient | null {
  return getSupabaseAdmin() || (token ? getSupabaseUserClient(token) : null);
}
import type {
  AdminAuditEntry,
  AiAnalysisEntry,
  ApiConfigHealth,
  NewsCategory,
  PaymentMethod,
  PaymentRequest,
  PriceAlertItem,
  SavedNewsItem,
  UserInteraction,
  UserProfile,
  WatchlistItem,
} from '../src/types/veyra.ts';
import { isProSubscriptionActive } from '../src/lib/core.ts';

export const DEFAULT_NEWS_CATEGORIES: NewsCategory[] = [
  { id: 'cat-1', label: 'US Economy & Fed', slug: 'us-economy', category_type: 'topic', section: 'economic', icon: 'Landmark', description: 'Federal Reserve policy, inflation, payrolls, and Treasury yields.' },
  { id: 'cat-2', label: 'Global Forex & Central Banks', slug: 'forex', category_type: 'topic', section: 'economic', icon: 'Globe', description: 'ECB, BoJ, BoE, RBI, and major currency pair flows.' },
  { id: 'cat-3', label: 'Bitcoin & Ethereum', slug: 'bitcoin-eth', category_type: 'asset', section: 'crypto', icon: 'Coins', description: 'Spot ETF flows, L2 upgrades, and institutional crypto demand.' },
  { id: 'cat-4', label: 'Altcoins & DeFi Liquidity', slug: 'altcoins-defi', category_type: 'asset', section: 'crypto', icon: 'Layers', description: 'Solana, Layer-1 networks, stablecoin reserves, and on-chain trends.' },
  { id: 'cat-5', label: 'Crypto & Capital Gains Tax', slug: 'crypto-tax', category_type: 'topic', section: 'taxes', icon: 'Scale', description: 'VDA taxation in India, IRS 1099-DA, MiCA, and global reporting rules.' },
  { id: 'cat-6', label: 'Global Tariffs & Trade Policy', slug: 'tariffs-trade', category_type: 'topic', section: 'taxes', icon: 'FileText', description: 'Cross-border tariffs, FX reserve shifts, and fiscal budgets.' },
  { id: 'cat-7', label: 'Commodities & Safe Havens', slug: 'commodities', category_type: 'topic', section: 'market', icon: 'Shield', description: 'Gold, oil, DXY correlation, and sovereign yield curves.' },
  { id: 'cat-8', label: 'Emerging Markets & Asia FX', slug: 'emerging-markets', category_type: 'region', section: 'market', icon: 'TrendingUp', description: 'INR, SGD, BRL, MXN capital flows and regional central banks.' },
];

// Clean, empty-by-default fallback store used ONLY if SUPABASE_SERVICE_ROLE_KEY is not yet configured.
// ZERO pre-seeded fake users, ZERO hardcoded demo accounts, keyed strictly by verified Supabase user IDs.
interface FallbackState {
  profiles: Map<string, UserProfile>;
  watchlists: WatchlistItem[];
  alerts: PriceAlertItem[];
  newsFollows: Array<{ id: string; user_id: string; category_id: string; created_at: string }>;
  interactions: UserInteraction[];
  savedNews: SavedNewsItem[];
  paymentRequests: PaymentRequest[];
  aiAnalyses: AiAnalysisEntry[];
  auditLogs: AdminAuditEntry[];
}

const fallback: FallbackState = {
  profiles: new Map(),
  watchlists: [],
  alerts: [],
  newsFollows: [],
  interactions: [],
  savedNews: [],
  paymentRequests: [],
  aiAnalyses: [],
  auditLogs: [],
};

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function normalizeProStatus(profile: UserProfile): UserProfile {
  if (profile.subscription_tier === 'pro' && !isProSubscriptionActive(profile)) {
    return { ...profile, subscription_tier: 'free', pro_expires_at: null };
  }
  return profile;
}

export function getDatabaseMode(): 'supabase' | 'memory-fallback' {
  return getSupabaseAdmin() ? 'supabase' : 'memory-fallback';
}

export async function getOrCreateProfileFromSupabaseUser(
  authUser: SupabaseAuthUser
): Promise<UserProfile> {
  const email = (authUser.email || '').toLowerCase();
  const fullName =
    (typeof authUser.user_metadata?.full_name === 'string' && authUser.user_metadata.full_name.trim()) ||
    (typeof authUser.user_metadata?.name === 'string' && authUser.user_metadata.name.trim()) ||
    email.split('@')[0] ||
    'Analyst';
  const avatarUrl =
    (typeof authUser.user_metadata?.avatar_url === 'string' && authUser.user_metadata.avatar_url) ||
    null;

  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data: existing } = await sb
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (existing) {
        const normalized = normalizeProStatus(existing as UserProfile);
        if (
          existing.subscription_tier === 'pro' &&
          normalized.subscription_tier === 'free'
        ) {
          await sb
            .from('profiles')
            .update({ subscription_tier: 'free', pro_expires_at: null })
            .eq('id', authUser.id);
        }
        return normalized;
      }

      const { data: inserted, error: insertErr } = await sb
        .from('profiles')
        .insert({
          id: authUser.id,
          email,
          full_name: fullName,
          avatar_url: avatarUrl,
          subscription_tier: 'free',
          is_admin: false,
          is_banned: false,
        })
        .select('*')
        .single();

      if (!insertErr && inserted) {
        return inserted as UserProfile;
      }
    } catch {
      // Fall through to clean in-memory profile keyed by verified Supabase user.id
    }
  }

  const isAdmin = isEmailInAdminAllowlist(email);

  const existingMem = fallback.profiles.get(authUser.id);
  if (existingMem) {
    if (isAdmin && !existingMem.is_admin) {
      existingMem.is_admin = true;
      existingMem.subscription_tier = 'pro';
    }
    const normalized = normalizeProStatus(existingMem);
    fallback.profiles.set(authUser.id, normalized);
    return normalized;
  }

  const now = new Date().toISOString();
  const created: UserProfile = {
    id: authUser.id,
    email,
    full_name: fullName,
    avatar_url: avatarUrl,
    discord_id: null,
    discord_username: null,
    subscription_tier: isAdmin ? 'pro' : 'free',
    pro_expires_at: null,
    is_admin: isAdmin,
    is_banned: false,
    terms_accepted_at: now,
    privacy_accepted_at: now,
    terms_version: '2026-11',
    created_at: now,
    updated_at: now,
  };
  fallback.profiles.set(authUser.id, created);
  return created;
}

export async function getProfileById(userId: string): Promise<UserProfile | null> {
  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data } = await sb.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (data) return normalizeProStatus(data as UserProfile);
    } catch {
      // fallback below
    }
  }
  const mem = fallback.profiles.get(userId);
  return mem ? normalizeProStatus(mem) : null;
}

export async function recordTermsConsent(
  userId: string,
  version: string
): Promise<UserProfile | null> {
  const now = new Date().toISOString();
  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('profiles')
        .update({
          terms_accepted_at: now,
          privacy_accepted_at: now,
          terms_version: version,
          updated_at: now,
        })
        .eq('id', userId)
        .select('*')
        .single();
      if (!error && data) return normalizeProStatus(data as UserProfile);
    } catch {
      // fallback below
    }
  }
  const mem = fallback.profiles.get(userId);
  if (!mem) return null;
  const updated: UserProfile = {
    ...mem,
    terms_accepted_at: now,
    privacy_accepted_at: now,
    terms_version: version,
    updated_at: now,
  };
  fallback.profiles.set(userId, updated);
  return updated;
}

export async function updateSafeProfile(
  userId: string,
  patch: { full_name?: string; avatar_url?: string | null; discord_id?: string | null; discord_username?: string | null }
): Promise<UserProfile | null> {
  const now = new Date().toISOString();
  const cleanPatch: Record<string, unknown> = { updated_at: now };
  if (patch.full_name !== undefined) cleanPatch.full_name = patch.full_name;
  if (patch.avatar_url !== undefined) cleanPatch.avatar_url = patch.avatar_url;
  if (patch.discord_id !== undefined) cleanPatch.discord_id = patch.discord_id;
  if (patch.discord_username !== undefined) cleanPatch.discord_username = patch.discord_username;

  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('profiles')
        .update(cleanPatch)
        .eq('id', userId)
        .select('*')
        .single();
      if (!error && data) return normalizeProStatus(data as UserProfile);
    } catch {
      // fallback below
    }
  }

  const mem = fallback.profiles.get(userId);
  if (!mem) return null;
  const updated: UserProfile = {
    ...mem,
    ...patch,
    updated_at: now,
  };
  fallback.profiles.set(userId, updated);
  return updated;
}

export async function getProfileByDiscordId(discordId: string): Promise<UserProfile | null> {
  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('profiles')
        .select('*')
        .eq('discord_id', discordId)
        .maybeSingle();
      if (!error && data) return normalizeProStatus(data as UserProfile);
    } catch {
      // fallback
    }
  }
  for (const prof of fallback.profiles.values()) {
    if (prof.discord_id === discordId) return prof;
  }
  return null;
}

// ── Watchlists ────────────────────────────────────────────────────────────────

export async function listWatchlist(userId: string, token?: string): Promise<WatchlistItem[]> {
  const sb = getDbClient(token);
  if (sb) {
    try {
      const { data, error } = await sb
        .from('watchlists')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });
      if (!error && data) {
        return data.map((d: any, idx: number) => ({
          id: d.id,
          user_id: d.user_id,
          symbol: d.symbol,
          asset_type: d.asset_type,
          position: idx,
          added_at: d.created_at,
        })) as WatchlistItem[];
      }
    } catch {
      // fallback
    }
  }
  return fallback.watchlists
    .filter((w) => w.user_id === userId)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}

export async function addWatchlistItem(
  userId: string,
  symbol: string,
  assetType: 'fiat' | 'crypto',
  token?: string
): Promise<WatchlistItem> {
  const upper = symbol.toUpperCase();
  const existing = await listWatchlist(userId, token);
  const found = existing.find((w) => w.symbol === upper && w.asset_type === assetType);
  if (found) return found;

  const sb = getDbClient(token);
  if (sb) {
    try {
      const { data, error } = await sb
        .from('watchlists')
        .insert({
          user_id: userId,
          symbol: upper,
          asset_type: assetType,
        })
        .select('*')
        .single();
      if (!error && data) {
        const item: WatchlistItem = {
          id: data.id,
          user_id: data.user_id,
          symbol: data.symbol,
          asset_type: data.asset_type,
          position: existing.length,
          added_at: data.created_at,
        };
        fallback.watchlists.push(item);
        return item;
      }
    } catch {
      // fallback
    }
  }

  const item: WatchlistItem = {
    id: newId('wl'),
    user_id: userId,
    symbol: upper,
    asset_type: assetType,
    position: existing.length,
    added_at: new Date().toISOString(),
  };
  fallback.watchlists.push(item);
  return item;
}

export async function deleteWatchlistItem(userId: string, id: string, token?: string): Promise<boolean> {
  const sb = getDbClient(token);
  if (sb) {
    try {
      const { error } = await sb.from('watchlists').delete().eq('id', id).eq('user_id', userId);
      if (!error) {
        const idx = fallback.watchlists.findIndex((w) => w.id === id && w.user_id === userId);
        if (idx !== -1) fallback.watchlists.splice(idx, 1);
        return true;
      }
    } catch {
      // fallback
    }
  }
  const idx = fallback.watchlists.findIndex((w) => w.id === id && w.user_id === userId);
  if (idx === -1) return false;
  fallback.watchlists.splice(idx, 1);
  return true;
}

// ── Price Alerts ──────────────────────────────────────────────────────────────

export async function listAlerts(userId: string, token?: string): Promise<PriceAlertItem[]> {
  const sb = getDbClient(token);
  if (sb) {
    try {
      const { data, error } = await sb
        .from('price_alerts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (!error && data) return data as PriceAlertItem[];
    } catch {
      // fallback
    }
  }
  return fallback.alerts.filter((a) => a.user_id === userId);
}

export async function createAlert(
  userId: string,
  payload: {
    symbol: string;
    asset_type: 'fiat' | 'crypto';
    target_price: number;
    direction: 'above' | 'below';
    notify_discord: boolean;
  },
  token?: string
): Promise<PriceAlertItem> {
  const sb = getDbClient(token);
  if (sb) {
    try {
      const { data, error } = await sb
        .from('price_alerts')
        .insert({
          user_id: userId,
          symbol: payload.symbol.toUpperCase(),
          target_price: payload.target_price,
          condition: payload.direction,
          is_triggered: false,
        })
        .select('*')
        .single();
      if (!error && data) {
        const item: PriceAlertItem = {
          id: data.id,
          user_id: data.user_id,
          symbol: data.symbol,
          asset_type: payload.asset_type,
          target_price: Number(data.target_price),
          direction: (data.condition as 'above' | 'below') || payload.direction,
          is_triggered: Boolean(data.is_triggered),
          triggered_at: null,
          notify_discord: payload.notify_discord,
          created_at: data.created_at,
        };
        fallback.alerts.unshift(item);
        return item;
      }
    } catch {
      // fallback
    }
  }
  const item: PriceAlertItem = {
    id: newId('al'),
    user_id: userId,
    symbol: payload.symbol.toUpperCase(),
    asset_type: payload.asset_type,
    target_price: payload.target_price,
    direction: payload.direction,
    is_triggered: false,
    triggered_at: null,
    notify_discord: payload.notify_discord,
    created_at: new Date().toISOString(),
  };
  fallback.alerts.unshift(item);
  return item;
}

export async function deleteAlert(userId: string, id: string, token?: string): Promise<boolean> {
  const sb = getDbClient(token);
  if (sb) {
    try {
      const { error } = await sb.from('price_alerts').delete().eq('id', id).eq('user_id', userId);
      if (!error) {
        const idx = fallback.alerts.findIndex((a) => a.id === id && a.user_id === userId);
        if (idx !== -1) fallback.alerts.splice(idx, 1);
        return true;
      }
    } catch {
      // fallback
    }
  }
  const idx = fallback.alerts.findIndex((a) => a.id === id && a.user_id === userId);
  if (idx === -1) return false;
  fallback.alerts.splice(idx, 1);
  return true;
}

// ── News Categories, Follows, Saved News & Interactions ──────────────────────

export async function listNewsCategories(): Promise<NewsCategory[]> {
  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data, error } = await sb.from('news_categories').select('*');
      if (!error && data && data.length > 0) return data as NewsCategory[];
    } catch {
      // fallback
    }
  }
  return DEFAULT_NEWS_CATEGORIES;
}

export async function listNewsFollows(userId: string, token?: string): Promise<string[]> {
  const sb = getDbClient(token);
  if (sb) {
    try {
      const { data, error } = await sb
        .from('user_news_follows')
        .select('category')
        .eq('user_id', userId);
      if (!error && data) return data.map((r: { category: string }) => r.category);
    } catch {
      // fallback
    }
  }
  return fallback.newsFollows.filter((f) => f.user_id === userId).map((f) => f.category_id);
}

export async function toggleNewsFollow(
  userId: string,
  categoryIdOrSlug: string,
  token?: string
): Promise<{ categoryId: string; following: boolean } | null> {
  const categories = await listNewsCategories();
  const cat = categories.find(
    (c) => c.id === categoryIdOrSlug || c.slug === categoryIdOrSlug
  );
  if (!cat) return null;

  const sb = getDbClient(token);
  if (sb) {
    try {
      const { data: existing } = await sb
        .from('user_news_follows')
        .select('id')
        .eq('user_id', userId)
        .eq('category', cat.id)
        .maybeSingle();

      if (existing) {
        await sb.from('user_news_follows').delete().eq('id', existing.id);
        const idx = fallback.newsFollows.findIndex(
          (f) => f.user_id === userId && f.category_id === cat.id
        );
        if (idx !== -1) fallback.newsFollows.splice(idx, 1);
        return { categoryId: cat.id, following: false };
      } else {
        await sb.from('user_news_follows').insert({ user_id: userId, category: cat.id });
        fallback.newsFollows.push({
          id: newId('nf'),
          user_id: userId,
          category_id: cat.id,
          created_at: new Date().toISOString(),
        });
        return { categoryId: cat.id, following: true };
      }
    } catch {
      // fallback
    }
  }

  const idx = fallback.newsFollows.findIndex(
    (f) => f.user_id === userId && f.category_id === cat.id
  );
  if (idx !== -1) {
    fallback.newsFollows.splice(idx, 1);
    return { categoryId: cat.id, following: false };
  }
  fallback.newsFollows.push({
    id: newId('nf'),
    user_id: userId,
    category_id: cat.id,
    created_at: new Date().toISOString(),
  });
  return { categoryId: cat.id, following: true };
}

export async function listSavedNews(userId: string, token?: string): Promise<SavedNewsItem[]> {
  const sb = getDbClient(token);
  if (sb) {
    try {
      const { data, error } = await sb
        .from('saved_news')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (!error && data) {
        return data.map((d: any) => ({
          id: d.id,
          user_id: d.user_id,
          article_url: d.url || '',
          article_title: d.title || '',
          article_source: d.source || '',
          article_summary: d.summary || '',
          tags: [],
          saved_at: d.created_at,
        }));
      }
    } catch {
      // fallback
    }
  }
  return fallback.savedNews.filter((s) => s.user_id === userId);
}

export async function addSavedNews(
  userId: string,
  payload: {
    article_url: string;
    article_title: string;
    article_source: string;
    article_summary: string;
    tags: string[];
  },
  token?: string
): Promise<SavedNewsItem> {
  const existing = await listSavedNews(userId, token);
  const found = existing.find((s) => s.article_url === payload.article_url);
  if (found) return found;

  const sb = getDbClient(token);
  if (sb) {
    try {
      const { data, error } = await sb
        .from('saved_news')
        .insert({
          user_id: userId,
          title: payload.article_title,
          summary: payload.article_summary,
          url: payload.article_url,
          source: payload.article_source,
        })
        .select('*')
        .single();
      if (!error && data) {
        const item: SavedNewsItem = {
          id: data.id,
          user_id: data.user_id,
          article_url: data.url,
          article_title: data.title,
          article_source: data.source,
          article_summary: data.summary,
          tags: payload.tags || [],
          saved_at: data.created_at,
        };
        fallback.savedNews.unshift(item);
        return item;
      }
    } catch {
      // fallback
    }
  }

  const item: SavedNewsItem = {
    id: newId('sn'),
    user_id: userId,
    ...payload,
    saved_at: new Date().toISOString(),
  };
  fallback.savedNews.unshift(item);
  return item;
}

export async function deleteSavedNews(userId: string, id: string, token?: string): Promise<boolean> {
  const sb = getDbClient(token);
  if (sb) {
    try {
      const { error } = await sb.from('saved_news').delete().eq('id', id).eq('user_id', userId);
      if (!error) {
        const idx = fallback.savedNews.findIndex((s) => s.id === id && s.user_id === userId);
        if (idx !== -1) fallback.savedNews.splice(idx, 1);
        return true;
      }
    } catch {
      // fallback
    }
  }
  const idx = fallback.savedNews.findIndex((s) => s.id === id && s.user_id === userId);
  if (idx === -1) return false;
  fallback.savedNews.splice(idx, 1);
  return true;
}

export async function listInteractions(userId: string): Promise<UserInteraction[]> {
  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('user_interactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(250);
      if (!error && data) return data as UserInteraction[];
    } catch {
      // fallback
    }
  }
  return fallback.interactions.filter((i) => i.user_id === userId).slice(0, 250);
}

export async function recordInteraction(
  userId: string,
  payload: {
    interaction_type: 'view' | 'like' | 'dislike' | 'save' | 'search';
    content_type: string;
    content_id: string;
    content_title: string;
    tags: string[];
  }
): Promise<UserInteraction> {
  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('user_interactions')
        .insert({ user_id: userId, ...payload })
        .select('*')
        .single();
      if (!error && data) return data as UserInteraction;
    } catch {
      // fallback
    }
  }
  const item: UserInteraction = {
    id: newId('int'),
    user_id: userId,
    ...payload,
    created_at: new Date().toISOString(),
  };
  fallback.interactions.unshift(item);
  if (fallback.interactions.length > 1000) fallback.interactions.length = 1000;
  return item;
}

// ── Payment Requests (always pending on user submission) ──────────────────────

export async function listUserPaymentRequests(userId: string): Promise<PaymentRequest[]> {
  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('payment_requests')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      if (!error && data) return data as PaymentRequest[];
    } catch {
      // fallback
    }
  }
  return fallback.paymentRequests.filter((p) => p.user_id === userId);
}

export async function createPaymentRequest(
  userId: string,
  payload: {
    payment_method: PaymentMethod;
    transaction_id: string;
    payment_proof_url: string | null;
  }
): Promise<PaymentRequest> {
  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('payment_requests')
        .insert({
          user_id: userId,
          amount_inr: 200,
          payment_method: payload.payment_method,
          transaction_id: payload.transaction_id.trim(),
          payment_proof_url: payload.payment_proof_url,
          status: 'pending',
          reviewed_by: null,
          admin_note: null,
          reviewed_at: null,
        })
        .select('*')
        .single();
      if (!error && data) return data as PaymentRequest;
    } catch {
      // fallback
    }
  }
  const item: PaymentRequest = {
    id: newId('pay'),
    user_id: userId,
    amount_inr: 200,
    plan: 'pro_monthly',
    payment_method: payload.payment_method,
    transaction_id: payload.transaction_id.trim(),
    payment_proof_url: payload.payment_proof_url,
    status: 'pending',
    admin_note: null,
    reviewed_by: null,
    reviewed_at: null,
    pro_expires_at: null,
    created_at: new Date().toISOString(),
  };
  fallback.paymentRequests.unshift(item);
  return item;
}

// ── AI Analyses ───────────────────────────────────────────────────────────────

export async function listAiHistory(userId: string, userToken?: string): Promise<AiAnalysisEntry[]> {
  const sb = (userToken ? getSupabaseUserClient(userToken) : null) || getSupabaseAdmin();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('ai_analyses')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);
      if (!error && data) {
        return data.map((d: any) => {
          let resp = d.response;
          if (!resp && d.analysis) {
            resp = typeof d.analysis === 'object' ? d.analysis.text || JSON.stringify(d.analysis) : String(d.analysis);
          }
          return {
            id: String(d.id),
            user_id: d.user_id,
            query: d.query || d.prompt || '',
            response: resp || '',
            tokens_used: Number(d.tokens_used || 0),
            created_at: d.created_at,
          };
        });
      }
      if (error) {
        console.warn('[Veyra DB] listAiHistory error:', error.message);
      }
    } catch (err) {
      console.warn('[Veyra DB] listAiHistory exception:', err);
    }
  }
  return fallback.aiAnalyses.filter((a) => a.user_id === userId).slice(0, 30);
}

export async function saveAiAnalysis(
  userId: string,
  query: string,
  response: string,
  tokensUsed: number,
  userToken?: string
): Promise<AiAnalysisEntry> {
  const sb = (userToken ? getSupabaseUserClient(userToken) : null) || getSupabaseAdmin();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('ai_analyses')
        .insert({
          user_id: userId,
          query,
          response,
          prompt: query,
          analysis: { text: response },
          tokens_used: tokensUsed,
        })
        .select('*')
        .single();
      if (!error && data) {
        let resp = data.response;
        if (!resp && data.analysis) {
          resp = typeof data.analysis === 'object' ? data.analysis.text || JSON.stringify(data.analysis) : String(data.analysis);
        }
        const saved: AiAnalysisEntry = {
          id: String(data.id),
          user_id: data.user_id,
          query: data.query || data.prompt || query,
          response: resp || response,
          tokens_used: Number(data.tokens_used || tokensUsed),
          created_at: data.created_at,
        };
        fallback.aiAnalyses.unshift(saved);
        return saved;
      }
      if (error) {
        console.warn('[Veyra DB] saveAiAnalysis error:', error.message);
      }
    } catch (err) {
      console.warn('[Veyra DB] saveAiAnalysis exception:', err);
    }
  }
  const item: AiAnalysisEntry = {
    id: newId('ai'),
    user_id: userId,
    query,
    response,
    tokens_used: tokensUsed,
    created_at: new Date().toISOString(),
  };
  fallback.aiAnalyses.unshift(item);
  return item;
}

// ── User Rights: Export Data & Account Deletion ───────────────────────────────

export async function exportUserData(userId: string): Promise<Record<string, unknown>> {
  const [profile, watchlists, alerts, newsFollows, savedNews, interactions, paymentRequests, aiAnalyses] =
    await Promise.all([
      getProfileById(userId),
      listWatchlist(userId),
      listAlerts(userId),
      listNewsFollows(userId),
      listSavedNews(userId),
      listInteractions(userId),
      listUserPaymentRequests(userId),
      listAiHistory(userId),
    ]);

  return {
    exported_at: new Date().toISOString(),
    platform: 'Veyra',
    profile,
    watchlists,
    price_alerts: alerts,
    followed_news_category_ids: newsFollows,
    saved_news: savedNews,
    interactions,
    payment_requests: paymentRequests,
    ai_analyses: aiAnalyses,
  };
}

export async function deleteUserAccount(userId: string): Promise<{ deletedAuth: boolean }> {
  const sb = getSupabaseAdmin();
  let deletedAuth = false;

  if (sb) {
    try {
      // Profiles cascades to user-owned tables when deleted; deleting auth.users cascades profiles too
      const { error } = await sb.auth.admin.deleteUser(userId);
      if (!error) deletedAuth = true;
    } catch {
      // ignore if service role key cannot delete auth user
    }
    try {
      await sb.from('profiles').delete().eq('id', userId);
    } catch {
      // ignore
    }
  }

  fallback.profiles.delete(userId);
  fallback.watchlists = fallback.watchlists.filter((x) => x.user_id !== userId);
  fallback.alerts = fallback.alerts.filter((x) => x.user_id !== userId);
  fallback.newsFollows = fallback.newsFollows.filter((x) => x.user_id !== userId);
  fallback.interactions = fallback.interactions.filter((x) => x.user_id !== userId);
  fallback.savedNews = fallback.savedNews.filter((x) => x.user_id !== userId);
  fallback.paymentRequests = fallback.paymentRequests.filter((x) => x.user_id !== userId);
  fallback.aiAnalyses = fallback.aiAnalyses.filter((x) => x.user_id !== userId);

  return { deletedAuth };
}

// ── Admin Operations (strictly verified by hidden admin middleware) ───────────
// NOTE: NO grant_admin / revoke_admin action exists in web API. First admin is set via Supabase SQL Editor ONLY.

export async function recordAdminAudit(params: {
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
}): Promise<void> {
  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      await sb.from('admin_audit_log').insert(params);
      return;
    } catch {
      // fallback
    }
  }
  fallback.auditLogs.unshift({
    id: newId('aud'),
    ...params,
    created_at: new Date().toISOString(),
  });
}

export async function adminListUsers(): Promise<UserProfile[]> {
  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (!error && data) return (data as UserProfile[]).map(normalizeProStatus);
    } catch {
      // fallback
    }
  }
  return Array.from(fallback.profiles.values()).map(normalizeProStatus);
}

export async function adminListPayments(): Promise<
  Array<PaymentRequest & { user_email: string; user_name: string }>
> {
  const users = await adminListUsers();
  const byId = new Map(users.map((u) => [u.id, u]));

  let list: PaymentRequest[] = [];
  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('payment_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (!error && data) list = data as PaymentRequest[];
    } catch {
      list = fallback.paymentRequests;
    }
  } else {
    list = fallback.paymentRequests;
  }

  return list.map((p) => {
    const owner = byId.get(p.user_id);
    return {
      ...p,
      user_email: owner?.email || 'unknown',
      user_name: owner?.full_name || 'User',
    };
  });
}

export async function adminReviewPayment(params: {
  paymentId: string;
  action: 'approve' | 'reject';
  adminNote: string;
  adminId: string;
}): Promise<{ payment: PaymentRequest; updatedUser: UserProfile | null } | null> {
  const now = new Date().toISOString();
  const proExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data: existing } = await sb
        .from('payment_requests')
        .select('*')
        .eq('id', params.paymentId)
        .maybeSingle();
      if (!existing) return null;

      const { data: updatedPay, error } = await sb
        .from('payment_requests')
        .update({
          status: params.action === 'approve' ? 'approved' : 'rejected',
          admin_note: params.adminNote || (params.action === 'approve' ? 'Verified and activated for 30 days.' : 'Rejected during verification.'),
          reviewed_by: params.adminId,
          reviewed_at: now,
        })
        .eq('id', params.paymentId)
        .select('*')
        .single();

      if (error || !updatedPay) return null;

      let updatedUser: UserProfile | null = null;
      if (params.action === 'approve') {
        const { data: u } = await sb
          .from('profiles')
          .update({
            subscription_tier: 'pro',
            pro_expires_at: proExpiry,
            updated_at: now,
          })
          .eq('id', existing.user_id)
          .select('*')
          .single();
        if (u) updatedUser = u as UserProfile;
      }

      return { payment: updatedPay as PaymentRequest, updatedUser };
    } catch {
      // fallback below
    }
  }

  const pay = fallback.paymentRequests.find((p) => p.id === params.paymentId);
  if (!pay) return null;
  pay.status = params.action === 'approve' ? 'approved' : 'rejected';
  pay.admin_note =
    params.adminNote ||
    (params.action === 'approve' ? 'Verified and activated for 30 days.' : 'Rejected during verification.');
  pay.reviewed_by = params.adminId;
  pay.reviewed_at = now;

  let updatedUser: UserProfile | null = null;
  if (params.action === 'approve') {
    const owner = fallback.profiles.get(pay.user_id);
    if (owner) {
      owner.subscription_tier = 'pro';
      owner.pro_expires_at = proExpiry;
      owner.updated_at = now;
      updatedUser = owner;
    }
  }
  return { payment: pay, updatedUser };
}

export async function adminManageUser(params: {
  targetUserId: string;
  action: 'grant_pro' | 'revoke_pro' | 'ban' | 'unban';
}): Promise<UserProfile | null> {
  const now = new Date().toISOString();
  const patch: Partial<UserProfile> = { updated_at: now };

  if (params.action === 'grant_pro') {
    patch.subscription_tier = 'pro';
    patch.pro_expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  } else if (params.action === 'revoke_pro') {
    patch.subscription_tier = 'free';
    patch.pro_expires_at = null;
  } else if (params.action === 'ban') {
    patch.is_banned = true;
  } else if (params.action === 'unban') {
    patch.is_banned = false;
  }

  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('profiles')
        .update(patch)
        .eq('id', params.targetUserId)
        .select('*')
        .single();
      if (!error && data) return data as UserProfile;
    } catch {
      // fallback
    }
  }

  const mem = fallback.profiles.get(params.targetUserId);
  if (!mem) return null;
  const updated = { ...mem, ...patch };
  fallback.profiles.set(params.targetUserId, updated);
  return updated;
}

export async function adminListAuditLogs(): Promise<AdminAuditEntry[]> {
  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(150);
      if (!error && data) return data as AdminAuditEntry[];
    } catch {
      // fallback
    }
  }
  return fallback.auditLogs.slice(0, 150);
}

export async function adminGetOverviewStats(): Promise<{
  totalUsers: number;
  proUsers: number;
  pendingPayments: number;
  approvedRevenueInr: number;
  activeWatchlistItems: number;
  activeAlerts: number;
  aiQueriesCount: number;
  dbMode: 'supabase' | 'memory-fallback';
}> {
  const [users, payments] = await Promise.all([adminListUsers(), adminListPayments()]);
  const proUsers = users.filter((u) => isProSubscriptionActive(u)).length;
  const pendingPayments = payments.filter((p) => p.status === 'pending').length;
  const approvedRevenueInr = payments
    .filter((p) => p.status === 'approved')
    .reduce((acc, p) => acc + p.amount_inr, 0);

  let activeWatchlistItems = fallback.watchlists.length;
  let activeAlerts = fallback.alerts.length;
  let aiQueriesCount = fallback.aiAnalyses.length;

  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const [wRes, aRes, aiRes] = await Promise.all([
        sb.from('watchlists').select('id', { count: 'exact', head: true }),
        sb.from('price_alerts').select('id', { count: 'exact', head: true }),
        sb.from('ai_analyses').select('id', { count: 'exact', head: true }),
      ]);
      if (typeof wRes.count === 'number') activeWatchlistItems = wRes.count;
      if (typeof aRes.count === 'number') activeAlerts = aRes.count;
      if (typeof aiRes.count === 'number') aiQueriesCount = aiRes.count;
    } catch {
      // keep fallback counts
    }
  }

  return {
    totalUsers: users.length,
    proUsers,
    pendingPayments,
    approvedRevenueInr,
    activeWatchlistItems,
    activeAlerts,
    aiQueriesCount,
    dbMode: getDatabaseMode(),
  };
}

export function getApiHealthStatuses(): ApiConfigHealth[] {
  const now = new Date().toISOString();
  return [
    {
      service_name: 'exchangerate',
      label: 'ExchangeRate-API (160+ Fiat)',
      is_active: true,
      has_key: Boolean(process.env.EXCHANGERATE_API_KEY),
      mode: process.env.EXCHANGERATE_API_KEY ? 'authenticated' : 'open-free',
      last_checked_at: now,
    },
    {
      service_name: 'coingecko',
      label: 'CoinGecko Markets & Full Coin Catalog',
      is_active: true,
      has_key: Boolean(process.env.COINGECKO_API_KEY),
      mode: process.env.COINGECKO_API_KEY ? 'authenticated' : 'open-free',
      last_checked_at: now,
    },
    {
      service_name: 'gemini',
      label: 'Google Gemini AI (Pro Tier)',
      is_active: Boolean(process.env.GEMINI_API_KEY),
      has_key: Boolean(process.env.GEMINI_API_KEY),
      mode: process.env.GEMINI_API_KEY ? 'authenticated' : 'unconfigured',
      last_checked_at: now,
    },
    {
      service_name: 'supabase',
      label: 'Supabase Auth & Service Role DB',
      is_active: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      has_key: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      mode: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'authenticated' : 'unconfigured',
      last_checked_at: now,
    },
    {
      service_name: 'discord',
      label: 'Discord Bot & Slash Commands',
      is_active: Boolean(process.env.DISCORD_BOT_TOKEN),
      has_key: Boolean(process.env.DISCORD_BOT_TOKEN),
      mode: process.env.DISCORD_BOT_TOKEN ? 'authenticated' : 'unconfigured',
      last_checked_at: now,
    },
  ];
}
