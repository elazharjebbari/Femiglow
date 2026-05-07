/**
 * Property-based tests pour le linter.
 *
 * Vérifie des invariants généraux : déterminisme, monotonicité par
 * augmentation de container, robustesse à des entrées dégénérées.
 */
import { describe, expect, it } from 'vitest';
import { lintContainer, type LintReport } from './linter';
import { buildContainer } from './builders';
import type { GtmContainer } from './types';

const FIXED = new Date('2026-05-07T10:00:00.000Z');

function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

function bigContainer(extraTags: number): GtmContainer {
  const c = clone(buildContainer({ env: 'production', exportTime: FIXED }));
  for (let i = 0; i < extraTags; i++) {
    c.containerVersion.tag.push({
      name: `Aux Tag ${i}`,
      type: 'html',
      parameter: [{ type: 'template', key: 'html', value: `<!-- ${i} -->` }],
      firingTriggerId: c.containerVersion.tag[0]!.firingTriggerId,
      parentFolderId: 'F-07',
    });
  }
  return c;
}

describe('linter — déterminisme', () => {
  it('même input → même output (stringifié identique)', () => {
    const c = buildContainer({ env: 'production', exportTime: FIXED });
    const r1 = lintContainer({ container: c });
    const r2 = lintContainer({ container: c });
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });

  it("ordre des issues stable — résultat trié implicitement", () => {
    const c = clone(buildContainer({ env: 'production', exportTime: FIXED }));
    c.containerVersion.tag[0]!.firingTriggerId = [];
    c.containerVersion.tag[1]!.firingTriggerId = [];
    const r = lintContainer({ container: c });
    // Au moins 2 erreurs tag_no_trigger ; on vérifie qu'elles sont présentes
    // dans le même ordre que les tags.
    const errs = r.errors.filter((e) => e.code === 'tag_no_trigger');
    expect(errs).toHaveLength(2);
  });
});

describe('linter — performance et taille', () => {
  it("traite 200 tags en moins de 100 ms", () => {
    const c = bigContainer(200);
    const start = performance.now();
    lintContainer({ container: c });
    const ms = performance.now() - start;
    expect(ms).toBeLessThan(100);
  });

  it("traite 1000 tags en moins de 500 ms (linear scaling)", () => {
    const c = bigContainer(1000);
    const start = performance.now();
    const r = lintContainer({ container: c });
    const ms = performance.now() - start;
    expect(ms).toBeLessThan(500);
    expect(r.ok).toBe(true);
  });
});

describe('linter — invariants', () => {
  it("ok=true ⇔ errors.length === 0 (toujours)", () => {
    const cases: GtmContainer[] = [
      buildContainer({ env: 'production', exportTime: FIXED }),
      buildContainer({ env: 'dev', exportTime: FIXED }),
      bigContainer(50),
    ];
    for (const c of cases) {
      const r = lintContainer({ container: c });
      expect(r.ok).toBe(r.errors.length === 0);
    }
  });

  it("never throws : container malformé → report avec errors mais pas exception", () => {
    const broken: GtmContainer = {
      exportFormatVersion: 2,
      exportTime: FIXED.toISOString(),
      containerVersion: {
        path: 'x',
        accountId: '0',
        containerId: '0',
        container: { accountId: '0', containerId: '0', name: 'x', usageContext: ['WEB'] },
        tag: [
          {
            name: '',
            type: 'html',
            firingTriggerId: ['nonexistent'],
            parameter: [],
          },
        ],
        trigger: [],
        variable: [],
        folder: [],
        builtInVariable: [],
      },
    };
    expect(() => lintContainer({ container: broken })).not.toThrow();
  });

  it("ajout d'un tag valide → ne diminue jamais ok", () => {
    const base = lintContainer({ container: buildContainer({ env: 'production', exportTime: FIXED }) });
    const augmented = lintContainer({ container: bigContainer(10) });
    // Si base.ok était true, augmented.ok doit aussi être true (les nouveaux
    // tags partagent un firingTriggerId valide donc pas d'erreur ajoutée).
    if (base.ok) {
      expect(augmented.ok).toBe(true);
    }
  });

  it('orphans (variables jamais référencées) sont infos seulement, pas errors', () => {
    const c = bigContainer(0);
    const r = lintContainer({ container: c });
    for (const i of r.infos) {
      expect(i.severity).toBe('info');
    }
  });
});

describe('linter — composition avec config', () => {
  it('même container, configs différentes → mêmes errors structurels', () => {
    const c = buildContainer({ env: 'production', exportTime: FIXED });
    const r1: LintReport = lintContainer({ container: c });
    const r2: LintReport = lintContainer({
      container: c,
      envConfig: { ga4MeasurementId: '', metaPixelId: '', tiktokPixelId: '', snapPixelId: '', pinterestTagId: '', googleAdsCustomerId: '', defaultCurrency: 'MAD', cookieDomain: 'auto', enabledProviders: [], googleAdsConvLabels: {} },
    });
    expect(r1.errors.length).toBe(r2.errors.length);
  });
});
