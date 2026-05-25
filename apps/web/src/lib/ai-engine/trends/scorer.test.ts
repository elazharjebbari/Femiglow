import { describe, expect, it } from 'vitest';
import { scoreTrends } from './scorer';
import type { RawTrendSignal } from './collectors';

function makeSignal(overrides: Partial<RawTrendSignal> = {}): RawTrendSignal {
  return {
    source: 'google_trends',
    category: 'routine',
    title: 'Test trend',
    description: 'A test trend signal.',
    detectedAt: new Date(),
    ...overrides,
  };
}

describe('scoreTrends', () => {
  it('returns empty array for empty input', () => {
    expect(scoreTrends([])).toEqual([]);
  });

  it('all scores are between 0 and 1', () => {
    const signals: RawTrendSignal[] = [
      makeSignal({ title: 'Nail care routine', description: 'Japanese nail ritual', rawScore: 0.9 }),
      makeSignal({ title: 'Random news', category: 'news', description: 'Something happened' }),
      makeSignal({ title: 'Celebrity meme', category: 'meme', description: 'Funny meme trend' }),
    ];

    const scored = scoreTrends(signals);

    for (const trend of scored) {
      expect(trend.brandRelevance).toBeGreaterThanOrEqual(0);
      expect(trend.brandRelevance).toBeLessThanOrEqual(1);
      expect(trend.viralPotential).toBeGreaterThanOrEqual(0);
      expect(trend.viralPotential).toBeLessThanOrEqual(1);
      expect(trend.timeSensitivity).toBeGreaterThanOrEqual(0);
      expect(trend.timeSensitivity).toBeLessThanOrEqual(1);
      expect(trend.contentFeasibility).toBeGreaterThanOrEqual(0);
      expect(trend.contentFeasibility).toBeLessThanOrEqual(1);
      expect(trend.compositeScore).toBeGreaterThanOrEqual(0);
      expect(trend.compositeScore).toBeLessThanOrEqual(1);
    }
  });

  it('beauty-related signals score higher on brandRelevance', () => {
    const beautySignal = makeSignal({
      title: 'Japanese nail care ritual with camellia oil',
      description: 'A beauty soin rituel for natural glow eclat.',
      category: 'routine',
    });

    const genericSignal = makeSignal({
      title: 'Weather forecast update',
      description: 'Rain expected next week.',
      category: 'news',
    });

    const beautyScored = scoreTrends([beautySignal]);
    const genericScored = scoreTrends([genericSignal]);

    expect(beautyScored[0]!.brandRelevance).toBeGreaterThan(genericScored[0]!.brandRelevance);
  });

  it('viral keywords increase viralPotential', () => {
    const viralSignal = makeSignal({
      title: 'GRWM routine hack secret',
      description: 'This viral before after transformation trend is satisfying.',
      rawScore: 0.8,
    });

    const plainSignal = makeSignal({
      title: 'Regular update',
      description: 'Nothing special here.',
      rawScore: 0.1,
    });

    const viralScored = scoreTrends([viralSignal]);
    const plainScored = scoreTrends([plainSignal]);

    expect(viralScored[0]!.viralPotential).toBeGreaterThan(plainScored[0]!.viralPotential);
  });

  it('results are sorted by compositeScore descending', () => {
    const signals: RawTrendSignal[] = [
      makeSignal({
        title: 'Low relevance item',
        description: 'Nothing relevant',
        category: 'meme',
        rawScore: 0.1,
      }),
      makeSignal({
        title: 'High relevance nail care beauty ritual japan camellia',
        description: 'A viral hack secret routine with glow transformation',
        category: 'routine',
        rawScore: 0.9,
        source: 'reddit',
      }),
      makeSignal({
        title: 'Medium item about skin beauty',
        description: 'Moderate relevance soin',
        category: 'ingredient',
        rawScore: 0.5,
      }),
    ];

    const scored = scoreTrends(signals);

    for (let i = 0; i < scored.length - 1; i++) {
      expect(scored[i]!.compositeScore).toBeGreaterThanOrEqual(scored[i + 1]!.compositeScore);
    }
  });

  it('preserves original signal metadata', () => {
    const signal = makeSignal({
      title: 'Test title',
      description: 'Test description',
      source: 'reddit',
      category: 'ingredient',
      originalUrl: 'https://reddit.com/r/test',
    });

    const scored = scoreTrends([signal]);
    const first = scored[0]!;

    expect(first.title).toBe('Test title');
    expect(first.description).toBe('Test description');
    expect(first.source).toBe('reddit');
    expect(first.category).toBe('ingredient');
    expect(first.originalUrl).toBe('https://reddit.com/r/test');
    expect(first.status).toBe('new');
  });

  it('assigns riskAssessment based on category', () => {
    const celebrity = makeSignal({ category: 'celebrity', title: 'Star nails', description: 'A celebrity trend' });
    const routine = makeSignal({ category: 'routine', title: 'Daily care', description: 'Regular routine' });

    const celebScored = scoreTrends([celebrity]);
    const routineScored = scoreTrends([routine]);

    expect(celebScored[0]!.riskAssessment).toBe('medium');
    expect(routineScored[0]!.riskAssessment).toBe('low');
  });

  it('detects high risk for controversial content', () => {
    const controversial = makeSignal({
      title: 'Brand controversy scandal',
      description: 'Boycott and lawsuit trending.',
    });

    const scored = scoreTrends([controversial]);
    expect(scored[0]!.riskAssessment).toBe('high');
  });

  it('evergreen source has lower timeSensitivity', () => {
    const evergreen = makeSignal({ source: 'evergreen', title: 'Slow beauty', description: 'Timeless' });
    const reddit = makeSignal({ source: 'reddit', title: 'Hot now', description: 'Just posted' });

    const evScored = scoreTrends([evergreen]);
    const rdScored = scoreTrends([reddit]);

    expect(evScored[0]!.timeSensitivity).toBeLessThan(rdScored[0]!.timeSensitivity);
  });

  it('seasonal source gets moderate timeSensitivity', () => {
    const seasonal = makeSignal({ source: 'seasonal', title: 'Sakura', description: 'Spring season' });
    const scored = scoreTrends([seasonal]);

    expect(scored[0]!.timeSensitivity).toBe(0.6);
  });

  it('provides suggestedFormats and suggestedHooks', () => {
    const signal = makeSignal({ category: 'routine', title: 'Nail routine', description: 'Daily routine' });
    const scored = scoreTrends([signal]);
    const first = scored[0]!;

    expect(first.suggestedFormats.length).toBeGreaterThan(0);
    expect(first.suggestedHooks.length).toBeGreaterThan(0);
    expect(first.suggestedHooks.length).toBeLessThanOrEqual(3);
  });

  it('reddit source increases viralPotential', () => {
    const redditSignal = makeSignal({ source: 'reddit', title: 'Test', description: 'Test' });
    const otherSignal = makeSignal({ source: 'other', title: 'Test', description: 'Test' });

    const redditScored = scoreTrends([redditSignal]);
    const otherScored = scoreTrends([otherSignal]);

    expect(redditScored[0]!.viralPotential).toBeGreaterThan(otherScored[0]!.viralPotential);
  });
});
