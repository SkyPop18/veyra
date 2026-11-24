-- ============================================================================
-- VEYRA Security Hardening & Admin RPC Migration
-- Run this in Supabase Dashboard -> SQL Editor to lock down RLS & enable
-- verified AAL2 Admin Grant 30d Pro / Ban / Payment approval actions.
-- ============================================================================

-- 1. Sync missing columns safely
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pro_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS terms_version TEXT,
  ADD COLUMN IF NOT EXISTS is_banned BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS amount_inr NUMERIC DEFAULT 200,
  ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'pro_monthly',
  ADD COLUMN IF NOT EXISTS payment_proof_url TEXT,
  ADD COLUMN IF NOT EXISTS transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS admin_note TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pro_expires_at TIMESTAMPTZ;

ALTER TABLE public.price_alerts
  ADD COLUMN IF NOT EXISTS asset_type TEXT DEFAULT 'crypto',
  ADD COLUMN IF NOT EXISTS direction TEXT DEFAULT 'above',
  ADD COLUMN IF NOT EXISTS triggered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notify_discord BOOLEAN DEFAULT FALSE;

ALTER TABLE public.admin_audit_log
  ADD COLUMN IF NOT EXISTS ip_address TEXT,
  ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- 2. Revoke ALL direct table privileges from anonymous role
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;

-- Ensure allowlisted ops admins can pass public.is_admin() RLS checks
UPDATE public.profiles
SET is_admin = TRUE
WHERE lower(email) IN ('akshatkhushi2020@gmail.com', 'akshatbhopali@gmail.com');

-- 3. Non-recursive admin helper
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

-- 4. Lock down public.profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own safe profile fields" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = id
    AND is_admin = FALSE
    AND subscription_tier = 'free'
    AND pro_expires_at IS NULL
    AND is_banned = FALSE
    AND is_suspended = FALSE
  );

REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (full_name, avatar_url) ON public.profiles TO authenticated;

CREATE POLICY "Users can update own safe profile fields"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

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
       OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
       OR NEW.is_suspended IS DISTINCT FROM OLD.is_suspended
       OR NEW.email_verified IS DISTINCT FROM OLD.email_verified
       OR NEW.email IS DISTINCT FROM OLD.email
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

-- 5. Lock down user-owned tables (no cross-user read/write)
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own watchlists" ON public.watchlists;
DROP POLICY IF EXISTS "Users manage own watchlist" ON public.watchlists;
CREATE POLICY "Users manage own watchlist"
  ON public.watchlists FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own price_alerts" ON public.price_alerts;
DROP POLICY IF EXISTS "Users manage own alerts" ON public.price_alerts;
CREATE POLICY "Users manage own alerts"
  ON public.price_alerts FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER TABLE public.saved_news ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own saved_news" ON public.saved_news;
DROP POLICY IF EXISTS "Users manage own saved news" ON public.saved_news;
CREATE POLICY "Users manage own saved news"
  ON public.saved_news FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

ALTER TABLE public.user_news_follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own news_follows" ON public.user_news_follows;
DROP POLICY IF EXISTS "Users manage own news follows" ON public.user_news_follows;
CREATE POLICY "Users manage own news follows"
  ON public.user_news_follows FOR ALL
  TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

-- AI history: users can read & append their own messages, never delete/alter to bypass 5msg/2d quota
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own ai_analyses" ON public.ai_analyses;
DROP POLICY IF EXISTS "Users view own ai_analyses" ON public.ai_analyses;
DROP POLICY IF EXISTS "Users insert own ai_analyses" ON public.ai_analyses;
CREATE POLICY "Users view own ai_analyses"
  ON public.ai_analyses FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users insert own ai_analyses"
  ON public.ai_analyses FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
REVOKE UPDATE, DELETE ON public.ai_analyses FROM authenticated, anon;

-- 6. Lock down payment_requests & admin_audit_log
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins can update payment requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Users can insert payment requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Users can view own payment requests or admin can view all" ON public.payment_requests;
DROP POLICY IF EXISTS "Users can view own payment requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Users create pending requests" ON public.payment_requests;
DROP POLICY IF EXISTS "Admins can manage payment requests" ON public.payment_requests;

CREATE POLICY "Users view own or admin view all payment requests"
  ON public.payment_requests FOR SELECT
  TO authenticated
  USING ((SELECT auth.uid()) = user_id OR public.is_admin());

CREATE POLICY "Users create pending payment requests"
  ON public.payment_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND status = 'pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND pro_expires_at IS NULL
    AND admin_note IS NULL
  );

REVOKE UPDATE, DELETE ON public.payment_requests FROM authenticated, anon;

