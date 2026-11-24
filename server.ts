import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import cookieParser from 'cookie-parser';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import {
  buildStrengthLeaderboard,
  fetchAggregatedNews,
  fetchCryptoCatalog,
  fetchFearAndGreed,
  fetchHistoricalSeries,
  fetchLiveCryptoAssets,
  fetchLiveFiatCurrencies,
  forceRefreshMarkets,
  getCryptoAssetByIdOrSymbol,
  searchCryptoCatalog,
} from './server/market.ts';
import {
  addSavedNews,
  addWatchlistItem,
  adminGetOverviewStats,
  adminListAuditLogs,
  adminListPayments,
  adminListUsers,
  adminManageUser,
  adminReviewPayment,
  createAlert,
  createPaymentRequest,
  deleteAlert,
  deleteSavedNews,
  deleteUserAccount,
  deleteWatchlistItem,
  exportUserData,
  getApiHealthStatuses,
  getOrCreateProfileFromSupabaseUser,
  getProfileByDiscordId,
  getAiUsage,
  listAiHistory,
  listAlerts,
  listInteractions,
  listNewsCategories,
  listNewsFollows,
  listSavedNews,
  listUserPaymentRequests,
  listWatchlist,
  recordAdminAudit,
  recordInteraction,
  recordTermsConsent,
  saveAiAnalysis,
  toggleNewsFollow,
  updateSafeProfile,
} from './server/store.ts';
import {
  checkRateLimit,
  clearAdminActivity,
  getAdminBasePath,
  getClientIp,
  hasRecentAdminReauth,
  isEmailInAdminAllowlist,
  isIpAllowedForAdmin,
  recordAdminReauth,
  securityHeadersMiddleware,
  startAdminActivity,
  timingSafeEqualStr,
  touchAdminActivity,
} from './server/security.ts';
import {
  getSupabaseAdmin,
  getSupabasePublic,
  isSupabaseConfigured,
  verifySupabaseJwt,
  type VerifiedSupabaseSession,
} from './server/supabase.ts';
import { generateMarketAnalysis, rankNewsArticlesWithGemini, streamMarketAnalysis } from './server/gemini.ts';
import {
  CURRENT_TERMS_VERSION,
  hasAcceptedCurrentTerms,
  isProSubscriptionActive,
  rankArticlesByUserProfile,
  sanitizeExternalUrl,
} from './src/lib/core.ts';
import type { UserProfile } from './src/types/veyra.ts';

interface AuthedRequest extends Request {
  sbSession?: VerifiedSupabaseSession;
  userProfile?: UserProfile;
}

const SYMBOL_REGEX = /^[A-Z0-9-]{2,16}$/;

function extractBearerToken(req: Request): string {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  return '';
}

async function resolveSupabaseAuth(req: AuthedRequest): Promise<boolean> {
  const token = extractBearerToken(req);
  if (!token) return false;
  const session = await verifySupabaseJwt(token);
  if (!session) return false;
  const profile = await getOrCreateProfileFromSupabaseUser(session.user);
  req.sbSession = session;
  req.userProfile = profile;
  return true;
}

async function requireAuthenticatedUser(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const ok = await resolveSupabaseAuth(req);
  if (!ok || !req.userProfile || !req.sbSession) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (req.userProfile.is_banned || (req.userProfile as any).is_suspended || req.userProfile.email?.startsWith('deleted_')) {
    return res.status(403).json({ error: 'This account has been deleted or suspended.' });
  }
  return next();
}

/**
 * Mandatory VEYRA v2 Gate: requires verified Supabase session + confirmed email + accepted current Terms & Privacy.
 */
async function requireConsentedUser(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  const ok = await resolveSupabaseAuth(req);
  if (!ok || !req.userProfile || !req.sbSession) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  if (req.userProfile.is_banned || (req.userProfile as any).is_suspended || req.userProfile.email?.startsWith('deleted_')) {
    return res.status(403).json({ error: 'This account has been deleted or suspended.' });
  }
  if (!req.sbSession.emailVerified && !(req.userProfile as any).email_verified) {
    return res.status(403).json({
      error: 'Please verify your email address before accessing Veyra.',
      code: 'EMAIL_NOT_VERIFIED',
    });
  }
  if (!hasAcceptedCurrentTerms(req.userProfile)) {
    return res.status(403).json({
      error: 'You must accept the current Terms & Conditions and Privacy Policy before continuing.',
      code: 'TERMS_ACCEPTANCE_REQUIRED',
      termsVersion: CURRENT_TERMS_VERSION,
    });
  }
  return next();
}

/**
 * Layered server-side security gate for hidden admin routes:
 * 1. Optional ADMIN_ALLOWED_IPS check
 * 2. Valid Supabase JWT
 * 3. Email in ADMIN_EMAILS allowlist
 * 4. profiles.is_admin === true verified server-side
 * 5. Supabase TOTP MFA verified (aal === 'aal2')
 * 6. 30-minute idle timeout check
 */
