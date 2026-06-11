// @vitest-environment node
/**
 * OWBS — Intégration pglite de `lead_event_outbox` : exerce le VRAI chemin SQL
 * (enqueue idempotent, claim FOR UPDATE SKIP LOCKED, reschedule/dead, drain).
 * cf. docs/checkout-leads-background-2026-06-01/04-tests/vitest-plan.md
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';

import { __resetTestDb, __setTestDb } from '@/lib/db/client';
import { rowsOf } from '@/lib/db/exec';
import { leadOutboxRepo } from './lead-outbox-repo';
import { pickAndProcessBatch } from './lead-outbox-processor';
import { __clearLeadEffectHandlers, registerLeadEffectHandler } from './handlers';

let client: PGlite;
let db: ReturnType<typeof drizzlePglite>;

const MIGRATION = resolve(
  process.cwd(),
  'drizzle/migrations/0079_owbs_lead_event_outbox.sql',
);

beforeAll(async () => {
  client = new PGlite();
  db = drizzlePglite(client);
  __setTestDb(db as unknown as Parameters<typeof __setTestDb>[0]);
  const file = readFileSync(MIGRATION, 'utf8');
  for (const stmt of file
    .split(/^\s*-->\s*statement-breakpoint\s*$/im)
    .map((s) => s.trim())
    .filter(Boolean)) {
    await client.exec(stmt);
  }
});

afterAll(() => {
  __resetTestDb();
});

beforeEach(async () => {
  await client.exec('TRUNCATE lead_event_outbox');
  __clearLeadEffectHandlers();
});

async function countByStatus(status: string): Promise<number> {
  const r = await db.execute(
    sql`SELECT count(*)::int AS n FROM lead_event_outbox WHERE status = ${status}`,
  );
  const rows = rowsOf(r as unknown as { rows: { n: number }[] }) as { n: number }[];
  return Number(rows[0]?.n ?? 0);
}

describe('lead_event_outbox — intégration pglite (OWBS P2)', () => {
  // TST-I-05
  it('enqueue + pickBatch : la row dûe est claimée en `processing`', async () => {
    await leadOutboxRepo.enqueue({ type: 'purchase_capi', leadId: 'cl_aaaaaaaaaaaaaaaaaaaa', dedupeKey: 'k1' });
    const picked = await leadOutboxRepo.pickBatch(10);
    expect(picked).toHaveLength(1);
    expect(picked[0]!.leadId).toBe('cl_aaaaaaaaaaaaaaaaaaaa');
    expect(await countByStatus('processing')).toBe(1);
  });

  // TST-I-08
  it('enqueue idempotent : double (type,leadId,dedupeKey) → 1 seule row', async () => {
    await leadOutboxRepo.enqueue({ type: 'purchase_capi', leadId: 'cl_aaaaaaaaaaaaaaaaaaaa', dedupeKey: 'dup' });
    await leadOutboxRepo.enqueue({ type: 'purchase_capi', leadId: 'cl_aaaaaaaaaaaaaaaaaaaa', dedupeKey: 'dup' });
    expect(await countByStatus('pending')).toBe(1);
  });

  // TST-I-06 (claim disjoint : pglite mono-connexion → on vérifie l'invariant
  // « une row claimée n'est pas re-claimée »).
  it('pickBatch claime des sous-ensembles disjoints (pas de double-claim)', async () => {
    await leadOutboxRepo.enqueue({ type: 'purchase_capi', leadId: 'cl_aaaaaaaaaaaaaaaaaaaa', dedupeKey: 'a' });
    await leadOutboxRepo.enqueue({ type: 'purchase_ga4', leadId: 'cl_aaaaaaaaaaaaaaaaaaaa', dedupeKey: 'b' });
    const first = await leadOutboxRepo.pickBatch(1);
    expect(first).toHaveLength(1);
    const second = await leadOutboxRepo.pickBatch(10);
    expect(second).toHaveLength(1); // l'autre row seulement
    expect(second[0]!.id).not.toBe(first[0]!.id);
  });

  // TST-I-07
  it('reschedule : backoff (pending, attempts++) puis dead après max_attempts', async () => {
    await leadOutboxRepo.enqueue({ type: 'order_webhook', leadId: 'cl_bbbbbbbbbbbbbbbbbbbb', dedupeKey: 'r' });
    const [row] = await leadOutboxRepo.pickBatch(10);
    const r1 = await leadOutboxRepo.reschedule(row!, new Error('boom'));
    expect(r1.dead).toBe(false);
    expect(r1.attempts).toBe(1);
    expect(await countByStatus('pending')).toBe(1);

    // Force l'atteinte de max_attempts (8) → dead.
    const r2 = await leadOutboxRepo.reschedule(
      { id: row!.id, attempts: 7, maxAttempts: 8, nextAttemptAt: row!.nextAttemptAt },
      new Error('boom'),
    );
    expect(r2.dead).toBe(true);
    expect(await countByStatus('dead')).toBe(1);
  });

  // TST-I-10
  it('pickAndProcessBatch : handler OK → done ; handler KO → reschedule', async () => {
    const ok = vi.fn().mockResolvedValue(undefined);
    const ko = vi.fn().mockRejectedValue(new Error('handler failed'));
    registerLeadEffectHandler('purchase_capi', ok);
    registerLeadEffectHandler('order_webhook', ko);

    await leadOutboxRepo.enqueue({ type: 'purchase_capi', leadId: 'cl_cccccccccccccccccccc', dedupeKey: 'ok' });
    await leadOutboxRepo.enqueue({ type: 'order_webhook', leadId: 'cl_cccccccccccccccccccc', dedupeKey: 'ko' });

    const res = await pickAndProcessBatch();
    expect(res.picked).toBe(2);
    expect(res.done).toBe(1);
    expect(res.rescheduled).toBe(1);
    expect(ok).toHaveBeenCalledOnce();
    expect(ko).toHaveBeenCalledOnce();
    expect(await countByStatus('done')).toBe(1);
    expect(await countByStatus('pending')).toBe(1); // le KO est revenu en pending
  });

  // Garde-fou : type sans handler → reschedule (pas de crash).
  it('type sans handler enregistré → reschedule (jamais done)', async () => {
    await leadOutboxRepo.enqueue({ type: 'lead_capi', leadId: 'cl_dddddddddddddddddddd', dedupeKey: 'x' });
    const res = await pickAndProcessBatch();
    expect(res.done).toBe(0);
    expect(res.rescheduled).toBe(1);
  });
});
