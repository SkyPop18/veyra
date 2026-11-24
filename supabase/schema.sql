-- ============================================================================
-- VEYRA v2 — Production-Hardened PostgreSQL / Supabase Schema (All 13 Tables)
-- ============================================================================
-- Includes:
--   1. Consent & expiry columns (terms_accepted_at, privacy_accepted_at,
--      terms_version, pro_expires_at) on public.profiles
--   2. Non-recursive SECURITY DEFINER public.is_admin() function
--   3. Strict column-level UPDATE privileges on public.profiles (full_name,
--      avatar_url ONLY) + defense-in-depth BEFORE UPDATE trigger
--   4. Tamper-proof payment_requests INSERT policy + REVOKE UPDATE/DELETE
--   5. Append-only admin_audit_log with ip & user_agent tracking
--   6. REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon
--
-- To promote the FIRST admin safely, run manually in Supabase SQL Editor:
--   UPDATE public.profiles SET is_admin = TRUE WHERE email = 'your-admin@email.com';
-- Never expose a "grant admin" button in the web UI.
-- ============================================================================

-- 1. USER PROFILES (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  discord_id TEXT UNIQUE,
  discord_username TEXT,
  discord_connected_at TIMESTAMPTZ,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
  pro_expires_at TIMESTAMPTZ,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  terms_accepted_at TIMESTAMPTZ,
  privacy_accepted_at TIMESTAMPTZ,
  terms_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotent migration columns for existing deployments
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_version TEXT,
  ADD COLUMN IF NOT EXISTS pro_expires_at TIMESTAMPTZ;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Non-recursive admin helper (prevents 42P17 RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    FALSE
  );
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- Restrict client UPDATE strictly to harmless profile fields
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (full_name, avatar_url) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own safe profile fields" ON public.profiles;
CREATE POLICY "Users can update own safe profile fields"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Defense-in-depth trigger blocking privileged column tampering
CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') NOT IN ('service_role', '')
     AND current_user NOT IN ('postgres', 'supabase_admin') THEN
    IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
       OR NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
       OR NEW.pro_expires_at IS DISTINCT FROM OLD.pro_expires_at
       OR NEW.email_verified IS DISTINCT FROM OLD.email_verified
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.terms_accepted_at IS DISTINCT FROM OLD.terms_accepted_at
       OR NEW.privacy_accepted_at IS DISTINCT FROM OLD.privacy_accepted_at
       OR NEW.terms_version IS DISTINCT FROM OLD.terms_version
       OR NEW.discord_id IS DISTINCT FROM OLD.discord_id
       OR NEW.discord_username IS DISTINCT FROM OLD.discord_username
       OR NEW.discord_connected_at IS DISTINCT FROM OLD.discord_connected_at THEN
      RAISE EXCEPTION 'Insufficient privileges to modify protected profile attributes';
    END IF;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, email, full_name, avatar_url, subscription_tier, is_admin, email_verified,
    terms_accepted_at, privacy_accepted_at, terms_version
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''),
    'free',
    FALSE,
    NEW.email_confirmed_at IS NOT NULL,
    NULLIF(NEW.raw_user_meta_data->>'terms_accepted_at', '')::TIMESTAMPTZ,
    NULLIF(NEW.raw_user_meta_data->>'privacy_accepted_at', '')::TIMESTAMPTZ,
    NULLIF(NEW.raw_user_meta_data->>'terms_version', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. MANUAL PAYMENT REQUESTS
CREATE TABLE IF NOT EXISTS public.payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_inr NUMERIC NOT NULL DEFAULT 200 CHECK (amount_inr = 200),
  plan TEXT NOT NULL DEFAULT 'pro_monthly' CHECK (plan IN ('pro_monthly')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  payment_proof_url TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('upi', 'bank_transfer', 'qr')),
  transaction_id TEXT NOT NULL,
  admin_note TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  pro_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own payment requests" ON public.payment_requests;
CREATE POLICY "Users can view own payment requests"
  ON public.payment_requests FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create payment requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Users can create pending payment requests only" ON public.payment_requests;
DROP POLICY IF EXISTS "Users create pending requests" ON public.payment_requests;
CREATE POLICY "Users create pending requests"
  ON public.payment_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND status = 'pending'
    AND amount_inr = 200
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND pro_expires_at IS NULL
    AND admin_note IS NULL
  );

REVOKE UPDATE, DELETE ON public.payment_requests FROM authenticated;

DROP POLICY IF EXISTS "Admins can manage all payment requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Admins can manage payment requests" ON public.payment_requests;
CREATE POLICY "Admins can manage payment requests"
  ON public.payment_requests FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3. WATCHLISTS
CREATE TABLE IF NOT EXISTS public.watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('crypto', 'fiat')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, symbol, asset_type)
);

ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own watchlist" ON public.watchlists;
CREATE POLICY "Users manage own watchlist"
  ON public.watchlists FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- 4. PRICE ALERTS
CREATE TABLE IF NOT EXISTS public.price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('crypto', 'fiat')),
  target_price NUMERIC NOT NULL CHECK (target_price > 0),
  direction TEXT NOT NULL CHECK (direction IN ('above', 'below')),
  is_triggered BOOLEAN NOT NULL DEFAULT FALSE,
  triggered_at TIMESTAMPTZ,
  notify_discord BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own alerts" ON public.price_alerts;
