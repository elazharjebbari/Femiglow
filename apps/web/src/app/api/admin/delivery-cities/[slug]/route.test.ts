/**
 * Tests d'intégration des endpoints admin /api/admin/delivery-cities/[slug].
 *
 *  - GET 200/404 + auth.
 *  - PATCH validation + 422 + promotion auto sendit→manual.
 *  - DELETE 200/404 + auth.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';
import {
  createDeliveryCity,
  findDeliveryCityBySlug,
} from '@/lib/db/queries/delivery-cities';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(),
}));

import { getAdminSession } from '@/lib/auth/require-admin';
import { DELETE, GET, PATCH } from './route';

function adminSession() {
  return { adminId: 'adm_1', email: 'a@b.c', issuedAt: 0, expiresAt: 0 } as never;
}

function patchReq(slug: string, body: unknown): Request {
  return new Request(`http://x/api/admin/delivery-cities/${slug}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function plainReq(slug: string): Request {
  return new Request(`http://x/api/admin/delivery-cities/${slug}`);
}

beforeEach(() => {
  resetMemoryStore();
  vi.mocked(getAdminSession).mockReset();
});

// ─────────────────────────────────────────────────────────────────────────────
// GET
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/delivery-cities/[slug]', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await GET(plainReq('x'), { params: { slug: 'x' } });
    expect(res.status).toBe(401);
  });

  it('200 ville connue', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    await createDeliveryCity({
      slug: 'casa',
      nameFr: 'Casa',
      deliveryPriceMad: 19,
      deliveryEta: '24h',
    });
    const res = await GET(plainReq('casa'), { params: { slug: 'casa' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { city: { slug: string } };
    expect(body.city.slug).toBe('casa');
  });

  it('404 inconnue', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await GET(plainReq('x'), { params: { slug: 'x' } });
    expect(res.status).toBe(404);
  });

  it('GET admin retourne aussi les villes inactives (cf. public qui les masque)', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    await createDeliveryCity({
      slug: 'off',
      nameFr: 'Off',
      deliveryPriceMad: 29,
      deliveryEta: '24h',
      isActive: false,
    });
    const res = await GET(plainReq('off'), { params: { slug: 'off' } });
    expect(res.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /api/admin/delivery-cities/[slug]', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await PATCH(patchReq('x', {}), { params: { slug: 'x' } });
    expect(res.status).toBe(401);
  });

  it('404 si la ville n\'existe pas', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await PATCH(patchReq('inconnue', { deliveryPriceMad: 99 }), {
      params: { slug: 'inconnue' },
    });
    expect(res.status).toBe(404);
  });

  it('400 si JSON invalide', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    await createDeliveryCity({
      slug: 'x',
      nameFr: 'X',
      deliveryPriceMad: 29,
      deliveryEta: '24h',
    });
    const res = await PATCH(
      new Request('http://x/api/admin/delivery-cities/x', {
        method: 'PATCH',
        body: 'not json',
      }),
      { params: { slug: 'x' } },
    );
    expect(res.status).toBe(400);
  });

  it('422 payload Zod invalide', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    await createDeliveryCity({
      slug: 'x',
      nameFr: 'X',
      deliveryPriceMad: 29,
      deliveryEta: '24h',
    });
    const res = await PATCH(patchReq('x', { deliveryPriceMad: -10 }), {
      params: { slug: 'x' },
    });
    expect(res.status).toBe(422);
  });

  it('400 si patch vide', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    await createDeliveryCity({
      slug: 'x',
      nameFr: 'X',
      deliveryPriceMad: 29,
      deliveryEta: '24h',
    });
    const res = await PATCH(patchReq('x', {}), { params: { slug: 'x' } });
    expect(res.status).toBe(400);
  });

  it('200 met à jour le prix', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    await createDeliveryCity({
      slug: 'casa',
      nameFr: 'Casa',
      deliveryPriceMad: 19,
      deliveryEta: '24h',
      source: 'manual',
    });
    const res = await PATCH(patchReq('casa', { deliveryPriceMad: 25 }), {
      params: { slug: 'casa' },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { city: { deliveryPriceMad: number } };
    expect(body.city.deliveryPriceMad).toBe(25);
  });

  it("promeut sendit→manual automatiquement quand l'admin édite", async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    await createDeliveryCity({
      slug: 'casa',
      nameFr: 'Casa',
      deliveryPriceMad: 19,
      deliveryEta: '24h',
      source: 'sendit',
    });
    const res = await PATCH(patchReq('casa', { deliveryPriceMad: 25 }), {
      params: { slug: 'casa' },
    });
    expect(res.status).toBe(200);
    const stored = await findDeliveryCityBySlug('casa');
    expect(stored?.source).toBe('manual');
    expect(stored?.deliveryPriceMad).toBe(25);
  });

  it('respecte la source explicite si elle est dans le patch', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    await createDeliveryCity({
      slug: 'casa',
      nameFr: 'Casa',
      deliveryPriceMad: 19,
      deliveryEta: '24h',
      source: 'sendit',
    });
    const res = await PATCH(
      patchReq('casa', { deliveryPriceMad: 25, source: 'custom' }),
      { params: { slug: 'casa' } },
    );
    expect(res.status).toBe(200);
    const stored = await findDeliveryCityBySlug('casa');
    expect(stored?.source).toBe('custom');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /api/admin/delivery-cities/[slug]', () => {
  it('401 sans session', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await DELETE(plainReq('x'), { params: { slug: 'x' } });
    expect(res.status).toBe(401);
  });

  it('404 si la ville n\'existe pas', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await DELETE(plainReq('inconnue'), { params: { slug: 'inconnue' } });
    expect(res.status).toBe(404);
  });

  it('200 supprime', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    await createDeliveryCity({
      slug: 'casa',
      nameFr: 'Casa',
      deliveryPriceMad: 19,
      deliveryEta: '24h',
    });
    const res = await DELETE(plainReq('casa'), { params: { slug: 'casa' } });
    expect(res.status).toBe(200);
    expect(await findDeliveryCityBySlug('casa')).toBeNull();
  });
});
