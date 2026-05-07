/**
 * Tests d'intégration : le linter dans le flow complet `gtmExporter.build()`.
 *
 * On ne mocke rien : on appelle le builder vrai, on inspecte le lintReport
 * exposé par l'export.
 */
import { describe, expect, it } from 'vitest';
import { gtmExporter } from './exporter';
import { emptyEnvConfig } from './config-schema';

const FIXED = new Date('2026-05-07T10:00:00.000Z');

describe('gtmExporter — lintReport exposé', () => {
  it('production avec config standard → lintReport.ok=true', () => {
    const exp = gtmExporter.build({ env: 'production', exportTime: FIXED });
    expect(exp.lintReport).toBeDefined();
    expect(exp.lintReport.ok).toBe(true);
    expect(exp.lintReport.errors).toEqual([]);
  });

  it('dev (0 tags) → lintReport.ok=true', () => {
    const exp = gtmExporter.build({ env: 'dev', exportTime: FIXED });
    expect(exp.lintReport.ok).toBe(true);
  });

  it("config avec GA4 activé sans Measurement ID → warning pixel_id_blank", () => {
    const exp = gtmExporter.build({
      env: 'production',
      exportTime: FIXED,
      config: {
        ...emptyEnvConfig(),
        ga4MeasurementId: '',
        enabledProviders: ['google_ga4'],
      },
    });
    const blank = exp.lintReport.warnings.find((w) => w.code === 'pixel_id_blank');
    expect(blank).toBeDefined();
  });

  it("config avec Conv label malformé → warning convlabel_format", () => {
    const exp = gtmExporter.build({
      env: 'production',
      exportTime: FIXED,
      // Cast en `any` car BuildOptions.config est plus large que GtmEnvConfigDTO ;
      // le linter consomme bien googleAdsConvLabels.
      config: {
        ...emptyEnvConfig(),
        googleAdsConvLabels: { purchase: 'INVALIDE' },
      } as Record<string, unknown>,
    });
    const malformed = exp.lintReport.warnings.find((w) => w.code === 'convlabel_format');
    expect(malformed).toBeDefined();
    expect(malformed!.refName).toBe('googleAdsConvLabels.purchase');
  });

  it("Conv label correct → pas de warning convlabel_format", () => {
    const exp = gtmExporter.build({
      env: 'production',
      exportTime: FIXED,
      config: {
        ...emptyEnvConfig(),
        googleAdsConvLabels: { purchase: 'AW-123/abcDEF' },
      } as Record<string, unknown>,
    });
    expect(
      exp.lintReport.warnings.find((w) => w.code === 'convlabel_format'),
    ).toBeUndefined();
  });

  it('le lintReport est cohérent avec stats (tags counts)', () => {
    const exp = gtmExporter.build({ env: 'production', exportTime: FIXED });
    expect(exp.stats.tags).toBeGreaterThan(0);
    expect(exp.lintReport.ok).toBe(true);
  });

  it('la sérialisation pretty inclut les noms de tags uniques (no duplicates)', () => {
    const exp = gtmExporter.build({ env: 'production', exportTime: FIXED });
    // Re-extract les noms depuis pretty
    const matches = exp.pretty.matchAll(/"name":\s*"(Meta Evt — [^"]+)"/g);
    const names = [...matches].map((m) => m[1]).filter((n): n is string => Boolean(n));
    const seen = new Set<string>();
    for (const n of names) {
      expect(seen.has(n)).toBe(false);
      seen.add(n);
    }
    // Au moins 12 tags Meta uniques (event mappés)
    expect(names.length).toBeGreaterThanOrEqual(10);
  });
});
