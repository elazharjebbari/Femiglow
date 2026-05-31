/**
 * Suite intégration — POST /api/admin/products/feed/revalidate.
 *
 * Couvre :
 *  - 200 + revalidations Next + audit log quand admin session présente,
 *  - 401 quand session absente,
 *  - les bons tags Next.js sont purgés (`product-feed`, `product:le-kit`),
 *  - les bons paths Next.js sont purgés (`/feed.xml`, `/kit`).
 *
 * On mock `next/cache` pour observer ce que la route a appelé sans
 * dépendre du runtime Next.js.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let sessionMock:
  | { adminId: string; email: string; issuedAt: number; expiresAt: number }
  | null = {
  adminId: 'adm_1',
  email: 'admin@femiglow.ma',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 1000 * 60 * 60,
};

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: () => Promise.resolve(sessionMock),
  requireAdmin: () => Promise.resolve(sessionMock),
}));

const revalidateTagSpy = vi.fn();
const revalidatePathSpy = vi.fn();

vi.mock('next/cache', () => ({
  revalidateTag: (tag: string) => revalidateTagSpy(tag),
  revalidatePath: (path: string) => revalidatePathSpy(path),
  // `unstable_cache` est référencé indirectement via `lib/products/public.ts` :
  // on retourne une no-op qui exécute la fonction passée.
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}));

import { POST } from '@/app/api/admin/products/feed/revalidate/route';
import { resetMemoryStore, memoryStore } from '@/lib/db/client';

beforeEach(() => {
  resetMemoryStore();
  revalidateTagSpy.mockClear();
  revalidatePathSpy.mockClear();
  sessionMock = {
    adminId: 'adm_1',
    email: 'admin@femiglow.ma',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 1000 * 60 * 60,
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/admin/products/feed/revalidate', () => {
  it('200 + purge tags + purge paths + audit log', async () => {
    const res = await POST();
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      slug: string;
      revalidatedAt: string;
    };
    expect(json.ok).toBe(true);
    expect(json.slug).toBe('le-kit');
    expect(Number.isFinite(Date.parse(json.revalidatedAt))).toBe(true);

    // Tags purgés : `products` (générique), `product:le-kit` (spécifique),
    // `product-feed` (RSS Merchant).
    const tags = revalidateTagSpy.mock.calls.map(([t]) => t);
    expect(tags).toContain('products');
    expect(tags).toContain('product:le-kit');
    expect(tags).toContain('product-feed');

    // Paths purgés : `/kit` (page publique) + `/feed.xml` (endpoint RSS).
    const paths = revalidatePathSpy.mock.calls.map(([p]) => p);
    expect(paths).toContain('/kit');
    expect(paths).toContain('/feed.xml');

    // Audit log écrit en mémoire (DB drizzle absente en tests).
    const events = Array.from(memoryStore().auditEvents.values());
    const logged = events.find((e) => e.action === 'product.feed.revalidate');
    expect(logged, 'attendu un audit event product.feed.revalidate').toBeDefined();
    expect(logged!.actorId).toBe('adm_1');
    expect(logged!.resourceId).toBe('le-kit');
  });

  it('401 quand la session admin est absente', async () => {
    sessionMock = null;
    const res = await POST();
    expect(res.status).toBe(401);
    // Pas de revalidation effectuée si pas de session.
    expect(revalidateTagSpy).not.toHaveBeenCalled();
    expect(revalidatePathSpy).not.toHaveBeenCalled();
    // Pas d'audit log non plus.
    const events = Array.from(memoryStore().auditEvents.values());
    expect(
      events.find((e) => e.action === 'product.feed.revalidate'),
      'pas de log si non authentifié',
    ).toBeUndefined();
  });
});
