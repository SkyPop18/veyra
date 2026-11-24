import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CURRENT_TERMS_VERSION,
  calculateCryptoStrengthScore,
  calculateFiatStrengthScore,
  compareStrengthEntries,
  convertAmount,
  countryCodeToFlag,
  hasAcceptedCurrentTerms,
  isProSubscriptionActive,
  isValidPassword,
  rankArticlesByUserProfile,
  rankStrengthEntries,
  sanitizeExternalUrl,
} from './core';
import type { NewsArticle, StrengthEntry, UserInteraction } from '../types/veyra';

test('calculateFiatStrengthScore stays normalized within [8, 99] and rewards positive momentum', () => {
  const strong = calculateFiatStrengthScore({ change24h: 0.8, change7d: 1.9, change30d: 3.1, liquidityBase: 72 });
  const weak = calculateFiatStrengthScore({ change24h: -0.9, change7d: -2.1, change30d: -4.0, liquidityBase: 50 });
  assert.ok(strong > weak);
  assert.ok(strong <= 99 && strong >= 8);
  assert.ok(weak <= 99 && weak >= 8);
});

test('calculateCryptoStrengthScore weights market cap rank, momentum, and liquidity', () => {
  const btc = calculateCryptoStrengthScore({
    marketCapRank: 1,
    change24h: 2.4,
    change7d: 6.1,
    volumeToMcapRatio: 0.04,
  });
  const smallCapDown = calculateCryptoStrengthScore({
    marketCapRank: 80,
    change24h: -6.5,
    change7d: -12.0,
    volumeToMcapRatio: 0.01,
  });
  assert.ok(btc > smallCapDown);
  assert.ok(btc <= 99 && smallCapDown >= 5);
});

test('rankStrengthEntries sorts descending and assigns sequential ranks', () => {
  const sample: StrengthEntry[] = [
    { code: 'JPY', id: 'jpy', name: 'Japanese Yen', assetType: 'fiat', strengthScore: 44.2, rank: 0, change24h: -0.4, change7d: -1.1, vsUsdRate: 152, sparkline: [] },
    { code: 'USD', id: 'usd', name: 'US Dollar', assetType: 'fiat', strengthScore: 84.5, rank: 0, change24h: 0.3, change7d: 1.2, vsUsdRate: 1, sparkline: [] },
    { code: 'CHF', id: 'chf', name: 'Swiss Franc', assetType: 'fiat', strengthScore: 88.1, rank: 0, change24h: 0.5, change7d: 1.8, vsUsdRate: 0.88, sparkline: [] },
  ];
  const ranked = rankStrengthEntries(sample);
  assert.deepEqual(ranked.map((r) => r.code), ['CHF', 'USD', 'JPY']);
  assert.deepEqual(ranked.map((r) => r.rank), [1, 2, 3]);
});

test('convertAmount computes view-only currency conversion accurately and handles invalid inputs', () => {
  const inr = convertAmount(100, 0.92, 84.0);
  assert.equal(Math.round(inr), Math.round((100 / 0.92) * 84.0));
  assert.equal(convertAmount(-50, 1, 84), 0);
  assert.equal(convertAmount(100, 0, 84), 0);
});

test('compareStrengthEntries computes accurate delta and stronger verdict', () => {
  const eur: StrengthEntry = { code: 'EUR', id: 'eur', name: 'Euro', assetType: 'fiat', strengthScore: 70, rank: 2, change24h: 0.1, change7d: 0.2, vsUsdRate: 0.92, sparkline: [] };
  const usd: StrengthEntry = { code: 'USD', id: 'usd', name: 'US Dollar', assetType: 'fiat', strengthScore: 84, rank: 1, change24h: 0.3, change7d: 1.1, vsUsdRate: 1, sparkline: [] };
  const verdict = compareStrengthEntries(eur, usd);
  assert.equal(verdict.strongerCode, 'USD');
  assert.equal(verdict.weakerCode, 'EUR');
  assert.equal(verdict.scoreDiff, 14);
  assert.equal(verdict.relativePctStronger, 20);
});

