import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BarChart2,
  Crown,
  PlusCircle,
  RotateCcw,
  Send,
} from 'lucide-react';
import { useVeyra } from '../../context/VeyraContext';
import { isProSubscriptionActive } from '../../lib/core';
import { apiRequest, getActiveAccessToken } from '../../lib/api';
import { MarkdownView } from '../../components/MarkdownView';
import type { AiAnalysisEntry } from '../../types/veyra';

const SUGGESTED_PROMPTS = [
  'What is the live USD/INR rate and India currency momentum?',
  'Show me a chart comparing USD vs EUR vs GBP vs INR rates.',
  'What is the current BTC outlook given today’s Fear & Greed Index?',
  'Compare USD vs EUR vs CHF relative strength this week with a chart.',
];

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  error?: boolean;
  retryQuery?: string;
}

interface AiUsageStats {
  isPro: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
  resetAt: string;
  allowed: boolean;
}

const LEGACY_STORAGE_KEY = 'veyra_active_ai_chat';

function getAiChatStorageKey(userId?: string | null): string | null {
  return userId ? `veyra_active_ai_chat_${userId}` : null;
}

function loadPersistedChat(userId?: string | null): ChatTurn[] {
  try {
    // Always purge the legacy unscoped key so chats never cross accounts
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
    const key = getAiChatStorageKey(userId);
    if (!key) return [];
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter((m: ChatTurn) => {
          if (!m || !m.role) return false;
          // Drop stale empty assistant bubbles or outdated legacy blocking messages
          if (m.role === 'assistant' && !m.text && !m.error) return false;
          if (
            m.error &&
            (m.text.includes('Terms & Conditions') || m.text.includes('Veyra Pro subscription'))
          ) {
            return false;
          }
          return true;
        });
      }
    }
  } catch {
    // Ignore storage parse issues
  }
  return [];
}

