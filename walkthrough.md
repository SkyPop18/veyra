# Veyra v2 — Architecture & Verification Walkthrough

## Architecture Overview
Veyra v2 is a strictly view-only global currency and cryptocurrency intelligence platform built with React 19, Vite 8, TypeScript, Tailwind CSS v4, Express 4 (`server.ts`), and Supabase Auth + PostgreSQL (`/supabase/schema.sql`).

- **Live Market Data**: 160+ fiat currencies with flags and `Intl.DisplayNames` names from ExchangeRate-API, paginated CoinGecko `/coins/markets` with Load More, 24-hour cached `/coins/list` server-side search across 10,000+ tokens, on-demand single-coin lookup, live Alternative.me Fear & Greed Index (14-day history), and live multi-source RSS news aggregation.
- **Authentication & Mandatory Consent Gate**: Supabase Auth only (Google OAuth, Email + Password with 10+ char validation, 6-digit Email OTP verification, Magic Link / OTP sign-in, non-enumerating Forgot/Reset Password). Registration disables both Submit and Google OAuth until Terms & Privacy are accepted. Server middleware and client routing enforce the `/accept-terms` gate (`terms_version = '2026-11'`).
- **Manual Pro Billing**: Transparent manual upgrade workflow (`₹200/month`) via Discord (`statusbrew`), email (`akshatbhopali@gmail.com`), and support portal (`https://supportme-akshat.netlify.app/supportme`) with zero card collection or fabricated UPI IDs.

# Security Summary
- **Authentication & Session Integrity**: All authenticated API routes cryptographically verify Supabase access tokens server-side via `supabase.auth.getUser(token)`. Zero mock users, demo sessions, or client-stored auth flags exist anywhere in the codebase.
- **Database & RLS Hardening (`/supabase/schema.sql`)**:
  - Non-recursive `public.is_admin()` helper (`SECURITY DEFINER SET search_path = public`).
  - Privilege escalation lock on `profiles` preventing users from modifying `is_admin`, `subscription_tier`, `subscription_expires_at`, or `is_banned`, backed by a `BEFORE UPDATE` database trigger.
  - `payment_requests` locked to `status = 'pending'` on insert with `UPDATE` and `DELETE` revoked from `authenticated`.
  - `REVOKE ALL` from `anon` across all user tables; append-only `admin_audit_log` (immutable audit trail); zero UI button to grant or revoke admin privileges.
- **Hidden, Hardened Admin Console**:
  - All `/admin`, `/admin/*`, and `/api/admin/*` routes return HTTP `404 Not Found` and zero admin links exist in HTML or UI bundles.
  - Admin console is served exclusively at the server-only environment variable `ADMIN_BASE_PATH` (minimum 24 characters) with multi-layer enforcement: `ADMIN_EMAILS` allowlist, `profiles.is_admin === true`, Supabase TOTP MFA (`aal2`), optional `ADMIN_ALLOWED_IPS` check, 30-minute idle timeout, 10-minute password step-up re-auth for destructive mutations, IP/User-Agent audit logging, `Cache-Control: no-store`, and `X-Robots-Tag: noindex, nofollow`.
- **HTTP & Input Hardening**:
  - Strict CSP without `unsafe-eval`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, HSTS in production, `/.well-known/security.txt`, strict Zod schemas (`.strict()`) on all API mutations, sliding-window rate limits, sanitized external URLs, and generic error responses without stack traces.
- **Dependency Audit**: `bun audit` verified with zero reported vulnerabilities.

## PoC Verification
All verification checks were executed against the live Express + Vite server (`http://localhost:3000`):

1. **Admin Route Concealment (404)**:
   - `GET /admin` -> `404`
   - `GET /admin/users` -> `404`
   - `GET /api/admin/users` -> `404`
   - Confirmed zero `/admin` anchors in rendered landing page DOM (`hasAdminLink: false`).
2. **Security Headers & Discovery**:
   - `GET /.well-known/security.txt` -> `200` with `Contact: mailto:akshatbhopali@gmail.com`.
   - Verified `Content-Security-Policy` (no `unsafe-eval`), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and `Permissions-Policy` on responses.
3. **Unauthenticated Access & Cron Protection**:
   - `GET /api/user/profile` without Bearer token -> `401 Unauthorized`.
   - `POST /api/cron/refresh-markets` without valid `CRON_SECRET` -> `401 Unauthorized`.
4. **Live Market Completeness**:
   - `GET /api/markets/fiat` -> `200` returning 166 live fiat currencies with Unicode flags and full names.
   - `GET /api/markets/crypto/search?q=sol` -> `200` returning live CoinGecko catalog matches.
5. **Registration Terms Gate & UI Audit (Playwright)**:
   - Verified on `/register` that both the Submit button and Google OAuth button remain `disabled` until the mandatory Terms & Privacy checkbox is checked.
   - Verified manual billing contacts (`statusbrew`, `akshatbhopali@gmail.com`, `https://supportme-akshat.netlify.app/supportme`) and zero fabricated UPI IDs.
   - Verified desktop (`1440x900`) and mobile (`390x844`) responsive rendering with zero horizontal overflow, decoded RSS headlines, and crisp hero dashboard visualizations.
6. **Unit Tests & Build**:
   - `npx --yes tsx --test src/lib/core.test.ts` -> 11/11 passing.
   - `compile_applet` & `lint_applet` -> 0 errors.
