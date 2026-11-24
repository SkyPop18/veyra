import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bookmark, ExternalLink, Search, ThumbsUp, Trash2 } from 'lucide-react';
import { useVeyra } from '../../context/VeyraContext';
import { sanitizeExternalUrl } from '../../lib/core';

export function NewsFeedPage() {
  const { category } = useParams();
  const {
    news,
    newsCategories,
    followedCategoryIds,
    savedNews,
    toggleNewsFollow,
    saveArticle,
    trackInteraction,
    notify,
  } = useVeyra();

  const [activeSlug, setActiveSlug] = useState<string>(category || 'all');
  const [search, setSearch] = useState('');

  const savedUrls = useMemo(() => new Set(savedNews.map((s) => s.article_url)), [savedNews]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return news.filter((article) => {
      const matchesCat =
        activeSlug === 'all' ||
        article.section === activeSlug ||
        article.tags.some((t) => t.toLowerCase() === activeSlug.toLowerCase());
      const matchesQ =
        !q ||
        article.title.toLowerCase().includes(q) ||
        article.summary.toLowerCase().includes(q) ||
        article.tags.some((t) => t.toLowerCase().includes(q));
      return matchesCat && matchesQ;
    });
  }, [news, activeSlug, search]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim().length >= 2) {
      void trackInteraction({
        interaction_type: 'search',
        content_type: 'news',
        content_id: `search-${Date.now()}`,
        content_title: search.trim(),
        tags: [search.trim().toLowerCase()],
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#09090b] dark:text-white">
            Personalized Market News
          </h1>
          <p className="text-sm text-[#52525b] dark:text-[#a1a1aa] mt-1">
            Follow macro, global tax, forex, and crypto topics to tune your Veyra home briefings.
          </p>
        </div>

        <Link
          to="/dashboard/news/saved"
          className="inline-flex items-center gap-2 rounded-lg border border-[#e4e4e7] dark:border-white/15 px-3.5 py-2 text-xs font-medium hover:border-[#3b82f6] self-start"
        >
          <Bookmark className="h-3.5 w-3.5 text-[#3b82f6]" />
          <span>Saved Bookmarks ({savedNews.length})</span>
        </Link>
      </div>

      {/* Followable Topic Controls */}
      <div className="glass-surface p-5 space-y-3">
        <p className="text-xs font-medium text-[#71717a] dark:text-[#a1a1aa]">
          Topics You Follow (click to toggle interest weighting)
        </p>
        <div className="flex flex-wrap gap-2">
          {newsCategories.map((cat) => {
            const followed = followedCategoryIds.includes(cat.id);
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => void toggleNewsFollow(cat.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap ${
                  followed
                    ? 'border-[#3b82f6] bg-[#3b82f6]/12 text-[#2563eb] dark:text-[#60a5fa]'
                    : 'border-[#e4e4e7] dark:border-white/10 text-[#52525b] dark:text-[#a1a1aa] hover:border-[#3b82f6]/40'
                }`}
              >
                {followed ? `Following ${cat.label}` : `+ ${cat.label}`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { slug: 'all', label: 'All Briefings' },
            { slug: 'economic', label: 'Economic' },
            { slug: 'taxes', label: 'Global Taxes' },
            { slug: 'market', label: 'Market & FX' },
            { slug: 'crypto', label: 'Crypto' },
          ].map((tab) => (
            <button
              key={tab.slug}
              type="button"
              onClick={() => setActiveSlug(tab.slug)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer ${
                activeSlug === tab.slug
                  ? 'bg-[#3b82f6] text-white'
                  : 'bg-[#f4f4f5] dark:bg-white/5 text-[#52525b] dark:text-[#a1a1aa]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearchSubmit} className="relative max-w-xs w-full">
          <Search className="h-4 w-4 text-[#71717a] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search headlines or tags..."
            aria-label="Search market news"
            className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/10 bg-white/85 dark:bg-[#18181b]/75 pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-[#3b82f6]"
          />
        </form>
      </div>

      {/* Articles List */}
      <div className="grid md:grid-cols-2 gap-4">
        {filtered.map((article) => {
          const safeHref = sanitizeExternalUrl(article.url);
          const isSaved = savedUrls.has(safeHref);
          return (
            <article key={article.id} className="glass-surface p-5 flex flex-col justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs text-[#71717a] dark:text-[#a1a1aa]">
                  {article.source} · {article.section.toUpperCase()} · {new Date(article.publishedAt).toLocaleDateString()}
                </p>
                <a
                  href={safeHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    void trackInteraction({
                      interaction_type: 'view',
                      content_type: 'news',
                      content_id: article.id,
                      content_title: article.title,
                      tags: article.tags,
                    })
                  }
                  className="font-display text-base font-semibold text-[#09090b] dark:text-white hover:text-[#3b82f6] transition-colors block leading-snug"
                >
                  {article.title}
                </a>
                <p className="text-sm text-[#52525b] dark:text-[#a1a1aa] leading-relaxed">{article.summary}</p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-[#e4e4e7]/70 dark:border-white/5 text-xs">
                <span className="text-[#71717a]">{article.tags.slice(0, 3).join(' · ')}</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      void trackInteraction({
                        interaction_type: 'like',
                        content_type: 'news',
                        content_id: article.id,
                        content_title: article.title,
                        tags: article.tags,
                      });
                      notify('Preference saved to your news profile.', 'success');
                    }}
                    className="inline-flex items-center gap-1 text-[#52525b] dark:text-[#a1a1aa] hover:text-[#3b82f6] cursor-pointer"
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                    <span>Like</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveArticle(article)}
                    className={`inline-flex items-center gap-1 cursor-pointer ${
                      isSaved ? 'text-[#3b82f6] font-medium' : 'text-[#52525b] dark:text-[#a1a1aa] hover:text-[#3b82f6]'
                    }`}
                  >
                    <Bookmark className="h-3.5 w-3.5" />
                    <span>{isSaved ? 'Saved' : 'Save'}</span>
                  </button>
                  <a
                    href={safeHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Read "${article.title}" externally`}
                    className="inline-flex items-center text-[#52525b] dark:text-[#a1a1aa] hover:text-[#3b82f6]"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function SavedNewsPage() {
  const { savedNews, removeSavedArticle } = useVeyra();

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#09090b] dark:text-white">
            Saved Articles
          </h1>
          <p className="text-sm text-[#52525b] dark:text-[#a1a1aa] mt-1">
            Your personal reading archive across economic policy, global taxes, and market flows.
          </p>
        </div>
        <Link to="/dashboard/news" className="text-xs font-medium text-[#3b82f6] hover:underline">
          Back to News Feed
        </Link>
      </div>

      {savedNews.length === 0 ? (
        <div className="glass-surface p-10 text-center space-y-2">
          <Bookmark className="h-6 w-6 text-[#3b82f6] mx-auto" />
          <p className="text-sm font-medium">No saved articles yet.</p>
          <p className="text-xs text-[#71717a]">Click Save on any headline across Dashboard Home or News Feed.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {savedNews.map((item) => {
            const safeHref = sanitizeExternalUrl(item.article_url);
            return (
              <article key={item.id} className="glass-surface p-5 flex items-start justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <p className="text-xs text-[#71717a]">
                    {item.article_source} · Saved {new Date(item.saved_at).toLocaleDateString()}
                  </p>
                  <a
                    href={safeHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-display text-base font-semibold text-[#09090b] dark:text-white hover:text-[#3b82f6] block"
                  >
                    {item.article_title}
                  </a>
                  {item.article_summary && (
                    <p className="text-sm text-[#52525b] dark:text-[#a1a1aa]">{item.article_summary}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => void removeSavedArticle(item.id)}
                  aria-label={`Remove saved article "${item.article_title}"`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#71717a] hover:text-[#ef4444] shrink-0 cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
