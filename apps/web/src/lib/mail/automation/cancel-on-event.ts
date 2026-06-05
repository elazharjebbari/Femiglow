/**
 * Annulation de runs « périmés » par un événement antagoniste (R-027).
 *
 * ── Le défaut corrigé ────────────────────────────────────────────────────
 * Une relance « panier abandonné » (trigger `cart.abandoned`) enrôle un run
 * qui patiente (quiet hours, wait, …) avant d'envoyer. Si la cliente ACHÈTE
 * entre-temps (`order.placed`), rien dans le moteur n'annulait le run : la
 * relance partait quand même → email « vous avez oublié votre panier » alors
 * que la commande est payée. (Constat épinglé par le scénario S3-05.)
 *
 * ── Mécanique générique ──────────────────────────────────────────────────
 * On câble une table `trigger → événements annulateurs`. Quand un de ces
 * événements survient pour un lead, on passe à `cancelled` (raison explicite)
 * tous les runs ENCORE EN ATTENTE pour CE lead des automations déclenchées par
 * le trigger correspondant. « Encore en attente » = status `running` ou
 * `waiting_for_event` ET aucune ligne outbox encore produite (le step `send`
 * n'a pas été exécuté). Un run qui a déjà envoyé n'est PAS rétro-annulé.
 *
 * Câblé par défaut : `cart.abandoned` → annulé par `order.placed`.
 *
 * Idempotent et borné : ne touche que les runs des automations dont le
 * `triggerType='event'` matche un slug surveillant le trigger ; aucune
 * écriture si rien ne matche.
 */
import 'server-only';
import { sql } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { logger } from '@/lib/logging/logger';

/**
 * Mapping trigger d'enrôlement → événements qui rendent une relance caduque.
 * Clé = `triggerConfig.eventName` de l'automation enrôlante.
 * Valeurs = noms d'événements qui, s'ils surviennent pour le même lead,
 * annulent les runs encore en attente.
 */
export const CANCELLING_EVENTS: Readonly<Record<string, readonly string[]>> = {
  'cart.abandoned': ['order.placed'],
};

/** Raison consignée sur le run annulé (sémantique stable, lisible dans la timeline). */
export const CANCEL_REASON_PURCHASE = 'purchase_completed';

export type CancelResult = {
  /** Nombre de runs annulés. */
  cancelled: number;
};

/**
 * Quels triggers d'enrôlement sont annulés par `eventName` ?
 * (inverse de CANCELLING_EVENTS). Exporté pour les tests/observabilité.
 */
export function triggersCancelledBy(eventName: string): string[] {
  const out: string[] = [];
  for (const [trigger, cancellers] of Object.entries(CANCELLING_EVENTS)) {
    if (cancellers.includes(eventName)) out.push(trigger);
  }
  return out;
}

/**
 * Annule les runs en attente d'un lead rendus caducs par l'arrivée de
 * `eventName` (ex. `order.placed` annule les relances `cart.abandoned`).
 *
 * - `email` : destinataire concerné (normalisé en interne) ;
 * - `eventName` : l'événement antagoniste qui vient de survenir ;
 * - `now` : horloge injectable (déterminisme test).
 *
 * Ne lance jamais (isolé) — l'ingestion d'événement ne doit pas casser dessus.
 */
export async function cancelSupersededRuns(
  eventName: string,
  email: string,
  now: Date = new Date(),
): Promise<CancelResult> {
  const result: CancelResult = { cancelled: 0 };
  const triggers = triggersCancelledBy(eventName);
  if (triggers.length === 0) return result;

  const drizzle = getDb();
  if (!drizzle) return result;

  const normalized = email.trim().toLowerCase();

  try {
    // Annule en UN seul UPDATE : on cible les runs encore en attente du lead
    // dont l'automation (triggerType='event') surveille un des triggers annulés.
    //   - status running|waiting_for_event ;
    //   - aucune ligne outbox encore produite (le send n'a pas tourné) ;
    //   - raison consignée dans context_json._cancelledReason.
    const nowIso = now.toISOString();
    const triggerList = sql.join(
      triggers.map((t) => sql`${t}`),
      sql`, `,
    );
    const updated = await drizzle.execute(sql`
      UPDATE email_automation_run r
      SET status = 'cancelled',
          finished_at = ${nowIso}::timestamptz,
          next_action_at = NULL,
          awaiting_event_name = NULL,
          awaiting_until = NULL,
          context_json = jsonb_set(
            COALESCE(r.context_json, '{}'::jsonb),
            '{_cancelledReason}',
            to_jsonb(${CANCEL_REASON_PURCHASE}::text),
            true
          )
      FROM email_automation a
      WHERE r.automation_id = a.id
        AND a.trigger_type = 'event'
        AND a.trigger_config->>'eventName' IN (${triggerList})
        AND r.recipient_email = ${normalized}
        AND r.status IN ('running', 'waiting_for_event')
        AND (r.outbox_ids IS NULL OR jsonb_array_length(COALESCE(r.outbox_ids, '[]'::jsonb)) = 0)
      RETURNING r.id;
    `);

    // postgres-js → RowList (array) ; neon-http → { rows }.
    const rows = Array.isArray(updated)
      ? (updated as unknown as { id: string }[])
      : ((updated as unknown as { rows?: { id: string }[] }).rows ?? []);
    result.cancelled = rows.length;

    if (result.cancelled > 0) {
      logger.info('automation.cancel.superseded', {
        eventName,
        email: normalized,
        triggers,
        cancelled: result.cancelled,
        reason: CANCEL_REASON_PURCHASE,
      });
    }
  } catch (err) {
    // Isolation : ne jamais casser le flux d'ingestion d'événement.
    logger.error('automation.cancel.superseded_failed', {
      eventName,
      email: normalized,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}
