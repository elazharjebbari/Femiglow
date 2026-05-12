/**
 * Tests d'intégration de l'endpoint public /api/delivery-cities/[slug].
 *
 *  - 200 sans auth pour une ville active connue.
 *  - 404 si introuvable OU inactive.
 *  - 400 si slug invalide.
 *  - DTO réduit (PublicCity, pas de metadata/audit).
 *  - Cache-Control SWR.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';
import { createDeliveryCity } from '@/lib/db/queries/delivery-cities';

import { GET } from './route';

function req(): Request {
  return new Request('http://localhost/api/delivery-cities/x');
}

beforeEach(() => {
  resetMemoryStore();
});

describe('GET /api/delivery-cities/[slug]', () => {
  it('200 retourne la ville active connue', async () => {
    await createDeliveryCity({
      slug: 'casablanca',
      nameFr: 'Casablanca',
      nameAr: 'الدار البيضاء',
      deliveryPriceMad: 19,
      deliveryEta: '24h',
      aliases: ['Casa'],
      source: 'sendit',
    });
    const res = await GET(req(), { params: { slug: 'casablanca' } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      city: { slug: string; deliveryPriceMad: number; deliveryEta: string };
    };
    expect(body.city.slug).toBe('casablanca');
    expect(body.city.deliveryPriceMad).toBe(19);
    expect(body.city.deliveryEta).toBe('24h');
  });

  it("404 si la ville n'existe pas", async () => {
    const res = await GET(req(), { params: { slug: 'inexistante' } });
    expect(res.status).toBe(404);
  });

  it('404 si la ville existe mais est inactive (pas de leak)', async () => {
    await createDeliveryCity({
      slug: 'cachee',
      nameFr: 'Cachée',
      deliveryPriceMad: 99,
      deliveryEta: '48h',
      isActive: false,
      source: 'manual',
    });
    const res = await GET(req(), { params: { slug: 'cachee' } });
    expect(res.status).toBe(404);
  });

  it('400 si slug vide', async () => {
    const res = await GET(req(), { params: { slug: '' } });
    expect(res.status).toBe(400);
  });

  it('400 si slug trop long', async () => {
    const res = await GET(req(), { params: { slug: 'a'.repeat(200) } });
    expect(res.status).toBe(400);
  });

  it('expose uniquement les champs publics', async () => {
    await createDeliveryCity({
      slug: 'rabat',
      nameFr: 'Rabat',
      deliveryPriceMad: 29,
      deliveryEta: '24h - 48h',
      source: 'sendit',
    });
    const res = await GET(req(), { params: { slug: 'rabat' } });
    const body = (await res.json()) as { city: Record<string, unknown> };
    expect(Object.keys(body.city).sort()).toEqual(
      ['aliases', 'deliveryEta', 'deliveryPriceMad', 'nameAr', 'nameFr', 'slug'].sort(),
    );
  });

  it('expose le cache-control SWR', async () => {
    await createDeliveryCity({
      slug: 'tanger',
      nameFr: 'Tanger',
      deliveryPriceMad: 35,
      deliveryEta: '24h - 48h',
      source: 'sendit',
    });
    const res = await GET(req(), { params: { slug: 'tanger' } });
    expect(res.headers.get('cache-control')).toContain('s-maxage=300');
  });

  it('accepte params en Promise (Next 15 future-proof)', async () => {
    await createDeliveryCity({
      slug: 'fes',
      nameFr: 'Fès',
      deliveryPriceMad: 29,
      deliveryEta: '24h - 48h',
      source: 'sendit',
    });
    const res = await GET(req(), { params: Promise.resolve({ slug: 'fes' }) });
    expect(res.status).toBe(200);
  });
});
