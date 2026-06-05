// @vitest-environment node
/**
 * UX4-AUDIENCES-007 (volet route) — GET .../snapshot/[snapshotId]/members
 * (vraie DB). Vérifie le contrat de la NOUVELLE route :
 *  - JSON paginé { members, total, limit, offset } ;
 *  - export CSV (?format=csv) avec content-type + content-disposition ;
 *  - 404 si le snapshot n'appartient PAS à l'audience [id] (anti-fuite).
 *
 * Auth mockée (requireAdmin) ; DB applicative pointée sur la base de test via
 * DATABASE_URL (la route lit getDb() = src/lib/db/client).
 *
 * Lancement :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_m04audiences#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *     src/app/api/admin/emails/audiences/__qa__/snapshot-members-route.integration.test.ts
 */
import { afterAll, beforeEach, expect, vi } from 'vitest';

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ email: 'admin@test', id: 'admin-1' }),
  getAdminSession: vi.fn().mockResolvedValue({ email: 'admin@test', id: 'admin-1' }),
}));

import {
  emailAudience,
  emailAudienceSnapshot,
  emailAudienceSnapshotMember,
} from '@/lib/db/schema-emails';
import {
  closeTestDb,
  describeEmailsDb,
  emailsTestDb,
  truncateEmailTables,
} from '@/test/db/emails-db';
import { makeSnapshotMember } from '@/test/factories/emails.factory';
import { GET } from '../[id]/snapshot/[snapshotId]/members/route';

const db = new Proxy({} as ReturnType<typeof emailsTestDb>, {
  get: (_t, prop) => (emailsTestDb() as never)[prop],
});

const VALID_RULES = { kind: 'all', conditions: [{ kind: 'has_tag', tag: 'x' }] };
const NO_EXCL = {
  hard_bounce: true,
  unsubscribe: true,
  manual_suppression: true,
  marketing_optout: false,
};

let counter = 0;
async function makeAud(): Promise<string> {
  counter += 1;
  const [row] = await db
    .insert(emailAudience)
    .values({
      slug: `route-${Date.now().toString(36)}-${counter}`,
      name: 'Route test',
      rules: VALID_RULES as unknown as object,
      exclusionFlags: NO_EXCL as unknown as object,
      createdBy: 'admin_test',
    })
    .returning();
  return row!.id;
}

async function makeSnap(audienceId: string): Promise<string> {
  const [row] = await db
    .insert(emailAudienceSnapshot)
    .values({
      audienceId,
      status: 'done',
      size: 0,
      rulesSnapshot: VALID_RULES as unknown as object,
      exclusionSnapshot: NO_EXCL as unknown as object,
      purgeableAfter: new Date(Date.now() + 30 * 86_400_000),
    })
    .returning();
  return row!.id;
}

function call(audienceId: string, snapshotId: string, query = '') {
  const url = `http://t/api/admin/emails/audiences/${audienceId}/snapshot/${snapshotId}/members${query}`;
  return GET(new Request(url), { params: { id: audienceId, snapshotId } });
}

describeEmailsDb('GET snapshot members route (vraie DB)', () => {
  beforeEach(truncateEmailTables);
  afterAll(closeTestDb);

  // AUD-MEM-R-001 — JSON paginé.
  it('renvoie les membres en JSON paginé', async () => {
    const aud = await makeAud();
    const snap = await makeSnap(aud);
    await db.insert(emailAudienceSnapshotMember).values([
      makeSnapshotMember({ snapshotId: snap, email: 'a@x.test', payload: { name: 'Alice' } }),
      makeSnapshotMember({ snapshotId: snap, email: 'b@x.test', payload: { name: 'Bob' } }),
    ]);

    const res = await call(aud, snap);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      members: Array<{ email: string; name: string | null }>;
      total: number;
    };
    expect(body.total).toBe(2);
    expect(body.members.map((m) => m.email)).toEqual(['a@x.test', 'b@x.test']);
    expect(body.members[0]!.name).toBe('Alice');
  });

  // AUD-MEM-R-002 — export CSV.
  it('exporte en CSV avec content-type et content-disposition', async () => {
    const aud = await makeAud();
    const snap = await makeSnap(aud);
    await db
      .insert(emailAudienceSnapshotMember)
      .values([makeSnapshotMember({ snapshotId: snap, email: 'a@x.test', payload: { name: 'Alice' } })]);

    const res = await call(aud, snap, '?format=csv');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/csv/);
    expect(res.headers.get('content-disposition')).toMatch(/attachment/);
    const text = await res.text();
    expect(text.split('\n')[0]).toBe('email,name');
    expect(text).toMatch(/a@x\.test,Alice/);
  });

  // AUD-MEM-R-003 — anti-fuite : snapshot d'une AUTRE audience → 404.
  it('renvoie 404 si le snapshot n appartient pas à l audience', async () => {
    const audA = await makeAud();
    const audB = await makeAud();
    const snapB = await makeSnap(audB); // appartient à B

    // On demande snapB via l'URL de A → doit être refusé.
    const res = await call(audA, snapB);
    expect(res.status).toBe(404);
  });
});
