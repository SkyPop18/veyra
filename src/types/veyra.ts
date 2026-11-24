export type AssetType = 'fiat' | 'crypto';
export type SubscriptionTier = 'free' | 'pro';
export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'expired';
export type PaymentMethod = 'upi' | 'bank_transfer' | 'qr';
export type InteractionType = 'view' | 'like' | 'dislike' | 'save' | 'search';
export type NewsSection = 'economic' | 'taxes' | 'market' | 'crypto';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  discord_id: string | null;
  discord_username: string | null;
  discord_connected_at?: string | null;
  subscription_tier: SubscriptionTier;
  pro_expires_at: string | null;
  is_admin: boolean;
  is_banned?: boolean;
  email_verified?: boolean;
  terms_accepted_at: string | null;
  privacy_accepted_at: string | null;
  terms_version: string | null;
  created_at: string;
  updated_at: string;
}

export interface FiatCurrency {
  code: string;
  name: string;
  symbol: string;
  country: string;
  flag: string;
  region: 'North America' | 'Europe' | 'Asia-Pacific' | 'Middle East' | 'South America' | 'Africa' | 'Global';
  rateVsUsd: number;
  strengthScore: number;
  rank: number;
  change24h: number;
  change7d: number;
  change30d: number;
  sparkline: number[];
}

export interface CryptoAsset {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d: number;
  high_24h: number;
  low_24h: number;
  strengthScore: number;
  rank: number;
  sparkline: number[];
}

export interface CryptoCatalogEntry {
  id: string;
  symbol: string;
  name: string;
}

export interface StrengthEntry {
  code: string;
  id: string;
  name: string;
  flag?: string;
  assetType: AssetType;
  strengthScore: number;
  rank: number;
  change24h: number;
  change7d: number;
  vsUsdRate: number;
  sparkline: number[];
}

export interface FearGreedData {
  current: {
    value: number;
    classification: string;
    timestamp: string;
  };
  history: Array<{
    date: string;
    value: number;
    classification: string;
  }>;
}

export interface NewsCategory {
  id: string;
  slug: string;
  label: string;
  category_type: 'topic' | 'asset' | 'region';
  icon: string;
  section?: NewsSection;
  description?: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  url: string;
  publishedAt: string;
  section: NewsSection;
  tags: string[];
  relevanceScore?: number;
  aiReason?: string;
}

export interface SavedNewsItem {
  id: string;
  user_id: string;
  article_url: string;
  article_title: string;
  article_source: string;
  article_summary: string;
  tags: string[];
  saved_at: string;
}

export interface WatchlistItem {
  id: string;
  user_id: string;
  symbol: string;
  asset_type: AssetType;
  position?: number;
  added_at: string;
}

export interface PriceAlertItem {
  id: string;
  user_id: string;
  symbol: string;
  asset_type: AssetType;
  target_price: number;
  direction: 'above' | 'below';
  is_triggered: boolean;
  triggered_at: string | null;
  notify_discord: boolean;
  created_at: string;
}

export interface UserInteraction {
  id: string;
  user_id: string;
  interaction_type: InteractionType;
  content_type: string;
  content_id: string;
  content_title: string;
  tags: string[];
  created_at: string;
}

export interface PaymentRequest {
  id: string;
  user_id: string;
  user_email?: string;
  user_name?: string;
  amount_inr: number;
  plan?: 'pro_monthly';
  status: PaymentStatus;
  payment_proof_url: string | null;
  payment_method: PaymentMethod;
  transaction_id: string;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  pro_expires_at?: string | null;
  created_at: string;
}

export interface AiAnalysisRecord {
  id: string;
  user_id: string;
  query: string;
  response: string;
  tokens_used: number;
  created_at: string;
}

export type AiAnalysisEntry = AiAnalysisRecord;

export interface ApiConfigHealth {
  service_name: string;
  label: string;
  is_active: boolean;
  has_key: boolean;
  mode: 'authenticated' | 'open-free' | 'unconfigured';
  last_checked_at: string;
}

export interface AdminAuditEntry {
  id: string;
  admin_id: string;
  admin_email?: string;
  action: string;
  target_type?: string;
  target_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface HistoricalPoint {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  value: number;
}
