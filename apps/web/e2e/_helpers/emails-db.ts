/**
 * emails-db — helpers de seed/cleanup DB pour les specs e2e emailing (Phase 6).
 *
 * Les specs Playwright tournent dans un process séparé du serveur Next ; on
 * ouvre ici une connexion `postgres` (postgres-js) directe sur la DB e2e
 * (`femiglow_test_e2e`) pour seeder l'`email_outbox` / `email_suppression` et
 * poser les oracles DB (relecture après action UI/cron).
 *
 * Cible DB : on dérive l'URL depuis `DATABASE_URL` (.env, chargé par
 * playwright.config.ts) en remplaçant le nom de base `femiglow_emailqa` par
 * `femiglow_test_e2e` — c'est la base WRITABLE clonée que le serveur e2e lit
 * (cf. contexte chantier D). Si `DATABASE_URL` pointe déjà ailleurs, on force
 * quand même le nom `femiglow_test_e2e` pour ne JAMAIS toucher prod/staging.
 *
 * Convention d'isolation : tout ce qu'on seede porte un id/email préfixé
 * `e2e-` ; `cleanupE2eRows()` (afterAll) supprime exactement ces lignes.
 */
import postgres from 'postgres';

/** Préfixe d'isolation : tout id outbox seedé par les specs e2e le porte. */
export const E2E_PREFIX = 'e2e-';

/** Nom de base e2e — garde-fou anti prod/staging. */
const E2E_DB_NAME = 'femiglow_test_e2e';

let _sql: ReturnType<typeof postgres> | null = null;

/**
 * Construit l'URL e2e à partir de `DATABASE_URL` en forçant le nom de base à
 * `femiglow_test_e2e`. Refuse de fonctionner si `DATABASE_URL` est absent.
 */
function e2eDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    throw new Error(
      'DATABASE_URL absent — playwright.config.ts charge .env ; vérifie la présence de DATABASE_URL.',
    );
  }
  // Remplace le segment de chemin (nom de base) par femiglow_test_e2e.
  // On parse l'URL pour ne réécrire QUE le pathname (préserve user/pass/host/qs).
  const u = new URL(raw);
  u.pathname = `/${E2E_DB_NAME}`;
  return u.toString();
}

/** Connexion postgres-js paresseuse (une seule par run de specs). */
export function e2eSql(): ReturnType<typeof postgres> {
  if (!_sql) {
    _sql = postgres(e2eDatabaseUrl(), { max: 4, onnotice: () => {} });
  }
  return _sql;
}

/** Ferme la connexion (afterAll de la dernière spec — best effort). */
export async function closeE2eSql(): Promise<void> {
  if (_sql) {
    await _sql.end({ timeout: 5 });
    _sql = null;
  }
}

// ── Outbox seeding ────────────────────────────────────────────────────────

export type SeedOutboxRow = {
  id: string;
  status:
    | 'pending'
    | 'sending'
    | 'sent'
    | 'delivered'
    | 'opened'
    | 'clicked'
    | 'failed'
    | 'bounced_soft'
    | 'bounced_permanent'
    | 'suppressed'
    | 'dlq';
  template?: string;
  toEmail?: string;
  toName?: string | null;
  subject?: string;
  attempts?: number;
  maxAttempts?: number;
  nextRetry?: Date | null;
  lastError?: string | null;
  source?: string | null;
  htmlSnapshot?: string | null;
  textSnapshot?: string | null;
  createdAt?: Date;
  deliveredAt?: Date | null;
  /**
   * `scheduled_for` futur ⇒ la ligne n'est PAS éligible au pickup du cron
   * (`scheduled_for <= now()` est une condition de claim). Sert à seeder des
   * lignes que l'UI manipule (cockpit) sans qu'un drain cron concurrent
   * (spec mailpit) ne les ramasse et les envoie réellement.
   */
  scheduledFor?: Date | null;
};

/**
 * Insère une (ou plusieurs) ligne(s) outbox. Tous les champs NOT NULL sont
 * remplis par défaut. `id` DOIT être fourni (préfixe e2e- pour cleanup).
 *
 * Les snapshots HTML/text sont remplis par défaut : une ligne `pending` doit
 * les porter pour que le drain cron (`deliverRow`) puisse l'envoyer.
 */
