import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Check,
  Copy,
  CreditCard,
  Crown,
  Database,
  FileCheck2,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { apiRequest, ApiError } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { useVeyra } from '../../context/VeyraContext';
import { ThemeToggle } from '../../components/ui/Primitives';
import { isProSubscriptionActive } from '../../lib/core';
import type {
  AdminAuditEntry,
  ApiConfigHealth,
  PaymentRequest,
  UserProfile,
} from '../../types/veyra';

interface OverviewStats {
  totalUsers: number;
  proUsers: number;
  pendingPayments: number;
  approvedRevenueInr: number;
  activeWatchlistItems: number;
  activeAlerts: number;
  aiQueriesCount: number;
  dbMode: string;
  serviceRoleConfigured?: boolean;
  dbWriteReady?: boolean;
}

type PaymentWithOwner = PaymentRequest & { user_email: string; user_name: string };

interface HiddenAdminCtxValue {
  basePath: string;
  apiPrefix: string;
  reauthHeader: () => Record<string, string>;
  requestReauth: (onConfirmed: (headers: Record<string, string>) => Promise<void>) => void;
  overview: { stats: OverviewStats; apiHealth: ApiConfigHealth[] } | null;
  users: UserProfile[];
  payments: PaymentWithOwner[];
  logs: AdminAuditEntry[];
  loadingData: boolean;
  refreshOverview: () => Promise<void>;
  refreshUsers: () => Promise<void>;
  refreshPayments: () => Promise<void>;
  refreshLogs: () => Promise<void>;
  setUsersDirect: React.Dispatch<React.SetStateAction<UserProfile[]>>;
}

const HiddenAdminCtx = createContext<HiddenAdminCtxValue | null>(null);

function useHiddenAdmin() {
  const ctx = useContext(HiddenAdminCtx);
  if (!ctx) throw new Error('useHiddenAdmin must be used inside AdminShell');
  return ctx;
}

const ADMIN_SURFACE =
  'bg-white dark:bg-[#11131a] border border-[#e4e4e7] dark:border-white/10 rounded-2xl';

