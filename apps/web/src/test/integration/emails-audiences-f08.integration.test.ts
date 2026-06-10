// @vitest-environment node
/**
 * F08 — routes audiences, suite VRAIE-DB :
 *  - F08-I-090/091 : PATCH /audiences/:id ignore tout slug fourni + 422 body invalide ;
 *  - F08-I-094 : preview-size sur statement_timeout (57014) → 504 typé `timeout`
 *    (JAMAIS un 200 avec un faux 0) — l'erreur 57014 est injectée au niveau du
 *    moteur de preview (le déclenchement réel du timeout Postgres est
 *    non-déterministe sur une DB de test minuscule), le mapping route est réel ;
 *  - F08-I-096 : GET members — contrat {members,total,limit,offset} + 404
 *    cross-audience (le snapshot DOIT appartenir à l'audience [id]) ;
 *  - F08-I-097 : la réponse preview-size RÉELLE parse avec le schéma wire
 *    partagé (même contrat que les fixtures MSW des tests composant).
 *
 * Lancement (DB dédiée) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_m04audiences#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism src/test/integration/emails-audiences-f08.integration.test.ts
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import type { AdminSession } from '@/lib/auth/session';

const sessionMock: AdminSession = {
  adminId: 'adm_test_f08',
  email: 'admin@femiglow.ma',
  issuedAt: Date.now(),
  expiresAt: Date.now() + 3_600_000,
};
let currentSession: AdminSession | null = sessionMock;
vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: () => Promise.resolve(currentSession),
  requireAdmin: () => Promise.resolve(currentSession),
}));

// F08-I-094 — injecte un 57014 dans le moteur de preview, à la demande.
let forceTimeout = false;
vi.mock('@/lib/mail/audiences/preview', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/mail/audiences/preview')>();
  return {
    ...actual,
    previewAudienceSize: async (...args: Parameters<typeof actual.previewAudienceSize>) => {
      if (forceTimeout) {
        const err = new Error('canceling statement due to statement timeout') as Error & {
          code: string;
        };
        err.code = '57014';
        throw err;
      }
      return actual.previewAudienceSize(...args);
    },
  };
});

import { z } from 'zod';
import { eq } from 'drizzle-orm';
import {
  emailAudience,
  emailAudienceSnapshot,
  emailAudienceSnapshotMember,
} from '@/lib/db/schema-emails';
import { __setTestDb, __resetTestDb, type DrizzleDb } from '@/lib/db/client';
import {
  closeTestDb,
  emailsTestDb,
  emailsTestSql,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { createAudience } from '@/lib/mail/audiences/queries';
import type { RulesGroup } from '@/lib/mail/audiences/rules-types';
import { PATCH } from '@/app/api/admin/emails/audiences/[id]/route';
import { POST as PREVIEW_SIZE_POST } from '@/app/api/admin/emails/audiences/preview-size/route';
import { GET as MEMBERS_GET } from '@/app/api/admin/emails/audiences/[id]/snapshot/[snapshotId]/members/route';

const CONSENT_RULES: RulesGroup = {
  kind: 'all',
  conditions: [{ kind: 'consent_marketing', value: true }],
};
const NO_EXCL = {
  hard_bounce: false,
  unsubscribe: false,
  manual_suppression: false,
  marketing_optout: false,
};

/** Contrat wire preview-size — le MÊME que les fixtures MSW des tests composant. */
const PreviewSizeWire = z.object({
  size: z.number().int().min(0),
  durationMs: z.number().min(0),
});

