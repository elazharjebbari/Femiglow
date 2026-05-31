import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import { insertAuditEvent, insertRitual } from './rituals';
import { getExtendedInsights } from './rituals-insights';

beforeEach(() => {
  delete process.env.DATABASE_URL;
  resetMemoryStore();
});
afterEach(() => resetMemoryStore());

const baseRitual = {
  productKey: 'pack-femiglow',
  body: 'Trois mois et l’ongle a retrouvé sa nervure tranquillement.',
  wouldRecommend: 'oui' as const,
  source: 'web' as const,
};

describe('getExtendedInsights', () => {
  it('retourne windowDays jours dans daily', async () => {
    const r = await getExtendedInsights(7);
    expect(r.daily).toHaveLength(7);
    expect(r.daily.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.date))).toBe(true);
  });

  it('compte submissions aujourd\'hui', async () => {
    await insertRitual({ ...baseRitual });
    await insertRitual({ ...baseRitual });
    const r = await getExtendedInsights(30);
    const today = new Date().toISOString().slice(0, 10);
    const todayBucket = r.daily.find((d) => d.date === today);
    expect(todayBucket?.submissions).toBeGreaterThanOrEqual(2);
  });

  it('compte approvals via audit log', async () => {
    const a = await insertRitual({ ...baseRitual });
    await insertAuditEvent({ testimonialId: a.id, action: 'approved', actorId: 'admin' });
    const r = await getExtendedInsights(30);
    const today = new Date().toISOString().slice(0, 10);
    expect(r.daily.find((d) => d.date === today)?.approvals).toBeGreaterThanOrEqual(1);
  });

  it('agrège sources avec taux d\'approbation', async () => {
    await insertRitual({ ...baseRitual, source: 'web', status: 'APPROVED' });
    await insertRitual({ ...baseRitual, source: 'web', status: 'REJECTED' });
    await insertRitual({ ...baseRitual, source: 'email_j45', status: 'APPROVED' });
    const r = await getExtendedInsights(30);
    const web = r.sources.find((s) => s.source === 'web');
    expect(web?.approved).toBe(1);
    expect(web?.rejected).toBe(1);
    expect(web?.approvalRate).toBe(0.5);
    const email = r.sources.find((s) => s.source === 'email_j45');
    expect(email?.approvalRate).toBe(1);
  });

  it('vision ML stats vides si pas de photos', async () => {
    const r = await getExtendedInsights(30);
    expect(r.visionMl.totalPhotos).toBe(0);
    expect(r.visionMl.rejectedFaceRate).toBe(0);
  });
});
