# VEYRA — Master Build Prompt for AI Agent

> You are building **Veyra**, a premium currency and crypto analysis web platform from scratch. Read this entire prompt before writing any code. Follow every instruction precisely. Work with multiple sub-agents when needed — delegate clearly and in parallel.

---

## GOAL MODE — DO NOT STOP UNTIL DONE

**You are in GOAL mode. You do not stop working until the entire website is fully built, tested, and deployed.** There is no "good enough." There is no "I'll leave this for later." You finish everything described in this prompt, end to end, before you report completion.

### The Iron Rule: MAKE → TEST → FIX → MOVE ON

For **every single phase** in the build order below, you follow this exact cycle:

```
1. MAKE  — Write the code for that phase
2. TEST  — Verify it works (type-check, lint, build, manual verification, run dev server)
3. FIX   — If anything fails, fix it immediately. Do not move on with broken code.
4. GATE  — Run the phase gate checklist (below). Every item must pass.
5. MOVE ON — Only after the gate passes, proceed to the next phase.
```

**If a test fails**, you fix it right there. You do not skip it. You do not leave a TODO. You do not say "this can be fixed later." You fix it, re-test, and confirm it passes before moving forward.

**If a phase depends on a previous phase**, verify the previous phase still works after integrating the new code. Regressions are caught and fixed immediately.

**If you hit a blocker** (missing API key, need user input, external service down), mark it clearly, skip that specific item, continue building everything else, then come back to it. Never let one blocker stall the entire build.

### Phase Gate Checklist (run after every phase)

```bash
# After EVERY phase, run ALL of these:
npx tsc --noEmit          # Zero type errors
npx next lint             # Zero lint errors
npx next build            # Build succeeds

# If the phase includes UI:
# - Start dev server, visually confirm the new pages/components render
# - Confirm dark/light theme toggle works on new components
# - Confirm responsive layout on mobile viewport (375px)
# - Confirm zero purple/neon/orange colors

# If the phase includes API routes:
# - Test the route returns expected data
# - Confirm auth protection works (unauthenticated → 401)

# If the phase includes database changes:
# - Verify tables exist via Supabase MCP
# - Verify RLS policies work (user can only see own data)
```

**You may not proceed to the next phase until the gate passes.** Period.

### Completion Criteria

You are DONE only when ALL of the following are true:
- [ ] Every phase (1–13) is built, tested, and passing
- [ ] `npx next build` succeeds with zero errors and zero warnings
- [ ] All pages render correctly in both dark and light mode
- [ ] All API routes return correct data with proper auth checks
- [ ] All 12 Supabase tables exist with working RLS
- [ ] Auth flow works end-to-end (register → verify → login → dashboard)
- [ ] Leaderboard, compare, news, AI analysis, admin — all functional
- [ ] Security audit (Phase 14) is complete with findings addressed
- [ ] The website is deployed to Vercel and accessible

**Until every box is checked, you keep working. Use `/goal` behavior — do not stop.**

---

## IDENTITY & CONSTRAINTS

- **Project name**: Veyra
- **Working directory**: `c:\Users\Akshat\Downloads\Currency value website`
- **What it IS**: A view-only currency/crypto viewer, analyzer, and news platform with AI insights
- **What it is NOT**: No buying, selling, swapping, trading, wallets, or transactions of any kind. Zero financial transactions happen in-app. Remove any swap/buy/trade button or flow if you accidentally create one.
- **Database**: Supabase (MCP is connected — use it)
- **Deployment**: Vercel (MCP is connected)
- **AI provider**: Gemini API
- **Payments**: Manual (admin-managed). No Stripe. No payment gateway.
- **Pricing**: ₹200/month for Pro tier (AI Analysis access)

---

## DESIGN SYSTEM — HARD RULES

