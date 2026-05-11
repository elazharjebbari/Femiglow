import { describe, expect, it } from 'vitest';
import { lintContainer } from './linter';
import { buildContainer } from './builders';
import { emptyEnvConfig } from './config-schema';
import type { GtmContainer } from './types';

const FIXED = new Date('2026-05-07T10:00:00.000Z');

function clone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

describe('lintContainer — happy path', () => {
  it('container généré standard ne produit pas d\'erreurs', () => {
    const container = buildContainer({ env: 'production', exportTime: FIXED });
    const report = lintContainer({ container });
    expect(report.errors).toHaveLength(0);
    expect(report.ok).toBe(true);
  });

  it('container dev (0 tags) ne produit pas d\'erreurs', () => {
    const container = buildContainer({ env: 'dev', exportTime: FIXED });
    const report = lintContainer({ container });
    expect(report.errors).toHaveLength(0);
    expect(report.ok).toBe(true);
  });
});

describe('lintContainer — règles errors', () => {
  it('détecte tag_no_trigger', () => {
    const container = clone(buildContainer({ env: 'production', exportTime: FIXED }));
    container.containerVersion.tag[0]!.firingTriggerId = [];
    const report = lintContainer({ container });
    const issue = report.errors.find((i) => i.code === 'tag_no_trigger');
    expect(issue).toBeDefined();
    expect(issue!.refType).toBe('tag');
    expect(report.ok).toBe(false);
  });

  it('détecte duplicate_name sur tags', () => {
    const container = clone(buildContainer({ env: 'production', exportTime: FIXED }));
    const tags = container.containerVersion.tag;
    tags[0]!.name = 'collide';
    tags[1]!.name = 'collide';
    const report = lintContainer({ container });
    const issue = report.errors.find((i) => i.code === 'duplicate_name');
    expect(issue).toBeDefined();
    expect(issue!.refName).toBe('collide');
  });

  it('détecte setup_unknown', () => {
    const container = clone(buildContainer({ env: 'production', exportTime: FIXED }));
    const metaTag = container.containerVersion.tag.find((t) =>
      t.name.startsWith('Meta Evt'),
    );
    expect(metaTag).toBeDefined();
    metaTag!.setupTag = [{ tagName: 'tag-inexistant', stopOnSetupFailure: false }];
    const report = lintContainer({ container });
    const issue = report.errors.find((i) => i.code === 'setup_unknown');
    expect(issue).toBeDefined();
  });

  it('détecte duplicate_name sur triggers', () => {
    const container: GtmContainer = clone(buildContainer({ env: 'production', exportTime: FIXED }));
    container.containerVersion.trigger[0]!.name = 'collide';
    container.containerVersion.trigger[1]!.name = 'collide';
    const report = lintContainer({ container });
    expect(report.errors.some((i) => i.code === 'duplicate_name' && i.refType === 'trigger')).toBe(
      true,
    );
  });

  it('détecte duplicate_name sur variables', () => {
    const container = clone(buildContainer({ env: 'production', exportTime: FIXED }));
    container.containerVersion.variable[0]!.name = 'collide';
    container.containerVersion.variable[1]!.name = 'collide';
    const report = lintContainer({ container });
    expect(
      report.errors.some((i) => i.code === 'duplicate_name' && i.refType === 'variable'),
    ).toBe(true);
  });
});

