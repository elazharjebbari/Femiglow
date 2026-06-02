// @vitest-environment node
/**
 * OWBS F11 — supervision opérateur de l'outbox (counts / listByStatus / replay),
 * exercé en vrai SQL via pglite.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';

import { __resetTestDb, __setTestDb } from '@/lib/db/client';
import { leadOutboxRepo } from './lead-outbox-repo';

let client: PGlite;
const MIGRATION = resolve(process.cwd(), 'drizzle/migrations/0079_owbs_lead_event_outbox.sql');

beforeAll(async () => {
  client = new PGlite();
  __setTestDb(drizzlePglite(client) as unknown as Parameters<typeof __setTestDb>[0]);
  const file = readFileSync(MIGRATION, 'utf8');
  for (const stmt of file.split(/^\s*-->\s*statement-breakpoint\s*$/im).map((s) => s.trim()).filter(Boolean)) {
    await client.exec(stmt);
  }
});
afterAll(() => __resetTestDb());
beforeEach(async () => {
  await client.exec('TRUNCATE lead_event_outbox');
});

async function seedStatus(id: string, status: string, leadId = 'cl_aaaaaaaaaaaaaaaaaaaa') {
  await client.exec(
    `INSERT INTO lead_event_outbox (id,type,lead_id,dedupe_key,status,attempts,max_attempts) VALUES ('${id}','order_webhook','${leadId}','${id}','${status}',8,8)`,
  );
}

describe('lead-outbox supervision (OWBS F11)', () => {
  it('counts — agrège par statut (pending/processing/done/dead)', async () => {
    await seedStatus('lox_p1', 'pending');
    await seedStatus('lox_p2', 'pending');
    await seedStatus('lox_d1', 'dead');
    const c = await leadOutboxRepo.counts();
    expect(c.pending).toBe(2);
    expect(c.dead).toBe(1);
    expect(c.done).toBe(0);
  });

  it('listByStatus — liste les dead (récents d\'abord)', async () => {
    await seedStatus('lox_d1', 'dead');
    await seedStatus('lox_d2', 'dead');
    await seedStatus('lox_ok', 'done');
    const dead = await leadOutboxRepo.listByStatus('dead', 10);
    expect(dead).toHaveLength(2);
    expect(dead.every((r) => r.status === 'dead')).toBe(true);
  });

  it('replay — un dead repasse pending (attempts=0) ; un non-dead est refusé', async () => {
    await seedStatus('lox_dead', 'dead');
    await seedStatus('lox_done', 'done');

    expect(await leadOutboxRepo.replay('lox_dead')).toBe(true);
    const [row] = await leadOutboxRepo.listByStatus('pending', 10);
    expect(row?.id).toBe('lox_dead');
    expect(row?.attempts).toBe(0);
    expect(row?.lastError).toBeNull();

    // non-dead → refusé (anti-erreur)
    expect(await leadOutboxRepo.replay('lox_done')).toBe(false);
    // id inexistant → refusé
    expect(await leadOutboxRepo.replay('lox_nope')).toBe(false);
  });
});
