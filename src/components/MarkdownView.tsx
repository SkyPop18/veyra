import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Legend,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { BarChart3, Check, Copy } from 'lucide-react';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

interface ChartSpec {
  type?: 'bar' | 'line' | 'area' | 'pie';
  title?: string;
  data: Array<Record<string, unknown>>;
}

const CHART_COLORS = ['#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ef4444'];

function tryParseChartSpec(raw: string, lang: string): ChartSpec | null {
  const isExplicitChart = lang === 'chart' || lang === 'json-chart' || lang === 'recharts';
  if (!isExplicitChart && lang !== 'json' && lang !== '') return null;
  try {
    // Strip trailing commas before closing ] or } for resilient LLM output parsing
    const cleaned = raw.trim().replace(/,\s*([}\]])/g, '$1');
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.data) || parsed.data.length === 0) {
      return null;
    }
    if (!isExplicitChart && !parsed.type) return null;
    return parsed as unknown as ChartSpec;
  } catch {
    return null;
  }
}

function parseInline(text: string): React.ReactNode[] {
  const pattern = /(`[^`]+`|\*\*[^*]+\*\*|~~[^~]+~~|\*[^*]+\*)/g;
  const parts = text.split(pattern);

  return parts.map((part, index) => {
    if (!part) return null;

    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={index}
          className="rounded bg-[#09090b]/8 dark:bg-white/10 px-1.5 py-0.5 font-mono text-[12px] text-[#2563eb] dark:text-[#60a5fa] font-medium"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={index} className="font-semibold text-[#09090b] dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith('~~') && part.endsWith('~~') && part.length >= 4) {
      return (
        <del key={index} className="line-through text-[#71717a] dark:text-[#a1a1aa] opacity-80">
          {part.slice(2, -2)}
        </del>
      );
    }

    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={index} className="italic text-[#3f3f46] dark:text-[#d4d4d8]">
          {part.slice(1, -1)}
        </em>
      );
    }

    return <React.Fragment key={index}>{part}</React.Fragment>;
  });
}

function InteractiveChart({ spec }: { spec: ChartSpec }) {
  const rawType = String(spec.type || 'bar').toLowerCase();
  const chartType: 'bar' | 'line' | 'area' | 'pie' =
    rawType === 'line' || rawType === 'area' || rawType === 'pie' ? rawType : 'bar';
  const rawData = Array.isArray(spec.data) ? spec.data : [];

  if (rawData.length === 0) return null;

  // Normalize X-axis key (supports name, label, currency, symbol, date, pair)
  const firstRow = rawData[0] || {};
  const labelKey =
    ['name', 'label', 'currency', 'symbol', 'pair', 'date', 'period'].find((k) => k in firstRow) ||
    Object.keys(firstRow).find((k) => typeof firstRow[k] === 'string') ||
    'name';

  // Detect all numeric Y-series keys (supports single "value" or multi-series like USD/EUR/INR)
  const numericKeys = Object.keys(firstRow).filter((k) => {
    if (k === labelKey) return false;
    const v = firstRow[k];
    return typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)));
  });
  const seriesKeys = numericKeys.length > 0 ? numericKeys : ['value'];

  const data = rawData.map((row, idx) => {
    const out: Record<string, unknown> = {
      ...row,
      [labelKey]: row[labelKey] ?? `#${idx + 1}`,
    };
    for (const key of seriesKeys) {
      const n = Number(row[key]);
      out[key] = Number.isFinite(n) ? n : 0;
    }
    return out;
  });

  const tooltipStyle = {
    backgroundColor: '#11141c',
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    fontSize: 12,
    color: '#fafafa',
  };
  const tooltipLabelStyle = { color: '#fafafa', fontWeight: 600 };
  const tooltipItemStyle = { color: '#d4d4d8' };

  return (
    <div className="my-3 rounded-xl border border-[#e4e4e7] dark:border-white/10 bg-white dark:bg-[#11141c] p-4">
      {spec.title && (
        <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-[#09090b] dark:text-white">
          <BarChart3 className="h-4 w-4 text-[#3b82f6]" />
          <span>{spec.title}</span>
        </div>
      )}
      <div className="w-full h-56 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'pie' ? (
            <PieChart>
              <Pie
                data={data}
                dataKey={seriesKeys[0]}
                nameKey={labelKey}
                cx="50%"
                cy="50%"
                innerRadius={42}
                outerRadius={78}
                paddingAngle={3}
              >
                {data.map((_entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          ) : chartType === 'line' ? (
            <LineChart data={data} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              {seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {seriesKeys.map((key, idx) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: CHART_COLORS[idx % CHART_COLORS.length] }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          ) : chartType === 'area' ? (
            <AreaChart data={data} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              {seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {seriesKeys.map((key, idx) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={CHART_COLORS[idx % CHART_COLORS.length]}
                  strokeWidth={2}
                  fill={idx === 0 ? 'url(#area-grad)' : CHART_COLORS[idx % CHART_COLORS.length]}
                  fillOpacity={idx === 0 ? 1 : 0.15}
                />
              ))}
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey={labelKey} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} itemStyle={tooltipItemStyle} />
              {seriesKeys.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
              {seriesKeys.map((key, idx) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={CHART_COLORS[idx % CHART_COLORS.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore copy error
    }
  };

  return (
    <div className="my-3 rounded-xl border border-[#e4e4e7] dark:border-white/10 bg-[#09090b] text-[#fafafa] overflow-hidden text-xs">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-white/5 border-b border-white/10 text-[11px] text-[#a1a1aa]">
        <span className="font-mono">{lang || 'code'}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-[11px] hover:text-white transition-colors cursor-pointer"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-3.5 font-mono overflow-x-auto whitespace-pre leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export function MarkdownView({ content, className = '' }: MarkdownViewProps) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines: string[] = [];

  const flushList = () => {
    if (!currentList) return;
    const ListTag = currentList.type;
    const listKey = `list-${elements.length}`;
    elements.push(
      <ListTag
        key={listKey}
        className={`my-2 space-y-1 pl-5 ${
          currentList.type === 'ul' ? 'list-disc' : 'list-decimal'
        } text-sm text-[#27272a] dark:text-[#e4e4e7] marker:text-[#3b82f6]`}
      >
        {currentList.items.map((itemText, i) => (
          <li key={i} className="leading-relaxed">
            {parseInline(itemText)}
          </li>
        ))}
      </ListTag>
    );
    currentList = null;
  };

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    // Code block start / end
    if (trimmed.startsWith('```')) {
      flushList();
      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBlockLang = trimmed.slice(3).trim().toLowerCase();
        codeBlockLines = [];
        continue;
      } else {
        inCodeBlock = false;
        const codeText = codeBlockLines.join('\n');
        const blockKey = `code-${elements.length}`;

        const chartSpec = tryParseChartSpec(codeText, codeBlockLang);
        if (chartSpec) {
          elements.push(<InteractiveChart key={blockKey} spec={chartSpec} />);
        } else {
          elements.push(<CodeBlock key={blockKey} code={codeText} lang={codeBlockLang} />);
        }
        codeBlockLines = [];
        continue;
      }
    }

    if (inCodeBlock) {
      codeBlockLines.push(rawLine);
      continue;
    }

    // Empty lines flush list and add small spacing
    if (!trimmed) {
      flushList();
      elements.push(<div key={`blank-${idx}`} className="h-2" />);
      continue;
    }

    // Horizontal Rule: --- or ***
    if (/^(\*\*\*|---|___)$/.test(trimmed)) {
      flushList();
      elements.push(
        <hr key={`hr-${idx}`} className="my-3 border-t border-[#e4e4e7] dark:border-white/10" />
      );
      continue;
    }

    // Headings
    if (trimmed.startsWith('#')) {
      flushList();
      const level = trimmed.match(/^#+/)?.[0].length || 1;
      const text = trimmed.replace(/^#+\s*/, '');
      if (level === 1) {
        elements.push(
          <h2 key={`h1-${idx}`} className="font-display text-lg font-bold text-[#09090b] dark:text-white mt-3 mb-1.5">
            {parseInline(text)}
          </h2>
        );
      } else if (level === 2) {
        elements.push(
          <h3 key={`h2-${idx}`} className="font-display text-base font-semibold text-[#09090b] dark:text-white mt-2.5 mb-1 text-[#2563eb] dark:text-[#60a5fa]">
            {parseInline(text)}
          </h3>
        );
      } else {
        elements.push(
          <h4 key={`h3-${idx}`} className="font-display text-sm font-semibold text-[#09090b] dark:text-white mt-2 mb-1">
            {parseInline(text)}
          </h4>
        );
      }
      continue;
    }

    // Bullet list items (* or -)
    const bulletMatch = line.match(/^(\s*)[*-]\s+(.+)$/);
    if (bulletMatch) {
      const itemText = bulletMatch[2];
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [itemText] };
      } else {
        currentList.items.push(itemText);
      }
      continue;
    }

    // Numbered list items (1. 2.)
    const numberMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);
    if (numberMatch) {
      const itemText = numberMatch[2];
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [itemText] };
      } else {
        currentList.items.push(itemText);
      }
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      flushList();
      const quoteText = trimmed.replace(/^>\s*/, '');
      elements.push(
        <blockquote
          key={`quote-${idx}`}
          className="my-2 border-l-2 border-[#3b82f6] pl-3 italic text-xs text-[#52525b] dark:text-[#a1a1aa]"
        >
          {parseInline(quoteText)}
        </blockquote>
      );
      continue;
    }

    // Normal paragraph text
    flushList();
    elements.push(
      <p key={`p-${idx}`} className="my-1 text-sm leading-relaxed text-[#27272a] dark:text-[#e4e4e7]">
        {parseInline(trimmed)}
      </p>
    );
  }

  // Handle unclosed code block during active streaming
  if (inCodeBlock && codeBlockLines.length > 0) {
    const codeText = codeBlockLines.join('\n');
    const blockKey = `code-trailing-${elements.length}`;
    const chartSpec = tryParseChartSpec(codeText, codeBlockLang);
    if (chartSpec) {
      elements.push(<InteractiveChart key={blockKey} spec={chartSpec} />);
    } else if (codeBlockLang === 'chart' || codeBlockLang === 'json-chart') {
      elements.push(
        <div
          key={blockKey}
          className="my-3 rounded-xl border border-[#e4e4e7] dark:border-white/10 bg-white/60 dark:bg-white/[0.03] p-4 flex items-center gap-2 text-xs text-[#71717a]"
        >
          <BarChart3 className="h-4 w-4 text-[#3b82f6]" />
          <span>Rendering interactive market chart...</span>
        </div>
      );
    } else {
      elements.push(<CodeBlock key={blockKey} code={codeText} lang={codeBlockLang} />);
    }
  }

  flushList();

  return <div className={`space-y-0.5 ${className}`}>{elements}</div>;
}