function jsonReq(url: string, method: string, body: unknown): Request {
  return new Request(`http://test.local${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function makeAudience(slug = `f08-${randomUUID().slice(0, 8)}`) {
  return createAudience(
    { slug, name: 'Audience F08', rules: CONSENT_RULES, exclusionFlags: NO_EXCL },
    'admin@femiglow.ma',
  );
}

async function seedSnapshotWithMembers(audienceId: string, emails: string[]) {
  const db = emailsTestDb();
  const id = randomUUID();
  await db.insert(emailAudienceSnapshot).values({
    id,
    audienceId,
    status: 'done',
    size: emails.length,
    rulesSnapshot: CONSENT_RULES,
    exclusionSnapshot: NO_EXCL,
    metadata: {},
    purgeableAfter: new Date(Date.now() + 90 * 86_400_000),
  });
  if (emails.length > 0) {
    await db.insert(emailAudienceSnapshotMember).values(
      emails.map((email) => ({ id: randomUUID(), snapshotId: id, email, payload: { name: null } })),
    );
  }
  return id;
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
  forceTimeout = false;
  await truncateEmailTables();
  await emailsTestSql()`TRUNCATE leads RESTART IDENTITY CASCADE`;
});

describeEmailsDb('F08 — PATCH /audiences/:id', () => {
  it('F08-I-090 — PATCH ignore tout slug fourni (UpdateAudienceSchema sans slug)', async () => {
    const aud = await makeAudience('slug-immuable');
    const res = await PATCH(
      jsonReq(`/api/admin/emails/audiences/${aud.id}`, 'PATCH', {
        name: 'Renommée',
        slug: 'slug-pirate', // doit être STRIPPÉ, pas appliqué
      }),
      { params: { id: aud.id } },
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string; slug: string };
    expect(body.name).toBe('Renommée');
    expect(body.slug).toBe('slug-immuable');

    const db = emailsTestDb();
    const [row] = await db
      .select({ slug: emailAudience.slug, name: emailAudience.name })
      .from(emailAudience)
      .where(eq(emailAudience.id, aud.id));
    expect(row).toEqual({ slug: 'slug-immuable', name: 'Renommée' });
  });

  it('F08-I-091 — body invalide → 422 avec issues (aucune mutation)', async () => {
    const aud = await makeAudience();
    const res = await PATCH(
      jsonReq(`/api/admin/emails/audiences/${aud.id}`, 'PATCH', {
        name: 'x', // < 2 caractères
        rules: { kind: 'nimporte', conditions: [] },
      }),
      { params: { id: aud.id } },
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string; issues?: unknown };
    expect(body.error).toBe('Validation échouée');
    expect(body.issues).toBeDefined();

    const db = emailsTestDb();
    const [row] = await db
      .select({ name: emailAudience.name })
      .from(emailAudience)
      .where(eq(emailAudience.id, aud.id));
    expect(row?.name).toBe('Audience F08'); // intact
  });

  it('PATCH sans session → 401 JSON (pas de redirect HTML)', async () => {
    const aud = await makeAudience();
    currentSession = null;
    const res = await PATCH(
      jsonReq(`/api/admin/emails/audiences/${aud.id}`, 'PATCH', { name: 'Hack' }),
      { params: { id: aud.id } },
    );
    expect(res.status).toBe(401);
    expect((await res.json()) as object).toEqual({ error: 'Non autorisé' });
  });
});

describeEmailsDb('F08 — preview-size : timeout & contrat', () => {
  it('F08-I-094 — statement_timeout (57014) → 504 {error:timeout}, jamais un 200 faux', async () => {
    forceTimeout = true;
    const res = await PREVIEW_SIZE_POST(
      jsonReq('/api/admin/emails/audiences/preview-size', 'POST', { rules: CONSENT_RULES }),
    );
    expect(res.status).toBe(504);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('timeout');
  });

  it('F08-I-097 — la réponse preview-size réelle parse avec le schéma wire partagé', async () => {
    const res = await PREVIEW_SIZE_POST(
      jsonReq('/api/admin/emails/audiences/preview-size', 'POST', { rules: CONSENT_RULES }),
    );
    expect(res.status).toBe(200);
    const parsed = PreviewSizeWire.safeParse(await res.json());
    expect(parsed.success).toBe(true);
    // …et la fixture MSW des tests composant respecte le MÊME contrat.
    expect(PreviewSizeWire.safeParse({ size: 42, durationMs: 10 }).success).toBe(true);
  });
});

describeEmailsDb('F08 — GET members (pagination + anti-fuite)', () => {
  function membersReq(audienceId: string, snapshotId: string, qs = '') {
    return MEMBERS_GET(
      new Request(
        `http://test.local/api/admin/emails/audiences/${audienceId}/snapshot/${snapshotId}/members${qs}`,
      ),
      { params: { id: audienceId, snapshotId } },
    );
  }

  it('F08-I-096 — contrat {members,total,limit,offset} + 404 cross-audience', async () => {
    const audA = await makeAudience('aud-a');
    const audB = await makeAudience('aud-b');
    const emails = Array.from({ length: 7 }, (_, i) => `m${i}@x.test`);
    const snapId = await seedSnapshotWithMembers(audA.id, emails);

    // Contrat nominal paginé (tri par email, total exact).
    const res = await membersReq(audA.id, snapId, '?limit=3&offset=3');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      members: Array<{ email: string; name: string | null }>;
      total: number;
      limit: number;
      offset: number;
    };
    expect(body.total).toBe(7);
    expect(body.limit).toBe(3);
    expect(body.offset).toBe(3);
    expect(body.members.map((m) => m.email)).toEqual(['m3@x.test', 'm4@x.test', 'm5@x.test']);

    // Anti-fuite : le snapshot de A demandé via l'audience B → 404.
    const cross = await membersReq(audB.id, snapId);
    expect(cross.status).toBe(404);

    // Query invalide → 422 (Zod), pas un 500.
    const bad = await membersReq(audA.id, snapId, '?limit=0');
    expect(bad.status).toBe(422);
  });

  it('export CSV : content-type + disposition + échappement', async () => {
    const aud = await makeAudience();
    const snapId = await seedSnapshotWithMembers(aud.id, ['a@x.test']);
    const db = emailsTestDb();
    await db
      .update(emailAudienceSnapshotMember)
      .set({ payload: { name: 'Doe, Jane' } })
      .where(eq(emailAudienceSnapshotMember.email, 'a@x.test'));

    const res = await membersReq(aud.id, snapId, '?format=csv');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain(`snapshot-${snapId}-membres.csv`);
    const text = await res.text();
    expect(text.split('\n')[0]).toBe('email,name');
    expect(text).toContain('a@x.test,"Doe, Jane"');
  });
});