### Color Palette (STRICTLY ENFORCED)
```
ALLOWED:
  White:  #ffffff, #fafafa, #f4f4f5, #e4e4e7
  Black:  #09090b, #18181b, #27272a, #3f3f46
  Gray:   #52525b, #71717a, #a1a1aa, #d4d4d8
  Blue:   #3b82f6, #2563eb, #1d4ed8, #60a5fa, #93c5fd, #dbeafe
  
DATA ONLY (never for UI chrome, buttons, or decoration):
  Green:  #22c55e (gain/positive only)
  Red:    #ef4444 (loss/negative only)

BANNED — DO NOT USE UNDER ANY CIRCUMSTANCE:
  ❌ Purple, violet, indigo (#7c3aed, #8b5cf6, #6366f1, etc.)
  ❌ Neon colors of any kind
  ❌ Orange, amber, teal, cyan for decoration
  ❌ Gradient rainbow effects
  ❌ Glowing neon borders or text
  ❌ Any color that looks "AI-generated" or "vibe-coded"
```

### Visual Style
- **Glassmorphism**: Every card uses `backdrop-blur-xl` with subtle white/5 (dark) or white/80 (light) backgrounds
- **Dynamic blur background**: Subtle blue-tinted radial gradients that animate slowly (25s cycle)
- **Rounded corners**: `rounded-2xl` on cards, `rounded-xl` on inputs, `rounded-lg` on buttons
- **Shadows**: Soft, never harsh. Dark mode uses darker shadows, light mode uses softer ones
- **Typography**: Inter font. Clean, well-spaced. No decorative fonts.
- **Animations**: Framer Motion for page transitions, hover states, number counters. Smooth, not flashy. 300ms transitions on theme toggle.
- **Responsive**: Fluid across 375px (mobile) → 768px (tablet) → 1440px (desktop). No breakpoint where layout breaks.
- **Icons**: Lucide React only. No emoji in UI (emoji is fine in content/news).

### Theme Toggle
- Dark mode: `#09090b` base, frosted glass cards with `bg-white/5 border-white/10`
- Light mode: `#fafafa` base, frosted glass cards with `bg-white/80 border-zinc-200`
- Toggle with `next-themes`. Smooth 300ms CSS transition. Store preference.

---

## TECH STACK (use exactly these)

```
Framework:    Next.js 15 (App Router, Server Components, Server Actions, TypeScript)
Database:     Supabase PostgreSQL (use Supabase MCP tools: execute_sql, search_docs, etc.)
Auth:         Supabase Auth (Google OAuth + Email OTP verification)
Styling:      Tailwind CSS 4 + custom Veyra design tokens
Animations:   Framer Motion + CSS keyframes
Charts:       TradingView Lightweight Charts (main charts) + Recharts (dashboard widgets)
State:        Zustand (global store) + TanStack React Query (server state / caching)
AI:           Gemini API (@google/generative-ai package)
Icons:        lucide-react
Toasts:       sonner
Forms:        zod (validation)
Utilities:    clsx + tailwind-merge, date-fns
```

### Dependencies to install:
```bash
npm install next@latest react@latest react-dom@latest @supabase/supabase-js @supabase/ssr framer-motion lightweight-charts recharts lucide-react date-fns zustand zod sonner next-themes @tanstack/react-query clsx tailwind-merge @google/generative-ai
npm install -D @types/node @types/react @types/react-dom typescript tailwindcss postcss autoprefixer eslint eslint-config-next
```

### External APIs:
| API | Purpose | Auth | Free Tier |
|---|---|---|---|
| ExchangeRate-API | Fiat currency rates (160+ currencies) | API key | 1500 req/mo |
| CoinGecko API | Crypto prices, market data, coin details | Demo API key (header: `x-cg-demo-api-key`) | 30 req/min |
| Alternative.me | Fear & Greed Index | None | Unlimited |
| GNews API | Market, economic, tax news | API key | 100 req/day |
| Gemini API | AI analysis + news personalization | API key | Generous free tier |

**IMPORTANT**: Cache all external API responses server-side in the `market_cache` Supabase table. Never call external APIs directly from the client. All API calls go through Next.js API routes which check cache first.

---

## DATABASE SCHEMA (Execute via Supabase MCP `execute_sql`)

Run this SQL exactly. All 12 tables. All RLS policies. All indexes. All triggers.

