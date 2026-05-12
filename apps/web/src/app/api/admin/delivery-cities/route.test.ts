/**
 * Tests d'intégration des endpoints admin /api/admin/delivery-cities.
 *
 *  - GET — listing paginé + filtres.
 *  - POST — création manuelle, conflit sur slug existant.
 *  - Auth requise (401 sans session).
 *  - Validation Zod (422 sur payload).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';
import { createDeliveryCity } from '@/lib/db/queries/delivery-cities';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(),
}));

import { getAdminSession } from '@/lib/auth/require-admin';
import { GET, POST } from './route';

function adminSession() {
  return { adminId: 'adm_1', email: 'a@b.c', issuedAt: 0, expiresAt: 0 } as never;
}

function jsonPost(body: unknown): Request {
  return new Request('http://x/api/admin/delivery-cities', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function getReq(qs = ''): Request {
  return new Request(`http://x/api/admin/delivery-cities${qs ? `?${qs}` : ''}`);
}

beforeEach(() => {
  resetMemoryStore();
  vi.mocked(getAdminSession).mockReset();
});

// ─────────────────────────────────────────────────────────────────────────────
// GET — listing
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/admin/delivery-cities', () => {
  it('401 sans session admin', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await GET(getReq());
    expect(res.status).toBe(401);
  });

  it('200 listing vide', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await GET(getReq());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { items: unknown[]; total: number };
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
  });

  it('200 listing paginé', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    for (let i = 0; i < 5; i++) {
      await createDeliveryCity({
        slug: `ville-${i}`,
        nameFr: `Ville ${i}`,
        deliveryPriceMad: 29,
        deliveryEta: '24h',
        position: i,
      });
    }
    const res = await GET(getReq('pageSize=2&page=2'));
    const body = (await res.json()) as {
      items: Array<{ slug: string }>;
      total: number;
      page: number;
      pageSize: number;
    };
    expect(body.total).toBe(5);
    expect(body.page).toBe(2);
    expect(body.pageSize).toBe(2);
    expect(body.items).toHaveLength(2);
  });

  it('200 filtre active=false', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    await createDeliveryCity({
      slug: 'on',
      nameFr: 'On',
      deliveryPriceMad: 29,
      deliveryEta: '24h',
      isActive: true,
    });
    await createDeliveryCity({
      slug: 'off',
      nameFr: 'Off',
      deliveryPriceMad: 29,
      deliveryEta: '24h',
      isActive: false,
    });
    const res = await GET(getReq('active=false'));
    const body = (await res.json()) as { items: Array<{ slug: string }> };
    expect(body.items.map((c) => c.slug)).toEqual(['off']);
  });

  it('400 si page=abc (validation Zod)', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await GET(getReq('page=abc'));
    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST — création
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /api/admin/delivery-cities', () => {
  it('401 sans session admin', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(null);
    const res = await POST(jsonPost({}));
    expect(res.status).toBe(401);
  });

  it('400 si JSON invalide', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await POST(
      new Request('http://x/api/admin/delivery-cities', {
        method: 'POST',
        body: 'pas-du-json',
      }),
    );
    expect(res.status).toBe(400);
  });

  it('422 si payload Zod invalide', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await POST(jsonPost({ slug: 'X', nameFr: '' }));
    expect(res.status).toBe(422);
  });

  it('422 si prix décimal (rappel : MAD entier, PAS centimes)', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await POST(
      jsonPost({
        slug: 'test',
        nameFr: 'Test',
        deliveryPriceMad: 29.5,
        deliveryEta: '24h',
      }),
    );
    expect(res.status).toBe(422);
  });

  it('201 création réussie (source=manual par défaut)', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await POST(
      jsonPost({
        slug: 'oujda',
        nameFr: 'Oujda',
        nameAr: 'وجدة',
        deliveryPriceMad: 39,
        deliveryEta: '48h - 96h',
      }),
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      city: { slug: string; source: string; nameAr: string };
    };
    expect(body.city.slug).toBe('oujda');
    expect(body.city.source).toBe('manual');
    expect(body.city.nameAr).toBe('وجدة');
  });

  it('409 conflit si slug existe déjà', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    await createDeliveryCity({
      slug: 'casa',
      nameFr: 'Casa',
      deliveryPriceMad: 19,
      deliveryEta: '24h',
    });
    const res = await POST(
      jsonPost({
        slug: 'casa',
        nameFr: 'Casa Doublon',
        deliveryPriceMad: 29,
        deliveryEta: '24h',
      }),
    );
    expect(res.status).toBe(409);
  });

  it('dédup les aliases case-insensitive', async () => {
    vi.mocked(getAdminSession).mockResolvedValue(adminSession());
    const res = await POST(
      jsonPost({
        slug: 'aliased',
        nameFr: 'Aliased',
        deliveryPriceMad: 29,
        deliveryEta: '24h',
        aliases: ['Casa', 'casa', 'CASA', 'Dar'],
      }),
    );
    const body = (await res.json()) as { city: { aliases: string[] } };
    expect(body.city.aliases).toEqual(['Casa', 'Dar']);
  });
});