export function AiAnalysisPage() {
  const { user, notify } = useVeyra();
  const isPro = isProSubscriptionActive(user);

  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<ChatTurn[]>(() => loadPersistedChat(user?.id));
  const [history, setHistory] = useState<AiAnalysisEntry[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [usage, setUsage] = useState<AiUsageStats | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const loadedUserIdRef = useRef<string | undefined>(user?.id);

  const refreshUsage = async () => {
    try {
      const res = await apiRequest<AiUsageStats>('/api/ai/usage');
      setUsage(res);
    } catch {
      setUsage({
        isPro,
        limit: isPro ? null : 5,
        used: 0,
        remaining: isPro ? null : 5,
        resetAt: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        allowed: true,
      });
    }
  };

  useEffect(() => {
    if (loadedUserIdRef.current !== user?.id) {
      abortRef.current?.abort();
      abortRef.current = null;
      setStreaming(false);
      setPrompt('');
      loadedUserIdRef.current = user?.id;
      setMessages(loadPersistedChat(user?.id));
    }

    if (!user?.id) {
      setHistory([]);
      setUsage(null);
      return;
    }

    void refreshUsage();
    void apiRequest<{ items: AiAnalysisEntry[] }>('/api/ai/history')
      .then((res) => setHistory(Array.isArray(res?.items) ? res.items : []))
      .catch(() => {});
    return () => {
      abortRef.current?.abort();
    };
  }, [user?.id, isPro]);

  useEffect(() => {
    try {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      // Do not persist a previous account's turns under a newly active user ID
      if (loadedUserIdRef.current !== user?.id) return;
      const key = getAiChatStorageKey(user?.id);
      if (!key) return;

      const cleanToPersist = messages.filter(
        (m) => !(m.role === 'assistant' && !m.text && !m.error)
      );
      if (cleanToPersist.length > 0) {
        window.localStorage.setItem(key, JSON.stringify(cleanToPersist));
      } else {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore storage errors
    }
  }, [messages, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const handleStartNewChat = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setMessages([]);
    setPrompt('');
    try {
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      const key = getAiChatStorageKey(user?.id);
      if (key) {
        window.localStorage.removeItem(key);
      }
    } catch {
      // Ignore
    }
  };

  const isLimitReached = !isPro && usage !== null && usage.remaining !== null && usage.remaining <= 0;

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || streaming) return;

    if (isLimitReached) {
      notify('Free message limit reached (5 messages / 2 days). Upgrade to Pro for unlimited analyses.', 'error');
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const userMsg: ChatTurn = { id: `u-${Date.now()}`, role: 'user', text: trimmed };
    const assistantId = `a-${Date.now() + 1}`;
    setMessages((prev) => [...prev, userMsg, { id: assistantId, role: 'assistant', text: '' }]);
    setPrompt('');
    setStreaming(true);

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Requested-With': 'VeyraClient',
      };
      const bearer = await getActiveAccessToken();
      if (bearer) headers.Authorization = `Bearer ${bearer}`;

      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers,
        credentials: 'include',
        signal: controller.signal,
        body: JSON.stringify({ query: trimmed }),
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errJson.error || `AI analysis request failed (${res.status})`);
      }

      const contentType = (res.headers.get('content-type') || '').toLowerCase();
      if (contentType.includes('application/json')) {
        const json = (await res.json()) as { text?: string; entry?: AiAnalysisEntry; error?: string };
        if (json.error) throw new Error(json.error);
        const answer = json.text || json.entry?.response || '';
        if (!answer.trim()) throw new Error('Empty response received from market analyst.');
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, text: answer } : m))
        );
        if (json.entry) setHistory((prev) => [json.entry!, ...prev]);
        void refreshUsage();
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Streaming response unavailable.');

      const decoder = new TextDecoder();
      let buffer = '';
      let receivedAnyChunk = false;

      const processEventBlock = (rawEvent: string) => {
        const lines = rawEvent.split(/\r?\n/);
        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line.startsWith('data:')) continue;
          const payload = JSON.parse(line.slice(5).trim()) as {
            chunk?: string;
            done?: boolean;
            error?: string;
            entry?: AiAnalysisEntry;
          };
          if (payload.chunk) {
            receivedAnyChunk = true;
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, text: m.text + payload.chunk } : m))
            );
          } else if (payload.done && payload.entry) {
            setHistory((prev) => [payload.entry!, ...prev]);
            void refreshUsage();
          } else if (payload.error) {
            throw new Error(payload.error || 'AI stream interrupted.');
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || '';
        for (const rawEvent of events) {
          processEventBlock(rawEvent);
        }
      }

      if (buffer.trim()) {
        processEventBlock(buffer);
      }

      if (!receivedAnyChunk) {
        throw new Error('No response was received from the market analyst. Please retry.');
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
      const msg = err instanceof Error ? err.message : 'Unable to generate market analysis right now.';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, text: msg, error: true, retryQuery: trimmed } : m
        )
      );
      notify(msg, 'error');
      void refreshUsage();
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-12 gap-6">
      <div className="lg:col-span-8 flex flex-col glass-surface overflow-hidden min-h-[640px]">
        {/* Header with Usage Status */}
        <div className="px-6 py-4 border-b border-[#e4e4e7] dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-lg font-semibold text-[#09090b] dark:text-white flex items-center gap-2">
              <BarChart2 className="h-4 w-4 text-[#3b82f6]" />
              <span>Veyra AI Market Analyst</span>
            </h1>
            <p className="text-xs text-[#71717a] dark:text-[#a1a1aa]">
              Grounded in live rates across 160+ fiat currencies (INR, EUR, USD, etc.), crypto &amp; sentiment
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleStartNewChat}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#e4e4e7] dark:border-white/10 bg-white/60 dark:bg-white/[0.04] px-2.5 py-1 text-xs font-medium text-[#71717a] dark:text-[#a1a1aa] hover:text-[#09090b] dark:hover:text-white hover:border-[#3b82f6]/40 transition-colors cursor-pointer"
              >
                <PlusCircle className="h-3.5 w-3.5" />
                <span>New Chat</span>
              </button>
            )}

            {isPro ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <Crown className="h-3.5 w-3.5" />
                <span>Pro Unlimited</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#3b82f6]/12 border border-[#3b82f6]/25 px-3 py-1 text-xs font-medium text-[#2563eb] dark:text-[#60a5fa]">
                <BarChart2 className="h-3.5 w-3.5" />
                <span>
                  {usage ? `${usage.remaining ?? 5} of 5 free left (resets every 2d)` : '5 msgs / 2d (Free)'}
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Message Viewport */}
        <div className="flex-1 p-6 space-y-5 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="space-y-4 py-6">
              <div className="max-w-lg space-y-1">
                <h2 className="font-display text-base font-bold text-[#09090b] dark:text-white">
                  Real-Time Currency &amp; Market Intelligence
                </h2>
                <p className="text-xs text-[#52525b] dark:text-[#a1a1aa] leading-relaxed">
                  Ask questions about Indian Rupee (INR), USD, EUR, GBP, or any global currency. Veyra AI calculates exact cross-rates, generates interactive charts, and provides macro context.
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 pt-2">
                {SUGGESTED_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void sendQuestion(q)}
                    className="text-left rounded-xl border border-[#e4e4e7] dark:border-white/10 bg-white/60 dark:bg-white/[0.03] hover:border-[#3b82f6]/50 p-3.5 text-xs font-medium text-[#09090b] dark:text-[#fafafa] transition-colors cursor-pointer"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-[#3b82f6] text-white whitespace-pre-wrap'
                        : msg.error
                          ? 'bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444]'
                          : 'bg-[#f4f4f5] dark:bg-white/[0.06] text-[#09090b] dark:text-[#fafafa]'
                    }`}
                  >
                    {msg.role === 'user' ? (
                      msg.text
                    ) : msg.error ? (
                      <div className="space-y-2">
                        <p className="whitespace-pre-wrap text-xs">{msg.text}</p>
                        {msg.retryQuery && (
                          <button
                            type="button"
                            onClick={() => void sendQuestion(msg.retryQuery!)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#ef4444]/40 bg-[#ef4444]/10 px-2.5 py-1 text-xs font-semibold hover:bg-[#ef4444]/20 cursor-pointer"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Retry</span>
                          </button>
                        )}
                      </div>
                    ) : msg.text ? (
                      <MarkdownView content={msg.text} />
                    ) : (
                      <span className="italic text-[#71717a] dark:text-[#a1a1aa] flex items-center gap-2 text-xs">
                        <span className="h-2 w-2 rounded-full bg-[#3b82f6]" />
                        <span>Synthesizing live currency data...</span>
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Free Limit Warning Banner when 0 remaining */}
        {isLimitReached && (
          <div className="mx-4 mb-2 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <p className="font-semibold text-amber-600 dark:text-amber-400">
                You’ve used all 5 free analyses for this 2-day period.
              </p>
              <p className="text-[#52525b] dark:text-[#a1a1aa]">
                Limit resets on {usage?.resetAt ? new Date(usage.resetAt).toLocaleString() : 'in 48 hours'}.
              </p>
            </div>
            <Link
              to="/dashboard/settings/subscription"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white px-3 py-1.5 font-semibold shrink-0 transition-colors"
            >
              <Crown className="h-3.5 w-3.5" />
              <span>Unlock Unlimited (₹200/mo)</span>
            </Link>
          </div>
        )}

        {/* Question Prompt Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void sendQuestion(prompt);
          }}
          className="p-4 border-t border-[#e4e4e7] dark:border-white/10 flex items-center gap-3"
        >
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={
              isLimitReached
                ? 'Free limit reached (resets every 2 days). Upgrade for unlimited.'
                : 'Ask about INR, USD, EUR rates, momentum, or ask for a chart...'
            }
            aria-label="Ask Veyra AI Analyst"
            disabled={streaming || isLimitReached}
            className="flex-1 rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-4 py-2.5 text-sm focus:outline-none focus:border-[#3b82f6] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={streaming || prompt.trim().length < 2 || isLimitReached}
            className="inline-flex items-center gap-2 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white px-4 py-2.5 text-sm font-semibold cursor-pointer disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            <span>Analyze</span>
          </button>
        </form>
      </div>

      {/* Sidebar: Pro Upgrade & Research History */}
      <aside className="lg:col-span-4 space-y-4">
        {!isPro && (
          <div className="glass-surface p-5 space-y-3 border-[#3b82f6]/30 bg-[#3b82f6]/5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#2563eb] dark:text-[#60a5fa]">
              <Crown className="h-4 w-4" />
              <span>Upgrade to Veyra Pro</span>
            </div>
            <p className="text-xs text-[#52525b] dark:text-[#a1a1aa] leading-relaxed">
              Unlock unlimited AI analyst conversations, automatic cross-rate matrix, and 90-day research history for ₹200/month.
            </p>
            <Link
              to="/dashboard/settings/subscription"
              className="inline-flex items-center justify-center gap-1.5 w-full rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white px-3 py-2 text-xs font-semibold transition-colors"
            >
              <span>Get Pro Access</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        <div className="glass-surface p-5 space-y-4">
          <h2 className="font-display text-sm font-semibold text-[#09090b] dark:text-white">
            Recent Research History
          </h2>
          {history.length === 0 ? (
            <p className="text-xs text-[#71717a]">Your saved market analyses will appear here.</p>
          ) : (
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setMessages([
                      { id: `h-u-${item.id}`, role: 'user', text: item.query },
                      { id: `h-a-${item.id}`, role: 'assistant', text: item.response },
                    ])
                  }
                  className="w-full text-left rounded-xl border border-[#e4e4e7] dark:border-white/10 p-3 hover:border-[#3b82f6]/40 transition-colors cursor-pointer space-y-1"
                >
                  <p className="text-xs font-semibold text-[#09090b] dark:text-white line-clamp-2">{item.query}</p>
                  <p className="text-[11px] text-[#71717a]">{new Date(item.created_at).toLocaleString()}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
