import type {
  AssetType,
  CryptoAsset,
  FiatCurrency,
  NewsArticle,
  StrengthEntry,
  UserInteraction,
  UserProfile,
} from '../types/veyra';

export const CURRENT_TERMS_VERSION = '2026-11';
export const MIN_PASSWORD_LENGTH = 10;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function roundTo(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function hasAcceptedCurrentTerms(
  profile: Pick<UserProfile, 'terms_accepted_at' | 'privacy_accepted_at' | 'terms_version'> | null | undefined,
  requiredVersion: string = CURRENT_TERMS_VERSION
): boolean {
  if (!profile) return false;
  return Boolean(
    profile.terms_accepted_at &&
      profile.privacy_accepted_at &&
      profile.terms_version === requiredVersion
  );
}

export function isValidPassword(password: string): boolean {
  return typeof password === 'string' && password.length >= MIN_PASSWORD_LENGTH && password.length <= 128;
}

export function countryCodeToFlag(iso2: string): string {
  const clean = iso2.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(clean)) return '🌐';
  return String.fromCodePoint(...[...clean].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

export function calculateFiatStrengthScore(params: {
  change24h: number;
  change7d: number;
  change30d: number;
  liquidityBase?: number;
}): number {
  const base = params.liquidityBase ?? 55;
  const momentum =
    params.change24h * 8.5 +
    params.change7d * 4.2 +
    params.change30d * 1.8;
  return roundTo(clamp(base + momentum, 8, 99), 1);
}

export function calculateCryptoStrengthScore(params: {
  marketCapRank: number;
  change24h: number;
  change7d: number;
  volumeToMcapRatio: number;
}): number {
  const rankComponent = clamp(42 - Math.log2(Math.max(1, params.marketCapRank)) * 5.2, 8, 42);
  const momentumComponent = clamp(
    26 + params.change24h * 1.6 + params.change7d * 0.9,
    4,
    46
  );
  const liquidityComponent = clamp(params.volumeToMcapRatio * 120, 2, 12);
  return roundTo(clamp(rankComponent + momentumComponent + liquidityComponent, 5, 99), 1);
}

export function rankStrengthEntries(entries: StrengthEntry[]): StrengthEntry[] {
  return [...entries]
    .sort((a, b) => {
      if (b.strengthScore !== a.strengthScore) return b.strengthScore - a.strengthScore;
      return b.change7d - a.change7d;
    })
    .map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
    }));
}

export function convertAmount(
  amount: number,
  fromUnitsPerUsd: number,
  toUnitsPerUsd: number
): number {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  if (!Number.isFinite(fromUnitsPerUsd) || fromUnitsPerUsd <= 0) return 0;
  if (!Number.isFinite(toUnitsPerUsd) || toUnitsPerUsd <= 0) return 0;
  const amountInUsd = amount / fromUnitsPerUsd;
  return amountInUsd * toUnitsPerUsd;
}

export interface ComparisonVerdict {
  strongerCode: string;
  weakerCode: string;
  scoreDiff: number;
  relativePctStronger: number;
  summary: string;
}

export function compareStrengthEntries(a: StrengthEntry, b: StrengthEntry): ComparisonVerdict {
  const stronger = a.strengthScore >= b.strengthScore ? a : b;
  const weaker = a.strengthScore >= b.strengthScore ? b : a;
  const scoreDiff = roundTo(stronger.strengthScore - weaker.strengthScore, 1);
  const relativePctStronger =
    weaker.strengthScore > 0
      ? roundTo(((stronger.strengthScore - weaker.strengthScore) / weaker.strengthScore) * 100, 1)
      : 0;
  const summary =
    scoreDiff === 0
      ? `${a.code} and ${b.code} are evenly matched at ${a.strengthScore.toFixed(1)}/100.`
      : `${stronger.code} leads ${weaker.code} by +${scoreDiff.toFixed(1)} strength pts (+${relativePctStronger.toFixed(1)}% stronger).`;

  return {
    strongerCode: stronger.code,
    weakerCode: weaker.code,
    scoreDiff,
    relativePctStronger,
    summary,
  };
}

export function isProSubscriptionActive(
  profile: Pick<UserProfile, 'subscription_tier' | 'pro_expires_at'> | null | undefined,
  nowMs: number = Date.now()
): boolean {
  if (!profile || profile.subscription_tier !== 'pro') return false;
  if (!profile.pro_expires_at) return true;
  const expiryMs = Date.parse(profile.pro_expires_at);
  if (Number.isNaN(expiryMs)) return false;
  return expiryMs > nowMs;
}