```sql
-- ============================================
-- 1. USER PROFILES (extends auth.users)
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  discord_id TEXT UNIQUE,
  discord_username TEXT,
  discord_connected_at TIMESTAMPTZ,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro')),
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = TRUE));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''), COALESCE(NEW.raw_user_meta_data->>'avatar_url', ''));
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. MANUAL PAYMENT REQUESTS
-- ============================================
CREATE TABLE public.payment_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_inr NUMERIC NOT NULL DEFAULT 200,
  plan TEXT NOT NULL DEFAULT 'pro_monthly',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  payment_proof_url TEXT,
  payment_method TEXT,
  transaction_id TEXT,
  admin_note TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  pro_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payment requests" ON public.payment_requests FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "Users can create payment requests" ON public.payment_requests FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "Admins can manage all payment requests" ON public.payment_requests FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = TRUE));

-- ============================================
-- 3. WATCHLISTS
-- ============================================
CREATE TABLE public.watchlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('crypto', 'fiat')),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, symbol, asset_type)
);
ALTER TABLE public.watchlists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own watchlist" ON public.watchlists FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- ============================================
-- 4. PRICE ALERTS
-- ============================================
CREATE TABLE public.price_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('crypto', 'fiat')),
  target_price NUMERIC NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('above', 'below')),
  is_triggered BOOLEAN NOT NULL DEFAULT FALSE,
  triggered_at TIMESTAMPTZ,
  notify_discord BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.price_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own alerts" ON public.price_alerts FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- ============================================
-- 5. AI ANALYSIS HISTORY (Pro users only)
-- ============================================
CREATE TABLE public.ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  response TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.ai_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Pro users can view own analyses" ON public.ai_analyses FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id AND EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND subscription_tier = 'pro'));

-- ============================================
-- 6. NEWS CATEGORIES & FOLLOWING
-- ============================================
CREATE TABLE public.news_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  category_type TEXT NOT NULL CHECK (category_type IN ('topic', 'asset', 'region')),
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.news_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read categories" ON public.news_categories FOR SELECT TO authenticated USING (TRUE);

CREATE TABLE public.user_news_follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.news_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, category_id)
);
ALTER TABLE public.user_news_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own follows" ON public.user_news_follows FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- ============================================
-- 7. USER INTERACTIONS (personalization engine)
-- ============================================
CREATE TABLE public.user_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('view', 'like', 'save', 'search')),
  content_type TEXT NOT NULL,
  content_id TEXT,
  content_title TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own interactions" ON public.user_interactions FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE INDEX idx_user_interactions_user_type ON public.user_interactions (user_id, interaction_type, created_at DESC);
CREATE INDEX idx_user_interactions_tags ON public.user_interactions USING GIN (tags);

-- ============================================
-- 8. CURRENCY STRENGTH LEADERBOARD
-- ============================================
CREATE TABLE public.currency_strength (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_code TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('crypto', 'fiat')),
  strength_score NUMERIC NOT NULL,
  rank INTEGER NOT NULL,
  change_24h NUMERIC,
  change_7d NUMERIC,
  vs_usd_rate NUMERIC,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(currency_code, asset_type, calculated_at)
);
ALTER TABLE public.currency_strength ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read for strength data" ON public.currency_strength FOR SELECT TO authenticated USING (TRUE);

-- ============================================
-- 9. API CONFIGS (Admin only)
-- ============================================
CREATE TABLE public.api_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_name TEXT NOT NULL UNIQUE,
  api_key_encrypted TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  rate_limit_per_min INTEGER,
  last_checked_at TIMESTAMPTZ,
  status TEXT DEFAULT 'healthy',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.api_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can manage API configs" ON public.api_configs FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = TRUE));

-- ============================================
-- 10. ADMIN AUDIT LOG
-- ============================================
CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only admins can view audit log" ON public.admin_audit_log FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = (SELECT auth.uid()) AND is_admin = TRUE));

-- ============================================
-- 11. MARKET CACHE
-- ============================================
CREATE TABLE public.market_cache (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);
ALTER TABLE public.market_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read for cached data" ON public.market_cache FOR SELECT TO authenticated USING (TRUE);

-- ============================================
-- 12. SAVED NEWS
-- ============================================
CREATE TABLE public.saved_news (
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
CREATE POLICY "Users manage own saved news" ON public.saved_news FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

-- ============================================
-- SEED: Default news categories
-- ============================================
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
  ('commodities', 'Commodities', 'topic', 'Landmark');
```

---

## SECURITY RULES (NON-NEGOTIABLE)

