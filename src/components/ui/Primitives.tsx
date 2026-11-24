import React from 'react';
import { ArrowDownRight, ArrowUpRight, Moon, Sun } from 'lucide-react';
import { cn } from '../../lib/cn';
import { formatPrice, formatSignedPct } from '../../lib/core';
import { useVeyra } from '../../context/VeyraContext';

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useVeyra();
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      className={cn(
        'inline-flex items-center justify-center h-9 w-9 rounded-lg border border-[#e4e4e7] dark:border-white/10 bg-white/80 dark:bg-white/5 text-[#52525b] dark:text-[#a1a1aa] hover:text-[#09090b] dark:hover:text-white hover:border-[#3b82f6]/40 transition-colors cursor-pointer shrink-0',
        className
      )}
    >
      {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export function DeltaText({
  value,
  className,
  showIcon = true,
}: {
  value: number;
  className?: string;
  showIcon?: boolean;
}) {
  const positive = value >= 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 font-mono-num text-xs font-medium whitespace-nowrap',
        positive ? 'text-[#22c55e]' : 'text-[#ef4444]',
        className
      )}
    >
      {showIcon &&
        (positive ? (
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <ArrowDownRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        ))}
      <span>{formatSignedPct(value)}</span>
    </span>
  );
}

export function StrengthBar({
  score,
  compact = false,
}: {
  score: number;
  compact?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const toneClass =
    clamped >= 78
      ? 'from-[#2563eb] to-[#1d4ed8]'
      : clamped >= 58
        ? 'from-[#3b82f6] to-[#2563eb]'
        : 'from-[#93c5fd] to-[#60a5fa]';

  return (
    <div className={cn('flex items-center gap-3', compact ? 'w-32' : 'w-full max-w-[200px]')}>
      <div className="h-2 flex-1 rounded-full bg-[#e4e4e7] dark:bg-white/10 overflow-hidden">
        <div
          className={cn('h-full rounded-full bg-gradient-to-r transition-all duration-500', toneClass)}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="font-mono-num text-xs font-semibold text-[#09090b] dark:text-[#fafafa] w-9 text-right">
        {clamped.toFixed(1)}
      </span>
    </div>
  );
}

export function Sparkline({
  data,
  positive,
  width = 84,
  height = 28,
}: {
  data: number[];
  positive: boolean;
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) {
    return <div style={{ width, height }} className="opacity-30" />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - 3 - ((v - min) / span) * (height - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible shrink-0"
      aria-hidden="true"
    >
      <polyline
        fill="none"
        stroke={positive ? '#22c55e' : '#ef4444'}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts}
      />
    </svg>
  );
}

export function FearGreedGauge({ value, classification }: { value: number; classification: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = 44;
  const circumference = Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / 100);

  return (
    <div className="flex items-center gap-4">
      <div className="relative w-24 h-14 shrink-0">
        <svg viewBox="0 0 110 62" className="w-full h-full">
          <path
            d="M 11 54 A 44 44 0 0 1 99 54"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            className="text-[#e4e4e7] dark:text-white/10"
          />
          <path
            d="M 11 54 A 44 44 0 0 1 99 54"
            fill="none"
            stroke="#3b82f6"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <span className="font-mono-num text-xl font-bold text-[#09090b] dark:text-white">{clamped}</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#09090b] dark:text-[#fafafa] truncate">{classification}</p>
        <p className="text-xs text-[#71717a] dark:text-[#a1a1aa]">Alternative.me Index</p>
      </div>
    </div>
  );
}

export function PriceTicker() {
  const { crypto, fiat } = useVeyra();
  const topCoins = crypto.slice(0, 6);
  const topFiat = fiat.filter((f) => ['EUR', 'GBP', 'JPY', 'CHF', 'INR', 'AUD'].includes(f.code));

  const items = [
    ...topCoins.map((c) => ({
      key: `c-${c.id}`,
      label: `${c.symbol}/USD`,
      price: formatPrice(c.current_price),
      change: c.price_change_percentage_24h,
    })),
    ...topFiat.map((f) => ({
      key: `f-${f.code}`,
      label: `USD/${f.code}`,
      price: f.rateVsUsd >= 100 ? f.rateVsUsd.toFixed(2) : f.rateVsUsd.toFixed(4),
      change: f.change24h,
    })),
  ];

  if (items.length === 0) return null;

  const doubled = [...items, ...items];

  return (
    <div
      aria-label="Live market rates ticker"
      className="w-full overflow-hidden border-b border-[#e4e4e7] dark:border-white/10 bg-white/75 dark:bg-[#09090b]/85 backdrop-blur-md py-2"
    >
      <div className="animate-veyra-ticker flex items-center gap-8 px-4">
        {doubled.map((item, idx) => (
          <div key={`${item.key}-${idx}`} className="flex items-center gap-2.5 text-xs whitespace-nowrap shrink-0">
            <span className="font-semibold text-[#09090b] dark:text-[#fafafa]">{item.label}</span>
            <span className="font-mono-num text-[#52525b] dark:text-[#d4d4d8]">{item.price}</span>
            <DeltaText value={item.change} showIcon={false} className="text-[11px]" />
          </div>
        ))}
      </div>
    </div>
  );
}
