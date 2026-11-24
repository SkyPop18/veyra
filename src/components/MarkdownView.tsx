import React from 'react';

interface MarkdownViewProps {
  content: string;
  className?: string;
}

/**
 * Parses inline markdown:
 * - `**bold**` -> <strong>
 * - `*italic*` -> <em>
 * - `~~strikethrough~~` -> <del>
 * - `` `code` `` -> <code>
 */
function parseInline(text: string): React.ReactNode[] {
  // Regex pattern matching:
  // 1: `code`
  // 2: **bold**
  // 3: ~~strike~~
  // 4: *italic*
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

export function MarkdownView({ content, className = '' }: MarkdownViewProps) {
  if (!content) return null;

  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];

  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;

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

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    // Empty lines flush list and add small spacing
    if (!trimmed) {
      flushList();
      elements.push(<div key={`blank-${idx}`} className="h-2" />);
      return;
    }

    // Horizontal Rule: --- or ***
    if (/^(\*\*\*|---|___)$/.test(trimmed)) {
      flushList();
      elements.push(
        <hr key={`hr-${idx}`} className="my-3 border-t border-[#e4e4e7] dark:border-white/10" />
      );
      return;
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
      return;
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
      return;
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
      return;
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
      return;
    }

    // Normal paragraph text
    flushList();
    elements.push(
      <p key={`p-${idx}`} className="my-1 text-sm leading-relaxed text-[#27272a] dark:text-[#e4e4e7]">
        {parseInline(trimmed)}
      </p>
    );
  });

  flushList();

  return <div className={`space-y-0.5 ${className}`}>{elements}</div>;
}
