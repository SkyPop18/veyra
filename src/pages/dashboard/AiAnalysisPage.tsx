import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Crown, Lock, PlusCircle, Send, Sparkles } from 'lucide-react';
import { useVeyra } from '../../context/VeyraContext';
import { isProSubscriptionActive } from '../../lib/core';
import { apiRequest, getActiveAccessToken } from '../../lib/api';
import { MarkdownView } from '../../components/MarkdownView';
import type { AiAnalysisEntry } from '../../types/veyra';

const SUGGESTED_PROMPTS = [
  'What is the current BTC outlook given today’s Fear & Greed Index?',
  'Compare USD vs EUR vs CHF strength momentum this week.',
  'Which large-cap crypto assets show the strongest relative momentum today?',
  'Summarize key macro risks for INR and JPY against G10 currencies.',
];

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  error?: boolean;
}

const STORAGE_KEY = 'veyra_active_ai_chat';

function loadPersistedChat(): ChatTurn[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
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
  const [messages, setMessages] = useState<ChatTurn[]>(loadPersistedChat);
  const [history, setHistory] = useState<AiAnalysisEntry[]>([]);
  const [streaming, setStreaming] = useState(false);

  // Keep active chat persistent across window/tab changes and browser restarts
  useEffect(() => {
    try {
      if (messages.length > 0) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }, [messages]);

  const handleStartNewChat = () => {
    setMessages([]);
    setPrompt('');
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore
    }
  };

  useEffect(() => {
    if (!isPro) return;
    void apiRequest<{ items: AiAnalysisEntry[] }>('/api/ai/history')
      .then((res) => setHistory(res.items))
      .catch(() => {});
  }, [isPro]);

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || streaming) return;

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
        body: JSON.stringify({ query: trimmed }),
      });

      if (!res.ok) {
        const errJson = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errJson.error || `AI analysis request failed (${res.status})`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('Streaming response unavailable.');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';

        for (const rawEvent of events) {
          const line = rawEvent.trim();
          if (!line.startsWith('data:')) continue;
          const payload = JSON.parse(line.slice(5).trim()) as {
            chunk?: string;
            done?: boolean;
            error?: string;
            entry?: AiAnalysisEntry;
          };
          if (payload.chunk) {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, text: m.text + payload.chunk } : m))
            );
          } else if (payload.done && payload.entry) {
            setHistory((prev) => [payload.entry!, ...prev]);
          } else if (payload.error) {
            throw new Error(payload.error || 'AI stream interrupted.');
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to generate market analysis right now.';
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, text: msg, error: true } : m))
      );
      notify(msg, 'error');
    } finally {
      setStreaming(false);
    }
  };

  if (!isPro) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <div className="glass-surface p-8 sm:p-10 space-y-6 border-[#3b82f6]/35">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#3b82f6]/12 text-[#3b82f6]">
            <Lock className="h-6 w-6" />
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#2563eb] dark:text-[#60a5fa]">Veyra Pro Exclusive</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#09090b] dark:text-white">
              Unlock Data-Grounded AI Market Intelligence
            </h1>
            <p className="text-sm text-[#52525b] dark:text-[#a1a1aa] leading-relaxed">
              Ask natural-language questions about global fiat strength, crypto momentum, and macro sentiment. Every response is injected server-side with live Veyra rates and Fear &amp; Greed telemetry.
            </p>
          </div>

          <div className="rounded-xl bg-[#f4f4f5]/80 dark:bg-white/[0.04] p-5 space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="font-display text-lg font-bold">Veyra Pro Pass</span>
              <span className="font-mono-num text-2xl font-bold text-[#2563eb] dark:text-[#60a5fa]">
                ₹200 <span className="text-xs font-normal text-[#71717a]">/ 30 days</span>
              </span>
            </div>
            <ul className="space-y-2 text-sm text-[#3f3f46] dark:text-[#d4d4d8]">
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-[#3b82f6]" /><span>Real-time streamed AI analyst chat</span></li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-[#3b82f6]" /><span>Live market cache context (BTC, FX basket, sentiment)</span></li>
              <li className="flex items-center gap-2"><Check className="h-4 w-4 text-[#3b82f6]" /><span>90-day saved research history &amp; Discord /analyze access</span></li>
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/dashboard/settings/subscription"
              className="inline-flex items-center gap-2 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white px-5 py-2.5 text-sm font-semibold transition-colors"
            >
              <Crown className="h-4 w-4" />
              <span>Upgrade to Veyra Pro (₹200/month)</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid lg:grid-cols-12 gap-6">
      <div className="lg:col-span-8 flex flex-col glass-surface overflow-hidden min-h-[600px]">
        <div className="px-6 py-4 border-b border-[#e4e4e7] dark:border-white/10 flex items-center justify-between">
          <div>
            <h1 className="font-display text-lg font-bold text-[#09090b] dark:text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#3b82f6]" />
              <span>Veyra Pro AI Market Analyst</span>
            </h1>
            <p className="text-xs text-[#71717a] dark:text-[#a1a1aa]">
              Grounded in live cached FX rates, top crypto markets &amp; Fear/Greed Index
            </p>
          </div>
          <div className="flex items-center gap-3">
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
            <span className="text-xs font-semibold text-[#2563eb] dark:text-[#60a5fa]">Pro Active</span>
          </div>
        </div>

        <div className="flex-1 p-6 space-y-5 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="space-y-4 py-6">
              <p className="text-sm text-[#52525b] dark:text-[#a1a1aa]">
                Ask a macro, FX strength, or cryptocurrency research question — or start with a briefing prompt:
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
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
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#3b82f6] text-white whitespace-pre-wrap'
                      : msg.error
                        ? 'bg-[#ef4444]/10 border border-[#ef4444]/30 text-[#ef4444] whitespace-pre-wrap'
                        : 'bg-[#f4f4f5] dark:bg-white/[0.06] text-[#09090b] dark:text-[#fafafa]'
                  }`}
                >
                  {msg.role === 'user' || msg.error ? (
                    msg.text
                  ) : msg.text ? (
                    <MarkdownView content={msg.text} />
                  ) : (
                    <span className="italic text-[#71717a] dark:text-[#a1a1aa]">
                      Synthesizing live market data...
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

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
            placeholder="Ask about EUR/USD strength, BTC sentiment, or global macro trends..."
            aria-label="Ask Veyra AI Analyst"
            disabled={streaming}
            className="flex-1 rounded-xl border border-[#e4e4e7] dark:border-white/15 bg-white dark:bg-[#09090b] px-4 py-2.5 text-sm focus:outline-none focus:border-[#3b82f6]"
          />
          <button
            type="submit"
            disabled={streaming || prompt.trim().length < 3}
            className="inline-flex items-center gap-2 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white px-4 py-2.5 text-sm font-semibold cursor-pointer disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            <span>Analyze</span>
          </button>
        </form>
      </div>

      <aside className="lg:col-span-4 glass-surface p-5 space-y-4">
        <h2 className="font-display text-sm font-semibold text-[#09090b] dark:text-white">
          Recent Research History
        </h2>
        {history.length === 0 ? (
          <p className="text-xs text-[#71717a]">Your saved Pro analyses appear here for 90 days.</p>
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
      </aside>
    </div>
  );
}
