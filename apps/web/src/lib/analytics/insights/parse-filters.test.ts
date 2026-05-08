import { describe, expect, it } from 'vitest';
import { parseInsightsFiltersFromUrl } from './parse-filters';
import { HttpError } from '@/lib/errors/http-error';

describe('parseInsightsFiltersFromUrl', () => {
  it('URL vide → defaults', () => {
    const url = new URL('http://x/admin/analytics/insights');
    const f = parseInsightsFiltersFromUrl(url);
    expect(f.window).toBe('7d');
    expect(f.env).toBe('all');
    expect(f.device).toBe('all');
  });

  it('URL avec window=30d', () => {
    const url = new URL('http://x?window=30d');
    expect(parseInsightsFiltersFromUrl(url).window).toBe('30d');
  });

  it('URL custom range valide', () => {
    const url = new URL('http://x?window=custom&customFrom=2026-01-01&customTo=2026-01-31');
    const f = parseInsightsFiltersFromUrl(url);
    expect(f.window).toBe('custom');
    expect(f.customFrom).toBe('2026-01-01');
    expect(f.customTo).toBe('2026-01-31');
  });

  it('URL window invalide → throw HttpError invalid_input', () => {
    const url = new URL('http://x?window=forever');
    expect(() => parseInsightsFiltersFromUrl(url)).toThrow(HttpError);
  });

  it('URL custom sans bornes → throw', () => {
    const url = new URL('http://x?window=custom');
    expect(() => parseInsightsFiltersFromUrl(url)).toThrow(HttpError);
  });

  it('URL custom range > 365j → throw', () => {
    const url = new URL(
      'http://x?window=custom&customFrom=2024-01-01&customTo=2026-12-31',
    );
    expect(() => parseInsightsFiltersFromUrl(url)).toThrow(HttpError);
  });

  it('multi-filtres combinés', () => {
    const url = new URL('http://x?window=30d&env=production&device=mobile&locale=fr-MA');
    const f = parseInsightsFiltersFromUrl(url);
    expect(f.window).toBe('30d');
    expect(f.env).toBe('production');
    expect(f.device).toBe('mobile');
    expect(f.locale).toBe('fr-MA');
  });

  it('params extras ignorés (ne casse pas)', () => {
    const url = new URL('http://x?window=7d&unknown=value');
    const f = parseInsightsFiltersFromUrl(url);
    expect(f.window).toBe('7d');
  });

  it('locale > 20 chars → throw', () => {
    const url = new URL(`http://x?locale=${'x'.repeat(25)}`);
    expect(() => parseInsightsFiltersFromUrl(url)).toThrow(HttpError);
  });
});
