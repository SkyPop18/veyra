# Veyra — Architecture Assessment, Security Findings & Implementation Roadmap

## 1. Project Architecture Assessment

- **Runtime Alignment**: The workspace is provisioned as a full-stack **React 19 + Vite 8 + Express 4 + TypeScript + Tailwind CSS v4** application running on port `3000` (`tsx server.ts` mounting Vite middleware in development and serving compiled static assets + Express `/api/*` routes in production). All Veyra routes (`/`, `/login`, `/register`, `/verify-email`, `/privacy`, `/terms`, `/dashboard/*`, `/admin/*`) and API endpoints (`/api/auth/*`, `/api/market/*`, `/api/user/*`, `/api/ai/*`, `/api/admin/*`, `/api/discord/*`) are implemented directly on this stack with zero external proxy hacks.
- **Persistence & Supabase Readiness**: Because `SUPABASE_SERVICE_ROLE_KEY` is currently unset in the environment, the backend implements a **dual-mode persistence layer**:
  - A full **hardened 13-table PostgreSQL schema** (`/supabase/schema.sql`) ready to deploy to Supabase (`afdavafhifkboxsliqut`).
  - A persistent **server-side local data store** (`server/store.ts`) that mirrors all 13 tables with identical server-enforced authorization, market caching, watchlists, price alerts, interaction tracking, saved news, payment requests, and audit logging so every flow operates end-to-end immediately.
- **View-Only Boundary**: Strictly enforced across UI and API — zero buy, sell, swap, trade, wallet, or brokerage flows exist anywhere in the platform.

---

## 2. Critical Security Findings & Remediations

1. **Profile Privilege Escalation (`public.profiles` RLS)** — *Critical*:
   - *Original flaw*: `"Users can update own profile"` allowed authenticated users to `UPDATE` any column on their own row, enabling direct client-side elevation to `is_admin = TRUE` and `subscription_tier = 'pro'`.
   - *Remediation*: Revoked table-wide `UPDATE` from `authenticated`, granted `UPDATE (full_name, avatar_url)` only, and added a `BEFORE UPDATE` trigger (`protect_profile_privileged_columns`) blocking modifications to `is_admin`, `subscription_tier`, `pro_expires_at`, `email_verified`, `email`, and `discord_*` by non-service roles. Enforced identical column allowlisting in `server/routes.ts`.
2. **RLS Infinite Recursion (`public.profiles` Admin Policy)** — *High*:
   - *Original flaw*: Admin `SELECT` policy queried `public.profiles` from inside a policy on `public.profiles`, triggering PostgreSQL error `42P17`.
   - *Remediation*: Introduced `public.is_current_user_admin()` (`SECURITY DEFINER`, `SET search_path = ''`) and reused it across all admin policies.
3. **Payment Request Tampering (`public.payment_requests` INSERT Policy)** — *High*:
   - *Original flaw*: Users could insert rows with `status = 'approved'`, arbitrary `amount_inr`, or backdated `pro_expires_at`.
   - *Remediation*: Hardened `WITH CHECK` to require `status = 'pending'`, `amount_inr = 200`, and `NULL` for `reviewed_by`, `reviewed_at`, `pro_expires_at`, and `admin_note`. Server routes enforce identical Zod validation and server-side state assignment.
4. **Exposed Live Credentials in Prompt** — *Critical (Action Required)*:
   - Live/sensitive values (`DISCORD_BOT_TOKEN`, `DISCORD_CLIENT_SECRET`, `GEMINI_API_KEY`, `ADMIN_SECRET_KEY`, `ADMIN_SESSION_SECRET`) were pasted in plaintext. None are written to source code or `.env.example`. **Rotate all pasted tokens/secrets immediately** and inject replacements only via server environment secrets.
5. **Over-Privileged Discord Invite (`permissions=8`)** — *High*:
   - The provided invite URL requests Discord **Administrator** (`8`). Replaced with least-privilege permissions (`2147502080`: Send Messages, Embed Links, Use Application Commands).
