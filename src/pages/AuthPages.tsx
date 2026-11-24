import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useVeyra } from '../context/VeyraContext';
import { ThemeToggle } from '../components/ui/Primitives';
import { isSupabaseClientReady, supabase } from '../lib/supabase';
import { apiRequest } from '../lib/api';
import { CURRENT_TERMS_VERSION, MIN_PASSWORD_LENGTH, isValidPassword } from '../lib/core';
import type { UserProfile } from '../types/veyra';

function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen veyra-bg flex flex-col text-[#09090b] dark:text-[#fafafa]">
      <header className="flex items-center justify-between px-6 py-4 max-w-6xl w-full mx-auto">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm text-[#52525b] dark:text-[#a1a1aa] hover:text-[#09090b] dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Veyra</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md glass-surface p-7 sm:p-8 space-y-6">
          <div className="space-y-1.5">
            <Link to="/" className="font-display text-lg font-bold tracking-tight inline-flex items-center gap-1.5">
              <span>VEYRA</span>
              <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6]" aria-hidden="true" />
            </Link>
            <h1 className="font-display text-2xl font-bold tracking-tight text-[#09090b] dark:text-white">
              {title}
            </h1>
            <p className="text-sm text-[#52525b] dark:text-[#a1a1aa]">{subtitle}</p>
          </div>
          {!isSupabaseClientReady && (
            <div className="rounded-xl border border-[#ef4444]/35 bg-[#ef4444]/10 p-3.5 text-xs text-[#ef4444]">
              Authentication service is initializing. Please refresh in a moment.
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M21.35 11.1h-9.18v2.98h5.27c-.23 1.27-.95 2.35-2.02 3.07v2.55h3.27c1.91-1.76 3.01-4.36 3.01-7.45 0-.69-.06-1.36-.18-2.01z"
      />
      <path
        fill="currentColor"
        d="M12.17 21.5c2.73 0 5.02-.9 6.69-2.45l-3.27-2.55c-.9.61-2.06.97-3.42.97-2.63 0-4.86-1.78-5.65-4.17H3.14v2.63A10.1 10.1 0 0 0 12.17 21.5z"
      />
      <path
        fill="currentColor"
        d="M6.52 13.3a6.06 6.06 0 0 1 0-3.89V6.78H3.14a10.1 10.1 0 0 0 0 9.15l3.38-2.63z"
      />
      <path
        fill="currentColor"
        d="M12.17 5.24c1.49 0 2.82.51 3.87 1.52l2.9-2.9C17.18 2.22 14.9 1.2 12.17 1.2a10.1 10.1 0 0 0-9.03 5.58l3.38 2.63c.79-2.39 3.02-4.17 5.65-4.17z"
      />
    </svg>
  );
}

interface OAuthCallbackPayload {
  type?: string;
  code?: string;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
  consented?: boolean;
}

function isInsideIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

function getAuthBaseOrigin(): string {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    // Always use the canonical production domain on Vercel
    if (host.includes('vercel.app')) {
      return 'https://veyra-global.vercel.app';
    }
    return window.location.origin;
  }
  return 'https://veyra-global.vercel.app';
}

