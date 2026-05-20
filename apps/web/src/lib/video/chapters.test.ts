import { describe, expect, it } from 'vitest';
import {
  findActiveChapterIndex,
  formatChapterIndex,
  formatChapterTimestamp,
} from './chapters';
import type { VideoChapter } from '@/lib/schemas';

const sampleChapters: ReadonlyArray<VideoChapter> = [
  { key: 'paste', label: 'Paste', startSeconds: 0 },
  { key: 'powder', label: 'Powder', startSeconds: 18 },
  { key: 'step-4', label: 'Step 4', startSeconds: 42 },
  { key: 'polissage', label: 'Polissage', startSeconds: 68 },
];

describe('formatChapterTimestamp', () => {
  it('formate 0 seconde en 0:00', () => {
    expect(formatChapterTimestamp(0)).toBe('0:00');
  });

  it('formate 18 secondes en 0:18', () => {
    expect(formatChapterTimestamp(18)).toBe('0:18');
  });

  it('formate 65 secondes en 1:05 (pas de pad sur les minutes)', () => {
    expect(formatChapterTimestamp(65)).toBe('1:05');
  });

  it('formate 754 secondes en 12:34', () => {
    expect(formatChapterTimestamp(754)).toBe('12:34');
  });

  it('tronque les décimales (currentTime peut être un float)', () => {
    expect(formatChapterTimestamp(18.94)).toBe('0:18');
  });

  it('clamp les valeurs négatives à 0:00', () => {
    expect(formatChapterTimestamp(-5)).toBe('0:00');
  });

  it('renvoie 0:00 pour NaN/Infinity', () => {
    expect(formatChapterTimestamp(Number.NaN)).toBe('0:00');
    expect(formatChapterTimestamp(Number.POSITIVE_INFINITY)).toBe('0:00');
  });
});

describe('findActiveChapterIndex', () => {
  it('renvoie 0 quand currentSeconds=0 (premier chapitre)', () => {
    expect(findActiveChapterIndex(sampleChapters, 0)).toBe(0);
  });

  it('renvoie 0 quand currentSeconds est entre 0 et le 2e startSeconds', () => {
    expect(findActiveChapterIndex(sampleChapters, 5)).toBe(0);
    expect(findActiveChapterIndex(sampleChapters, 17)).toBe(0);
  });

  it('renvoie 1 dès qu\'on atteint le startSeconds du chapitre 2', () => {
    expect(findActiveChapterIndex(sampleChapters, 18)).toBe(1);
    expect(findActiveChapterIndex(sampleChapters, 30)).toBe(1);
  });

  it('renvoie le dernier index quand currentSeconds dépasse la durée', () => {
    expect(findActiveChapterIndex(sampleChapters, 90)).toBe(3);
    expect(findActiveChapterIndex(sampleChapters, 999)).toBe(3);
  });

  it('renvoie -1 pour un tableau vide', () => {
    expect(findActiveChapterIndex([], 12)).toBe(-1);
  });

  it('clamp les currentSeconds négatifs à 0', () => {
    expect(findActiveChapterIndex(sampleChapters, -10)).toBe(0);
  });
});

describe('formatChapterIndex', () => {
  it('pad sur 2 digits (1-based)', () => {
    expect(formatChapterIndex(0)).toBe('01');
    expect(formatChapterIndex(1)).toBe('02');
    expect(formatChapterIndex(9)).toBe('10');
  });

  it('ne pad pas au-delà de 99', () => {
    expect(formatChapterIndex(99)).toBe('100');
  });
});
