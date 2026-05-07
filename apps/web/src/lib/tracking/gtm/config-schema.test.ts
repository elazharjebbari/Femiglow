/**
 * Tests des règles cross-env du schema (superRefine).
 * Cf. docs/gtm/17-onboarding-robustness.md §3.6.
 */
import { describe, expect, it } from 'vitest';
import { gtmConfigCreateInputSchema, emptyEnvConfig } from './config-schema';

function fixture(prodOverride: Partial<ReturnType<typeof emptyEnvConfig>> = {}) {
  return {
    name: 'v1',
    notes: null,
    perEnv: {
      production: { ...emptyEnvConfig(), ...prodOverride },
      stage: emptyEnvConfig(),
      preview: emptyEnvConfig(),
      dev: emptyEnvConfig(),
    },
  };
}

describe('config-schema — règles superRefine cross-env', () => {
  it('happy path : aucune erreur si config minimale cohérente', () => {
    const r = gtmConfigCreateInputSchema.safeParse(fixture());
    expect(r.success).toBe(true);
  });

  it('GA4 activé en prod sans Measurement ID → reject', () => {
    const r = gtmConfigCreateInputSchema.safeParse(
      fixture({ enabledProviders: ['google_ga4'], ga4MeasurementId: '' }),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path.includes('ga4MeasurementId'));
      expect(issue).toBeDefined();
      expect(issue!.message).toContain('Measurement ID');
    }
  });

  it('GA4 activé en prod avec Measurement ID → accept', () => {
    const r = gtmConfigCreateInputSchema.safeParse(
      fixture({ enabledProviders: ['google_ga4'], ga4MeasurementId: 'G-PROD0000' }),
    );
    expect(r.success).toBe(true);
  });

  it('Conv labels définis sans Ads Customer ID → reject', () => {
    const r = gtmConfigCreateInputSchema.safeParse(
      fixture({
        googleAdsConvLabels: { purchase: 'AW-123/abc' },
        googleAdsCustomerId: '',
      }),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path.includes('googleAdsCustomerId'));
      expect(issue).toBeDefined();
    }
  });

  it('Conv labels définis avec Ads Customer ID → accept', () => {
    const r = gtmConfigCreateInputSchema.safeParse(
      fixture({
        googleAdsConvLabels: { purchase: 'AW-123/abc' },
        googleAdsCustomerId: '123-456-7890',
      }),
    );
    expect(r.success).toBe(true);
  });

  it('GA4 ID avec marqueur DEV en prod → reject', () => {
    const r = gtmConfigCreateInputSchema.safeParse(
      fixture({ ga4MeasurementId: 'G-DEVID0' }),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      const issue = r.error.issues.find((i) => i.path.includes('ga4MeasurementId'));
      expect(issue).toBeDefined();
      expect(issue!.message).toContain('DEV/TEST');
    }
  });

  it('GA4 ID avec marqueur TEST en prod → reject', () => {
    const r = gtmConfigCreateInputSchema.safeParse(
      fixture({ ga4MeasurementId: 'G-TEST12' }),
    );
    expect(r.success).toBe(false);
  });

  it('GA4 ID prod sans marqueur → accept', () => {
    const r = gtmConfigCreateInputSchema.safeParse(
      fixture({ ga4MeasurementId: 'G-PROD0001' }),
    );
    expect(r.success).toBe(true);
  });

  it('marqueurs autorisés dans dev → accept (pas de superRefine sur dev)', () => {
    const r = gtmConfigCreateInputSchema.safeParse({
      name: 'v1',
      notes: null,
      perEnv: {
        production: emptyEnvConfig(),
        stage: emptyEnvConfig(),
        preview: emptyEnvConfig(),
        dev: { ...emptyEnvConfig(), ga4MeasurementId: 'G-DEVXXX' },
      },
    });
    expect(r.success).toBe(true);
  });

  it('plusieurs règles déclenchées en parallèle', () => {
    const r = gtmConfigCreateInputSchema.safeParse(
      fixture({
        enabledProviders: ['google_ga4'],
        ga4MeasurementId: '',
        googleAdsConvLabels: { purchase: 'AW-1/a' },
        googleAdsCustomerId: '',
      }),
    );
    expect(r.success).toBe(false);
    if (!r.success) {
      // Au moins 2 issues : GA4 sans ID et Conv sans Customer
      expect(r.error.issues.length).toBeGreaterThanOrEqual(2);
    }
  });
});