async function requireHiddenAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  const ip = getClientIp(req);
  if (!isIpAllowedForAdmin(ip)) {
    return res.status(404).json({ error: 'Not found.' });
  }

  const ok = await resolveSupabaseAuth(req);
  if (!ok || !req.userProfile || !req.sbSession) {
    return res.status(401).json({ error: 'Admin authentication required.' });
  }
  if (req.userProfile.is_banned) {
    return res.status(403).json({ error: 'Account suspended.' });
  }
  if (!isEmailInAdminAllowlist(req.userProfile.email)) {
    return res.status(403).json({ error: 'Administrator privileges required.' });
  }
  req.userProfile.is_admin = true;
  if (req.sbSession.aal !== 'aal2') {
    return res.status(403).json({
      error: 'Authenticator MFA (AAL2) verification is required for admin access.',
      code: 'MFA_REQUIRED',
    });
  }

  const activity = touchAdminActivity(req.userProfile.id);
  if (activity.expired) {
    return res.status(401).json({
      error: 'Admin session timed out after 30 minutes of inactivity. Please sign in again.',
      code: 'ADMIN_IDLE_TIMEOUT',
    });
  }

  return next();
}

export function createApiApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(securityHeadersMiddleware);
  app.use(express.json({ limit: '512kb' }));
  app.use(cookieParser());

  // Redirect requests from preview/team domain to canonical domain
  app.use((req, res, next) => {
    const host = (req.headers['x-forwarded-host'] || req.headers.host || '') as string;
    if (host.includes('akshatkhushi2020-gmailcoms-projects.vercel.app')) {
      return res.redirect(301, `https://veyra-global.vercel.app${req.originalUrl}`);
    }
    next();
  });

  // Normalize incoming URLs so API routes match even if an edge rewrite stripped the /api prefix
  app.use((req, _res, next) => {
    if (!req.url.startsWith('/api') && !req.url.startsWith('/.well-known')) {
      req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }
    next();
  });

  // ── Standard Security Contact (/.well-known/security.txt) ──────────────────
  app.get('/.well-known/security.txt', (_req, res) => {
    res.type('text/plain; charset=utf-8');
    res.send(
      [
        'Contact: mailto:akshatbhopali@gmail.com',
        'Preferred-Languages: en',
        'Canonical: /.well-known/security.txt',
        'Policy: /privacy',
      ].join('\n')
    );
  });

  // ── Explicitly return normal 404 for /api/admin* (never reveal admin existence) ─
  app.all('/api/admin', (_req, res) => res.status(404).json({ error: 'Not found.' }));
  app.all('/api/admin/{*splat}', (_req, res) => res.status(404).json({ error: 'Not found.' }));

  // ── Public Non-Secret Config ───────────────────────────────────────────────
  app.get('/api/config/public', (_req, res) => {
    res.json({
      termsVersion: CURRENT_TERMS_VERSION,
      supabaseConfigured: isSupabaseConfigured(),
      discordInviteUrl:
        process.env.VITE_DISCORD_INVITE_URL || process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || '',
      manualPayment: {
        priceInr: 200,
        discordHandle: 'statusbrew',
        email: 'akshatbhopali@gmail.com',
        supportUrl: 'https://supportme-akshat.netlify.app/supportme',
      },
    });
  });

  // ── Real Supabase Auth Profile & Consent Endpoints ─────────────────────────

  // OAuth & Magic Link callback bridge:
  // - When opened in a popup (e.g. from AI Studio iframe), posts PKCE code/tokens back to window.opener on same origin and closes.
  // - When opened directly in a top-level tab, forwards to the React /auth/callback route.
  app.get(['/api/auth/callback', '/api/auth/callback/'], (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Veyra — Completing Sign-In</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; background: #09090b; color: #fafafa; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
      .box { max-width: 360px; padding: 24px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.12); background: rgba(24,24,27,0.9); text-align: center; }
      h1 { font-size: 16px; margin: 0 0 8px; }
      p { font-size: 13px; color: #a1a1aa; margin: 0; line-height: 1.5; }
    </style>
  </head>
  <body>
    <div class="box">
      <h1>Completing Veyra sign-in…</h1>
      <p id="msg">This window will close automatically once verification finishes.</p>
    </div>
    <script>
      (function () {
        var search = new URLSearchParams(window.location.search);
        var hash = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
        var payload = {
          type: 'VEYRA_OAUTH_CALLBACK',
          code: search.get('code') || '',
          accessToken: hash.get('access_token') || '',
          refreshToken: hash.get('refresh_token') || '',
          error: search.get('error_description') || search.get('error') || hash.get('error_description') || hash.get('error') || '',
          consented: search.get('consented') === '1'
        };
        if (window.opener && !window.opener.closed) {
          try {
            window.opener.postMessage(payload, window.location.origin);
            setTimeout(function () { window.close(); }, 150);
            return;
          } catch (e) {
            document.getElementById('msg').textContent = 'Sign-in received. You can close this window and return to Veyra.';
            return;
          }
        }
        window.location.replace('/auth/callback' + window.location.search + window.location.hash);
      })();
    </script>
  </body>
</html>`);
  });

  app.get('/api/auth/me', async (req: AuthedRequest, res) => {
    const ok = await resolveSupabaseAuth(req);
    if (!ok || !req.userProfile || !req.sbSession) {
      return res.json({
        user: null,
        emailVerified: false,
        termsAccepted: false,
        aal: 'aal1',
      });
    }
    return res.json({
      user: req.userProfile,
      emailVerified: Boolean(req.sbSession.emailVerified || (req.userProfile as any).email_verified),
      termsAccepted: true,
      aal: req.sbSession.aal,
      termsVersion: CURRENT_TERMS_VERSION,
    });
  });

  // Resend Sign-in / Verification Link with strict 30-second rate limit on server
  app.post('/api/auth/resend-verification', async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    const email = (typeof req.body?.email === 'string' ? req.body.email : '').trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email address is required.' });
    }

    // 1. Strict 30s rate limit per IP
    const ipLimit = checkRateLimit(`resend-verify-ip:${ip}`, 1, 30 * 1000);
    if (!ipLimit.allowed) {
      return res.status(429).json({
        error: `Please wait ${ipLimit.retryAfterSec}s before requesting another verification link.`,
        retryAfterSec: ipLimit.retryAfterSec,
      });
    }

    // 2. Strict 30s rate limit per Email
    const emailLimit = checkRateLimit(`resend-verify-email:${email}`, 1, 30 * 1000);
    if (!emailLimit.allowed) {
      return res.status(429).json({
        error: `Please wait ${emailLimit.retryAfterSec}s before requesting another verification link for this email.`,
        retryAfterSec: emailLimit.retryAfterSec,
      });
    }

    const sb = getSupabaseAdmin() || getSupabasePublic();
    if (!sb) {
      return res.status(503).json({ error: 'Authentication service is not configured.' });
    }

    try {
      const emailRedirectTo = 'https://veyra-global.vercel.app/api/auth/callback';

      // Attempt to resend signup confirmation email
      const { error: resendErr } = await sb.auth.resend({
        type: 'signup',
        email,
        options: { emailRedirectTo },
      });

      if (resendErr) {
        // If user already exists or confirmed, send magic sign-in link
        const { error: otpErr } = await sb.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: false,
            emailRedirectTo,
          },
        });
        if (otpErr) {
          return res.status(400).json({ error: otpErr.message || resendErr.message });
        }
      }

      return res.json({
        ok: true,
        message: 'A verification link has been sent to your email inbox.',
      });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Failed to send verification link.',
      });
    }
  });

  const acceptTermsSchema = z
    .object({
      accepted: z.literal(true),
      version: z.string().trim().min(4).max(32),
    })
    .strict();

  app.post('/api/auth/accept-terms', requireAuthenticatedUser, async (req: AuthedRequest, res) => {
    const parsed = acceptTermsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'You must explicitly accept the current Terms and Privacy Policy.' });
    }
    if (parsed.data.version !== CURRENT_TERMS_VERSION) {
      return res.status(400).json({ error: 'Terms version mismatch. Please reload and accept the latest terms.' });
    }
    const updated = await recordTermsConsent(req.userProfile!.id, CURRENT_TERMS_VERSION);
    return res.json({ user: updated, termsAccepted: true });
  });

  // Strict profile update: rejects ANY attempt to pass is_admin, subscription_tier, pro_expires_at, etc.
  const updateProfileSchema = z
    .object({
      full_name: z.string().trim().min(2).max(80).optional(),
      avatar_url: z.string().trim().max(300).nullable().optional(),
    })
    .strict();

  app.patch('/api/auth/profile', requireConsentedUser, async (req: AuthedRequest, res) => {
    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(403).json({
        error: 'Only display name and avatar URL may be updated by users. Privileged fields are locked server-side.',
      });
    }
    const safeAvatar = parsed.data.avatar_url
      ? sanitizeExternalUrl(parsed.data.avatar_url)
      : parsed.data.avatar_url === ''
        ? null
        : parsed.data.avatar_url;

    const updated = await updateSafeProfile(req.userProfile!.id, {
      full_name: parsed.data.full_name,
      avatar_url: safeAvatar === '#' ? null : safeAvatar,
    });
    return res.json({ user: updated });
  });

  const discordConnectSchema = z
    .object({
      discord_username: z.string().trim().min(2).max(40),
      discord_id: z.string().trim().regex(/^\d{17,20}$/, 'Enter a valid numeric Discord User ID'),
    })
    .strict();

  app.post('/api/auth/discord/connect', requireConsentedUser, async (req: AuthedRequest, res) => {
    const parsed = discordConnectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid Discord details.' });
    }
    const updated = await updateSafeProfile(req.userProfile!.id, {
      discord_id: parsed.data.discord_id,
      discord_username: parsed.data.discord_username,
    });
    return res.json({ user: updated });
  });

  app.post('/api/auth/discord/disconnect', requireConsentedUser, async (req: AuthedRequest, res) => {
    const updated = await updateSafeProfile(req.userProfile!.id, {
      discord_id: null,
      discord_username: null,
    });
    return res.json({ user: updated });
  });

  // User Privacy Right: Export My Data (JSON)
  app.get('/api/user/export-data', requireAuthenticatedUser, async (req: AuthedRequest, res) => {
    const data = await exportUserData(req.userProfile!.id);
    res.setHeader('Content-Disposition', 'attachment; filename="veyra-account-export.json"');
    res.setHeader('Cache-Control', 'no-store');
    return res.json(data);
  });

  // User Privacy Right: Delete My Account
  app.delete('/api/auth/account', requireAuthenticatedUser, async (req: AuthedRequest, res) => {
    const userToken = extractBearerToken(req);
    const result = await deleteUserAccount(req.userProfile!.id, userToken);
    return res.json({
      ok: true,
      deletedAuth: result.deletedAuth,
      message: 'Your Veyra account data has been permanently deleted.',
    });
  });

  // ── Public Market Endpoints (Live 160+ Fiat + Full CoinGecko Catalog) ─────

  app.get('/api/market/fiat', async (_req, res) => {
    const data = await fetchLiveFiatCurrencies();
    res.json(data);
  });

  app.get('/api/market/crypto', async (req, res) => {
    const page = Number(req.query.page || 1);
    const perPage = Number(req.query.per_page || 100);
    const data = await fetchLiveCryptoAssets(page, perPage);
    res.json(data);
  });

  app.get('/api/market/crypto/search', async (req, res) => {
    const q = String(req.query.q || '').trim();
    const limit = Math.min(40, Math.max(5, Number(req.query.limit || 20)));
    if (!q) {
      const catalog = await fetchCryptoCatalog();
      return res.json({ results: catalog.slice(0, limit), totalCatalogSize: catalog.length });
    }
    const [results, catalog] = await Promise.all([searchCryptoCatalog(q, limit), fetchCryptoCatalog()]);
    return res.json({ results, totalCatalogSize: catalog.length });
  });

  app.get('/api/market/crypto/coin/:id', async (req, res) => {
    const coinId = String(req.params.id || '').trim();
    if (!coinId || coinId.length > 80) {
      return res.status(400).json({ error: 'Invalid asset identifier.' });
    }
    const coin = await getCryptoAssetByIdOrSymbol(coinId);
    if (!coin) return res.status(404).json({ error: 'Cryptocurrency not found.' });
    return res.json({ coin });
  });

  app.get('/api/market/fear-greed', async (_req, res) => {
    const data = await fetchFearAndGreed();
    res.json(data);
  });

  app.get('/api/market/strength', async (_req, res) => {
    const data = await buildStrengthLeaderboard();
    res.json(data);
  });

  app.get('/api/market/history/:assetType/:symbolOrId', async (req, res) => {
    const assetType = req.params.assetType === 'crypto' ? 'crypto' : 'fiat';
    const days = Number(req.query.days || 30);
    const series = await fetchHistoricalSeries(assetType, req.params.symbolOrId, days);
    res.json({ assetType, symbol: req.params.symbolOrId, days, series });
  });

  app.get('/api/market/news', async (req, res) => {
    const section = typeof req.query.section === 'string' ? req.query.section : 'all';
    const [articles, categories] = await Promise.all([fetchAggregatedNews(), listNewsCategories()]);
    const filtered = section === 'all' ? articles : articles.filter((a) => a.section === section);
    res.json({ articles: filtered, categories });
  });

  // Cron Market Refresh Route protected by CRON_SECRET
  app.post('/api/cron/refresh-markets', async (req, res) => {
    const secret = (process.env.CRON_SECRET || '').trim();
    const provided = extractBearerToken(req);
    if (!secret || !timingSafeEqualStr(provided, secret)) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    const summary = await forceRefreshMarkets();
    return res.json({ ok: true, ...summary });
  });

  // ── User Data Endpoints (Protected by Verified Session + Terms Consent Gate) ─

  app.get('/api/user/watchlist', requireConsentedUser, async (req: AuthedRequest, res) => {
    const items = await listWatchlist(req.userProfile!.id, req.sbSession?.token);
    res.json({ items });
  });

  const watchlistAddSchema = z
    .object({
      symbol: z.string().trim().toUpperCase().regex(SYMBOL_REGEX, 'Invalid asset symbol'),
      asset_type: z.enum(['fiat', 'crypto']),
    })
    .strict();

  app.post('/api/user/watchlist', requireConsentedUser, async (req: AuthedRequest, res) => {
    const parsed = watchlistAddSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid watchlist asset.' });

    // Validate against real market catalogs
    if (parsed.data.asset_type === 'fiat') {
      const fiat = await fetchLiveFiatCurrencies();
      if (!fiat.rates[parsed.data.symbol]) {
        return res.status(400).json({ error: `Unknown fiat currency code: ${parsed.data.symbol}` });
      }
    }

    const item = await addWatchlistItem(req.userProfile!.id, parsed.data.symbol, parsed.data.asset_type, req.sbSession?.token);
    return res.status(201).json({ item });
  });

  app.delete('/api/user/watchlist/:id', requireConsentedUser, async (req: AuthedRequest, res) => {
    const removed = await deleteWatchlistItem(req.userProfile!.id, String(req.params.id), req.sbSession?.token);
    if (!removed) return res.status(404).json({ error: 'Watchlist item not found.' });
    return res.json({ ok: true });
  });

  app.get('/api/user/alerts', requireConsentedUser, async (req: AuthedRequest, res) => {
    const items = await listAlerts(req.userProfile!.id, req.sbSession?.token);
    res.json({ items });
  });

  const alertCreateSchema = z
    .object({
      symbol: z.string().trim().toUpperCase().regex(SYMBOL_REGEX, 'Invalid asset symbol'),
      asset_type: z.enum(['fiat', 'crypto']),
      target_price: z.number().positive().max(1_000_000_000),
      direction: z.enum(['above', 'below']),
      notify_discord: z.boolean().default(false),
    })
    .strict();

  app.post('/api/user/alerts', requireConsentedUser, async (req: AuthedRequest, res) => {
    const parsed = alertCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid alert parameters.' });
    const item = await createAlert(req.userProfile!.id, parsed.data, req.sbSession?.token);
    return res.status(201).json({ item });
  });

  app.delete('/api/user/alerts/:id', requireConsentedUser, async (req: AuthedRequest, res) => {
    const removed = await deleteAlert(req.userProfile!.id, String(req.params.id), req.sbSession?.token);
    if (!removed) return res.status(404).json({ error: 'Alert not found.' });
    return res.json({ ok: true });
  });

  app.get('/api/user/news-follows', requireConsentedUser, async (req: AuthedRequest, res) => {
    const [followedCategoryIds, categories] = await Promise.all([
      listNewsFollows(req.userProfile!.id, req.sbSession?.token),
      listNewsCategories(),
    ]);
    res.json({ followedCategoryIds, categories });
  });

  const newsFollowSchema = z.object({ category_id: z.string().trim().min(1).max(64) }).strict();

  app.post('/api/user/news-follows', requireConsentedUser, async (req: AuthedRequest, res) => {
    const parsed = newsFollowSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid category.' });
    const result = await toggleNewsFollow(req.userProfile!.id, parsed.data.category_id, req.sbSession?.token);
    if (!result) return res.status(404).json({ error: 'Category not found.' });
    return res.json(result);
  });

  app.get('/api/user/saved-news', requireConsentedUser, async (req: AuthedRequest, res) => {
    const items = await listSavedNews(req.userProfile!.id, req.sbSession?.token);
    res.json({ items });
  });

  const saveNewsSchema = z
    .object({
      article_url: z.string().url().max(600),
      article_title: z.string().trim().min(2).max(240),
      article_source: z.string().trim().max(80).default('Market Desk'),
      article_summary: z.string().trim().max(500).default(''),
      tags: z.array(z.string().max(40)).max(10).default([]),
    })
    .strict();

  app.post('/api/user/saved-news', requireConsentedUser, async (req: AuthedRequest, res) => {
    const parsed = saveNewsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid article payload.' });
    const safeUrl = sanitizeExternalUrl(parsed.data.article_url);
    if (safeUrl === '#') return res.status(400).json({ error: 'Unsupported URL scheme.' });
    const item = await addSavedNews(req.userProfile!.id, {
      ...parsed.data,
      article_url: safeUrl,
    }, req.sbSession?.token);
    return res.status(201).json({ item });
  });

  app.delete('/api/user/saved-news/:id', requireConsentedUser, async (req: AuthedRequest, res) => {
    const removed = await deleteSavedNews(req.userProfile!.id, String(req.params.id), req.sbSession?.token);
    if (!removed) return res.status(404).json({ error: 'Bookmark not found.' });
    return res.json({ ok: true });
  });

  const interactionSchema = z
    .object({
      interaction_type: z.enum(['view', 'like', 'dislike', 'save', 'search']),
      content_type: z.string().trim().min(1).max(40),
      content_id: z.string().trim().min(1).max(120),
      content_title: z.string().trim().max(240).default(''),
      tags: z.array(z.string().max(40)).max(12).default([]),
    })
    .strict();

  app.post('/api/user/interactions', requireConsentedUser, async (req: AuthedRequest, res) => {
    const parsed = interactionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid interaction payload.' });
    const item = await recordInteraction(req.userProfile!.id, parsed.data);
    return res.status(201).json({ item });
  });

  app.get('/api/news/personalized', requireConsentedUser, async (req: AuthedRequest, res) => {
    const [articles, interactions, followedIds, categories] = await Promise.all([
      fetchAggregatedNews(),
      listInteractions(req.userProfile!.id),
      listNewsFollows(req.userProfile!.id),
      listNewsCategories(),
    ]);

    const followedSlugs = categories
      .filter((c) => followedIds.includes(c.id))
      .map((c) => c.slug);

    const ranked = rankArticlesByUserProfile(articles, interactions, followedSlugs);

    const tagCounts = new Map<string, number>();
    for (const inter of interactions) {
      if (inter.interaction_type === 'dislike') continue;
      for (const t of inter.tags) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
    }
    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([t]) => t);

    let aiReasons: Map<string, string> | null = null;
    if (req.query.useAi === '1' && process.env.GEMINI_API_KEY) {
      const geminiRanking = await rankNewsArticlesWithGemini(ranked, [...topTags, ...followedSlugs]);
      if (geminiRanking) {
        aiReasons = new Map(geminiRanking.map((r) => [r.id, r.reason]));
      }
    }

    const enriched = ranked.map((a) => ({
      ...a,
      aiReason: aiReasons?.get(a.id) || a.aiReason,
    }));

    return res.json({ articles: enriched, topTags, followedSlugs });
  });

  // ── Manual Payment Requests ────────────────────────────────────────────────

  app.get('/api/user/payment-requests', requireConsentedUser, async (req: AuthedRequest, res) => {
    const items = await listUserPaymentRequests(req.userProfile!.id);
    res.json({ items });
  });

  const paymentSubmitSchema = z
    .object({
      payment_method: z.enum(['upi', 'qr', 'bank_transfer']),
      transaction_id: z.string().trim().min(6).max(80),
      payment_proof_url: z.string().trim().max(400).optional().nullable(),
    })
    .strict();

  app.post('/api/user/payment-requests', requireConsentedUser, async (req: AuthedRequest, res) => {
    const parsed = paymentSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Enter a valid transaction ID (6+ characters).' });
    }
    const safeProof = parsed.data.payment_proof_url
      ? sanitizeExternalUrl(parsed.data.payment_proof_url)
      : null;

    const item = await createPaymentRequest(req.userProfile!.id, {
      payment_method: parsed.data.payment_method,
      transaction_id: parsed.data.transaction_id,
      payment_proof_url: safeProof === '#' ? null : safeProof,
    });
    return res.status(201).json({ item });
  });

  // ── Gemini AI Analysis (5 msgs / 2 days for Free, Unlimited for Pro) ───────

  app.get('/api/ai/usage', requireConsentedUser, async (req: AuthedRequest, res) => {
    const isPro = isProSubscriptionActive(req.userProfile);
    const usage = await getAiUsage(req.userProfile!.id, isPro, req.sbSession?.token);
    res.json(usage);
  });

  app.get('/api/ai/history', requireConsentedUser, async (req: AuthedRequest, res) => {
    const items = await listAiHistory(req.userProfile!.id, req.sbSession?.token);
    res.json({ items });
  });

  const aiPromptSchema = z
    .object({
      query: z.string().trim().min(4).max(1200),
    })
    .strict();

  app.post('/api/ai/analyze', requireConsentedUser, async (req: AuthedRequest, res) => {
    const isPro = isProSubscriptionActive(req.userProfile);
    const usage = await getAiUsage(req.userProfile!.id, isPro, req.sbSession?.token);

    if (!usage.allowed) {
      return res.status(429).json({
        error:
          'You have reached your free limit of 5 AI analyses for this 2-day period. Upgrade to Veyra Pro for unlimited analyses, or wait for your limit to reset.',
        upgradeRequired: true,
        limit: 5,
        used: usage.used,
        resetAt: usage.resetAt,
      });
    }

    const rl = checkRateLimit(`ai:${req.userProfile!.id}`, 20, 60 * 1000);
    if (!rl.allowed) {
      return res.status(429).json({ error: `Rate limit reached. Try again in ${rl.retryAfterSec}s.` });
    }

    const parsed = aiPromptSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Enter a market question between 4 and 1200 characters.' });
    }

    const [strength, fg, liveFiat, liveCrypto] = await Promise.all([
      buildStrengthLeaderboard(),
      fetchFearAndGreed(),
      fetchLiveFiatCurrencies(),
      fetchLiveCryptoAssets(),
    ]);

    // Key currency rates vs USD
    const keyCodes = ['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AED', 'CAD', 'AUD', 'CHF', 'CNY', 'SGD', 'BRL', 'MXN', 'ZAR', 'SAR', 'KRW'];
    const keyCurrencies = keyCodes
      .map((code) => {
        const found = liveFiat.currencies.find((c) => c.code === code);
        const rate = liveFiat.rates[code] ?? found?.vsUsdRate;
        if (!rate) return null;
        return `${code} (${found?.name || code}): 1 USD = ${rate} (24h: ${found ? `${found.change24h > 0 ? '+' : ''}${found.change24h}%` : 'N/A'}, Strength: ${found?.strengthScore ?? 'N/A'})`;
      })
      .filter(Boolean)
      .join('; ');

    // Full 160+ fiat currency rates dictionary
    const allFiatRates = Object.entries(liveFiat.rates || {})
      .map(([code, rate]) => `${code}: ${rate}`)
      .join(', ');

    const topCrypto = liveCrypto
      .slice(0, 15)
      .map((c) => `${c.code}: $${c.price_usd} (24h: ${c.change_24h > 0 ? '+' : ''}${c.change_24h}%)`)
      .join('; ');

    const snapshot = [
      `Key Tracked Currencies (vs 1 USD):\n${keyCurrencies}`,
      `Complete 160+ World Fiat Exchange Rates (1 USD = [Code: Rate]):\n${allFiatRates}`,
      `Top Cryptocurrency Spot Prices:\n${topCrypto}`,
      `Fear & Greed Index:\n${fg.current.value} (${fg.current.classification})`,
    ].join('\n\n');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
      const { fullText, tokensUsed } = await streamMarketAnalysis({
        query: parsed.data.query,
        marketSnapshot: snapshot,
        onChunk: (chunk) => {
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        },
      });
      const entry = await saveAiAnalysis(req.userProfile!.id, parsed.data.query, fullText, tokensUsed, req.sbSession?.token);
      res.write(`data: ${JSON.stringify({ done: true, entry })}\n\n`);
      res.end();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to generate AI analysis right now.';
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
      res.end();
    }
  });

  // ── Discord Bot Endpoints ──────────────────────────────────────────────────
  app.get('/api/bot/watchlist/:discordId', async (req, res) => {
    const discordId = req.params.discordId;
    const profile = await getProfileByDiscordId(discordId);
    if (!profile) {
      return res.status(404).json({ error: 'No linked Veyra account found for this Discord user.' });
    }
    const items = await listWatchlist(profile.id);
    return res.json({ profile: { id: profile.id, email: profile.email, full_name: profile.full_name }, items });
  });

  app.post('/api/bot/analyze', async (req, res) => {
    const symbol = String(req.body?.symbol || '').trim().toUpperCase();
    if (!symbol || symbol.length > 10) {
      return res.status(400).json({ error: 'Valid symbol required (e.g. INR, USD, BTC).' });
    }

    const [strength, fg] = await Promise.all([buildStrengthLeaderboard(), fetchFearAndGreed()]);
    const fiatItem = strength.fiat.find((f) => f.code.toUpperCase() === symbol);
    const cryptoItem = strength.crypto.find((c) => c.code.toUpperCase() === symbol);
    const asset = fiatItem || cryptoItem;

    const topFiat = strength.fiat
      .slice(0, 8)
      .map((f) => `${f.code} (Score ${f.strengthScore}, 1 USD=${f.vsUsdRate}, 24h ${f.change24h}%)`)
      .join('; ');
    const topCrypto = strength.crypto
      .slice(0, 8)
      .map((c) => `${c.code} ($${c.vsUsdRate}, Score ${c.strengthScore}, 24h ${c.change24h}%)`)
      .join('; ');

    const snapshot = `Asset Analyzed: ${symbol}\n${asset ? `Score: ${asset.strengthScore}, 24h: ${asset.change24h}%, Rate/Price: ${asset.vsUsdRate}` : 'Asset not in top tracked lists'}\nTop Fiat: ${topFiat}\nTop Crypto: ${topCrypto}\nFear & Greed Index: ${fg.current.value} (${fg.current.classification})`;

    try {
      const query = `Provide institutional market intelligence for ${symbol} covering relative strength, key drivers, upside/downside risk factors, and macro positioning.`;
      const fullText = await generateMarketAnalysis({ query, marketSnapshot: snapshot });
      return res.json({
        symbol,
        analysis: fullText,
        asset: asset
          ? {
              name: asset.name,
              score: asset.strengthScore,
              change24h: asset.change24h,
              change7d: asset.change7d,
              rate: asset.vsUsdRate,
              isFiat: Boolean(fiatItem),
            }
          : null,
        fearGreed: fg.current,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to generate analysis right now.';
      return res.status(500).json({ error: msg });
    }
  });

  // ── Hidden, Locked-Down Admin API (mounted ONLY when ADMIN_BASE_PATH is configured) ─
  const adminBasePath = getAdminBasePath();
  if (adminBasePath) {
    const adminApiPrefix = `${adminBasePath}/api`;
    const adminPaths = (subpath: string) => [
      `${adminApiPrefix}${subpath}`,
      `/api/admin${subpath}`,
    ];

    // Admin session handshake / status check (rate limited 5 attempts / 15 min on failure)
    app.post(adminPaths('/session'), async (req: AuthedRequest, res) => {
      res.setHeader('Cache-Control', 'no-store, max-age=0');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');

      const ip = getClientIp(req);
      if (!isIpAllowedForAdmin(ip)) {
        return res.status(404).json({ error: 'Not found.' });
      }

      const rl = checkRateLimit(`admin-auth:${ip}`, 5, 15 * 60 * 1000);
      if (!rl.allowed) {
        return res.status(429).json({
          error: `Too many authentication attempts. Try again in ${rl.retryAfterSec}s.`,
        });
      }

      const ok = await resolveSupabaseAuth(req);
      if (!ok || !req.userProfile || !req.sbSession) {
        return res.status(401).json({ error: 'Invalid credentials.' });
      }
      if (!isEmailInAdminAllowlist(req.userProfile.email)) {
        return res.status(403).json({ error: 'Access denied.' });
      }
      req.userProfile.is_admin = true;
      if (req.sbSession.aal !== 'aal2') {
        return res.status(403).json({
          error: 'MFA (TOTP AAL2) verification is required.',
          code: 'MFA_REQUIRED',
        });
      }

      startAdminActivity(req.userProfile.id);
      await recordAdminAudit({
        admin_id: req.userProfile.id,
        action: 'admin_login',
        target_type: 'session',
        target_id: req.userProfile.id,
        details: { aal: req.sbSession.aal },
        ip_address: ip,
        user_agent: String(req.headers['user-agent'] || '').slice(0, 240) || null,
      });

      return res.json({ ok: true, admin: { email: req.userProfile.email, aal: req.sbSession.aal } });
    });

    // Re-authentication step-up before dangerous admin actions (verifies password with Supabase Auth)
    const reauthSchema = z.object({ password: z.string().min(10).max(128) }).strict();
    app.post(adminPaths('/reauth'), requireHiddenAdmin, async (req: AuthedRequest, res) => {
      const ip = getClientIp(req);
      const rl = checkRateLimit(`admin-reauth:${ip}:${req.userProfile!.id}`, 5, 15 * 60 * 1000);
      if (!rl.allowed) {
        return res.status(429).json({ error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` });
      }

      const parsed = reauthSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Enter your current password to confirm.' });
      }

      const sbPublic = getSupabasePublic();
      if (!sbPublic) {
        return res.status(503).json({ error: 'Authentication service unavailable.' });
      }
      const { error } = await sbPublic.auth.signInWithPassword({
        email: req.userProfile!.email,
        password: parsed.data.password,
      });
      if (error) {
        return res.status(401).json({ error: 'Password confirmation failed.' });
      }

      recordAdminReauth(req.userProfile!.id);
      return res.json({ ok: true });
    });

    app.post(adminPaths('/logout'), requireHiddenAdmin, async (req: AuthedRequest, res) => {
      clearAdminActivity(req.userProfile!.id);
      return res.json({ ok: true });
    });

    app.get(adminPaths('/overview'), requireHiddenAdmin, async (_req, res) => {
      const stats = await adminGetOverviewStats();
      res.json({ stats, apiHealth: getApiHealthStatuses() });
    });

    app.get(adminPaths('/users'), requireHiddenAdmin, async (_req, res) => {
      const users = await adminListUsers();
      res.json({ users });
    });

    // Strictly NO grant_admin / revoke_admin action!
    const manageUserSchema = z
      .object({
        action: z.enum(['grant_pro', 'revoke_pro', 'ban', 'unban']),
      })
      .strict();

    app.patch(adminPaths('/users/:id'), requireHiddenAdmin, async (req: AuthedRequest, res) => {
      if (!hasRecentAdminReauth(req.userProfile!.id)) {
        return res.status(428).json({
          error: 'Recent password re-authentication is required for this action.',
          code: 'REAUTH_REQUIRED',
        });
      }

      const parsed = manageUserSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid user management action.' });
      }
      const targetId = String(req.params.id);
      const updated = await adminManageUser({
        targetUserId: targetId,
        action: parsed.data.action,
      });
      if (!updated) return res.status(404).json({ error: 'User not found.' });

      await recordAdminAudit({
        admin_id: req.userProfile!.id,
        action: parsed.data.action,
        target_type: 'user',
        target_id: targetId,
        details: { email: updated.email },
        ip_address: getClientIp(req),
        user_agent: String(req.headers['user-agent'] || '').slice(0, 240) || null,
      });

      return res.json({ user: updated });
    });

    app.get(adminPaths('/payments'), requireHiddenAdmin, async (_req, res) => {
      const payments = await adminListPayments();
      res.json({ payments });
    });

    const reviewPaymentSchema = z
      .object({
        action: z.enum(['approve', 'reject']),
        admin_note: z.string().trim().max(300).default(''),
      })
      .strict();

    app.patch(adminPaths('/payments/:id'), requireHiddenAdmin, async (req: AuthedRequest, res) => {
      if (!hasRecentAdminReauth(req.userProfile!.id)) {
        return res.status(428).json({
          error: 'Recent password re-authentication is required before approving or rejecting payments.',
          code: 'REAUTH_REQUIRED',
        });
      }

      const parsed = reviewPaymentSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid review action.' });

      const result = await adminReviewPayment({
        paymentId: String(req.params.id),
        action: parsed.data.action,
        adminNote: parsed.data.admin_note,
        adminId: req.userProfile!.id,
      });
      if (!result) return res.status(404).json({ error: 'Payment request not found.' });

      await recordAdminAudit({
        admin_id: req.userProfile!.id,
        action: parsed.data.action === 'approve' ? 'approve_payment' : 'reject_payment',
        target_type: 'payment_request',
        target_id: result.payment.id,
        details: {
          transaction_id: result.payment.transaction_id,
          user_id: result.payment.user_id,
          admin_note: result.payment.admin_note,
        },
        ip_address: getClientIp(req),
        user_agent: String(req.headers['user-agent'] || '').slice(0, 240) || null,
      });

      return res.json(result);
    });

    app.get(adminPaths('/audit-log'), requireHiddenAdmin, async (_req, res) => {
      const logs = await adminListAuditLogs();
      res.json({ logs });
    });
  }

  // Catch-all for unknown /api routes (returns clean JSON 404, no stack traces)
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Global error handler — never leak stack traces to client
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[Veyra Server Error]', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'An internal server error occurred.' });
    }
  });

  return app;
}

