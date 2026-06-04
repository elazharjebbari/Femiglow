// @vitest-environment node
/**
 * AUD-SNAP-* / AUD-PRE-* / AUD-PURGE-* / AUD-CRUD-* — cycle de vie snapshot,
 * preview, purge et CRUD sur VRAIE DB.
 *
 * Coeur du chantier R-012 (volet snapshot) : le snapshot zombie.
 *   ROUGE attendu (sans le fix) : un snapshot resté `running` après un crash
 *   reste `running` à vie ; pire, l'idempotence par `snapshotKey` RENVOIE ce
 *   zombie inutilisable au lieu d'en refaire un.
 *   VERT (avec le fix) : à la demande d'un nouveau snapshot, le zombie est
 *   requalifié `errored` (avec raison) ET un nouveau snapshot démarre.
 *
 * Les fonctions sous test (`snapshotAudience`, `preview*`, `purge*`,
 * `createAudience`, `deleteAudience`, `reapStuckSnapshots`) lisent la DB via
 * `@/lib/db/client.db()` qui consomme `process.env.DATABASE_URL`. Le harnais
 * `emailsTestSql/emailsTestDb` consomme la même URL → on seed/inspecte sur la
 * MÊME base que le code applicatif.
 *
 * Lancement (DB dédiée femiglow_test_m04audiences) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_m04audiences#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism src/lib/mail/audiences/snapshot-lifecycle.integration.test.ts
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import { leads } from '@/lib/db/schema';
import {
  emailAudience,
  emailAudienceSnapshot,
  emailAudienceSnapshotMember,
  emailCampaignLink,
} from '@/lib/db/schema-emails';
import {
  closeTestDb,
  describeEmailsDb,
  emailsTestDb,
  emailsTestSql,
  truncateEmailTables,
} from '@/test/db/emails-db';
import { snapshotAudience, reapStuckSnapshots } from './snapshot';
import { purgeExpiredSnapshots } from './purge';
import { previewAudienceSize, previewAudienceSample } from './preview';
import { createAudience, deleteAudience, listAudiences } from './queries';
import type { RulesGroup } from './rules-types';

// Init paresseuse (cf. rules-compiler.integration.test.ts).
const db = new Proxy({} as ReturnType<typeof emailsTestDb>, {
  get: (_t, prop) => (emailsTestDb() as never)[prop],
});
const pg = new Proxy(((..._: never[]) => {}) as unknown as ReturnType<typeof emailsTestSql>, {
  get: (_t, prop) => (emailsTestSql() as never)[prop],
  apply: (_t, thisArg, args) => Reflect.apply(emailsTestSql() as never, thisArg, args),
});

// Note jsonb : on seede les lignes contenant des colonnes jsonb via DRIZZLE
// (`db.insert(...).values(...)`), qui sérialise nativement les objets. Le
// client brut `pg` (postgres-js) via le Proxy ne reconnaît plus `sql.json()`
// (« Received an instance of Object » au Bind) — on évite donc le jsonb en pg
// brut. Les raw `pg` ne servent qu'aux colonnes scalaires / TRUNCATE / COUNT.

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

/** Seed leads : 3 consentants (C1,C2,C3) + 1 non-consentant (N1). */
async function seedLeads() {
  await db.insert(leads).values([
    { id: 'C1', email: 'c1@exemple.test', name: 'Aya', consentMarketing: true },
    { id: 'C2', email: 'c2@exemple.test', name: 'Bahia', consentMarketing: true },
    { id: 'C3', email: 'c3@exemple.test', name: 'Chama', consentMarketing: true },
    { id: 'N1', email: 'n1@exemple.test', name: 'Dounia', consentMarketing: false },
  ]);
}

/** Crée une audience « consentants » via la query applicative. */
async function makeConsentAudience(slug = `aud-${randomUUID().slice(0, 8)}`): Promise<string> {
  const row = await createAudience(
    { slug, name: `Audience ${slug}`, rules: CONSENT_RULES, exclusionFlags: NO_EXCL },
    'admin@test',
  );
  return row.id;
}

