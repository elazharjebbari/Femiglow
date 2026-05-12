import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore, memoryStore } from '@/lib/db/client';
import { insertRitual } from '@/lib/db/queries/rituals';
import { applyBulkAction, BulkLimitError } from './bulk';

beforeEach(() => {
  delete process.env.DATABASE_URL;
  resetMemoryStore();
});

afterEach(() => {
  resetMemoryStore();
});

async function seedN(count: number, status: 'PENDING' | 'APPROVED' = 'PENDING') {
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const r = await insertRitual({
      productKey: 'pack-femiglow',
      body: `Body ${i}` + 'a'.repeat(60),
      wouldRecommend: 'oui',
      source: 'web',
      status,
      publishedAt: status === 'APPROVED' ? new Date() : null,
    });
    ids.push(r.id);
  }
  return ids;
}

describe('applyBulkAction', () => {
  it('bulk approve 5 PENDING → 5 succeeded', async () => {
    const ids = await seedN(5, 'PENDING');
    const result = await applyBulkAction(
      { action: 'approve', ids },
      { actorId: 'admin-1' },
    );
    expect(result.totalSucceeded).toBe(5);
    expect(result.totalFailed).toBe(0);
    const approved = Array.from(memoryStore().ritualTestimonials.values()).filter(
      (r) => r.status === 'APPROVED',
    );
    expect(approved).toHaveLength(5);
  });

  it('bulk reject nécessite une note', async () => {
    const ids = await seedN(2);
    await expect(
      applyBulkAction({ action: 'reject', ids }, { actorId: 'admin-1' }),
    ).rejects.toThrow(/Note requise/);
  });

  it('bulk reject avec note → REJECTED', async () => {
    const ids = await seedN(3);
    const result = await applyBulkAction(
      { action: 'reject', ids, note: 'doublon import' },
      { actorId: 'admin-1' },
    );
    expect(result.totalSucceeded).toBe(3);
    const rejected = Array.from(memoryStore().ritualTestimonials.values()).filter(
      (r) => r.status === 'REJECTED',
    );
    expect(rejected.every((r) => r.moderationNote === 'doublon import')).toBe(true);
  });

  it('bulk feature limite à 3 → 4ème skipped', async () => {
    const ids = await seedN(4, 'APPROVED');
    const result = await applyBulkAction(
      { action: 'feature', ids },
      { actorId: 'admin-1' },
    );
    expect(result.totalSucceeded).toBe(3);
    expect(result.totalSkipped).toBe(1);
    expect(result.skipped[0]?.reason).toBe('featured_limit');
  });

  it('id inexistant → failed (continue)', async () => {
    const ids = await seedN(2);
    const result = await applyBulkAction(
      { action: 'approve', ids: [...ids, 'rt_inexistant'] },
      { actorId: 'admin-1' },
    );
    expect(result.totalSucceeded).toBe(2);
    expect(result.totalFailed).toBe(1);
    expect(result.failed[0]?.error).toBe('not_found');
  });

  it('au-delà de 1000 ids → BulkLimitError', async () => {
    const ids = Array.from({ length: 1001 }, (_, i) => `rt_${i}`);
    await expect(
      applyBulkAction({ action: 'approve', ids }, { actorId: 'admin-1' }),
    ).rejects.toThrow(BulkLimitError);
  });

  it('liste vide → totaux à 0', async () => {
    const result = await applyBulkAction(
      { action: 'approve', ids: [] },
      { actorId: 'admin-1' },
    );
    expect(result.totalProcessed).toBe(0);
    expect(result.totalSucceeded).toBe(0);
  });

  it('audit global écrit avec action bulk_approve', async () => {
    const ids = await seedN(2);
    await applyBulkAction(
      { action: 'approve', ids },
      { actorId: 'admin-1' },
    );
    const audit = Array.from(memoryStore().ritualAuditLog.values());
    expect(audit.some((e) => e.action === 'bulk_approve')).toBe(true);
  });

  it('audit individuel + global', async () => {
    const ids = await seedN(2);
    await applyBulkAction(
      { action: 'approve', ids },
      { actorId: 'admin-1' },
    );
    const audit = Array.from(memoryStore().ritualAuditLog.values());
    // 2 audits "approved" + 1 audit "bulk_approve"
    expect(audit.filter((e) => e.action === 'approved')).toHaveLength(2);
    expect(audit.filter((e) => e.action === 'bulk_approve')).toHaveLength(1);
  });
});
