/**
 * Tests des queries Rituels partagés en mode memory store.
 * Couvre insertion, listing avec filtres, agrégation, dedup signal.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import {
  decodeCursor,
  encodeCursor,
  getRitualSummary,
  insertAuditEvent,
  insertPhoto,
  insertRitual,
  listRituals,
  refreshRitualAggregate,
} from './rituals';

beforeEach(() => {
  // Force memory store branch (pas de DATABASE_URL)
  delete process.env.DATABASE_URL;
  resetMemoryStore();
});

afterEach(() => {
  resetMemoryStore();
});

const baseRitual = {
  productKey: 'pack-femiglow',
  body: 'Trois mois et l’ongle a retrouvé sa nervure tranquillement.',
  wouldRecommend: 'oui' as const,
  source: 'manual' as const,
  status: 'APPROVED' as const,
  publishedAt: new Date('2026-05-01T10:00:00Z'),
};

describe('encodeCursor / decodeCursor', () => {
  it('roundtrip', () => {
    const payload = { publishedAt: '2026-05-01T10:00:00Z', id: 'rt_test' };
    const encoded = encodeCursor(payload);
    expect(decodeCursor(encoded)).toEqual(payload);
  });

  it('renvoie null pour un cursor invalide', () => {
    expect(decodeCursor('garbage!!')).toBeNull();
  });
});

describe('insertRitual', () => {
  it('génère un id préfixé rt_ et un public_slug 8 caractères', async () => {
    const r = await insertRitual(baseRitual);
    expect(r.id.startsWith('rt_')).toBe(true);
    expect(r.publicSlug.length).toBe(8);
  });

  it('status défaut PENDING si non fourni', async () => {
    const r = await insertRitual({
      productKey: 'pack-femiglow',
      body: 'a'.repeat(60),
      wouldRecommend: 'hesite',
      source: 'web',
    });
    expect(r.status).toBe('PENDING');
    expect(r.publishedAt).toBeNull();
  });

  it('publishedAt set automatiquement si status APPROVED', async () => {
    const r = await insertRitual({ ...baseRitual, publishedAt: undefined });
    expect(r.publishedAt).toBeInstanceOf(Date);
  });
});

describe('listRituals', () => {
  beforeEach(async () => {
    for (let i = 0; i < 15; i++) {
      await insertRitual({
        ...baseRitual,
        publishedAt: new Date(`2026-05-${String(i + 1).padStart(2, '0')}T10:00:00Z`),
      });
    }
  });

  it('retourne 12 témoignages par défaut', async () => {
    const result = await listRituals({
      productKey: 'pack-femiglow',
      sort: 'recommended',
      limit: 12,
    });
    expect(result.items).toHaveLength(12);
    expect(result.hasMore).toBe(true);
  });

  it('respecte le limit', async () => {
    const result = await listRituals({
      productKey: 'pack-femiglow',
      sort: 'recommended',
      limit: 3,
    });
    expect(result.items).toHaveLength(3);
  });

  it('exclut les non APPROVED', async () => {
    await insertRitual({
      productKey: 'pack-femiglow',
      body: 'a'.repeat(60),
      wouldRecommend: 'oui',
      source: 'web',
      status: 'PENDING',
    });
    const result = await listRituals({
      productKey: 'pack-femiglow',
      sort: 'recommended',
      limit: 24,
    });
    expect(result.items.every((r) => true)).toBe(true);
    expect(result.items).toHaveLength(15); // les PENDING exclus
  });

  it('filtre par tag', async () => {
    await insertRitual({
      ...baseRitual,
      ritualTags: ['halal'],
      publishedAt: new Date('2026-06-01'),
    });
    const result = await listRituals({
      productKey: 'pack-femiglow',
      tags: ['halal'],
      sort: 'recommended',
      limit: 24,
    });
    expect(result.items).toHaveLength(1);
  });

  it('filtre featured', async () => {
    await insertRitual({
      ...baseRitual,
      featured: true,
      publishedAt: new Date('2026-06-01'),
    });
    const result = await listRituals({
      productKey: 'pack-femiglow',
      featured: true,
      sort: 'recommended',
      limit: 24,
    });
    expect(result.items).toHaveLength(1);
  });

  it('pagine via cursor stable (aucun doublon)', async () => {
    const p1 = await listRituals({
      productKey: 'pack-femiglow',
      sort: 'recommended',
      limit: 5,
    });
    expect(p1.nextCursor).toBeTruthy();
    const p2 = await listRituals({
      productKey: 'pack-femiglow',
      sort: 'recommended',
      cursor: p1.nextCursor!,
      limit: 5,
    });
    const idsP1 = p1.items.map((i) => i.publicSlug);
    const idsP2 = p2.items.map((i) => i.publicSlug);
    expect(idsP1.some((id) => idsP2.includes(id))).toBe(false);
  });

  it('tri par publishedAt desc par défaut', async () => {
    const result = await listRituals({
      productKey: 'pack-femiglow',
      sort: 'recommended',
      limit: 24,
    });
    // 15 séries croissantes de mai => le plus récent en premier
    const first = result.items[0];
    const last = result.items[result.items.length - 1];
    expect(first?.publishedAt).toBeTruthy();
    expect(last?.publishedAt).toBeTruthy();
    expect(new Date(first!.publishedAt!).getTime()).toBeGreaterThan(
      new Date(last!.publishedAt!).getTime(),
    );
  });
});

describe('insertPhoto', () => {
  it('default faces_status PENDING_CHECK', async () => {
    const ritual = await insertRitual(baseRitual);
    const photo = await insertPhoto({
      testimonialId: ritual.id,
      url: 'https://x/p.jpg',
      thumbUrl: 'https://x/p-thumb.jpg',
      width: 800,
      height: 1000,
      byteSize: 200000,
      mime: 'image/jpeg',
    });
    expect(photo.facesStatus).toBe('PENDING_CHECK');
    expect(photo.id.startsWith('rp_')).toBe(true);
  });
});

describe('refreshRitualAggregate', () => {
  it('agrège correctement signal et tags', async () => {
    await insertRitual({ ...baseRitual, wouldRecommend: 'oui', ritualTags: ['halal'] });
    await insertRitual({ ...baseRitual, wouldRecommend: 'oui', ritualTags: ['halal', 'plaque-souple'] });
    await insertRitual({ ...baseRitual, wouldRecommend: 'hesite' });
    const agg = await refreshRitualAggregate('pack-femiglow');
    expect(agg.totalCount).toBe(3);
    expect(agg.ouiCount).toBe(2);
    expect(agg.hesiteCount).toBe(1);
    expect(agg.topTags.find((t) => t.tag === 'halal')?.count).toBe(2);
  });

  it('compte photos OK uniquement', async () => {
    const r = await insertRitual(baseRitual);
    await insertPhoto({
      testimonialId: r.id,
      url: 'x',
      thumbUrl: 'x',
      width: 800,
      height: 1000,
      byteSize: 100,
      mime: 'image/jpeg',
      facesStatus: 'OK',
    });
    const agg = await refreshRitualAggregate('pack-femiglow');
    expect(agg.withPhotosCount).toBe(1);
  });
});

describe('getRitualSummary', () => {
  it('renvoie 0 si aucun agrégat', async () => {
    const s = await getRitualSummary('pack-femiglow');
    expect(s.totalCount).toBe(0);
  });

  it('renvoie l’agrégat après refresh', async () => {
    await insertRitual(baseRitual);
    await refreshRitualAggregate('pack-femiglow');
    const s = await getRitualSummary('pack-femiglow');
    expect(s.totalCount).toBe(1);
  });
});

describe('insertAuditEvent', () => {
  it('crée une entrée avec préfixe ral_', async () => {
    const r = await insertRitual(baseRitual);
    const entry = await insertAuditEvent({
      testimonialId: r.id,
      actorId: 'admin-1',
      action: 'approved',
    });
    expect(entry.id.startsWith('ral_')).toBe(true);
  });
});
