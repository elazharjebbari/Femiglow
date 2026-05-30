/**
 * Lot L4 — validation du schéma de config + fallback défauts (INV-12).
 */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LOCALE_CONFIG,
  localeConfigSchema,
  safeParseLocaleConfig,
} from './locale-config-schema';

const valid = DEFAULT_LOCALE_CONFIG;

describe('localeConfigSchema — config valide', () => {
  it('accepte la config par défaut', () => {
    expect(localeConfigSchema.safeParse(valid).success).toBe(true);
  });
  it('accepte une config mono-locale (fr seule)', () => {
    const single = {
      ...valid,
      locales: [{ code: 'fr', enabled: true, endonym: 'Français', order: 1 }],
    };
    expect(localeConfigSchema.safeParse(single).success).toBe(true);
  });
  it('accepte ar désactivée (fr défaut activée)', () => {
    const arOff = {
      ...valid,
      locales: valid.locales.map((l) =>
        l.code === 'ar' ? { ...l, enabled: false } : l,
      ),
    };
    expect(localeConfigSchema.safeParse(arOff).success).toBe(true);
  });
});

describe('localeConfigSchema — configs invalides', () => {
  it('rejette une locale par défaut désactivée', () => {
    const bad = {
      ...valid,
      locales: valid.locales.map((l) =>
        l.code === 'fr' ? { ...l, enabled: false } : l,
      ),
    };
    expect(localeConfigSchema.safeParse(bad).success).toBe(false);
  });
  it('rejette un endonyme vide', () => {
    const bad = {
      ...valid,
      locales: valid.locales.map((l) =>
        l.code === 'ar' ? { ...l, endonym: '' } : l,
      ),
    };
    expect(localeConfigSchema.safeParse(bad).success).toBe(false);
  });
  it('rejette defaultLocale absent de locales', () => {
    const bad = { ...valid, defaultLocale: 'en' as const, locales: [
      { code: 'fr', enabled: true, endonym: 'Français', order: 1 },
    ] };
    expect(localeConfigSchema.safeParse(bad).success).toBe(false);
  });
  it('rejette ar en ltr', () => {
    const bad = {
      ...valid,
      locales: valid.locales.map((l) =>
        l.code === 'ar' ? { ...l, direction: 'ltr' as const } : l,
      ),
    };
    expect(localeConfigSchema.safeParse(bad).success).toBe(false);
  });
  it('rejette des codes dupliqués', () => {
    const bad = {
      ...valid,
      locales: [...valid.locales, valid.locales[0]],
    };
    expect(localeConfigSchema.safeParse(bad).success).toBe(false);
  });
});

describe('safeParseLocaleConfig — fallback défauts (INV-12)', () => {
  it('config valide → telle quelle', () => {
    expect(safeParseLocaleConfig(valid)).toEqual(valid);
  });
  it('config invalide → défauts', () => {
    expect(safeParseLocaleConfig({ garbage: true })).toEqual(
      DEFAULT_LOCALE_CONFIG,
    );
  });
  it('null/undefined → défauts', () => {
    expect(safeParseLocaleConfig(null)).toEqual(DEFAULT_LOCALE_CONFIG);
    expect(safeParseLocaleConfig(undefined)).toEqual(DEFAULT_LOCALE_CONFIG);
  });
});
