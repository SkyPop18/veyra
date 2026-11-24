import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowLeftRight,
  Bell,
  Compass,
  ExternalLink,
  Eye,
  Globe,
  Layers,
  MapPin,
  Maximize2,
  Minus,
  Move,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useVeyra } from '../../context/VeyraContext';
import { DeltaText, Sparkline, StrengthBar } from '../../components/ui/Primitives';
import { convertAmount, formatPrice } from '../../lib/core';
import { apiRequest } from '../../lib/api';
import { WORLD_MAP_SVG_PATH } from '../../lib/worldMapPath';
import type { CryptoAsset, CryptoCatalogEntry, FiatCurrency, PriceAlertItem } from '../../types/veyra';

export function ConverterPage() {
  const { fiat, crypto, notify } = useVeyra();
  const [amount, setAmount] = useState('1000');
  const [fromCode, setFromCode] = useState('USD');
  const [toCode, setToCode] = useState('INR');
  const [extraCrypto, setExtraCrypto] = useState<CryptoAsset[]>([]);
  const [coinSearch, setCoinSearch] = useState('');
  const [coinHits, setCoinHits] = useState<CryptoCatalogEntry[]>([]);

  useEffect(() => {
    const q = coinSearch.trim();
    if (q.length < 2) {
      setCoinHits([]);
      return;
    }
    let active = true;
    const t = window.setTimeout(() => {
      void apiRequest<{ results: CryptoCatalogEntry[] }>(`/api/market/crypto/search?q=${encodeURIComponent(q)}&limit=8`)
        .then((res) => {
          if (active) setCoinHits(res.results);
        })
        .catch(() => {});
    }, 220);
    return () => {
      active = false;
      window.clearTimeout(t);
    };
  }, [coinSearch]);

  const loadCustomCoin = async (hit: CryptoCatalogEntry, targetSlot: 'from' | 'to') => {
    try {
      const res = await apiRequest<{ coin: CryptoAsset }>(`/api/market/crypto/coin/${encodeURIComponent(hit.id)}`);
      setExtraCrypto((prev) => [...prev.filter((c) => c.id !== res.coin.id), res.coin]);
      if (targetSlot === 'from') setFromCode(res.coin.symbol.toUpperCase());
      else setToCode(res.coin.symbol.toUpperCase());
      setCoinSearch('');
      setCoinHits([]);
      notify(`Added ${res.coin.name} (${res.coin.symbol}) to converter.`, 'success');
    } catch {
      notify('Could not fetch live quote for that coin.', 'error');
    }
  };

  const options = useMemo(() => {
    const fiatOpts = fiat.map((f) => ({
      code: f.code,
      label: `${f.flag ? `${f.flag} ` : ''}${f.code} — ${f.name} (Fiat)`,
      unitsPerUsd: f.rateVsUsd,
    }));
    const seenCrypto = new Set<string>();
    const combinedCrypto = [...crypto, ...extraCrypto].filter((c) => {
      const sym = c.symbol.toUpperCase();
      if (seenCrypto.has(sym)) return false;
      seenCrypto.add(sym);
      return c.current_price > 0;
    });
    const cryptoOpts = combinedCrypto.map((c) => ({
      code: c.symbol.toUpperCase(),
      label: `${c.symbol.toUpperCase()} — ${c.name} (Crypto)`,
      unitsPerUsd: 1 / c.current_price,
    }));
    return [...fiatOpts, ...cryptoOpts];
  }, [fiat, crypto, extraCrypto]);

  const fromOpt = options.find((o) => o.code === fromCode) || options[0];
  const toOpt = options.find((o) => o.code === toCode) || options[1];

  const numericAmount = Number(amount) || 0;
  const converted =
    fromOpt && toOpt ? convertAmount(numericAmount, fromOpt.unitsPerUsd, toOpt.unitsPerUsd) : 0;
  const unitRate =
    fromOpt && toOpt ? convertAmount(1, fromOpt.unitsPerUsd, toOpt.unitsPerUsd) : 0;

  const swapDirection = () => {
    setFromCode(toCode);
    setToCode(fromCode);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#09090b] dark:text-white">
          Currency Rate Converter
        </h1>
        <p className="text-sm text-[#52525b] dark:text-[#a1a1aa] mt-1">
          Live reference conversion across all {fiat.length} fiat currencies and any CoinGecko cryptocurrency.
        </p>
      </div>

      <div className="glass-surface p-6 sm:p-8 space-y-6">
        <div className="grid sm:grid-cols-12 gap-4 items-end">
          <div className="sm:col-span-5 space-y-1.5">
            <label htmlFor="conv-from" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
              From Currency
            </label>
            <select
              id="conv-from"
              value={fromCode}
              onChange={(e) => setFromCode(e.target.value)}
              className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-[#3b82f6]"
            >
              {options.map((o) => (
                <option key={`from-${o.code}`} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 flex justify-center">
            <button
              type="button"
              onClick={swapDirection}
              aria-label="Reverse conversion pair"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-white/5 hover:border-[#3b82f6] text-[#3b82f6] transition-colors cursor-pointer"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </button>
          </div>

          <div className="sm:col-span-5 space-y-1.5">
            <label htmlFor="conv-to" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
              To Currency
            </label>
            <select
              id="conv-to"
              value={toCode}
              onChange={(e) => setToCode(e.target.value)}
              className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3.5 py-2.5 text-sm font-medium focus:outline-none focus:border-[#3b82f6]"
            >
              {options.map((o) => (
                <option key={`to-${o.code}`} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search any CoinGecko crypto on demand */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-[#71717a] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={coinSearch}
              onChange={(e) => setCoinSearch(e.target.value)}
              placeholder="Need another coin? Search full 10,000+ CoinGecko catalog..."
              aria-label="Search full cryptocurrency catalog for converter"
              className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/10 bg-white/80 dark:bg-[#09090b] pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-[#3b82f6]"
            />
          </div>
          {coinHits.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {coinHits.map((hit) => (
                <div
                  key={hit.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#e4e4e7] dark:border-white/10 bg-[#f4f4f5]/80 dark:bg-white/[0.04] px-2.5 py-1 text-[11px]"
                >
                  <span className="font-mono-num font-bold">{hit.symbol}</span>
                  <span className="text-[#71717a] truncate max-w-[110px]">{hit.name}</span>
                  <button
                    type="button"
                    onClick={() => void loadCustomCoin(hit, 'from')}
                    className="text-[#3b82f6] font-semibold hover:underline cursor-pointer"
                  >
                    From
                  </button>
                  <span className="text-[#71717a]">·</span>
                  <button
                    type="button"
                    onClick={() => void loadCustomCoin(hit, 'to')}
                    className="text-[#3b82f6] font-semibold hover:underline cursor-pointer"
                  >
                    To
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="conv-amount" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
            Reference Amount ({fromCode})
          </label>
          <input
            id="conv-amount"
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-4 py-3 font-mono-num text-xl font-semibold focus:outline-none focus:border-[#3b82f6]"
          />
          <div className="flex flex-wrap gap-2 pt-1">
            {['1', '100', '1000', '10000'].map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setAmount(preset)}
                className="rounded-lg border border-[#e4e4e7] dark:border-white/10 px-2.5 py-1 text-xs font-mono-num text-[#52525b] dark:text-[#a1a1aa] hover:border-[#3b82f6] cursor-pointer"
              >
                {Number(preset).toLocaleString()}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl bg-[#f4f4f5]/90 dark:bg-white/[0.04] border border-[#e4e4e7] dark:border-white/10 p-5 space-y-1.5">
          <p className="text-xs text-[#71717a] dark:text-[#a1a1aa]">
            {numericAmount.toLocaleString()} {fromCode} equals
          </p>
          <p data-testid="converted-result" className="font-mono-num text-3xl font-bold text-[#2563eb] dark:text-[#60a5fa]">
            {converted.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: converted < 1 ? 6 : 4,
            })}{' '}
            {toCode}
          </p>
          <p className="font-mono-num text-xs text-[#71717a] dark:text-[#a1a1aa]">
            1 {fromCode} = {unitRate.toLocaleString('en-US', { maximumFractionDigits: 6 })} {toCode}
          </p>
        </div>
      </div>
    </div>
  );
}

// Global world coordinates for tracked currencies
const CURRENCY_GEO_COORDS: Record<string, { lat: number; lng: number; country: string }> = {
  // North America
  USD: { lat: 38.9, lng: -77.0, country: 'United States' },
  CAD: { lat: 45.4, lng: -75.7, country: 'Canada' },
  MXN: { lat: 19.4, lng: -99.1, country: 'Mexico' },
  CRC: { lat: 9.9, lng: -84.1, country: 'Costa Rica' },
  DOP: { lat: 18.5, lng: -69.9, country: 'Dominican Republic' },
  GTQ: { lat: 14.6, lng: -90.5, country: 'Guatemala' },
  HNL: { lat: 14.1, lng: -87.2, country: 'Honduras' },
  JMD: { lat: 18.0, lng: -76.8, country: 'Jamaica' },
  PAB: { lat: 9.0, lng: -79.5, country: 'Panama' },
  TTD: { lat: 10.7, lng: -61.5, country: 'Trinidad and Tobago' },

  // South America
  BRL: { lat: -15.8, lng: -47.9, country: 'Brazil' },
  ARS: { lat: -34.6, lng: -58.4, country: 'Argentina' },
  CLP: { lat: -33.4, lng: -70.7, country: 'Chile' },
  COP: { lat: 4.7, lng: -74.1, country: 'Colombia' },
  PEN: { lat: -12.0, lng: -77.0, country: 'Peru' },
  UYU: { lat: -34.9, lng: -56.2, country: 'Uruguay' },
  BOB: { lat: -16.5, lng: -68.1, country: 'Bolivia' },
  PYG: { lat: -25.3, lng: -57.6, country: 'Paraguay' },

  // Europe
  EUR: { lat: 50.1, lng: 8.7, country: 'Eurozone' },
  GBP: { lat: 51.5, lng: -0.1, country: 'United Kingdom' },
  CHF: { lat: 46.9, lng: 7.4, country: 'Switzerland' },
  SEK: { lat: 59.3, lng: 18.1, country: 'Sweden' },
  NOK: { lat: 59.9, lng: 10.7, country: 'Norway' },
  DKK: { lat: 55.7, lng: 12.6, country: 'Denmark' },
  PLN: { lat: 52.2, lng: 21.0, country: 'Poland' },
  CZK: { lat: 50.1, lng: 14.4, country: 'Czech Republic' },
  HUF: { lat: 47.5, lng: 19.0, country: 'Hungary' },
  RON: { lat: 44.4, lng: 26.1, country: 'Romania' },
  BGN: { lat: 42.7, lng: 23.3, country: 'Bulgaria' },
  TRY: { lat: 39.9, lng: 32.9, country: 'Turkey' },
  ISK: { lat: 64.1, lng: -21.9, country: 'Iceland' },
  RSD: { lat: 44.8, lng: 20.5, country: 'Serbia' },
  UAH: { lat: 50.4, lng: 30.5, country: 'Ukraine' },
  GEL: { lat: 41.7, lng: 44.8, country: 'Georgia' },

  // Asia-Pacific
  JPY: { lat: 35.7, lng: 139.7, country: 'Japan' },
  CNY: { lat: 39.9, lng: 116.4, country: 'China' },
  INR: { lat: 28.6, lng: 77.2, country: 'India' },
  AUD: { lat: -35.3, lng: 149.1, country: 'Australia' },
  NZD: { lat: -41.3, lng: 174.8, country: 'New Zealand' },
  SGD: { lat: 1.35, lng: 103.8, country: 'Singapore' },
  HKD: { lat: 22.3, lng: 114.2, country: 'Hong Kong' },
  KRW: { lat: 37.6, lng: 127.0, country: 'South Korea' },
  TWD: { lat: 25.0, lng: 121.5, country: 'Taiwan' },
  THB: { lat: 13.8, lng: 100.5, country: 'Thailand' },
  MYR: { lat: 3.1, lng: 101.7, country: 'Malaysia' },
  IDR: { lat: -6.2, lng: 106.8, country: 'Indonesia' },
  PHP: { lat: 14.6, lng: 121.0, country: 'Philippines' },
  VND: { lat: 21.0, lng: 105.8, country: 'Vietnam' },
  PKR: { lat: 33.7, lng: 73.0, country: 'Pakistan' },
  BDT: { lat: 23.8, lng: 90.4, country: 'Bangladesh' },
  LKR: { lat: 6.9, lng: 79.9, country: 'Sri Lanka' },
  NPR: { lat: 27.7, lng: 85.3, country: 'Nepal' },
  KZT: { lat: 51.1, lng: 71.4, country: 'Kazakhstan' },
  UZS: { lat: 41.3, lng: 69.3, country: 'Uzbekistan' },

  // Middle East
  AED: { lat: 24.5, lng: 54.4, country: 'United Arab Emirates' },
  SAR: { lat: 24.7, lng: 46.7, country: 'Saudi Arabia' },
  QAR: { lat: 25.3, lng: 51.5, country: 'Qatar' },
  KWD: { lat: 29.4, lng: 48.0, country: 'Kuwait' },
  BHD: { lat: 26.2, lng: 50.6, country: 'Bahrain' },
  OMR: { lat: 23.6, lng: 58.5, country: 'Oman' },
  ILS: { lat: 31.8, lng: 35.2, country: 'Israel' },
  JOD: { lat: 31.9, lng: 35.9, country: 'Jordan' },
  LBP: { lat: 33.9, lng: 35.5, country: 'Lebanon' },

  // Africa
  ZAR: { lat: -25.7, lng: 28.2, country: 'South Africa' },
  EGP: { lat: 30.0, lng: 31.2, country: 'Egypt' },
  NGN: { lat: 9.1, lng: 7.5, country: 'Nigeria' },
  KES: { lat: -1.3, lng: 36.8, country: 'Kenya' },
  MAD: { lat: 34.0, lng: -6.8, country: 'Morocco' },
  GHS: { lat: 5.6, lng: -0.2, country: 'Ghana' },
  TZS: { lat: -6.8, lng: 39.3, country: 'Tanzania' },
  UGX: { lat: 0.3, lng: 32.6, country: 'Uganda' },
  ETB: { lat: 9.0, lng: 38.7, country: 'Ethiopia' },
  DZD: { lat: 36.7, lng: 3.1, country: 'Algeria' },
  TND: { lat: 36.8, lng: 10.2, country: 'Tunisia' },
  MUR: { lat: -20.2, lng: 57.5, country: 'Mauritius' },
  BWP: { lat: -24.6, lng: 25.9, country: 'Botswana' },
};

function getCurrencyCoordinates(c: FiatCurrency): { x: number; y: number; country: string } {
  const match = CURRENCY_GEO_COORDS[c.code];
  let lat = 20;
  let lng = 0;
  let country = c.country || 'Global';

  if (match) {
    lat = match.lat;
    lng = match.lng;
    country = match.country;
  } else {
    // Region fallback
    switch (c.region) {
      case 'North America':
        lat = 39.0;
        lng = -98.0;
        break;
      case 'South America':
        lat = -14.0;
        lng = -58.0;
        break;
      case 'Europe':
        lat = 49.0;
        lng = 15.0;
        break;
      case 'Asia-Pacific':
        lat = 22.0;
        lng = 105.0;
        break;
      case 'Middle East':
        lat = 26.0;
        lng = 47.0;
        break;
      case 'Africa':
        lat = 4.0;
        lng = 22.0;
        break;
      default:
        lat = 20.0;
        lng = 0.0;
    }
  }

  // Exact Equirectangular projection scale(155).translate([500, 260])
  const k = 2.70526034;
  const x = 500 + lng * k;
  const y = 260 - lat * k;

  return {
    x: Math.round(x * 10) / 10,
    y: Math.round(y * 10) / 10,
    country,
  };
}

export function HeatmapPage() {
  const { fiat } = useVeyra();
  const [viewMode, setViewMode] = useState<'map' | 'grid'>('map');
  const [regionFilter, setRegionFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredCurrency, setHoveredCurrency] = useState<{ currency: FiatCurrency; x: number; y: number } | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<FiatCurrency | null>(null);

  // Zoom & Pan interactive state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const isDragMoved = useRef(false);
  const touchDist = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  const regions = ['All', 'North America', 'Europe', 'Asia-Pacific', 'Middle East', 'South America', 'Africa'];

  const clampPan = (newX: number, newY: number, currentZoom: number) => {
    if (currentZoom <= 1) return { x: 0, y: 0 };
    const maxPanX = (currentZoom - 1) * 450;
    const maxPanY = (currentZoom - 1) * 220;
    return {
      x: Math.max(-maxPanX, Math.min(maxPanX, newX)),
      y: Math.max(-maxPanY, Math.min(maxPanY, newY)),
    };
  };

  const handleZoomIn = () => {
    setZoom((prev) => {
      const next = Math.min(7, Math.round(prev * 1.35 * 10) / 10);
      setPan((p) => clampPan(p.x, p.y, next));
      return next;
    });
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(1, Math.round((prev / 1.35) * 10) / 10);
      if (next === 1) setPan({ x: 0, y: 0 });
      else setPan((p) => clampPan(p.x, p.y, next));
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const hoverTimerRef = useRef<number | null>(null);

  const handleMouseEnterDot = (c: HeatmapCurrency, x: number, y: number) => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoveredCurrency({ currency: c, x, y });
  };

  const handleMouseLeaveDot = () => {
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => {
      setHoveredCurrency(null);
    }, 280);
  };

  const handleMouseEnterTooltip = () => {
    if (hoverTimerRef.current) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const handleMouseLeaveTooltip = () => {
    if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = window.setTimeout(() => {
      setHoveredCurrency(null);
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) window.clearTimeout(hoverTimerRef.current);
    };
  }, []);

  // Wheel zoom listener with non-passive event listener so it intercepts map scroll cleanly
  useEffect(() => {
    const el = mapContainerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.18 : 0.85;

      setZoom((prevZoom) => {
        const nextZoom = Math.max(1, Math.min(7, prevZoom * zoomFactor));
        if (nextZoom === 1) {
          setPan({ x: 0, y: 0 });
          return 1;
        }

        const rect = el.getBoundingClientRect();
        const mouseNormX = (e.clientX - rect.left) / rect.width - 0.5;
        const mouseNormY = (e.clientY - rect.top) / rect.height - 0.5;

        setPan((prevPan) => {
          const maxPanX = (nextZoom - 1) * 450;
          const maxPanY = (nextZoom - 1) * 220;
          const targetX = prevPan.x - mouseNormX * (nextZoom - prevZoom) * 260;
          const targetY = prevPan.y - mouseNormY * (nextZoom - prevZoom) * 160;
          return {
            x: Math.max(-maxPanX, Math.min(maxPanX, targetX)),
            y: Math.max(-maxPanY, Math.min(maxPanY, targetY)),
          };
        });

        return Math.round(nextZoom * 100) / 100;
      });
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Mouse pan handlers
  const onMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    isDragMoved.current = false;
    dragStartRef.current = {
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const clientX = e.clientX;
    const clientY = e.clientY;
    const dx = Math.abs(clientX - (dragStartRef.current.x + pan.x));
    const dy = Math.abs(clientY - (dragStartRef.current.y + pan.y));
    if (dx > 4 || dy > 4) isDragMoved.current = true;

    if (zoom > 1) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = requestAnimationFrame(() => {
        const newX = clientX - dragStartRef.current.x;
        const newY = clientY - dragStartRef.current.y;
        setPan(clampPan(newX, newY, zoom));
      });
    }
  };

  const onMouseUp = () => {
    setIsDragging(false);
  };

  // Touch handlers for pinch zoom and touch pan
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchDist.current = dist;
    } else if (e.touches.length === 1 && zoom > 1) {
      setIsDragging(true);
      isDragMoved.current = false;
      dragStartRef.current = {
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      };
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchDist.current !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / touchDist.current;
      touchDist.current = dist;
      setZoom((prev) => {
        const next = Math.max(1, Math.min(7, prev * ratio));
        if (next === 1) setPan({ x: 0, y: 0 });
        else setPan((p) => clampPan(p.x, p.y, next));
        return Math.round(next * 100) / 100;
      });
    } else if (e.touches.length === 1 && isDragging && zoom > 1) {
      isDragMoved.current = true;
      const newX = e.touches[0].clientX - dragStartRef.current.x;
      const newY = e.touches[0].clientY - dragStartRef.current.y;
      setPan(clampPan(newX, newY, zoom));
    }
  };

  const onTouchEnd = () => {
    touchDist.current = null;
    setIsDragging(false);
  };

  const filteredCurrencies = useMemo(() => {
    return fiat.filter((c) => {
      const matchesRegion = regionFilter === 'All' || c.region === regionFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        (c.country && c.country.toLowerCase().includes(q));
      return matchesRegion && matchesSearch;
    });
  }, [fiat, regionFilter, searchQuery]);

  const grouped = useMemo(() => {
    const targetRegions = regionFilter === 'All' ? regions.slice(1) : [regionFilter];
    return targetRegions.map((reg) => ({
      region: reg,
      currencies: fiat.filter((c) => c.region === reg),
    }));
  }, [fiat, regionFilter]);

  // Color mapper based on strength score
  const getStrengthTheme = (score: number) => {
    if (score >= 75) {
      return {
        fill: '#10b981',
        stroke: '#34d399',
        glow: 'rgba(16, 185, 129, 0.45)',
        text: 'text-emerald-500 dark:text-emerald-400',
        label: 'Strong Bullish',
        badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      };
    }
    if (score >= 60) {
      return {
        fill: '#3b82f6',
        stroke: '#60a5fa',
        glow: 'rgba(59, 130, 246, 0.45)',
        text: 'text-blue-500 dark:text-blue-400',
        label: 'Moderate Strength',
        badge: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
      };
    }
    if (score >= 45) {
      return {
        fill: '#8b5cf6',
        stroke: '#a78bfa',
        glow: 'rgba(139, 92, 246, 0.35)',
        text: 'text-purple-500 dark:text-purple-400',
        label: 'Neutral',
        badge: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30',
      };
    }
    return {
      fill: '#f59e0b',
      stroke: '#fbbf24',
      glow: 'rgba(245, 158, 11, 0.45)',
      text: 'text-amber-500 dark:text-amber-400',
      label: 'Lagging',
      badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
    };
  };

  return (
    <div className="space-y-6">
      {/* Top Header and Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#09090b] dark:text-white flex items-center gap-2.5">
            <Globe className="h-6 w-6 text-[#3b82f6]" />
            <span>Global Currency Strength Heatmap</span>
          </h1>
          <p className="text-sm text-[#52525b] dark:text-[#a1a1aa] mt-1">
            Real-time geopolitical currency strength distribution across {fiat.length} tracked world economies.
          </p>
        </div>

        {/* View Switcher and Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="h-3.5 w-3.5 text-[#71717a] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search currency, country..."
              className="rounded-xl border border-[#e4e4e7] dark:border-white/10 bg-white dark:bg-[#12161f] pl-9 pr-3 py-1.5 text-xs text-[#09090b] dark:text-white placeholder-[#71717a] focus:outline-none focus:border-[#3b82f6]"
            />
          </div>

          <div className="inline-flex rounded-xl p-1 bg-[#f4f4f5] dark:bg-white/5 border border-[#e4e4e7] dark:border-white/10">
            <button
              type="button"
              onClick={() => setViewMode('map')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                viewMode === 'map'
                  ? 'bg-white dark:bg-[#2563eb] text-[#09090b] dark:text-white shadow-sm'
                  : 'text-[#71717a] hover:text-[#09090b] dark:hover:text-white'
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              <span>Global Map</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-[#2563eb] text-[#09090b] dark:text-white shadow-sm'
                  : 'text-[#71717a] hover:text-[#09090b] dark:hover:text-white'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Regional Grid</span>
            </button>
          </div>
        </div>
      </div>

      {/* Region Filter Bar */}
      <div className="flex flex-wrap items-center gap-1.5">
        {regions.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRegionFilter(r)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors ${
              regionFilter === r
                ? 'bg-[#3b82f6] text-white shadow-sm'
                : 'bg-[#f4f4f5] dark:bg-white/5 text-[#52525b] dark:text-[#a1a1aa] hover:bg-[#e4e4e7] dark:hover:bg-white/10'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {viewMode === 'map' ? (
        <div className="space-y-4">
          {/* Main Interactive World Map Card */}
          <div className="glass-surface relative overflow-hidden rounded-2xl border border-[#e4e4e7] dark:border-white/10 bg-[#f8fafc] dark:bg-[#080b11] p-3 sm:p-5 shadow-xl">
            {/* Map Legend & Navigation Hints */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#e4e4e7] dark:border-white/10 text-xs">
              <div className="flex items-center gap-2 text-[#52525b] dark:text-[#a1a1aa]">
                <Compass className="h-4 w-4 text-[#3b82f6]" />
                <span className="font-semibold text-[#09090b] dark:text-white">Interactive World View</span>
                <span className="hidden sm:inline">· Pinch, wheel, or ± to zoom · Drag to pan</span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
                  <span className="text-[#71717a] dark:text-[#a1a1aa]">Strong (&gt;75)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.7)]" />
                  <span className="text-[#71717a] dark:text-[#a1a1aa]">Moderate (60–74)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
                  <span className="text-[#71717a] dark:text-[#a1a1aa]">Neutral (45–59)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                  <span className="text-[#71717a] dark:text-[#a1a1aa]">Lagging (&lt;45)</span>
                </div>
              </div>
            </div>

            {/* SVG Map Container with Wheel, Drag & Touch Zoom/Pan */}
            <div
              ref={mapContainerRef}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              onTouchStart={onTouchStart}
              onTouchMove={onTouchMove}
              onTouchEnd={onTouchEnd}
              className={`relative w-full aspect-[2/1] min-h-[380px] max-h-[620px] select-none overflow-hidden touch-none rounded-xl ${
                zoom > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
              }`}
            >
              <svg
                viewBox="0 0 1000 500"
                className="w-full h-full"
              >
                <defs>
                  {/* Subtle Grid Pattern for coordinates */}
                  <pattern id="world-grid" width="50" height="50" patternUnits="userSpaceOnUse">
                    <path
                      d="M 50 0 L 0 0 0 50"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="0.5"
                      className="text-black/[0.04] dark:text-white/[0.04]"
                    />
                  </pattern>
                </defs>

                {/* Ocean / Background (Fixed) */}
                <rect width="1000" height="500" className="fill-[#f1f5f9] dark:fill-[#0a101d]" rx="16" />
                <rect width="1000" height="500" fill="url(#world-grid)" rx="16" />

                {/* Scaled & Panned Content Group (Hardware-accelerated) */}
                <g
                  transform={`translate(${500 + pan.x}, ${250 + pan.y}) scale(${zoom}) translate(-500, -250)`}
                  style={{ willChange: 'transform' }}
                >
                  {/* Equator & Meridians */}
                  <line
                    x1="0"
                    y1="260"
                    x2="1000"
                    y2="260"
                    stroke="currentColor"
                    strokeDasharray="4 4"
                    strokeWidth="0.75"
                    className="text-black/10 dark:text-white/10"
                  />
                  <line
                    x1="500"
                    y1="0"
                    x2="500"
                    y2="500"
                    stroke="currentColor"
                    strokeDasharray="4 4"
                    strokeWidth="0.75"
                    className="text-black/10 dark:text-white/10"
                  />

                  {/* Real World Natural Earth Landmasses (High performance single pass) */}
                  <path
                    d={WORLD_MAP_SVG_PATH}
                    className="fill-[#e2e8f0]/90 dark:fill-[#121c2e] stroke-[#94a3b8]/40 dark:stroke-[#1e2f47]"
                    strokeWidth="0.65"
                  />

                  {/* Plotting Currency Dots */}
                  {filteredCurrencies.map((c) => {
                    const { x, y } = getCurrencyCoordinates(c);
                    const theme = getStrengthTheme(c.strengthScore);
                    const isHovered = hoveredCurrency?.currency.code === c.code;
                    const isSelected = selectedCurrency?.code === c.code;

                    // Counter-scale dot sizes when zoomed so they stay crisp and not oversized
                    const scaleFactor = Math.max(0.65, 1 / Math.sqrt(zoom));

                    return (
                      <g
                        key={`dot-${c.code}`}
                        className="cursor-pointer transition-all duration-150"
                        onMouseEnter={() => handleMouseEnterDot(c, x, y)}
                        onMouseLeave={handleMouseLeaveDot}
                        onClick={() => {
                          if (isDragMoved.current) return;
                          setSelectedCurrency(c);
                        }}
                      >
                        {/* Generous invisible hit zone so hovering and clicking is effortless */}
                        <circle cx={x} cy={y} r={18 * scaleFactor} fill="transparent" />

                        {/* Outer pulse for high strength or selected dot */}
                        {(c.strengthScore >= 75 || isSelected || isHovered) && (
                          <circle
                            cx={x}
                            cy={y}
                            r={(isSelected ? 14 : isHovered ? 12 : 9) * scaleFactor}
                            fill="none"
                            stroke={theme.stroke}
                            strokeWidth={(isSelected ? 2 : 1.25) * scaleFactor}
                            opacity={isSelected ? 0.9 : 0.6}
                            className="animate-pulse"
                          />
                        )}

                        {/* Main Glowing Dot */}
                        <circle
                          cx={x}
                          cy={y}
                          r={(isSelected ? 6.5 : isHovered ? 5.5 : 4) * scaleFactor}
                          fill={theme.fill}
                          stroke={isSelected ? '#ffffff' : theme.stroke}
                          strokeWidth={(isSelected ? 2 : 1) * scaleFactor}
                        />

                        {/* Currency code label for key/active currencies */}
                        {(isSelected || isHovered || c.strengthScore >= 75 || zoom >= 2.2 || ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'AUD', 'CHF', 'CNY', 'BRL', 'ZAR', 'AED'].includes(c.code)) && (
                          <text
                            x={x}
                            y={y - 8 * scaleFactor}
                            textAnchor="middle"
                            className={`font-bold font-mono-num pointer-events-none select-none ${
                              isSelected
                                ? 'fill-[#2563eb] dark:fill-white font-extrabold'
                                : isHovered
                                  ? 'fill-[#09090b] dark:fill-white'
                                  : 'fill-[#64748b] dark:fill-[#94a3b8]'
                            }`}
                            style={{
                              fontSize: `${Math.max(7, Math.min(11, 9 * scaleFactor))}px`,
                              textShadow: '0 1px 3px rgba(0,0,0,0.85)',
                            }}
                          >
                            {c.code}
                          </text>
                        )}
                      </g>
                    );
                  })}
                </g>
              </svg>

              {/* Floating Zoom and Navigation HUD */}
              <div className="absolute right-3.5 bottom-3.5 z-20 flex flex-col items-center gap-1 rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white/95 dark:bg-[#0c121e]/95 p-1 shadow-2xl backdrop-blur-md">
                <button
                  type="button"
                  onClick={handleZoomIn}
                  title="Zoom In (+)"
                  aria-label="Zoom in"
                  className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[#09090b] dark:text-white transition-colors cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <span className="font-mono-num text-[10px] font-bold text-[#71717a] dark:text-[#a1a1aa] px-1 select-none">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={zoom <= 1}
                  title="Zoom Out (-)"
                  aria-label="Zoom out"
                  className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[#09090b] dark:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
                >
                  <Minus className="h-4 w-4" />
                </button>
                {zoom > 1 && (
                  <button
                    type="button"
                    onClick={handleResetZoom}
                    title="Reset Zoom (100%)"
                    aria-label="Reset zoom and center view"
                    className="h-7 w-7 inline-flex items-center justify-center rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-[#3b82f6] transition-colors cursor-pointer border-t border-[#e4e4e7] dark:border-white/10 mt-0.5 pt-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Floating Hover Tooltip Card (Positioned in Screen Coordinates with Zoom/Pan) */}
              {hoveredCurrency && (() => {
                const transformedX = 500 + pan.x + (hoveredCurrency.x - 500) * zoom;
                const transformedY = 250 + pan.y + (hoveredCurrency.y - 250) * zoom;
                if (transformedX < -50 || transformedX > 1050 || transformedY < -50 || transformedY > 550) return null;

                return (
                  <div
                    className="pointer-events-auto absolute z-30 -translate-x-1/2 -translate-y-full mb-3 w-64 rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white/95 dark:bg-[#0c121e]/95 p-3.5 shadow-2xl backdrop-blur-md transition-all animate-in fade-in zoom-in-95 duration-150 cursor-pointer"
                    onMouseEnter={handleMouseEnterTooltip}
                    onMouseLeave={handleMouseLeaveTooltip}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCurrency(hoveredCurrency.currency);
                      setHoveredCurrency(null);
                    }}
                    style={{
                      left: `${(transformedX / 1000) * 100}%`,
                      top: `${(transformedY / 500) * 100}%`,
                    }}
                  >
                    <div className="flex items-center justify-between border-b border-[#e4e4e7] dark:border-white/10 pb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-lg">{hoveredCurrency.currency.flag}</span>
                        <span className="font-display font-bold text-sm text-[#09090b] dark:text-white">
                          {hoveredCurrency.currency.code}
                        </span>
                        <span className="text-xs text-[#71717a] dark:text-[#a1a1aa] truncate max-w-[100px]">
                          {hoveredCurrency.currency.name}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          getStrengthTheme(hoveredCurrency.currency.strengthScore).badge
                        }`}
                      >
                        Score {hoveredCurrency.currency.strengthScore.toFixed(0)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2.5 text-xs">
                      <div>
                        <p className="text-[10px] text-[#71717a] dark:text-[#a1a1aa]">USD Rate</p>
                        <p className="font-mono-num font-semibold text-[#09090b] dark:text-white">
                          {hoveredCurrency.currency.rateVsUsd.toLocaleString('en-US', {
                            maximumFractionDigits: hoveredCurrency.currency.rateVsUsd < 1 ? 4 : 2,
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#71717a] dark:text-[#a1a1aa]">7d Change</p>
                        <div className="flex items-center gap-1 font-mono-num font-semibold">
                          {hoveredCurrency.currency.change7d >= 0 ? (
                            <TrendingUp className="h-3 w-3 text-emerald-500" />
                          ) : (
                            <TrendingDown className="h-3 w-3 text-rose-500" />
                          )}
                          <span className={hoveredCurrency.currency.change7d >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                            {hoveredCurrency.currency.change7d >= 0 ? '+' : ''}
                            {hoveredCurrency.currency.change7d.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-[#e4e4e7] dark:border-white/10 flex items-center justify-between text-[11px] text-[#71717a] dark:text-[#a1a1aa]">
                      <span>{hoveredCurrency.currency.region}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCurrency(hoveredCurrency.currency);
                          setHoveredCurrency(null);
                        }}
                        className="text-[#3b82f6] font-semibold hover:underline inline-flex items-center gap-1 cursor-pointer"
                      >
                        Click to inspect →
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Selected Currency Inspection Drawer / Card */}
          {selectedCurrency && (
            <div className="glass-surface rounded-2xl border border-[#3b82f6]/40 bg-gradient-to-r from-blue-500/[0.04] to-transparent p-5 sm:p-6 shadow-xl relative animate-in fade-in slide-in-from-top-2 duration-200">
              <button
                type="button"
                onClick={() => setSelectedCurrency(null)}
                aria-label="Close inspector"
                className="absolute top-4 right-4 rounded-lg p-1.5 text-[#71717a] hover:text-[#09090b] dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="grid md:grid-cols-12 gap-6 items-center">
                {/* Identity */}
                <div className="md:col-span-4 space-y-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-3xl">{selectedCurrency.flag}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-display text-xl font-bold text-[#09090b] dark:text-white">
                          {selectedCurrency.code}
                        </h2>
                        <span className="font-mono-num text-xs px-2 py-0.5 rounded-md bg-[#f4f4f5] dark:bg-white/10 text-[#71717a] dark:text-[#a1a1aa]">
                          Rank #{selectedCurrency.rank}
                        </span>
                      </div>
                      <p className="text-xs text-[#52525b] dark:text-[#a1a1aa]">
                        {selectedCurrency.name} · {selectedCurrency.country || selectedCurrency.region}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <span
                      className={`text-xs font-semibold px-2.5 py-1 rounded-lg border ${
                        getStrengthTheme(selectedCurrency.strengthScore).badge
                      }`}
                    >
                      {getStrengthTheme(selectedCurrency.strengthScore).label} ({selectedCurrency.strengthScore.toFixed(0)}/100)
                    </span>
                  </div>
                </div>

                {/* Key Metrics */}
                <div className="md:col-span-5 grid grid-cols-3 gap-3">
                  <div className="rounded-xl p-3 bg-white/60 dark:bg-white/[0.03] border border-[#e4e4e7] dark:border-white/10">
                    <p className="text-[10px] text-[#71717a] dark:text-[#a1a1aa]">Rate vs USD</p>
                    <p className="font-mono-num text-sm font-bold text-[#09090b] dark:text-white mt-0.5">
                      {selectedCurrency.rateVsUsd.toLocaleString('en-US', {
                        maximumFractionDigits: selectedCurrency.rateVsUsd < 1 ? 4 : 2,
                      })}
                    </p>
                  </div>
                  <div className="rounded-xl p-3 bg-white/60 dark:bg-white/[0.03] border border-[#e4e4e7] dark:border-white/10">
                    <p className="text-[10px] text-[#71717a] dark:text-[#a1a1aa]">24h Delta</p>
                    <p
                      className={`font-mono-num text-sm font-bold mt-0.5 ${
                        selectedCurrency.change24h >= 0 ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {selectedCurrency.change24h >= 0 ? '+' : ''}
                      {selectedCurrency.change24h.toFixed(2)}%
                    </p>
                  </div>
                  <div className="rounded-xl p-3 bg-white/60 dark:bg-white/[0.03] border border-[#e4e4e7] dark:border-white/10">
                    <p className="text-[10px] text-[#71717a] dark:text-[#a1a1aa]">7d Delta</p>
                    <p
                      className={`font-mono-num text-sm font-bold mt-0.5 ${
                        selectedCurrency.change7d >= 0 ? 'text-emerald-500' : 'text-rose-500'
                      }`}
                    >
                      {selectedCurrency.change7d >= 0 ? '+' : ''}
                      {selectedCurrency.change7d.toFixed(2)}%
                    </p>
                  </div>
                </div>

                {/* Direct Action Links */}
                <div className="md:col-span-3 flex flex-col gap-2">
                  <Link
                    to={`/dashboard/currencies/${selectedCurrency.code}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#3b82f6] hover:bg-[#2563eb] text-white px-4 py-2 text-xs font-semibold shadow-md transition-colors"
                  >
                    <span>Full Currency Hub</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    to={`/dashboard/compare?from=USD&to=${selectedCurrency.code}`}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-white/5 hover:border-[#3b82f6] text-[#09090b] dark:text-white px-4 py-2 text-xs font-semibold transition-colors"
                  >
                    <span>Compare vs USD</span>
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Regional Matrix (Classic Heatmap View) */
        <div className="space-y-6">
          {grouped.map((group) => (
            <section key={group.region} className="space-y-3">
              <h2 className="font-display text-sm font-semibold text-[#52525b] dark:text-[#a1a1aa]">
                {group.region} ({group.currencies.length})
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {group.currencies.map((c) => {
                  const intensity =
                    c.strengthScore >= 78
                      ? 'bg-[#1d4ed8] text-white border-[#1d4ed8]'
                      : c.strengthScore >= 65
                        ? 'bg-[#2563eb] text-white border-[#2563eb]'
                        : c.strengthScore >= 55
                          ? 'bg-[#3b82f6]/85 text-white border-[#3b82f6]'
                          : 'bg-white/85 dark:bg-[#18181b]/80 text-[#09090b] dark:text-[#fafafa] border-[#e4e4e7] dark:border-white/10';
                  const isLightTile = c.strengthScore < 55;

                  return (
                    <Link
                      key={c.code}
                      to={`/dashboard/currencies/${c.code}`}
                      className={`rounded-xl border p-4 transition-transform hover:-translate-y-0.5 flex flex-col justify-between gap-2 ${intensity}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-display text-base font-bold">
                          {c.flag ? `${c.flag} ` : ''}
                          {c.code}
                        </span>
                        <span className={`font-mono-num text-xs font-semibold ${isLightTile ? 'text-[#3b82f6]' : 'text-[#dbeafe]'}`}>
                          {c.strengthScore.toFixed(0)}
                        </span>
                      </div>
                      <div>
                        <p className={`text-xs truncate ${isLightTile ? 'text-[#52525b] dark:text-[#a1a1aa]' : 'text-white/85'}`}>
                          {c.name}
                        </p>
                        <p className={`font-mono-num text-[11px] mt-0.5 ${isLightTile ? 'text-[#71717a]' : 'text-white/90'}`}>
                          {c.change7d >= 0 ? '+' : ''}
                          {c.change7d.toFixed(2)}% (7d)
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export function WatchlistPage() {
  const { watchlist, strength, toggleWatchlist } = useVeyra();
  const [selectedAdd, setSelectedAdd] = useState('CHF:fiat');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const [symbol, assetType] = selectedAdd.split(':') as [string, 'fiat' | 'crypto'];
    if (symbol && assetType) {
      await toggleWatchlist(symbol, assetType);
    }
  };

  const rows = useMemo(() => {
    return watchlist.map((item) => {
      const entry = strength.all.find(
        (s) => s.code.toUpperCase() === item.symbol.toUpperCase() && s.assetType === item.asset_type
      );
      return { item, entry };
    });
  }, [watchlist, strength.all]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[#09090b] dark:text-white">
            Personal Watchlist
          </h1>
          <p className="text-sm text-[#52525b] dark:text-[#a1a1aa] mt-1">
            Currencies followed here automatically populate your Dashboard Home strength bar graph.
          </p>
        </div>

        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <label htmlFor="wl-add-select" className="sr-only">
            Select asset to add to watchlist
          </label>
          <select
            id="wl-add-select"
            value={selectedAdd}
            onChange={(e) => setSelectedAdd(e.target.value)}
            className="rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3 py-2 text-xs font-medium max-w-[240px]"
          >
            {strength.all.map((opt) => (
              <option key={`${opt.assetType}-${opt.id}`} value={`${opt.code}:${opt.assetType}`}>
                {opt.code} — {opt.name} ({opt.assetType.toUpperCase()})
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white px-3.5 py-2 text-xs font-semibold cursor-pointer whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Follow</span>
          </button>
        </form>
      </div>

      {rows.length === 0 ? (
        <div className="glass-surface p-10 text-center space-y-2">
          <Star className="h-6 w-6 text-[#3b82f6] mx-auto" />
          <p className="text-sm font-medium">Your watchlist is empty.</p>
          <p className="text-xs text-[#71717a]">Add fiat or crypto assets above to start tracking strength.</p>
        </div>
      ) : (
        <div className="glass-surface overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#e4e4e7] dark:border-white/10 text-xs font-medium text-[#71717a]">
                <th className="py-3.5 px-4">Asset</th>
                <th className="py-3.5 px-4">Class</th>
                <th className="py-3.5 px-4 text-right">Spot / Rate</th>
                <th className="py-3.5 px-4">Strength</th>
                <th className="py-3.5 px-4 text-right">24h Δ</th>
                <th className="py-3.5 px-4 text-right">Curve</th>
                <th className="py-3.5 px-4 text-right">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e4e7]/70 dark:divide-white/5 text-sm">
              {rows.map(({ item, entry }) => (
                <tr key={item.id} className="hover:bg-[#f4f4f5]/50 dark:hover:bg-white/[0.03]">
                  <td className="py-3.5 px-4 font-semibold">
                    <Link
                      to={
                        item.asset_type === 'fiat'
                          ? `/dashboard/currencies/${item.symbol}`
                          : `/dashboard/crypto/${entry?.id || item.symbol.toLowerCase()}`
                      }
                      className="hover:text-[#3b82f6]"
                    >
                      {item.symbol}
                    </Link>
                    {entry && <span className="ml-2 text-xs font-normal text-[#71717a]">{entry.name}</span>}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-[#71717a] uppercase">{item.asset_type}</td>
                  <td className="py-3.5 px-4 text-right font-mono-num">
                    {entry
                      ? item.asset_type === 'crypto'
                        ? formatPrice(entry.vsUsdRate)
                        : `${entry.vsUsdRate.toFixed(4)} / USD`
                      : '—'}
                  </td>
                  <td className="py-3.5 px-4">
                    {entry ? <StrengthBar score={entry.strengthScore} compact /> : '—'}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {entry ? <DeltaText value={entry.change24h} /> : '—'}
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="flex justify-end">
                      {entry && <Sparkline data={entry.sparkline} positive={entry.change7d >= 0} />}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => void toggleWatchlist(item.symbol, item.asset_type)}
                      aria-label={`Remove ${item.symbol} from watchlist`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#71717a] hover:text-[#ef4444] hover:bg-[#ef4444]/10 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AlertsPage() {
  const { alerts, fiat, crypto, refreshUserData, notify } = useVeyra();
  const [symbol, setSymbol] = useState('BTC');
  const [assetType, setAssetType] = useState<'crypto' | 'fiat'>('crypto');
  const [direction, setDirection] = useState<'above' | 'below'>('above');
  const [targetPrice, setTargetPrice] = useState('100000');
  const [notifyDiscord, setNotifyDiscord] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentAsset = useMemo(() => {
    const sym = symbol.trim().toUpperCase();
    if (assetType === 'crypto') {
      const c = (crypto || []).find((x) => x?.code?.toUpperCase() === sym || x?.id?.toUpperCase() === sym);
      if (c) {
        const p = typeof c.price_usd === 'number' ? c.price_usd : 0;
        return {
          symbol: c.code || sym,
          name: c.name || sym,
          type: 'crypto' as const,
          price: p,
          formatted: formatPrice(p),
        };
      }
    } else {
      const f = (fiat || []).find((x) => x?.code?.toUpperCase() === sym);
      if (f) {
        const rate = typeof f.vsUsdRate === 'number' ? f.vsUsdRate : 1;
        return {
          symbol: f.code || sym,
          name: f.name || sym,
          type: 'fiat' as const,
          price: rate,
          formatted: `1 USD = ${rate} ${f.code}`,
        };
      }
    }
    return null;
  }, [symbol, assetType, crypto, fiat]);

  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const fiatList = (fiat || []).map((f) => ({
      symbol: f.code,
      name: f.name,
      country: f.country || '',
      type: 'fiat' as const,
      price: typeof f.vsUsdRate === 'number' ? f.vsUsdRate : 1,
      formattedPrice: `1 USD = ${typeof f.vsUsdRate === 'number' ? f.vsUsdRate : 1} ${f.code}`,
    }));
    const cryptoList = (crypto || []).map((c) => ({
      symbol: c.code,
      name: c.name,
      country: '',
      type: 'crypto' as const,
      price: typeof c.price_usd === 'number' ? c.price_usd : 0,
      formattedPrice: formatPrice(typeof c.price_usd === 'number' ? c.price_usd : 0),
    }));

    const combined = assetType === 'fiat' ? [...fiatList, ...cryptoList] : [...cryptoList, ...fiatList];
    if (!q) return combined.slice(0, 20);

    return combined
      .filter(
        (a) =>
          a.symbol.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          (a.country && a.country.toLowerCase().includes(q))
      )
      .slice(0, 20);
  }, [fiat, crypto, assetType, searchQuery]);

  const handleSelectAsset = (a: { symbol: string; type: 'fiat' | 'crypto'; price: number }) => {
    setSymbol(a.symbol);
    setAssetType(a.type);
    setSearchQuery(a.symbol);
    setTargetPrice(String(a.price));
    setDropdownOpen(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const numeric = Number(targetPrice);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      notify('Enter a positive target price.', 'error');
      return;
    }
    setSaving(true);
    try {
      await apiRequest<{ item: PriceAlertItem }>('/api/user/alerts', {
        method: 'POST',
        body: {
          symbol: symbol.trim().toUpperCase(),
          asset_type: assetType,
          target_price: numeric,
          direction,
          notify_discord: notifyDiscord,
        },
      });
      await refreshUserData();
      notify(`Price alert created for ${symbol.toUpperCase()}.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Unable to create alert.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiRequest(`/api/user/alerts/${id}`, { method: 'DELETE' });
      await refreshUserData();
      notify('Alert removed.', 'info');
    } catch {
      notify('Could not delete alert.', 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[#09090b] dark:text-white">
          Price Alerts
        </h1>
        <p className="text-sm text-[#52525b] dark:text-[#a1a1aa] mt-1">
          Monitor threshold targets across fiat rates and crypto spot prices with optional Discord delivery.
        </p>
      </div>

      <form onSubmit={handleCreate} className="glass-surface p-6 grid sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
        {/* Searchable Combobox Symbol Input */}
        <div ref={dropdownRef} className="space-y-1.5 relative">
          <label htmlFor="alert-symbol" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
            Symbol / Asset
          </label>
          <input
            id="alert-symbol"
            type="text"
            required
            autoComplete="off"
            value={dropdownOpen ? searchQuery : symbol}
            onFocus={() => {
              setSearchQuery(symbol);
              setDropdownOpen(true);
            }}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSymbol(e.target.value.toUpperCase());
              setDropdownOpen(true);
            }}
            placeholder="Search BTC, EUR, INR..."
            className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3 py-2 text-sm uppercase focus:outline-none focus:border-[#3b82f6]"
          />

          {dropdownOpen && (
            <div className="absolute left-0 top-full mt-1 w-72 max-h-60 overflow-y-auto rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#12161f] shadow-2xl z-50 p-1 space-y-0.5">
              {filteredAssets.length === 0 ? (
                <div className="p-3 text-xs text-[#71717a] text-center">No matching currencies found.</div>
              ) : (
                filteredAssets.map((a) => (
                  <button
                    key={`${a.type}-${a.symbol}`}
                    type="button"
                    onClick={() => handleSelectAsset(a)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs hover:bg-[#f4f4f5] dark:hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 font-bold text-[#09090b] dark:text-white">
                        <span>{a.symbol}</span>
                        <span className="text-[10px] font-normal px-1 rounded bg-[#e4e4e7]/60 dark:bg-white/10 text-[#71717a] dark:text-[#a1a1aa]">
                          {a.type}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#71717a] dark:text-[#a1a1aa] truncate">{a.name}</p>
                    </div>
                    <span className="font-mono-num font-semibold text-[#2563eb] dark:text-[#60a5fa] shrink-0 text-right">
                      {a.formattedPrice}
                    </span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="alert-class" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
            Asset Class
          </label>
          <select
            id="alert-class"
            value={assetType}
            onChange={(e) => setAssetType(e.target.value as 'crypto' | 'fiat')}
            className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3 py-2 text-sm"
          >
            <option value="crypto">Crypto</option>
            <option value="fiat">Fiat</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="alert-dir" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
            Condition
          </label>
          <select
            id="alert-dir"
            value={direction}
            onChange={(e) => setDirection(e.target.value as 'above' | 'below')}
            className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3 py-2 text-sm"
          >
            <option value="above">Crosses Above</option>
            <option value="below">Drops Below</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label htmlFor="alert-price" className="block text-xs font-medium text-[#52525b] dark:text-[#a1a1aa]">
              Target Price
            </label>
            {currentAsset && (
              <span className="text-[10px] font-semibold text-[#2563eb] dark:text-[#60a5fa] truncate ml-1">
                Live: {currentAsset.formatted}
              </span>
            )}
          </div>
          <input
            id="alert-price"
            type="number"
            step="any"
            required
            value={targetPrice}
            onChange={(e) => setTargetPrice(e.target.value)}
            className="w-full rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-3 py-2 font-mono-num text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white px-4 py-2.5 text-xs font-semibold cursor-pointer disabled:opacity-60"
        >
          <Bell className="h-3.5 w-3.5" />
          <span>{saving ? 'Saving...' : 'Create Alert'}</span>
        </button>

        <label className="sm:col-span-2 lg:col-span-5 inline-flex items-center gap-2 text-xs text-[#52525b] dark:text-[#a1a1aa] cursor-pointer">
          <input
            type="checkbox"
            checked={notifyDiscord}
            onChange={(e) => setNotifyDiscord(e.target.checked)}
            className="rounded border-[#e4e4e7]"
          />
          <span>Forward triggered alerts to linked Discord account</span>
        </label>
      </form>

      <div className="glass-surface overflow-x-auto">
        {(alerts || []).length === 0 ? (
          <div className="p-8 text-center text-sm text-[#71717a]">
            No price alerts configured yet. Add one above to monitor thresholds.
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#e4e4e7] dark:border-white/10 text-xs font-medium text-[#71717a]">
                <th className="py-3.5 px-4">Asset</th>
                <th className="py-3.5 px-4">Condition</th>
                <th className="py-3.5 px-4 text-right">Target</th>
                <th className="py-3.5 px-4">Delivery</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4e4e7]/70 dark:divide-white/5 text-sm">
              {(alerts || []).map((al) => (
                <tr key={al.id}>
                  <td className="py-3.5 px-4 font-semibold">
                    {al.symbol} <span className="text-xs font-normal text-[#71717a] uppercase">{al.asset_type}</span>
                  </td>
                  <td className="py-3.5 px-4 capitalize text-xs">{al.direction}</td>
                  <td className="py-3.5 px-4 text-right font-mono-num">
                    {al.asset_type === 'crypto' ? formatPrice(Number(al.target_price) || 0) : al.target_price}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-[#71717a]">
                    {al.notify_discord ? 'In-App + Discord' : 'In-App'}
                  </td>
                  <td className="py-3.5 px-4 text-xs font-medium">
                    <span className={al.is_triggered ? 'text-[#22c55e]' : 'text-[#3b82f6]'}>
                      {al.is_triggered ? 'Triggered' : 'Watching'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => void handleDelete(al.id)}
                      aria-label={`Delete alert for ${al.symbol}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#71717a] hover:text-[#ef4444] cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
