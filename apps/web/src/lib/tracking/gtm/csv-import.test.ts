import { describe, expect, it } from 'vitest';
import { parseCsvImport } from './csv-import';

describe('parseCsvImport — cas simples', () => {
  it('parse un CSV minimal (sans header)', () => {
    const r = parseCsvImport(
      'production,ga4MeasurementId,G-PROD0000\nstage,ga4MeasurementId,G-STAGE000',
    );
    expect(r.appliedCount).toBe(2);
    expect(r.perEnv.production.ga4MeasurementId).toBe('G-PROD0000');
    expect(r.perEnv.stage.ga4MeasurementId).toBe('G-STAGE000');
  });

  it('saute le header optionnel', () => {
    const r = parseCsvImport(
      'env,variable,value\nproduction,ga4MeasurementId,G-PROD0000',
    );
    expect(r.appliedCount).toBe(1);
    expect(r.perEnv.production.ga4MeasurementId).toBe('G-PROD0000');
  });

  it('ignore les lignes vides', () => {
    const r = parseCsvImport(
      '\nproduction,ga4MeasurementId,G-PROD0000\n\n\nstage,ga4MeasurementId,G-STAGE000\n',
    );
    expect(r.appliedCount).toBe(2);
  });
});

describe('parseCsvImport — quotes et virgules', () => {
  it('respecte les valeurs entre guillemets', () => {
    const r = parseCsvImport('production,googleAdsConvLabels.purchase,"AW-123/abc,xyz"');
    expect(r.perEnv.production.googleAdsConvLabels?.purchase).toBe('AW-123/abc,xyz');
  });

  it('échappe les guillemets doublés', () => {
    const r = parseCsvImport('production,defaultCurrency,"He said ""yes"""');
    expect(r.perEnv.production.defaultCurrency).toBe('He said "yes"');
  });
});

describe('parseCsvImport — variables et envs inconnus', () => {
  it('ignore les variables inconnues avec warning', () => {
    const r = parseCsvImport('production,unknownVariable,whatever');
    expect(r.appliedCount).toBe(0);
    expect(r.skippedCount).toBe(1);
    expect(r.warnings.some((w) => w.includes('unknownVariable'))).toBe(true);
  });

  it('ignore les envs inconnus avec warning', () => {
    const r = parseCsvImport('canary,ga4MeasurementId,G-XXX');
    expect(r.appliedCount).toBe(0);
    expect(r.skippedCount).toBe(1);
    expect(r.warnings.some((w) => w.includes('canary'))).toBe(true);
  });

  it('ignore les lignes avec moins de 3 colonnes', () => {
    const r = parseCsvImport('production,ga4MeasurementId');
    expect(r.appliedCount).toBe(0);
    expect(r.skippedCount).toBe(1);
  });
});

describe('parseCsvImport — Conv labels pointés', () => {
  it('parse googleAdsConvLabels.purchase / lead / signup / initCheckout', () => {
    const csv = [
      'production,googleAdsConvLabels.purchase,AW-1/p',
      'production,googleAdsConvLabels.lead,AW-1/l',
      'production,googleAdsConvLabels.signup,AW-1/s',
      'production,googleAdsConvLabels.initCheckout,AW-1/i',
    ].join('\n');
    const r = parseCsvImport(csv);
    expect(r.perEnv.production.googleAdsConvLabels).toEqual({
      purchase: 'AW-1/p',
      lead: 'AW-1/l',
      signup: 'AW-1/s',
      initCheckout: 'AW-1/i',
    });
  });
});

describe('parseCsvImport — fusion (merge) avec base', () => {
  it("ne ré-écrit pas les valeurs existantes non-touchées", () => {
    const base = {
      production: {
        ga4MeasurementId: 'G-EXISTING',
        metaPixelId: '99999',
        tiktokPixelId: '',
        snapPixelId: '',
        pinterestTagId: '',
        googleAdsCustomerId: '',
        googleAdsConvLabels: {},
        defaultCurrency: 'MAD',
        cookieDomain: 'auto',
        enabledProviders: ['google_ga4' as const],
      },
      stage: {
        ga4MeasurementId: '',
        metaPixelId: '',
        tiktokPixelId: '',
        snapPixelId: '',
        pinterestTagId: '',
        googleAdsCustomerId: '',
        googleAdsConvLabels: {},
        defaultCurrency: 'MAD',
        cookieDomain: 'auto',
        enabledProviders: [],
      },
      preview: {
        ga4MeasurementId: '',
        metaPixelId: '',
        tiktokPixelId: '',
        snapPixelId: '',
        pinterestTagId: '',
        googleAdsCustomerId: '',
        googleAdsConvLabels: {},
        defaultCurrency: 'MAD',
        cookieDomain: 'auto',
        enabledProviders: [],
      },
      dev: {
        ga4MeasurementId: '',
        metaPixelId: '',
        tiktokPixelId: '',
        snapPixelId: '',
        pinterestTagId: '',
        googleAdsCustomerId: '',
        googleAdsConvLabels: {},
        defaultCurrency: 'MAD',
        cookieDomain: 'auto',
        enabledProviders: [],
      },
    };
    const r = parseCsvImport('production,metaPixelId,11111111111', base);
    // ga4MeasurementId reste intact
    expect(r.perEnv.production.ga4MeasurementId).toBe('G-EXISTING');
    // metaPixelId remplacé
    expect(r.perEnv.production.metaPixelId).toBe('11111111111');
  });
});

describe('parseCsvImport — limite de taille', () => {
  it('limite à 1000 lignes avec warning', () => {
    const lines = Array.from({ length: 1500 }, (_, i) =>
      `production,defaultCurrency,V${i}`,
    );
    const r = parseCsvImport(lines.join('\n'));
    expect(r.warnings.some((w) => w.includes('1000'))).toBe(true);
    // Au plus 1000 lignes traitées
    expect(r.appliedCount + r.skippedCount).toBeLessThanOrEqual(1000);
  });
});

describe('parseCsvImport — résumé warnings', () => {
  it('signale chaque ligne ignorée individuellement', () => {
    const r = parseCsvImport(
      'production,ga4MeasurementId,G-OK\nbadenv,ga4MeasurementId,G-X\nproduction,unknownVar,X',
    );
    expect(r.warnings).toHaveLength(2);
    expect(r.skippedCount).toBe(2);
    expect(r.appliedCount).toBe(1);
  });
});
