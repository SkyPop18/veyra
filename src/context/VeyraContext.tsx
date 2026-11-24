import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { apiRequest, setMemoryAuthToken } from '../lib/api';
import { supabase } from '../lib/supabase';
import { hasAcceptedCurrentTerms } from '../lib/core';
import type {
  CryptoAsset,
  FearGreedData,
  FiatCurrency,
  NewsArticle,
  NewsCategory,
  PriceAlertItem,
  SavedNewsItem,
  StrengthEntry,
  UserProfile,
  WatchlistItem,
} from '../types/veyra';

export interface ToastNotice {
  id: string;
  message: string;
  tone: 'info' | 'success' | 'error';
}

interface VeyraContextValue {
  theme: 'dark' | 'light';
  toggleTheme: () => void;

  // Real Supabase Auth State
  user: UserProfile | null;
  emailVerified: boolean;
  termsAccepted: boolean;
  aal: 'aal1' | 'aal2';
  authLoading: boolean;
  refreshAuth: () => Promise<void>;
  logout: () => Promise<void>;
  logoutEverywhere: () => Promise<void>;
  setUserDirect: (user: UserProfile | null) => void;

  // Market data (160+ fiat + paginated CoinGecko crypto)
  fiat: FiatCurrency[];
  fiatRates: Record<string, number>;
  crypto: CryptoAsset[];
  cryptoPage: number;
  cryptoHasMore: boolean;
  cryptoLoadingMore: boolean;
  loadMoreCrypto: () => Promise<void>;
  fearGreed: FearGreedData | null;
  strength: { fiat: StrengthEntry[]; crypto: StrengthEntry[]; all: StrengthEntry[] };
  news: NewsArticle[];
  newsCategories: NewsCategory[];
  marketLoading: boolean;
  marketUpdatedAt: string | null;
  refreshMarket: () => Promise<void>;

  // User data
  watchlist: WatchlistItem[];
  alerts: PriceAlertItem[];
  followedCategoryIds: string[];
  savedNews: SavedNewsItem[];
  refreshUserData: () => Promise<void>;
  toggleWatchlist: (symbol: string, assetType: 'fiat' | 'crypto') => Promise<void>;
  trackInteraction: (payload: {
    interaction_type: 'view' | 'like' | 'dislike' | 'save' | 'search';
    content_type: string;
    content_id: string;
    content_title?: string;
    tags?: string[];
  }) => Promise<void>;
  toggleNewsFollow: (categoryIdOrSlug: string) => Promise<void>;
  saveArticle: (article: NewsArticle) => Promise<void>;
  removeSavedArticle: (id: string) => Promise<void>;

  // Toasts
  toasts: ToastNotice[];
  notify: (message: string, tone?: ToastNotice['tone']) => void;
}

const VeyraContext = createContext<VeyraContextValue | null>(null);

