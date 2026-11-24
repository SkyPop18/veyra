import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Scale, Search, Star } from 'lucide-react';
import { useVeyra } from '../../context/VeyraContext';
import { DeltaText, Sparkline, StrengthBar } from '../../components/ui/Primitives';
import { TradingViewChart } from '../../components/charts/TradingViewChart';
import { formatCompactUsd, formatPrice } from '../../lib/core';
import { apiRequest } from '../../lib/api';
import type { CryptoAsset, CryptoCatalogEntry, HistoricalPoint } from '../../types/veyra';

export function CurrenciesListPage() {
  const { fiat, watchlist, toggleWatchlist } = useVeyra();
  const [search, setSearch] = useState('');
  const [region, setRegion] = useState<string>('All');
  const [visibleCount, setVisibleCount] = useState(60);

  const watched = useMemo(
    () => new Set(watchlist.filter((w) => w.asset_type === 'fiat').map((w) => w.symbol.toUpperCase())),
    [watchlist]
  );

  const regions = ['All', 'North America', 'Europe', 'Asia-Pacific', 'Middle East', 'South America', 'Africa'];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return fiat.filter((c) => {
      const matchesRegion = region === 'All' || c.region === region;
      const matchesQ =
        !q ||
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q);
      return matchesRegion && matchesQ;
    });
  }, [fiat, search, region]);

  const displayed = filtered.slice(0, visibleCount);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#09090b] dark:text-white">
          Global Fiat Currencies
        </h1>
        <p className="text-sm text-[#52525b] dark:text-[#a1a1aa] mt-1">
          Live USD-anchored exchange rates and normalized strength scores across all {fiat.length} global currencies.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="h-4 w-4 text-[#71717a] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisibleCount(60);
            }}
            placeholder="Search any of 160+ currencies (USD, INR, CHF...)"
            aria-label="Search fiat currencies"
            className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/10 bg-white/85 dark:bg-[#18181b]/75 pl-10 pr-4 py-2 text-sm text-[#09090b] dark:text-white focus:outline-none focus:border-[#3b82f6]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {regions.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setRegion(r);
                setVisibleCount(60);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                region === r
                  ? 'bg-[#3b82f6] text-white'
                  : 'bg-[#f4f4f5] dark:bg-white/5 text-[#52525b] dark:text-[#a1a1aa] hover:text-[#09090b] dark:hover:text-white'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="glass-surface overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#e4e4e7] dark:border-white/10 text-xs font-medium text-[#71717a] dark:text-[#a1a1aa]">
              <th className="py-3.5 px-4">Rank</th>
              <th className="py-3.5 px-4">Currency</th>
              <th className="py-3.5 px-4">Region</th>
              <th className="py-3.5 px-4 text-right">Per 1 USD</th>
              <th className="py-3.5 px-4">Strength</th>
              <th className="py-3.5 px-4 text-right">24h / 7d</th>
              <th className="py-3.5 px-4 text-right">Watch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e4e4e7]/70 dark:divide-white/5 text-sm">
            {displayed.map((c) => {
              const isWatched = watched.has(c.code);
              return (
                <tr key={c.code} className="hover:bg-[#f4f4f5]/60 dark:hover:bg-white/[0.03] transition-colors">
                  <td className="py-3.5 px-4 font-mono-num text-xs text-[#71717a]">#{c.rank}</td>
                  <td className="py-3.5 px-4">
                    <Link to={`/dashboard/currencies/${c.code}`} className="group block">
                      <span className="font-semibold text-[#09090b] dark:text-white group-hover:text-[#3b82f6]">
                        {c.flag ? `${c.flag} ` : ''}
                        {c.code}
                      </span>
                      <span className="ml-2 text-xs text-[#71717a] dark:text-[#a1a1aa]">
                        {c.name}
                      </span>
                    </Link>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-[#52525b] dark:text-[#a1a1aa]">{c.region}</td>
                  <td className="py-3.5 px-4 text-right font-mono-num text-sm text-[#09090b] dark:text-[#fafafa]">
                    {c.rateVsUsd >= 100 ? c.rateVsUsd.toFixed(2) : c.rateVsUsd.toFixed(4)}
                  </td>
                  <td className="py-3.5 px-4">
                    <StrengthBar score={c.strengthScore} compact />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <DeltaText value={c.change24h} showIcon={false} />
                      <span className="text-[#71717a] text-xs">/</span>
                      <DeltaText value={c.change7d} showIcon={false} />
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => void toggleWatchlist(c.code, 'fiat')}
                      aria-label={isWatched ? `Unfollow ${c.code}` : `Follow ${c.code}`}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                        isWatched
                          ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]'
                          : 'border-[#e4e4e7] dark:border-white/10 text-[#71717a] hover:text-[#3b82f6]'
                      }`}
                    >
                      <Star className={`h-3.5 w-3.5 ${isWatched ? 'fill-current' : ''}`} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length > visibleCount && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setVisibleCount((v) => v + 60)}
            className="rounded-xl border border-[#e4e4e7] dark:border-white/15 px-5 py-2.5 text-xs font-semibold hover:border-[#3b82f6] cursor-pointer"
          >
            Load More Currencies ({filtered.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}

export function CurrencyDetailPage() {
  const { code = 'EUR' } = useParams();
  const { fiat, watchlist, toggleWatchlist } = useVeyra();
  const [days, setDays] = useState(30);
  const [chartMode, setChartMode] = useState<'area' | 'candles'>('area');
  const [series, setSeries] = useState<HistoricalPoint[]>([]);

  const currency = fiat.find((c) => c.code.toLowerCase() === code.toLowerCase());
  const isWatched = watchlist.some(
    (w) => w.asset_type === 'fiat' && w.symbol.toUpperCase() === code.toUpperCase()
  );

  useEffect(() => {
    let active = true;
    void apiRequest<{ series: HistoricalPoint[] }>(`/api/market/history/fiat/${code.toUpperCase()}?days=${days}`)
      .then((res) => {
        if (active) setSeries(res.series);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [code, days]);

  if (!currency) {
    return (
      <div className="glass-surface p-8 text-center space-y-3">
        <p className="text-sm text-[#52525b] dark:text-[#a1a1aa]">Currency {code.toUpperCase()} not found.</p>
        <Link to="/dashboard/currencies" className="text-sm font-medium text-[#3b82f6] hover:underline">
          Back to Currencies
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            to="/dashboard/currencies"
            className="inline-flex items-center gap-1.5 text-xs text-[#71717a] hover:text-[#3b82f6]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>All Currencies</span>
          </Link>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#09090b] dark:text-white">
            {currency.flag ? `${currency.flag} ` : ''}
            {currency.name} ({currency.code})
          </h1>
          <p className="text-xs text-[#71717a] dark:text-[#a1a1aa]">
            {currency.country} · {currency.region} · Strength Rank #{currency.rank}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void toggleWatchlist(currency.code, 'fiat')}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-medium cursor-pointer ${
              isWatched
                ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#2563eb] dark:text-[#60a5fa]'
                : 'border-[#e4e4e7] dark:border-white/15 text-[#09090b] dark:text-white'
            }`}
          >
            <Star className={`h-3.5 w-3.5 ${isWatched ? 'fill-current' : ''}`} />
            <span>{isWatched ? 'Following' : 'Watchlist'}</span>
          </button>
          <Link
            to={`/dashboard/compare?c1=${currency.code}&c2=${currency.code === 'USD' ? 'EUR' : 'USD'}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white px-3.5 py-2 text-xs font-semibold"
          >
            <Scale className="h-3.5 w-3.5" />
            <span>Compare</span>
          </Link>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-surface p-5 space-y-1">
          <p className="text-xs text-[#71717a]">Rate per 1 USD</p>
          <p className="font-mono-num text-2xl font-bold">{currency.rateVsUsd}</p>
        </div>
        <div className="glass-surface p-5 space-y-2">
          <p className="text-xs text-[#71717a]">Strength Score</p>
          <StrengthBar score={currency.strengthScore} />
        </div>
        <div className="glass-surface p-5 space-y-1">
          <p className="text-xs text-[#71717a]">24h / 7d Momentum</p>
          <div className="flex items-center gap-3 pt-1">
            <DeltaText value={currency.change24h} />
            <DeltaText value={currency.change7d} />
          </div>
        </div>
        <div className="glass-surface p-5 space-y-1">
          <p className="text-xs text-[#71717a]">30d Trend</p>
          <div className="pt-1">
            <DeltaText value={currency.change30d} />
          </div>
        </div>
      </div>

      <div className="glass-surface p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold">
            {currency.code === 'USD' ? 'USD Strength Index Curve' : `USD / ${currency.code} Historical Rate`}
          </h2>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg bg-[#f4f4f5] dark:bg-white/5 p-0.5 border border-[#e4e4e7] dark:border-white/10">
              <button
                type="button"
                onClick={() => setChartMode('area')}
                className={`px-2.5 py-1 text-xs rounded-md cursor-pointer ${
                  chartMode === 'area' ? 'bg-white dark:bg-[#27272a] font-medium' : 'text-[#71717a]'
                }`}
              >
                Area
              </button>
              <button
                type="button"
                onClick={() => setChartMode('candles')}
                className={`px-2.5 py-1 text-xs rounded-md cursor-pointer ${
                  chartMode === 'candles' ? 'bg-white dark:bg-[#27272a] font-medium' : 'text-[#71717a]'
                }`}
              >
                Candles
              </button>
            </div>
            {([14, 30, 90, 180] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium border cursor-pointer ${
                  days === d
                    ? 'border-[#3b82f6] bg-[#3b82f6] text-white'
                    : 'border-[#e4e4e7] dark:border-white/10 text-[#71717a]'
                }`}
              >
                {d}D
              </button>
            ))}
          </div>
        </div>
        <TradingViewChart data={series} mode={chartMode} height={360} />
      </div>
    </div>
  );
}