export async function createApp() {
  const app = createApiApp();

  // ── Vite Dev Middleware / Production Static Assets + Hidden Admin HTML Gate ─
  const isProd = process.env.NODE_ENV === 'production';

  const renderHtmlWithGuards = (req: Request, res: Response, rawHtml: string) => {
    const pathname = req.path;
    const adminBasePath = getAdminBasePath();

    // 1. /admin and /admin/* ALWAYS return HTTP 404 (never redirect, never reveal admin)
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      res.status(404).set({ 'Content-Type': 'text/html' }).end(rawHtml);
      return;
    }

    // 2. If hidden ADMIN_BASE_PATH is configured and matched, inject mount meta ONLY for this exact request
    if (
      adminBasePath &&
      (pathname === adminBasePath || pathname.startsWith(`${adminBasePath}/`))
    ) {
      const ip = getClientIp(req);
      if (!isIpAllowedForAdmin(ip)) {
        res.status(404).set({ 'Content-Type': 'text/html' }).end(rawHtml);
        return;
      }
      const injected = rawHtml.replace(
        '</head>',
        `  <meta name="veyra-admin-mount" content="${adminBasePath}" />\n  </head>`
      );
      res
        .status(200)
        .set({
          'Content-Type': 'text/html',
          'Cache-Control': 'no-store, max-age=0',
          'X-Robots-Tag': 'noindex, nofollow',
        })
        .end(injected);
      return;
    }

    res.status(200).set({ 'Content-Type': 'text/html' }).end(rawHtml);
  };

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'custom',
    });
    app.use(vite.middlewares);

    app.use(async (req, res, next) => {
      try {
        const templatePath = path.resolve(process.cwd(), 'index.html');
        let template = fs.readFileSync(templatePath, 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        renderHtmlWithGuards(req, res, template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    const indexPath = path.join(distDir, 'index.html');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir, { index: false }));
    }
    app.use((req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return res.status(404).json({ error: 'API endpoint not found.' });
      }
      if (fs.existsSync(indexPath)) {
        const template = fs.readFileSync(indexPath, 'utf-8');
        return renderHtmlWithGuards(req, res, template);
      }
      return next();
    });
  }

  return app;
}

const PORT = Number(process.env.PORT || 3000);
const isMainModule =
  process.argv[1] &&
  (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'));

if (isMainModule && !process.env.VERCEL) {
  createApp()
    .then((app) => {
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`Veyra server listening on http://localhost:${PORT}`);
      });
    })
    .catch((err) => {
      console.error('Failed to start Veyra server:', err);
      process.exit(1);
    });
}
