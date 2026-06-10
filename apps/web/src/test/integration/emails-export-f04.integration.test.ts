// @vitest-environment node
/**
 * F04 — export CSV serveur (CKPT-01) : batterie F04-I-001..009, suite VRAIE-DB.
 *
 * Oracles : contrat d'entrée partagé (Zod), auth 401 JSON, BOM UTF-8 en tête
 * de flux, échappement RFC 4180 sur données piégées, KEYSET stable sous
 * insertions concurrentes (aucun saut/doublon des lignes initiales), cap
 * exact + flag capped, Content-Disposition daté, en-têtes no-store, audit.
 *
 * Lancement (DB dédiée) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_f04exp#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run src/test/integration/emails-export-f04.integration.test.ts
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminSession } from '@/lib/auth/session';

const sessionMock: AdminSession = {
  adminId: 'adm_test_f04',
  email: 'admin@femiglow.ma',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 3_600_000,
};
let currentSession: AdminSession | null = sessionMock;
vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: () => Promise.resolve(currentSession),
  requireAdmin: () => Promise.resolve(currentSession),
}));

import { emailOutbox } from '@/lib/db/schema-emails';
import { __setTestDb, __resetTestDb, type DrizzleDb } from '@/lib/db/client';
import {
  closeTestDb,
  emailsTestDb,
  emailsTestSql,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { makeOutboxRow, resetEmailFactories } from '@/test/factories';
import { parseFilters } from '@/lib/mail/transactional/filters-parser';
import {
  countOutboxBounded,
  iterateOutboxForExport,
  listOutboxFiltered,
  EXPORT_MAX_ROWS,
} from '@/lib/mail/transactional/search';
import { CSV_HEADERS } from '@/lib/mail/transactional/csv';
import { POST } from '@/app/api/admin/emails/transactional/export/route';

const T0 = new Date('2026-06-01T10:00:00.000Z');
const at = (i: number) => new Date(T0.getTime() + i * 60_000);

async function seedRows(n: number, over: Partial<Parameters<typeof makeOutboxRow>[0]> = {}) {
  const db = emailsTestDb();
  const rows = Array.from({ length: n }, (_, i) =>
    makeOutboxRow({ status: 'failed', createdAt: at(i), ...over }),
  );
  for (let i = 0; i < rows.length; i += 500) {
    await db.insert(emailOutbox).values(rows.slice(i, i + 500));
  }
  return rows;
}

function callExport(body: unknown): Promise<Response> {
  return POST(
    new Request('http://test.local/api/admin/emails/transactional/export', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

beforeAll(() => {
  __setTestDb(emailsTestDb() as unknown as DrizzleDb);
});
afterAll(async () => {
  __resetTestDb();
  await closeTestDb();
});
beforeEach(async () => {
  currentSession = sessionMock;
  resetEmailFactories();
  await truncateEmailTables();
  await emailsTestSql()`DELETE FROM audit_events WHERE action = 'mail.outbox.export'`;
});

describeEmailsDb('F04 — export CSV serveur (contrat & flux)', () => {
  it('F04-I-001 — body valide (filterState sérialisé client) → 200 CSV avec la ligne d’en-têtes du contrat', async () => {
    await seedRows(3);
    // Les dates voyagent en ISO (JSON) → z.coerce.date du schéma partagé.
    const res = await callExport({
      filters: [
        { key: 'status', value: ['failed'], raw: 'status:failed' },
        { key: 'after', value: '2026-01-01T00:00:00.000Z', raw: 'after:2026-01-01' },
      ],
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    const lines = text.replace(/^﻿/, '').split('\r\n').filter(Boolean);
    expect(lines[0]).toBe(CSV_HEADERS.join(','));
    expect(lines).toHaveLength(1 + 3);
  });

  it('F04-I-002 — non-admin → 401 JSON, AUCUN corps CSV', async () => {
    currentSession = null;
    const res = await callExport({ filters: [] });
    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect((await res.json()).error).toBeDefined();
  });

  it('F04-I-002b — filtre malformé → 422 avec détail', async () => {
    const res = await callExport({ filters: [{ key: 'status', value: ['plop'], raw: 'x' }] });
    expect(res.status).toBe(422);
    expect((await res.json()).issues).toBeDefined();
  });

  it('F04-I-003 — le flux commence par le BOM UTF-8', async () => {
    await seedRows(1);
    const res = await callExport({ filters: [] });
    const buf = new Uint8Array(await res.arrayBuffer());
    expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it('F04-I-004 — données piégées échappées RFC 4180', async () => {
    const db = emailsTestDb();
    await db.insert(emailOutbox).values(
      makeOutboxRow({
        status: 'failed',
        createdAt: at(0),
        subject: 'Bonjour, "vous"',
        toName: 'Ligne\nbrisée',
      }),
    );
    const res = await callExport({ filters: [] });
    const text = await res.text();
    expect(text).toContain('"Bonjour, ""vous"""');
    expect(text).toContain('"Ligne\nbrisée"');
  });

  it('F04-I-005 — KEYSET stable sous insertions concurrentes : ni saut ni doublon des lignes initiales', async () => {
    const db = emailsTestDb();
    const initial = await seedRows(35);
    const initialIds = new Set(initial.map((r) => String(r.id)));

    const seen: string[] = [];
    const gen = iterateOutboxForExport({ filters: [], freetext: undefined }, { chunkSize: 10 });
    let chunkIndex = 0;
    for (;;) {
      const step = await gen.next();
      if (step.done) break;
      seen.push(...step.value.map((r) => String(r.id)));
      // Pendant le stream : on insère DERRIÈRE le curseur (déjà streamé) et
      // DEVANT (pas encore atteint) — les lignes initiales doivent toutes
      // sortir exactement une fois.
      if (chunkIndex === 1) {
        await db.insert(emailOutbox).values([
          makeOutboxRow({ status: 'failed', createdAt: at(2) }), // derrière le curseur
          makeOutboxRow({ status: 'failed', createdAt: at(500) }), // devant
        ]);
      }
      chunkIndex += 1;
    }

    expect(new Set(seen).size).toBe(seen.length); // aucun doublon
    for (const id of initialIds) expect(seen).toContain(id); // aucun saut
  });

  it('F04-I-006 — cap : flux tronqué exactement à maxRows + flag capped (constante route = 100 000)', async () => {
    await seedRows(60);
    const seen: string[] = [];
    const gen = iterateOutboxForExport({ filters: [] }, { maxRows: 50, chunkSize: 20 });
    let final: { streamed: number; capped: boolean } | null = null;
    for (;;) {
      const step = await gen.next();
      if (step.done) {
        final = step.value;
        break;
      }
      seen.push(...step.value.map((r) => String(r.id)));
    }
    expect(seen).toHaveLength(50);
    expect(final).toEqual({ streamed: 50, capped: true });
    // Le count borné s'arrête à bound (pas de COUNT plein).
    expect(await countOutboxBounded({ filters: [] }, 50 + 1)).toBe(51);
    // La route exporte avec le cap du contrat.
    expect(EXPORT_MAX_ROWS).toBe(100_000);
  });

  it('F04-I-006b — la route annonce le cap en EN-TÊTE X-Export-Capped', async () => {
    await seedRows(5);
    const res = await callExport({ filters: [] });
    expect(res.headers.get('x-export-capped')).toBe('false');
  });

  it('F04-I-007 — Content-Disposition daté du jour', async () => {
    const res = await callExport({ filters: [] });
    const today = new Date().toISOString().slice(0, 10);
    expect(res.headers.get('content-disposition')).toBe(
      `attachment; filename="emails-transactionnels-${today}.csv"`,
    );
  });

  it('F04-I-008 — en-têtes : text/csv UTF-8 + no-store', async () => {
    const res = await callExport({ filters: [] });
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('F04-I-009 — audit mail.outbox.export émis avec actor + rows_streamed', async () => {
    await seedRows(4);
    const res = await callExport({ filters: [{ key: 'status', value: ['failed'], raw: 's' }] });
    await res.text(); // consomme le flux (l'audit est émis en fin de stream)
    const rows = await emailsTestSql()<
      { action: string; actor_id: string; meta: { rows_streamed: number; capped: boolean } }[]
    >`SELECT action, actor_id, meta FROM audit_events WHERE action = 'mail.outbox.export'`;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.actor_id).toBe('adm_test_f04');
    expect(rows[0]!.meta.rows_streamed).toBe(4);
    expect(rows[0]!.meta.capped).toBe(false);
  });

  it('F04-I-010a — MÊME ensemble que /search pour le même filtre (compilateur unique)', async () => {
    await seedRows(8, {});
    const db = emailsTestDb();
    await db.insert(emailOutbox).values(makeOutboxRow({ status: 'delivered', createdAt: at(100) }));
    const parsed = parseFilters('status:failed', T0);

    const viaSearch = await listOutboxFiltered({
      filters: parsed.filters,
      pagination: { limit: 1000, offset: 0 },
    });
    const viaExport: string[] = [];
    const gen = iterateOutboxForExport({ filters: parsed.filters });
    for (;;) {
      const step = await gen.next();
      if (step.done) break;
      viaExport.push(...step.value.map((r) => String(r.id)));
    }
    expect(new Set(viaExport)).toEqual(new Set(viaSearch.rows.map((r) => String(r.id))));
  });
});