export function CryptoListPage() {
  const { crypto, cryptoHasMore, cryptoLoadingMore, loadMoreCrypto, watchlist, toggleWatchlist } = useVeyra();
  const [search, setSearch] = useState('');
  const [catalogHits, setCatalogHits] = useState<CryptoCatalogEntry[]>([]);
  const [catalogSize, setCatalogSize] = useState<number>(0);
  const [searchingCatalog, setSearchingCatalog] = useState(false);

  const watched = useMemo(
    () => new Set(watchlist.filter((w) => w.asset_type === 'crypto').map((w) => w.symbol.toUpperCase())),
    [watchlist]
  );

  // Server-side search across the cached 10,000+ CoinGecko /coins/list catalog
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) {
      setCatalogHits([]);
      return;
    }
    let active = true;
    setSearchingCatalog(true);
    const timer = window.setTimeout(() => {
      void apiRequest<{ results: CryptoCatalogEntry[]; totalCatalogSize: number }>(
        `/api/market/crypto/search?q=${encodeURIComponent(q)}&limit=12`
      )
        .then((res) => {
          if (active) {
            setCatalogHits(res.results);
            setCatalogSize(res.totalCatalogSize);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (active) setSearchingCatalog(false);
        });
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q
      ? crypto.filter(
          (c) =>
            c.symbol.toLowerCase().includes(q) ||
            c.name.toLowerCase().includes(q) ||
            c.id.toLowerCase().includes(q)
        )
      : crypto;
  }, [crypto, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#09090b] dark:text-white">
            Cryptocurrency Markets
          </h1>
          <p className="text-sm text-[#52525b] dark:text-[#a1a1aa] mt-1">
            Paginated live CoinGecko markets + full catalog search across {catalogSize > 0 ? catalogSize.toLocaleString() : '10,000+'} coins.
          </p>
        </div>
        <div className="relative max-w-sm w-full">
          <Search className="h-4 w-4 text-[#71717a] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search any CoinGecko coin (BTC, SOL, PEPE...)"
            aria-label="Search cryptocurrencies"
            className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/10 bg-white/85 dark:bg-[#18181b]/75 pl-10 pr-4 py-2 text-sm text-[#09090b] dark:text-white focus:outline-none focus:border-[#3b82f6]"
          />
        </div>
      </div>

      {/* Live Full-Catalog Matches when searching */}
      {search.trim().length >= 2 && (catalogHits.length > 0 || searchingCatalog) && (
        <div className="glass-surface p-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-[#71717a]">
            <span className="font-semibold text-[#09090b] dark:text-white">
              Global CoinGecko Catalog Matches
            </span>
            {searchingCatalog && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#3b82f6]" />}
          </div>
          <div className="flex flex-wrap gap-2">
            {catalogHits.map((hit) => (
              <Link
                key={hit.id}
                to={`/dashboard/crypto/${hit.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#e4e4e7] dark:border-white/10 bg-white/80 dark:bg-white/[0.04] hover:border-[#3b82f6] px-3 py-1.5 text-xs transition-colors"
              >
                <span className="font-mono-num font-bold text-[#3b82f6]">{hit.symbol}</span>
                <span className="text-[#52525b] dark:text-[#a1a1aa] truncate max-w-[140px]">{hit.name}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="glass-surface overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#e4e4e7] dark:border-white/10 text-xs font-medium text-[#71717a] dark:text-[#a1a1aa]">
              <th className="py-3.5 px-4">#</th>
              <th className="py-3.5 px-4">Asset</th>
              <th className="py-3.5 px-4 text-right">Price (USD)</th>
              <th className="py-3.5 px-4 text-right">24h Δ</th>
              <th className="py-3.5 px-4 text-right">Market Cap</th>
              <th className="py-3.5 px-4">Strength</th>
              <th className="py-3.5 px-4 text-right">7d Curve</th>
              <th className="py-3.5 px-4 text-right">Watch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e4e4e7]/70 dark:divide-white/5 text-sm">
            {filtered.map((coin) => {
              const isWatched = watched.has(coin.symbol.toUpperCase());
              return (
                <tr key={coin.id} className="hover:bg-[#f4f4f5]/60 dark:hover:bg-white/[0.03] transition-colors">
                  <td className="py-3.5 px-4 font-mono-num text-xs text-[#71717a]">#{coin.market_cap_rank}</td>
                  <td className="py-3.5 px-4">
                    <Link to={`/dashboard/crypto/${coin.id}`} className="group inline-flex items-baseline gap-2">
                      <span className="font-semibold text-[#09090b] dark:text-white group-hover:text-[#3b82f6]">
                        {coin.symbol}
                      </span>
                      <span className="text-xs text-[#71717a] dark:text-[#a1a1aa]">{coin.name}</span>
                    </Link>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono-num font-medium">
                    {formatPrice(coin.current_price)}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <DeltaText value={coin.price_change_percentage_24h} />
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono-num text-xs text-[#52525b] dark:text-[#a1a1aa]">
                    {formatCompactUsd(coin.market_cap)}
                  </td>
                  <td className="py-3.5 px-4">
                    <StrengthBar score={coin.strengthScore} compact />
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex justify-end">
                      <Sparkline data={coin.sparkline} positive={coin.price_change_percentage_7d >= 0} />
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => void toggleWatchlist(coin.symbol, 'crypto')}
                      aria-label={isWatched ? `Unfollow ${coin.symbol}` : `Follow ${coin.symbol}`}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                        isWatched
                          ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]'
                          : 'border-[#e4e4e7] dark:border-white/10 text-[#71717a] hover:text-[#3b82f6]'
                      }`}
                    >
                      <Star className={`h-3.5 w-3.5 ${isWatched ? 'fill-current' : ''}`} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {cryptoHasMore && !search.trim() && (
        <div className="flex justify-center">
          <button
            type="button"
            disabled={cryptoLoadingMore}
            onClick={() => void loadMoreCrypto()}
            className="inline-flex items-center gap-2 rounded-xl border border-[#e4e4e7] dark:border-white/15 px-5 py-2.5 text-xs font-semibold hover:border-[#3b82f6] cursor-pointer disabled:opacity-50"
          >
            {cryptoLoadingMore && <Loader2 className="h-3.5 w-3.5 animate-spin text-[#3b82f6]" />}
            <span>{cryptoLoadingMore ? 'Loading next 100 coins...' : `Load More Cryptocurrencies (Currently ${crypto.length})`}</span>
          </button>
        </div>
      )}
    </div>
  );
}

export function CryptoDetailPage() {
  const { id = 'bitcoin' } = useParams();
  const { crypto, watchlist, toggleWatchlist } = useVeyra();
  const [days, setDays] = useState(30);
  const [chartMode, setChartMode] = useState<'area' | 'candles'>('candles');
  const [series, setSeries] = useState<HistoricalPoint[]>([]);
  const [remoteCoin, setRemoteCoin] = useState<CryptoAsset | null>(null);
  const [loadingCoin, setLoadingCoin] = useState(false);

  const localCoin = crypto.find(
    (c) => c.id.toLowerCase() === id.toLowerCase() || c.symbol.toLowerCase() === id.toLowerCase()
  );
  const coin = localCoin || remoteCoin;

  useEffect(() => {
    if (localCoin) {
      setRemoteCoin(null);
      return;
    }
    let active = true;
    setLoadingCoin(true);
    void apiRequest<{ coin: CryptoAsset }>(`/api/market/crypto/coin/${encodeURIComponent(id)}`)
      .then((res) => {
        if (active) setRemoteCoin(res.coin);
      })
      .catch(() => {
        if (active) setRemoteCoin(null);
      })
      .finally(() => {
        if (active) setLoadingCoin(false);
      });
    return () => {
      active = false;
    };
  }, [id, localCoin]);

  useEffect(() => {
    let active = true;
    void apiRequest<{ series: HistoricalPoint[] }>(`/api/market/history/crypto/${encodeURIComponent(id)}?days=${days}`)
      .then((res) => {
        if (active) setSeries(res.series);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [id, days]);

  if (loadingCoin && !coin) {
    return (
      <div className="glass-surface p-10 text-center text-sm text-[#71717a]">
        Loading live CoinGecko market data...
      </div>
    );
  }

  if (!coin) {
    return (
      <div className="glass-surface p-8 text-center space-y-3">
        <p className="text-sm text-[#52525b] dark:text-[#a1a1aa]">Crypto asset not found.</p>
        <Link to="/dashboard/crypto" className="text-sm font-medium text-[#3b82f6] hover:underline">
          Back to Crypto Markets
        </Link>
      </div>
    );
  }

  const isWatched = watchlist.some(
    (w) => w.asset_type === 'crypto' && w.symbol.toUpperCase() === coin.symbol.toUpperCase()
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            to="/dashboard/crypto"
            className="inline-flex items-center gap-1.5 text-xs text-[#71717a] hover:text-[#3b82f6]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>All Cryptocurrencies</span>
          </Link>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#09090b] dark:text-white">
            {coin.name} ({coin.symbol})
          </h1>
          <p className="text-xs text-[#71717a] dark:text-[#a1a1aa]">
            Market Cap Rank #{coin.market_cap_rank} · Veyra Strength Score {coin.strengthScore}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void toggleWatchlist(coin.symbol, 'crypto')}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-medium cursor-pointer ${
              isWatched
                ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#2563eb] dark:text-[#60a5fa]'
                : 'border-[#e4e4e7] dark:border-white/15 text-[#09090b] dark:text-white'
            }`}
          >
            <Star className={`h-3.5 w-3.5 ${isWatched ? 'fill-current' : ''}`} />
            <span>{isWatched ? 'Following' : 'Watchlist'}</span>
          </button>
          <Link
            to={`/dashboard/compare?c1=${coin.symbol}&c2=${coin.symbol === 'BTC' ? 'ETH' : 'BTC'}`}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white px-3.5 py-2 text-xs font-semibold"
          >
            <Scale className="h-3.5 w-3.5" />
            <span>Compare</span>
          </Link>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-surface p-5 space-y-1">
          <p className="text-xs text-[#71717a]">Live Spot Price (View-Only)</p>
          <p className="font-mono-num text-2xl font-bold">{formatPrice(coin.current_price)}</p>
          <DeltaText value={coin.price_change_percentage_24h} />
        </div>
        <div className="glass-surface p-5 space-y-1">
          <p className="text-xs text-[#71717a]">Market Cap / 24h Volume</p>
          <p className="font-mono-num text-lg font-bold">{formatCompactUsd(coin.market_cap)}</p>
          <p className="font-mono-num text-xs text-[#71717a]">Vol: {formatCompactUsd(coin.total_volume)}</p>
        </div>
        <div className="glass-surface p-5 space-y-1">
          <p className="text-xs text-[#71717a]">24h Range</p>
          <p className="font-mono-num text-sm font-semibold">
            {formatPrice(coin.low_24h)} – {formatPrice(coin.high_24h)}
          </p>
          <p className="text-xs text-[#71717a]">7d Δ: {coin.price_change_percentage_7d.toFixed(2)}%</p>
        </div>
        <div className="glass-surface p-5 space-y-2">
          <p className="text-xs text-[#71717a]">Veyra Strength Score</p>
          <StrengthBar score={coin.strengthScore} />
        </div>
      </div>

      <div className="glass-surface p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-base font-semibold">{coin.symbol} / USD Interactive Chart</h2>
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg bg-[#f4f4f5] dark:bg-white/5 p-0.5 border border-[#e4e4e7] dark:border-white/10">
              <button
                type="button"
                onClick={() => setChartMode('candles')}
                className={`px-2.5 py-1 text-xs rounded-md cursor-pointer ${
                  chartMode === 'candles' ? 'bg-white dark:bg-[#27272a] font-medium' : 'text-[#71717a]'
                }`}
              >
                Candles
              </button>
              <button
                type="button"
                onClick={() => setChartMode('area')}
                className={`px-2.5 py-1 text-xs rounded-md cursor-pointer ${
                  chartMode === 'area' ? 'bg-white dark:bg-[#27272a] font-medium' : 'text-[#71717a]'
                }`}
              >
                Area
              </button>
            </div>
            {([14, 30, 90, 180] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium border cursor-pointer ${
                  days === d
                    ? 'border-[#3b82f6] bg-[#3b82f6] text-white'
                    : 'border-[#e4e4e7] dark:border-white/10 text-[#71717a]'
                }`}
              >
                {d}D
              </button>
            ))}
          </div>
        </div>
        <TradingViewChart data={series} mode={chartMode} height={360} />
      </div>
    </div>
  );
}
