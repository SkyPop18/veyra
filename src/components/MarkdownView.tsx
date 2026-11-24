import React, { useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
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
  type?: 'bar' | 'line' | 'area';
  title?: string;
  data: Array<{ name: string; value: number; [key: string]: unknown }>;
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
  const chartType = spec.type || 'bar';
  const data = spec.data || [];

  if (!Array.isArray(data) || data.length === 0) return null;

  return (
    <div className="my-3 rounded-xl border border-[#e4e4e7] dark:border-white/10 bg-white/70 dark:bg-white/[0.03] p-4 shadow-xs">
      {spec.title && (
        <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-[#09090b] dark:text-white">
          <BarChart3 className="h-4 w-4 text-[#3b82f6]" />
          <span>{spec.title}</span>
        </div>
      )}
      <div className="w-full h-48 sm:h-56">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === 'line' ? (
            <LineChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#09090b',
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: '#ffffff',
                }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#3b82f6' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          ) : chartType === 'area' ? (
            <AreaChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <defs>
                <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#09090b',
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: '#ffffff',
                }}
              />
              <Area type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} fill="url(#area-grad)" />
            </AreaChart>
          ) : (
            <BarChart data={data} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#09090b',
                  borderColor: 'rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  fontSize: 12,
                  color: '#ffffff',
                }}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
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
        <span className="font-mono uppercase">{lang || 'CODE'}</span>
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

        if (codeBlockLang === 'chart' || codeBlockLang === 'json-chart') {
          try {
            const parsed = JSON.parse(codeText) as ChartSpec;
            elements.push(<InteractiveChart key={blockKey} spec={parsed} />);
          } catch {
            // If still streaming or JSON malformed, render as code block fallback
            elements.push(<CodeBlock key={blockKey} code={codeText} lang={codeBlockLang} />);
          }
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
    if (codeBlockLang === 'chart' || codeBlockLang === 'json-chart') {
      try {
        const parsed = JSON.parse(codeText) as ChartSpec;
        elements.push(<InteractiveChart key={blockKey} spec={parsed} />);
      } catch {
        elements.push(<CodeBlock key={blockKey} code={codeText} lang={codeBlockLang} />);
      }
    } else {
      elements.push(<CodeBlock key={blockKey} code={codeText} lang={codeBlockLang} />);
    }
  }

  flushList();

  return <div className={`space-y-0.5 ${className}`}>{elements}</div>;
}
