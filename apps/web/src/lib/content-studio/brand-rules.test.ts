import { describe, expect, it } from 'vitest';
import { reviewDraftContent, BRAND_RULES_VERSION } from './brand-rules';

describe('content studio brand rules', () => {
  it('bloque les termes de promesse excessive', () => {
    const review = reviewDraftContent({
      id: 'cd_1',
      caption: 'Un résultat miracle pour des ongles parfaits.',
      hashtags: [],
    });
    expect(review.status).toBe('blocked');
    expect(review.violations.map((v) => v.rule)).toContain('blocked_term');
  });

  it('bloque les emojis et points d’exclamation', () => {
    const review = reviewDraftContent({
      id: 'cd_1',
      caption: 'Découvrir le rituel ! ✨',
      hashtags: [],
    });
    expect(review.status).toBe('blocked');
    expect(review.violations.map((v) => v.rule)).toEqual(
      expect.arrayContaining(['emoji', 'punctuation_exclamation']),
    );
  });

  it('accepte une caption sobre', () => {
    const review = reviewDraftContent({
      id: 'cd_1',
      caption:
        'Un geste lent peut changer la manière dont une main se regarde. Le rituel révèle l’éclat naturel, sans vernis ni abrasion.',
      hashtags: ['femiglow', 'rituel'],
    });
    expect(review.status).toBe('pass');
    expect(review.scoreTotal).toBeGreaterThanOrEqual(90);
  });

  it('émet un warning pour les termes commerciaux', () => {
    const review = reviewDraftContent({
      id: 'cd_4',
      caption: 'Découvrez notre rituel, deal exclusif cette semaine.',
      hashtags: ['femiglow'],
    });
    expect(review.status).toBe('warning');
    expect(review.violations.some((v) => v.rule === 'avoid_term' && v.message.includes('deal'))).toBe(true);
  });

  it('émet un warning quand trop de hashtags', () => {
    const hashtags = Array.from({ length: 15 }, (_, i) => `tag${i}`);
    const review = reviewDraftContent({
      id: 'cd_5',
      caption: 'Un rituel simple pour des ongles soignés.',
      hashtags,
    });
    expect(review.violations.some((v) => v.rule === 'too_many_hashtags')).toBe(true);
    expect(review.status).toBe('warning');
  });

  it('détecte plusieurs termes bloqués simultanément', () => {
    const review = reviewDraftContent({
      id: 'cd_6',
      caption: 'Une offre flash miracle pour un résultat garanti.',
      hashtags: [],
    });
    const blocked = review.violations.filter((v) => v.severity === 'blocked');
    expect(blocked.length).toBeGreaterThanOrEqual(3);
    expect(review.status).toBe('blocked');
  });

  it('calcule un score lexical correct pour une caption pass', () => {
    const review = reviewDraftContent({
      id: 'cd_7',
      caption: 'Prendre soin de ses ongles, un geste à la fois.',
      hashtags: ['femiglow', 'soin'],
    });
    expect(review.score.lexical).toBe(96);
    expect(review.score.tone).toBe(94);
    expect(review.rulesVersion).toBe(BRAND_RULES_VERSION);
  });

  it('donne un score claims bas quand un terme bloqué est détecté', () => {
    const review = reviewDraftContent({
      id: 'cd_8',
      caption: 'Un résultat garanti pour vos ongles.',
      hashtags: [],
    });
    expect(review.score.claims).toBe(35);
  });
});