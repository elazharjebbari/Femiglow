import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import { insertRitual } from './rituals';
import {
  approveRitual,
  getAdminRitualById,
  getRitualNeighbors,
  hideRitual,
  listAdminRituals,
  listAuditEntries,
  rejectRitual,
  restoreRitual,
  setFeatured,
} from './rituals-admin';

beforeEach(() => {
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
  source: 'web' as const,
};

describe('listAdminRituals', () => {
  it('par défaut filtre status PENDING', async () => {
    await insertRitual({ ...baseRitual, status: 'PENDING' });
    await insertRitual({ ...baseRitual, status: 'APPROVED', publishedAt: new Date() });
    const result = await listAdminRituals({ status: 'PENDING' });
    expect(result.rows).toHaveLength(1);
    expect(result.pendingCount).toBe(1);
  });

  it('filtre tous status si status=all', async () => {
    await insertRitual({ ...baseRitual, status: 'PENDING' });
    await insertRitual({ ...baseRitual, status: 'APPROVED', publishedAt: new Date() });
    const result = await listAdminRituals({ status: 'all' });
    expect(result.rows.length).toBeGreaterThanOrEqual(2);
  });

  it('filtre withFaceFlag', async () => {
    await insertRitual({ ...baseRitual, autoFlags: ['emoji_detected'] });
    await insertRitual({ ...baseRitual, autoFlags: ['face_detected'] });
    const result = await listAdminRituals({
      status: 'all',
      withFaceFlag: true,
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.autoFlags).toContain('face_detected');
  });

  it('filtre par flags multiple (intersection)', async () => {
    await insertRitual({ ...baseRitual, autoFlags: ['face_detected'] });
    await insertRitual({
      ...baseRitual,
      autoFlags: ['face_detected', 'emoji_detected'],
    });
    const result = await listAdminRituals({
      status: 'all',
      flags: ['face_detected', 'emoji_detected'],
    });
    expect(result.rows).toHaveLength(1);
  });

  it('filtre par sources', async () => {
    await insertRitual({ ...baseRitual, source: 'web' });
    await insertRitual({ ...baseRitual, source: 'email_j45' });
    await insertRitual({ ...baseRitual, source: 'import_csv' });
    const result = await listAdminRituals({
      status: 'all',
      sources: ['email_j45', 'import_csv'],
    });
    expect(result.rows).toHaveLength(2);
  });

  it('filtre par status liste (archived view)', async () => {
    await insertRitual({ ...baseRitual, status: 'PENDING' });
    await insertRitual({ ...baseRitual, status: 'REJECTED' });
    await insertRitual({ ...baseRitual, status: 'HIDDEN' });
    const result = await listAdminRituals({
      status: ['REJECTED', 'HIDDEN'],
    });
    expect(result.rows).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('filtre par authorQuery (case-insensitive)', async () => {
    await insertRitual({ ...baseRitual, authorFirstName: 'Amal' });
    await insertRitual({ ...baseRitual, authorFirstName: 'Souad' });
    const result = await listAdminRituals({
      status: 'all',
      authorQuery: 'AmA',
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.authorFirstName).toBe('Amal');
  });

  it('filtre par verified', async () => {
    await insertRitual({ ...baseRitual, verifiedPurchase: true });
    await insertRitual({ ...baseRitual, verifiedPurchase: false });
    const verified = await listAdminRituals({ status: 'all', verified: true });
    expect(verified.rows).toHaveLength(1);
    expect(verified.rows[0]!.verifiedPurchase).toBe(true);
    const all = await listAdminRituals({ status: 'all', verified: null });
    expect(all.rows.length).toBeGreaterThanOrEqual(2);
  });
});

describe('approveRitual', () => {
  it('passe en APPROVED et écrit un audit', async () => {
    const r = await insertRitual({ ...baseRitual, status: 'PENDING' });
    const updated = await approveRitual(r.id, { actorId: 'admin-1' });
    expect(updated.status).toBe('APPROVED');
    expect(updated.publishedAt).toBeInstanceOf(Date);

    const audit = await listAuditEntries(r.id);
    expect(audit.some((a) => a.action === 'approved')).toBe(true);
  });
});

describe('rejectRitual', () => {
  it('passe en REJECTED avec note', async () => {
    const r = await insertRitual({ ...baseRitual, status: 'PENDING' });
    const updated = await rejectRitual(r.id, { actorId: 'admin-1' }, 'doublon');
    expect(updated.status).toBe('REJECTED');
    expect(updated.moderationNote).toBe('doublon');

    const audit = await listAuditEntries(r.id);
    expect(audit.some((a) => a.action === 'rejected' && a.note === 'doublon')).toBe(true);
  });
});

describe('hideRitual', () => {
  it('passe en HIDDEN avec note', async () => {
    const r = await insertRitual({ ...baseRitual, status: 'APPROVED', publishedAt: new Date() });
    const updated = await hideRitual(r.id, { actorId: 'admin-1' }, 'erreur découverte');
    expect(updated.status).toBe('HIDDEN');
  });
});

describe('restoreRitual', () => {
  it('depuis HIDDEN remet APPROVED', async () => {
    const r = await insertRitual({ ...baseRitual, status: 'HIDDEN' });
    const updated = await restoreRitual(r.id, { actorId: 'admin-1' });
    expect(updated.status).toBe('APPROVED');
  });
});

describe('getRitualNeighbors', () => {
  async function seedThree() {
    const a = await insertRitual({ ...baseRitual, status: 'PENDING' });
    await new Promise((r) => setTimeout(r, 5));
    const b = await insertRitual({ ...baseRitual, status: 'PENDING' });
    await new Promise((r) => setTimeout(r, 5));
    const c = await insertRitual({ ...baseRitual, status: 'PENDING' });
    return { a, b, c };
  }

  it('élément du milieu a previous et next', async () => {
    const { a, b, c } = await seedThree();
    const res = await getRitualNeighbors(b.id, ['PENDING']);
    expect(res.previousId).toBe(c.id);
    expect(res.nextId).toBe(a.id);
    expect(res.position).toBe(2);
    expect(res.total).toBe(3);
  });

  it('premier (le plus récent) a previousId=null', async () => {
    const { c } = await seedThree();
    const res = await getRitualNeighbors(c.id, ['PENDING']);
    expect(res.previousId).toBeNull();
    expect(res.nextId).not.toBeNull();
    expect(res.position).toBe(1);
  });

  it('dernier (le plus ancien) a nextId=null', async () => {
    const { a } = await seedThree();
    const res = await getRitualNeighbors(a.id, ['PENDING']);
    expect(res.nextId).toBeNull();
    expect(res.previousId).not.toBeNull();
    expect(res.position).toBe(3);
  });

  it('rituel seul', async () => {
    const r = await insertRitual({ ...baseRitual, status: 'PENDING' });
    const res = await getRitualNeighbors(r.id, ['PENDING']);
    expect(res.previousId).toBeNull();
    expect(res.nextId).toBeNull();
    expect(res.position).toBe(1);
    expect(res.total).toBe(1);
  });

  it('status différent → file vide', async () => {
    const r = await insertRitual({ ...baseRitual, status: 'PENDING' });
    const res = await getRitualNeighbors(r.id, ['APPROVED']);
    expect(res.position).toBe(0);
    expect(res.total).toBe(0);
  });

  it('multi-status fusionne la file (archived view)', async () => {
    await insertRitual({ ...baseRitual, status: 'REJECTED' });
    const r = await insertRitual({ ...baseRitual, status: 'HIDDEN' });
    const res = await getRitualNeighbors(r.id, ['REJECTED', 'HIDDEN']);
    expect(res.total).toBe(2);
  });
});

describe('setFeatured', () => {
  it('toggle featured', async () => {
    const r = await insertRitual({ ...baseRitual, status: 'APPROVED', publishedAt: new Date() });
    const res = await setFeatured(r.id, { actorId: 'admin-1' }, true);
    expect(res.total_featured).toBe(1);
    const fresh = await getAdminRitualById(r.id);
    expect(fresh?.featured).toBe(true);
  });

  it('refuse au-delà de 3 featured', async () => {
    const a = await insertRitual({ ...baseRitual, status: 'APPROVED', publishedAt: new Date() });
    const b = await insertRitual({ ...baseRitual, status: 'APPROVED', publishedAt: new Date() });
    const c = await insertRitual({ ...baseRitual, status: 'APPROVED', publishedAt: new Date() });
    const d = await insertRitual({ ...baseRitual, status: 'APPROVED', publishedAt: new Date() });
    await setFeatured(a.id, { actorId: 'admin-1' }, true);
    await setFeatured(b.id, { actorId: 'admin-1' }, true);
    await setFeatured(c.id, { actorId: 'admin-1' }, true);
    await expect(setFeatured(d.id, { actorId: 'admin-1' }, true)).rejects.toThrow(
      'FEATURED_LIMIT_REACHED',
    );
  });
});