describe('lintContainer — règles warnings', () => {
  it('détecte orphan_trigger', () => {
    const container = clone(buildContainer({ env: 'production', exportTime: FIXED }));
    container.containerVersion.trigger.push({
      triggerId: '99999',
      type: 'CUSTOM_EVENT',
      name: 'CE — orphan_trigger',
    });
    const report = lintContainer({ container });
    expect(report.warnings.some((i) => i.code === 'orphan_trigger')).toBe(true);
  });

  it('pixel_id_blank si GA4 activé mais ID vide', () => {
    const container = buildContainer({ env: 'production', exportTime: FIXED });
    const report = lintContainer({
      container,
      envConfig: {
        ...emptyEnvConfig(),
        ga4MeasurementId: '',
        enabledProviders: ['google_ga4'],
      },
    });
    expect(report.warnings.some((i) => i.code === 'pixel_id_blank')).toBe(true);
  });

  it('pixel_id_blank si Meta activé mais ID vide', () => {
    const container = buildContainer({ env: 'production', exportTime: FIXED });
    const report = lintContainer({
      container,
      envConfig: {
        ...emptyEnvConfig(),
        metaPixelId: '',
        enabledProviders: ['meta'],
      },
    });
    expect(
      report.warnings.some((i) => i.code === 'pixel_id_blank' && i.refName === 'metaPixelId'),
    ).toBe(true);
  });

  it('convlabel_format si format incorrect', () => {
    const container = buildContainer({ env: 'production', exportTime: FIXED });
    const report = lintContainer({
      container,
      envConfig: {
        ...emptyEnvConfig(),
        googleAdsConvLabels: { purchase: 'INVALID-FORMAT' },
      },
    });
    expect(report.warnings.some((i) => i.code === 'convlabel_format')).toBe(true);
  });

  it('ne flag pas convlabel_format si format correct', () => {
    const container = buildContainer({ env: 'production', exportTime: FIXED });
    const report = lintContainer({
      container,
      envConfig: {
        ...emptyEnvConfig(),
        googleAdsConvLabels: { purchase: 'AW-123456789/abcXYZ' },
      },
    });
    expect(report.warnings.some((i) => i.code === 'convlabel_format')).toBe(false);
  });
});

describe('lintContainer — règles infos', () => {
  it('détecte var_orphan si variable jamais référencée', () => {
    const container = clone(buildContainer({ env: 'production', exportTime: FIXED }));
    container.containerVersion.variable.push({
      variableId: '99999',
      type: 'c',
      name: 'CONST - Variable Orphelin',
      parameter: [{ type: 'TEMPLATE', key: 'value', value: 'never-referenced' }],
    });
    const report = lintContainer({ container });
    expect(report.infos.some((i) => i.code === 'var_orphan')).toBe(true);
  });
});

describe('lintContainer — résumé', () => {
  it('ok=true quand 0 erreurs (warnings et infos OK)', () => {
    const container = buildContainer({ env: 'production', exportTime: FIXED });
    const report = lintContainer({ container });
    expect(report.ok).toBe(true);
  });

  it('ok=false dès qu\'il y a 1 erreur', () => {
    const container = clone(buildContainer({ env: 'production', exportTime: FIXED }));
    container.containerVersion.tag[0]!.name = container.containerVersion.tag[1]!.name;
    const report = lintContainer({ container });
    expect(report.ok).toBe(false);
  });

  it('cumul correct des 3 catégories', () => {
    const container = clone(buildContainer({ env: 'production', exportTime: FIXED }));
    container.containerVersion.tag[0]!.firingTriggerId = []; // error
    container.containerVersion.trigger.push({
      triggerId: '99999',
      type: 'CUSTOM_EVENT',
      name: 'CE — orphan',
    }); // warning
    const report = lintContainer({
      container,
      envConfig: { ...emptyEnvConfig(), ga4MeasurementId: '', enabledProviders: ['google_ga4'] },
    });
    expect(report.errors.length).toBeGreaterThanOrEqual(1);
    expect(report.warnings.length).toBeGreaterThanOrEqual(2);
  });
});

describe('lintContainer — robustesse', () => {
  it('container vide ne crash pas', () => {
    const empty: GtmContainer = {
      exportFormatVersion: 2,
      exportTime: FIXED.toISOString(),
      containerVersion: {
        path: 'accounts/0/containers/0',
        accountId: '0',
        containerId: '0',
        container: { accountId: '0', containerId: '0', name: 'empty', usageContext: ['WEB'] },
        tag: [],
        trigger: [],
        variable: [],
        folder: [],
        builtInVariable: [],
      },
    };
    const report = lintContainer({ container: empty });
    expect(report.ok).toBe(true);
    expect(report.errors).toHaveLength(0);
  });
});
