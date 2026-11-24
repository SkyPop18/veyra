import React, { useEffect } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { VeyraProvider, useVeyra } from './context/VeyraContext';
import { LandingPage } from './pages/LandingPage';
import {
  AcceptTermsPage,
  AuthCallbackPage,
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from './pages/AuthPages';
import { PrivacyPolicyPage, TermsPage } from './pages/LegalPages';
import { DashboardShell } from './components/layout/DashboardShell';
import { DashboardHomePage } from './pages/dashboard/DashboardHomePage';
import { ComparePage, LeaderboardPage } from './pages/dashboard/LeaderboardAndComparePages';
import {
  CryptoDetailPage,
  CryptoListPage,
  CurrenciesListPage,
  CurrencyDetailPage,
} from './pages/dashboard/MarketsPages';
import {
  AlertsPage,
  ConverterPage,
  HeatmapPage,
  WatchlistPage,
} from './pages/dashboard/ToolsPages';
import { NewsFeedPage, SavedNewsPage } from './pages/dashboard/NewsPages';
import { AiAnalysisPage } from './pages/dashboard/AiAnalysisPage';
import {
  DiscordSettingsPage,
  GeneralSettingsPage,
  SettingsLayout,
  SubscriptionSettingsPage,
} from './pages/dashboard/SettingsPages';
import {
  AdminApiHealthPage,
  AdminAuditLogPage,
  AdminDiscordPage,
  AdminOverviewPage,
  AdminPaymentsPage,
  AdminShell,
  AdminUsersPage,
} from './pages/admin/AdminConsolePages';

/**
 * Reads the server-injected mount meta ONLY present when the browser navigated
 * directly to the secret ADMIN_BASE_PATH. Never bundled in client JS.
 */
function getServerValidatedAdminBasePath(): string | null {
  if (typeof document === 'undefined') return null;
  const meta = document.querySelector('meta[name="veyra-admin-mount"]');
  const val = meta?.getAttribute('content')?.trim() || '';
  if (val.length >= 24 && val.startsWith('/')) return val;
  // If running in SPA mode on Vercel CDN, match direct navigation to unguessable path
  if (typeof window !== 'undefined') {
    const parts = window.location.pathname.split('/').filter(Boolean);
    if (parts.length > 0 && parts[0].startsWith('vx-') && parts[0].length >= 24) {
      return `/${parts[0]}`;
    }
  }
  return null;
}

function NotFoundPage() {
  return (
    <div className="min-h-screen veyra-bg flex items-center justify-center p-6 text-[#09090b] dark:text-[#fafafa]">
      <div className="glass-surface p-8 sm:p-10 max-w-md w-full text-center space-y-4">
        <p className="font-mono-num text-xs font-semibold text-[#3b82f6]">404</p>
        <h1 className="font-display text-2xl font-bold">Page not found</h1>
        <p className="text-sm text-[#52525b] dark:text-[#a1a1aa]">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white px-5 py-2.5 text-sm font-semibold transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, emailVerified, authLoading } = useVeyra();

  // Display clean non-hanging loader only while cold booting before user session is determined
  if (authLoading && !user) {
    return (
      <div className="min-h-screen veyra-bg flex flex-col items-center justify-center gap-3 text-sm text-[#71717a]">
        <div className="h-6 w-6 rounded-full border-2 border-[#3b82f6] border-t-transparent animate-spin" />
        <span>Verifying session...</span>
      </div>
    );
  }
  if (!user && !authLoading) {
    return <Navigate to="/login" replace />;
  }
  if (!emailVerified && user) {
    return <Navigate to={`/verify-email?email=${encodeURIComponent(user.email)}&mode=signup`} replace />;
  }
  return <>{children}</>;
}

function ConsentGateRoute({ children }: { children: React.ReactNode }) {
  const { user, termsAccepted, authLoading } = useVeyra();
  if (authLoading && !user) {
    return (
      <div className="min-h-screen veyra-bg flex items-center justify-center text-sm text-[#71717a]">
        Loading...
      </div>
    );
  }
  if (!user && !authLoading) return <Navigate to="/login" replace />;
  if (termsAccepted) return <Navigate to="/dashboard/home" replace />;
  return <>{children}</>;
}

function GlobalAuthCodeInterceptor() {
  const navigate = useNavigate();
  const location = useLocation();
  const { passwordRecovery } = useVeyra();

  useEffect(() => {
    if (passwordRecovery && location.pathname !== '/reset-password') {
      navigate(`/reset-password${location.search}${location.hash}`, { replace: true });
      return;
    }

    if (location.pathname !== '/auth/callback' && location.pathname !== '/reset-password') {
      const searchParams = new URLSearchParams(location.search);
      const hasAuthPayload = searchParams.has('code') || location.hash.includes('access_token');
      const isRecoveryPayload =
        searchParams.get('type') === 'recovery' || location.hash.includes('type=recovery');

      if (hasAuthPayload) {
        if (isRecoveryPayload) {
          navigate(`/reset-password${location.search}${location.hash}`, { replace: true });
        } else {
          navigate(`/auth/callback${location.search}${location.hash}`, { replace: true });
        }
      }
    }
  }, [location, navigate, passwordRecovery]);

  return null;
}

export default function App() {
  const hiddenAdminBasePath = getServerValidatedAdminBasePath();

  return (
    <VeyraProvider>
      <BrowserRouter>
        <GlobalAuthCodeInterceptor />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/accept-terms"
            element={
              <ConsentGateRoute>
                <AcceptTermsPage />
              </ConsentGateRoute>
            }
          />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/terms" element={<TermsPage />} />

          {/* Protected Dashboard Routes (Real Supabase Session + Verified Email + Current Terms Consent) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard/home" replace />} />
            <Route path="home" element={<DashboardHomePage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
            <Route path="compare" element={<ComparePage />} />
            <Route path="currencies" element={<CurrenciesListPage />} />
            <Route path="currencies/:code" element={<CurrencyDetailPage />} />
            <Route path="crypto" element={<CryptoListPage />} />
            <Route path="crypto/:id" element={<CryptoDetailPage />} />
            <Route path="converter" element={<ConverterPage />} />
            <Route path="heatmap" element={<HeatmapPage />} />
            <Route path="watchlist" element={<WatchlistPage />} />
            <Route path="alerts" element={<AlertsPage />} />
            <Route path="news" element={<NewsFeedPage />} />
            <Route path="news/saved" element={<SavedNewsPage />} />
            <Route path="news/:category" element={<NewsFeedPage />} />
            <Route path="ai-analysis" element={<AiAnalysisPage />} />
            <Route path="settings" element={<SettingsLayout />}>
              <Route index element={<GeneralSettingsPage />} />
              <Route path="discord" element={<DiscordSettingsPage />} />
              <Route path="subscription" element={<SubscriptionSettingsPage />} />
            </Route>
          </Route>

          {/* Hidden Admin Console: mounted ONLY when server validated secret ADMIN_BASE_PATH */}
          {hiddenAdminBasePath && (
            <Route path={hiddenAdminBasePath} element={<AdminShell basePath={hiddenAdminBasePath} />}>
              <Route index element={<AdminOverviewPage />} />
              <Route path="login" element={<AdminOverviewPage />} />
              <Route path="users" element={<AdminUsersPage />} />
              <Route path="payments" element={<AdminPaymentsPage />} />
              <Route path="api-keys" element={<AdminApiHealthPage />} />
              <Route path="discord" element={<AdminDiscordPage />} />
              <Route path="audit-log" element={<AdminAuditLogPage />} />
            </Route>
          )}

          {/* Standard 404 for unknown paths (including /admin and /admin/*) */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </VeyraProvider>
  );
}