CREATE POLICY "Users manage own alerts"
  ON public.price_alerts FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- 5. AI ANALYSIS HISTORY (Pro only; writes via service role exclusively)
CREATE TABLE IF NOT EXISTS public.ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Pro users can view own analyses" ON public.ai_analyses;
DROP POLICY IF EXISTS "Active Pro users can view own analyses" ON public.ai_analyses;
CREATE POLICY "Active Pro users can view own analyses"
  ON public.ai_analyses FOR SELECT
  TO authenticated
  USING (
    (SELECT auth.uid()) = user_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND subscription_tier = 'pro'
        AND (pro_expires_at IS NULL OR pro_expires_at > NOW())
    )
  );

-- 6. NEWS CATEGORIES (Table 6 of 13)
CREATE TABLE IF NOT EXISTS public.news_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  category_type TEXT NOT NULL CHECK (category_type IN ('topic', 'asset', 'region')),
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.news_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can read news categories" ON public.news_categories;
CREATE POLICY "Authenticated can read news categories"
  ON public.news_categories FOR SELECT
  TO authenticated
  USING (TRUE);

-- 7. USER NEWS FOLLOWS (Table 7 of 13)
CREATE TABLE IF NOT EXISTS public.user_news_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.news_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, category_id)
);

ALTER TABLE public.user_news_follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own news follows" ON public.user_news_follows;
CREATE POLICY "Users manage own news follows"
  ON public.user_news_follows FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- 8. USER INTERACTIONS (Table 8 of 13)
CREATE TABLE IF NOT EXISTS public.user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('view', 'like', 'dislike', 'save', 'search')),
  content_type TEXT NOT NULL,
  content_id TEXT,
  content_title TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own interactions" ON public.user_interactions;
CREATE POLICY "Users manage own interactions"
  ON public.user_interactions FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE INDEX IF NOT EXISTS idx_user_interactions_user_type
  ON public.user_interactions (user_id, interaction_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_interactions_tags
  ON public.user_interactions USING GIN (tags);

-- 9. CURRENCY STRENGTH LEADERBOARD (Table 9 of 13; server service role writes)
CREATE TABLE IF NOT EXISTS public.currency_strength (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('crypto', 'fiat')),
  strength_score NUMERIC NOT NULL CHECK (strength_score >= 0 AND strength_score <= 100),
  rank INTEGER NOT NULL CHECK (rank >= 1),
  change_24h NUMERIC,
  change_7d NUMERIC,
  vs_usd_rate NUMERIC,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(currency_code, asset_type, calculated_at)
);

ALTER TABLE public.currency_strength ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read for strength leaderboard" ON public.currency_strength;
CREATE POLICY "Authenticated read for strength leaderboard"
  ON public.currency_strength FOR SELECT
  TO authenticated
  USING (TRUE);

-- 10. API CONFIGS (Table 10 of 13; operational metadata only, secrets in server env)
CREATE TABLE IF NOT EXISTS public.api_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  rate_limit_per_min INTEGER,
  last_checked_at TIMESTAMPTZ,
  status TEXT DEFAULT 'healthy',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.api_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Only admins can manage API configs" ON public.api_configs;
CREATE POLICY "Only admins can manage API configs"
  ON public.api_configs FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 11. ADMIN AUDIT LOG (Table 11 of 13; append-only via service role)
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_audit_log
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Only admins can view audit log" ON public.admin_audit_log;
CREATE POLICY "Only admins can view audit log"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin());

REVOKE UPDATE, DELETE ON public.admin_audit_log FROM authenticated;

-- 12. MARKET CACHE (Table 12 of 13; server service role writes)
CREATE TABLE IF NOT EXISTS public.market_cache (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE public.market_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read for market cache" ON public.market_cache;
CREATE POLICY "Authenticated read for market cache"
  ON public.market_cache FOR SELECT
  TO authenticated
  USING (TRUE);

-- 13. SAVED NEWS (Table 13 of 13)
CREATE TABLE IF NOT EXISTS public.saved_news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_url TEXT NOT NULL,
  article_title TEXT NOT NULL,
  article_source TEXT,
  article_image TEXT,
  article_summary TEXT,
  tags TEXT[],
  saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, article_url)
);

ALTER TABLE public.saved_news ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own saved news" ON public.saved_news;
CREATE POLICY "Users manage own saved news"
  ON public.saved_news FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- Enforce zero anonymous direct table access (public pages read exclusively via cached server routes)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- Seed default news categories
INSERT INTO public.news_categories (slug, label, category_type, icon) VALUES
  ('crypto', 'Cryptocurrency', 'topic', 'Bitcoin'),
  ('forex', 'Forex Markets', 'topic', 'DollarSign'),
  ('economic', 'Economic News', 'topic', 'TrendingUp'),
  ('taxes', 'Global Taxes', 'topic', 'Receipt'),
  ('regulation', 'Regulation', 'topic', 'Shield'),
  ('bitcoin', 'Bitcoin', 'asset', 'Bitcoin'),
  ('ethereum', 'Ethereum', 'asset', 'Gem'),
  ('defi', 'DeFi', 'topic', 'Layers'),
  ('stocks', 'Stock Markets', 'topic', 'BarChart3'),
  ('commodities', 'Commodities', 'topic', 'Landmark')
ON CONFLICT (slug) DO NOTHING;