export async function seedOutbox(rows: SeedOutboxRow[]): Promise<void> {
  if (rows.length === 0) return;
  const sql = e2eSql();
  const values = rows.map((r, i) => {
    const createdAt = r.createdAt ?? new Date();
    return {
      id: r.id,
      idempotency_key: `${r.id}-idem-${i}`,
      template: r.template ?? 'welcome-rituel',
      template_version: 1,
      to_email: r.toEmail ?? `${r.id}@exemple.test`,
      to_name: r.toName === undefined ? 'Kaoutar Benani' : r.toName,
      from_email: 'bonjour@femiglow-maroc.com',
      reply_to: 'support@femiglow-maroc.com',
      subject: r.subject ?? 'Bienvenue dans votre rituel FemiGlow',
      payload_json: sql.json({ firstName: 'Kaoutar', montantMad: 490 }),
      html_snapshot:
        r.htmlSnapshot === undefined
          ? '<p>Bonjour, votre rituel vous attend.</p>'
          : r.htmlSnapshot,
      text_snapshot:
        r.textSnapshot === undefined
          ? 'Bonjour, votre rituel vous attend.'
          : r.textSnapshot,
      status: r.status,
      attempts: r.attempts ?? 0,
      max_attempts: r.maxAttempts ?? 5,
      next_retry: r.nextRetry ?? null,
      last_error: r.lastError ?? null,
      source: r.source === undefined ? 'transactional' : r.source,
      delivered_at: r.deliveredAt ?? null,
      scheduled_for: r.scheduledFor ?? null,
      created_at: createdAt,
      updated_at: createdAt,
    };
  });

  // Insert par lots (postgres-js gère bien jusqu'à quelques milliers de lignes
  // par requête ; on découpe à 1000 pour rester sûr sur le nombre de params).
  const CHUNK = 1000;
  for (let i = 0; i < values.length; i += CHUNK) {
    const slice = values.slice(i, i + CHUNK);
    await sql`INSERT INTO email_outbox ${sql(slice)}`;
  }
}

/** Lit le statut + next_retry + attempts d'une ligne outbox (oracle DB). */
export async function readOutboxRow(
  id: string,
): Promise<
  | {
      id: string;
      status: string;
      attempts: number;
      next_retry: Date | null;
      smtp_message_id: string | null;
    }
  | null
> {
  const sql = e2eSql();
  const rows = await sql<
    {
      id: string;
      status: string;
      attempts: number;
      next_retry: Date | null;
      smtp_message_id: string | null;
    }[]
  >`SELECT id, status, attempts, next_retry, smtp_message_id
      FROM email_outbox WHERE id = ${id}`;
  return rows[0] ?? null;
}

/** Lit next_retry pour un ensemble d'ids (oracle bulk-retry). */
export async function readNextRetryByIds(
  ids: string[],
): Promise<Map<string, Date | null>> {
  const sql = e2eSql();
  if (ids.length === 0) return new Map();
  const rows = await sql<
    { id: string; next_retry: Date | null; status: string }[]
  >`SELECT id, next_retry, status FROM email_outbox WHERE id IN ${sql(ids)}`;
  return new Map(rows.map((r) => [r.id, r.next_retry]));
}

/** Lit la ligne complète (status + next_retry) pour les ids fournis. */
export async function readOutboxByIds(
  ids: string[],
): Promise<Map<string, { status: string; next_retry: Date | null }>> {
  const sql = e2eSql();
  if (ids.length === 0) return new Map();
  const rows = await sql<
    { id: string; next_retry: Date | null; status: string }[]
  >`SELECT id, next_retry, status FROM email_outbox WHERE id IN ${sql(ids)}`;
  return new Map(rows.map((r) => [r.id, { status: r.status, next_retry: r.next_retry }]));
}

// ── Suppression oracle ──────────────────────────────────────────────────

