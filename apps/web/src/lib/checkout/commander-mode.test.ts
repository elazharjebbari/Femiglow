/**
 * Kit CRO v2 §2 — résolution du mode « Commander » (scroll | sheet).
 */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_SHEET_SHARE_PCT,
  KIT_CTA_SHEET_EXPERIMENT_KEY,
  commanderModeNeedsVisitor,
  isCommanderCmsMode,
  normalizeSharePct,
  parseCommanderOverride,
  resolveCommanderAssignment,
  resolveCommanderMode,
} from './commander-mode';

/** Identifiants au format `fg_aid` (`aid_` + 24 hex), générés de façon déterministe. */
function visitorIds(count: number, seed = 42): string[] {
  let state = seed >>> 0;
  const next = () => {
    // xorshift32 : pseudo-aléatoire reproductible.
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state;
  };
  return Array.from({ length: count }, () => {
    let hex = '';
    while (hex.length < 24) hex += next().toString(16).padStart(8, '0');
    return `aid_${hex.slice(0, 24)}`;
  });
}

describe('parseCommanderOverride', () => {
  it.each([
    ['sheet', 'sheet'],
    ['scroll', 'scroll'],
    [' SHEET ', 'sheet'],
    ['Scroll', 'scroll'],
  ])('%j → %s', (raw, expected) => {
    expect(parseCommanderOverride(raw)).toBe(expected);
  });

  it.each([null, undefined, '', 'ab', 'modal', 1, {}, ['sheet']])(
    'valeur invalide %j → null',
    (raw) => {
      expect(parseCommanderOverride(raw)).toBeNull();
    },
  );
});

describe('normalizeSharePct', () => {
  it('borne entre 0 et 100', () => {
    expect(normalizeSharePct(-5)).toBe(0);
    expect(normalizeSharePct(150)).toBe(100);
    expect(normalizeSharePct(33)).toBe(33);
    expect(normalizeSharePct('25')).toBe(25);
  });

  it.each([NaN, Infinity, 'abc', '', null, undefined, {}])(
    'valeur non numérique %j → défaut',
    (raw) => {
      expect(normalizeSharePct(raw)).toBe(DEFAULT_SHEET_SHARE_PCT);
    },
  );
});

describe('isCommanderCmsMode', () => {
  it('reconnaît scroll | sheet | ab uniquement', () => {
    expect(isCommanderCmsMode('scroll')).toBe(true);
    expect(isCommanderCmsMode('sheet')).toBe(true);
    expect(isCommanderCmsMode('ab')).toBe(true);
    expect(isCommanderCmsMode('AB')).toBe(false);
    expect(isCommanderCmsMode(undefined)).toBe(false);
  });
});