/** Insère DIRECTEMENT un snapshot zombie `running` daté (bypass du code applicatif). */
async function seedZombieSnapshot(
  audienceId: string,
  opts: { snapshotKey?: string; ageMinutes: number },
): Promise<string> {
  const id = randomUUID();
  const createdAt = new Date(Date.now() - opts.ageMinutes * 60_000);
  await db.insert(emailAudienceSnapshot).values({
    id,
    audienceId,
    snapshotKey: opts.snapshotKey ?? null,
    status: 'running',
    size: 0,
    rulesSnapshot: CONSENT_RULES,
    exclusionSnapshot: NO_EXCL,
    metadata: {},
    createdAt,
    purgeableAfter: new Date(createdAt.getTime() + 90 * 86_400_000),
  });
  return id;
}

/** Insère un snapshot `done` déjà expiré (purgeable_after dans le passé). */
async function seedExpiredSnapshot(audienceId: string, size = 0): Promise<string> {
  const id = randomUUID();
  await db.insert(emailAudienceSnapshot).values({
    id,
    audienceId,
    status: 'done',
    size,
    rulesSnapshot: CONSENT_RULES,
    exclusionSnapshot: NO_EXCL,
    metadata: {},
    purgeableAfter: new Date(Date.now() - 86_400_000),
  });
  return id;
}

async function snapshotRow(id: string) {
  const rows = await db
    .select()
    .from(emailAudienceSnapshot)
    .where(eq(emailAudienceSnapshot.id, id))
    .limit(1);
  return rows[0];
}

/** COUNT(*) typé sûr depuis le client brut postgres-js. */
async function countOf(query: PromiseLike<unknown>): Promise<number> {
  const rows = (await query) as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}

beforeEach(async () => {
  await truncateEmailTables();
  await pg`TRUNCATE leads RESTART IDENTITY CASCADE`;
  await seedLeads();
});

afterAll(async () => {
  await closeTestDb();
});

// ── Snapshot — cycle nominal ────────────────────────────────────────────
describeEmailsDb('snapshot — cycle nominal', () => {
  it('AUD-SNAP-001/002 : running→done, size correcte, membres = leads matchant', async () => {
    const audienceId = await makeConsentAudience();
    const res = await snapshotAudience(audienceId);

    expect(res.status).toBe('done');
    expect(res.size).toBe(3); // C1,C2,C3 (pas N1)

    const row = await snapshotRow(res.snapshotId);
    expect(row?.status).toBe('done');
    expect(row?.size).toBe(3);
    expect(row?.completedAt).not.toBeNull();

    const members = await db
      .select({ email: emailAudienceSnapshotMember.email })
      .from(emailAudienceSnapshotMember)
      .where(eq(emailAudienceSnapshotMember.snapshotId, res.snapshotId));
    expect(members.map((m) => m.email).sort()).toEqual([
      'c1@exemple.test', 'c2@exemple.test', 'c3@exemple.test',
    ]);
  });

  it('AUD-SNAP-009 : metadata.source + campaignId persistés', async () => {
    const audienceId = await makeConsentAudience();
    const res = await snapshotAudience(audienceId, { source: 'campaign', campaignId: 'camp-42' });
    const row = await snapshotRow(res.snapshotId);
    expect(row?.metadata).toMatchObject({ source: 'campaign', campaignId: 'camp-42' });
  });

  it('AUD-SNAP-010 : purgeableAfter ≈ now + 90j', async () => {
    const audienceId = await makeConsentAudience();
    const res = await snapshotAudience(audienceId);
    const row = await snapshotRow(res.snapshotId);
    const expected = Date.now() + 90 * 86_400_000;
    const got = new Date(row!.purgeableAfter as unknown as string).getTime();
    // Fenêtre large (± 1 jour) — on vérifie l'ordre de grandeur, pas la ms.
    expect(Math.abs(got - expected)).toBeLessThan(86_400_000);
  });

  it('AUD-SNAP-003 : règles profondeur 5 → status=errored + erroredReason', async () => {
    // Insère une audience avec des règles trop profondes (bypass createAudience
    // qui valide via Zod). Le snapshot doit erreurer proprement, pas crasher.
    const id = randomUUID();
    const deep: RulesGroup = {
      kind: 'all', conditions: [{ kind: 'all', conditions: [{ kind: 'all', conditions: [
        { kind: 'all', conditions: [{ kind: 'all', conditions: [{ kind: 'consent_marketing', value: true }] }] }] }] }],
    };
    await db.insert(emailAudience).values({
      id,
      slug: 'deep-' + id.slice(0, 8),
      name: 'Deep',
      rules: deep,
      exclusionFlags: NO_EXCL,
      createdBy: 'admin@test',
    });
    const res = await snapshotAudience(id);
    expect(res.status).toBe('errored');
    expect(res.erroredReason).toMatch(/max depth/i);
    const row = await snapshotRow(res.snapshotId);
    expect(row?.status).toBe('errored');
    expect(row?.erroredReason).toMatch(/max depth/i);
  });

  it('AUD-SNAP-008 : audience inexistante → throw /not found/', async () => {
    await expect(snapshotAudience(randomUUID())).rejects.toThrow(/not found/i);
  });

  it('AUD-SNAP-007 : audience soft-deleted → throw /deleted/', async () => {
    const audienceId = await makeConsentAudience();
    await deleteAudience(audienceId);
    await expect(snapshotAudience(audienceId)).rejects.toThrow(/deleted/i);
  });
});

