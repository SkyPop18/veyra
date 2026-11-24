import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Check,
  CreditCard,
  FileCheck2,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageSquare,
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

interface HiddenAdminCtxValue {
  basePath: string;
  apiPrefix: string;
  requestReauth: (onConfirmed: () => Promise<void>) => void;
}

const HiddenAdminCtx = createContext<HiddenAdminCtxValue | null>(null);

function useHiddenAdmin() {
  const ctx = useContext(HiddenAdminCtx);
  if (!ctx) throw new Error('useHiddenAdmin must be used inside AdminShell');
  return ctx;
}

export function AdminShell({ basePath }: { basePath: string }) {
  const { notify, refreshAuth } = useVeyra();
  const location = useLocation();
  const navigate = useNavigate();

  const apiPrefix = '/api/admin';

  const [checking, setChecking] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  // Separate admin login + Supabase TOTP MFA (AAL2) flow
  const [step, setStep] = useState<'login' | 'mfa-verify' | 'mfa-enroll'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [factorId, setFactorId] = useState('');
  const [enrollQrSvg, setEnrollQrSvg] = useState('');
  const [enrollSecret, setEnrollSecret] = useState('');
  const [authError, setAuthError] = useState('');
  const [busy, setBusy] = useState(false);

  // Re-authentication modal for dangerous actions
  const [reauthPendingFn, setReauthPendingFn] = useState<(() => Promise<void>) | null>(null);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthError, setReauthError] = useState('');
  const [reauthBusy, setReauthBusy] = useState(false);

  const verifyServerAdminSession = useCallback(async () => {
    setChecking(true);
    try {
      await apiRequest(`${apiPrefix}/overview`);
      setAuthorized(true);
    } catch {
      setAuthorized(false);
    } finally {
      setChecking(false);
    }
  }, [apiPrefix]);

  useEffect(() => {
    void verifyServerAdminSession();
  }, [verifyServerAdminSession]);

  const beginMfaCheck = async () => {
    if (!supabase) {
      setAuthError('Supabase client is not configured.');
      return;
    }
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (aalData?.currentLevel === 'aal2') {
      await apiRequest(`${apiPrefix}/session`, { method: 'POST' });
      setAuthorized(true);
      notify('Authenticated to hidden operations console (AAL2).', 'success');
      return;
    }

    const { data: factors } = await supabase.auth.mfa.listFactors();
    const verifiedTotp = factors?.totp?.find((f) => f.status === 'verified');
    if (verifiedTotp) {
      setFactorId(verifiedTotp.id);
      setStep('mfa-verify');
      return;
    }

    // Enroll a new TOTP factor for first-time admin MFA setup
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
      setAuthError('Supabase Auth is not configured.');
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
      await apiRequest(`${apiPrefix}/session`, { method: 'POST' });
      setAuthorized(true);
      setTotpCode('');
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
    if (supabase) {
      await supabase.auth.signOut({ scope: 'local' });
    }
    setAuthorized(false);
    setStep('login');
    setPassword('');
    setTotpCode('');
    navigate('/', { replace: true });
  };

  const requestReauth = (fn: () => Promise<void>) => {
    setReauthError('');
    setReauthPassword('');
    setReauthPendingFn(() => fn);
  };

  const handleConfirmReauth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reauthPendingFn) return;
    setReauthBusy(true);
    setReauthError('');
    try {
      await apiRequest(`${apiPrefix}/reauth`, {
        method: 'POST',
        body: { password: reauthPassword },
      });
      const fn = reauthPendingFn;
      setReauthPendingFn(null);
      setReauthPassword('');
      await fn();
    } catch (err) {
      setReauthError(err instanceof Error ? err.message : 'Password re-authentication failed.');
    } finally {
      setReauthBusy(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen veyra-bg flex items-center justify-center text-xs text-[#71717a]">
        Verifying operations session...
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="min-h-screen veyra-bg flex items-center justify-center p-4 text-[#09090b] dark:text-[#fafafa]">
        <div className="w-full max-w-md glass-surface p-7 sm:p-8 space-y-6">
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
                  Requires allowlisted email, server-verified admin role, and TOTP authenticator MFA (AAL2).
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
                  className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3.5 py-2.5 text-sm"
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
                  className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3.5 py-2.5 text-sm"
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
                    : 'Enter the current 6-digit code from your authenticator app to elevate to AAL2.'}
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
                {busy ? 'Verifying AAL2...' : 'Verify & Unlock Console'}
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
    <HiddenAdminCtx.Provider value={{ basePath, apiPrefix, requestReauth }}>
      <div className="min-h-screen veyra-bg flex text-[#09090b] dark:text-[#fafafa]">
        <aside className="w-60 shrink-0 border-r border-[#e4e4e7] dark:border-white/10 bg-white/85 dark:bg-[#09090b]/85 backdrop-blur-xl hidden md:flex flex-col justify-between p-4 sticky top-0 h-screen">
          <div className="space-y-6">
            <div className="px-2">
              <p className="font-display text-lg font-bold">Veyra Ops</p>
              <p className="text-[11px] text-[#3b82f6] font-medium">AAL2 MFA · 30m Idle Lock</p>
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
          <header className="h-14 border-b border-[#e4e4e7] dark:border-white/10 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-xl px-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#3b82f6]">
              <Lock className="h-3.5 w-3.5" />
              <span>Hidden Operations Console · No-Index / No-Store</span>
            </div>
            <ThemeToggle />
          </header>

          <main className="flex-1 p-6 max-w-6xl w-full mx-auto">
            <Outlet />
          </main>
        </div>

        {/* Password Re-Authentication Modal for Dangerous Actions */}
        {reauthPendingFn && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <form onSubmit={handleConfirmReauth} className="glass-surface p-6 max-w-sm w-full space-y-4">
              <div className="flex items-center gap-2 text-[#3b82f6] font-semibold text-sm">
                <ShieldAlert className="h-4 w-4" />
                <span>Re-Authenticate to Confirm Action</span>
              </div>
              <p className="text-xs text-[#52525b] dark:text-[#a1a1aa]">
                Enter your administrator password to authorize this privileged change.
              </p>
              <input
                type="password"
                required
                value={reauthPassword}
                onChange={(e) => setReauthPassword(e.target.value)}
                placeholder="Administrator password"
                className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3.5 py-2.5 text-sm"
              />
              {reauthError && <p className="text-xs text-[#ef4444]">{reauthError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setReauthPendingFn(null)}
                  className="rounded-lg border border-[#e4e4e7] dark:border-white/15 px-3.5 py-2 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reauthBusy}
                  className="rounded-lg bg-[#3b82f6] text-white px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50"
                >
                  {reauthBusy ? 'Verifying...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </HiddenAdminCtx.Provider>
  );
}

export function AdminOverviewPage() {
  const { apiPrefix } = useHiddenAdmin();
  const [data, setData] = useState<{
    stats: {
      totalUsers: number;
      proUsers: number;
      pendingPayments: number;
      approvedRevenueInr: number;
      activeWatchlistItems: number;
      activeAlerts: number;
      aiQueriesCount: number;
      dbMode: string;
    };
    apiHealth: ApiConfigHealth[];
  } | null>(null);

  useEffect(() => {
    void apiRequest<typeof data>(`${apiPrefix}/overview`).then(setData).catch(() => {});
  }, [apiPrefix]);

  if (!data?.stats) {
    return (
      <div className="p-8 text-center text-sm text-[#71717a] flex items-center justify-center gap-2">
        <Activity className="h-4 w-4 animate-spin text-[#3b82f6]" />
        <span>Loading platform overview...</span>
      </div>
    );
  }

  const cards = [
    { label: 'Total Users', value: data.stats.totalUsers },
    { label: 'Active Pro Users', value: data.stats.proUsers },
    { label: 'Pending Payments', value: data.stats.pendingPayments },
    { label: 'Approved Revenue', value: `₹${data.stats.approvedRevenueInr.toLocaleString()}` },
    { label: 'Watchlist Follows', value: data.stats.activeWatchlistItems },
    { label: 'Active Alerts', value: data.stats.activeAlerts },
    { label: 'AI Queries Logged', value: data.stats.aiQueriesCount },
    { label: 'Database Mode', value: data.stats.dbMode },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Platform Overview</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="glass-surface p-5">
            <p className="text-xs text-[#71717a]">{c.label}</p>
            <p className="font-mono-num text-2xl font-bold mt-1">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminUsersPage() {
  const { apiPrefix, requestReauth } = useHiddenAdmin();
  const { notify } = useVeyra();
  const [users, setUsers] = useState<UserProfile[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await apiRequest<{ users: UserProfile[] }>(`${apiPrefix}/users`);
      setUsers(Array.isArray(res?.users) ? res.users : []);
    } catch {
      setUsers([]);
    }
  }, [apiPrefix]);

  useEffect(() => {
    void load().catch(() => {});
  }, [load]);

  const runAction = async (id: string, action: 'grant_pro' | 'revoke_pro' | 'ban' | 'unban') => {
    const execute = async () => {
      await apiRequest(`${apiPrefix}/users/${id}`, { method: 'PATCH', body: { action } });
      await load();
      notify(`Updated user (${action.replace('_', ' ')}).`, 'success');
    };
    try {
      await execute();
    } catch (err) {
      if (err instanceof ApiError && err.status === 428) {
        requestReauth(execute);
      } else {
        notify(err instanceof Error ? err.message : 'Action failed.', 'error');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">User Management</h1>
        <p className="text-xs text-[#71717a] mt-1">
          Manage Pro subscriptions and account bans. Admin roles are strictly managed via Supabase SQL Editor — never from the web UI.
        </p>
      </div>

      <div className="glass-surface overflow-x-auto">
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
            {users.map((u) => {
              const pro = isProSubscriptionActive(u);
              return (
                <tr key={u.id}>
                  <td className="py-3.5 px-4">
                    <p className="font-semibold">{u.full_name || 'User'}</p>
                    <p className="text-xs text-[#71717a]">{u.email}</p>
                  </td>
                  <td className="py-3.5 px-4 text-xs font-semibold">
                    {pro ? <span className="text-[#3b82f6]">Pro</span> : 'Free'}
                    {u.is_admin && <span className="ml-2 text-[#22c55e]">· Admin</span>}
                  </td>
                  <td className="py-3.5 px-4 font-mono-num text-xs text-[#71717a]">
                    {u.terms_version || 'Pending'}
                  </td>
                  <td className="py-3.5 px-4 text-xs">
                    {u.is_banned ? <span className="text-[#ef4444] font-semibold">Banned</span> : 'Active'}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="inline-flex flex-wrap justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => void runAction(u.id, pro ? 'revoke_pro' : 'grant_pro')}
                        className="rounded-lg border border-[#3b82f6]/40 px-2.5 py-1 text-xs font-medium text-[#3b82f6] hover:bg-[#3b82f6]/10 cursor-pointer"
                      >
                        {pro ? 'Revoke Pro' : 'Grant 30d Pro'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void runAction(u.id, u.is_banned ? 'unban' : 'ban')}
                        className="rounded-lg border border-[#ef4444]/40 px-2.5 py-1 text-xs font-medium text-[#ef4444] hover:bg-[#ef4444]/10 cursor-pointer"
                      >
                        {u.is_banned ? 'Unban' : 'Ban'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function AdminPaymentsPage() {
  const { apiPrefix, requestReauth } = useHiddenAdmin();
  const { notify } = useVeyra();
  const [payments, setPayments] = useState<
    Array<PaymentRequest & { user_email: string; user_name: string }>
  >([]);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await apiRequest<{
      payments: Array<PaymentRequest & { user_email: string; user_name: string }>;
    }>(`${apiPrefix}/payments`);
    setPayments(res.payments);
  }, [apiPrefix]);

  useEffect(() => {
    void load().catch(() => {});
  }, [load]);

  const review = async (id: string, action: 'approve' | 'reject') => {
    const execute = async () => {
      await apiRequest(`${apiPrefix}/payments/${id}`, {
        method: 'PATCH',
        body: { action, admin_note: notes[id] || '' },
      });
      await load();
      notify(action === 'approve' ? 'Payment approved and 30-day Pro activated.' : 'Payment rejected.', 'success');
    };

    try {
      await execute();
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

      <div className="space-y-4">
        {(payments || []).length === 0 ? (
          <div className="glass-surface p-8 text-center text-sm text-[#71717a]">
            No payment verification requests submitted yet.
          </div>
        ) : (
          (payments || []).map((p) => (
            <div key={p.id} className="glass-surface p-5 space-y-3">
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
                    onClick={() => void review(p.id, 'approve')}
                    className="inline-flex items-center justify-center gap-1 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white px-3.5 py-1.5 text-xs font-semibold cursor-pointer"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Approve (+30d Pro)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void review(p.id, 'reject')}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-[#ef4444]/40 text-[#ef4444] px-3.5 py-1.5 text-xs font-semibold hover:bg-[#ef4444]/10 cursor-pointer"
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
  const { apiPrefix } = useHiddenAdmin();
  const [health, setHealth] = useState<ApiConfigHealth[]>([]);

  useEffect(() => {
    void apiRequest<{ apiHealth: ApiConfigHealth[] }>(`${apiPrefix}/overview`)
      .then((res) => setHealth(Array.isArray(res?.apiHealth) ? res.apiHealth : []))
      .catch(() => setHealth([]));
  }, [apiPrefix]);

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
          <div key={svc.service_name} className="glass-surface p-5 flex items-center justify-between gap-4">
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
      <div className="glass-surface p-6 space-y-4 text-sm text-[#52525b] dark:text-[#a1a1aa]">
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
  const { apiPrefix } = useHiddenAdmin();
  const [logs, setLogs] = useState<AdminAuditEntry[]>([]);

  useEffect(() => {
    void apiRequest<{ logs: AdminAuditEntry[] }>(`${apiPrefix}/audit-log`)
      .then((res) => setLogs(Array.isArray(res?.logs) ? res.logs : []))
      .catch(() => setLogs([]));
  }, [apiPrefix]);

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Append-Only Admin Audit Log</h1>
      <div className="glass-surface overflow-x-auto">
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
