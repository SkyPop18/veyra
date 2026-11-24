import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Bookmark,
  ExternalLink,
  Plus,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { useVeyra } from '../../context/VeyraContext';
import { DeltaText, FearGreedGauge, Sparkline } from '../../components/ui/Primitives';
import { formatCompactUsd, formatPrice, sanitizeExternalUrl } from '../../lib/core';
import { apiRequest } from '../../lib/api';
import type { NewsArticle } from '../../types/veyra';

function timeAgo(iso: string): string {
  const diffMin = Math.max(1, Math.floor((Date.now() - Date.parse(iso)) / 60000));
  if (diffMin < 60) return `${diffMin}m ago`;
  const hrs = Math.floor(diffMin / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function DashboardHomePage() {
  const {
    fiat,
    crypto,
    fearGreed,
    strength,
    news,
    watchlist,
    savedNews,
    followedCategoryIds,
    newsCategories,
    theme,
    toggleNewsFollow,
    saveArticle,
    trackInteraction,
    notify,
  } = useVeyra();

  const [suggested, setSuggested] = useState<NewsArticle[]>([]);
  const [suggestEngine, setSuggestEngine] = useState<string>('interest-graph');
  const [loadingSuggest, setLoadingSuggest] = useState(false);

  const loadSuggestions = useCallback(async (withAi = false) => {
    setLoadingSuggest(true);
    try {
      const res = await apiRequest<{ articles: NewsArticle[]; engine: string }>(
        `/api/user/suggestions${withAi ? '?ai=1' : ''}`
      );
      setSuggested(res.articles);
      setSuggestEngine(res.engine);
    } catch {
      // Fallback to general news slice
    } finally {
      setLoadingSuggest(false);
    }
  }, []);

  useEffect(() => {
    void loadSuggestions(false);
  }, [loadSuggestions, followedCategoryIds.length]);

  const topMover = useMemo(() => {
    if (crypto.length === 0) return null;
    return [...crypto].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h)[0];
  }, [crypto]);

  const btc = useMemo(() => crypto.find((c) => c.symbol === 'BTC'), [crypto]);

  const followedChartData = useMemo(() => {
    return watchlist
      .map((item) => {
        const match = strength.all.find(
          (s) => s.code.toUpperCase() === item.symbol.toUpperCase() && s.assetType === item.asset_type
        );
        if (!match) return null;
        return {
          code: match.code,
          name: match.name,
          score: match.strengthScore,
          change24h: match.change24h,
          assetType: match.assetType,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.score - a.score);
  }, [watchlist, strength.all]);

  const economicNews = useMemo(() => news.filter((n) => n.section === 'economic').slice(0, 4), [news]);
  const taxNews = useMemo(() => news.filter((n) => n.section === 'taxes').slice(0, 4), [news]);
  const marketNews = useMemo(
    () => news.filter((n) => n.section === 'market' || n.section === 'crypto').slice(0, 4),
    [news]
  );

  const savedUrls = useMemo(() => new Set(savedNews.map((s) => s.article_url)), [savedNews]);

  const handleFeedback = async (article: NewsArticle, type: 'like' | 'dislike') => {
    await trackInteraction({
      interaction_type: type,
      content_type: 'news',
      content_id: article.id,
      content_title: article.title,
      tags: article.tags,
    });
    if (type === 'dislike') {
      setSuggested((prev) => prev.filter((a) => a.id !== article.id));
      notify('We will show fewer stories like this.', 'info');
    } else {
      notify('Interest recorded. Refining suggestions.', 'success');
      void loadSuggestions(false);
    }
  };

  const isTopicFollowed = (slug: string) => {
    const cat = newsCategories.find((c) => c.slug === slug);
    return cat ? followedCategoryIds.includes(cat.id) : false;
  };

  return (
    <div className="space-y-6">
      {/* Row 1 — Quick Stats (4 glass cards) */}
      <section aria-label="Market overview stats" className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="glass-surface p-5 flex flex-col justify-between gap-3">
          <p className="text-xs font-medium text-[#71717a] dark:text-[#a1a1aa]">Market Sentiment</p>
          {fearGreed ? (
            <FearGreedGauge
              value={fearGreed.current.value}
              classification={fearGreed.current.classification}
            />
          ) : (
            <div className="h-14 rounded-lg bg-[#f4f4f5] dark:bg-white/5" />
          )}
        </div>

        <div className="glass-surface p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[#71717a] dark:text-[#a1a1aa]">Top Mover Today</p>
            {topMover && <DeltaText value={topMover.price_change_percentage_24h} />}
          </div>
          {topMover ? (
            <div className="flex items-end justify-between gap-3">
              <div>
                <Link
                  to={`/dashboard/crypto/${topMover.id}`}
                  className="font-display text-xl font-bold text-[#09090b] dark:text-white hover:text-[#3b82f6] transition-colors"
                >
                  {topMover.symbol}
                </Link>
                <p className="font-mono-num text-xs text-[#52525b] dark:text-[#a1a1aa]">
                  {formatPrice(topMover.current_price)} · {topMover.name}
                </p>
              </div>
              <Sparkline data={topMover.sparkline} positive={topMover.price_change_percentage_24h >= 0} width={76} height={28} />
            </div>
          ) : (
            <div className="h-12 rounded-lg bg-[#f4f4f5] dark:bg-white/5" />
          )}
        </div>

        <div className="glass-surface p-5 flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[#71717a] dark:text-[#a1a1aa]">Benchmark Asset (BTC)</p>
            {btc && <DeltaText value={btc.price_change_percentage_24h} />}
          </div>
          {btc ? (
            <div>
              <Link
                to="/dashboard/crypto/bitcoin"
                className="font-mono-num text-2xl font-bold text-[#09090b] dark:text-white hover:text-[#3b82f6] transition-colors"
              >
                {formatPrice(btc.current_price)}
              </Link>
              <p className="text-xs text-[#71717a] dark:text-[#a1a1aa] mt-1 font-mono-num">
                24h Vol {formatCompactUsd(btc.total_volume)} · Strength {btc.strengthScore.toFixed(1)}
              </p>
            </div>
          ) : (
            <div className="h-12 rounded-lg bg-[#f4f4f5] dark:bg-white/5" />
          )}
        </div>

        <div className="glass-surface p-5 flex flex-col justify-between gap-3">
          <p className="text-xs font-medium text-[#71717a] dark:text-[#a1a1aa]">Coverage &amp; Watchlist</p>
          <div>
            <p className="font-mono-num text-2xl font-bold text-[#09090b] dark:text-white">
              {fiat.length + crypto.length} <span className="text-sm font-normal text-[#71717a]">assets</span>
            </p>
            <p className="text-xs text-[#71717a] dark:text-[#a1a1aa] mt-1">
              {fiat.length} Fiat · {crypto.length} Crypto · {watchlist.length} Followed
            </p>
          </div>
        </div>
      </section>

      {/* Row 2 — Followed Currencies Strength Bar Graph */}
      <section aria-label="Followed currencies strength chart" className="glass-surface p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h1 className="font-display text-lg font-semibold text-[#09090b] dark:text-white">
              Followed Currencies Strength (0–100)
            </h1>
            <p className="text-xs text-[#71717a] dark:text-[#a1a1aa]">
              Normalized strength scores across your active watchlist assets.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <Link
              to="/dashboard/watchlist"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e4e4e7] dark:border-white/10 px-3 py-1.5 text-xs font-medium text-[#09090b] dark:text-[#fafafa] hover:border-[#3b82f6]/50 transition-colors"
            >
              <Plus className="h-3.5 w-3.5 text-[#3b82f6]" />
              <span>Manage Watchlist</span>
            </Link>
            <Link
              to="/dashboard/leaderboard"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white px-3 py-1.5 text-xs font-medium transition-colors"
            >
              <span>Full Leaderboard</span>
            </Link>
          </div>
        </div>

        {followedChartData.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#e4e4e7] dark:border-white/15 py-12 px-4 text-center space-y-3">
            <p className="text-sm text-[#52525b] dark:text-[#a1a1aa]">
              Follow currencies to compare their live strength scores here.
            </p>
            <Link
              to="/dashboard/leaderboard"
              className="inline-flex items-center gap-2 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white px-4 py-2 text-xs font-medium"
            >
              Browse Strength Leaderboard
            </Link>
          </div>
        ) : (
          <div className="h-64 w-full" data-testid="followed-strength-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={followedChartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke={theme === 'dark' ? 'rgba(255,255,255,0.08)' : '#e4e4e7'}
                />
                <XAxis
                  dataKey="code"
                  tick={{ fill: theme === 'dark' ? '#d4d4d8' : '#3f3f46', fontSize: 12, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: theme === 'dark' ? '#71717a' : '#71717a', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(59,130,246,0.06)' }}
                  contentStyle={{
                    backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff',
                    borderColor: theme === 'dark' ? 'rgba(255,255,255,0.12)' : '#e4e4e7',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: theme === 'dark' ? '#fafafa' : '#09090b',
                  }}
                  formatter={(value: unknown) => [`${Number(value).toFixed(1)} / 100`, 'Strength Score']}
                />
                <Bar dataKey="score" radius={[8, 8, 0, 0]} maxBarSize={52}>
                  {followedChartData.map((entry, idx) => (
                    <Cell
                      key={entry.code}
                      fill={idx === 0 ? '#2563eb' : entry.score >= 70 ? '#3b82f6' : '#60a5fa'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Row 3 — 4-Quadrant News Grid */}
      <section aria-label="Categorized market news" className="grid lg:grid-cols-2 gap-5">
        {/* Q1: Economic News */}
        <NewsQuadrantCard
          title="Economic News"
          subtitle="Central banks, GDP & inflation policy"
          topicSlug="economic"
          followed={isTopicFollowed('economic')}
          onToggleFollow={() => void toggleNewsFollow('economic')}
          articles={economicNews}
          savedUrls={savedUrls}
          onSave={saveArticle}
          onView={(a) =>
            void trackInteraction({
              interaction_type: 'view',
              content_type: 'news',
              content_id: a.id,
              content_title: a.title,
              tags: a.tags,
            })
          }
        />

        {/* Q2: Global Tax Updates */}
        <NewsQuadrantCard
          title="Global Tax Updates"
          subtitle="Cross-border tariffs, Pillar Two & crypto taxation"
          topicSlug="taxes"
          followed={isTopicFollowed('taxes')}
          onToggleFollow={() => void toggleNewsFollow('taxes')}
          articles={taxNews}
          savedUrls={savedUrls}
          onSave={saveArticle}
          onView={(a) =>
            void trackInteraction({
              interaction_type: 'view',
              content_type: 'news',
              content_id: a.id,
              content_title: a.title,
              tags: a.tags,
            })
          }
        />

        {/* Q3: Market News */}
        <NewsQuadrantCard
          title="Market News"
          subtitle="Live forex liquidity & cryptocurrency market flows"
          topicSlug="forex"
          followed={isTopicFollowed('forex')}
          onToggleFollow={() => void toggleNewsFollow('forex')}
          articles={marketNews}
          savedUrls={savedUrls}
          onSave={saveArticle}
          onView={(a) =>
            void trackInteraction({
              interaction_type: 'view',
              content_type: 'news',
              content_id: a.id,
              content_title: a.title,
              tags: a.tags,
            })
          }
        />

        {/* Q4: Suggested For You (AI-Curated) */}
        <div className="glass-surface p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-start justify-between gap-3 border-b border-[#e4e4e7] dark:border-white/10 pb-3.5">
            <div>
              <h2 className="font-display text-base font-semibold text-[#09090b] dark:text-white flex items-center gap-2">
                <Bookmark className="h-4 w-4 text-[#3b82f6]" />
                <span>Suggested For You</span>
              </h2>
              <p className="text-xs text-[#71717a] dark:text-[#a1a1aa]">
                Ranked via {suggestEngine === 'gemini' ? 'Veyra AI' : 'your interest graph'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadSuggestions(true)}
              disabled={loadingSuggest}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#e4e4e7] dark:border-white/10 px-2.5 py-1.5 text-xs font-medium text-[#2563eb] dark:text-[#60a5fa] hover:border-[#3b82f6]/50 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingSuggest ? 'animate-spin' : ''}`} />
              <span>AI Rerank</span>
            </button>
          </div>

          <div className="divide-y divide-[#e4e4e7]/70 dark:divide-white/5">
            {(suggested.length > 0 ? suggested.slice(0, 4) : news.slice(0, 4)).map((article) => {
              const safeHref = sanitizeExternalUrl(article.url);
              const isSaved = savedUrls.has(safeHref);
              return (
                <article key={article.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
                  <div className="flex items-start justify-between gap-3">
                    <a
                      href={safeHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-[#09090b] dark:text-[#fafafa] hover:text-[#3b82f6] transition-colors leading-snug"
                    >
                      {article.title}
                    </a>
                    <ExternalLink className="h-3.5 w-3.5 text-[#71717a] shrink-0 mt-1" aria-hidden="true" />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#71717a] dark:text-[#a1a1aa]">
                    <span>
                      {article.source} · {timeAgo(article.publishedAt)}
                      {article.aiReason ? ` · ${article.aiReason}` : ''}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleFeedback(article, 'like')}
                        aria-label={`Like "${article.title}"`}
                        className="inline-flex items-center gap-1 hover:text-[#3b82f6] transition-colors cursor-pointer"
                      >
                        <ThumbsUp className="h-3.5 w-3.5" />
                        <span>Like</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveArticle(article)}
                        aria-label={`Save "${article.title}"`}
                        className={`inline-flex items-center gap-1 transition-colors cursor-pointer ${
                          isSaved ? 'text-[#3b82f6] font-medium' : 'hover:text-[#3b82f6]'
                        }`}
                      >
                        <Bookmark className="h-3.5 w-3.5" />
                        <span>{isSaved ? 'Saved' : 'Save'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleFeedback(article, 'dislike')}
                        aria-label={`Not interested in "${article.title}"`}
                        className="inline-flex items-center gap-1 hover:text-[#ef4444] transition-colors cursor-pointer"
                      >
                        <ThumbsDown className="h-3.5 w-3.5" />
                        <span>Hide</span>
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

function NewsQuadrantCard({
  title,
  subtitle,
  topicSlug,
  followed,
  onToggleFollow,
  articles,
  savedUrls,
  onSave,
  onView,
}: {
  title: string;
  subtitle: string;
  topicSlug: string;
  followed: boolean;
  onToggleFollow: () => void;
  articles: NewsArticle[];
  savedUrls: Set<string>;
  onSave: (a: NewsArticle) => Promise<void>;
  onView: (a: NewsArticle) => void;
}) {
  return (
    <div className="glass-surface p-5 flex flex-col justify-between space-y-4">
      <div className="flex items-start justify-between gap-3 border-b border-[#e4e4e7] dark:border-white/10 pb-3.5">
        <div>
          <h2 className="font-display text-base font-semibold text-[#09090b] dark:text-white">{title}</h2>
          <p className="text-xs text-[#71717a] dark:text-[#a1a1aa]">{subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onToggleFollow}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
            followed
              ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#2563eb] dark:text-[#60a5fa]'
              : 'border-[#e4e4e7] dark:border-white/10 text-[#52525b] dark:text-[#a1a1aa] hover:border-[#3b82f6]/40'
          }`}
        >
          {followed ? 'Following' : `Follow ${topicSlug}`}
        </button>
      </div>

      <div className="divide-y divide-[#e4e4e7]/70 dark:divide-white/5">
        {articles.map((article) => {
          const safeHref = sanitizeExternalUrl(article.url);
          const isSaved = savedUrls.has(safeHref);
          return (
            <article key={article.id} className="py-3 first:pt-0 last:pb-0 space-y-1.5">
              <div className="flex items-start justify-between gap-3">
                <a
                  href={safeHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onView(article)}
                  className="text-sm font-medium text-[#09090b] dark:text-[#fafafa] hover:text-[#3b82f6] transition-colors leading-snug"
                >
                  {article.title}
                </a>
                <ExternalLink className="h-3.5 w-3.5 text-[#71717a] shrink-0 mt-1" aria-hidden="true" />
              </div>
              <div className="flex items-center justify-between gap-2 text-xs text-[#71717a] dark:text-[#a1a1aa]">
                <span>
                  {article.source} · {timeAgo(article.publishedAt)}
                </span>
                <button
                  type="button"
                  onClick={() => void onSave(article)}
                  className={`inline-flex items-center gap-1 transition-colors cursor-pointer ${
                    isSaved ? 'text-[#3b82f6] font-medium' : 'hover:text-[#3b82f6]'
                  }`}
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  <span>{isSaved ? 'Saved' : 'Save'}</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
