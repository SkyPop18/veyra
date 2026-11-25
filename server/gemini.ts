import { GoogleGenAI, Type } from '@google/genai';
import type { NewsArticle } from '../src/types/veyra.ts';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      apiVersion: 'v1beta',
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface AiConversationTurn {
  role: 'user' | 'assistant';
  text: string;
}

export async function streamMarketAnalysis(params: {
  query: string;
  history?: AiConversationTurn[];
  marketSnapshot: string;
  onChunk: (text: string) => void;
}): Promise<{ fullText: string; tokensUsed: number }> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error(
      'GEMINI_API_KEY is not configured in server environment secrets. Add GEMINI_API_KEY in Settings > Secrets to enable live AI analysis.'
    );
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const currentYear = todayIso.slice(0, 4);

  const systemInstruction = [
    'You are Veyra Market Intelligence, a professional institutional FX and cryptocurrency research analyst.',
    `CURRENT SERVER DATE: ${todayIso} (Year: ${currentYear}). Dates up to and including ${todayIso} are historical or current — NEVER claim ${currentYear} is in the future.`,
    'RESPONSE RULES:',
    '- Respond directly to the user with clean data and analysis. NEVER output internal reasoning or meta sentences like "The user is asking...".',
    '- Maintain conversation continuity: if the user asks a short follow-up (such as "29 oct, 5 nov, 20 nov, today", "no like oct 2026, nov 2026", or "what about in EUR?"), apply it to the currencies or crypto discussed in previous messages.',
    '- When asked about any currency (e.g. INR / Indian Rupee, EUR, GBP, JPY, AED) or cryptocurrency, state its exact current live rate vs USD (and the exact requested pair rate such as EUR/INR if asked), 24h change, and relative strength score from the LIVE VEYRA MARKET SNAPSHOT.',
    '- For historical trend queries ("1m", "3m", "oct 2026", specific dates like "29 oct", "5 nov", "20 nov", "today"): USE the exact HISTORICAL TREND SERIES provided in the market snapshot! Select/include the exact dates from that series. If an exact requested calendar date fell on a weekend or market holiday, use the nearest prior available business-day rate from the series and label it concisely (e.g., "Nov 20" or "Oct 29 (closest market print)"). NEVER invent or guess 2023/stale numbers, and NEVER falsely say you lack historical trend data when the historical series is in the snapshot.',
    '- If the user asks to convert or chart any pair A/B (e.g. EUR/INR or GBP/INR), compute cross-rates directly using live or dated USD rates: Rate(A to B) = Rate(USD to B) / Rate(USD to A).',
    '- CHART FORMAT: Whenever showing a time trend over dates/months (e.g. 1M, Oct–Nov, specific dates), ALWAYS emit a `"type": "line"` or `"type": "area"` chart (NOT a `"bar"` chart of other currencies unless the user asked to compare currencies):',
    '```chart',
    '{"type": "line", "title": "USD to INR Trend (Oct - Nov)", "data": [{"date": "2026-10-29", "USD_INR": 94.68}, {"date": "2026-11-05", "USD_INR": 94.12}, {"date": "2026-11-20", "USD_INR": 93.15}, {"date": "2026-11-25", "USD_INR": 92.93}]}',
    '```',
    '- Supported chart types: "line", "area", "bar", "pie". Always output valid double-quoted JSON inside ```chart blocks with zero comments or trailing commas.',
    '- STRICT RULE: NEVER generate image files, markdown image links (![]()), SVG code, base64 images, or ASCII-art charts.',
    '- Never recommend executing trades, swaps, or financial transactions, and end with a concise one-line informational-only disclaimer.',
    '',
    'LIVE VEYRA MARKET SNAPSHOT:',
    params.marketSnapshot,
  ].join('\n');

  const priorTurns = (params.history || [])
    .filter((t) => t && t.text && t.text.trim().length > 0)
    .slice(-8)
    .map((t) => ({
      role: t.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [{ text: t.text.trim().slice(0, 2500) }],
    }));

  const contents = [
    ...priorTurns,
    { role: 'user' as const, parts: [{ text: params.query }] },
  ];

  // Prioritize high-quality, fast flash models with graceful fallback
  const CANDIDATE_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-3.1-flash-lite'];
  let lastError: Error | null = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const stream = await ai.models.generateContentStream({
        model: modelName,
        contents,
        config: {
          systemInstruction,
        },
      });

      let fullText = '';
      for await (const chunk of stream) {
        const piece = chunk.text ?? '';
        if (piece) {
          fullText += piece;
          params.onChunk(piece);
        }
      }

      if (fullText.trim()) {
        const promptLen = systemInstruction.length + params.query.length;
        return {
          fullText,
          tokensUsed: Math.max(1, Math.ceil((promptLen + fullText.length) / 4)),
        };
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.warn(`[Veyra AI] Model ${modelName} unavailable, falling back...`, lastError.message);
    }
  }

  throw lastError || new Error('All AI intelligence models are currently busy. Please retry shortly.');
}

export async function generateMarketAnalysis(params: {
  query: string;
  history?: AiConversationTurn[];
  marketSnapshot: string;
}): Promise<string> {
  let result = '';
  await streamMarketAnalysis({
    query: params.query,
    history: params.history,
    marketSnapshot: params.marketSnapshot,
    onChunk: (chunk) => {
      result += chunk;
    },
  });
  return result;
}

export async function rankNewsArticlesWithGemini(
  articles: NewsArticle[],
  topTags: string[]
): Promise<Array<{ id: string; reason: string }> | null> {
  const ai = getGeminiClient();
  if (!ai || articles.length === 0) return null;

  const CANDIDATE_MODELS = ['gemini-2.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const compact = articles.slice(0, 18).map((a) => ({
        id: a.id,
        title: a.title,
        section: a.section,
        tags: a.tags,
      }));

      const response = await ai.models.generateContent({
        model: modelName,
        contents: `Rank the top 6 most relevant articles for a user whose primary market interests are: [${topTags.join(', ') || 'global forex, bitcoin, central banks'}].\n\nArticles:\n${JSON.stringify(compact)}`,
        config: {
          systemInstruction:
            'Return a JSON array of the top 6 article IDs ordered by relevance, each with a concise 6-10 word reason referencing the user interests.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                reason: { type: Type.STRING },
              },
              required: ['id', 'reason'],
            },
          },
        },
      });

      const raw = (response.text ?? '').trim();
      if (!raw) continue;
      const parsed = JSON.parse(raw) as Array<{ id: string; reason: string }>;
      if (!Array.isArray(parsed)) continue;
      return parsed.slice(0, 8);
    } catch {
      continue;
    }
  }
  return null;
}
