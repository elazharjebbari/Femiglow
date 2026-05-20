import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResolvedFields } from '@/lib/db/types';
import {
  buildGeoPromoTags,
  resolveGeoPromoAdminConfig,
  resolveKitDiscountPctSafe,
} from './config';

let mockedFields: ResolvedFields = {};
const getKitProductCachedMock = vi.fn(async () => null);

vi.mock('@/lib/components/field-resolver', () => ({
  resolveComponentFieldsFresh: vi.fn(async () => mockedFields),
}));

vi.mock('@/lib/products/public', () => ({
  getKitProductCached: () => getKitProductCachedMock(),
}));

describe('promo slide header config', () => {
  beforeEach(() => {
    mockedFields = {};
    getKitProductCachedMock.mockReset();
    getKitProductCachedMock.mockResolvedValue(null);
  });

  it('defaults to admin-disabled and /kit-only scope', async () => {
    const config = await resolveGeoPromoAdminConfig();
    expect(config.enabled).toBe(false);
    expect(config.routesInclude).toEqual(['/kit']);
    expect(config.ctaHref).toBe('/kit#commander-femiglow');
  });

  it('coerces admin fields and blocks non-kit CTA hrefs', async () => {
    mockedFields = {
      enabled: { value: true, meta: { source: 'binding', version: 1, locale: 'fr' } },
      ctaHref: { value: '/journal', meta: { source: 'binding', version: 1, locale: 'fr' } },
      theme: { value: 'cream', meta: { source: 'binding', version: 1, locale: 'fr' } },
      tagOrder: {
        value: ['cod', 'bad', 'discount'],
        meta: { source: 'binding', version: 1, locale: 'fr' },
      },
    };
    const config = await resolveGeoPromoAdminConfig();
    expect(config.enabled).toBe(true);
    expect(config.ctaHref).toBe('/kit#commander-femiglow');
    expect(config.theme).toBe('cream');
    expect(config.tagOrder).toEqual(['cod', 'discount']);
  });

  it('builds discount only when a discount percentage is available', () => {
    const base = {
      tagsEnabled: true,
      tagOrder: ['discount', 'free_shipping'] as const,
    };
    expect(buildGeoPromoTags(base as never, 25).map((tag) => tag.label)).toEqual([
      '-25%',
      'Livraison gratuite',
    ]);
    expect(buildGeoPromoTags(base as never, null).map((tag) => tag.label)).toEqual([
      'Livraison gratuite',
    ]);
  });

  it('keeps the promo enabled when discount lookup fails', async () => {
    getKitProductCachedMock.mockRejectedValueOnce(new Error('db unavailable'));
    await expect(resolveKitDiscountPctSafe()).resolves.toBeNull();
  });
});
