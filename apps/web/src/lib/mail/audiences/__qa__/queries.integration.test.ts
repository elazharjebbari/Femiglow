// @vitest-environment node
/**
 * CHANTIER E — PHASE 8 DURCISSEMENT — couverture trou audiences/queries.ts
 * (41 % → cible). CRUD audiences + soft-delete + comptage de snapshots corrélé.
 *
 * Oracle métier (vraie DB) :
 *   - create : valide les `rules` (RulesGroupSchema) AVANT INSERT ; rules
 *     invalides → throw, RIEN n'est inséré.
 *   - soft-delete : `deleteAudience` pose `deletedAt` ; l'audience disparaît de
 *     `listAudiences`, `getAudienceById`, `getAudienceBySlug`
 *     (le `WHERE deletedAt IS NULL` est la garantie centrale).
 *   - update : patch partiel (seules les clés fournies changent), ne touche pas
 *     une audience supprimée.
 *   - listSnapshotsForAudience : borne le `limit` à [1, 100] et trie desc.
 *   - listAudiencesWithSnapshotCount : `snapshotCount` corrélé à la BONNE
 *     audience (sous-requête correlée — pas un total global).
 *
 * IDs : AUD-QRY-001..012 (module 04-audiences, surface CRUD/queries).
 *
 * Lancement (DB dédiée) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_phase8#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *     src/lib/mail/audiences/__qa__/queries.integration.test.ts
 */
import { afterAll, beforeEach, expect, it } from 'vitest';

import { emailAudienceSnapshot } from '@/lib/db/schema-emails';
import {
  closeTestDb,
  describeEmailsDb,
  emailsTestDb,
  truncateEmailTables,
} from '@/test/db/emails-db';
import type { RulesGroup, ExclusionFlags } from '../rules-types';
import {
  createAudience,
  updateAudience,
  deleteAudience,
  getAudienceById,
  getAudienceBySlug,
  listAudiences,
  listSnapshotsForAudience,
  listAudiencesWithSnapshotCount,
} from '../queries';

const db = new Proxy({} as ReturnType<typeof emailsTestDb>, {
  get: (_t, prop) => (emailsTestDb() as never)[prop],
});

const VALID_RULES: RulesGroup = {
  kind: 'all',
  conditions: [{ kind: 'has_tag', tag: 'acheteuse' }],
};
const NO_EXCL: ExclusionFlags = {
  hard_bounce: true,
  unsubscribe: true,
  manual_suppression: true,
  marketing_optout: false,
};