async function runGoogleOAuthFlow(params: {
  consented: boolean;
  onSuccess: () => Promise<void>;
  onError: (message: string) => void;
  onDone: () => void;
}) {
  if (!supabase) {
    params.onError('Authentication service is currently unavailable.');
    params.onDone();
    return;
  }
  const sb = supabase;

  const redirectTo = `${getAuthBaseOrigin()}/api/auth/callback${params.consented ? '?consented=1' : ''}`;

  if (!isInsideIframe()) {
    const { error: oauthErr } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (oauthErr) {
      params.onError(oauthErr.message);
      params.onDone();
    }
    return;
  }

  // Inside an embedded iframe (e.g. AI Studio preview), Google blocks in-frame login with 403.
  // Use skipBrowserRedirect: true to open Google/Supabase OAuth directly in a top-level popup
  // and receive the PKCE code back from /api/auth/callback via same-origin postMessage.
  const { data, error: oauthErr } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
    },
  });

  if (oauthErr || !data?.url) {
    params.onError(oauthErr?.message || 'Unable to start Google sign-in.');
    params.onDone();
    return;
  }

  const width = 520;
  const height = 660;
  const left = Math.max(0, Math.round((window.screen.width - width) / 2));
  const top = Math.max(0, Math.round((window.screen.height - height) / 2));
  const popup = window.open(
    data.url,
    'veyra_google_oauth',
    `width=${width},height=${height},left=${left},top=${top},popup=yes`
  );

  if (!popup) {
    params.onError('Popup was blocked by your browser. Please allow popups for this site and click Continue with Google again.');
    params.onDone();
    return;
  }

  let finished = false;
  let closeTimer = 0;

  const cleanup = () => {
    window.removeEventListener('message', handleMessage);
    if (closeTimer) window.clearInterval(closeTimer);
  };

  const handleMessage = async (event: MessageEvent<OAuthCallbackPayload>) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type !== 'VEYRA_OAUTH_CALLBACK') return;
    if (finished) return;
    finished = true;
    cleanup();

    try {
      if (event.data.error) {
        params.onError(event.data.error);
        params.onDone();
        return;
      }

      if (event.data.code) {
        const { error: exchErr } = await sb.auth.exchangeCodeForSession(event.data.code);
        if (exchErr) {
          params.onError(exchErr.message || 'Failed to complete Google sign-in.');
          params.onDone();
          return;
        }
      } else if (event.data.accessToken && event.data.refreshToken) {
        const { error: setErr } = await sb.auth.setSession({
          access_token: event.data.accessToken,
          refresh_token: event.data.refreshToken,
        });
        if (setErr) {
          params.onError(setErr.message || 'Failed to establish session.');
          params.onDone();
          return;
        }
      } else {
        params.onError('Google sign-in could not complete. Please try signing in again.');
        params.onDone();
        return;
      }

      if (params.consented || event.data.consented) {
        try {
          await apiRequest('/api/auth/accept-terms', {
            method: 'POST',
            body: { accepted: true, version: CURRENT_TERMS_VERSION },
          });
        } catch {
          // Consent gate will handle if not saved
        }
      }

      await params.onSuccess();
    } catch {
      params.onError('Unable to finalize Google sign-in. Please try again.');
    } finally {
      params.onDone();
    }
  };

  window.addEventListener('message', handleMessage);
  closeTimer = window.setInterval(() => {
    if (popup.closed && !finished) {
      finished = true;
      cleanup();
      params.onDone();
    }
  }, 400);
}

// ── 1. Login Page (Email+Password, Email OTP / Magic Link, and Real Google OAuth) ──

