/**
 * Harnais « vraie-DB » pour les suites d'intégration emailing.
 *
 * — Pourquoi un client dédié plutôt que `db()` de `@/lib/db/client` ? —
 *  `db()` lit `process.env.DATABASE_URL` une seule fois puis met en cache la
 *  connexion (driver Neon vs postgres-js selon l'URL). Pour les suites de test
 *  on veut un client postgres-js explicite, pointé sur une DB de test isolée,
 *  avec les schémas emailing (`schema-emails`) chargés dans le typage drizzle.
 *
 * — POURQUOI `DATABASE_URL` DOIT *AUSSI* POINTER SUR LA DB DE TEST —
 *  Quand une suite exerce un *route handler* (ou n'importe quel code applicatif
 *  qui appelle `db()` de `@/lib/db/client`), c'est `process.env.DATABASE_URL`
 *  qui est lu par la lib — PAS `DATABASE_URL_TEST`. Si seul `DATABASE_URL_TEST`
 *  était positionné, le harnais écrirait dans `femiglow_test` tandis que le code
 *  sous test lirait/écrirait ailleurs (ou en mémoire). Les deux variables
 *  doivent donc converger sur la même DB de test. La résolution d'URL ci-dessous
 *  privilégie `DATABASE_URL_TEST` mais le GARDE-FOU vérifie que l'URL retenue
 *  contient bien `femiglow_test` — protection dure contre prod / emailqa.
 *
 * Lancement type (cf. mission phase 0.3) :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" pnpm vitest run <suite>
 */
import { describe } from 'vitest';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';

import * as schema from '@/lib/db/schema';
import * as schemaEmails from '@/lib/db/schema-emails';

/**
 * Schéma drizzle complet exposé au client de test : tables coeur (`schema`,
 * dont `lead_tag`) + tables emailing (`schema-emails`). Permet `db.query.*`
 * et l'inférence de type sur les deux familles de tables.
 */
const fullSchema = { ...schema, ...schemaEmails };

/**
 * Liste RÉELLE des tables emailing (noms SQL exacts relevés depuis
 * `schema-emails.ts`) + `lead_tag` (nom SQL depuis `schema.ts`). Sert de cible
 * au TRUNCATE. L'ordre n'a pas d'importance grâce à `CASCADE`, mais on garde
 * un ordre lisible : tables « link/meta », puis automation, puis audience, puis
 * outbox/event, puis lead_tag.
 *
 * NB : `email_audience_snapshot_member` et les versions de templates sont
 * couvertes par `CASCADE` mais listées explicitement pour rester robuste si
 * une FK venait à changer.
 */
export const EMAIL_TABLES = [
  'email_outbox',
  'email_event',
  'email_template_meta',
  'email_audience_link',
  'email_campaign_link',
  'email_subscriber_link',
  'email_suppression',
  'email_automation',
  'email_automation_run',
  'email_settings',
  'admin_email_view',
  'email_audience',
  'email_audience_snapshot',
  'email_audience_snapshot_member',
  'email_template_custom',
  'email_template_custom_version',
  'lead_tag',
] as const;

/**
 * Résolution d'URL : `DATABASE_URL_TEST` prioritaire, repli sur `DATABASE_URL`.
 * GARDE-FOU STRICT : l'URL retenue DOIT contenir `femiglow_test`, sinon throw.
 * Protège prod (`femiglow`), staging (`staging_femiglow`) et le clone de
 * référence (`femiglow_emailqa`) contre toute écriture du harnais.
 */
function resolveTestDbUrl(): string {
  const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "[emails-db] Aucune URL de DB de test : positionne DATABASE_URL_TEST (et DATABASE_URL) " +
        "sur femiglow_test avant de lancer la suite. Exemple :\n" +
        "  DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test#')\n" +
        '  DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" pnpm vitest run <suite>',
    );
  }
  if (!url.includes('femiglow_test')) {
    throw new Error(
      `[emails-db] GARDE-FOU : l'URL résolue ne pointe PAS sur une DB femiglow_test ` +
        `(reçu une URL vers une DB nommée différemment). Le harnais TRUNCATE des tables — ` +
        `il refuse de toucher prod / staging / emailqa. Repointe DATABASE_URL_TEST sur ` +
        `femiglow_test (ou un clone femiglow_test_*).`,
    );
  }
  return url;
}

/**
 * `true` si une URL femiglow_test est disponible — SANS throw. Sert au skip
 * honnête des suites vraie-DB dans le run global (`pnpm test` n'a pas de DB) :
 * leur point d'entrée dédié est `pnpm test:emails:integration` (.env.test).
 */
export function hasEmailsTestDb(): boolean {
  const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL ?? '';
  return url.includes('femiglow_test');
}

/**
 * `describe` actif seulement si la DB de test est câblée ; sinon `describe.skip`
 * (visible dans le rapport comme skipped, jamais comme failed). À utiliser pour
 * TOUT describe top-level d'une suite vraie-DB.
 */
export const describeEmailsDb = hasEmailsTestDb() ? describe : describe.skip;

type TestDbClient = ReturnType<typeof postgres>;
type TestDb = ReturnType<typeof drizzle<typeof fullSchema>>;

let clientSingleton: TestDbClient | null = null;
let dbSingleton: TestDb | null = null;

/**
 * Retourne (en le créant à la première fois) le drizzle de test, branché sur la
 * DB femiglow_test via postgres-js (`max: 4`, `prepare: false` — cohérent avec
 * le client applicatif qui désactive les prepared statements).
 */
export function emailsTestDb(): TestDb {
  if (dbSingleton) return dbSingleton;
  const url = resolveTestDbUrl();
  clientSingleton = postgres(url, { prepare: false, max: 4 });
  dbSingleton = drizzle(clientSingleton, { schema: fullSchema });
  return dbSingleton;
}

/** Accès bas-niveau au client postgres-js (pour requêtes brutes type information_schema). */
export function emailsTestSql(): TestDbClient {
  emailsTestDb();
  // clientSingleton est garanti non-null après emailsTestDb().
  return clientSingleton as TestDbClient;
}

/**
 * Vide toutes les tables emailing (+ lead_tag). `RESTART IDENTITY` réinitialise
 * les séquences (ex. `email_event.id` bigserial) ; `CASCADE` purge les tables
 * dépendantes par FK. À appeler en `beforeEach`/`afterEach` des suites vraie-DB.
 */
export async function truncateEmailTables(): Promise<void> {
  const db = emailsTestDb();
  const tableList = EMAIL_TABLES.join(', ');
  await db.execute(
    sql.raw(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`),
  );
}

/** Ferme la connexion postgres-js (à appeler en `afterAll`). Idempotent. */
export async function closeTestDb(): Promise<void> {
  if (clientSingleton) {
    await clientSingleton.end({ timeout: 5 });
  }
  clientSingleton = null;
  dbSingleton = null;
}
