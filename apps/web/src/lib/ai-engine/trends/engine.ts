import { createLogger } from '../utils/logger';
import {
  collectSeasonalSignals,
  collectRedditSignals,
  collectGoogleTrends,
  type RawTrendSignal,
} from './collectors';
import { scoreTrends, type ScoredTrend } from './scorer';

const log = createLogger('trends:engine');

let cachedTrends: ScoredTrend[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

const BEAUTY_SUBREDDITS = ['SkincareAddiction', 'AsianBeauty', 'RedditLaqueristas', 'Nails'];
const BEAUTY_SEARCH_TERMS = ['j-beauty', 'japanese nail care', 'natural nail care', 'camellia oil beauty'];

export async function getTrends(options?: {
  forceRefresh?: boolean;
  minScore?: number;
  limit?: number;
  categories?: string[];
}): Promise<ScoredTrend[]> {
  const forceRefresh = options?.forceRefresh ?? false;
  const minScore = options?.minScore ?? 0.4;
  const limit = options?.limit ?? 20;
  const categories = options?.categories;

  if (!forceRefresh && cachedTrends && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return filterTrends(cachedTrends, minScore, limit, categories);
  }

  log.info('Refreshing trend signals');
  const startTime = Date.now();

  const raw: RawTrendSignal[] = [];

  const [seasonal, reddit, googleTrends] = await Promise.allSettled([
    collectSeasonalSignals(),
    collectRedditSignals(BEAUTY_SUBREDDITS),
    collectGoogleTrends(BEAUTY_SEARCH_TERMS),
  ]);

  if (seasonal.status === 'fulfilled') raw.push(...seasonal.value);
  if (reddit.status === 'fulfilled') raw.push(...reddit.value);
  if (googleTrends.status === 'fulfilled') raw.push(...googleTrends.value);

  const scored = scoreTrends(raw);

  cachedTrends = scored;
  cacheTimestamp = Date.now();

  const durationMs = Date.now() - startTime;
  log.info('Trends refreshed', { durationMs, data: { rawCount: raw.length, scoredCount: scored.length } });

  return filterTrends(scored, minScore, limit, categories);
}

function filterTrends(
  trends: ScoredTrend[],
  minScore: number,
  limit: number,
  categories?: string[],
): ScoredTrend[] {
  let filtered = trends.filter((t) => t.compositeScore >= minScore);

  if (categories && categories.length > 0) {
    filtered = filtered.filter((t) => categories.includes(t.category));
  }

  return filtered.slice(0, limit);
}

export async function getTrendForGeneration(
  platform: string,
  contentType: string,
  objective: string,
): Promise<string> {
  const trends = await getTrends({ minScore: 0.5, limit: 5 });

  if (trends.length === 0) return '';

  const relevant = trends
    .filter((t) => {
      if (objective === 'conversion' && t.category === 'product') return true;
      if (objective === 'engagement' && t.viralPotential >= 0.6) return true;
      if (objective === 'awareness' && t.brandRelevance >= 0.6) return true;
      return t.compositeScore >= 0.6;
    })
    .slice(0, 3);

  if (relevant.length === 0) return '';

  return relevant
    .map((t) => `[${t.category}] ${t.title} (score: ${t.compositeScore})\n${t.description}\nFormats suggérés: ${t.suggestedFormats.join(', ')}\nFenêtre: ${t.opportunityWindow}`)
    .join('\n\n---\n\n');
}

export function clearTrendCache(): void {
  cachedTrends = null;
  cacheTimestamp = 0;
}
