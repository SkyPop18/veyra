import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowUpDown, Plus, Scale, Search, Star } from 'lucide-react';
import { useVeyra } from '../../context/VeyraContext';
import { DeltaText, Sparkline, StrengthBar } from '../../components/ui/Primitives';
import { compareStrengthEntries } from '../../lib/core';
import { apiRequest } from '../../lib/api';
import type { CryptoAsset, CryptoCatalogEntry, HistoricalPoint, StrengthEntry } from '../../types/veyra';

export function LeaderboardPage() {
  const { strength, fiat, watchlist, toggleWatchlist } = useVeyra();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'fiat' | 'crypto'>('fiat');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'rank' | 'change24h' | 'change7d'>('rank');
  const [selectedCompare, setSelectedCompare] = useState<string[]>([]);
  const [limit, setLimit] = useState(50);

  const fiatFlagMap = useMemo(() => new Map(fiat.map((f) => [f.code, f.flag || ''])), [fiat]);
  const watchedSet = useMemo(
    () => new Set(watchlist.map((w) => `${w.asset_type}:${w.symbol.toUpperCase()}`)),
    [watchlist]
  );

  const rows = useMemo(() => {
    const base = tab === 'fiat' ? strength.fiat : strength.crypto;
    const q = search.trim().toLowerCase();
    const filtered = q
      ? base.filter((r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
      : base;

    return [...filtered].sort((a, b) => {
      if (sortBy === 'change24h') return b.change24h - a.change24h;
      if (sortBy === 'change7d') return b.change7d - a.change7d;
      return a.rank - b.rank;
    });
  }, [tab, strength.fiat, strength.crypto, search, sortBy]);

  const displayed = rows.slice(0, limit);

  const toggleSelectCompare = (code: string) => {
    setSelectedCompare((prev) =>
      prev.includes(code)
        ? prev.filter((c) => c !== code)
        : prev.length >= 4
          ? [...prev.slice(1), code]
          : [...prev, code]
    );
  };

  const launchCompare = () => {
    const params = new URLSearchParams();
    selectedCompare.forEach((c, idx) => params.set(`c${idx + 1}`, c));
    navigate(`/dashboard/compare?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#09090b] dark:text-white">
            Currency Strength Leaderboard
          </h1>
          <p className="text-sm text-[#52525b] dark:text-[#a1a1aa] mt-1">
            Normalized 0–100 strength across {strength.fiat.length} fiat currencies and top crypto benchmarks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {selectedCompare.length >= 2 && (
            <button
              type="button"
              onClick={launchCompare}
              className="inline-flex items-center gap-2 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white px-4 py-2 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Scale className="h-3.5 w-3.5" />
              <span>Compare ({selectedCompare.join(' vs ')})</span>
            </button>
          )}

          <div className="inline-flex rounded-lg bg-[#f4f4f5] dark:bg-white/5 p-1 border border-[#e4e4e7] dark:border-white/10">
            <button
              type="button"
              onClick={() => {
                setTab('fiat');
                setLimit(50);
              }}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                tab === 'fiat'
                  ? 'bg-white dark:bg-[#27272a] text-[#09090b] dark:text-white shadow-xs'
                  : 'text-[#71717a] dark:text-[#a1a1aa]'
              }`}
            >
              Fiat Currencies ({strength.fiat.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('crypto');
                setLimit(50);
              }}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                tab === 'crypto'
                  ? 'bg-white dark:bg-[#27272a] text-[#09090b] dark:text-white shadow-xs'
                  : 'text-[#71717a] dark:text-[#a1a1aa]'
              }`}
            >
              Cryptocurrencies ({strength.crypto.length})
            </button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative max-w-sm w-full">
          <Search className="h-4 w-4 text-[#71717a] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Filter ${tab === 'fiat' ? 'any of 160+ fiat currencies...' : 'top crypto benchmarks...'}`}
            aria-label="Filter leaderboard assets"
            className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/10 bg-white/85 dark:bg-[#18181b]/75 pl-10 pr-4 py-2 text-sm text-[#09090b] dark:text-white focus:outline-none focus:border-[#3b82f6]"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#71717a] dark:text-[#a1a1aa]">Sort by:</span>
          {(['rank', 'change24h', 'change7d'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setSortBy(key)}
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 font-medium border transition-colors cursor-pointer ${
                sortBy === key
                  ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#2563eb] dark:text-[#60a5fa]'
                  : 'border-[#e4e4e7] dark:border-white/10 text-[#52525b] dark:text-[#a1a1aa]'
              }`}
            >
              <ArrowUpDown className="h-3 w-3" />
              <span>{key === 'rank' ? 'Strength' : key === 'change24h' ? '24h Δ' : '7d Δ'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Ranked Leaderboard Table */}
      <div className="glass-surface overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#e4e4e7] dark:border-white/10 text-xs font-medium text-[#71717a] dark:text-[#a1a1aa]">
              <th className="py-3.5 px-4 w-14">Rank</th>
              <th className="py-3.5 px-4">Currency</th>
              <th className="py-3.5 px-4">Strength Score</th>
              <th className="py-3.5 px-4 text-right">24h Δ</th>
              <th className="py-3.5 px-4 text-right">7d Δ</th>
              <th className="py-3.5 px-4 text-right">7d Curve</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e4e4e7]/70 dark:divide-white/5 text-sm">
            {displayed.map((entry) => {
              const detailPath =
                entry.assetType === 'fiat'
                  ? `/dashboard/currencies/${entry.code}`
                  : `/dashboard/crypto/${entry.id}`;
              const watched = watchedSet.has(`${entry.assetType}:${entry.code}`);
              const picked = selectedCompare.includes(entry.code);
              const flag = entry.assetType === 'fiat' ? fiatFlagMap.get(entry.code) : '';

              return (
                <tr key={`${entry.assetType}-${entry.id}`} className="hover:bg-[#f4f4f5]/60 dark:hover:bg-white/[0.03] transition-colors">
                  <td className="py-3.5 px-4 font-mono-num text-xs font-semibold text-[#71717a]">
                    #{entry.rank}
                  </td>
                  <td className="py-3.5 px-4">
                    <Link to={detailPath} className="group inline-flex items-baseline gap-2">
                      <span className="font-semibold text-[#09090b] dark:text-white group-hover:text-[#3b82f6] transition-colors">
                        {flag ? `${flag} ` : ''}
                        {entry.code}
                      </span>
                      <span className="text-xs text-[#71717a] dark:text-[#a1a1aa]">{entry.name}</span>
                    </Link>
                  </td>
                  <td className="py-3.5 px-4">
                    <StrengthBar score={entry.strengthScore} />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <DeltaText value={entry.change24h} />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <DeltaText value={entry.change7d} />
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex justify-end">
                      <Sparkline data={entry.sparkline} positive={entry.change7d >= 0} />
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void toggleWatchlist(entry.code, entry.assetType)}
                        aria-label={watched ? `Remove ${entry.code} from watchlist` : `Add ${entry.code} to watchlist`}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                          watched
                            ? 'border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]'
                            : 'border-[#e4e4e7] dark:border-white/10 text-[#71717a] hover:text-[#3b82f6]'
                        }`}
                      >
                        <Star className={`h-3.5 w-3.5 ${watched ? 'fill-current' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleSelectCompare(entry.code)}
                        className={`rounded-lg px-2.5 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
                          picked
                            ? 'border-[#3b82f6] bg-[#3b82f6] text-white'
                            : 'border-[#e4e4e7] dark:border-white/10 text-[#52525b] dark:text-[#d4d4d8] hover:border-[#3b82f6]/50'
                        }`}
                      >
                        {picked ? 'Selected' : 'Compare'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length > limit && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setLimit((l) => l + 60)}
            className="rounded-xl border border-[#e4e4e7] dark:border-white/15 px-5 py-2.5 text-xs font-semibold hover:border-[#3b82f6] cursor-pointer"
          >
            Show More ({rows.length - limit} remaining)
          </button>
        </div>
      )}
    </div>
  );
}

const COMPARE_COLORS = ['#3b82f6', '#09090b', '#60a5fa', '#71717a'];
const COMPARE_COLORS_DARK = ['#3b82f6', '#fafafa', '#60a5fa', '#a1a1aa'];

export function ComparePage() {
  const { strength, theme, notify } = useVeyra();
  const [searchParams] = useSearchParams();

  const [codes, setCodes] = useState<string[]>(() => {
    const fromUrl = [
      searchParams.get('c1'),
      searchParams.get('c2'),
      searchParams.get('c3'),
      searchParams.get('c4'),
    ].filter((c): c is string => Boolean(c));
    return fromUrl.length >= 2 ? fromUrl : ['USD', 'EUR'];
  });
  const [extraEntries, setExtraEntries] = useState<StrengthEntry[]>([]);
  const [catalogQuery, setCatalogQuery] = useState('');
  const [catalogHits, setCatalogHits] = useState<CryptoCatalogEntry[]>([]);
  const [days, setDays] = useState<number>(30);
  const [seriesMap, setSeriesMap] = useState<Record<string, HistoricalPoint[]>>({});

  const allOptions = useMemo(() => {
    const seen = new Set(strength.all.map((e) => `${e.assetType}:${e.code.toUpperCase()}`));
    return [...strength.all, ...extraEntries.filter((e) => !seen.has(`${e.assetType}:${e.code.toUpperCase()}`))];
  }, [strength.all, extraEntries]);

  useEffect(() => {
    const q = catalogQuery.trim();
    if (q.length < 2) {
      setCatalogHits([]);
      return;
    }
    let active = true;
    const t = window.setTimeout(() => {
      void apiRequest<{ results: CryptoCatalogEntry[] }>(`/api/market/crypto/search?q=${encodeURIComponent(q)}&limit=8`)
        .then((res) => {
          if (active) setCatalogHits(res.results);
        })
        .catch(() => {});
    }, 220);
    return () => {
      active = false;
      window.clearTimeout(t);
    };
  }, [catalogQuery]);

  const addCatalogCoin = async (hit: CryptoCatalogEntry) => {
    try {
      const res = await apiRequest<{ coin: CryptoAsset }>(`/api/market/crypto/coin/${encodeURIComponent(hit.id)}`);
      const c = res.coin;
      const entry: StrengthEntry = {
        code: c.symbol,
        id: c.id,
        name: c.name,
        assetType: 'crypto',
        strengthScore: c.strengthScore,
        rank: c.market_cap_rank,
        change24h: c.price_change_percentage_24h,
        change7d: c.price_change_percentage_7d,
        vsUsdRate: c.current_price,
        sparkline: c.sparkline,
      };
      setExtraEntries((prev) => [...prev.filter((x) => x.id !== entry.id), entry]);
      setCodes((prev) => (prev.length >= 4 ? [...prev.slice(0, 3), entry.code] : [...prev, entry.code]));
      setCatalogQuery('');
      setCatalogHits([]);
      notify(`Loaded ${entry.name} (${entry.code}) into Compare.`, 'success');
    } catch {
      notify('Unable to load that coin right now.', 'error');
    }
  };

  const selectedEntries: StrengthEntry[] = useMemo(() => {
    return codes
      .map((code) => allOptions.find((e) => e.code.toUpperCase() === code.toUpperCase()))
      .filter((e): e is StrengthEntry => Boolean(e));
  }, [codes, allOptions]);

  useEffect(() => {
    let active = true;
    const loadAll = async () => {
      const next: Record<string, HistoricalPoint[]> = {};
      await Promise.all(
        selectedEntries.map(async (entry) => {
          try {
            const res = await apiRequest<{ series: HistoricalPoint[] }>(
              `/api/market/history/${entry.assetType}/${entry.assetType === 'crypto' ? entry.id : entry.code}?days=${days}`
            );
            next[entry.code] = res.series;
          } catch {
            next[entry.code] = [];
          }
        })
      );
      if (active) setSeriesMap(next);
    };
    if (selectedEntries.length > 0) {
      void loadAll();
    }
    return () => {
      active = false;
    };
  }, [selectedEntries, days]);

  const overlayData = useMemo(() => {
    const primaryCode = selectedEntries[0]?.code;
    const baseSeries = primaryCode ? seriesMap[primaryCode] || [] : [];
    return baseSeries.map((pt, idx) => {
      const row: Record<string, string | number> = { date: pt.time.slice(5) };
      for (const entry of selectedEntries) {
        const s = seriesMap[entry.code];
        if (s && s[idx] && s[0]?.close) {
          row[entry.code] = Number(((s[idx].close / s[0].close) * 100).toFixed(2));
        }
      }
      return row;
    });
  }, [selectedEntries, seriesMap]);

  const verdict =
    selectedEntries.length >= 2
      ? compareStrengthEntries(selectedEntries[0], selectedEntries[1])
      : null;

  const updateSlot = (index: number, newCode: string) => {
    setCodes((prev) => {
      const next = [...prev];
      next[index] = newCode;
      return next;
    });
  };

  const addSlot = () => {
    if (codes.length >= 4) return;
    const candidate = allOptions.find((e) => !codes.includes(e.code))?.code || 'GBP';
    setCodes((prev) => [...prev, candidate]);
  };

  const removeSlot = (index: number) => {
    if (codes.length <= 2) return;
    setCodes((prev) => prev.filter((_, i) => i !== index));
  };

  const linePalette = theme === 'dark' ? COMPARE_COLORS_DARK : COMPARE_COLORS;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#09090b] dark:text-white">
            Head-to-Head Currency Comparison
          </h1>
          <p className="text-sm text-[#52525b] dark:text-[#a1a1aa] mt-1">
            Compare 2 to 4 assets across all {strength.fiat.length} fiat currencies or any of 10,000+ CoinGecko coins.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {([7, 30, 90, 365] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors cursor-pointer ${
                days === d
                  ? 'border-[#3b82f6] bg-[#3b82f6] text-white'
                  : 'border-[#e4e4e7] dark:border-white/10 text-[#52525b] dark:text-[#a1a1aa]'
              }`}
            >
              {d === 7 ? '1W' : d === 30 ? '1M' : d === 90 ? '3M' : '1Y'}
            </button>
          ))}
        </div>
      </div>

      {/* Asset Selectors + Search Any CoinGecko Coin */}
      <div className="glass-surface p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {codes.map((code, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <label htmlFor={`compare-slot-${idx}`} className="sr-only">
                Currency slot {idx + 1}
              </label>
              <select
                id={`compare-slot-${idx}`}
                value={code}
                onChange={(e) => updateSlot(idx, e.target.value)}
                className="rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3.5 py-2 text-sm font-medium text-[#09090b] dark:text-white focus:outline-none focus:border-[#3b82f6] max-w-[230px]"
              >
                {allOptions.map((opt) => (
                  <option key={`${opt.assetType}-${opt.id}`} value={opt.code}>
                    {opt.code} — {opt.name} ({opt.assetType.toUpperCase()})
                  </option>
                ))}
              </select>
              {codes.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeSlot(idx)}
                  aria-label={`Remove slot ${idx + 1}`}
                  className="text-xs text-[#71717a] hover:text-[#ef4444] cursor-pointer px-1"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {codes.length < 4 && (
            <button
              type="button"
              onClick={addSlot}
              className="rounded-xl border border-dashed border-[#3b82f6]/50 px-3.5 py-2 text-xs font-medium text-[#2563eb] dark:text-[#60a5fa] hover:bg-[#3b82f6]/10 transition-colors cursor-pointer"
            >
              + Add Asset
            </button>
          )}
        </div>

        {/* On-demand search for any of the 10,000+ CoinGecko coins */}
        <div className="relative max-w-md">
          <Search className="h-3.5 w-3.5 text-[#71717a] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={catalogQuery}
            onChange={(e) => setCatalogQuery(e.target.value)}
            placeholder="Search any crypto from full CoinGecko catalog to add..."
            aria-label="Add any CoinGecko crypto to compare"
            className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/10 bg-white/80 dark:bg-[#09090b] pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-[#3b82f6]"
          />
          {catalogHits.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {catalogHits.map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  onClick={() => void addCatalogCoin(hit)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#3b82f6]/35 bg-[#3b82f6]/10 px-2.5 py-1 text-[11px] font-medium text-[#2563eb] dark:text-[#60a5fa] hover:bg-[#3b82f6]/20 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>{hit.symbol} ({hit.name})</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {verdict && (
          <div className="rounded-xl bg-[#3b82f6]/10 border border-[#3b82f6]/25 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-[#2563eb] dark:text-[#60a5fa]">Strength Verdict</p>
              <p className="text-sm font-semibold text-[#09090b] dark:text-white mt-0.5">{verdict.summary}</p>
            </div>
            <span className="font-mono-num text-xs font-bold text-[#2563eb] dark:text-[#93c5fd] whitespace-nowrap">
              +{verdict.relativePctStronger.toFixed(1)}% Delta
            </span>
          </div>
        )}
      </div>

      {/* Side-by-Side Cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {selectedEntries.map((entry, idx) => (
          <div key={`${entry.assetType}-${entry.id}`} className="glass-surface p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-display text-lg font-bold text-[#09090b] dark:text-white">{entry.code}</p>
                <p className="text-xs text-[#71717a] dark:text-[#a1a1aa]">{entry.name}</p>
              </div>
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: linePalette[idx % linePalette.length] }}
                aria-hidden="true"
              />
            </div>
            <StrengthBar score={entry.strengthScore} />
            <div className="flex items-center justify-between text-xs pt-1 border-t border-[#e4e4e7]/70 dark:border-white/5">
              <span className="text-[#71717a]">24h / 7d</span>
              <div className="flex items-center gap-2">
                <DeltaText value={entry.change24h} showIcon={false} />
                <span className="text-[#71717a]">/</span>
                <DeltaText value={entry.change7d} showIcon={false} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Overlay Indexed Performance Chart */}
      <div className="glass-surface p-6 space-y-3">
        <div>
          <h2 className="font-display text-base font-semibold text-[#09090b] dark:text-white">
            Indexed Relative Performance (Base = 100)
          </h2>
          <p className="text-xs text-[#71717a] dark:text-[#a1a1aa]">
            Tracks percentage divergence over the selected {days}-day horizon.
          </p>
        </div>

        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={overlayData} margin={{ top: 10, right: 16, left: -10, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={theme === 'dark' ? 'rgba(255,255,255,0.08)' : '#e4e4e7'}
              />
              <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: theme === 'dark' ? '#18181b' : '#ffffff',
                  borderColor: theme === 'dark' ? 'rgba(255,255,255,0.12)' : '#e4e4e7',
                  borderRadius: '12px',
                  fontSize: '12px',
                }}
              />
              <Legend />
              {selectedEntries.map((entry, idx) => (
                <Line
                  key={`${entry.assetType}-${entry.id}`}
                  type="monotone"
                  dataKey={entry.code}
                  stroke={linePalette[idx % linePalette.length]}
                  strokeWidth={2.2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
