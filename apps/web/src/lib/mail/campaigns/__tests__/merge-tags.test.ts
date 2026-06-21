// @vitest-environment node
/**
 * F05 P3.2-c3 — merge-tags campagne (catalogue honnête + insertion curseur).
 */
import { describe, expect, it } from 'vitest';
import {
  ALWAYS_MERGE_TAGS,
  CAMPAIGN_MERGE_TAGS,
  CONDITIONAL_MERGE_TAGS,
  insertToken,
} from '../merge-tags';

describe('F05 — merge-tags', () => {
  it('F05-U-046 — catalogue : tous des jetons Go Listmonk valides {{ … }}', () => {
    expect(CAMPAIGN_MERGE_TAGS.length).toBeGreaterThan(0);
    for (const t of CAMPAIGN_MERGE_TAGS) {
      expect(t.token).toMatch(/^\{\{ .+ \}\}$/);
      expect(t.label.length).toBeGreaterThan(0);
      expect(t.description.length).toBeGreaterThan(0);
      expect(['always', 'conditional']).toContain(t.reliability);
    }
  });

  it('F05-U-047 — Email/UnsubscribeURL sont "always" ; Name est "conditional" (honnêteté)', () => {
    const byToken = (tok: string) => CAMPAIGN_MERGE_TAGS.find((t) => t.token.includes(tok));
    expect(byToken('.Subscriber.Email')!.reliability).toBe('always');
    expect(byToken('UnsubscribeURL')!.reliability).toBe('always');
    const name = byToken('.Subscriber.Name')!;
    expect(name.reliability).toBe('conditional');
    expect(name.description).toMatch(/vide|audiences/i); // dit la vérité
    // Pas de variable du moteur custom (syntaxe {{ firstName }} sans point).
    expect(CAMPAIGN_MERGE_TAGS.some((t) => /\{\{ [a-z]/.test(t.token))).toBe(false);
  });

  it('F05-U-048 — partition always/conditional couvre tout le catalogue', () => {
    expect(ALWAYS_MERGE_TAGS.length + CONDITIONAL_MERGE_TAGS.length).toBe(CAMPAIGN_MERGE_TAGS.length);
    expect(ALWAYS_MERGE_TAGS.every((t) => t.reliability === 'always')).toBe(true);
    expect(CONDITIONAL_MERGE_TAGS.every((t) => t.reliability === 'conditional')).toBe(true);
  });

  it('F05-U-049 — insertToken : insère au curseur, remplace la sélection, clampe les bornes', () => {
    // insertion au milieu
    expect(insertToken('Bonjour  !', 8, 8, 'X')).toEqual({ value: 'Bonjour X !', cursor: 9 });
    // remplace une sélection
    expect(insertToken('AABBCC', 2, 4, '__')).toEqual({ value: 'AA__CC', cursor: 4 });
    // début / fin
    expect(insertToken('abc', 0, 0, '{{x}}')).toEqual({ value: '{{x}}abc', cursor: 5 });
    expect(insertToken('abc', 3, 3, 'Z')).toEqual({ value: 'abcZ', cursor: 4 });
    // bornes hors limites / NaN → clampées en fin
    expect(insertToken('abc', 99, 99, 'Q')).toEqual({ value: 'abcQ', cursor: 4 });
    expect(insertToken('abc', Number.NaN, Number.NaN, 'Q')).toEqual({ value: 'abcQ', cursor: 4 });
    // start > end toléré (end relevé à start)
    expect(insertToken('abcdef', 4, 1, '*')).toEqual({ value: 'abcd*ef', cursor: 5 });
  });
});