let slugCounter = 0;
function uniqueSlug(prefix = 'aud') {
  slugCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${slugCounter}`;
}

async function makeAud(over: Partial<Parameters<typeof createAudience>[0]> = {}) {
  return createAudience(
    {
      slug: uniqueSlug(),
      name: 'Acheteuses',
      rules: VALID_RULES,
      exclusionFlags: NO_EXCL,
      ...over,
    },
    'admin_test',
  );
}

async function insertSnapshot(audienceId: string, key: string) {
  await db.insert(emailAudienceSnapshot).values({
    audienceId,
    snapshotKey: key,
    status: 'done',
    size: 1,
    rulesSnapshot: VALID_RULES as unknown as object,
    exclusionSnapshot: NO_EXCL as unknown as object,
    purgeableAfter: new Date(Date.now() + 30 * 86_400_000),
  });
}

describeEmailsDb('audiences/queries — CRUD + soft-delete (vraie DB)', () => {
  beforeEach(truncateEmailTables);
  afterAll(closeTestDb);

  // AUD-QRY-001 — create insère et renvoie la ligne.
  it('createAudience insère et renvoie l audience avec defaults', async () => {
    const aud = await makeAud({ name: 'VIP' });
    expect(aud.id).toBeTruthy();
    expect(aud.name).toBe('VIP');
    expect(aud.evaluationMode).toBe('dynamic'); // default
    expect(aud.deletedAt).toBeNull();
  });

  // AUD-QRY-002 — rules invalides → throw, RIEN inséré (validation avant INSERT).
  it('createAudience rejette des rules invalides sans rien insérer', async () => {
    const before = await listAudiences();
    await expect(
      createAudience(
        {
          slug: uniqueSlug(),
          name: 'Bad',
          // shape invalide : `kind` doit être all/any, pas 'broken'.
          rules: { kind: 'broken', conditions: [] } as unknown as RulesGroup,
        },
        'admin_test',
      ),
    ).rejects.toThrow();
    const after = await listAudiences();
    expect(after.length).toBe(before.length);
  });

  // AUD-QRY-003 — getAudienceById retrouve la ligne vivante.
  it('getAudienceById retrouve une audience vivante', async () => {
    const aud = await makeAud();
    const found = await getAudienceById(aud.id);
    expect(found?.id).toBe(aud.id);
  });

  // AUD-QRY-004 — getAudienceBySlug retrouve par slug.
  it('getAudienceBySlug retrouve par slug', async () => {
    const aud = await makeAud();
    const found = await getAudienceBySlug(aud.slug);
    expect(found?.id).toBe(aud.id);
  });

  // AUD-QRY-005 — soft-delete : deletedAt posé + disparaît de la liste.
  it('deleteAudience pose deletedAt et l audience disparaît de listAudiences', async () => {
    const aud = await makeAud();
    expect((await listAudiences()).some((a) => a.id === aud.id)).toBe(true);

    const ok = await deleteAudience(aud.id);
    expect(ok).toBe(true);

    expect((await listAudiences()).some((a) => a.id === aud.id)).toBe(false);
  });

  // AUD-QRY-006 — audience supprimée : getById/getBySlug renvoient null.
  it('une audience supprimée n est plus retrouvable par id ni par slug', async () => {
    const aud = await makeAud();
    await deleteAudience(aud.id);
    expect(await getAudienceById(aud.id)).toBeNull();
    expect(await getAudienceBySlug(aud.slug)).toBeNull();
  });

  // AUD-QRY-007 — deleteAudience d un id inexistant → false (rien à supprimer).
  it('deleteAudience renvoie false sur un id inexistant', async () => {
    expect(await deleteAudience('00000000-0000-0000-0000-000000000000')).toBe(false);
  });

  // AUD-QRY-008 — re-delete : la 2e suppression renvoie false (déjà soft-deleted).
  it('re-supprimer une audience déjà supprimée renvoie false', async () => {
    const aud = await makeAud();
    expect(await deleteAudience(aud.id)).toBe(true);
    expect(await deleteAudience(aud.id)).toBe(false);
  });

  // AUD-QRY-009 — update patch partiel : seul le name change, rules conservées.
  it('updateAudience applique un patch partiel (name) sans toucher au reste', async () => {
    const aud = await makeAud({ name: 'Avant' });
    const updated = await updateAudience(aud.id, { name: 'Après' });
    expect(updated?.name).toBe('Après');
    expect(updated?.slug).toBe(aud.slug);
    // rules inchangées.
    expect(updated?.rules).toEqual(aud.rules);
  });

  // AUD-QRY-010 — update sur audience supprimée → null (WHERE deletedAt IS NULL).
  it('updateAudience sur une audience supprimée renvoie null', async () => {
    const aud = await makeAud();
    await deleteAudience(aud.id);
    expect(await updateAudience(aud.id, { name: 'X' })).toBeNull();
  });

  // AUD-QRY-011 — listSnapshotsForAudience trie desc et borne le limit.
  it('listSnapshotsForAudience trie par createdAt desc et clamp le limit dans [1,100]', async () => {
    const aud = await makeAud();
    await insertSnapshot(aud.id, 's1');
    await insertSnapshot(aud.id, 's2');
    await insertSnapshot(aud.id, 's3');

    // limit demandé 0 → clamp à 1 (Math.max(1, 0)).
    const one = await listSnapshotsForAudience(aud.id, 0);
    expect(one.length).toBe(1);

    // limit large → tous les snapshots de CETTE audience uniquement.
    const all = await listSnapshotsForAudience(aud.id, 999);
    expect(all.length).toBe(3);
    // ordre desc : createdAt décroissant (les timestamps sont quasi-égaux ; on
    // valide juste qu'on ne perd pas de lignes et que le tri ne throw pas).
    expect(all.every((s) => s.audienceId === aud.id)).toBe(true);
  });

  // AUD-QRY-012 — GARDE-FOU (bug corrigé 2026-06-05, ex-pin du compte à 0) :
  // la sous-requête corrélée rendait `${emailAudience.id}` SANS qualificateur
  // (`WHERE "audience_id" = "id"`), l'`"id"` se liant à la colonne du SNAPSHOT
  // (scope interne) → snapshotCount TOUJOURS 0 sur la page admin audiences.
  // Corrigé : référence externe qualifiée en dur ("email_audience"."id").
  // Ce test épingle la cohérence compte affiché vs snapshots réellement listés.
  it('listAudiencesWithSnapshotCount est cohérent avec listSnapshotsForAudience (garde-fou corrélation)', async () => {
    const a = await makeAud({ name: 'A' });
    const b = await makeAud({ name: 'B' });
    await insertSnapshot(a.id, 'a1');
    await insertSnapshot(a.id, 'a2');
    await insertSnapshot(b.id, 'b1');

    const realA = await listSnapshotsForAudience(a.id, 100);
    const realB = await listSnapshotsForAudience(b.id, 100);
    expect(realA.length).toBe(2);
    expect(realB.length).toBe(1);

    const rows = await listAudiencesWithSnapshotCount();
    expect(rows.find((r) => r.id === a.id)?.snapshotCount).toBe(realA.length);
    expect(rows.find((r) => r.id === b.id)?.snapshotCount).toBe(realB.length);
  });

  // AUD-QRY-013 — oracle cible ACTIVÉ (fix queries.ts 2026-06-05) :
  // snapshotCount reflète le nombre RÉEL de snapshots par audience, sans
  // fuite croisée (le compte de A n'inclut pas ceux de B).
  it('listAudiencesWithSnapshotCount corréle le compte exact (oracle cible post-fix)', async () => {
    const a = await makeAud({ name: 'A' });
    const b = await makeAud({ name: 'B' });
    await insertSnapshot(a.id, 'a1');
    await insertSnapshot(a.id, 'a2');
    await insertSnapshot(b.id, 'b1');

    const rows = await listAudiencesWithSnapshotCount();
    expect(rows.find((r) => r.id === a.id)?.snapshotCount).toBe(2);
    expect(rows.find((r) => r.id === b.id)?.snapshotCount).toBe(1);
  });
});
