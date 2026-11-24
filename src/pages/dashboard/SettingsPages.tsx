import React, { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Check,
  Crown,
  Download,
  ExternalLink,
  Link2,
  LogOut,
  Mail,
  MessageSquare,
  Shield,
  Trash2,
  Unlink,
} from 'lucide-react';
import { useVeyra } from '../../context/VeyraContext';
import { apiRequest } from '../../lib/api';
import { supabase } from '../../lib/supabase';
import { isProSubscriptionActive } from '../../lib/core';
import type { PaymentMethod, PaymentRequest, UserProfile } from '../../types/veyra';

export function SettingsLayout() {
  const location = useLocation();
  const tabs = [
    { label: 'General', to: '/dashboard/settings' },
    { label: 'Discord', to: '/dashboard/settings/discord' },
    { label: 'Subscription & Pro', to: '/dashboard/settings/subscription' },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#09090b] dark:text-white">
          Account Settings
        </h1>
        <p className="text-sm text-[#52525b] dark:text-[#a1a1aa] mt-1">
          Manage your Veyra profile, security sessions, privacy controls, Discord bridge, and Pro subscription.
        </p>
      </div>

      <nav aria-label="Settings sections" className="flex flex-wrap items-center gap-2 border-b border-[#e4e4e7] dark:border-white/10 pb-3">
        {tabs.map((tab) => {
          const active = location.pathname === tab.to;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
                active
                  ? 'bg-[#3b82f6] text-white'
                  : 'text-[#52525b] dark:text-[#a1a1aa] hover:bg-[#f4f4f5] dark:hover:bg-white/5'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <Outlet />
    </div>
  );
}

export function GeneralSettingsPage() {
  const { user, theme, toggleTheme, setUserDirect, logout, logoutEverywhere, notify } = useVeyra();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(user?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/auth/profile', {
        method: 'PATCH',
        body: { full_name: fullName, avatar_url: avatarUrl },
      });
      setUserDirect(res.user);
      notify('Profile updated.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to update profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadData = async () => {
    setExporting(true);
    try {
      const payload = await apiRequest<Record<string, unknown>>('/api/user/export-data');
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `veyra-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      notify('Your account data export has been downloaded.', 'success');
    } catch {
      notify('Unable to export your data right now.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handleLogoutEverywhere = async () => {
    await logoutEverywhere();
    navigate('/login', { replace: true });
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (deleteText.trim().toUpperCase() !== 'DELETE') return;
    setDeleting(true);
    try {
      // 1. Delete all user data on server and attempt admin deletion
      await apiRequest('/api/auth/account', { method: 'DELETE' });

      // 2. Invalidate credentials in Supabase Auth directly
      if (supabase) {
        try {
          await supabase.rpc('delete_user_account');
        } catch {
          // ignore if rpc not defined
        }
        try {
          // Randomize password so old credentials never log in again
          await supabase.auth.updateUser({
            password: crypto.randomUUID() + crypto.randomUUID() + crypto.randomUUID(),
            data: { deleted: true },
          });
        } catch {
          // ignore
        }
        try {
          await supabase.auth.signOut({ scope: 'global' });
        } catch {
          // ignore
        }
      }

      // 3. Clear local storage and tokens completely
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        // ignore
      }

      await logout();
      notify('Your account and personal data have been permanently deleted.', 'info');
      navigate('/register', { replace: true });
    } catch {
      notify('Unable to delete account right now. Contact akshatbhopali@gmail.com.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSave} className="glass-surface p-6 space-y-4">
        <h2 className="font-display text-base font-semibold">Profile Information</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label htmlFor="set-name" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
              Display Name
            </label>
            <input
              id="set-name"
              type="text"
              required
              minLength={2}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3.5 py-2.5 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="set-email" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
              Verified Email (read-only)
            </label>
            <input
              id="set-email"
              type="email"
              disabled
              value={user?.email || ''}
              className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/10 bg-[#f4f4f5] dark:bg-white/5 px-3.5 py-2.5 text-sm text-[#71717a]"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="set-avatar" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
            Avatar Image URL (optional, https:// only)
          </label>
          <input
            id="set-avatar"
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://..."
            className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3.5 py-2.5 text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>

      <div className="glass-surface p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-semibold">Interface Theme</h2>
          <p className="text-xs text-[#71717a] mt-0.5">
            Current mode: <span className="font-medium capitalize text-[#09090b] dark:text-white">{theme}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="rounded-lg border border-[#e4e4e7] dark:border-white/15 px-4 py-2 text-xs font-medium hover:border-[#3b82f6] cursor-pointer"
        >
          Switch to {theme === 'dark' ? 'Light' : 'Dark'} Mode
        </button>
      </div>

      {/* Session Security: Logout Everywhere */}
      <div className="glass-surface p-6 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="font-display text-base font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 text-[#3b82f6]" />
            <span>Active Sessions &amp; Security</span>
          </h2>
          <p className="text-xs text-[#52525b] dark:text-[#a1a1aa]">
            Revoke all active Supabase login sessions across every browser and device immediately.
          </p>
        </div>
        <button
          type="button"
          onClick={handleLogoutEverywhere}
          className="inline-flex items-center gap-2 rounded-lg border border-[#e4e4e7] dark:border-white/15 px-4 py-2 text-xs font-semibold hover:border-[#3b82f6] cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Logout Everywhere</span>
        </button>
      </div>

      {/* Privacy & Data Rights */}
      <div className="glass-surface p-6 space-y-5">
        <div className="space-y-1">
          <h2 className="font-display text-base font-semibold">Privacy &amp; Your Data</h2>
          <p className="text-xs text-[#52525b] dark:text-[#a1a1aa]">
            Consent version accepted: <span className="font-mono-num font-semibold">{user?.terms_version || '—'}</span>. Exercise your data export or permanent deletion rights anytime.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={exporting}
            onClick={handleDownloadData}
            className="inline-flex items-center gap-2 rounded-lg border border-[#e4e4e7] dark:border-white/15 px-4 py-2 text-xs font-semibold hover:border-[#3b82f6] cursor-pointer disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5 text-[#3b82f6]" />
            <span>{exporting ? 'Preparing JSON...' : 'Download My Data'}</span>
          </button>

          <button
            type="button"
            onClick={() => setConfirmDeleteOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#ef4444]/40 text-[#ef4444] px-4 py-2 text-xs font-semibold hover:bg-[#ef4444]/10 cursor-pointer"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete My Account</span>
          </button>
        </div>

        {confirmDeleteOpen && (
          <form
            onSubmit={handleDeleteAccount}
            className="rounded-xl border border-[#ef4444]/35 bg-[#ef4444]/8 p-4 space-y-3"
          >
            <p className="text-xs font-medium text-[#ef4444]">
              This permanently removes your Veyra profile, watchlists, alerts, bookmarks, and AI history. Type <strong>DELETE</strong> to confirm.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                placeholder="Type DELETE"
                aria-label="Type DELETE to confirm permanent account deletion"
                className="rounded-lg border border-[#ef4444]/40 bg-white dark:bg-[#09090b] px-3 py-1.5 text-xs font-mono-num"
              />
              <button
                type="submit"
                disabled={deleting || deleteText.trim().toUpperCase() !== 'DELETE'}
                className="rounded-lg bg-[#ef4444] text-white px-4 py-1.5 text-xs font-semibold cursor-pointer disabled:opacity-45"
              >
                {deleting ? 'Deleting...' : 'Confirm Permanent Deletion'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function DiscordSettingsPage() {
  const { user, setUserDirect, notify } = useVeyra();
  const [username, setUsername] = useState(user?.discord_username || '');
  const [discordId, setDiscordId] = useState(user?.discord_id || '');
  const [busy, setBusy] = useState(false);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/auth/discord/connect', {
        method: 'POST',
        body: { discord_username: username, discord_id: discordId },
      });
      setUserDirect(res.user);
      notify('Discord account linked to Veyra.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to link Discord.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/auth/discord/disconnect', {
        method: 'POST',
      });
      setUserDirect(res.user);
      setUsername('');
      setDiscordId('');
      notify('Discord account disconnected.', 'info');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-surface p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="font-display text-base font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-[#3b82f6]" />
              <span>Discord Bot Connection</span>
            </h2>
            <p className="text-xs text-[#52525b] dark:text-[#a1a1aa]">
              Link your Discord User ID to receive triggered price alerts and sync `/watchlist`, `/leaderboard`, and Pro `/analyze` commands.
            </p>
          </div>
          {user?.discord_id && (
            <span className="text-xs font-semibold text-[#22c55e] whitespace-nowrap">Connected</span>
          )}
        </div>

        {user?.discord_id ? (
          <div className="rounded-xl bg-[#f4f4f5]/80 dark:bg-white/[0.04] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">@{user.discord_username}</p>
              <p className="font-mono-num text-xs text-[#71717a]">Discord ID: {user.discord_id}</p>
            </div>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#ef4444]/40 text-[#ef4444] px-3.5 py-2 text-xs font-medium hover:bg-[#ef4444]/10 cursor-pointer"
            >
              <Unlink className="h-3.5 w-3.5" />
              <span>Disconnect</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleConnect} className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="dc-user" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
                Discord Username
              </label>
              <input
                id="dc-user"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your_handle"
                className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3.5 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="dc-id" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
                Discord Numeric User ID
              </label>
              <input
                id="dc-id"
                type="text"
                required
                value={discordId}
                onChange={(e) => setDiscordId(e.target.value)}
                placeholder="18-digit Discord ID"
                className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3.5 py-2 font-mono-num text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white px-4 py-2 text-xs font-semibold cursor-pointer"
              >
                <Link2 className="h-3.5 w-3.5" />
                <span>{busy ? 'Linking...' : 'Link Discord Account'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="glass-surface p-6 space-y-3">
        <h3 className="font-display text-sm font-semibold">Available Veyra Slash Commands</h3>
        <div className="grid sm:grid-cols-3 gap-2.5 text-xs">
          {[
            ['/price BTC', 'Live crypto spot & 24h Δ'],
            ['/rate USD INR', 'View-only FX rate'],
            ['/leaderboard', 'Top strength scores'],
            ['/sentiment', 'Fear & Greed gauge'],
            ['/watchlist', 'Your synced assets'],
            ['/analyze BTC', 'Pro AI briefing'],
          ].map(([cmd, desc]) => (
            <div key={cmd} className="rounded-xl bg-[#f4f4f5]/80 dark:bg-white/[0.04] p-3">
              <p className="font-mono-num font-semibold text-[#2563eb] dark:text-[#60a5fa]">{cmd}</p>
              <p className="text-[#71717a] mt-0.5">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SubscriptionSettingsPage() {
  const { user, notify } = useVeyra();
  const isPro = isProSubscriptionActive(user);

  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [method, setMethod] = useState<PaymentMethod>('upi');
  const [transactionId, setTransactionId] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadRequests = async () => {
    try {
      const res = await apiRequest<{ items: PaymentRequest[] }>('/api/user/payment-requests');
      setRequests(res.items);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void loadRequests();
  }, []);

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await apiRequest('/api/user/payment-requests', {
        method: 'POST',
        body: {
          payment_method: method,
          transaction_id: transactionId,
          payment_proof_url: proofUrl.trim() || null,
        },
      });
      setTransactionId('');
      setProofUrl('');
      await loadRequests();
      notify('Payment reference submitted for manual review.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to submit payment request.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Current Plan Status */}
      <div className="glass-surface p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs text-[#71717a]">Current Subscription Tier</p>
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            {isPro && <Crown className="h-5 w-5 text-[#3b82f6]" />}
            <span>{isPro ? 'Veyra Pro (Active)' : 'Veyra Free'}</span>
          </h2>
          <p className="text-xs text-[#52525b] dark:text-[#a1a1aa]">
            {isPro && user?.pro_expires_at
              ? `Valid through ${new Date(user.pro_expires_at).toLocaleDateString()} · Auto-reverts to Free upon expiry`
              : 'Pro is ₹200/month. Payments are handled manually.'}
          </p>
        </div>
        {isPro && (
          <Link
            to="/dashboard/ai-analysis"
            className="inline-flex items-center gap-2 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white px-4 py-2 text-xs font-semibold whitespace-nowrap"
          >
            Open AI Analysis
          </Link>
        )}
      </div>

      {/* Exact Manual Payment Contacts (ZERO invented UPI IDs) */}
      <div className="grid md:grid-cols-12 gap-5">
        <div className="md:col-span-5 glass-surface p-6 space-y-4">
          <h3 className="font-display text-base font-semibold">Manual Payment Instructions</h3>
          <p className="text-xs text-[#52525b] dark:text-[#a1a1aa] leading-relaxed">
            <strong className="text-[#09090b] dark:text-white">Pro is ₹200/month. Payments are handled manually.</strong>{' '}
            Complete your ₹200 contribution via our official support page or reach out directly below, then submit your transaction reference for activation.
          </p>

          <div className="rounded-xl bg-[#f4f4f5]/90 dark:bg-white/[0.04] border border-[#e4e4e7] dark:border-white/10 p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#71717a]">Plan Price</span>
              <span className="font-mono-num font-bold">₹200 / 30 days</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#71717a] inline-flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-[#3b82f6]" />
                Discord
              </span>
              <span className="font-mono-num font-semibold text-[#09090b] dark:text-white">statusbrew</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#71717a] inline-flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-[#3b82f6]" />
                Email
              </span>
              <a href="mailto:akshatbhopali@gmail.com" className="font-mono-num font-semibold text-[#3b82f6] hover:underline">
                akshatbhopali@gmail.com
              </a>
            </div>
            <div className="pt-2 border-t border-[#e4e4e7] dark:border-white/10">
              <a
                href="https://supportme-akshat.netlify.app/supportme"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#3b82f6]/12 hover:bg-[#3b82f6]/20 text-[#2563eb] dark:text-[#60a5fa] py-2 px-3 font-semibold transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>Open Payment &amp; Support Page</span>
              </a>
            </div>
          </div>

          <ul className="space-y-1.5 text-xs text-[#52525b] dark:text-[#a1a1aa]">
            <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#3b82f6]" /><span>No auto-debit or card storage</span></li>
            <li className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-[#3b82f6]" /><span>30-day Pro pass activates after manual verification</span></li>
          </ul>
        </div>

        <form onSubmit={handleSubmitPayment} className="md:col-span-7 glass-surface p-6 space-y-4">
          <h3 className="font-display text-base font-semibold">Submit Payment Reference</h3>

          <div className="space-y-1.5">
            <label htmlFor="pay-method" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
              Payment Method
            </label>
            <select
              id="pay-method"
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3.5 py-2.5 text-sm"
            >
              <option value="upi">UPI Transfer (₹200)</option>
              <option value="qr">QR Payment via Support Page (₹200)</option>
              <option value="bank_transfer">Bank Transfer (₹200)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="pay-tx" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
              Transaction Reference / UTR ID
            </label>
            <input
              id="pay-tx"
              type="text"
              required
              minLength={6}
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="Enter your UTR or payment reference ID"
              className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3.5 py-2.5 font-mono-num text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="pay-proof" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
              Receipt Link (optional, https://)
            </label>
            <input
              id="pay-proof"
              type="url"
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              placeholder="https://..."
              className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3.5 py-2.5 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white py-2.5 px-4 text-sm font-semibold cursor-pointer disabled:opacity-60"
          >
            {submitting ? 'Submitting Request...' : 'Submit ₹200 Pro Upgrade Request'}
          </button>
        </form>
      </div>

      {/* User Payment Request History */}
      <div className="glass-surface overflow-x-auto">
        <div className="px-5 py-4 border-b border-[#e4e4e7] dark:border-white/10">
          <h3 className="font-display text-sm font-semibold">Your Payment Requests</h3>
        </div>
        {requests.length === 0 ? (
          <p className="p-6 text-xs text-[#71717a]">No upgrade requests submitted yet.</p>
        ) : (
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-[#e4e4e7] dark:border-white/10 text-xs text-[#71717a]">
                <th className="py-3 px-4">Transaction ID</th>
                <th className="py-3 px-4">Method</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Review Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e4e7]/70 dark:divide-white/5">
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="py-3 px-4 font-mono-num text-xs font-medium">{r.transaction_id}</td>
                  <td className="py-3 px-4 text-xs uppercase">{r.payment_method}</td>
                  <td className="py-3 px-4 text-right font-mono-num text-xs">₹{r.amount_inr}</td>
                  <td className="py-3 px-4 text-xs font-semibold capitalize">
                    <span
                      className={
                        r.status === 'approved'
                          ? 'text-[#22c55e]'
                          : r.status === 'rejected'
                            ? 'text-[#ef4444]'
                            : 'text-[#3b82f6]'
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-[#71717a]">{r.admin_note || 'Awaiting review'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