6. **Pro AI Gate & Admin Authorization**:
   - `/api/ai/analyze` verifies authenticated session + active `subscription_tier === 'pro'` + non-expired `pro_expires_at` strictly server-side (auto-reverting expired Pro accounts to `'free'`).
   - All `/api/admin/*` routes verify server-side admin session + role (supporting `process.env.ADMIN_SECRET_KEY` and a one-time scrypt-hashed First-Run Admin Claim fallback when unset in preview).
7. **XSS & URL Scheme Validation**:
   - External news articles and streamed AI markdown render strictly via React text nodes (zero `dangerouslySetInnerHTML`), with strict `http:`/`https:` URL validation blocking `javascript:`/`data:` URIs.

---

## 3. Requirements Inconsistencies Reconciled

| # | Area | Discrepancy in Source Docs | Resolution |
|---|---|---|---|
| 1 | Database Table Count | Docs state "12 tables" while Section 6 creates 2 tables (`news_categories` + `user_news_follows`) = **13 tables**. | Standardized to **13 tables** across `/supabase/schema.sql`, backend store, and documentation. |
| 2 | Framework & Lint Command | Docs specify Next.js 15 + `next@latest` (v16) + `npx next lint` (removed in Next 16), while workspace is Vite 8 + React 19 + Express 4 (`tsc --noEmit`). | Built natively on workspace Vite + React + Express (`server.ts`, port 3000) with `npm run lint` (`tsc --noEmit`) and `npm run build` (`vite build`). |
| 3 | Gemini SDK | Master prompt listed legacy `@google/generative-ai`; workspace uses `@google/genai`. | Upgraded `@google/genai` to latest and used server-side `GoogleGenAI` with `gemini-4-hydrogen`. |
| 4 | Branding Residual | `implementation-plan.md` referenced `CurrencyScope` in Discord bot package and diagrams. | Standardized 100% to **Veyra** (`veyra-discord-bot`). |
| 5 | Schema Gaps | `pro_expires_at` missing on `profiles`; `dislike` missing from `user_interactions.interaction_type` CHECK constraint; `market_cache` & `currency_strength` blocked unauthenticated landing page reads. | Added `pro_expires_at` to `profiles`, added `'dislike'` to `interaction_type`, enabled `anon` read on `market_cache`/`currency_strength`/`news_categories`. |
| 6 | Ticker Color Rule | Home spec said "blue for positive, default for negative" while Design System specified Green `#22c55e` / Red `#ef4444` for data gain/loss. | Enforced Green `#22c55e` (positive) and Red `#ef4444` (negative) with directional arrows/signs strictly for numeric deltas; Blue `#3b82f6` exclusively for UI accent, active states, CTAs, and strength bars. Zero purple/violet/neon/orange/teal. |

---

## 4. Dependency & External API Requirements

- **Core Runtime**: React 19, Vite 8, Express 4, TypeScript, Tailwind CSS v4, `react-router-dom`, `motion`, `lucide-react`, `recharts`, `lightweight-charts`, `zod`, `@google/genai`, `cookie-parser`, `@supabase/supabase-js`.
- **External APIs (Server-Proxied + Cached)**:
  - **Fiat Rates**: ExchangeRate-API (`EXCHANGERATE_API_KEY` optional; falls back to open `https://open.er-api.com/v6/latest/USD` + cached snapshot).
  - **Crypto Market**: CoinGecko Demo API (`COINGECKO_API_KEY` optional; falls back to public CoinGecko v3 endpoint + cached snapshot).
  - **Sentiment**: Alternative.me Fear & Greed Index (`https://api.alternative.me/fng/?limit=30`, no key required).
  - **News**: GNews API (`GNEWS_API_KEY` optional; falls back to live RSS/curated financial feed cache).
  - **AI Intelligence**: Google Gemini (`GEMINI_API_KEY` via server-side `@google/genai` using `gemini-4-hydrogen`).

---

