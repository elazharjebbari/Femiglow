import { createLogger } from '../utils/logger';
import type { RawTrendSignal } from './collectors';

const log = createLogger('trends:scorer');

export interface ScoredTrend {
  id: string;
  source: string;
  category: string;
  title: string;
  description: string;
  originalUrl?: string;

  brandRelevance: number;
  viralPotential: number;
  timeSensitivity: number;
  contentFeasibility: number;
  compositeScore: number;

  suggestedFormats: string[];
  suggestedHooks: string[];
  opportunityWindow: string;
  riskAssessment: 'low' | 'medium' | 'high';

  detectedAt: Date;
  status: 'new' | 'reviewed' | 'actioned' | 'expired' | 'dismissed';
}

const BRAND_KEYWORDS = [
  'nail', 'ongle', 'hand', 'main', 'beauty', 'beaute', 'skin', 'peau',
  'care', 'soin', 'ritual', 'rituel', 'japan', 'japon', 'jbeauty', 'j-beauty',
  'camellia', 'rice', 'sake', 'matcha', 'yuzu', 'tsubaki', 'komenuka',
  'natural', 'naturel', 'minimal', 'clean', 'slow', 'glow', 'eclat',
  'femiglow', 'cream', 'oil', 'huile', 'serum',
];

const VIRAL_KEYWORDS = [
  'hack', 'secret', 'routine', 'before after', 'transformation', 'grwm',
  'review', 'asmr', 'satisfying', 'trend', 'viral', 'try', 'test',
  'glass skin', 'glow up', 'night routine', 'morning routine',
];

function scoreBrandRelevance(signal: RawTrendSignal): number {
  const text = `${signal.title} ${signal.description}`.toLowerCase();
  let score = 0.3;

  const matchCount = BRAND_KEYWORDS.filter((kw) => text.includes(kw)).length;
  score += Math.min(matchCount * 0.08, 0.5);

  if (signal.category === 'ingredient' || signal.category === 'routine') score += 0.1;
  if (signal.category === 'cultural' && /japan/i.test(text)) score += 0.15;
  if (signal.source === 'seasonal' || signal.source === 'evergreen') score += 0.1;

  return Math.min(score, 1);
}

function scoreViralPotential(signal: RawTrendSignal): number {
  const text = `${signal.title} ${signal.description}`.toLowerCase();
  let score = 0.3;

  const matchCount = VIRAL_KEYWORDS.filter((kw) => text.includes(kw)).length;
  score += Math.min(matchCount * 0.1, 0.4);

  if (signal.rawScore) score += signal.rawScore * 0.3;
  if (signal.source === 'reddit' || signal.source === 'tiktok') score += 0.1;

  return Math.min(score, 1);
}

function scoreTimeSensitivity(signal: RawTrendSignal): number {
  if (signal.source === 'evergreen') return 0.2;
  if (signal.source === 'seasonal') return 0.6;

  const ageHours = (Date.now() - signal.detectedAt.getTime()) / (1000 * 60 * 60);
  if (ageHours < 6) return 0.95;
  if (ageHours < 24) return 0.85;
  if (ageHours < 72) return 0.7;
  if (ageHours < 168) return 0.5;
  return 0.3;
}

function scoreContentFeasibility(signal: RawTrendSignal): number {
  let score = 0.7;

  if (signal.category === 'product') score = 0.9;
  if (signal.category === 'routine') score = 0.85;
  if (signal.category === 'ingredient') score = 0.85;
  if (signal.category === 'cultural') score = 0.75;
  if (signal.category === 'celebrity') score = 0.5;
  if (signal.category === 'meme') score = 0.4;
  if (signal.category === 'news') score = 0.6;

  return score;
}

function suggestFormats(signal: RawTrendSignal): string[] {
  const formats: string[] = [];

  if (signal.category === 'routine' || signal.category === 'ingredient') {
    formats.push('carousel', 'reel');
  }
  if (signal.category === 'aesthetic' || signal.category === 'cultural') {
    formats.push('reel', 'story');
  }
  if (signal.category === 'product') {
    formats.push('post', 'carousel', 'reel');
  }
  if (signal.category === 'seasonal') {
    formats.push('reel', 'carousel', 'story', 'post');
  }

  return [...new Set(formats)].slice(0, 4);
}

function suggestHooks(signal: RawTrendSignal): string[] {
  const hooks: string[] = [];
  const title = signal.title;

  hooks.push(`Le secret que personne ne vous dit sur ${title.toLowerCase()}`);
  hooks.push(`Pourquoi ${title.toLowerCase()} change tout dans votre rituel`);
  hooks.push(`J'ai testé ${title.toLowerCase()} pendant 30 jours`);

  return hooks.slice(0, 3);
}

function determineOpportunityWindow(signal: RawTrendSignal): string {
  if (signal.source === 'evergreen') return 'evergreen';
  if (signal.source === 'seasonal') return '2 weeks';
  if (signal.category === 'meme' || signal.category === 'celebrity') return '24h';
  if (signal.category === 'news') return '3 days';
  return '1 week';
}

function assessRisk(signal: RawTrendSignal): 'low' | 'medium' | 'high' {
  if (signal.category === 'celebrity' || signal.category === 'meme') return 'medium';
  if (signal.category === 'news') return 'medium';
  const text = `${signal.title} ${signal.description}`.toLowerCase();
  if (/controversi|scandal|lawsuit|boycott/i.test(text)) return 'high';
  return 'low';
}

export function scoreTrends(raw: RawTrendSignal[]): ScoredTrend[] {
  const scored: ScoredTrend[] = [];

  for (const signal of raw) {
    const brandRelevance = scoreBrandRelevance(signal);
    const viralPotential = scoreViralPotential(signal);
    const timeSensitivity = scoreTimeSensitivity(signal);
    const contentFeasibility = scoreContentFeasibility(signal);

    const compositeScore =
      brandRelevance * 0.35 +
      viralPotential * 0.25 +
      timeSensitivity * 0.2 +
      contentFeasibility * 0.2;

    scored.push({
      id: `trend-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      source: signal.source,
      category: signal.category,
      title: signal.title,
      description: signal.description,
      originalUrl: signal.originalUrl,
      brandRelevance: Math.round(brandRelevance * 100) / 100,
      viralPotential: Math.round(viralPotential * 100) / 100,
      timeSensitivity: Math.round(timeSensitivity * 100) / 100,
      contentFeasibility: Math.round(contentFeasibility * 100) / 100,
      compositeScore: Math.round(compositeScore * 100) / 100,
      suggestedFormats: suggestFormats(signal),
      suggestedHooks: suggestHooks(signal),
      opportunityWindow: determineOpportunityWindow(signal),
      riskAssessment: assessRisk(signal),
      detectedAt: signal.detectedAt,
      status: 'new',
    });
  }

  scored.sort((a, b) => b.compositeScore - a.compositeScore);

  log.info('Scored trends', { data: { total: scored.length, top3: scored.slice(0, 3).map((t) => `${t.title} (${t.compositeScore})`) } });

  return scored;
}