export async function countSuppression(email: string): Promise<number> {
  const sql = e2eSql();
  const rows = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM email_suppression WHERE email = ${email.toLowerCase()}`;
  return rows[0]?.n ?? 0;
}

export async function readSuppression(
  email: string,
): Promise<{ email: string; reason: string; source: string; detail: string | null } | null> {
  const sql = e2eSql();
  const rows = await sql<
    { email: string; reason: string; source: string; detail: string | null }[]
  >`SELECT email, reason, source, detail FROM email_suppression WHERE email = ${email.toLowerCase()}`;
  return rows[0] ?? null;
}

export async function deleteSuppression(email: string): Promise<void> {
  const sql = e2eSql();
  await sql`DELETE FROM email_suppression WHERE email = ${email.toLowerCase()}`;
}

export type SeedSuppressionRow = {
  email: string;
  reason?: 'hard_bounce' | 'soft_bounce_repeated' | 'complaint' | 'unsubscribe' | 'manual_admin' | 'cndp_request' | 'invalid_format';
  source?: 'stalwart' | 'listmonk' | 'manual' | 'cndp';
  detail?: string | null;
  since?: Date;
};

/**
 * Insère des adresses en suppression (specs socle F01 : l'écran pilote
 * SuppressionList opère dessus). Emails préfixés e2e- par convention ;
 * upsert idempotent (PK = email) pour tolérer un run interrompu.
 */
export async function seedSuppression(rows: SeedSuppressionRow[]): Promise<void> {
  if (rows.length === 0) return;
  const sql = e2eSql();
  for (const r of rows) {
    await sql`
      INSERT INTO email_suppression (email, reason, detail, since, source)
      VALUES (${r.email.toLowerCase()}, ${r.reason ?? 'hard_bounce'}, ${r.detail ?? null},
              ${r.since ?? new Date()}, ${r.source ?? 'manual'})
      ON CONFLICT (email) DO UPDATE SET reason = EXCLUDED.reason, source = EXCLUDED.source`;
  }
}

/** Compte les adresses de suppression matchant un préfixe (oracle SM-F01-02). */
export async function countSuppressionByPrefix(prefix: string): Promise<number> {
  const sql = e2eSql();
  const rows = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM email_suppression WHERE email LIKE ${prefix + '%'}`;
  return rows[0]?.n ?? 0;
}

/** Purge les suppressions seedées par préfixe (cleanup scopé par spec). */
export async function cleanupSuppressionByPrefix(prefix: string): Promise<void> {
  const sql = e2eSql();
  await sql`DELETE FROM email_suppression WHERE email LIKE ${prefix + '%'}`;
}

// ── Cleanup ─────────────────────────────────────────────────────────────

/**
 * Supprime les lignes outbox seedées dont l'id commence par `prefix` (+ events
 * liés), et optionnellement des suppressions par email.
 *
 * IMPORTANT — isolation inter-specs : Playwright exécute les fichiers de specs
 * EN PARALLÈLE (plusieurs workers). Un cleanup global `e2e-%` effacerait les
 * lignes d'une AUTRE spec en cours (p.ex. la dashboard wipait les 5 000 lignes
 * du cockpit, et réciproquement les delivered de la dashboard → KPI=0). Chaque
 * spec passe DONC son propre préfixe (`e2e-dash-`, `e2e-cock-`, `e2e-mailpit-`)
 * pour ne purger QUE ses propres lignes. Le défaut `E2E_PREFIX` reste dispo
 * pour un nettoyage exhaustif hors exécution concurrente.
 */
export async function cleanupE2eRows(
  emails: string[] = [],
  prefix: string = E2E_PREFIX,
): Promise<void> {
  const sql = e2eSql();
  // email_event référence outbox (ON DELETE CASCADE) — on supprime quand même
  // explicitement par sécurité si la FK n'est pas en place.
  await sql`DELETE FROM email_event WHERE outbox_id LIKE ${prefix + '%'}`;
  await sql`DELETE FROM email_outbox WHERE id LIKE ${prefix + '%'}`;
  for (const email of emails) {
    await sql`DELETE FROM email_suppression WHERE email = ${email.toLowerCase()}`;
  }
}