// ── Snapshot — idempotence (état cible : ne renvoyer QUE le 'done') ──────
describeEmailsDb('snapshot — idempotence par snapshotKey', () => {
  it('AUD-SNAP-004 : même snapshotKey → renvoie le snapshot DONE existant sans réinsérer', async () => {
    const audienceId = await makeConsentAudience();
    const first = await snapshotAudience(audienceId, { snapshotKey: 'camp-7' });
    expect(first.status).toBe('done');

    const second = await snapshotAudience(audienceId, { snapshotKey: 'camp-7' });
    expect(second.snapshotId).toBe(first.snapshotId); // même ligne
    expect(second.status).toBe('done');

    // Une seule ligne snapshot pour cette audience (pas de réinsertion).
    const n = await countOf(pg<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM email_audience_snapshot WHERE audience_id = ${audienceId}`);
    expect(n).toBe(1);
  });
});

// ── R-012 — Snapshot ZOMBIE (rouge→fix→vert) ────────────────────────────
describeEmailsDb('snapshot — zombie running (R-012)', () => {
  it('reapStuckSnapshots requalifie un running ancien en errored (avec raison) + libère la clé', async () => {
    const audienceId = await makeConsentAudience();
    const zombieId = await seedZombieSnapshot(audienceId, { snapshotKey: 'camp-z', ageMinutes: 120 });

    const reaped = await reapStuckSnapshots();
    expect(reaped).toBe(1);

    const row = await snapshotRow(zombieId);
    expect(row?.status).toBe('errored');
    expect(row?.erroredReason).toMatch(/running|crash/i);
    expect(row?.erroredAt).not.toBeNull();
    expect(row?.snapshotKey).toBeNull(); // clé libérée
  });

  it('reapStuckSnapshots ne touche PAS un running récent (snapshot légitime en vol)', async () => {
    const audienceId = await makeConsentAudience();
    const freshId = await seedZombieSnapshot(audienceId, { ageMinutes: 1 });
    const reaped = await reapStuckSnapshots();
    expect(reaped).toBe(0);
    expect((await snapshotRow(freshId))?.status).toBe('running');
  });

  it('AUD-SNAP-005/006 : re-snapshot même key → zombie requalifié errored ET nouveau snapshot done démarre', async () => {
    const audienceId = await makeConsentAudience();
    const zombieId = await seedZombieSnapshot(audienceId, { snapshotKey: 'camp-z', ageMinutes: 120 });

    // Demande d'un nouveau snapshot avec la MÊME clé d'idempotence.
    const res = await snapshotAudience(audienceId, { snapshotKey: 'camp-z' });

    // Oracle cible : on NE récupère PAS le zombie ; un snapshot frais et
    // exploitable est produit.
    expect(res.snapshotId).not.toBe(zombieId);
    expect(res.status).toBe('done');
    expect(res.size).toBe(3);

    // Le zombie a été requalifié (failed avec raison), il n'est plus 'running'.
    const zombie = await snapshotRow(zombieId);
    expect(zombie?.status).toBe('errored');
    expect(zombie?.erroredReason).toMatch(/running|crash/i);

    // Le nouveau snapshot porte la clé d'idempotence libérée.
    const fresh = await snapshotRow(res.snapshotId);
    expect(fresh?.snapshotKey).toBe('camp-z');
    expect(fresh?.status).toBe('done');

    // Et il est ré-utilisable : un 3e appel idempotent renvoie ce snapshot done.
    const again = await snapshotAudience(audienceId, { snapshotKey: 'camp-z' });
    expect(again.snapshotId).toBe(res.snapshotId);
    expect(again.status).toBe('done');
  });
});

// ── Preview — taille + échantillon exacts ───────────────────────────────
describeEmailsDb('preview — taille & échantillon (exactitude)', () => {
  it('AUD-PRE-001 : previewAudienceSize == nombre réel de leads matchant', async () => {
    const res = await previewAudienceSize(CONSENT_RULES, NO_EXCL);
    expect(res.size).toBe(3);
    expect(res.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('previewAudienceSize sur une règle vide (all) == base entière', async () => {
    const res = await previewAudienceSize({ kind: 'all', conditions: [] }, NO_EXCL);
    expect(res.size).toBe(4);
  });

  it('AUD-PRE-003 : sample borné à limit ; size == total', async () => {
    const res = await previewAudienceSample(CONSENT_RULES, NO_EXCL, 2);
    expect(res.samples.length).toBeLessThanOrEqual(2);
    expect(res.size).toBe(3); // total, indépendant de la limite
    // Les échantillons sont bien des consentants (jamais N1).
    for (const s of res.samples) expect(s.email).not.toBe('n1@exemple.test');
  });

  it('AUD-PRE-004 : limit hors borne est cappé (999 → ≤ 50)', async () => {
    const res = await previewAudienceSample(CONSENT_RULES, NO_EXCL, 999);
    expect(res.samples.length).toBeLessThanOrEqual(50);
    expect(res.size).toBe(3);
  });

  it('preview reflète les exclusions : hard_bounce retire un consentant suppressé', async () => {
    await pg`INSERT INTO email_suppression (email, reason, source) VALUES ('c1@exemple.test', 'hard_bounce', 'stalwart')`;
    const res = await previewAudienceSize(CONSENT_RULES, { ...NO_EXCL, hard_bounce: true });
    expect(res.size).toBe(2); // C2,C3 (C1 suppressé)
  });
});

// ── Purge — snapshots expirés ───────────────────────────────────────────
describeEmailsDb('purge — snapshots expirés', () => {
  it('AUD-PURGE-001 : supprime les snapshots purgeable_after < now(), conserve les récents', async () => {
    const audienceId = await makeConsentAudience();

    // Snapshot expiré (purgeable_after dans le passé) + ses membres.
    const expiredId = await seedExpiredSnapshot(audienceId, 1);
    await db
      .insert(emailAudienceSnapshotMember)
      .values({ snapshotId: expiredId, email: 'c1@exemple.test' });

    // Snapshot récent (encore valable) via le code applicatif.
    const fresh = await snapshotAudience(audienceId);

    const res = await purgeExpiredSnapshots();
    expect(res.purged).toBe(1);

    // L'expiré a disparu (et ses membres, cascade) ; le récent est conservé.
    expect(await snapshotRow(expiredId)).toBeUndefined();
    expect((await snapshotRow(fresh.snapshotId))?.status).toBe('done');
    const n = await countOf(pg<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM email_audience_snapshot_member WHERE snapshot_id = ${expiredId}`);
    expect(n).toBe(0); // membres purgés en cascade
  });

  it('AUD-PURGE-002 : purge idempotente — un 2e passage ne re-supprime rien', async () => {
    const audienceId = await makeConsentAudience();
    await seedExpiredSnapshot(audienceId, 0);
    expect((await purgeExpiredSnapshots()).purged).toBe(1);
    expect((await purgeExpiredSnapshots()).purged).toBe(0);
  });
});