function DatabaseSetupBanner({ onVerified }: { onVerified: () => Promise<void> }) {
  const [checking, setChecking] = useState(false);

  const handleCheck = async () => {
    setChecking(true);
    await onVerified();
    setChecking(false);
  };

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 sm:p-5 space-y-3 text-xs">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 max-w-2xl">
          <p className="font-semibold text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
            <Database className="h-4 w-4 shrink-0" />
            <span>Database Write Access Setup Required</span>
          </p>
          <p className="text-[#52525b] dark:text-[#d4d4d8] leading-relaxed">
            Administrative write permissions are not enabled in the database backend yet. Apply your backend permission configuration and re-verify below.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCheck}
            disabled={checking}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/40 px-3 py-2 font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-500/15 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>Verify Status</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminShell({ basePath }: { basePath: string }) {
  const { notify, refreshAuth } = useVeyra();
  const location = useLocation();
  const navigate = useNavigate();

  const apiPrefix = '/api/admin';

  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  // Separate admin login + TOTP MFA (AAL2) flow
  const [step, setStep] = useState<'login' | 'mfa-verify' | 'mfa-enroll'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [factorId, setFactorId] = useState('');
  const [enrollQrSvg, setEnrollQrSvg] = useState('');
  const [enrollSecret, setEnrollSecret] = useState('');
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);

  // Shared token so multi-Lambda serverless requests stay authorized for 10m step-up
  const reauthTokenRef = useRef<string>('');
  const reauthHeader = useCallback((): Record<string, string> => {
    return reauthTokenRef.current ? { 'X-Admin-Reauth': reauthTokenRef.current } : {};
  }, []);

  // Preloaded console state for instant zero-lag tab switching
  const [overview, setOverview] = useState<{ stats: OverviewStats; apiHealth: ApiConfigHealth[] } | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [payments, setPayments] = useState<PaymentWithOwner[]>([]);
  const [logs, setLogs] = useState<AdminAuditEntry[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Step-up confirmation modal (password or active 2FA AAL2)
  const [reauthPendingFn, setReauthPendingFn] = useState<((headers: Record<string, string>) => Promise<void>) | null>(null);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthError, setReauthError] = useState('');
  const [reauthBusy, setReauthBusy] = useState(false);

  const refreshOverview = useCallback(async () => {
    try {
      const res = await apiRequest<{ stats: OverviewStats; apiHealth: ApiConfigHealth[] }>(`${apiPrefix}/overview`);
      if (res?.stats) setOverview(res);
    } catch {
      // handled by shell check
    }
  }, [apiPrefix]);

  const refreshUsers = useCallback(async () => {
    try {
      const res = await apiRequest<{ users: UserProfile[] }>(`${apiPrefix}/users`);
      setUsers(Array.isArray(res?.users) ? res.users : []);
    } catch {
      // preserve last list
    }
  }, [apiPrefix]);

  const refreshPayments = useCallback(async () => {
    try {
      const res = await apiRequest<{ payments: PaymentWithOwner[] }>(`${apiPrefix}/payments`);
      setPayments(Array.isArray(res?.payments) ? res.payments : []);
    } catch {
      // preserve last list
    }
  }, [apiPrefix]);

  const refreshLogs = useCallback(async () => {
    try {
      const res = await apiRequest<{ logs: AdminAuditEntry[] }>(`${apiPrefix}/audit-log`);
      setLogs(Array.isArray(res?.logs) ? res.logs : []);
    } catch {
      // preserve last list
    }
  }, [apiPrefix]);

  const preloadConsoleData = useCallback(async () => {
    setLoadingData(true);
    await Promise.allSettled([refreshOverview(), refreshUsers(), refreshPayments(), refreshLogs()]);
    setLoadingData(false);
  }, [refreshOverview, refreshUsers, refreshPayments, refreshLogs]);

  const verifyServerAdminSession = useCallback(async () => {
    setChecking(true);
    try {
      const sessionRes = await apiRequest<{ ok: boolean; reauthToken?: string }>(`${apiPrefix}/session`, {
        method: 'POST',
      });
      if (sessionRes?.reauthToken) {
        reauthTokenRef.current = sessionRes.reauthToken;
      }
      setAuthorized(true);
      void preloadConsoleData();
    } catch {
      setAuthorized(false);
    } finally {
      setChecking(false);
    }
  }, [apiPrefix, preloadConsoleData]);

  useEffect(() => {
    void verifyServerAdminSession();
  }, [verifyServerAdminSession]);

  const beginMfaCheck = async () => {
    if (!supabase) {
      setAuthError('Authentication client is not configured.');
      return;
    }
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData?.currentLevel === 'aal2') {
      const res = await apiRequest<{ reauthToken?: string }>(`${apiPrefix}/session`, { method: 'POST' });
      if (res?.reauthToken) reauthTokenRef.current = res.reauthToken;
      setAuthorized(true);
      void preloadConsoleData();
      notify('Authenticated to operations console (AAL2).', 'success');
      return;
    }

    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verifiedTotp = factors?.totp?.find((f) => f.status === 'verified');
    if (verifiedTotp) {
      setFactorId(verifiedTotp.id);
      setStep('mfa-verify');
      return;
    }

    const { data: enrolled, error: enrollErr } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Veyra Admin Authenticator',
    });
    if (enrollErr || !enrolled) {
      setAuthError(enrollErr?.message || 'Unable to start TOTP MFA enrollment.');
      return;
    }
    setFactorId(enrolled.id);
    setEnrollQrSvg(enrolled.totp.qr_code);
    setEnrollSecret(enrolled.totp.secret);
    setStep('mfa-enroll');
  };

  const handleAdminPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setAuthError('Authentication service is not configured.');
      return;
    }
    setAuthError('');
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        setAuthError('Invalid administrator credentials.');
        return;
      }
      await refreshAuth();
      await beginMfaCheck();
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Admin authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyTotp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !factorId) return;
    setAuthError('');
    setBusy(true);
    try {
      const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId });
      if (chErr || !challenge) {
        setAuthError(chErr?.message || 'MFA challenge failed.');
        return;
      }
      const { error: verErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: totpCode.trim(),
      });
      if (verErr) {
        setAuthError('Invalid 6-digit authenticator code.');
        return;
      }
      await refreshAuth();
      const res = await apiRequest<{ reauthToken?: string }>(`${apiPrefix}/session`, { method: 'POST' });
      if (res?.reauthToken) reauthTokenRef.current = res.reauthToken;
      setAuthorized(true);
      setTotpCode('');
      void preloadConsoleData();
      notify('MFA verified (AAL2). Operations console unlocked.', 'success');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Server rejected admin session.');
    } finally {
      setBusy(false);
    }
  };

  const handleAdminLogout = async () => {
    try {
      await apiRequest(`${apiPrefix}/logout`, { method: 'POST' });
    } catch {
      // ignore
    }
    reauthTokenRef.current = '';
    if (supabase) {
      await supabase.auth.signOut({ scope: 'local' });
    }
    setAuthorized(false);
    setStep('login');
    setPassword('');
    setTotpCode('');
    navigate('/', { replace: true });
  };

  const requestReauth = (fn: (headers: Record<string, string>) => Promise<void>) => {
    setReauthError('');
    setReauthPassword('');
    setReauthPendingFn(() => fn);
  };

  const submitReauth = async (mode: 'password' | 'mfa') => {
    if (!reauthPendingFn) return;
    setReauthBusy(true);
    setReauthError('');
    try {
      const res = await apiRequest<{ ok: boolean; reauthToken?: string }>(`${apiPrefix}/reauth`, {
        method: 'POST',
        body: mode === 'mfa' ? { mode: 'mfa' } : { mode: 'password', password: reauthPassword },
      });
      if (res?.reauthToken) {
        reauthTokenRef.current = res.reauthToken;
      }
      const hdrs = res?.reauthToken ? { 'X-Admin-Reauth': res.reauthToken } : reauthHeader();
      await reauthPendingFn(hdrs);
      setReauthPendingFn(null);
      setReauthPassword('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Action could not be completed.';
      setReauthError(msg);
      notify(msg, 'error');
    } finally {
      setReauthBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] flex items-center justify-center gap-2 text-xs text-[#71717a]">
        <Activity className="h-4 w-4 animate-spin text-[#3b82f6]" />
        <span>Verifying operations session...</span>
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] flex items-center justify-center p-4 text-[#09090b] dark:text-[#fafafa]">
        <div className={`w-full max-w-md ${ADMIN_SURFACE} p-7 sm:p-8 space-y-6 shadow-xl`}>
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#3b82f6]">
              <ShieldCheck className="h-4 w-4" />
              <span>Restricted Operations Access · MFA Required</span>
            </div>
            <ThemeToggle />
          </div>

          {step === 'login' && (
            <form onSubmit={handleAdminPasswordLogin} className="space-y-4">
              <div>
                <h1 className="font-display text-2xl font-bold">Administrator Sign In</h1>
                <p className="text-xs text-[#71717a] mt-1">
                  Requires allowlisted email, server-verified admin role, and authenticator 2FA.
                </p>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="adm-email" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
                  Allowlisted Admin Email
                </label>
                <input
                  id="adm-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#3b82f6]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="adm-pass" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
                  Password
                </label>
                <input
                  id="adm-pass"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#3b82f6]"
                />
              </div>

              {authError && <p role="alert" className="text-xs font-medium text-[#ef4444]">{authError}</p>}

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white py-2.5 text-sm font-semibold cursor-pointer disabled:opacity-50"
              >
                {busy ? 'Authenticating...' : 'Continue to MFA Challenge'}
              </button>
            </form>
          )}

          {(step === 'mfa-verify' || step === 'mfa-enroll') && (
            <form onSubmit={handleVerifyTotp} className="space-y-4">
              <div>
                <h1 className="font-display text-2xl font-bold">
                  {step === 'mfa-enroll' ? 'Enroll Authenticator (TOTP)' : 'Two-Factor Verification'}
                </h1>
                <p className="text-xs text-[#71717a] mt-1">
                  {step === 'mfa-enroll'
                    ? 'Scan this QR code with Google Authenticator / 1Password / Authy, then enter the 6-digit code.'
                    : 'Enter the current 6-digit code from your authenticator app to complete two-factor verification.'}
                </p>
              </div>

              {step === 'mfa-enroll' && enrollQrSvg && (
                <div className="rounded-xl bg-white p-4 flex flex-col items-center gap-2 border border-[#e4e4e7]">
                  <img src={enrollQrSvg} alt="TOTP Authenticator QR Code" className="h-44 w-44" />
                  <p className="font-mono-num text-[11px] text-[#09090b] break-all text-center">
                    Manual key: {enrollSecret}
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="adm-totp" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
                  6-Digit Authenticator Code
                </label>
                <input
                  id="adm-totp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3.5 py-2.5 font-mono-num text-lg tracking-[0.35em]"
                />
              </div>

              {authError && <p role="alert" className="text-xs font-medium text-[#ef4444]">{authError}</p>}

              <button
                type="submit"
                disabled={busy || totpCode.length !== 6}
                className="w-full rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white py-2.5 text-sm font-semibold cursor-pointer disabled:opacity-50"
              >
                {busy ? 'Verifying 2FA...' : 'Verify & Unlock Console'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const nav = [
    { label: 'Overview', to: basePath, icon: LayoutDashboard },
    { label: 'Users', to: `${basePath}/users`, icon: Users },
    { label: 'Payments', to: `${basePath}/payments`, icon: CreditCard },
    { label: 'API Health', to: `${basePath}/api-keys`, icon: KeyRound },
    { label: 'Discord Bot', to: `${basePath}/discord`, icon: MessageSquare },
    { label: 'Audit Log', to: `${basePath}/audit-log`, icon: FileCheck2 },
  ];

  return (
    <HiddenAdminCtx.Provider
      value={{
        basePath,
        apiPrefix,
        reauthHeader,
        requestReauth,
        overview,
        users,
        payments,
        logs,
        loadingData,
        refreshOverview,
        refreshUsers,
        refreshPayments,
        refreshLogs,
        setUsersDirect: setUsers,
      }}
    >
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#09090b] flex text-[#09090b] dark:text-[#fafafa]">
        <aside className="w-60 shrink-0 border-r border-[#e4e4e7] dark:border-white/10 bg-white dark:bg-[#0d0f15] hidden md:flex flex-col justify-between p-4 sticky top-0 h-screen">
          <div className="space-y-6">
            <div className="px-2">
              <p className="font-display text-lg font-bold">Veyra Ops</p>
              <p className="text-[11px] text-[#3b82f6] font-medium">2FA Protected · 30m Idle Lock</p>
            </div>
            <nav className="space-y-1">
              {nav.map((item) => {
                const Icon = item.icon;
                const active = location.pathname === item.to;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-[#3b82f6]/12 text-[#2563eb] dark:text-[#60a5fa]'
                        : 'text-[#52525b] dark:text-[#a1a1aa] hover:bg-[#f4f4f5] dark:hover:bg-white/5'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="pt-4 border-t border-[#e4e4e7] dark:border-white/10 space-y-2">
            <button
              type="button"
              onClick={handleAdminLogout}
              className="w-full flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-[#ef4444] hover:bg-[#ef4444]/10 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out &amp; Lock Console</span>
            </button>
          </div>
        </aside>

        <div className="flex-1 min-w-0 flex flex-col">
          <header className="h-14 border-b border-[#e4e4e7] dark:border-white/10 bg-white dark:bg-[#0d0f15] px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-30">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#3b82f6] truncate">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Hidden Operations Console · No-Index / No-Store</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void preloadConsoleData()}
                disabled={loadingData}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#e4e4e7] dark:border-white/15 px-2.5 py-1.5 text-xs font-medium hover:border-[#3b82f6] cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Refresh</span>
              </button>
              <ThemeToggle />
            </div>
          </header>

          {/* Mobile navigation strip */}
          <div className="md:hidden border-b border-[#e4e4e7] dark:border-white/10 bg-white dark:bg-[#0d0f15] px-4 py-2 flex items-center gap-1.5 overflow-x-auto">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap ${
                    active
                      ? 'bg-[#3b82f6]/15 text-[#2563eb] dark:text-[#60a5fa]'
                      : 'text-[#52525b] dark:text-[#a1a1aa]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <main className="flex-1 p-4 sm:p-6 max-w-6xl w-full mx-auto">
            <Outlet />
          </main>
        </div>

        {/* Step-Up Confirmation Modal */}
        {reauthPendingFn && (
          <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void submitReauth('password');
              }}
              className={`${ADMIN_SURFACE} p-6 max-w-sm w-full space-y-4 shadow-2xl`}
            >
              <div className="flex items-center gap-2 text-[#3b82f6] font-semibold text-sm">
                <ShieldAlert className="h-4 w-4" />
                <span>Confirm Privileged Action</span>
              </div>
              <p className="text-xs text-[#52525b] dark:text-[#a1a1aa]">
                Enter your administrator password, or confirm directly using your active two-factor verification session.
              </p>
              <input
                type="password"
                autoFocus
                value={reauthPassword}
                onChange={(e) => setReauthPassword(e.target.value)}
                placeholder="Administrator password (optional for Google + 2FA)"
                className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#3b82f6]"
              />
              {reauthError && (
                <div role="alert" className="rounded-lg border border-[#ef4444]/35 bg-[#ef4444]/10 p-2.5 text-xs text-[#ef4444]">
                  {reauthError}
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  disabled={reauthBusy}
                  onClick={() => void submitReauth('mfa')}
                  className="rounded-lg border border-[#3b82f6]/40 bg-[#3b82f6]/10 text-[#3b82f6] hover:bg-[#3b82f6]/20 px-3 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  Confirm with Active 2FA
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={reauthBusy}
                    onClick={() => {
                      setReauthPendingFn(null);
                      setReauthError('');
                    }}
                    className="rounded-lg border border-[#e4e4e7] dark:border-white/15 px-3 py-2 text-xs font-medium cursor-pointer disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={reauthBusy || reauthPassword.length < 6}
                    className="rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white px-3.5 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    {reauthBusy ? 'Applying...' : 'Confirm'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </div>
    </HiddenAdminCtx.Provider>
  );
}

export function AdminOverviewPage() {
  const { overview, refreshOverview } = useHiddenAdmin();

  useEffect(() => {
    void refreshOverview();
  }, [refreshOverview]);

  if (!overview?.stats) {
    return (
      <div className="p-8 text-center text-sm text-[#71717a] flex items-center justify-center gap-2">
        <Activity className="h-4 w-4 animate-spin text-[#3b82f6]" />
        <span>Loading platform overview...</span>
      </div>
    );
  }

  const { stats } = overview;
  const cards = [
    { label: 'Total Users', value: stats.totalUsers },
    { label: 'Active Pro Users', value: stats.proUsers },
    { label: 'Pending Payments', value: stats.pendingPayments },
    { label: 'Approved Revenue', value: `₹${stats.approvedRevenueInr.toLocaleString()}` },
    { label: 'Watchlist Follows', value: stats.activeWatchlistItems },
    { label: 'Active Alerts', value: stats.activeAlerts },
    { label: 'AI Queries Logged', value: stats.aiQueriesCount },
    { label: 'Write Access', value: stats.dbWriteReady ? 'Ready' : 'Setup Needed' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Platform Overview</h1>
        <p className="text-xs text-[#71717a] mt-1">Real-time platform metrics and operational health.</p>
      </div>
      {stats.dbWriteReady === false && <DatabaseSetupBanner onVerified={refreshOverview} />}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className={`${ADMIN_SURFACE} p-5`}>
            <p className="text-xs text-[#71717a]">{c.label}</p>
            <p className="font-mono-num text-2xl font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminUsersPage() {
  const { apiPrefix, overview, users, reauthHeader, refreshOverview, refreshUsers, setUsersDirect, requestReauth } =
    useHiddenAdmin();
  const { notify } = useVeyra();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'pro' | 'free' | 'admin' | 'banned'>('all');
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  useEffect(() => {
    void refreshUsers();
  }, [refreshUsers]);

  const counts = useMemo(() => {
    let pro = 0;
    let admin = 0;
    let banned = 0;
    for (const u of users) {
      if (isProSubscriptionActive(u)) pro++;
      if (u.is_admin) admin++;
      if (u.is_banned) banned++;
    }
    return { total: users.length, pro, free: users.length - pro, admin, banned };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const pro = isProSubscriptionActive(u);
      if (filter === 'pro' && !pro) return false;
      if (filter === 'free' && pro) return false;
      if (filter === 'admin' && !u.is_admin) return false;
      if (filter === 'banned' && !u.is_banned) return false;
      if (!q) return true;
      return (
        (u.full_name || '').toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      );
    });
  }, [users, search, filter]);

  const runAction = async (id: string, action: 'grant_pro' | 'revoke_pro' | 'ban' | 'unban') => {
    const execute = async (extraHeaders: Record<string, string>) => {
      setBusyUserId(id);
      try {
        const res = await apiRequest<{ user: UserProfile }>(`${apiPrefix}/users/${id}`, {
          method: 'PATCH',
          headers: extraHeaders,
          body: { action },
        });
        if (res?.user) {
          setUsersDirect((prev) => prev.map((item) => (item.id === id ? res.user : item)));
        }
        await refreshUsers();
        notify(`Updated user (${action.replace('_', ' ')}).`, 'success');
      } finally {
        setBusyUserId(null);
      }
    };

    try {
      await execute(reauthHeader());
    } catch (err) {
      if (err instanceof ApiError && err.status === 428) {
        requestReauth(execute);
      } else {
        notify(err instanceof Error ? err.message : 'Action failed.', 'error');
      }
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">User Management</h1>
          <p className="text-xs text-[#71717a] mt-1">
            Manage 30-day Pro passes and account suspensions across all registered accounts.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono-num">
          <span className="rounded-lg border border-[#e4e4e7] dark:border-white/10 px-2.5 py-1">
            Total: <strong>{counts.total}</strong>
          </span>
          <span className="rounded-lg border border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#3b82f6] px-2.5 py-1">
            Pro: <strong>{counts.pro}</strong>
          </span>
          <span className="rounded-lg border border-[#e4e4e7] dark:border-white/10 px-2.5 py-1">
            Free: <strong>{counts.free}</strong>
          </span>
        </div>
      </div>

      {overview?.stats?.dbWriteReady === false && <DatabaseSetupBanner onVerified={refreshOverview} />}

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="h-4 w-4 text-[#71717a] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#11131a] pl-9 pr-3.5 py-2 text-xs focus:outline-none focus:border-[#3b82f6]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {(
            [
              ['all', `All (${counts.total})`],
              ['pro', `Pro (${counts.pro})`],
              ['free', `Free (${counts.free})`],
              ['admin', `Admins (${counts.admin})`],
              ['banned', `Banned (${counts.banned})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition-colors cursor-pointer ${
                filter === key
                  ? 'bg-[#3b82f6] text-white'
                  : 'border border-[#e4e4e7] dark:border-white/10 bg-white dark:bg-[#11131a] text-[#52525b] dark:text-[#a1a1aa] hover:border-[#3b82f6]/50'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={`${ADMIN_SURFACE} overflow-x-auto`}>
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="border-b border-[#e4e4e7] dark:border-white/10 text-xs text-[#71717a]">
              <th className="py-3.5 px-4">User</th>
              <th className="py-3.5 px-4">Tier</th>
              <th className="py-3.5 px-4">Consent</th>
              <th className="py-3.5 px-4">Status</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e4e4e7]/70 dark:divide-white/5">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-xs text-[#71717a]">
                  No matching user accounts found.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => {
                const pro = isProSubscriptionActive(u);
                const isBusy = busyUserId === u.id;
                return (
                  <tr key={u.id} className="hover:bg-[#f4f4f5]/50 dark:hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-[#09090b] dark:text-white">{u.full_name || 'User'}</p>
                      <p className="text-xs text-[#71717a]">{u.email}</p>
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {pro ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-[#3b82f6]/15 text-[#3b82f6] px-2 py-0.5 font-semibold">
                            <Crown className="h-3 w-3" />
                            <span>Pro</span>
                          </span>
                        ) : (
                          <span className="text-[#71717a] font-medium">Free</span>
                        )}
                        {u.is_admin && (
                          <span className="rounded-md bg-[#22c55e]/15 text-[#22c55e] px-2 py-0.5 font-semibold">
                            Admin
                          </span>
                        )}
                      </div>
                      {pro && u.pro_expires_at && (
                        <p className="text-[11px] text-[#71717a] mt-0.5 font-mono-num">
                          until {new Date(u.pro_expires_at).toLocaleDateString()}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono-num text-xs text-[#71717a]">
                      {u.terms_version || '2026-11'}
                    </td>
                    <td className="py-3.5 px-4 text-xs">
                      {u.is_banned ? (
                        <span className="text-[#ef4444] font-semibold">Banned</span>
                      ) : (
                        <span className="text-[#22c55e] font-medium">Active</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-1.5">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void runAction(u.id, pro ? 'revoke_pro' : 'grant_pro')}
                          className="rounded-lg border border-[#3b82f6]/40 px-2.5 py-1 text-xs font-medium text-[#3b82f6] hover:bg-[#3b82f6]/10 cursor-pointer disabled:opacity-50"
                        >
                          {isBusy ? 'Updating...' : pro ? 'Revoke Pro' : 'Grant 30d Pro'}
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void runAction(u.id, u.is_banned ? 'unban' : 'ban')}
                          className="rounded-lg border border-[#ef4444]/40 px-2.5 py-1 text-xs font-medium text-[#ef4444] hover:bg-[#ef4444]/10 cursor-pointer disabled:opacity-50"
                        >
                          {u.is_banned ? 'Unban' : 'Ban'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminPaymentsPage() {
  const { apiPrefix, overview, payments, reauthHeader, refreshOverview, refreshPayments, refreshUsers, requestReauth } =
    useHiddenAdmin();
  const { notify } = useVeyra();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void refreshPayments();
  }, [refreshPayments]);

  const review = async (id: string, action: 'approve' | 'reject') => {
    const execute = async (extraHeaders: Record<string, string>) => {
      setBusyId(id);
      try {
        await apiRequest(`${apiPrefix}/payments/${id}`, {
          method: 'PATCH',
          headers: extraHeaders,
          body: { action, admin_note: notes[id] || '' },
        });
        await Promise.all([refreshPayments(), refreshUsers()]);
        notify(action === 'approve' ? 'Payment approved and 30-day Pro activated.' : 'Payment rejected.', 'success');
      } finally {
        setBusyId(null);
      }
    };

    try {
      await execute(reauthHeader());
    } catch (err) {
      if (err instanceof ApiError && err.status === 428) {
        requestReauth(execute);
      } else {
        notify(err instanceof Error ? err.message : 'Unable to review payment.', 'error');
      }
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Manual Payment Verification Queue</h1>
      {overview?.stats?.dbWriteReady === false && <DatabaseSetupBanner onVerified={refreshOverview} />}

      <div className="space-y-4">
        {payments.length === 0 ? (
          <div className={`${ADMIN_SURFACE} p-8 text-center text-sm text-[#71717a]`}>
            No payment verification requests submitted yet.
          </div>
        ) : (
          payments.map((p) => (
            <div key={p.id} className={`${ADMIN_SURFACE} p-5 space-y-3`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {p.user_name} <span className="text-xs font-normal text-[#71717a]">({p.user_email})</span>
                  </p>
                  <p className="font-mono-num text-xs text-[#2563eb] dark:text-[#60a5fa] mt-0.5">
                    TXN: {p.transaction_id} · ₹{p.amount_inr} · {p.payment_method.toUpperCase()}
                  </p>
                </div>
                <span
                  className={`text-xs font-semibold capitalize ${
                    p.status === 'approved'
                      ? 'text-[#22c55e]'
                      : p.status === 'rejected'
                        ? 'text-[#ef4444]'
                        : 'text-[#3b82f6]'
                  }`}
                >
                  {p.status}
                </span>
              </div>

              {p.status === 'pending' ? (
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <input
                    type="text"
                    value={notes[p.id] || ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    placeholder="Optional admin note..."
                    className="flex-1 rounded-lg border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => void review(p.id, 'approve')}
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white px-3.5 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Approve (+30d Pro)</span>
                  </button>
                  <button
                    type="button"
                    disabled={busyId === p.id}
                    onClick={() => void review(p.id, 'reject')}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#ef4444]/40 text-[#ef4444] px-3.5 py-1.5 text-xs font-semibold hover:bg-[#ef4444]/10 cursor-pointer disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>Reject</span>
                  </button>
                </div>
              ) : (
                <p className="text-xs text-[#71717a]">Review note: {p.admin_note || '—'}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function AdminApiHealthPage() {
  const { overview, refreshOverview } = useHiddenAdmin();
  const health = overview?.apiHealth || [];

  useEffect(() => {
    void refreshOverview();
  }, [refreshOverview]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">API Health &amp; Provider Status</h1>
        <p className="text-xs text-[#71717a] mt-1">
          API secrets are managed strictly through server environment variables and are never exposed to the browser.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {health.map((svc) => (
          <div key={svc.service_name} className={`${ADMIN_SURFACE} p-5 flex items-center justify-between gap-4`}>
            <div className="space-y-1">
              <p className="font-semibold text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-[#3b82f6]" />
                <span>{svc.label}</span>
              </p>
              <p className="text-xs text-[#71717a]">
                Mode: <span className="font-mono-num">{svc.mode}</span>
              </p>
            </div>
            <span className={`text-xs font-semibold ${svc.is_active ? 'text-[#22c55e]' : 'text-[#71717a]'}`}>
              {svc.is_active ? 'Active' : 'Unconfigured'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminDiscordPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="font-display text-2xl font-bold">Discord Bot Deployment</h1>
      <div className={`${ADMIN_SURFACE} p-6 space-y-4 text-sm text-[#52525b] dark:text-[#a1a1aa]`}>
        <p>
          The standalone Veyra Discord Bot lives in <code className="font-mono text-xs">/discord-bot</code> using Discord.js v14 with live slash commands.
        </p>
        <p className="text-xs">
          Use minimal Discord invite permissions (<code className="font-mono">permissions=2147485696</code> for Send Messages, Embed Links, and Slash Commands — never Administrator <code className="font-mono">permissions=8</code>).
        </p>
      </div>
    </div>
  );
}

export function AdminAuditLogPage() {
  const { logs, refreshLogs } = useHiddenAdmin();

  useEffect(() => {
    void refreshLogs();
  }, [refreshLogs]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Append-Only Admin Audit Log</h1>
      <div className={`${ADMIN_SURFACE} overflow-x-auto`}>
        {logs.length === 0 ? (
          <p className="p-8 text-center text-sm text-[#71717a]">No admin actions recorded yet.</p>
        ) : (
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#e4e4e7] dark:border-white/10 text-xs text-[#71717a]">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Target</th>
                <th className="py-3 px-4">IP Address</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e4e7]/70 dark:divide-white/5 text-xs">
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="py-3 px-4 font-mono-num text-[#71717a]">
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-4 font-semibold text-[#3b82f6]">{l.action}</td>
                  <td className="py-3 px-4 font-mono-num">
                    {l.target_type}:{l.target_id || '—'}
                  </td>
                  <td className="py-3 px-4 font-mono-num text-[#71717a]">{l.ip_address || '—'}</td>
                  <td className="py-3 px-4 font-mono-num text-[#52525b] dark:text-[#a1a1aa]">
                    {JSON.stringify(l.details)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
