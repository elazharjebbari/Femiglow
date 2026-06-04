// @vitest-environment node
/**
 * CHANTIER H — Module 08 : CRUD de la liste de suppression (idempotence,
 * normalisation, lookup ensembliste, ajout post hard-bounce). Suite VRAIE-DB
 * (femiglow_test_outbox).
 *
 * `addSuppression` (onConflictDoNothing) doit être idempotent et normaliser
 * l'email ; `findSuppressed` retourne l'ensemble normalisé des adresses
 * matchées ; `isSuppressed` normalise (trim/lowercase) avant lookup. Un
 * hard-bounce (sync webhook → suppression) rend l'adresse cliente suppressée
 * pour les envois ultérieurs.
 *
 * NB : on n'emploie que des adresses CLIENTES (hors allowlist interne) — une
 * adresse interne court-circuiterait isSuppressed (R-009) et fausserait l'oracle.
 *
 * IDs matrice : PIP-INT-103, PIP-INT-104, PIP-INT-105, PIP-INT-106.
 *
 * Lancement :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_outbox#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run src/lib/mail/__tests__/__qa__/suppression-crud.integration.test.ts
 */
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';

import { emailSuppression } from '@/lib/db/schema-emails';
import { __setTestDb, __resetTestDb } from '@/lib/db/client';
import {
  closeTestDb,
  emailsTestDb,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { isSuppressed, findSuppressed, addSuppression } from '../../suppression';

const db = () => emailsTestDb();

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

describeEmailsDb('Suppression CRUD — idempotence & normalisation', () => {
  // PIP-INT-103 — addSuppression deux fois sur la même adresse (casse/espaces
  // différents) → une SEULE ligne (onConflictDoNothing + email normalisé).
  it('PIP-INT-103 — addSuppression idempotent : une seule ligne pour l email normalisé', async () => {
    await addSuppression({ email: 'Cliente.Test@Exemple.TEST', reason: 'hard_bounce', source: 'stalwart' });
    // Même adresse, casse + espaces différents : doit collisionner sur la clé
    // normalisée (l'INSERT normalise avant écriture).
    await addSuppression({ email: '  cliente.test@exemple.test ', reason: 'unsubscribe', source: 'manual' });

    const rows = await db().query.emailSuppression.findMany({
      where: (t) => eq(t.email, 'cliente.test@exemple.test'),
    });
    expect(rows).toHaveLength(1);
    // La première raison est conservée (onConflictDoNothing ne réécrit pas).
    expect(rows[0]!.reason).toBe('hard_bounce');
  });

  // PIP-INT-105 — isSuppressed normalise (trim/lowercase) : une adresse stockée
  // en minuscules matche une requête en MAJUSCULES avec espaces.
  it('PIP-INT-105 — isSuppressed normalise trim/lowercase avant lookup', async () => {
    await addSuppression({ email: 'a@b.c', reason: 'unsubscribe', source: 'manual' });

    expect(await isSuppressed('  A@B.C ')).toBe(true);
    expect(await isSuppressed('a@b.c')).toBe(true);
    // Une autre adresse n'est pas suppressée.
    expect(await isSuppressed('autre@b.c')).toBe(false);
  });

  // PIP-INT-104 — findSuppressed retourne l'ensemble NORMALISÉ des adresses
  // effectivement matchées (sous-ensemble du lot interrogé).
  it('PIP-INT-104 — findSuppressed retourne le set normalisé des adresses matchées', async () => {
    await addSuppression({ email: 'sup1@exemple.test', reason: 'hard_bounce', source: 'stalwart' });
    await addSuppression({ email: 'SUP2@Exemple.test', reason: 'unsubscribe', source: 'manual' });

    const set = await findSuppressed([
      'SUP1@EXEMPLE.TEST', // matche (normalisé)
      'sup2@exemple.test', // matche
      'jamais@exemple.test', // absent
    ]);

    expect(set.has('sup1@exemple.test')).toBe(true);
    expect(set.has('sup2@exemple.test')).toBe(true);
    expect(set.has('jamais@exemple.test')).toBe(false);
    expect(set.size).toBe(2);
  });

  it('findSuppressed sur une liste vide → set vide (pas de requête)', async () => {
    const set = await findSuppressed([]);
    expect(set.size).toBe(0);
  });

  // PIP-INT-106 — sync post hard-bounce : ajouter une suppression (comme le fait
  // le pont webhook sur un bounce hard) rend l'adresse cliente suppressée pour
  // tout envoi ultérieur.
  it('PIP-INT-106 — après ajout suppression (hard bounce), l adresse cliente est suppressée', async () => {
    const client = 'bounced.client@exemple.test';
    expect(await isSuppressed(client)).toBe(false); // pas encore

    await addSuppression({ email: client, reason: 'hard_bounce', source: 'stalwart' });

    expect(await isSuppressed(client)).toBe(true);
    const row = await db().query.emailSuppression.findFirst({ where: (t) => eq(t.email, client) });
    expect(row!.reason).toBe('hard_bounce');
  });
});