export function VeyraProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = window.localStorage.getItem('veyra_theme');
    return saved === 'light' ? 'light' : 'dark';
  });

  const [user, setUser] = useState<UserProfile | null>(null);
  const [emailVerified, setEmailVerified] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [aal, setAal] = useState<'aal1' | 'aal2'>('aal1');
  const [authLoading, setAuthLoading] = useState(true);

  const [fiat, setFiat] = useState<FiatCurrency[]>([]);
  const [fiatRates, setFiatRates] = useState<Record<string, number>>({ USD: 1 });
  const [crypto, setCrypto] = useState<CryptoAsset[]>([]);
  const [cryptoPage, setCryptoPage] = useState(1);
  const [cryptoHasMore, setCryptoHasMore] = useState(true);
  const [cryptoLoadingMore, setCryptoLoadingMore] = useState(false);
  const [fearGreed, setFearGreed] = useState<FearGreedData | null>(null);
  const [strength, setStrength] = useState<{
    fiat: StrengthEntry[];
    crypto: StrengthEntry[];
    all: StrengthEntry[];
  }>({ fiat: [], crypto: [], all: [] });
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [newsCategories, setNewsCategories] = useState<NewsCategory[]>([]);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketUpdatedAt, setMarketUpdatedAt] = useState<string | null>(null);

  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [alerts, setAlerts] = useState<PriceAlertItem[]>([]);
  const [followedCategoryIds, setFollowedCategoryIds] = useState<string[]>([]);
  const [savedNews, setSavedNews] = useState<SavedNewsItem[]>([]);
  const [toasts, setToasts] = useState<ToastNotice[]>([]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      window.localStorage.setItem('veyra_theme', theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const notify = useCallback((message: string, tone: ToastNotice['tone'] = 'info') => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-2), { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const refreshMarket = useCallback(async () => {
    setMarketLoading(true);
    try {
      const [fiatRes, cryptoRes, fgRes, strRes, newsRes] = await Promise.all([
        apiRequest<{ currencies: FiatCurrency[]; rates: Record<string, number>; updatedAt: string }>('/api/market/fiat'),
        apiRequest<{ coins: CryptoAsset[]; page: number; hasMore: boolean; updatedAt: string }>('/api/market/crypto?page=1&per_page=100'),
        apiRequest<FearGreedData>('/api/market/fear-greed'),
        apiRequest<{ fiat: StrengthEntry[]; crypto: StrengthEntry[]; all: StrengthEntry[] }>('/api/market/strength'),
        apiRequest<{ articles: NewsArticle[]; categories: NewsCategory[] }>('/api/market/news'),
      ]);
      setFiat(fiatRes.currencies);
      setFiatRates(fiatRes.rates);
      setCrypto(cryptoRes.coins);
      setCryptoPage(cryptoRes.page);
      setCryptoHasMore(cryptoRes.hasMore);
      setFearGreed(fgRes);
      setStrength({ fiat: strRes.fiat, crypto: strRes.crypto, all: strRes.all });
      setNews(newsRes.articles);
      setNewsCategories(newsRes.categories);
      setMarketUpdatedAt(fiatRes.updatedAt);
    } catch {
      notify('Unable to refresh live market feeds right now.', 'error');
    } finally {
      setMarketLoading(false);
    }
  }, [notify]);

  const loadMoreCrypto = useCallback(async () => {
    if (cryptoLoadingMore || !cryptoHasMore) return;
    setCryptoLoadingMore(true);
    try {
      const nextPage = cryptoPage + 1;
      const res = await apiRequest<{ coins: CryptoAsset[]; page: number; hasMore: boolean }>(
        `/api/market/crypto?page=${nextPage}&per_page=100`
      );
      setCrypto((prev) => {
        const seen = new Set(prev.map((c) => c.id));
        const merged = [...prev, ...res.coins.filter((c) => !seen.has(c.id))];
        return merged;
      });
      setCryptoPage(res.page);
      setCryptoHasMore(res.hasMore && res.coins.length > 0);
    } catch {
      notify('Unable to load additional cryptocurrencies right now.', 'error');
    } finally {
      setCryptoLoadingMore(false);
    }
  }, [cryptoLoadingMore, cryptoHasMore, cryptoPage, notify]);

  const clearUserData = useCallback(() => {
    setWatchlist([]);
    setAlerts([]);
    setFollowedCategoryIds([]);
    setSavedNews([]);
  }, []);

  const refreshUserData = useCallback(async () => {
    try {
      const [wl, al, nf, sn] = await Promise.all([
        apiRequest<{ items: WatchlistItem[] }>('/api/user/watchlist'),
        apiRequest<{ items: PriceAlertItem[] }>('/api/user/alerts'),
        apiRequest<{ followedCategoryIds: string[]; categories: NewsCategory[] }>('/api/user/news-follows'),
        apiRequest<{ items: SavedNewsItem[] }>('/api/user/saved-news'),
      ]);
      setWatchlist(wl.items);
      setAlerts(al.items);
      setFollowedCategoryIds(nf.followedCategoryIds);
      setSavedNews(sn.items);
    } catch {
      // Unauthenticated or consent not yet accepted
    }
  }, []);

  const initialAuthDone = useRef(false);
  const userRef = useRef<UserProfile | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const refreshAuth = useCallback(async (silent = false) => {
    // Only show full-screen loader on initial application boot when user is not yet loaded
    if (!initialAuthDone.current && !silent && !userRef.current) {
      setAuthLoading(true);
    }
    try {
      if (supabase) {
        try {
          const sessionRes = await Promise.race([
            supabase.auth.getSession(),
            new Promise<{ data: { session: null } }>((resolve) =>
              setTimeout(() => resolve({ data: { session: null } }), 1800)
            ),
          ]);
          const accessToken = sessionRes.data.session?.access_token ?? null;
          setMemoryAuthToken(accessToken);
          if (!accessToken) {
            setUser(null);
            userRef.current = null;
            setEmailVerified(false);
            setTermsAccepted(false);
            setAal('aal1');
            clearUserData();
            setAuthLoading(false);
            return;
          }
        } catch {
          // Timeout or session retrieval issue
        }
      }

      const res = await apiRequest<{
        user: UserProfile | null;
        emailVerified: boolean;
        termsAccepted: boolean;
        aal: 'aal1' | 'aal2';
      }>('/api/auth/me');

      setUser(res.user);
      userRef.current = res.user;
      setEmailVerified(res.emailVerified);
      setTermsAccepted(res.termsAccepted);
      setAal(res.aal);
      setAuthLoading(false);

      if (res.user && res.emailVerified && res.termsAccepted) {
        void refreshUserData();
      } else {
        clearUserData();
      }
    } catch {
      // If a silent background check experiences lag or transient error, keep current session
      if (!silent || !userRef.current) {
        setUser(null);
        userRef.current = null;
        setEmailVerified(false);
        setTermsAccepted(false);
        setAal('aal1');
        clearUserData();
      }
    } finally {
      initialAuthDone.current = true;
      setAuthLoading(false);
    }
  }, [clearUserData, refreshUserData]);

  // Initial application mount only
  useEffect(() => {
    void refreshAuth(false);
    void refreshMarket();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setMemoryAuthToken(session?.access_token ?? null);
      if (event === 'SIGNED_OUT') {
        setUser(null);
        userRef.current = null;
        setEmailVerified(false);
        setTermsAccepted(false);
        clearUserData();
        setAuthLoading(false);
      } else {
        // INITIAL_SESSION, SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED
        void refreshAuth(true);
      }
    });
    return () => {
      data.subscription.unsubscribe();
    };
  }, [refreshAuth, clearUserData]);

  const setUserDirect = useCallback(
    (nextUser: UserProfile | null) => {
      setUser(nextUser);
      const accepted = hasAcceptedCurrentTerms(nextUser);
      setTermsAccepted(accepted);
      if (nextUser && accepted) {
        void refreshUserData();
      }
    },
    [refreshUserData]
  );

  const logout = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut({ scope: 'local' });
    }
    setMemoryAuthToken(null);
    setUser(null);
    setEmailVerified(false);
    setTermsAccepted(false);
    setAal('aal1');
    clearUserData();
    notify('Signed out of Veyra.', 'info');
  }, [clearUserData, notify]);

  const logoutEverywhere = useCallback(async () => {
    if (supabase) {
      await supabase.auth.signOut({ scope: 'global' });
    }
    setMemoryAuthToken(null);
    setUser(null);
    setEmailVerified(false);
    setTermsAccepted(false);
    setAal('aal1');
    clearUserData();
    notify('Signed out from all devices and active sessions.', 'success');
  }, [clearUserData, notify]);

  const toggleWatchlist = useCallback(
    async (symbol: string, assetType: 'fiat' | 'crypto') => {
      if (!user) {
        notify('Sign in to manage your personal watchlist.', 'error');
        return;
      }
      const upper = symbol.toUpperCase();
      const existing = watchlist.find((w) => w.symbol === upper && w.asset_type === assetType);
      if (existing) {
        await apiRequest(`/api/user/watchlist/${existing.id}`, { method: 'DELETE' });
        setWatchlist((prev) => prev.filter((w) => w.id !== existing.id));
        notify(`Removed ${upper} from your watchlist.`, 'info');
      } else {
        const res = await apiRequest<{ item: WatchlistItem }>('/api/user/watchlist', {
          method: 'POST',
          body: { symbol: upper, asset_type: assetType },
        });
        setWatchlist((prev) => [...prev, res.item]);
        notify(`Following ${upper} on your watchlist.`, 'success');
      }
    },
    [user, watchlist, notify]
  );

  const trackInteraction = useCallback(
    async (payload: {
      interaction_type: 'view' | 'like' | 'dislike' | 'save' | 'search';
      content_type: string;
      content_id: string;
      content_title?: string;
      tags?: string[];
    }) => {
      if (!user || !termsAccepted) return;
      try {
        await apiRequest('/api/user/interactions', { method: 'POST', body: payload });
      } catch {
        // non-blocking
      }
    },
    [user, termsAccepted]
  );

  const toggleNewsFollow = useCallback(
    async (categoryIdOrSlug: string) => {
      if (!user) {
        notify('Sign in to follow news topics.', 'error');
        return;
      }
      const res = await apiRequest<{ categoryId: string; following: boolean }>('/api/user/news-follows', {
        method: 'POST',
        body: { category_id: categoryIdOrSlug },
      });
      setFollowedCategoryIds((prev) =>
        res.following ? Array.from(new Set([...prev, res.categoryId])) : prev.filter((id) => id !== res.categoryId)
      );
      notify(res.following ? 'Topic followed for your personalized feed.' : 'Topic unfollowed.', 'info');
    },
    [user, notify]
  );

  const saveArticle = useCallback(
    async (article: NewsArticle) => {
      if (!user) {
        notify('Sign in to bookmark articles.', 'error');
        return;
      }
      const res = await apiRequest<{ item: SavedNewsItem }>('/api/user/saved-news', {
        method: 'POST',
        body: {
          article_url: article.url,
          article_title: article.title,
          article_source: article.source,
          article_summary: article.summary,
          tags: article.tags,
        },
      });
      setSavedNews((prev) => (prev.some((s) => s.id === res.item.id) ? prev : [res.item, ...prev]));
      void trackInteraction({
        interaction_type: 'save',
        content_type: 'news',
        content_id: article.id,
        content_title: article.title,
        tags: article.tags,
      });
      notify('Article saved to Bookmarks.', 'success');
    },
    [user, notify, trackInteraction]
  );

  const removeSavedArticle = useCallback(
    async (id: string) => {
      await apiRequest(`/api/user/saved-news/${id}`, { method: 'DELETE' });
      setSavedNews((prev) => prev.filter((s) => s.id !== id));
      notify('Removed bookmark.', 'info');
    },
    [notify]
  );

  return (
    <VeyraContext.Provider
      value={{
        theme,
        toggleTheme,
        user,
        emailVerified,
        termsAccepted,
        aal,
        authLoading,
        refreshAuth,
        logout,
        logoutEverywhere,
        setUserDirect,
        fiat,
        fiatRates,
        crypto,
        cryptoPage,
        cryptoHasMore,
        cryptoLoadingMore,
        loadMoreCrypto,
        fearGreed,
        strength,
        news,
        newsCategories,
        marketLoading,
        marketUpdatedAt,
        refreshMarket,
        watchlist,
        alerts,
        followedCategoryIds,
        savedNews,
        refreshUserData,
        toggleWatchlist,
        trackInteraction,
        toggleNewsFollow,
        saveArticle,
        removeSavedArticle,
        toasts,
        notify,
      }}
    >
      {children}
      {toasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium backdrop-blur-xl border shadow-lg transition-all ${
                t.tone === 'error'
                  ? 'bg-white/95 dark:bg-[#18181b]/95 border-[#ef4444]/40 text-[#ef4444]'
                  : t.tone === 'success'
                    ? 'bg-white/95 dark:bg-[#18181b]/95 border-[#3b82f6]/40 text-[#09090b] dark:text-[#fafafa]'
                    : 'bg-white/95 dark:bg-[#18181b]/95 border-[#e4e4e7] dark:border-white/15 text-[#09090b] dark:text-[#fafafa]'
              }`}
            >
              {t.message}
            </div>
          ))}
        </div>
      )}
    </VeyraContext.Provider>
  );
}

export function useVeyra() {
  const ctx = useContext(VeyraContext);
  if (!ctx) throw new Error('useVeyra must be used inside VeyraProvider');
  return ctx;
}
