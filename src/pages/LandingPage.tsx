import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart2,
  Check,
  ExternalLink,
  Mail,
  MessageSquare,
  TrendingUp,
} from 'lucide-react';
import { useVeyra } from '../context/VeyraContext';
import { DeltaText, PriceTicker, Sparkline, StrengthBar, ThemeToggle } from '../components/ui/Primitives';
import { formatPrice } from '../lib/core';

export function LandingPage() {
  const { user, strength, fiat, crypto, news, fearGreed } = useVeyra();
  const [previewTab, setPreviewTab] = useState<'fiat' | 'crypto'>('fiat');

  const topFiat = strength.fiat.slice(0, 6);
  const topCrypto = strength.crypto.slice(0, 6);
  const previewRows = previewTab === 'fiat' ? topFiat : topCrypto;
  const tabletMovers = crypto.slice(0, 4);
  const headlinePreview = news.slice(0, 2);

  return (
    <div className="min-h-screen veyra-bg text-[#09090b] dark:text-[#fafafa] flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-[#e4e4e7] dark:border-white/8 bg-white dark:bg-[#0b0d14]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link
            to="/"
            className="font-display text-lg font-semibold tracking-tight text-[#09090b] dark:text-white inline-flex items-center gap-1.5 shrink-0"
          >
            <span>VEYRA</span>
            <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6]" aria-hidden="true" />
          </Link>

          <nav aria-label="Primary" className="hidden md:flex items-center gap-7 text-sm font-medium text-[#52525b] dark:text-[#a1a1aa]">
            <a href="#features" className="hover:text-[#09090b] dark:hover:text-white transition-colors">
              Currencies
            </a>
            <a href="#leaderboard-preview" className="hover:text-[#09090b] dark:hover:text-white transition-colors">
              Crypto
            </a>
            <a href="#leaderboard-preview" className="hover:text-[#09090b] dark:hover:text-white transition-colors">
              Leaderboard
            </a>
            <a href="#features" className="hover:text-[#09090b] dark:hover:text-white transition-colors">
              News
            </a>
            <a href="#pricing" className="hover:text-[#09090b] dark:hover:text-white transition-colors">
              Pricing
            </a>
          </nav>

          <div className="flex items-center gap-2.5 shrink-0">
            <ThemeToggle />
            {user ? (
              <Link
                to="/dashboard/home"
                className="inline-flex items-center gap-1.5 rounded-full bg-[#3b82f6] hover:bg-[#2563eb] text-white px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap"
              >
                <span>Go to Dashboard</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="inline-flex items-center rounded-full border border-[#e4e4e7] dark:border-white/15 bg-white/80 dark:bg-white/[0.06] hover:border-[#3b82f6]/50 px-4 py-2 text-xs font-medium text-[#09090b] dark:text-[#fafafa] transition-colors whitespace-nowrap"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  className="inline-flex items-center rounded-full bg-[#3b82f6] hover:bg-[#2563eb] text-white px-4 py-2 text-xs font-semibold transition-colors whitespace-nowrap"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Live Rate Ticker Bar */}
      <PriceTicker />

      <main className="flex-1">
        {/* Hero Section matching mockup */}
        <section className="relative overflow-hidden pt-12 pb-14 lg:pt-16 lg:pb-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            {/* Left Copy */}
            <div className="lg:col-span-5 space-y-6">
              <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.4rem] font-semibold tracking-tight leading-[1.06] text-[#09090b] dark:text-white">
                Track every currency, compare every move
              </h1>
              <p className="text-base text-[#52525b] dark:text-[#a1a1aa] leading-relaxed max-w-lg">
                Live exchange rates, normalized strength rankings, and macro news across {fiat.length || 160}+ fiat currencies and major digital assets—built strictly for market observation, not trading.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link
                  to={user ? '/dashboard/home' : '/register'}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white px-5 py-3 text-sm font-semibold transition-colors whitespace-nowrap"
                >
                  <span>Launch Dashboard</span>
                </Link>
                <a
                  href="#leaderboard-preview"
                  className="inline-flex items-center gap-2 rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white/85 dark:bg-white/[0.06] hover:border-[#3b82f6]/50 px-5 py-3 text-sm font-semibold text-[#09090b] dark:text-[#fafafa] transition-colors whitespace-nowrap"
                >
                  <span>Explore Leaderboard</span>
                </a>
              </div>
            </div>

            {/* Right Tilted 3D Dashboard Tablet Showcase */}
            <div className="lg:col-span-7 relative hero-tablet-stage">
              <div className="relative hero-tablet-3d rounded-2xl border border-[#d4d4d8] dark:border-white/10 bg-white dark:bg-[#11141c] shadow-[0_18px_48px_-16px_rgba(0,0,0,0.45)] overflow-hidden p-3.5 sm:p-4">
                <div className="grid grid-cols-12 gap-3">
                  {/* Mini Tablet Sidebar */}
                  <div className="hidden sm:flex sm:col-span-3 flex-col justify-between rounded-xl bg-[#f4f4f5]/90 dark:bg-white/[0.04] border border-[#e4e4e7]/80 dark:border-white/8 p-3">
                    <div className="space-y-3">
                      <div className="flex items-center gap-1.5 font-display text-xs font-semibold tracking-tight">
                        <span>VEYRA</span>
                        <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6]" />
                      </div>
                      <div className="space-y-1 text-[11px] font-medium">
                        {['Dashboard', 'Currencies', 'Crypto', 'Leaderboard', 'Watchlist', 'News', 'AI Insights'].map((item, idx) => (
                          <div
                            key={item}
                            className={`rounded-md px-2 py-1.5 ${
                              idx === 0
                                ? 'bg-[#3b82f6]/15 text-[#2563eb] dark:text-[#60a5fa]'
                                : 'text-[#71717a] dark:text-[#a1a1aa]'
                            }`}
                          >
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="text-[10px] text-[#71717a] pt-3 border-t border-[#e4e4e7]/70 dark:border-white/10">
                      Fear &amp; Greed:{' '}
                      <span className="font-mono-num font-semibold text-[#09090b] dark:text-white">
                        {fearGreed ? fearGreed.current.value : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Mini Tablet Main Grid */}
                  <div className="col-span-12 sm:col-span-9 space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <span className="font-display text-xs font-semibold text-[#09090b] dark:text-white">
                        Dashboard · Live Market Overview
                      </span>
                      <span className="font-mono-num text-[10px] text-[#71717a]">
                        {fiat.length || 160} Fiat · {crypto.length || 100} Crypto
                      </span>
                    </div>

                    {/* Top Row: Candlestick Panel + Currency Strength Index */}
                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-7 rounded-xl bg-[#09090b]/[0.03] dark:bg-black/40 border border-[#e4e4e7]/80 dark:border-white/10 p-3">
                        <div className="flex items-center justify-between text-[10px] text-[#71717a] mb-2">
                          <span className="font-semibold text-[#09090b] dark:text-white">BTC / USD</span>
                          <span className="font-mono-num text-[#3b82f6] font-semibold">
                            {crypto[0] ? formatPrice(crypto[0].current_price) : 'Live'}
                          </span>
                        </div>
                        {/* Crisp Stylized Candlestick + Trend SVG */}
                        <svg viewBox="0 0 240 96" className="w-full h-24" aria-hidden="true">
                          <defs>
                            <linearGradient id="veyraBlueArea" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.32" />
                              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          <line x1="0" y1="24" x2="240" y2="24" stroke="currentColor" className="text-[#71717a]/15" strokeDasharray="2 3" />
                          <line x1="0" y1="54" x2="240" y2="54" stroke="currentColor" className="text-[#71717a]/15" strokeDasharray="2 3" />
                          <line x1="0" y1="80" x2="240" y2="80" stroke="currentColor" className="text-[#71717a]/15" strokeDasharray="2 3" />
                          <path
                            d="M6,74 L26,68 L46,72 L66,56 L86,62 L106,44 L126,50 L146,32 L166,38 L186,24 L206,30 L232,16 L232,94 L6,94 Z"
                            fill="url(#veyraBlueArea)"
                          />
                          <polyline
                            fill="none"
                            stroke="#3b82f6"
                            strokeWidth="2"
                            points="6,74 26,68 46,72 66,56 86,62 106,44 126,50 146,32 166,38 186,24 206,30 232,16"
                          />
                          {[
                            [26, 62, 74, true],
                            [46, 64, 78, false],
                            [66, 48, 63, true],
                            [86, 54, 68, false],
                            [106, 38, 52, true],
                            [126, 43, 56, false],
                            [146, 26, 42, true],
                            [166, 30, 44, false],
                            [186, 18, 34, true],
                            [206, 22, 36, false],
                            [226, 12, 26, true],
                          ].map(([x, y1, y2, up], i) => (
                            <g key={i}>
                              <line
                                x1={Number(x)}
                                y1={Number(y1) - 5}
                                x2={Number(x)}
                                y2={Number(y2) + 5}
                                stroke={up ? '#3b82f6' : '#ef4444'}
                                strokeWidth="1"
                              />
                              <rect
                                x={Number(x) - 3}
                                y={Number(y1)}
                                width="6"
                                height={Math.max(5, Number(y2) - Number(y1))}
                                rx="1"
                                fill={up ? '#3b82f6' : '#ef4444'}
                              />
                            </g>
                          ))}
                        </svg>
                      </div>

                      <div className="col-span-5 rounded-xl bg-[#09090b]/[0.03] dark:bg-black/40 border border-[#e4e4e7]/80 dark:border-white/10 p-3 space-y-2">
                        <p className="text-[10px] font-semibold text-[#09090b] dark:text-white">
                          Currency Strength Index
                        </p>
                        <div className="space-y-1.5">
                          {(topFiat.slice(0, 5).length > 0 ? topFiat.slice(0, 5) : []).map((row) => (
                            <div key={row.code} className="space-y-0.5">
                              <div className="flex justify-between text-[10px]">
                                <span className="font-mono-num font-semibold">{row.code}</span>
                                <span className="font-mono-num text-[#71717a]">{row.strengthScore.toFixed(1)}</span>
                              </div>
                              <div className="h-1.5 rounded-full bg-[#e4e4e7] dark:bg-white/10 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-[#3b82f6]"
                                  style={{ width: `${Math.min(100, row.strengthScore)}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Row: Strength Bars + Live Crypto Movers */}
                    <div className="grid grid-cols-12 gap-3">
                      <div className="col-span-5 rounded-xl bg-[#09090b]/[0.03] dark:bg-black/40 border border-[#e4e4e7]/80 dark:border-white/10 p-3">
                        <p className="text-[10px] font-semibold mb-2">Top Basket Bars</p>
                        <div className="flex items-end gap-2 h-16">
                          {topFiat.slice(0, 6).map((row, idx) => (
                            <div key={row.code} className="flex-1 h-full flex flex-col items-center justify-end gap-1">
                              <div
                                className={`w-full rounded-t-sm transition-all ${
                                  idx < 3 ? 'bg-[#3b82f6]' : 'bg-[#71717a]/55'
                                }`}
                                style={{ height: `${Math.max(14, Math.round((row.strengthScore / 100) * 44))}px` }}
                              />
                              <span className="font-mono-num text-[9px] text-[#71717a] leading-none">{row.code}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="col-span-7 rounded-xl bg-[#09090b]/[0.03] dark:bg-black/40 border border-[#e4e4e7]/80 dark:border-white/10 p-3 space-y-1.5">
                        <p className="text-[10px] font-semibold">Live Crypto Benchmarks</p>
                        {tabletMovers.map((coin) => (
                          <div key={coin.id} className="flex items-center justify-between text-[11px]">
                            <span className="font-mono-num font-semibold">{coin.symbol}</span>
                            <span className="font-mono-num text-[#71717a]">{formatPrice(coin.current_price)}</span>
                            <DeltaText value={coin.price_change_percentage_24h} showIcon={false} className="text-[10px]" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Three Frosted-Glass Feature Cards matching mockup */}
        <section id="features" className="pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 grid md:grid-cols-3 gap-5">
            {/* Card 1: Currency Strength Index */}
            <div className="glass-surface-hover p-6 flex flex-col justify-between gap-5">
              <div>
                <h2 className="font-display text-base font-bold text-[#09090b] dark:text-white">
                  Currency Strength Index
                </h2>
                <p className="text-xs text-[#71717a] dark:text-[#a1a1aa] mt-1">
                  Comparative 0–100 ranking across {fiat.length || 160}+ fiat economies and digital assets.
                </p>
              </div>
              <div className="space-y-3">
                {topFiat.slice(0, 3).map((item) => (
                  <div key={item.code} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold">
                        #{item.rank} {item.code}{' '}
                        <span className="font-normal text-[#71717a]">{item.name}</span>
                      </span>
                      <span className="font-mono-num font-semibold text-[#3b82f6]">
                        {item.strengthScore.toFixed(1)}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#e4e4e7] dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#3b82f6]"
                        style={{ width: `${item.strengthScore}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Card 2: Personalized Market News */}
            <div className="glass-surface-hover p-6 flex flex-col justify-between gap-5">
              <div>
                <h2 className="font-display text-base font-bold text-[#09090b] dark:text-white">
                  Personalized Market News
                </h2>
                <p className="text-xs text-[#71717a] dark:text-[#a1a1aa] mt-1">
                  Live macro, central bank, crypto, and tax feeds ranked to your interests.
                </p>
              </div>
              <div className="space-y-3">
                {headlinePreview.length > 0 ? (
                  headlinePreview.map((art) => (
                    <div key={art.id} className="flex items-start gap-2.5 text-xs">
                      <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-[#3b82f6] shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-[#09090b] dark:text-[#fafafa] line-clamp-2">
                          {art.title}
                        </p>
                        <p className="text-[11px] text-[#71717a] mt-0.5">{art.source}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[#71717a]">Live RSS feeds synchronize automatically.</p>
                )}
              </div>
            </div>

            {/* Card 3: AI Market Insights */}
            <div className="glass-surface-hover p-6 flex flex-col justify-between gap-5">
              <div>
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-semibold text-[#09090b] dark:text-white">
                    AI Market Insights
                  </h2>
                  <BarChart2 className="h-4 w-4 text-[#3b82f6]" />
                </div>
                <p className="text-xs text-[#71717a] dark:text-[#a1a1aa] mt-1">
                  Streaming macro &amp; multi-pair synthesis grounded in live Veyra snapshots.
                </p>
              </div>
              <div className="rounded-xl bg-[#f4f4f5]/80 dark:bg-black/35 border border-[#e4e4e7]/80 dark:border-white/10 p-3.5">
                <svg viewBox="0 0 240 68" className="w-full h-16" aria-hidden="true">
                  <path
                    d="M4,56 Q48,46 84,36 T162,24 T236,10"
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth="2.2"
                  />
                  <path
                    d="M4,60 Q52,55 96,46 T174,38 T236,26"
                    fill="none"
                    stroke="#60a5fa"
                    strokeOpacity="0.55"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                </svg>
                <p className="text-[11px] text-[#71717a] mt-1">
                  Informational research only · Never financial advice
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Live Leaderboard Preview */}
        <section id="leaderboard-preview" className="py-14 border-t border-[#e4e4e7]/70 dark:border-white/10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                  Live Strength Leaderboard
                </h2>
                <p className="text-sm text-[#52525b] dark:text-[#a1a1aa] mt-1">
                  Normalized 0–100 strength scores across {fiat.length || 160}+ fiat currencies and top crypto benchmarks.
                </p>
              </div>

              <div className="inline-flex rounded-xl bg-[#f4f4f5] dark:bg-white/5 p-1 border border-[#e4e4e7] dark:border-white/10 self-start">
                <button
                  type="button"
                  onClick={() => setPreviewTab('fiat')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    previewTab === 'fiat'
                      ? 'bg-white dark:bg-[#27272a] text-[#09090b] dark:text-white shadow-xs'
                      : 'text-[#71717a] dark:text-[#a1a1aa]'
                  }`}
                >
                  Fiat ({strength.fiat.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewTab('crypto')}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                    previewTab === 'crypto'
                      ? 'bg-white dark:bg-[#27272a] text-[#09090b] dark:text-white shadow-xs'
                      : 'text-[#71717a] dark:text-[#a1a1aa]'
                  }`}
                >
                  Crypto ({strength.crypto.length})
                </button>
              </div>
            </div>

            <div className="glass-surface overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#e4e4e7] dark:border-white/10 text-xs font-medium text-[#71717a]">
                    <th className="py-3.5 px-5 w-16">Rank</th>
                    <th className="py-3.5 px-5">Asset</th>
                    <th className="py-3.5 px-5 text-right">Live Rate / Spot</th>
                    <th className="py-3.5 px-5">Strength Index</th>
                    <th className="py-3.5 px-5 text-right">24h Δ</th>
                    <th className="py-3.5 px-5 text-right">7d Curve</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e4e4e7]/70 dark:divide-white/5 text-sm">
                  {previewRows.map((entry) => {
                    const fiatObj =
                      entry.assetType === 'fiat'
                        ? fiat.find((f) => f.code === entry.code)
                        : null;
                    return (
                      <tr key={`${entry.assetType}-${entry.code}`} className="hover:bg-[#f4f4f5]/60 dark:hover:bg-white/[0.03]">
                        <td className="py-3.5 px-5 font-mono-num text-xs font-semibold text-[#71717a]">
                          #{entry.rank}
                        </td>
                        <td className="py-3.5 px-5">
                          <span className="font-semibold text-[#09090b] dark:text-white">
                            {fiatObj?.flag ? `${fiatObj.flag} ` : ''}
                            {entry.code}
                          </span>
                          <span className="ml-2 text-xs text-[#71717a]">{entry.name}</span>
                        </td>
                        <td className="py-3.5 px-5 text-right font-mono-num text-sm">
                          {entry.assetType === 'crypto'
                            ? formatPrice(entry.vsUsdRate)
                            : `${entry.vsUsdRate} / USD`}
                        </td>
                        <td className="py-3.5 px-5">
                          <StrengthBar score={entry.strengthScore} compact />
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <DeltaText value={entry.change24h} />
                        </td>
                        <td className="py-3.5 px-5">
                          <div className="flex justify-end">
                            <Sparkline data={entry.sparkline} positive={entry.change7d >= 0} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end">
              <Link
                to={user ? '/dashboard/leaderboard' : '/register'}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#3b82f6] hover:underline"
              >
                <span>Open full {fiat.length || 160}+ currency &amp; crypto leaderboard</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Pricing Section (Free vs Pro ₹200/month — exact manual payment details) */}
        <section id="pricing" className="py-16 border-t border-[#e4e4e7]/70 dark:border-white/10">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 space-y-10">
            <div className="text-center max-w-2xl mx-auto space-y-2">
              <h2 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight">
                Transparent Plans. Zero Card Storage.
              </h2>
              <p className="text-sm text-[#52525b] dark:text-[#a1a1aa]">
                Core market tools and 5 AI analyses every 2 days are free. Upgrade to Pro for unlimited AI market analysis.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Free Tier */}
              <div className="glass-surface p-7 flex flex-col justify-between gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-display text-lg font-semibold">Veyra Free</h3>
                    <p className="mt-1 flex items-baseline gap-1">
                      <span className="font-mono-num text-3xl font-semibold">₹0</span>
                      <span className="text-xs text-[#71717a]">/ forever</span>
                    </p>
                  </div>
                  <ul className="space-y-2.5 text-sm text-[#52525b] dark:text-[#a1a1aa]">
                    {[
                      'All 160+ fiat currencies with live USD rates & flags',
                      '10,000+ searchable cryptocurrency catalog',
                      'Currency Strength Leaderboard & Regional Heatmap',
                      '5 AI market analyses every 2 days with live charts',
                      'Personal Watchlist, Price Alerts & Personalized News',
                    ].map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-[#3b82f6] shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  to={user ? '/dashboard/home' : '/register'}
                  className="w-full text-center rounded-xl border border-[#e4e4e7] dark:border-white/15 hover:border-[#3b82f6] py-2.5 text-sm font-semibold transition-colors"
                >
                  {user ? 'Open Dashboard' : 'Create Free Account'}
                </Link>
              </div>

              {/* Pro Tier */}
              <div className="glass-surface p-7 border-[#3b82f6]/45 flex flex-col justify-between gap-6 relative">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-semibold">Veyra Pro</h3>
                    <span className="text-xs font-semibold text-[#3b82f6]">Manual Activation</span>
                  </div>
                  <p className="flex items-baseline gap-1">
                    <span className="font-mono-num text-3xl font-semibold">₹200</span>
                    <span className="text-xs text-[#71717a]">/ month</span>
                  </p>
                  <p className="text-xs font-medium text-[#09090b] dark:text-[#fafafa]">
                    Pro is ₹200/month. Payments are handled manually.
                  </p>
                  <ul className="space-y-2.5 text-sm text-[#52525b] dark:text-[#a1a1aa]">
                    {[
                      'Everything in Veyra Free',
                      'Unlimited AI Market Analysis grounded in live rates',
                      'Saved AI research history & multi-pair briefings',
                      'Discord bot /analyze command access',
                      'No recurring auto-debit or credit card storage',
                    ].map((feat) => (
                      <li key={feat} className="flex items-start gap-2.5">
                        <Check className="h-4 w-4 text-[#3b82f6] shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="rounded-xl bg-[#f4f4f5]/90 dark:bg-white/[0.04] border border-[#e4e4e7] dark:border-white/10 p-4 space-y-2 text-xs">
                    <p className="font-semibold text-[#09090b] dark:text-white">How to pay &amp; activate Pro:</p>
                    <div className="flex items-center gap-2 text-[#52525b] dark:text-[#a1a1aa]">
                      <MessageSquare className="h-3.5 w-3.5 text-[#3b82f6] shrink-0" />
                      <span>
                        Discord: <strong className="font-mono-num text-[#09090b] dark:text-white">statusbrew</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[#52525b] dark:text-[#a1a1aa]">
                      <Mail className="h-3.5 w-3.5 text-[#3b82f6] shrink-0" />
                      <a href="mailto:akshatbhopali@gmail.com" className="font-mono-num text-[#3b82f6] hover:underline">
                        akshatbhopali@gmail.com
                      </a>
                    </div>
                    <div className="flex items-center gap-2 text-[#52525b] dark:text-[#a1a1aa]">
                      <ExternalLink className="h-3.5 w-3.5 text-[#3b82f6] shrink-0" />
                      <a
                        href="https://supportme-akshat.netlify.app/supportme"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#3b82f6] hover:underline break-all"
                      >
                        supportme-akshat.netlify.app/supportme
                      </a>
                    </div>
                  </div>
                </div>

                <Link
                  to={user ? '/dashboard/settings/subscription' : '/register'}
                  className="w-full text-center rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white py-2.5 text-sm font-semibold transition-colors"
                >
                  {user ? 'Request Pro Activation' : 'Get Started with Pro'}
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer — ZERO admin links anywhere */}
      <footer className="border-t border-[#e4e4e7] dark:border-white/10 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-xs text-[#71717a] dark:text-[#a1a1aa]">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 font-display text-sm font-bold text-[#09090b] dark:text-white">
              <TrendingUp className="h-4 w-4 text-[#3b82f6]" />
              <span>VEYRA</span>
            </div>
            <p className="max-w-md">
              Veyra is a strictly view-only market intelligence platform. It does not facilitate trading, swaps, custody, or financial advice.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6">
            <Link to="/privacy" className="hover:text-[#09090b] dark:hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <Link to="/terms" className="hover:text-[#09090b] dark:hover:text-white transition-colors">
              Terms &amp; Conditions
            </Link>
            <a
              href="https://supportme-akshat.netlify.app/supportme"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#09090b] dark:hover:text-white transition-colors"
            >
              Support
            </a>
            <a
              href="mailto:akshatbhopali@gmail.com"
              className="hover:text-[#09090b] dark:hover:text-white transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