test('isProSubscriptionActive enforces tier and 30-day expiry timestamp', () => {
  const now = Date.parse('2026-11-22T12:00:00Z');
  assert.equal(isProSubscriptionActive({ subscription_tier: 'free', pro_expires_at: null }, now), false);
  assert.equal(isProSubscriptionActive({ subscription_tier: 'pro', pro_expires_at: null }, now), false);
  assert.equal(isProSubscriptionActive({ subscription_tier: 'pro', pro_expires_at: undefined }, now), false);
  assert.equal(isProSubscriptionActive({ subscription_tier: 'pro', pro_expires_at: '' }, now), false);
  assert.equal(
    isProSubscriptionActive({ subscription_tier: 'pro', pro_expires_at: '2026-12-20T12:00:00Z' }, now),
    true
  );
  assert.equal(
    isProSubscriptionActive({ subscription_tier: 'pro', pro_expires_at: '2026-11-20T12:00:00Z' }, now),
    false
  );
});

test('sanitizeExternalUrl blocks XSS schemes and permits valid http/https links', () => {
  assert.equal(sanitizeExternalUrl('javascript:alert(1)'), '#');
  assert.equal(sanitizeExternalUrl('data:text/html,<script>alert(1)</script>'), '#');
  assert.equal(sanitizeExternalUrl('vbscript:msgbox(1)'), '#');
  assert.equal(sanitizeExternalUrl('https://reuters.com/markets/fx'), 'https://reuters.com/markets/fx');
});

test('rankArticlesByUserProfile boosts liked/followed tags and excludes disliked articles', () => {
  const articles: NewsArticle[] = [
    { id: 'a1', title: 'ECB Rates', summary: '', source: 'Reuters', url: 'https://example.com/1', publishedAt: '', section: 'economic', tags: ['forex', 'euro'] },
    { id: 'a2', title: 'Bitcoin ETF Flows', summary: '', source: 'CoinDesk', url: 'https://example.com/2', publishedAt: '', section: 'crypto', tags: ['bitcoin', 'crypto'] },
    { id: 'a3', title: 'Disliked Story', summary: '', source: 'News', url: 'https://example.com/3', publishedAt: '', section: 'taxes', tags: ['taxes'] },
  ];
  const interactions: UserInteraction[] = [
    { id: 'i1', user_id: 'u1', interaction_type: 'like', content_type: 'news', content_id: 'x', content_title: 'BTC', tags: ['bitcoin'], created_at: '' },
    { id: 'i2', user_id: 'u1', interaction_type: 'dislike', content_type: 'news', content_id: 'a3', content_title: 'Disliked', tags: ['taxes'], created_at: '' },
  ];
  const ranked = rankArticlesByUserProfile(articles, interactions, ['crypto']);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].id, 'a2');
});

test('hasAcceptedCurrentTerms enforces timestamps and current terms version', () => {
  assert.equal(hasAcceptedCurrentTerms(null), false);
  assert.equal(
    hasAcceptedCurrentTerms({ terms_accepted_at: null, privacy_accepted_at: null, terms_version: null }),
    false
  );
  assert.equal(
    hasAcceptedCurrentTerms({
      terms_accepted_at: '2026-11-22T00:00:00Z',
      privacy_accepted_at: '2026-11-22T00:00:00Z',
      terms_version: '2025-01',
    }),
    false
  );
  assert.equal(
    hasAcceptedCurrentTerms({
      terms_accepted_at: '2026-11-22T00:00:00Z',
      privacy_accepted_at: '2026-11-22T00:00:00Z',
      terms_version: CURRENT_TERMS_VERSION,
    }),
    true
  );
});

test('isValidPassword requires at least 10 characters', () => {
  assert.equal(isValidPassword('Short9!'), false);
  assert.equal(isValidPassword('NineChars'), false);
  assert.equal(isValidPassword('TenCharPwd!'), true);
});

test('countryCodeToFlag converts ISO alpha-2 codes and handles special codes gracefully', () => {
  assert.equal(countryCodeToFlag('US'), '🇺🇸');
  assert.equal(countryCodeToFlag('IN'), '🇮🇳');
  assert.equal(countryCodeToFlag('EU'), '🇪🇺');
  assert.equal(countryCodeToFlag(''), '🌐');
});
