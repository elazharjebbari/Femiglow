// @vitest-environment node
/**
 * UX4-AUDIENCES-007 — listSnapshotMembers (vraie DB).
 *
 * Oracle métier : GET snapshot members renvoie les email_audience_snapshot_member
 * paginés (tri stable par email, total exact, limit/offset bornés), et
 * snapshotMembersToCsv sérialise email+name. Membres créés via makeSnapshotMember.
 *
 * IDs : AUD-MEM-001..005 (module 04-audiences, surface snapshot members).
 *
 * Lancement (DB dédiée) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_m04audiences#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *     src/lib/mail/audiences/__qa__/snapshot-members.integration.test.ts
 */
import { afterAll, beforeEach, expect, it } from 'vitest';

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
import {
  listSnapshotMembers,
  snapshotMembersToCsv,
} from '../snapshot-members';

const db = new Proxy({} as ReturnType<typeof emailsTestDb>, {
  get: (_t, prop) => (emailsTestDb() as never)[prop],
});

const VALID_RULES = { kind: 'all', conditions: [{ kind: 'has_tag', tag: 'acheteuse' }] };
const NO_EXCL = {
  hard_bounce: true,
  unsubscribe: true,
  manual_suppression: true,
  marketing_optout: false,
};

let slugCounter = 0;
async function makeAudienceRow(): Promise<string> {
  slugCounter += 1;
  const [row] = await db
    .insert(emailAudience)
    .values({
      slug: `mem-${Date.now().toString(36)}-${slugCounter}`,
      name: 'Membres test',
      rules: VALID_RULES as unknown as object,
      exclusionFlags: NO_EXCL as unknown as object,
      createdBy: 'admin_test',
    })
    .returning();
  return row!.id;
}

async function makeSnapshotRow(audienceId: string): Promise<string> {
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

async function seedMembers(snapshotId: string, emails: string[]) {
  await db.insert(emailAudienceSnapshotMember).values(
    emails.map((email) =>
      makeSnapshotMember({ snapshotId, email, payload: { name: `Nom-${email}` } }),
    ),
  );
}

describeEmailsDb('audiences/snapshot-members — lecture paginée (vraie DB)', () => {
  beforeEach(truncateEmailTables);
  afterAll(closeTestDb);

  // AUD-MEM-001 — total exact + membres triés par email.
  it('renvoie les membres paginés avec total exact et tri par email', async () => {
    const aud = await makeAudienceRow();
    const snap = await makeSnapshotRow(aud);
    await seedMembers(snap, ['c@x.test', 'a@x.test', 'b@x.test']);

    const { members, total } = await listSnapshotMembers(snap, { limit: 50, offset: 0 });
    expect(total).toBe(3);
    expect(members.map((m) => m.email)).toEqual(['a@x.test', 'b@x.test', 'c@x.test']);
  });

  // AUD-MEM-002 — pagination : limit + offset.
  it('respecte limit et offset', async () => {
    const aud = await makeAudienceRow();
    const snap = await makeSnapshotRow(aud);
    await seedMembers(snap, ['a@x.test', 'b@x.test', 'c@x.test', 'd@x.test']);

    const page1 = await listSnapshotMembers(snap, { limit: 2, offset: 0 });
    expect(page1.total).toBe(4);
    expect(page1.members.map((m) => m.email)).toEqual(['a@x.test', 'b@x.test']);

    const page2 = await listSnapshotMembers(snap, { limit: 2, offset: 2 });
    expect(page2.members.map((m) => m.email)).toEqual(['c@x.test', 'd@x.test']);
  });

  // AUD-MEM-003 — isolation : ne renvoie QUE les membres du snapshot demandé.
  it('n inclut pas les membres d un autre snapshot', async () => {
    const aud = await makeAudienceRow();
    const snapA = await makeSnapshotRow(aud);
    const snapB = await makeSnapshotRow(aud);
    await seedMembers(snapA, ['a@x.test', 'b@x.test']);
    await seedMembers(snapB, ['z@x.test']);

    const { members, total } = await listSnapshotMembers(snapA);
    expect(total).toBe(2);
    expect(members.every((m) => m.email !== 'z@x.test')).toBe(true);
  });

  // AUD-MEM-004 — snapshot sans membre → liste vide, total 0.
  it('renvoie une liste vide pour un snapshot sans membre', async () => {
    const aud = await makeAudienceRow();
    const snap = await makeSnapshotRow(aud);
    const { members, total } = await listSnapshotMembers(snap);
    expect(total).toBe(0);
    expect(members).toEqual([]);
  });

  // AUD-MEM-005 — export CSV : header + email + name (depuis payload).
  it('sérialise en CSV (header + email + name du payload)', async () => {
    const aud = await makeAudienceRow();
    const snap = await makeSnapshotRow(aud);
    await seedMembers(snap, ['a@x.test', 'b@x.test']);

    const { members } = await listSnapshotMembers(snap);
    const csv = snapshotMembersToCsv(members);
    const lines = csv.split('\n');
    expect(lines[0]).toBe('email,name');
    expect(lines).toContain('a@x.test,Nom-a@x.test');
    expect(lines).toContain('b@x.test,Nom-b@x.test');
  });
});
