// @vitest-environment node
/**
 * VAGUE 4 — COCKPIT (UX-COCKPIT-001) : route GET/DELETE /suppression — VRAIE-DB.
 *
 * Skip honnête sans DATABASE_URL femiglow_test (`describeEmailsDb`). On insère
 * des lignes via `addSuppression` puis on appelle les route handlers RÉELS
 * (auth admin mockée). Oracles :
 *   - GET liste paginée filtrable email/reason/source + total ;
 *   - DELETE { email } retire la ligne (et l'adresse n'est plus suppressée) ;
 *   - validations Zod (DELETE sans email → 422).
 *
 * Sérialisé (`--no-file-parallelism`) + TRUNCATE en beforeEach. Base dédiée :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_m02cockpit#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *     src/app/api/admin/emails/suppression/__tests__/route.db.ux4.test.ts
 */
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ email: 'admin@test', id: 'admin-1' }),
  getAdminSession: vi.fn().mockResolvedValue({ email: 'admin@test', id: 'admin-1' }),
}));
// L'audit log écrit hors des tables emails (table audit) : on le neutralise.
vi.mock('@/lib/audit/log-event', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

import { __setTestDb, __resetTestDb } from '@/lib/db/client';
import {
  describeEmailsDb,
  emailsTestDb,
  truncateEmailTables,
  closeTestDb,
} from '@/test/db/emails-db';
import { resetEmailFactories } from '@/test/factories/emails.factory';
import { addSuppression, isSuppressed } from '@/lib/mail/suppression';

type ListBody = {
  rows: { email: string; reason: string; source: string }[];
  total: number;
  limit: number;
  offset: number;
};

beforeAll(() => {
  __setTestDb(emailsTestDb() as never);
});

beforeEach(async () => {
  await truncateEmailTables();
  resetEmailFactories();
  vi.clearAllMocks();
});

afterAll(async () => {
  __resetTestDb();
  await closeTestDb();
});

describeEmailsDb('route /suppression (vraie-DB) — UX4-COCKPIT-001/002', () => {
  it('UX4-COCKPIT-002 (GET) : liste paginée filtrable email/reason/source + total', async () => {
    await addSuppression({ email: 'alpha@exemple.test', reason: 'hard_bounce', source: 'stalwart' });
    await addSuppression({ email: 'beta@exemple.test', reason: 'unsubscribe', source: 'manual' });
    await addSuppression({ email: 'gamma@autre.test', reason: 'manual_admin', source: 'manual' });

    const { GET } = await import('../route');

    // Sans filtre : 3.
    let res = await GET(new Request('http://t/x'));
    expect(res.status).toBe(200);
    let body = (await res.json()) as ListBody;
    expect(body.total).toBe(3);
    expect(body.rows).toHaveLength(3);

    // Filtre email (sous-chaîne).
    res = await GET(new Request('http://t/x?q=exemple.test'));
    body = (await res.json()) as ListBody;
    expect(body.total).toBe(2);

    // Filtre reason.
    res = await GET(new Request('http://t/x?reason=hard_bounce'));
    body = (await res.json()) as ListBody;
    expect(body.total).toBe(1);
    expect(body.rows[0]!.email).toBe('alpha@exemple.test');

    // Filtre source.
    res = await GET(new Request('http://t/x?source=manual'));
    body = (await res.json()) as ListBody;
    expect(body.total).toBe(2);

    // Pagination : limit=1 → 1 ligne, total inchangé.
    res = await GET(new Request('http://t/x?limit=1&offset=0'));
    body = (await res.json()) as ListBody;
    expect(body.rows).toHaveLength(1);
    expect(body.total).toBe(3);
    expect(body.limit).toBe(1);
  });

  it('UX4-COCKPIT-002 (GET) : reason invalide → 422', async () => {
    const { GET } = await import('../route');
    const res = await GET(new Request('http://t/x?reason=pas_un_enum'));
    expect(res.status).toBe(422);
  });

  it('UX4-COCKPIT-001 (DELETE) : retire l’adresse → isSuppressed repasse à false', async () => {
    await addSuppression({ email: 'faux.positif@exemple.test', reason: 'hard_bounce', source: 'stalwart' });
    expect(await isSuppressed('faux.positif@exemple.test')).toBe(true);

    const { DELETE } = await import('../route');
    const res = await DELETE(
      new Request('http://t/x', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'faux.positif@exemple.test' }),
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { removed: boolean };
    expect(body.removed).toBe(true);
    expect(await isSuppressed('faux.positif@exemple.test')).toBe(false);
  });

  it('UX4-COCKPIT-001 (DELETE) : adresse absente → removed:false (idempotent)', async () => {
    const { DELETE } = await import('../route');
    const res = await DELETE(
      new Request('http://t/x', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'jamais@exemple.test' }),
      }),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { removed: boolean }).removed).toBe(false);
  });

  it('DELETE sans email → 422 (validation Zod)', async () => {
    const { DELETE } = await import('../route');
    const res = await DELETE(
      new Request('http://t/x', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(422);
  });

  it('DELETE corps non-JSON → 400', async () => {
    const { DELETE } = await import('../route');
    const res = await DELETE(
      new Request('http://t/x', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: 'pas du json',
      }),
    );
    expect(res.status).toBe(400);
  });
});