export function sanitizeExternalUrl(rawUrl: string | null | undefined): string {
  if (!rawUrl || typeof rawUrl !== 'string') return '#';
  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return '#';
  } catch {
    return '#';
  }
}

export function rankArticlesByUserProfile(
  articles: NewsArticle[],
  interactions: UserInteraction[],
  followedSlugs: string[]
): NewsArticle[] {
  const tagWeights = new Map<string, number>();

  for (const slug of followedSlugs) {
    const key = slug.toLowerCase();
    tagWeights.set(key, (tagWeights.get(key) ?? 0) + 4);
  }

  for (const item of interactions) {
    const delta =
      item.interaction_type === 'like'
        ? 3.5
        : item.interaction_type === 'save'
          ? 4.0
          : item.interaction_type === 'search'
            ? 2.5
            : item.interaction_type === 'view'
              ? 1.0
              : item.interaction_type === 'dislike'
                ? -5.0
                : 0;
    for (const rawTag of item.tags) {
      const tag = rawTag.toLowerCase();
      tagWeights.set(tag, (tagWeights.get(tag) ?? 0) + delta);
    }
  }

  const dislikedIds = new Set(
    interactions
      .filter((i) => i.interaction_type === 'dislike')
      .map((i) => i.content_id)
  );

  return articles
    .filter((a) => !dislikedIds.has(a.id))
    .map((article) => {
      let score = 10;
      const matchedTags: string[] = [];
      for (const rawTag of article.tags) {
        const tag = rawTag.toLowerCase();
        const weight = tagWeights.get(tag) ?? 0;
        score += weight;
        if (weight > 0) matchedTags.push(rawTag);
      }
      const sectionWeight = tagWeights.get(article.section.toLowerCase()) ?? 0;
      score += sectionWeight * 0.5;
      return {
        ...article,
        relevanceScore: roundTo(score, 1),
        aiReason:
          matchedTags.length > 0
            ? `Matched your interest in ${matchedTags.slice(0, 2).join(' & ')}`
            : 'Trending global macro development',
      };
    })
    .sort((a, b) => (b.relevanceScore ?? 0) - (a.relevanceScore ?? 0));
}

export function formatPrice(value: number, currencySymbol = '$'): string {
  if (!Number.isFinite(value)) return `${currencySymbol}0.00`;
  const abs = Math.abs(value);
  if (abs >= 1000) {
    return `${currencySymbol}${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  if (abs >= 1) {
    return `${currencySymbol}${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })}`;
  }
  return `${currencySymbol}${value.toLocaleString('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  })}`;
}

export function formatCompactUsd(value: number): string {
  if (!Number.isFinite(value)) return '$0';
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function formatSignedPct(value: number): string {
  if (!Number.isFinite(value)) return '0.00%';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
}

export function buildUnifiedStrengthList(
  fiat: FiatCurrency[],
  crypto: CryptoAsset[]
): { fiat: StrengthEntry[]; crypto: StrengthEntry[]; all: StrengthEntry[] } {
  const fiatEntries = rankStrengthEntries(
    fiat.map((f) => ({
      code: f.code,
      id: f.code.toLowerCase(),
      name: f.name,
      flag: f.flag,
      assetType: 'fiat' as AssetType,
      strengthScore: f.strengthScore,
      rank: f.rank,
      change24h: f.change24h,
      change7d: f.change7d,
      vsUsdRate: f.rateVsUsd,
      sparkline: f.sparkline,
    }))
  );

  const cryptoEntries = rankStrengthEntries(
    crypto.map((c) => ({
      code: c.symbol.toUpperCase(),
      id: c.id,
      name: c.name,
      assetType: 'crypto' as AssetType,
      strengthScore: c.strengthScore,
      rank: c.rank,
      change24h: c.price_change_percentage_24h,
      change7d: c.price_change_percentage_7d,
      vsUsdRate: c.current_price,
      sparkline: c.sparkline,
    }))
  );

  return {
    fiat: fiatEntries,
    crypto: cryptoEntries,
    all: rankStrengthEntries([...fiatEntries, ...cryptoEntries]),
  };
}
