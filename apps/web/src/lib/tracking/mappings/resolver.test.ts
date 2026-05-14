import { describe, expect, it, vi, beforeEach } from 'vitest';

const dbThrowsHandle = vi.hoisted(() => ({ shouldThrow: false }));

vi.mock('@/lib/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/client')>();
  return {
    ...actual,
    db: () => {
      if (!dbThrowsHandle.shouldThrow) return null;
      throw Object.assign(new Error('relation does not exist'), { code: '42P01' });
    },
  };
});

import { resolveEventMapping, invalidateMappingResolverCache } from './resolver';

beforeEach(() => {
  dbThrowsHandle.shouldThrow = false;
  invalidateMappingResolverCache();
});

describe('resolveEventMapping', () => {
  it('retourne le mapping depuis event-mapping.ts en mode memory (pas de DB active)', async () => {
    const r = await resolveEventMapping('purchase', 'meta');
    expect(r).not.toBeNull();
    expect(r!.mappedName).toBe('Purchase');
  });

  it('retourne null pour un event inconnu', async () => {
    const r = await resolveEventMapping('totally_unknown_event_xyz', 'meta');
    expect(r).toBeNull();
  });

  it('retourne null pour un provider sans mapping pour cet event', async () => {
    // 'scroll_depth' n'a que google_ga4='scroll' → snap/pinterest doivent retourner null
    const r = await resolveEventMapping('scroll_depth', 'snap');
    expect(r).toBeNull();
  });

  it('fallback gracieux si DB throw', async () => {
    dbThrowsHandle.shouldThrow = true;
    const r = await resolveEventMapping('purchase', 'meta');
    expect(r).not.toBeNull();
    expect(r!.mappedName).toBe('Purchase');
  });

  it('cache hit (même résultat appel suivant)', async () => {
    const r1 = await resolveEventMapping('purchase', 'meta');
    const r2 = await resolveEventMapping('purchase', 'meta');
    expect(r1).toBe(r2); // référence identique
  });

  it("invalidateMappingResolverCache vide le cache", async () => {
    await resolveEventMapping('purchase', 'meta');
    invalidateMappingResolverCache();
    const r = await resolveEventMapping('purchase', 'meta');
    expect(r).not.toBeNull();
  });
});
