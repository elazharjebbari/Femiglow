import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import { insertRitual } from './rituals';
import {
  approveRitual,
  getAdminRitualById,
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
