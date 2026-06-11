/**
 * Tests pour `resolveCmsLocale` — helper de résolution des options locale.
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_LOCALE } from '@/i18n.config';

import { resolveCmsLocale } from './locale-options';

describe('resolveCmsLocale', () => {
  it('retourne les défauts si undefined', () => {
    const { locale, fallback } = resolveCmsLocale();
    expect(locale).toBe(DEFAULT_LOCALE);
    expect(fallback).toBe(DEFAULT_LOCALE);
  });

  it('retourne les défauts si options vide', () => {
    const { locale, fallback } = resolveCmsLocale({});
    expect(locale).toBe(DEFAULT_LOCALE);
    expect(fallback).toBe(DEFAULT_LOCALE);
  });

  it('passe la locale explicite', () => {
    const { locale } = resolveCmsLocale({ locale: 'ar' });
    expect(locale).toBe('ar');
  });

  it('passe le fallback explicite', () => {
    const { fallback } = resolveCmsLocale({ locale: 'ar', fallback: 'en' });
    expect(fallback).toBe('en');
  });

  it('respecte fallback=null (désactivation)', () => {
    const { fallback } = resolveCmsLocale({ locale: 'ar', fallback: null });
    expect(fallback).toBeNull();
  });

  it('distingue undefined (default) et null (disable)', () => {
    expect(resolveCmsLocale({ fallback: undefined }).fallback).toBe(DEFAULT_LOCALE);
    expect(resolveCmsLocale({ fallback: null }).fallback).toBeNull();
  });
});
