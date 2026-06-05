/**
 * Heartbeat des crons emailing — F-002 (angle mort « cron muet »).
 *
 * Le badge santé historique ne « voyait » que l'intérieur de l'outbox. Si le
 * timer systemd du cron `email-outbox` disparaît (déploiement single-instance,
 * pas de scheduler managé), le drain s'arrête : les `pending` ne sont jamais
 * ramassés MAIS rien n'est en `sending` ni `dlq` — l'outbox « gèle » en silence
 * et le badge restait vert (cf. scénario 3 du module 01).
 *
 * Mécanisme RETENU : un horodatage de tick persisté dans la table EXISTANTE
 * `email_settings` (key/json/updated_at) — ADDITIF, aucune migration. Chaque
 * exécution du cron écrit `cron:<name>:last_tick`. Le health check lit cet
 * horodatage : « pas de tick récent » ⇒ le cron est mort, MÊME SUR FILE VIDE
 * (c'est exactement le symptôme qu'aucun comptage de lignes ne peut détecter).
 *
 * On préfère `email_settings` à une nouvelle table car (1) elle existe déjà,
 * (2) c'est un magasin clé/valeur générique fait pour ce genre de métadonnée
 * d'exploitation, (3) zéro migration destructive.
 */
import { eq, sql } from 'drizzle-orm';
import { emailSettings } from '@/lib/db/schema-emails';

/** Clé settings pour le heartbeat d'un cron donné. */
export function cronHeartbeatKey(cron: string): string {
  return `cron:${cron}:last_tick`;
}

/** Cron dont le health check surveille la fraîcheur (le drain de l'outbox). */
export const OUTBOX_CRON_NAME = 'email-outbox';

/**
 * Seuil de fraîcheur du heartbeat outbox : 15 min.
 * Le cron tourne toutes les 60 s → 15 min = ~15 ticks ratés = cron mort.
 * Au-delà, le badge doit ESCALADER (incident) même si la file est vide.
 */
export const CRON_HEARTBEAT_STALE_MS = 15 * 60_000;

type AnyDrizzle = any;

/**
 * Payload persisté à chaque tick. `at` est la source de vérité de la fraîcheur
 * (on n'utilise pas `updated_at` de la ligne pour rester indépendant de l'horloge
 * DB et garder `now` injectable côté écriture comme côté lecture).
 */
export type CronTickPayload = {
  at: string; // ISO
  processed?: number;
  succeeded?: number;
  failed?: number;
};

/**
 * Écrit (upsert) le heartbeat du cron `name`. Idempotent : un double tick
 * écrase simplement l'horodatage (pas de duplication de ligne).
 */
export async function recordCronHeartbeat(
  db: AnyDrizzle,
  name: string,
  payload: Omit<CronTickPayload, 'at'> & { at?: Date } = {},
): Promise<void> {
  const at = (payload.at ?? new Date()).toISOString();
  const json: CronTickPayload = {
    at,
    ...(payload.processed !== undefined ? { processed: payload.processed } : {}),
    ...(payload.succeeded !== undefined ? { succeeded: payload.succeeded } : {}),
    ...(payload.failed !== undefined ? { failed: payload.failed } : {}),
  };
  const key = cronHeartbeatKey(name);
  await db
    .insert(emailSettings)
    .values({ key, json })
    .onConflictDoUpdate({
      target: emailSettings.key,
      set: { json, updatedAt: sql`now()` },
    });
}

/**
 * Lit le dernier tick d'un cron.
 *
 * On distingue DEUX absences :
 *  - `present:false` → AUCUNE ligne heartbeat (mécanisme non encore initialisé,
 *    p.ex. premier déploiement / base de test sans seed). L'appelant ne doit
 *    PAS conclure « cron mort » d'un mécanisme jamais armé.
 *  - `present:true, lastTickAt:Date` → le cron a déjà tické au moins une fois ;
 *    si cet horodatage est trop ancien, le cron est réellement muet.
 *
 * Cette distinction évite les faux incidents sur une base vierge tout en
 * détectant la VRAIE panne (le cron a tourné puis s'est arrêté).
 */
export async function readCronHeartbeat(
  db: AnyDrizzle,
  name: string,
): Promise<{ present: boolean; lastTickAt: Date | null }> {
  const key = cronHeartbeatKey(name);
  const [row] = await db
    .select({ json: emailSettings.json })
    .from(emailSettings)
    .where(eq(emailSettings.key, key))
    .limit(1);
  if (!row) return { present: false, lastTickAt: null };
  const at = (row.json as CronTickPayload | undefined)?.at;
  if (!at) return { present: true, lastTickAt: null };
  const d = new Date(at);
  return { present: true, lastTickAt: Number.isNaN(d.getTime()) ? null : d };
}
