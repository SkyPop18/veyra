import React, { useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  ArrowLeftRight,
  Bell,
  Bookmark,
  ChevronRight,
  Coins,
  Crown,
  Globe2,
  Home,
  LogOut,
  Menu,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Scale,
  Settings,
  Star,
  Trophy,
  X,
} from 'lucide-react';
import { useVeyra } from '../../context/VeyraContext';
import { PriceTicker, ThemeToggle } from '../ui/Primitives';
import { OnboardingModal } from '../OnboardingModal';
import { cn } from '../../lib/cn';
import { isProSubscriptionActive } from '../../lib/core';

interface NavItem {
  label: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  matchPrefix?: boolean;
}

const PRIMARY_NAV: NavItem[] = [
  { label: 'Home', to: '/dashboard/home', icon: Home },
  { label: 'Leaderboard', to: '/dashboard/leaderboard', icon: Trophy },
  { label: 'Currencies', to: '/dashboard/currencies', icon: Coins, matchPrefix: true },
  { label: 'Crypto', to: '/dashboard/crypto', icon: Activity, matchPrefix: true },
  { label: 'Compare', to: '/dashboard/compare', icon: Scale },
  { label: 'Converter', to: '/dashboard/converter', icon: ArrowLeftRight },
  { label: 'Heatmap', to: '/dashboard/heatmap', icon: Globe2 },
];

const PERSONAL_NAV: NavItem[] = [
  { label: 'Watchlist', to: '/dashboard/watchlist', icon: Star },
  { label: 'Price Alerts', to: '/dashboard/alerts', icon: Bell },
  { label: 'News Feed', to: '/dashboard/news', icon: Newspaper },
  { label: 'Saved News', to: '/dashboard/news/saved', icon: Bookmark },
  { label: 'AI Analysis', to: '/dashboard/ai-analysis', icon: Activity },
  { label: 'Settings', to: '/dashboard/settings', icon: Settings, matchPrefix: true },
];

