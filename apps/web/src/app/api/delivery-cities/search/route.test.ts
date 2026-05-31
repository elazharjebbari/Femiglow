/**
 * Tests d'intégration de l'endpoint public /api/delivery-cities/search.
 *
 *  - Pas d'auth → 200 même sans session.
 *  - Query vide → top-N actifs.
 *  - Query FR → préfixe correct + alias overlay (Casablanca matche "Casa").
 *  - Query AR → match nameAr.
 *  - Inactif → JAMAIS dans le résultat public.
 *  - limit borné [1..50].
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';
import { createDeliveryCity } from '@/lib/db/queries/delivery-cities';

import { GET } from './route';

function req(url: string): Request {
  return new Request(`http://localhost${url}`);
}

beforeEach(() => {
  resetMemoryStore();
});

async function seed() {
  await createDeliveryCity({
    slug: 'casablanca',
    nameFr: 'Casablanca',
    nameAr: 'الدار البيضاء',
    deliveryPriceMad: 19,
    deliveryEta: '24h',
    aliases: ['Casa', 'Dar el Beida'],
    position: 0,
    source: 'sendit',
  });
  await createDeliveryCity({
    slug: 'rabat',
    nameFr: 'Rabat',
    nameAr: 'الرباط',
    deliveryPriceMad: 29,
    deliveryEta: '24h - 48h',
    position: 1,
    source: 'sendit',
  });
  await createDeliveryCity({
    slug: 'marrakech',
    nameFr: 'Marrakech',
    nameAr: 'مراكش',
    deliveryPriceMad: 35,
    deliveryEta: '24h - 48h',
    position: 2,
    source: 'sendit',
  });
  // Ville inactive — ne doit pas apparaître côté public.
  await createDeliveryCity({
    slug: 'inactive-city',
    nameFr: 'Inactive City',
    deliveryPriceMad: 45,
    deliveryEta: '48h',
    isActive: false,
    source: 'manual',
  });
}

describe('GET /api/delivery-cities/search', () => {
  it('200 sans session (pas d\'auth requise)', async () => {
    await seed();
    const res = await GET(req('/api/delivery-cities/search?q='));
    expect(res.status).toBe(200);
  });

  it('renvoie les villes prioritaires en premier, puis alphabétiques si q vide', async () => {
    await seed();
    const res = await GET(req('/api/delivery-cities/search?q='));
    const body = (await res.json()) as {
      items: Array<{ slug: string }>;
      total: number;
    };
    // Villes prioritaires (position > 0) en premier, puis alphabétiques.
    expect(body.items.map((c) => c.slug)).toEqual([
      'rabat',
      'marrakech',
      'casablanca',
    ]);
    expect(body.total).toBe(3);
  });

  it('matche par préfixe FR ("Casa" → Casablanca)', async () => {
    await seed();
    const res = await GET(req('/api/delivery-cities/search?q=Casa'));
    const body = (await res.json()) as { items: Array<{ slug: string }> };
    expect(body.items[0]?.slug).toBe('casablanca');
  });

  it('matche par alias ("Casa" est un alias de Casablanca)', async () => {
    await seed();
    const res = await GET(req('/api/delivery-cities/search?q=Dar'));
    const body = (await res.json()) as { items: Array<{ slug: string }> };
    expect(body.items.map((c) => c.slug)).toContain('casablanca');
  });

  it('matche par préfixe AR', async () => {
    await seed();
    const res = await GET(req('/api/delivery-cities/search?q=الرباط'));
    const body = (await res.json()) as { items: Array<{ slug: string }> };
    expect(body.items[0]?.slug).toBe('rabat');
  });

  it("n'inclut JAMAIS les villes inactives même si q matche", async () => {
    await seed();
    const res = await GET(req('/api/delivery-cities/search?q=Inactive'));
    const body = (await res.json()) as { items: Array<{ slug: string }> };
    expect(body.items.find((c) => c.slug === 'inactive-city')).toBeUndefined();
  });

  it('ignore le param includeInactive côté public (sécurité)', async () => {
    await seed();
    const res = await GET(
      req('/api/delivery-cities/search?q=Inactive&includeInactive=true'),
    );
    const body = (await res.json()) as { items: Array<{ slug: string }> };
    expect(body.items.find((c) => c.slug === 'inactive-city')).toBeUndefined();
  });

  it("expose uniquement les champs publics (pas de metadata, pas d'audit)", async () => {
    await seed();
    const res = await GET(req('/api/delivery-cities/search?q=Casa'));
    const body = (await res.json()) as { items: Array<Record<string, unknown>> };
    const city = body.items[0]!;
    expect(Object.keys(city).sort()).toEqual(
      ['aliases', 'deliveryEta', 'deliveryPriceMad', 'nameAr', 'nameFr', 'slug'].sort(),
    );
  });

  it('400 si limit hors plage [1..50] (rejette 999)', async () => {
    await seed();
    const res = await GET(req('/api/delivery-cities/search?q=&limit=999'));
    expect(res.status).toBe(400);
  });

  it('accepte limit=50 (max autorisé)', async () => {
    await seed();
    const res = await GET(req('/api/delivery-cities/search?q=&limit=50'));
    expect(res.status).toBe(200);
  });

  it('400 si paramètres invalides', async () => {
    const res = await GET(req('/api/delivery-cities/search?countryCode=marocooo'));
    expect(res.status).toBe(400);
  });

  it('renvoie le cache-control SWR', async () => {
    await seed();
    const res = await GET(req('/api/delivery-cities/search?q=Casa'));
    expect(res.headers.get('cache-control')).toContain('s-maxage=300');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Feature flag NEXT_PUBLIC_USE_DB_CITIES (server-side kill switch)
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /api/delivery-cities/search — NEXT_PUBLIC_USE_DB_CITIES=false', () => {
  const original = process.env.NEXT_PUBLIC_USE_DB_CITIES;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_USE_DB_CITIES = 'false';
  });

  // afterEach handlée par le restore implicite — on remet la valeur d'origine.
  it('sert le dataset statique au lieu de toucher la DB', async () => {
    // Note : on NE seed PAS la DB → si le handler interrogeait la DB,
    // il renverrait `[]`. Vérifier qu'on a bien du contenu prouve qu'on
    // tape MOROCCAN_CITIES.
    resetMemoryStore();
    const res = await GET(req('/api/delivery-cities/search?q=casa'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{ slug: string; nameFr: string }>;
    };
    expect(body.items.length).toBeGreaterThan(0);
    const casa = body.items.find((c) => c.slug === 'casablanca');
    expect(casa).toBeDefined();
    expect(casa?.nameFr).toBe('Casablanca');
  });

  it('q vide → top-N statique', async () => {
    resetMemoryStore();
    const res = await GET(req('/api/delivery-cities/search?q=&limit=5'));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      items: Array<{ slug: string }>;
      total: number;
    };
    expect(body.items.length).toBe(5);
    expect(body.total).toBe(5);
  });

  it('expose le même shape PublicCity en mode statique', async () => {
    resetMemoryStore();
    const res = await GET(req('/api/delivery-cities/search?q=casa'));
    const body = (await res.json()) as { items: Array<Record<string, unknown>> };
    const city = body.items[0]!;
    expect(Object.keys(city).sort()).toEqual(
      ['aliases', 'deliveryEta', 'deliveryPriceMad', 'nameAr', 'nameFr', 'slug'].sort(),
    );
  });

  it('réservoir cache-control en mode statique aussi', async () => {
    resetMemoryStore();
    const res = await GET(req('/api/delivery-cities/search?q=casa'));
    expect(res.headers.get('cache-control')).toContain('s-maxage=300');
  });

  // Remet l'env d'origine après le bloc.
  it('cleanup', () => {
    if (original === undefined) {
      delete process.env.NEXT_PUBLIC_USE_DB_CITIES;
    } else {
      process.env.NEXT_PUBLIC_USE_DB_CITIES = original;
    }
    expect(true).toBe(true);
  });
});
