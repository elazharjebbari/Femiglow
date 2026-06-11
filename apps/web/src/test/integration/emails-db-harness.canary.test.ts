// @vitest-environment node
/**
 * CANARI — harnais vraie-DB emailing (phase 0.3).
 *
 * Trois oracles métier explicites :
 *  (a) insert + relecture d'une ligne `email_outbox` via drizzle → les colonnes
 *      écrites sont relues à l'identique (le vrai chemin SQL fonctionne).
 *  (b) `truncateEmailTables()` → la table est vide (le reset inter-test marche).
 *  (c) anti-drift générique : les colonnes SQL réelles de `email_outbox`
 *      (information_schema) == les colonnes déclarées par le schéma drizzle.
 *      Si quelqu'un ajoute/renomme une colonne d'un côté seulement, ce test
 *      tombe — c'est le filet qui attrape les drifts de schéma.
 *
 * Lancement (cf. mission) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run src/test/integration/emails-db-harness.canary.test.ts
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getTableColumns } from 'drizzle-orm';

import { createId } from '@/lib/ids';
import { emailOutbox } from '@/lib/db/schema-emails';
import {
  closeTestDb,
  emailsTestDb,
  emailsTestSql,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';

beforeAll(() => {
  // Force la résolution d'URL (et donc le garde-fou femiglow_test) au plus tôt.
  emailsTestDb();
});

beforeEach(async () => {
  await truncateEmailTables();
});

afterAll(async () => {
  await closeTestDb();
});

describeEmailsDb('harnais vraie-DB emailing — canari (phase 0.3)', () => {
  // CKP-DB-001 — insert + relecture d'une ligne email_outbox via drizzle
  it('insère puis relit une ligne email_outbox avec les colonnes attendues', async () => {
    const db = emailsTestDb();
    const id = createId('outbox');
    const idempotencyKey = `idem_${id}`;

    await db.insert(emailOutbox).values({
      id,
      idempotencyKey,
      template: 'welcome',
      templateVersion: 1,
      toEmail: 'cliente@example.ma',
      toName: 'Cliente Test',
      fromEmail: 'no-reply@femiglow-maroc.com',
      subject: 'Bienvenue chez FemiGlow',
      payloadJson: { firstName: 'Salma' },
      status: 'pending',
      attempts: 0,
      maxAttempts: 5,
    });

    const rows = await db.query.emailOutbox.findMany({
      where: (t, { eq }) => eq(t.id, id),
    });

    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.id).toBe(id);
    expect(row.idempotencyKey).toBe(idempotencyKey);
    expect(row.template).toBe('welcome');
    expect(row.templateVersion).toBe(1);
    expect(row.toEmail).toBe('cliente@example.ma');
    expect(row.toName).toBe('Cliente Test');
    expect(row.fromEmail).toBe('no-reply@femiglow-maroc.com');
    expect(row.subject).toBe('Bienvenue chez FemiGlow');
    expect(row.payloadJson).toEqual({ firstName: 'Salma' });
    // status a une valeur par défaut 'pending' côté DB — on l'a passée explicitement.
    expect(row.status).toBe('pending');
    expect(row.attempts).toBe(0);
    expect(row.maxAttempts).toBe(5);
    // createdAt/updatedAt sont remplis par defaultNow() → doivent être des Date valides.
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.updatedAt).toBeInstanceOf(Date);
    expect(Number.isNaN(row.createdAt.getTime())).toBe(false);
  });

  // CKP-DB-002 — truncateEmailTables() vide bien la table
  it('truncateEmailTables() vide email_outbox', async () => {
    const db = emailsTestDb();
    await db.insert(emailOutbox).values({
      id: createId('outbox'),
      idempotencyKey: `idem_${createId('k')}`,
      template: 'welcome',
      templateVersion: 1,
      toEmail: 'a@example.ma',
      fromEmail: 'no-reply@femiglow-maroc.com',
      subject: 'x',
    });

    const before = await db.query.emailOutbox.findMany();
    expect(before.length).toBeGreaterThan(0);

    await truncateEmailTables();

    const after = await db.query.emailOutbox.findMany();
    expect(after).toHaveLength(0);
  });

  // CKP-DB-003 — anti-drift : colonnes SQL réelles == colonnes du schéma drizzle
  it('email_outbox a exactement les colonnes attendues par le schéma drizzle', async () => {
    // Colonnes attendues = noms SQL déclarés dans le schéma drizzle.
    const expectedColumns = Object.values(getTableColumns(emailOutbox))
      .map((c) => c.name)
      .sort();

    // Colonnes réelles = information_schema de la DB de test.
    const pg = emailsTestSql();
    const rows = await pg<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'email_outbox'
      ORDER BY column_name
    `;
    const actualColumns = rows.map((r) => r.column_name).sort();

    // Oracle anti-drift : aucune colonne déclarée n'est absente de la DB,
    // et aucune colonne DB n'est inconnue du schéma drizzle.
    expect(actualColumns).toEqual(expectedColumns);
  });
});