function getBreadcrumbLabel(pathname: string): string {
  const parts = pathname.replace(/^\/dashboard\/?/, '').split('/').filter(Boolean);
  if (parts.length === 0) return 'Home';
  return parts
    .map((p) => p.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
    .join(' / ');
}

export function DashboardShell() {
  const { user, logout } = useVeyra();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('veyra_sidebar_collapsed') === 'true';
  });

  const toggleDesktopSidebar = () => {
    setDesktopCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('veyra_sidebar_collapsed', String(next));
      return next;
    });
  };

  const isPro = isProSubscriptionActive(user);

  const isActive = (item: NavItem) => {
    if (item.to === '/dashboard/news') {
      return location.pathname === '/dashboard/news';
    }
    if (item.matchPrefix) {
      return location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
    }
    return location.pathname === item.to;
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const sidebarContent = (
    <div className="flex h-full flex-col justify-between p-4">
      <div className="space-y-6 overflow-y-auto pr-1">
        <div className="flex items-center justify-between px-2 pt-1">
          <Link
            to="/"
            className="font-display text-xl font-bold tracking-tight text-[#09090b] dark:text-white whitespace-nowrap inline-flex items-center gap-1.5"
          >
            <span>VEYRA</span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6]" aria-hidden="true" />
          </Link>
          <button
            type="button"
            onClick={toggleDesktopSidebar}
            aria-label="Hide sidebar panel"
            className="hidden lg:inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#71717a] hover:text-[#09090b] dark:hover:text-white hover:bg-[#f4f4f5] dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        <nav aria-label="Market Intelligence" className="space-y-1">
          <p className="px-2.5 pb-1 text-[11px] font-medium text-[#71717a] dark:text-[#a1a1aa]">
            Markets
          </p>
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                  active
                    ? 'bg-[#3b82f6]/12 text-[#2563eb] dark:bg-[#3b82f6]/15 dark:text-[#60a5fa]'
                    : 'text-[#52525b] dark:text-[#a1a1aa] hover:bg-[#f4f4f5] dark:hover:bg-white/5 hover:text-[#09090b] dark:hover:text-white'
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <nav aria-label="Workspace" className="space-y-1">
          <p className="px-2.5 pb-1 text-[11px] font-medium text-[#71717a] dark:text-[#a1a1aa]">
            Workspace
          </p>
          {PERSONAL_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item);
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium transition-colors whitespace-nowrap',
                  active
                    ? 'bg-[#3b82f6]/12 text-[#2563eb] dark:bg-[#3b82f6]/15 dark:text-[#60a5fa]'
                    : 'text-[#52525b] dark:text-[#a1a1aa] hover:bg-[#f4f4f5] dark:hover:bg-white/5 hover:text-[#09090b] dark:hover:text-white'
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-4 pt-4 border-t border-[#e4e4e7] dark:border-white/10 space-y-3">
        {!isPro && (
          <Link
            to="/dashboard/settings/subscription"
            onClick={() => setMobileOpen(false)}
            className="block rounded-xl border border-[#3b82f6]/30 bg-[#3b82f6]/8 p-3 hover:bg-[#3b82f6]/12 transition-colors"
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-[#2563eb] dark:text-[#60a5fa]">
              <Crown className="h-3.5 w-3.5" />
              <span>Upgrade to Veyra Pro</span>
            </div>
            <p className="mt-1 text-xs text-[#52525b] dark:text-[#a1a1aa]">
              Unlock Pro AI market intelligence · ₹200/mo
            </p>
          </Link>
        )}

        <div className="flex items-center justify-between gap-3 px-1 pt-1">
          <div className="flex items-center gap-2.5 min-w-0">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.full_name || 'Profile'}
                className="h-8 w-8 rounded-full object-cover border border-[#3b82f6]/30 shadow-xs shrink-0"
              />
            ) : (
              <div className="relative h-8 w-8 rounded-full bg-gradient-to-tr from-[#2563eb] to-[#60a5fa] text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0 select-none">
                {(user?.full_name || user?.email || 'A').charAt(0).toUpperCase()}
                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#09090b]" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#09090b] dark:text-[#fafafa] truncate">
                {user?.full_name || 'Analyst'}
              </p>
              <p className="text-xs text-[#71717a] dark:text-[#a1a1aa] truncate flex items-center gap-1.5">
                <span className={cn(
                  "inline-block h-1.5 w-1.5 rounded-full",
                  isPro ? "bg-amber-400" : "bg-blue-400"
                )} />
                <span>{isPro ? 'Pro Member' : 'Free Tier'}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sign out"
            title="Sign out"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#71717a] hover:text-[#09090b] dark:hover:text-white hover:bg-[#f4f4f5] dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen veyra-bg flex text-[#09090b] dark:text-[#fafafa]">
      {/* Desktop Sidebar (Hide / Show Toggleable) */}
      <aside
        className={cn(
          "hidden lg:block shrink-0 border-r border-[#e4e4e7] dark:border-white/10 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-xl sticky top-0 h-screen transition-all duration-300 ease-in-out overflow-hidden z-20",
          desktopCollapsed ? "w-0 border-r-0 opacity-0 pointer-events-none" : "w-64 opacity-100"
        )}
      >
        <div className="w-64 h-full">
          {sidebarContent}
        </div>
      </aside>

      {/* Mobile Slide-Over Sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[85vw] bg-white dark:bg-[#09090b] border-r border-[#e4e4e7] dark:border-white/10 h-full z-10">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation menu"
              className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#52525b] dark:text-[#a1a1aa] hover:bg-[#f4f4f5] dark:hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Viewport */}
      <div className="flex-1 min-w-0 flex flex-col">
        <PriceTicker />

        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[#e4e4e7] dark:border-white/10 bg-white/80 dark:bg-[#09090b]/80 backdrop-blur-xl px-4 sm:px-6 h-14">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Mobile toggle */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#e4e4e7] dark:border-white/10 text-[#52525b] dark:text-[#a1a1aa]"
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Desktop show / hide sidebar button */}
            <button
              type="button"
              onClick={toggleDesktopSidebar}
              aria-label={desktopCollapsed ? "Show sidebar panel" : "Hide sidebar panel"}
              title={desktopCollapsed ? "Show sidebar panel" : "Hide sidebar panel"}
              className="hidden lg:inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#e4e4e7] dark:border-white/10 text-[#52525b] dark:text-[#a1a1aa] hover:bg-[#f4f4f5] dark:hover:bg-white/10 hover:text-[#09090b] dark:hover:text-white transition-colors cursor-pointer"
            >
              {desktopCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
            <div className="flex items-center gap-1.5 text-sm text-[#71717a] dark:text-[#a1a1aa] truncate">
              <span className="hidden sm:inline">Veyra</span>
              <ChevronRight className="hidden sm:inline h-3.5 w-3.5 shrink-0" />
              <span className="font-medium text-[#09090b] dark:text-[#fafafa] truncate">
                {getBreadcrumbLabel(location.pathname)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              to="/dashboard/compare"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[#e4e4e7] dark:border-white/10 bg-white/80 dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-[#09090b] dark:text-[#fafafa] hover:border-[#3b82f6]/40 transition-colors whitespace-nowrap"
            >
              <Scale className="h-3.5 w-3.5 text-[#3b82f6]" />
              <span>Compare Pair</span>
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1440px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      <OnboardingModal />
    </div>
  );
}
