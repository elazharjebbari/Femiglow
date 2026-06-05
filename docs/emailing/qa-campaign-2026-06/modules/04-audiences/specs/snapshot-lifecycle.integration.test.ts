/**
 * AUD-SNAP-* / AUD-PRE-* / AUD-PURGE-* — Cycle de vie du snapshot contre une
 * VRAIE Postgres de test.
 *
 * Couvre : happy path (running→done), matérialisation exacte des membres,
 * erreur (errored), idempotence par snapshotKey, ZOMBIE running (écart
 * A-AUD-4), preview taille/échantillon, purge.
 *
 * Préconditions : DATABASE_URL_TEST → femiglow_test, migrations appliquées.
 * NB chemin : à déposer sous apps/web/src/lib/mail/audiences/.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';

import { testSql, truncateEmailTables } from '@/test/db/setup';
import { db as getDb } from '@/lib/db/client';
import { leads } from '@/lib/db/schema';
import { emailAudience, emailAudienceSnapshot, emailAudienceSnapshotMember } from '@/lib/db/schema-emails';
import { snapshotAudience } from '@/lib/mail/audiences/snapshot';
import { previewAudienceSize, previewAudienceSample } from '@/lib/mail/audiences/preview';
import { purgeExpiredSnapshots } from '@/lib/mail/audiences/purge';

vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

function db() {
  const d = getDb();
  if (!d) throw new Error('DB de test non configurée');
  return d;
}

const consentRules = { kind: 'all', conditions: [{ kind: 'consent_marketing', value: true }] };
const defaultExcl = { hard_bounce: true, unsubscribe: true, manual_suppression: true, marketing_optout: false };

async function seedLeads() {
  await db().insert(leads).values([
    { id: 'A', email: 'a@exemple.test', name: 'Amina', consentMarketing: true },
    { id: 'B', email: 'b@exemple.test', name: 'Btissam', consentMarketing: true },
    { id: 'C', email: 'c@exemple.test', name: 'Chaimae', consentMarketing: false },
  ]);
}

async function seedAudience(id = randomUUID(), rules: unknown = consentRules) {
  await db().insert(emailAudience).values({
    id,
    slug: `aud-${id.slice(0, 8)}`,
    name: 'Audience test',
    rules,
    exclusionFlags: defaultExcl,
    createdBy: 'nadia@femiglow-maroc.com',
  });
  return id;
}

beforeAll(() => {
  process.env.MAIL_FROM = 'info@femiglow-maroc.com';
});
beforeEach(async () => {
  await truncateEmailTables();
  await testSql`TRUNCATE leads RESTART IDENTITY CASCADE`;
  await seedLeads();
});
afterAll(async () => {
  await testSql.end({ timeout: 5 });
});

// ── Cycle nominal + matérialisation ─────────────────────────────────────
describe('snapshotAudience — cycle nominal', () => {
  it('AUD-SNAP-001/002 : running→done, membres = exactement les leads consentants (A,B)', async () => {
    const audId = await seedAudience();
    const res = await snapshotAudience(audId);
    expect(res.status).toBe('done');
    expect(res.size).toBe(2);

    const members = (await db()
      .select({ email: emailAudienceSnapshotMember.email })
      .from(emailAudienceSnapshotMember)
      .where(eq(emailAudienceSnapshotMember.snapshotId, res.snapshotId))) as Array<{ email: string }>;
    expect(members.map((m) => m.email).sort()).toEqual(['a@exemple.test', 'b@exemple.test']);

    const [snap] = await db().select().from(emailAudienceSnapshot)
      .where(eq(emailAudienceSnapshot.id, res.snapshotId)).limit(1);
    expect(snap?.status).toBe('done');
    expect(snap?.completedAt).not.toBeNull();
  });

  it('AUD-SNAP-009 : metadata source+campaignId persistés', async () => {
    const audId = await seedAudience();
    const res = await snapshotAudience(audId, { source: 'campaign', campaignId: 'camp-42' });
    const [snap] = await db().select().from(emailAudienceSnapshot)
      .where(eq(emailAudienceSnapshot.id, res.snapshotId)).limit(1);
    expect(snap?.metadata).toMatchObject({ source: 'campaign', campaignId: 'camp-42' });
  });

  it('AUD-SNAP-010 : purgeableAfter ≈ now + 90j', async () => {
    const audId = await seedAudience();
    const res = await snapshotAudience(audId);
    const [snap] = await db().select().from(emailAudienceSnapshot)
      .where(eq(emailAudienceSnapshot.id, res.snapshotId)).limit(1);
    const deltaDays = (new Date(snap!.purgeableAfter).getTime() - Date.now()) / 86_400_000;
    expect(deltaDays).toBeGreaterThan(88);
    expect(deltaDays).toBeLessThan(92);
  });

  it('AUD-SNAP-008 : audience inexistante → throw', async () => {
    await expect(snapshotAudience(randomUUID())).rejects.toThrow(/not found|deleted/i);
  });

  it('AUD-SNAP-007 : audience soft-deleted → throw', async () => {
    const audId = await seedAudience();
    await db().update(emailAudience).set({ deletedAt: new Date() }).where(eq(emailAudience.id, audId));
    await expect(snapshotAudience(audId)).rejects.toThrow(/deleted/i);
  });
});

// ── Erreur de compilation ───────────────────────────────────────────────
describe('snapshotAudience — erreur', () => {
  it('AUD-SNAP-003 : règles profondeur 5 → status=errored + erroredReason', async () => {
    const deep5 = { kind: 'all', conditions: [{ kind: 'all', conditions: [{ kind: 'all', conditions: [
      { kind: 'all', conditions: [{ kind: 'all', conditions: [{ kind: 'has_tag', tag: 'x' }] }] }] }] }] };
    const audId = await seedAudience(randomUUID(), deep5);
    const res = await snapshotAudience(audId);
    expect(res.status).toBe('errored');
    expect(res.erroredReason).toMatch(/max depth/i);
    const [snap] = await db().select().from(emailAudienceSnapshot)
      .where(eq(emailAudienceSnapshot.id, res.snapshotId)).limit(1);
    expect(snap?.status).toBe('errored');
    expect(snap?.erroredAt).not.toBeNull();
  });
});

// ── Idempotence + ZOMBIE (écart A-AUD-4) ────────────────────────────────
describe('snapshotAudience — idempotence & zombie', () => {
  it('AUD-SNAP-004 : même snapshotKey renvoie l’existant sans réinsérer', async () => {
    const audId = await seedAudience();
    const first = await snapshotAudience(audId, { snapshotKey: 'campaign-aid' });
    const second = await snapshotAudience(audId, { snapshotKey: 'campaign-aid' });
    expect(second.snapshotId).toBe(first.snapshotId);
    // Une seule ligne snapshot pour cette clé.
    const all = await db().select().from(emailAudienceSnapshot)
      .where(eq(emailAudienceSnapshot.audienceId, audId));
    expect(all).toHaveLength(1);
  });

  it('AUD-SNAP-005/006 : zombie running → re-snapshot même key RENVOIE le zombie (BUG A-AUD-4)', async () => {
    const audId = await seedAudience();
    // On fabrique un snapshot ZOMBIE : inséré en running, jamais complété
    // (crash simulé). size=0, aucun membre.
    const zombieId = randomUUID();
    await db().insert(emailAudienceSnapshot).values({
      id: zombieId,
      audienceId: audId,
      snapshotKey: 'campaign-aid',
      status: 'running',
      size: 0,
      rulesSnapshot: consentRules,
      exclusionSnapshot: defaultExcl,
      metadata: { source: 'campaign' },
      purgeableAfter: new Date(Date.now() + 90 * 86_400_000),
    });

    // Re-snapshot avec la même clé : l'idempotence actuelle ne vérifie PAS le
    // statut → renvoie le zombie running inutilisable.
    const res = await snapshotAudience(audId, { snapshotKey: 'campaign-aid' });
    expect(res.snapshotId).toBe(zombieId);
    expect(res.status).toBe('running'); // BUG : zombie renvoyé
    expect(res.size).toBe(0);           // BUG : envoi vide garanti

    // ORACLE CIBLE (à activer après correctif) :
    //   expect(res.status).toBe('done');
    //   expect(res.snapshotId).not.toBe(zombieId);
  });
});

// ── Preview ─────────────────────────────────────────────────────────────
describe('preview', () => {
  it('AUD-PRE-001 : previewAudienceSize compte exactement les leads matchant', async () => {
    const { size } = await previewAudienceSize(consentRules as never, defaultExcl as never);
    expect(size).toBe(2); // A, B consentants
  });

  it('AUD-PRE-003 : previewAudienceSample limite l’échantillon et renvoie le total', async () => {
    const { samples, size } = await previewAudienceSample(consentRules as never, defaultExcl as never, 1);
    expect(samples).toHaveLength(1);
    expect(size).toBe(2);
  });
});

// ── Purge ───────────────────────────────────────────────────────────────
describe('purge', () => {
  it('AUD-PURGE-001 : purge supprime les snapshots expirés, conserve les récents', async () => {
    const audId = await seedAudience();
    // Snapshot expiré
    await db().insert(emailAudienceSnapshot).values({
      id: randomUUID(), audienceId: audId, status: 'done', size: 2,
      rulesSnapshot: consentRules, exclusionSnapshot: defaultExcl, metadata: {},
      purgeableAfter: new Date(Date.now() - 86_400_000),
    });
    // Snapshot récent
    const keepId = randomUUID();
    await db().insert(emailAudienceSnapshot).values({
      id: keepId, audienceId: audId, status: 'done', size: 2,
      rulesSnapshot: consentRules, exclusionSnapshot: defaultExcl, metadata: {},
      purgeableAfter: new Date(Date.now() + 86_400_000),
    });

    const res = await purgeExpiredSnapshots();
    expect(res).toBeDefined();
    const remaining = await db().select().from(emailAudienceSnapshot)
      .where(eq(emailAudienceSnapshot.audienceId, audId));
    expect(remaining.map((s) => s.id)).toEqual([keepId]);
  });
});
