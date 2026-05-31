import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetMemoryStore, memoryStore } from '@/lib/db/client';
import { insertAuditEvent, insertRitual } from '@/lib/db/queries/rituals';
import type { RitualAuditEntry } from '@/lib/db/types';
import {
  chainPreviousHash,
  signWithPrevious,
  verifyChain,
} from './audit-signing';

function readAllAuditChronological(): RitualAuditEntry[] {
  return Array.from(memoryStore().ritualAuditLog.values()).sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
  );
}

beforeEach(() => {
  delete process.env.DATABASE_URL;
  process.env.RITUAL_AUDIT_SECRET = 'super-secret-fixture-must-be-16+chars';
  resetMemoryStore();
});
afterEach(() => {
  resetMemoryStore();
  delete process.env.RITUAL_AUDIT_SECRET;
});

describe('signWithPrevious', () => {
  it('génère signature non-vide quand secret configuré', () => {
    const entry = {
      id: 'ral_1',
      testimonialId: null,
      actorId: 'a',
      action: 'created',
      note: null,
      payload: {},
      createdAt: new Date('2026-05-01T10:00:00Z'),
    };
    const { previousHash, signature } = signWithPrevious(entry, null);
    expect(previousHash).toBeNull();
    expect(signature).toMatch(/^[0-9a-f]{64}$/);
  });

  it('signature null sans secret', () => {
    delete process.env.RITUAL_AUDIT_SECRET;
    const entry = {
      id: 'ral_1',
      testimonialId: null,
      actorId: 'a',
      action: 'created',
      note: null,
      payload: {},
      createdAt: new Date('2026-05-01T10:00:00Z'),
    };
    const r = signWithPrevious(entry, null);
    expect(r.signature).toBeNull();
  });

  it('previousHash dépend de l\'entrée précédente', () => {
    const a = {
      id: 'ral_1',
      testimonialId: null,
      actorId: 'a',
      action: 'created',
      note: null,
      payload: {},
      createdAt: new Date('2026-05-01T10:00:00Z'),
      previousHash: null,
      signature: 'sig-a',
    };
    const b = {
      ...a,
      id: 'ral_2',
      action: 'updated',
      createdAt: new Date('2026-05-01T11:00:00Z'),
    };
    const hashA = chainPreviousHash(a);
    const hashB = chainPreviousHash(b);
    expect(hashA).not.toBe(hashB);
    expect(hashA).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('insertAuditEvent + verifyChain (intégration)', () => {
  it('chaîne signée et vérifiable', async () => {
    const r = await insertRitual({
      productKey: 'pack-femiglow',
      body: 'Trois mois et l’ongle a retrouvé sa nervure tranquillement.',
      wouldRecommend: 'oui',
      source: 'web',
    });
    await insertAuditEvent({ testimonialId: r.id, actorId: 'admin', action: 'approved' });
    await new Promise((res) => setTimeout(res, 2));
    await insertAuditEvent({ testimonialId: r.id, actorId: 'admin', action: 'featured_on' });
    await new Promise((res) => setTimeout(res, 2));
    await insertAuditEvent({ testimonialId: r.id, actorId: 'admin', action: 'featured_off' });

    const entries = readAllAuditChronological();
    expect(entries.length).toBeGreaterThanOrEqual(3);
    const v = verifyChain(entries);
    expect(v.valid).toBe(true);
    expect(v.brokenAt).toBeNull();
    expect(v.checked).toBe(entries.length);
  });

  it('détecte un tampering (note modifiée)', async () => {
    const r = await insertRitual({
      productKey: 'pack-femiglow',
      body: 'Trois mois et l’ongle a retrouvé sa nervure tranquillement.',
      wouldRecommend: 'oui',
      source: 'web',
    });
    await insertAuditEvent({ testimonialId: r.id, actorId: 'admin', action: 'approved' });
    await new Promise((res) => setTimeout(res, 2));
    await insertAuditEvent({ testimonialId: r.id, actorId: 'admin', action: 'featured_on' });

    const entries = readAllAuditChronological();
    expect(entries.length).toBeGreaterThanOrEqual(2);
    // Sabotage : modifier la note de la dernière entrée (signée).
    entries[entries.length - 1]!.note = 'tampered';
    const v = verifyChain(entries);
    expect(v.valid).toBe(false);
    expect(v.brokenAt).toBe(entries[entries.length - 1]!.id);
  });
});