CREATE POLICY "Admins manage all payment requests"
  ON public.payment_requests FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin audit log access" ON public.admin_audit_log;
DROP POLICY IF EXISTS "Only admins can view audit log" ON public.admin_audit_log;
DROP POLICY IF EXISTS "Only admins can insert audit log" ON public.admin_audit_log;
CREATE POLICY "Only admins can view audit log"
  ON public.admin_audit_log FOR SELECT
  TO authenticated
  USING (public.is_admin());
CREATE POLICY "Only admins can insert audit log"
  ON public.admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());
REVOKE UPDATE, DELETE ON public.admin_audit_log FROM authenticated, anon;

-- 7. Consent acceptance RPC
CREATE OR REPLACE FUNCTION public.accept_user_terms(version_text TEXT)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  updated_row public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  UPDATE public.profiles
  SET
    terms_accepted_at = COALESCE(terms_accepted_at, NOW()),
    privacy_accepted_at = COALESCE(privacy_accepted_at, NOW()),
    terms_version = version_text,
    updated_at = NOW()
  WHERE id = auth.uid()
  RETURNING * INTO updated_row;
  RETURN updated_row;
END;
$$;
REVOKE ALL ON FUNCTION public.accept_user_terms(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_user_terms(TEXT) TO authenticated;

-- 8. Admin user management RPC (strictly verifies is_admin() + AAL2 MFA)
CREATE OR REPLACE FUNCTION public.admin_manage_user_profile(target_user_id UUID, action_name TEXT)
RETURNS public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  updated_row public.profiles;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator privileges required';
  END IF;
  IF COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' THEN
    RAISE EXCEPTION 'AAL2 MFA session required';
  END IF;

  IF action_name = 'grant_pro' THEN
    UPDATE public.profiles
    SET subscription_tier = 'pro',
        pro_expires_at = NOW() + INTERVAL '30 days',
        updated_at = NOW()
    WHERE id = target_user_id
    RETURNING * INTO updated_row;
  ELSIF action_name = 'revoke_pro' THEN
    UPDATE public.profiles
    SET subscription_tier = 'free',
        pro_expires_at = NULL,
        updated_at = NOW()
    WHERE id = target_user_id
    RETURNING * INTO updated_row;
  ELSIF action_name = 'ban' THEN
    UPDATE public.profiles
    SET is_banned = TRUE,
        is_suspended = TRUE,
        updated_at = NOW()
    WHERE id = target_user_id
    RETURNING * INTO updated_row;
  ELSIF action_name = 'unban' THEN
    UPDATE public.profiles
    SET is_banned = FALSE,
        is_suspended = FALSE,
        updated_at = NOW()
    WHERE id = target_user_id
    RETURNING * INTO updated_row;
  ELSE
    RAISE EXCEPTION 'Invalid admin action: %', action_name;
  END IF;

  RETURN updated_row;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_manage_user_profile(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_manage_user_profile(UUID, TEXT) TO authenticated;

-- 9. Admin payment review RPC (strictly verifies is_admin() + AAL2 MFA)
CREATE OR REPLACE FUNCTION public.admin_review_payment_request(payment_id UUID, action_name TEXT, note TEXT DEFAULT '')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  pay_row public.payment_requests;
  user_row public.profiles;
  expiry TIMESTAMPTZ := NOW() + INTERVAL '30 days';
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator privileges required';
  END IF;
  IF COALESCE(auth.jwt() ->> 'aal', 'aal1') <> 'aal2' THEN
    RAISE EXCEPTION 'AAL2 MFA session required';
  END IF;
  IF action_name NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'Invalid payment action';
  END IF;

  UPDATE public.payment_requests
  SET status = CASE WHEN action_name = 'approve' THEN 'approved' ELSE 'rejected' END,
      admin_note = NULLIF(note, ''),
      notes = NULLIF(note, ''),
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      pro_expires_at = CASE WHEN action_name = 'approve' THEN expiry ELSE NULL END,
      updated_at = NOW()
  WHERE id = payment_id
  RETURNING * INTO pay_row;

  IF pay_row.id IS NULL THEN
    RETURN NULL;
  END IF;

  IF action_name = 'approve' THEN
    UPDATE public.profiles
    SET subscription_tier = 'pro',
        pro_expires_at = expiry,
        updated_at = NOW()
    WHERE id = pay_row.user_id
    RETURNING * INTO user_row;
  END IF;

  RETURN jsonb_build_object('payment', to_jsonb(pay_row), 'updatedUser', to_jsonb(user_row));
END;
$$;
REVOKE ALL ON FUNCTION public.admin_review_payment_request(UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_payment_request(UUID, TEXT, TEXT) TO authenticated;
