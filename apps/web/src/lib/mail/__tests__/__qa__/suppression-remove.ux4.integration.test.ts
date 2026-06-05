// @vitest-environment node
/**
 * VAGUE 4 — COCKPIT (UX-COCKPIT-001) : la suppression list devient RÉVERSIBLE.
 * Suite VRAIE-DB. Oracle UX4-COCKPIT-001 :
 *   addSuppression puis removeSuppression(email) retire la ligne ; isSuppressed
 *   repasse à false ; via makeSuppression. + listSuppression paginée/filtrable.
 *
 * Avant ce chantier, suppression.ts n'exposait QUE addSuppression/findSuppressed/
 * isSuppressed : une suppression erronée bloquait DÉFINITIVEMENT le destinataire
 * (transactionnel ET campagnes) sans recours opérateur (non-conformité RGPD —
 * droit de réinscription). removeSuppression + listSuppression comblent le trou.
 *
 * Lancement (base dédiée m02cockpit) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_m02cockpit#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *     src/lib/mail/__tests__/__qa__/suppression-remove.ux4.integration.test.ts
 */
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';

import { __setTestDb, __resetTestDb } from '@/lib/db/client';
import {
  closeTestDb,
  emailsTestDb,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { makeSuppression } from '@/test/factories/emails.factory';
import {
  isSuppressed,
  addSuppression,
  removeSuppression,
  listSuppression,
} from '../../suppression';

beforeAll(() => {
  __setTestDb(emailsTestDb() as never);
});

beforeEach(async () => {
  await truncateEmailTables();
});

afterAll(async () => {
  __resetTestDb();
  await closeTestDb();
});

describeEmailsDb('Suppression — removeSuppression réversible (UX4-COCKPIT-001)', () => {
  it('UX4-COCKPIT-001 — addSuppression puis removeSuppression retire la ligne ; isSuppressed repasse à false', async () => {
    const sup = makeSuppression({ email: 'faux.positif@exemple.test', reason: 'hard_bounce', source: 'stalwart' });
    await addSuppression(sup);
    expect(await isSuppressed(sup.email)).toBe(true);

    const removed = await removeSuppression(sup.email);
    expect(removed).toBe(true);
    // L'adresse cliente n'est PLUS bloquée — elle peut de nouveau recevoir.
    expect(await isSuppressed(sup.email)).toBe(false);
  });

  it('UX4-COCKPIT-001b — removeSuppression normalise la casse/espaces (retrait quelle que soit la saisie)', async () => {
    await addSuppression(makeSuppression({ email: 'Mixed.Case@Exemple.TEST', reason: 'manual_admin', source: 'manual' }));
    expect(await isSuppressed('mixed.case@exemple.test')).toBe(true);

    const removed = await removeSuppression('  MIXED.CASE@EXEMPLE.TEST ');
    expect(removed).toBe(true);
    expect(await isSuppressed('mixed.case@exemple.test')).toBe(false);
  });

  it('UX4-COCKPIT-001c — removeSuppression idempotent : false si l adresse n est pas listée (pas d erreur)', async () => {
    expect(await removeSuppression('jamais.listee@exemple.test')).toBe(false);
  });

  it('UX4-COCKPIT-001d — listSuppression paginée + filtrable email/reason/source + total', async () => {
    await addSuppression(makeSuppression({ email: 'alpha@exemple.test', reason: 'hard_bounce', source: 'stalwart' }));
    await addSuppression(makeSuppression({ email: 'beta@exemple.test', reason: 'unsubscribe', source: 'manual' }));
    await addSuppression(makeSuppression({ email: 'gamma@autre.test', reason: 'manual_admin', source: 'manual' }));

    const all = await listSuppression({ limit: 50, offset: 0 });
    expect(all.total).toBe(3);
    expect(all.rows).toHaveLength(3);

    // Filtre par sous-chaîne d'email.
    const byEmail = await listSuppression({ email: 'exemple.test' });
    expect(byEmail.total).toBe(2);
    expect(byEmail.rows.map((r) => r.email).sort()).toEqual([
      'alpha@exemple.test',
      'beta@exemple.test',
    ]);

    // Filtre par raison.
    const byReason = await listSuppression({ reason: 'hard_bounce' });
    expect(byReason.total).toBe(1);
    expect(byReason.rows[0]!.email).toBe('alpha@exemple.test');

    // Filtre par source.
    const bySource = await listSuppression({ source: 'manual' });
    expect(bySource.total).toBe(2);

    // Pagination : limit=1 → 1 ligne, total inchangé.
    const page = await listSuppression({ limit: 1, offset: 0 });
    expect(page.rows).toHaveLength(1);
    expect(page.total).toBe(3);
  });
});