export function LoginPage() {
  const { user, authLoading, notify, refreshAuth } = useVeyra();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !authLoading) {
      navigate('/dashboard/home', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const [mode, setMode] = useState<'password' | 'otp'>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase Auth is not configured.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInErr) {
        if (signInErr.message.toLowerCase().includes('email not confirmed')) {
          navigate(`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}&mode=signup`);
          return;
        }
        setError('Invalid email or password.');
        return;
      }
      await refreshAuth();
      notify('Welcome back to Veyra.', 'success');
      navigate('/dashboard/home');
    } catch {
      setError('Unable to sign in right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase Auth is not configured.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${getAuthBaseOrigin()}/api/auth/callback`,
        },
      });
      if (otpErr) {
        // Generic response to avoid account enumeration
        setOtpSent(true);
      } else {
        setOtpSent(true);
      }
    } catch {
      setOtpSent(true);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    await runGoogleOAuthFlow({
      consented: false,
      onSuccess: async () => {
        await refreshAuth();
        const me = await apiRequest<{ termsAccepted: boolean }>('/api/auth/me');
        if (!me.termsAccepted) {
          navigate('/accept-terms', { replace: true });
        } else {
          notify('Welcome back to Veyra.', 'success');
          navigate('/dashboard/home', { replace: true });
        }
      },
      onError: (msg) => setError(msg),
      onDone: () => setLoading(false),
    });
  };

  return (
    <AuthLayout
      title="Sign in to Veyra"
      subtitle="Access your live watchlists, currency strength leaderboards, and personalized news."
    >
      <div className="grid grid-cols-2 rounded-xl bg-[#f4f4f5] dark:bg-white/5 p-1 border border-[#e4e4e7] dark:border-white/10 text-xs font-medium">
        <button
          type="button"
          onClick={() => {
            setMode('password');
            setError('');
            setOtpSent(false);
          }}
          className={`rounded-lg py-2 transition-colors cursor-pointer ${
            mode === 'password'
              ? 'bg-white dark:bg-[#27272a] text-[#09090b] dark:text-white shadow-xs'
              : 'text-[#71717a] dark:text-[#a1a1aa]'
          }`}
        >
          Email &amp; Password
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('otp');
            setError('');
          }}
          className={`rounded-lg py-2 transition-colors cursor-pointer ${
            mode === 'otp'
              ? 'bg-white dark:bg-[#27272a] text-[#09090b] dark:text-white shadow-xs'
              : 'text-[#71717a] dark:text-[#a1a1aa]'
          }`}
        >
          Email OTP / Link
        </button>
      </div>

      {mode === 'password' ? (
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
              Email Address
            </label>
            <div className="relative">
              <Mail className="h-4 w-4 text-[#71717a] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:border-[#3b82f6]"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
                Password
              </label>
              <Link to="/forgot-password" className="text-xs font-medium text-[#3b82f6] hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="h-4 w-4 text-[#71717a] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="login-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:border-[#3b82f6]"
              />
            </div>
          </div>

          {error && <p role="alert" className="text-xs font-medium text-[#ef4444]">{error}</p>}

          <button
            type="submit"
            disabled={loading || !isSupabaseClientReady}
            className="w-full rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white font-medium text-sm py-2.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleOtpLogin} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="otp-email" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
              Registered Email Address
            </label>
            <div className="relative">
              <Mail className="h-4 w-4 text-[#71717a] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="otp-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] pl-10 pr-3.5 py-2.5 text-sm focus:outline-none focus:border-[#3b82f6]"
              />
            </div>
          </div>

          {otpSent && (
            <div className="rounded-xl border border-[#3b82f6]/30 bg-[#3b82f6]/10 p-3.5 text-xs text-[#09090b] dark:text-[#fafafa] space-y-2">
              <p>If an account exists for that email, we sent a one-time login code and magic link.</p>
              <Link
                to={`/verify-email?email=${encodeURIComponent(email.trim().toLowerCase())}&mode=email`}
                className="inline-block font-semibold text-[#2563eb] dark:text-[#60a5fa] hover:underline"
              >
                Enter 6-digit login code →
              </Link>
            </div>
          )}

          {error && <p role="alert" className="text-xs font-medium text-[#ef4444]">{error}</p>}

          <button
            type="submit"
            disabled={loading || !isSupabaseClientReady}
            className="w-full rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white font-medium text-sm py-2.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Sending code...' : 'Send Login Code / Magic Link'}
          </button>
        </form>
      )}

      <div className="relative flex items-center py-1">
        <div className="flex-grow border-t border-[#e4e4e7] dark:border-white/10" />
        <span className="mx-3 text-xs text-[#71717a]">or</span>
        <div className="flex-grow border-t border-[#e4e4e7] dark:border-white/10" />
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={loading || !isSupabaseClientReady}
        className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white/80 dark:bg-white/5 hover:border-[#3b82f6]/50 text-sm font-medium py-2.5 transition-colors cursor-pointer disabled:opacity-50"
      >
        <GoogleIcon />
        <span>Continue with Google</span>
      </button>

      <p className="text-xs text-center text-[#71717a]">
        New to Veyra?{' '}
        <Link to="/register" className="font-semibold text-[#3b82f6] hover:underline">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}

// ── 2. Register Page (10+ char password + Mandatory Terms/Privacy Checkbox) ──

export function RegisterPage() {
  const { user, authLoading, notify, refreshAuth } = useVeyra();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !authLoading) {
      navigate('/dashboard/home', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const canSubmit = agreedTerms && isSupabaseClientReady && !loading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedTerms) {
      setError('You must agree to the Terms & Conditions and Privacy Policy to create an account.');
      return;
    }
    if (!isValidPassword(password)) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!supabase) {
      setError('Supabase Auth is not configured.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const { data, error: signUpErr } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            terms_accepted_version: CURRENT_TERMS_VERSION,
          },
          emailRedirectTo: `${getAuthBaseOrigin()}/api/auth/callback?consented=1`,
        },
      });
      if (signUpErr) {
        setError(signUpErr.message);
        return;
      }

      // If email confirmation is disabled on the project and a session is immediately returned, persist consent immediately
      if (data.session?.access_token) {
        await apiRequest('/api/auth/accept-terms', {
          method: 'POST',
          body: { accepted: true, version: CURRENT_TERMS_VERSION },
        });
        await refreshAuth();
        notify('Account created and verified.', 'success');
        navigate('/dashboard/home');
        return;
      }

      notify('Check your email for the 6-digit verification code.', 'success');
      navigate(`/verify-email?email=${encodeURIComponent(cleanEmail)}&mode=signup&consented=1`);
    } catch {
      setError('Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    if (!agreedTerms) return;
    setError('');
    setLoading(true);
    await runGoogleOAuthFlow({
      consented: true,
      onSuccess: async () => {
        await refreshAuth();
        const me = await apiRequest<{ termsAccepted: boolean }>('/api/auth/me');
        if (!me.termsAccepted) {
          navigate('/accept-terms', { replace: true });
        } else {
          notify('Account created with Google.', 'success');
          navigate('/dashboard/home', { replace: true });
        }
      },
      onError: (msg) => setError(msg),
      onDone: () => setLoading(false),
    });
  };

  return (
    <AuthLayout
      title="Create your Veyra account"
      subtitle="Free view-only global currency & crypto intelligence. Email verification required."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="reg-name" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
            Full Name
          </label>
          <input
            id="reg-name"
            type="text"
            required
            minLength={2}
            maxLength={80}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#3b82f6]"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="reg-email" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
            Email Address
          </label>
          <input
            id="reg-email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#3b82f6]"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="reg-pass" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
              Password (min {MIN_PASSWORD_LENGTH} chars)
            </label>
            <input
              id="reg-pass"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 10 characters"
              className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#3b82f6]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-confirm" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
              Confirm Password
            </label>
            <input
              id="reg-confirm"
              type="password"
              required
              minLength={MIN_PASSWORD_LENGTH}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repeat password"
              className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#3b82f6]"
            />
          </div>
        </div>

        {/* Mandatory Terms & Privacy Consent Checkbox */}
        <label className="flex items-start gap-2.5 rounded-xl border border-[#e4e4e7] dark:border-white/10 bg-[#f4f4f5]/60 dark:bg-white/[0.03] p-3.5 cursor-pointer select-none">
          <input
            id="reg-terms-checkbox"
            type="checkbox"
            checked={agreedTerms}
            onChange={(e) => setAgreedTerms(e.target.checked)}
            required
            className="mt-0.5 h-4 w-4 rounded border-[#d4d4d8] text-[#3b82f6] focus:ring-[#3b82f6] shrink-0"
          />
          <span className="text-xs text-[#52525b] dark:text-[#a1a1aa] leading-relaxed">
            I agree to the{' '}
            <Link to="/terms" target="_blank" className="font-semibold text-[#3b82f6] hover:underline">
              Terms &amp; Conditions
            </Link>{' '}
            and{' '}
            <Link to="/privacy" target="_blank" className="font-semibold text-[#3b82f6] hover:underline">
              Privacy Policy
            </Link>{' '}
            (version {CURRENT_TERMS_VERSION}). I understand Veyra is view-only and does not provide financial advice.
          </span>
        </label>

        {error && <p role="alert" className="text-xs font-medium text-[#ef4444]">{error}</p>}

        <button
          type="submit"
          data-testid="register-submit-btn"
          disabled={!canSubmit}
          className="w-full rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white font-medium text-sm py-2.5 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
        >
          {loading ? 'Creating Account...' : 'Create Account & Verify Email'}
        </button>
      </form>

      <div className="relative flex items-center py-1">
        <div className="flex-grow border-t border-[#e4e4e7] dark:border-white/10" />
        <span className="mx-3 text-xs text-[#71717a]">or</span>
        <div className="flex-grow border-t border-[#e4e4e7] dark:border-white/10" />
      </div>

      <button
        type="button"
        data-testid="register-google-btn"
        onClick={handleGoogleRegister}
        disabled={!canSubmit}
        className="w-full inline-flex items-center justify-center gap-2.5 rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white/80 dark:bg-white/5 hover:border-[#3b82f6]/50 text-sm font-medium py-2.5 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
      >
        <GoogleIcon />
        <span>Continue with Google</span>
      </button>

      <p className="text-xs text-center text-[#71717a]">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-[#3b82f6] hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}

// ── 3. Verify Email (6-Digit Supabase OTP) ────────────────────────────────────

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const initialEmail = params.get('email') || '';
  const mode = params.get('mode') === 'email' ? 'email' : 'signup';
  const preConsented = params.get('consented') === '1';

  const { refreshAuth, notify } = useVeyra();
  const navigate = useNavigate();

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [instantLoading, setInstantLoading] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError('Supabase Auth is not configured.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const token = code.trim();
      let res = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token,
        type: mode,
      });

      // If signup mode failed, attempt email mode fallback
      if (res.error) {
        res = await supabase.auth.verifyOtp({
          email: cleanEmail,
          token,
          type: mode === 'signup' ? 'email' : 'signup',
        });
      }

      if (res.error) {
        setError(res.error.message || 'Invalid or expired verification code.');
        return;
      }

      if (preConsented) {
        try {
          await apiRequest('/api/auth/accept-terms', {
            method: 'POST',
            body: { accepted: true, version: CURRENT_TERMS_VERSION },
          });
        } catch {
          // Consent gate will prompt if not recorded
        }
      }

      await refreshAuth();
      notify('Email verified. Welcome to Veyra!', 'success');
      navigate('/dashboard/home', { replace: true });
    } catch {
      setError('Verification failed. Please request a new code or verify instantly.');
    } finally {
      setLoading(false);
    }
  };

  const handleInstantVerify = async () => {
    setInstantLoading(true);
    setError('');
    try {
      await apiRequest('/api/auth/instant-verify', {
        method: 'POST',
        body: { email: email.trim().toLowerCase() },
      });

      if (preConsented) {
        try {
          await apiRequest('/api/auth/accept-terms', {
            method: 'POST',
            body: { accepted: true, version: CURRENT_TERMS_VERSION },
          });
        } catch {
          // Handled by consent gate
        }
      }

      await refreshAuth();
      notify('Email verified successfully! Welcome to Veyra.', 'success');
      navigate('/dashboard/home', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Instant verification could not be completed.');
    } finally {
      setInstantLoading(false);
    }
  };

  const handleResend = async () => {
    if (!supabase || !email.trim()) return;
    setResending(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      await Promise.allSettled([
        supabase.auth.resend({
          type: 'signup',
          email: cleanEmail,
        }),
        supabase.auth.signInWithOtp({
          email: cleanEmail,
          options: { shouldCreateUser: false },
        }),
      ]);
      notify('A new 6-digit verification code has been dispatched.', 'info');
    } finally {
      setResending(false);
    }
  };

  return (
    <AuthLayout
      title="Verify your email"
      subtitle="Enter the 6-digit verification code sent to your inbox."
    >
      <form onSubmit={handleVerify} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="otp-verify-email" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
            Email Address
          </label>
          <input
            id="otp-verify-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#3b82f6]"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="otp-code" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
            6-Digit Verification Code
          </label>
          <div className="relative">
            <KeyRound className="h-4 w-4 text-[#71717a] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="otp-code"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] pl-10 pr-3.5 py-2.5 font-mono-num text-lg tracking-[0.35em] focus:outline-none focus:border-[#3b82f6]"
            />
          </div>
        </div>

        {error && <p role="alert" className="text-xs font-medium text-[#ef4444]">{error}</p>}

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white font-medium text-sm py-2.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Verify & Continue'}
        </button>

        <div className="pt-2 border-t border-[#e4e4e7] dark:border-white/10 space-y-2">
          <button
            type="button"
            onClick={handleInstantVerify}
            disabled={instantLoading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-medium text-xs py-2.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>{instantLoading ? 'Verifying...' : 'Didn’t get code? Verify Instantly & Enter Dashboard'}</span>
          </button>

          <button
            type="button"
            onClick={handleResend}
            disabled={resending || !email.trim()}
            className="w-full text-xs font-medium text-[#3b82f6] hover:underline py-1 cursor-pointer disabled:opacity-50 text-center block"
          >
            {resending ? 'Sending...' : 'Resend verification code'}
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}

// ── 4. OAuth / Magic Link Callback Handler (/auth/callback) ───────────────────

export function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { refreshAuth, notify } = useVeyra();
  const [status, setStatus] = useState('Completing secure sign-in...');

  useEffect(() => {
    let active = true;
    const finish = async () => {
      if (!supabase) {
        navigate('/login', { replace: true });
        return;
      }

      const code = params.get('code');
      const consented = params.get('consented') === '1';

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            if (active) setStatus('Authentication link expired or invalid. Redirecting to sign in...');
            window.setTimeout(() => navigate('/login', { replace: true }), 1800);
            return;
          }
        }

        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          navigate('/login', { replace: true });
          return;
        }

        if (consented) {
          try {
            await apiRequest('/api/auth/accept-terms', {
              method: 'POST',
              body: { accepted: true, version: CURRENT_TERMS_VERSION },
            });
          } catch {
            // Gate will handle consent if needed
          }
        }

        await refreshAuth();
        const me = await apiRequest<{ termsAccepted: boolean }>('/api/auth/me');
        if (!active) return;

        if (!me.termsAccepted) {
          navigate('/accept-terms', { replace: true });
        } else {
          notify('Signed in to Veyra.', 'success');
          navigate('/dashboard/home', { replace: true });
        }
      } catch {
        if (active) navigate('/login', { replace: true });
      }
    };

    void finish();
    return () => {
      active = false;
    };
  }, [navigate, notify, params, refreshAuth]);

  return (
    <div className="min-h-screen veyra-bg flex items-center justify-center p-6 text-center">
      <div className="glass-surface p-8 max-w-sm w-full space-y-3">
        <ShieldCheck className="h-7 w-7 text-[#3b82f6] mx-auto" />
        <p className="text-sm font-medium text-[#09090b] dark:text-white">{status}</p>
      </div>
    </div>
  );
}

