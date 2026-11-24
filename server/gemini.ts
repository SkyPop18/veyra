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

export async function streamMarketAnalysis(params: {
  query: string;
  marketSnapshot: string;
  onChunk: (text: string) => void;
}): Promise<{ fullText: string; tokensUsed: number }> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error(
      'GEMINI_API_KEY is not configured in server environment secrets. Add GEMINI_API_KEY in Settings > Secrets to enable live Pro AI analysis.'
    );
  }

  const systemInstruction = [
    'You are Veyra Market Intelligence, a rigorous institutional FX and cryptocurrency research analyst.',
    'Never recommend executing trades, swaps, or financial transactions, and always include a concise one-line informational-only disclaimer at the end.',
    'Ground every claim in the live Veyra market snapshot provided below. Use crisp bullet points, exact figures, and balanced upside/downside risk factors.',
    'Keep responses concise (180-320 words) unless the user asks for an exhaustive breakdown.',
  ].join(' ');

  const contents = `[SYSTEM INSTRUCTION: ${systemInstruction}]\n\nLIVE VEYRA MARKET SNAPSHOT:\n${params.marketSnapshot}\n\nUSER QUESTION:\n${params.query}`;

  // Prioritize lower-usage, high-speed flash-lite models to preserve quota
  const CANDIDATE_MODELS = ['gemini-2.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
  let lastError: Error | null = null;

  for (const modelName of CANDIDATE_MODELS) {
    try {
      const stream = await ai.models.generateContentStream({
        model: modelName,
        contents,
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
        return {
          fullText,
          tokensUsed: Math.max(1, Math.ceil((contents.length + fullText.length) / 4)),
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
  marketSnapshot: string;
}): Promise<string> {
  let result = '';
  await streamMarketAnalysis({
    query: params.query,
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