// ── CRUD — création + suppression (référencée vs simple) ────────────────
describeEmailsDb('CRUD — audiences', () => {
  it('AUD-CRUD-001 : createAudience insère une ligne email_audience', async () => {
    const id = await makeConsentAudience('my-audience');
    const n = await countOf(pg<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM email_audience WHERE id = ${id} AND slug = 'my-audience'`);
    expect(n).toBe(1);
  });

  it('AUD-CRUD-003 : slug dupliqué → contrainte unique rejette', async () => {
    await makeConsentAudience('dup-slug');
    await expect(makeConsentAudience('dup-slug')).rejects.toThrow();
  });

  it('AUD-CRUD-005 : suppression simple → soft-delete (deletedAt posé, absente des listes actives)', async () => {
    const id = await makeConsentAudience('to-delete');
    expect(await deleteAudience(id)).toBe(true);

    // Soft-delete : la ligne existe encore physiquement avec deletedAt.
    const [row] = await pg<{ deleted_at: string | null }[]>`
      SELECT deleted_at FROM email_audience WHERE id = ${id}`;
    expect(row?.deleted_at).not.toBeNull();

    // Absente des listes actives.
    const active = await listAudiences();
    expect(active.map((a) => a.id)).not.toContain(id);
  });

  it('AUD-CRUD-004 : soft-delete d’une audience référencée par une campagne ne casse pas la FK', async () => {
    const audienceId = await makeConsentAudience('referenced');
    // Campagne référençant l'audience (FK audience_id, sans onDelete cascade).
    const campaignId = `cmp_${randomUUID().slice(0, 8)}`;
    await pg`
      INSERT INTO email_campaign_link (id, status, name, audience_id)
      VALUES (${campaignId}, 'draft', 'Campagne liée', ${audienceId})`;

    // Le soft-delete réussit (l'UI promet « l'audience disparaît, snapshots
    // conservés » — pas de hard-delete qui violerait la FK).
    expect(await deleteAudience(audienceId)).toBe(true);

    // La FK reste valide : la campagne pointe toujours vers la ligne (qui
    // existe encore physiquement) → aucune campagne orpheline ni cassée.
    const [camp] = await db
      .select({ audienceId: emailCampaignLink.audienceId })
      .from(emailCampaignLink)
      .where(eq(emailCampaignLink.id, campaignId))
      .limit(1);
    expect(camp?.audienceId).toBe(audienceId);
    const [aud] = await pg<{ id: string; deleted_at: string | null }[]>`
      SELECT id, deleted_at FROM email_audience WHERE id = ${audienceId}`;
    expect(aud?.id).toBe(audienceId); // ligne toujours présente (FK intacte)
    expect(aud?.deleted_at).not.toBeNull();
  });
});

// ── Garde-fou cumul : count(*) reaper toute la table (chemin cron) ──────
describeEmailsDb('reapStuckSnapshots — chemin global (sans audienceId)', () => {
  it('reape les zombies de plusieurs audiences, laisse les done intacts', async () => {
    const a1 = await makeConsentAudience();
    const a2 = await makeConsentAudience();
    const z1 = await seedZombieSnapshot(a1, { ageMinutes: 200 });
    const z2 = await seedZombieSnapshot(a2, { ageMinutes: 200 });
    const done = await snapshotAudience(a1); // status done, ne doit pas être reapé

    const reaped = await reapStuckSnapshots();
    expect(reaped).toBe(2);
    expect((await snapshotRow(z1))?.status).toBe('errored');
    expect((await snapshotRow(z2))?.status).toBe('errored');
    expect((await snapshotRow(done.snapshotId))?.status).toBe('done');
  });
});
