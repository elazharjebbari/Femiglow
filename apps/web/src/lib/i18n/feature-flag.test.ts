/**
 * Tests `isI18nEnabled` — feature flag i18n routing.
 *
 * Vérifie que le flag est OFF par défaut (zéro régression code legacy)
 * et accepte plusieurs représentations truthy/falsy.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { isI18nEnabled, isI18nEnabledClient } from './feature-flag';

describe('isI18nEnabled', () => {
  const originalEnv = process.env.I18N_ENABLED;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.I18N_ENABLED;
    } else {
      process.env.I18N_ENABLED = originalEnv;
    }
  });

  it('retourne false si I18N_ENABLED est non défini (default)', () => {
    delete process.env.I18N_ENABLED;
    expect(isI18nEnabled()).toBe(false);
  });

  it('retourne false si I18N_ENABLED est vide', () => {
    process.env.I18N_ENABLED = '';
    expect(isI18nEnabled()).toBe(false);
  });

  it.each(['true', 'TRUE', 'True', '1', 'on', 'ON', 'yes', 'enabled'])(
    'retourne true pour valeur truthy "%s"',
    (val) => {
      process.env.I18N_ENABLED = val;
      expect(isI18nEnabled()).toBe(true);
    },
  );

  it.each(['false', 'FALSE', '0', 'off', 'no', 'disabled', 'unknown', 'random'])(
    'retourne false pour valeur non-truthy "%s"',
    (val) => {
      process.env.I18N_ENABLED = val;
      expect(isI18nEnabled()).toBe(false);
    },
  );

  it('tolère les espaces en début/fin', () => {
    process.env.I18N_ENABLED = '  true  ';
    expect(isI18nEnabled()).toBe(true);
  });
});

describe('isI18nEnabledClient', () => {
  const originalEnv = process.env.NEXT_PUBLIC_I18N_ENABLED;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_I18N_ENABLED;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_I18N_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_I18N_ENABLED = originalEnv;
    }
  });

  it('retourne false si non défini', () => {
    expect(isI18nEnabledClient()).toBe(false);
  });

  it('retourne true pour "true"', () => {
    process.env.NEXT_PUBLIC_I18N_ENABLED = 'true';
    expect(isI18nEnabledClient()).toBe(true);
  });

  it('est indépendant de I18N_ENABLED (server-only)', () => {
    process.env.I18N_ENABLED = 'true';
    process.env.NEXT_PUBLIC_I18N_ENABLED = 'false';
    expect(isI18nEnabledClient()).toBe(false);
  });
});