describe('resolveCommanderMode', () => {
  it('modes fixes : scroll et sheet', () => {
    expect(resolveCommanderMode({ cmsMode: 'scroll', visitorId: 'aid_x' })).toBe('scroll');
    expect(resolveCommanderMode({ cmsMode: 'sheet', visitorId: 'aid_x' })).toBe('sheet');
  });

  it('réglage inconnu ou absent → scroll (comportement historique)', () => {
    expect(resolveCommanderMode({ cmsMode: 'modal' })).toBe('scroll');
    expect(resolveCommanderMode({ cmsMode: undefined })).toBe('scroll');
    expect(resolveCommanderMode({ cmsMode: null })).toBe('scroll');
  });

  it('?cta= gagne sur le réglage et sur l’A/B', () => {
    expect(resolveCommanderMode({ cmsMode: 'scroll', override: 'sheet' })).toBe('sheet');
    expect(resolveCommanderMode({ cmsMode: 'sheet', override: 'scroll' })).toBe('scroll');
    expect(
      resolveCommanderMode({ cmsMode: 'ab', sharePct: 0, override: 'sheet', visitorId: 'aid_x' }),
    ).toBe('sheet');
    expect(
      resolveCommanderMode({
        cmsMode: 'ab',
        sharePct: 100,
        override: 'scroll',
        visitorId: 'aid_x',
      }),
    ).toBe('scroll');
  });

  it('?cta= invalide est ignoré', () => {
    expect(resolveCommanderMode({ cmsMode: 'sheet', override: 'nope' })).toBe('sheet');
  });

  it('A/B à 0 % → toujours scroll, à 100 % → toujours sheet', () => {
    for (const id of visitorIds(200)) {
      expect(resolveCommanderMode({ cmsMode: 'ab', sharePct: 0, visitorId: id })).toBe('scroll');
      expect(resolveCommanderMode({ cmsMode: 'ab', sharePct: 100, visitorId: id })).toBe('sheet');
    }
  });

  it('A/B sans identifiant visiteur → témoin scroll (jamais de tirage instable)', () => {
    expect(resolveCommanderMode({ cmsMode: 'ab', sharePct: 99, visitorId: null })).toBe('scroll');
    expect(resolveCommanderMode({ cmsMode: 'ab', sharePct: 99, visitorId: '' })).toBe('scroll');
  });

  it('A/B : attribution stable pour un même visiteur', () => {
    for (const id of visitorIds(500, 7)) {
      const first = resolveCommanderMode({ cmsMode: 'ab', sharePct: 50, visitorId: id });
      for (let i = 0; i < 3; i += 1) {
        expect(resolveCommanderMode({ cmsMode: 'ab', sharePct: 50, visitorId: id })).toBe(first);
      }
    }
  });

  it('A/B : monotone — un visiteur en sheet à 30 % reste en sheet à 60 %', () => {
    for (const id of visitorIds(2000, 11)) {
      if (resolveCommanderMode({ cmsMode: 'ab', sharePct: 30, visitorId: id }) === 'sheet') {
        expect(resolveCommanderMode({ cmsMode: 'ab', sharePct: 60, visitorId: id })).toBe('sheet');
      }
    }
  });

  it.each([10, 25, 50, 75, 90])(
    'A/B à %i %% : répartition proche de la consigne sur 10 000 visiteurs',
    (pct) => {
      const ids = visitorIds(10_000, pct);
      const sheet = ids.filter(
        (id) => resolveCommanderMode({ cmsMode: 'ab', sharePct: pct, visitorId: id }) === 'sheet',
      ).length;
      // ±2 points : ~4 écarts-types à 50 % sur 10 000 tirages.
      expect(Math.abs(sheet / ids.length - pct / 100)).toBeLessThan(0.02);
    },
  );

  it('A/B : part invalide → 50 % par défaut', () => {
    const ids = visitorIds(10_000, 3);
    const sheet = ids.filter(
      (id) => resolveCommanderMode({ cmsMode: 'ab', sharePct: 'n/a', visitorId: id }) === 'sheet',
    ).length;
    expect(Math.abs(sheet / ids.length - 0.5)).toBeLessThan(0.02);
  });

  it('clé d’expérience figée (changer la clé re-mélangerait les visiteurs)', () => {
    expect(KIT_CTA_SHEET_EXPERIMENT_KEY).toBe('kit_cta_sheet_v1');
  });
});

describe('resolveCommanderAssignment — origine de la variante (exposition A/B)', () => {
  it('override, réglage fixe, A/B', () => {
    expect(resolveCommanderAssignment({ cmsMode: 'scroll', override: 'sheet' })).toEqual({
      mode: 'sheet',
      source: 'override',
    });
    expect(resolveCommanderAssignment({ cmsMode: 'sheet' })).toEqual({
      mode: 'sheet',
      source: 'cms',
    });
    expect(resolveCommanderAssignment({ cmsMode: 'bogus' })).toEqual({
      mode: 'scroll',
      source: 'cms',
    });
    expect(resolveCommanderAssignment({ cmsMode: 'ab', sharePct: 100, visitorId: null })).toEqual({
      mode: 'sheet',
      source: 'ab',
    });
    expect(resolveCommanderAssignment({ cmsMode: 'ab', sharePct: 50, visitorId: null })).toEqual({
      mode: 'scroll',
      source: 'ab',
    });
  });

  it('même variante que resolveCommanderMode', () => {
    for (const id of visitorIds(200, 11)) {
      const input = { cmsMode: 'ab', sharePct: 37, visitorId: id };
      expect(resolveCommanderAssignment(input).mode).toBe(resolveCommanderMode(input));
    }
  });

  it('commanderModeNeedsVisitor : uniquement en ab sans override', () => {
    expect(commanderModeNeedsVisitor('ab', null)).toBe(true);
    expect(commanderModeNeedsVisitor('ab', 'sheet')).toBe(false);
    expect(commanderModeNeedsVisitor('ab', 'nope')).toBe(true);
    expect(commanderModeNeedsVisitor('sheet', null)).toBe(false);
  });
});