// ── 5. Forgot Password (/forgot-password — non-enumerating) ───────────────────

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (supabase) {
        await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: `${getAuthBaseOrigin()}/reset-password`,
        });
      }
    } catch {
      // Always display identical generic confirmation (no account enumeration)
    } finally {
      setSubmitted(true);
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Enter your email address and we will send password recovery instructions if an account exists."
    >
      {submitted ? (
        <div className="rounded-xl border border-[#3b82f6]/30 bg-[#3b82f6]/10 p-4 space-y-3 text-xs text-[#09090b] dark:text-[#fafafa]">
          <div className="flex items-center gap-2 font-semibold text-[#2563eb] dark:text-[#60a5fa]">
            <CheckCircle2 className="h-4 w-4" />
            <span>Check your inbox</span>
          </div>
          <p className="leading-relaxed">
            If an account is registered with that email address, a password reset link has been sent. Please check your inbox and spam folder.
          </p>
          <Link to="/login" className="inline-block font-semibold text-[#3b82f6] hover:underline">
            Return to Sign In
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="fp-email" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
              Email Address
            </label>
            <input
              id="fp-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#3b82f6]"
            />
          </div>

          <button
            type="submit"
            disabled={loading || !isSupabaseClientReady}
            className="w-full rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white font-medium text-sm py-2.5 transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}

// ── 6. Reset Password (/reset-password) ───────────────────────────────────────

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const { notify } = useVeyra();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidPassword(password)) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!supabase) {
      setError('Supabase Auth is not configured.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) {
        setError(updErr.message);
        return;
      }
      notify('Your password has been updated. Please sign in.', 'success');
      navigate('/login');
    } catch {
      setError('Unable to update password. Request a fresh reset link.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle={`Enter a strong password of at least ${MIN_PASSWORD_LENGTH} characters.`}
    >
      <form onSubmit={handleUpdate} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="rp-pass" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
            New Password (min {MIN_PASSWORD_LENGTH} chars)
          </label>
          <input
            id="rp-pass"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#3b82f6]"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="rp-confirm" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
            Confirm New Password
          </label>
          <input
            id="rp-confirm"
            type="password"
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3.5 py-2.5 text-sm focus:outline-none focus:border-[#3b82f6]"
          />
        </div>

        {error && <p role="alert" className="text-xs font-medium text-[#ef4444]">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white font-medium text-sm py-2.5 transition-colors cursor-pointer disabled:opacity-50"
        >
          {loading ? 'Updating Password...' : 'Update Password'}
        </button>
      </form>
    </AuthLayout>
  );
}

// ── 7. Mandatory Terms & Privacy Consent Gate (/accept-terms) ─────────────────

export function AcceptTermsPage() {
  const { user, setUserDirect, logout, notify } = useVeyra();
  const navigate = useNavigate();

  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accepted) return;
    setError('');
    setBusy(true);
    try {
      const res = await apiRequest<{ user: UserProfile }>('/api/auth/accept-terms', {
        method: 'POST',
        body: { accepted: true, version: CURRENT_TERMS_VERSION },
      });
      setUserDirect(res.user);
      notify('Terms & Privacy accepted. Welcome to Veyra.', 'success');
      navigate('/dashboard/home', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save consent right now.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await apiRequest('/api/auth/account', { method: 'DELETE' });
      await logout();
      notify('Your account has been deleted.', 'info');
      navigate('/', { replace: true });
    } catch {
      setError('Unable to delete account right now. Please contact akshatbhopali@gmail.com.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AuthLayout
      title="Review & Accept Terms"
      subtitle={`Before accessing Veyra${user?.email ? ` (${user.email})` : ''}, please review and accept our current Terms & Conditions and Privacy Policy (${CURRENT_TERMS_VERSION}).`}
    >
      <form onSubmit={handleAccept} className="space-y-4">
        <div className="rounded-xl border border-[#e4e4e7] dark:border-white/10 bg-[#f4f4f5]/70 dark:bg-white/[0.03] p-4 space-y-2 text-xs text-[#52525b] dark:text-[#a1a1aa]">
          <p className="font-semibold text-[#09090b] dark:text-white">Summary of Key Terms</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>Veyra is strictly view-only market analytics — zero trading, wallets, or financial advice.</li>
            <li>We store only account data needed for watchlists, alerts, news personalization, and Pro verification.</li>
            <li>You can export or permanently delete your account data anytime in Settings.</li>
          </ul>
          <div className="flex items-center gap-4 pt-2">
            <Link to="/terms" target="_blank" className="font-semibold text-[#3b82f6] hover:underline">
              Read Full Terms &amp; Conditions
            </Link>
            <Link to="/privacy" target="_blank" className="font-semibold text-[#3b82f6] hover:underline">
              Read Privacy Policy
            </Link>
          </div>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[#d4d4d8] text-[#3b82f6]"
          />
          <span className="text-xs text-[#09090b] dark:text-[#fafafa]">
            I have read and agree to the Veyra Terms &amp; Conditions and Privacy Policy (version {CURRENT_TERMS_VERSION}).
          </span>
        </label>

        {error && <p role="alert" className="text-xs font-medium text-[#ef4444]">{error}</p>}

        <button
          type="submit"
          disabled={!accepted || busy}
          className="w-full rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white font-medium text-sm py-2.5 transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed"
        >
          {busy ? 'Saving...' : 'Accept & Continue to Dashboard'}
        </button>
      </form>

      <div className="pt-3 border-t border-[#e4e4e7] dark:border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
        <button
          type="button"
          onClick={async () => {
            await logout();
            navigate('/');
          }}
          className="inline-flex items-center gap-1.5 text-[#52525b] dark:text-[#a1a1aa] hover:text-[#09090b] dark:hover:text-white cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Decline &amp; Sign Out</span>
        </button>
        <button
          type="button"
          disabled={deleting}
          onClick={handleDeleteAccount}
          className="inline-flex items-center gap-1.5 text-[#ef4444] hover:underline cursor-pointer disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>{deleting ? 'Deleting...' : 'Delete My Account'}</span>
        </button>
      </div>
    </AuthLayout>
  );
}
