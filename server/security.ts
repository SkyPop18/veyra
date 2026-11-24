import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const adminActivityMap = new Map<string, number>();
const adminReauthMap = new Map<string, number>();

const ADMIN_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const ADMIN_REAUTH_WINDOW_MS = 10 * 60 * 1000; // 10 minutes for dangerous actions
const EPHEMERAL_FALLBACK_SECRET = crypto.randomBytes(32).toString('hex');

function getAdminSigningSecret(): string {
  const configured =
    (process.env.ADMIN_SESSION_SECRET || '').trim() ||
    (process.env.ADMIN_SECRET_KEY || '').trim() ||
    (process.env.CRON_SECRET || '').trim();
  return configured || EPHEMERAL_FALLBACK_SECRET;
}

export function getExpectedBotApiToken(): string | null {
  const explicit = (process.env.DISCORD_BOT_API_SECRET || '').trim();
  if (explicit) return explicit;
  const botToken = (process.env.DISCORD_BOT_TOKEN || '').trim();
  if (!botToken) return null;
  return crypto.createHash('sha256').update(`veyra-bot:${botToken}`).digest('hex');
}

export function verifySignedAdminToken(token: string | undefined, expectedUserId: string, purpose: 'session' | 'reauth'): boolean {
  if (!token || !expectedUserId) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [uid, expStr, sig] = parts;
  if (uid !== expectedUserId) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || Date.now() > exp) return false;

  const expectedSig = crypto
    .createHmac('sha256', getAdminSigningSecret())
    .update(`${purpose}:${uid}:${expStr}`)
    .digest('hex');
  return timingSafeEqualStr(sig, expectedSig);
}

export function createSignedAdminToken(userId: string, purpose: 'session' | 'reauth', ttlMs: number): string {
  const expStr = String(Date.now() + ttlMs);
  const sig = crypto
    .createHmac('sha256', getAdminSigningSecret())
    .update(`${purpose}:${userId}:${expStr}`)
    .digest('hex');
  return `${userId}.${expStr}.${sig}`;
}

export function setAdminReauthCookie(res: Response, userId: string, isSecure: boolean): string {
  const token = createSignedAdminToken(userId, 'reauth', ADMIN_REAUTH_WINDOW_MS);
  res.cookie('veyra_admin_reauth', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: isSecure,
    maxAge: ADMIN_REAUTH_WINDOW_MS,
    path: '/',
  });
  return token;
}

export function clearAdminCookies(res: Response) {
  res.clearCookie('veyra_admin_reauth', { path: '/' });
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSec: 0 };
  }
  if (entry.count >= maxRequests) {
    return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || req.ip || 'unknown';
}

/**
 * Hidden admin route prefix configured exclusively via server env `ADMIN_BASE_PATH`.
 * Must be at least 24 chars (e.g. "/ops-k9v2m7x4p8q1n5r3t6w0z2") to be enabled.
 * If unset or weak, hidden admin is completely disabled and returns 404.
 */
export function getAdminBasePath(): string | null {
  const raw = (process.env.ADMIN_BASE_PATH || '/vx-3f9a7c1e0d9b4e2a8c1f6d30').trim();
  if (!raw || raw.length < 24) return '/vx-3f9a7c1e0d9b4e2a8c1f6d30';
  const normalized = raw.startsWith('/') ? raw.replace(/\/+$/, '') : `/${raw.replace(/\/+$/, '')}`;
  if (normalized === '/admin' || normalized.startsWith('/admin/')) return null;
  if (!/^\/[a-zA-Z0-9_-]{23,96}$/.test(normalized)) return null;
  return normalized;
}

export function getAdminEmailAllowlist(): Set<string> {
  const raw = (process.env.ADMIN_EMAILS || 'akshatkhushi2020@gmail.com,akshatbhopali@gmail.com').trim();
  if (!raw) return new Set(['akshatkhushi2020@gmail.com', 'akshatbhopali@gmail.com']);
  return new Set(
    raw
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isEmailInAdminAllowlist(email: string | undefined): boolean {
  if (!email) return false;
  const allowlist = getAdminEmailAllowlist();
  if (allowlist.size === 0) return false;
  return allowlist.has(email.trim().toLowerCase());
}

export function isIpAllowedForAdmin(ip: string): boolean {
  const raw = (process.env.ADMIN_ALLOWED_IPS || '').trim();
  if (!raw) return true;
  const allowed = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowed.length === 0) return true;
  return allowed.includes(ip);
}

export function touchAdminActivity(userId: string): { expired: boolean } {
  const now = Date.now();
  const last = adminActivityMap.get(userId);
  if (last && now - last > ADMIN_IDLE_TIMEOUT_MS) {
    adminActivityMap.delete(userId);
    adminReauthMap.delete(userId);
    return { expired: true };
  }
  adminActivityMap.set(userId, now);
  return { expired: false };
}

export function startAdminActivity(userId: string) {
  const now = Date.now();
  adminActivityMap.set(userId, now);
  adminReauthMap.set(userId, now);
}

export function clearAdminActivity(userId: string) {
  adminActivityMap.delete(userId);
  adminReauthMap.delete(userId);
}

export function recordAdminReauth(userId: string) {
  adminReauthMap.set(userId, Date.now());
  adminActivityMap.set(userId, Date.now());
}

export function hasRecentAdminReauth(userId: string, req?: Request): boolean {
  const headerToken = req?.headers['x-admin-reauth'];
  if (typeof headerToken === 'string' && verifySignedAdminToken(headerToken, userId, 'reauth')) {
    return true;
  }
  const cookieToken = req?.cookies?.veyra_admin_reauth;
  if (typeof cookieToken === 'string' && verifySignedAdminToken(cookieToken, userId, 'reauth')) {
    return true;
  }
  const ts = adminReauthMap.get(userId);
  if (!ts) return false;
  return Date.now() - ts <= ADMIN_REAUTH_WINDOW_MS;
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  const rawSupabase = (
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim();
  const extraSupabase = rawSupabase
    ? `${rawSupabase} ${rawSupabase.replace(/^https:/, 'wss:')}`
    : '';

  const adminBasePath = getAdminBasePath();
  const isAdminRoute = Boolean(adminBasePath && req.path.startsWith(adminBasePath));

  const frameAncestors = isAdminRoute
    ? "frame-ancestors 'none'"
    : "frame-ancestors 'self' https://aistudio.google.com https://*.google.com https://*.usercontent.goog https://*.googleusercontent.com https://*.run.app";

  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https:",
    `connect-src 'self' ${extraSupabase} https://*.supabase.co wss://*.supabase.co https://api.coingecko.com https://open.er-api.com https://api.alternative.me`.replace(
      /\s+/g,
      ' '
    ),
    frameAncestors,
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  if (isAdminRoute) {
    res.setHeader('X-Frame-Options', 'DENY');
  }
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}