1. **Never expose `SUPABASE_SERVICE_ROLE_KEY` or any secret key to the client.** Only use service role in server-side code (API routes, Server Actions). All client-side code uses the anon key via `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

2. **RLS is mandatory on every table.** Already defined above. Never disable RLS. Never use `SECURITY DEFINER` functions unless the trigger above requires it (and that one already has `SET search_path = ''`).

3. **Validate all user input with Zod.** Every API route and Server Action must validate incoming data with a Zod schema before processing. No raw `req.body` usage.

4. **Admin routes are double-protected.** Middleware checks auth. API routes additionally verify `profiles.is_admin = true` before executing admin actions. Never trust client-side admin flags.

5. **AI Analysis is gated server-side.** The `/api/ai/analyze` route must check `profiles.subscription_tier = 'pro'` in the database before calling Gemini. Never trust a client-side "isPro" flag.

6. **API keys are stored in `.env.local` only.** Never hardcode API keys. Never commit `.env.local`. Add it to `.gitignore`.

7. **Rate limit API routes.** Use simple in-memory rate limiting or Supabase-based counters to prevent abuse on expensive endpoints (`/api/ai/analyze`, `/api/market/*`).

8. **Sanitize all user-generated content.** News article titles, user names, and AI responses displayed in the UI must be sanitized to prevent XSS.

9. **CORS is handled by Next.js defaults.** Don't add custom CORS headers unless specifically needed for the Discord bot.

10. **Payment proof uploads**: If implementing file upload for payment screenshots, use Supabase Storage with RLS (users can only upload to their own folder). Validate file type (images only) and size (max 5MB).

---

## PAGE STRUCTURE & ROUTES

### Public Routes (no auth required)
```
/                    → Landing page (hero, features, pricing, CTA)
/login               → Login (Google OAuth + Email)
/register            → Register (Google OAuth + Email + password)
/verify-email        → OTP code entry page
/privacy             → Privacy Policy
/terms               → Terms & Conditions
```

### Protected Routes (auth required, redirect to /login if not authenticated)
```
/dashboard/home              → HOME: stats, followed currencies bar graph, 4 news sections
/dashboard/currencies        → All fiat currencies list with strength ranking
/dashboard/currencies/[code] → Individual currency detail page
/dashboard/crypto            → All crypto list (top 100+) with rankings
/dashboard/crypto/[id]       → Individual crypto detail page
/dashboard/leaderboard       → Currency Strength Leaderboard (fiat + crypto tabs)
/dashboard/compare           → Head-to-head currency comparison (select 2+)
/dashboard/converter         → Currency converter (view rates only)
/dashboard/heatmap           → Interactive world currency heatmap
/dashboard/watchlist         → User's personal watchlist
/dashboard/alerts            → Price alert management
/dashboard/news              → Personalized news feed with follow/unfollow
/dashboard/news/saved        → Bookmarked articles
/dashboard/news/[category]   → News filtered by category
/dashboard/ai-analysis       → AI Analysis chat (Pro only — show paywall for free users)
/dashboard/settings          → General settings (profile, theme)
/dashboard/settings/discord  → Discord account connection
/dashboard/settings/subscription → View plan, request upgrade to Pro
```

### Admin Routes (auth + is_admin = true required)
```
/admin               → Admin overview dashboard (user count, revenue, API health)
/admin/users         → User management (search, view, grant admin)
/admin/payments      → Payment request management (approve/reject with proof review)
/admin/api-keys      → API key configuration + health checks
/admin/discord       → Discord connection overview + bot status
/admin/audit-log     → Admin action audit trail
```

---

## KEY FEATURES — DETAILED SPECS

### 1. Dashboard Home (`/dashboard/home`)
The main hub after login. Layout (top to bottom):

**Row 1 — Live Ticker** (full width, scrolling marquee):
- Animated horizontal scroll showing: BTC, ETH, SOL, XRP prices + % change, USD/EUR, USD/GBP, USD/INR rates
- Blue text for positive, default for negative

**Row 2 — Quick Stats** (4 glass cards in a row):
- Fear & Greed Index (circular gauge, 0-100)
- Top Mover Today (highest % gainer with sparkline)
- BTC Price (with 24h change)
- Active users count

**Row 3 — Followed Currencies Bar Chart** (full width glass card):
- Vertical bar chart showing strength scores (0-100) for currencies the user follows
- If user follows nothing, show a prompt: "Follow currencies to see them here"
- Blue bars, labeled with currency code + flag/icon

**Row 4 — News Grid** (2×2 grid of glass cards):
- Top-left: **Economic News** (central bank, GDP, inflation headlines)
- Top-right: **Global Tax Updates** (international tax policy)
- Bottom-left: **Market News** (crypto/forex movements)
- Bottom-right: **Suggested For You** (AI-personalized based on user's interactions)
- Each card shows 3-5 article previews with title, source, time ago
- Each article has [Follow topic] and [Save] action buttons
- Suggested section additionally has [👍 Like] and [Not interested] buttons

### 2. Currency Strength Leaderboard (`/dashboard/leaderboard`)
- Two tabs: **Fiat Currencies** | **Cryptocurrencies**
- Sortable table: Rank | Flag/Icon | Name | Code | Strength (0-100 horizontal bar) | 24h Change | 7d Change
- Strength bars use blue gradient (darker = stronger)
- Click any row → navigate to that currency's detail page
- Search/filter at the top
- "Compare" button to select 2+ and jump to `/dashboard/compare`

### 3. Currency Comparison (`/dashboard/compare`)
- Two (or more) dropdown selectors to pick currencies
- Side-by-side strength bars with percentage labels
- Overlay line chart showing historical performance (1D, 1W, 1M, 3M, 1Y selectors)
- "Which is stronger?" verdict card with the difference percentage
- Animated transitions when switching currencies

### 4. Personalized News System
- **Following**: Users follow news categories (crypto, forex, economic, taxes, bitcoin, ethereum, etc.)
- **Interaction tracking**: Every view, like, save, and search is recorded in `user_interactions` with tags
- **Suggestion engine** (`/api/user/suggestions`):
  1. Fetch user's recent interactions (last 50)
  2. Extract top tags by frequency
  3. Fetch latest 30 news articles
  4. Send to Gemini: "Given this user's interests [tags], rank these articles by relevance"
  5. Return top 10 as "Suggested For You"
- **Feedback loop**: Like reinforces tags, "Not interested" reduces tag weight

### 5. AI Analysis (`/dashboard/ai-analysis`) — PRO ONLY
- If user is free tier: show a beautiful paywall overlay explaining Pro benefits, ₹200/month pricing, and an "Upgrade" button that goes to settings/subscription
- If user is Pro:
  - Chat interface (similar to ChatGPT). Glass card container. Blue send button.
  - User types question → hits `/api/ai/analyze`
  - Server fetches latest market data (prices, fear/greed, top movers) and injects as context
  - Streams Gemini response back to client
  - Saves query + response in `ai_analyses` table
  - Suggested questions: "What's the BTC outlook?", "Compare USD vs EUR this week", "Is crypto market bullish?"

### 6. Manual Payment Flow
- User goes to `/dashboard/settings/subscription`
- Sees current plan (Free) and Pro benefits card
- Clicks "Upgrade to Pro — ₹200/month"
- Shows payment instructions: UPI ID, bank details, QR code (all configurable by admin)
- User fills form: payment method, transaction ID, optional screenshot upload
- Submits → creates `payment_requests` row with status "pending"
- Admin sees it in `/admin/payments`, reviews proof, clicks Approve or Reject
- On approval: profile.subscription_tier → 'pro', pro_expires_at → now + 30 days
- On access: check if `pro_expires_at` has passed → auto-revert to 'free'

### 7. Admin Dashboard
- Overview: total users, pro users, pending payments, API health (green/red dots), revenue
- Users: searchable table with columns: Name, Email, Plan, Discord, Joined, Actions
- Payments: table with Status filter (pending/approved/rejected), proof preview, approve/reject buttons
- API Keys: cards for each service (CoinGecko, ExchangeRate, Gemini, GNews, Discord) showing status, last checked, rate limit usage
- Audit Log: timestamped list of all admin actions

### 8. Discord Bot (separate `discord-bot/` folder)
- Built with discord.js v14
- Slash commands: `/price`, `/rate`, `/top`, `/sentiment`, `/watchlist`, `/alert`, `/leaderboard`, `/analyze`, `/link`
- Embeds use blue accent color (#3b82f6)
- `/link` connects Discord account to Veyra profile via OAuth
- `/analyze` checks Pro status before calling Gemini

### 9. Legal Pages
- **Privacy Policy** (`/privacy`): What we collect (email, name, avatar, Discord ID, interaction history). What we don't (payment card info, passwords). Third-party services used. Data retention (90 days AI history, 180 days interactions). User rights (access, delete, export). Cookies (session tokens only).
- **Terms & Conditions** (`/terms`): Informational platform, not financial advice. ₹200/month Pro tier, manual payment. No scraping. Age 13+. Limitation of liability. Termination policy.

---

## AUTH FLOW

1. **Register with Email**: `signUp({ email, password })` → Supabase sends OTP → user enters 6-digit code on `/verify-email` → `verifyOtp()` → redirect to `/dashboard/home`
2. **Register/Login with Google**: `signInWithOAuth({ provider: 'google' })` → Google consent → callback → auto-create profile via trigger → redirect to `/dashboard/home`
3. **Discord Connection** (optional, from settings): Discord OAuth2 → callback saves `discord_id` and `discord_username` to profile
4. **Middleware** (`src/middleware.ts`): Protect `/dashboard/*` and `/admin/*`. Redirect unauthenticated users to `/login`. For `/admin/*`, additionally check `is_admin`.

---

## BUILD ORDER (for a single agent or coordinator)

Work in this exact order. Each step must compile before moving to the next.

### Phase 1 — Foundation
1. Initialize Next.js project with TypeScript, Tailwind, App Router, `src/` directory
2. Install all dependencies
3. Set up Tailwind config with Veyra design tokens (colors, shadows, animations, blur)
4. Create `globals.css` with glass utilities, veyra-bg animation, theme transitions
5. Set up Supabase clients (`lib/supabase/client.ts`, `server.ts`, `admin.ts`)
6. Execute all SQL via Supabase MCP to create the 12 tables
7. Create `.env.local` template
8. Set up `middleware.ts` for route protection

### Phase 2 — UI Primitives
9. Build all `components/ui/*` components: glass-card, button, input, sidebar, topbar, theme-toggle, data-table, badge, modal, tabs, dropdown, loading-skeleton, price-ticker, sparkline, animated-counter
10. Build root layout with providers (Supabase, React Query, next-themes, Zustand)
11. Build dashboard layout (sidebar + topbar + ticker + content area)

### Phase 3 — Auth
12. Build login page, register page, verify-email page, auth layout
13. Build login-form, register-form, otp-input, google-button components
14. Create auth callback route (`/api/auth/callback`)
15. Test: register → verify → login → dashboard redirect

### Phase 4 — Market Data Layer
16. Build API wrappers: `lib/api/coingecko.ts`, `exchange-rates.ts`, `fear-greed.ts`, `news.ts`, `strength.ts`
17. Build API routes: `/api/market/crypto`, `/api/market/fiat`, `/api/market/fear-greed`, `/api/market/strength`, `/api/market/news`
18. Build React Query hooks: `hooks/use-market-data.ts`
19. Build caching: check `market_cache` table before external API call, store result with TTL

### Phase 5 — Charts
20. Build all chart components: tradingview-chart, area-chart, bar-chart, candlestick-chart, fear-greed-gauge, heatmap-chart, strength-bar, comparison-chart, sparkline

### Phase 6 — Dashboard Pages
21. Build `/dashboard/home` with all 4 rows (ticker, stats, followed currencies, news grid)
22. Build `/dashboard/currencies` and `/dashboard/currencies/[code]`
23. Build `/dashboard/crypto` and `/dashboard/crypto/[id]`
24. Build `/dashboard/leaderboard` with fiat/crypto tabs
25. Build `/dashboard/compare` with multi-select comparison
26. Build `/dashboard/converter`
27. Build `/dashboard/watchlist`
28. Build `/dashboard/alerts`
29. Build `/dashboard/heatmap`

### Phase 7 — News & Personalization
30. Build `/dashboard/news` with follow/unfollow, save, like functionality
31. Build `/dashboard/news/saved` for bookmarked articles
32. Build interaction tracking hook (`hooks/use-interactions.ts`)
33. Build `/api/user/interactions` and `/api/user/suggestions` routes
34. Build personalized feed component with Gemini ranking

### Phase 8 — AI Analysis
35. Build Gemini client (`lib/ai/gemini.ts`)
36. Build `/api/ai/analyze` route with Pro-only gate and market data context injection
37. Build AI chat UI with streaming responses
38. Build paywall-gate component for free users

### Phase 9 — Settings & Payments
39. Build settings pages (general, discord connection, subscription)
40. Build payment request flow (form → submit → show pending status)
41. Build Discord OAuth connection flow

### Phase 10 — Admin Dashboard
42. Build admin layout with admin sidebar
43. Build admin overview page with stats cards
44. Build user management table
45. Build payment request management (approve/reject)
46. Build API health monitoring
47. Build audit log viewer

### Phase 11 — Landing & Legal
48. Build landing page (hero, features, pricing, leaderboard preview, CTA, footer)
49. Write and build Privacy Policy page
50. Write and build Terms & Conditions page

### Phase 12 — Discord Bot
51. Set up `discord-bot/` folder with package.json and tsconfig
52. Build bot entry point with discord.js v14
53. Build all slash commands
54. Build embed builders with blue accent

### Phase 13 — Final Build Verification
55. Run `npx tsc --noEmit` — fix ALL type errors (zero tolerance)
56. Run `npx next lint` — fix ALL lint errors (zero tolerance)
57. Run `npx next build` — MUST succeed with zero errors
58. Start dev server, test every route manually
59. Verify color palette — zero purple/neon/orange anywhere in the entire app
60. Verify responsive on 375px, 768px, 1440px — no layout breaks anywhere
61. Test auth flow end-to-end: register → OTP → login → dashboard
62. Test leaderboard, compare, news follow, watchlist, converter
63. Test AI analysis paywall (free user blocked, Pro user gets response)
64. Test admin dashboard (users, payments, API health)
65. Fix every issue found. Re-run build. Repeat until clean.

### Phase 14 — Security Audit (MANDATORY FINAL STEP)

**After everything is built and working, run a full security audit using the `security-audit` skill.**

Read the skill at: `C:\Users\Akshat\.gemini\config\skills\security-audit\SKILL.md`

Run it in **full audit mode** — this is an explicit, comprehensive, end-to-end security review of the entire Veyra codebase. The audit must:

1. **Map all trust boundaries**: client vs server, authenticated vs unauthenticated, free vs Pro, user vs admin, browser vs API, Supabase RLS boundaries
2. **Hunt for real vulnerabilities** across these attack surfaces:
   - Authentication bypass (can someone access dashboard without login?)
   - Authorization bypass (can free user access Pro AI analysis? Can non-admin access admin routes?)
   - RLS bypass (can user A see user B's watchlist, alerts, payment requests, or interactions?)
   - API key exposure (are any secrets leaked to client-side code or browser?)
   - XSS via news content, AI responses, or user-generated input
   - Injection via search queries, converter inputs, or API parameters
   - IDOR (can user manipulate IDs to access other users' data?)
   - Admin privilege escalation (can a regular user set `is_admin = true` on their own profile?)
   - Payment manipulation (can user approve their own payment request?)
   - Rate limiting gaps on expensive endpoints (AI analysis, market data)
3. **Validate every finding** with source evidence — no guessing
4. **Fix every confirmed vulnerability** immediately in the codebase
5. **Re-verify** that fixes don't break anything (run full build again)
6. **Generate the security report** artifacts:
   - `REPORT.md` — executive summary of security posture
   - `FINDINGS-DETAIL.md` — detailed findings with evidence and fixes applied
   - `NEEDS-VALIDATION.md` — anything that needs production environment testing

**Do not skip this phase. Do not abbreviate it. Security is non-negotiable.**

### Phase 15 — Deploy to Vercel
66. Deploy the final, security-audited build to Vercel
67. Verify the deployed site works end-to-end
68. Confirm all environment variables are set in Vercel dashboard

---

## MULTI-AGENT DELEGATION

If you are a coordinator managing sub-agents, delegate as follows. Each agent works in its own branch/workspace to avoid conflicts:

| Agent Name | Owns | Depends On |
|---|---|---|
| `db-architect` | Supabase schema (all 12 tables via MCP) | Nothing |
| `scaffolder` | Project init, deps, Tailwind config, file structure, middleware | Nothing |
| `design-system` | All `components/ui/*` + root layout + dashboard layout | scaffolder |
| `auth-agent` | Auth pages, forms, callbacks, middleware logic | scaffolder, db-architect |
| `market-data-agent` | API wrappers, API routes, caching, React Query hooks, strength calculator | scaffolder, db-architect |
| `charts-agent` | All `components/charts/*` | scaffolder |
| `dashboard-agent` | Home page, currency/crypto pages, converter, watchlist, alerts, heatmap | design-system, market-data-agent, charts-agent |
| `leaderboard-agent` | Leaderboard page, compare page, strength bars | design-system, market-data-agent, charts-agent |
| `news-agent` | News pages, follow/unfollow, interaction tracking, suggestions engine | design-system, market-data-agent |
| `ai-agent` | AI analysis chat, Gemini integration, paywall | design-system, market-data-agent, auth-agent |
| `admin-agent` | Entire admin dashboard | design-system, auth-agent, db-architect |
| `payment-agent` | Payment request flow, subscription settings | design-system, auth-agent, db-architect |
| `landing-agent` | Landing page | design-system, market-data-agent |
| `legal-agent` | Privacy Policy + Terms pages | scaffolder |
| `discord-agent` | Entire Discord bot | db-architect, market-data-agent |
| `integration-agent` | Final testing, responsive check, build verification | All |
| `security-agent` | Full security audit using `security-audit` skill (MANDATORY) | All |
| `deploy-agent` | Vercel deployment after security audit passes | All |

**Phases**: db-architect + scaffolder run first (parallel). Then design-system + charts-agent (parallel). Then all feature agents (parallel). Then integration-agent. Then security-agent. Then deploy-agent. **Every agent follows the MAKE → TEST → FIX → MOVE ON cycle.**

---

## ENV TEMPLATE

Create `.env.local` with these exact keys (values left blank for user to fill):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Discord
DISCORD_BOT_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
NEXT_PUBLIC_DISCORD_INVITE_URL=

# External APIs
COINGECKO_API_KEY=
EXCHANGERATE_API_KEY=
GNEWS_API_KEY=
GEMINI_API_KEY=

# App
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

---

## FINAL CHECKLIST BEFORE MARKING DONE

**You are NOT done until every single box is checked. Keep working until they all pass.**

- [ ] `npx next build` succeeds with zero errors and zero warnings
- [ ] All 12 Supabase tables created with RLS policies working
- [ ] Auth works end-to-end (Google + Email OTP → verify → dashboard)
- [ ] Dashboard home renders with real API data (fear/greed, prices, news)
- [ ] Followed currencies bar graph works
- [ ] Leaderboard shows ranked currencies with strength bars (fiat + crypto tabs)
- [ ] Compare page works with 2+ currencies side-by-side
- [ ] News feed loads, follow/save works, Gemini suggestions appear
- [ ] AI Analysis blocked for free users (paywall shown), works for Pro users (streamed response)
- [ ] Manual payment request flow works (submit → admin sees → approve → Pro activates)
- [ ] Admin dashboard loads with user management, payment approval, API health
- [ ] Discord bot code is complete with all slash commands
- [ ] Theme toggle (dark ↔ light) works with smooth 300ms transition
- [ ] Zero purple, neon, or orange anywhere in the entire UI — only white, black, gray, blue
- [ ] Responsive on mobile (375px), tablet (768px), desktop (1440px) — no breakpoints break
- [ ] Privacy Policy and Terms & Conditions pages exist with accurate content
- [ ] `.env.local` is in `.gitignore` — no secrets in client code or git history
- [ ] No `SUPABASE_SERVICE_ROLE_KEY` exposed in any client-side file
- [ ] All API routes validate input with Zod
- [ ] Admin routes double-check `is_admin` server-side (not just middleware)
- [ ] **Security audit completed** (Phase 14) — `REPORT.md` and `FINDINGS-DETAIL.md` generated
- [ ] **All confirmed vulnerabilities from security audit are FIXED**
- [ ] Final build passes after security fixes
- [ ] Deployed to Vercel and accessible

**If any box is unchecked, you are not done. Go back and fix it.**