## 5. Corrected Implementation Roadmap & Parallel Delegation Map

1. **Phase 1 — Foundation, Schema & Core Math** *(Parallelizable: DB Architect + Scaffolder + Pure Logic)*
   - Hardened 13-table SQL schema, Express + Vite server entry point, design system tokens (`@custom-variant dark`, glassmorphism, white/black/gray/blue palette), pure currency strength & converter engine with `node:test` unit tests.
2. **Phase 2 — Authentication, Sessions & Security Controls** *(Depends on Phase 1)*
   - Email + Password registration, 6-digit Email OTP verification, Google OAuth sign-in flow, Discord account link, HttpOnly signed session cookies / Bearer auth, server-side route protection, First-Run Admin Claim & Admin key verification.
3. **Phase 3 — Market Data Layer & Caching** *(Parallelizable with Phase 2)*
   - Server-side CoinGecko, ExchangeRate, Alternative.me, and News aggregators with TTL caching (`market_cache`), rate limiting, Zod validation, and normalized 0–100 strength leaderboard computation.
4. **Phase 4 — Charts & Dashboard Workspace** *(Depends on Phase 2 & 3)*
   - TradingView Lightweight Charts (asset detail), Recharts (Followed Currencies strength bars, multi-currency comparison overlay, Fear & Greed dial, sparklines), Dashboard Home (4 rows), Fiat & Crypto lists/details, Leaderboard, Head-to-Head Compare, Converter, World Currency Heatmap, Watchlist, and Price Alerts.
5. **Phase 5 — Personalized News & Pro AI Analysis** *(Parallelizable with Phase 6)*
   - Topic follow/unfollow, interaction tracking (`view`, `like`, `dislike`, `save`, `search`), Gemini-ranked Suggested For You feed, Bookmarked News, server-gated Pro AI streaming chat (`₹200/month` paywall for free users).
6. **Phase 6 — Manual Payments, Settings, Admin Console, Landing, Legal & Discord Bot** *(Parallelizable)*
   - Subscription upgrade proof submission, Admin Overview / Users / Payments (Approve/Reject with 30-day Pro activation) / API Health / Discord / Audit Log, Public Landing Page, Privacy Policy, Terms & Conditions, and standalone `discord-bot/` package.
7. **Phase 7 — Unit Tests, Browser Verification & Security Audit**
   - `tsx --test` unit suite, `compile_applet` + `lint_applet`, Playwright headless Chromium visual & journey verification across desktop & mobile viewports, and final security verification in `walkthrough.md`.

---

## 6. Phase-by-Phase Acceptance Criteria

- **Phase 1**: 13-table schema passes SQL review with profile privilege lock; unit tests for strength scoring, converter math, and URL sanitization pass 100%.
- **Phase 2**: Unauthenticated requests to `/api/user/*`, `/api/ai/analyze`, `/api/admin/*` return `401`; non-admin requests to `/api/admin/*` return `403`; register → 6-digit OTP → dashboard home succeeds end-to-end.
- **Phase 3**: `/api/market/*` endpoints return real/cached fiat, crypto, strength, sentiment, and news payloads with TTL caching and zero external client calls.
- **Phase 4**: All dashboard screens render cleanly in Dark and Light modes with zero purple/neon/orange colors, tabular numerals, and live interactive state (watchlist, alerts, compare, converter, heatmap).
- **Phase 5**: Free users see the ₹200/month paywall on `/dashboard/ai-analysis` and receive `403` from `/api/ai/analyze`; Pro users receive live streamed Gemini analysis grounded in current market data.
- **Phase 6**: Submitting a manual UPI payment creates a pending request visible in `/admin/payments`; approving upgrades the user to Pro for 30 days and logs an immutable audit entry; Discord bot code compiles cleanly with least-privilege permissions.
- **Phase 7**: Zero TypeScript or Vite build errors, zero high-severity visual or functional defects in Playwright verification, and verified security posture documented in `walkthrough.md`.
