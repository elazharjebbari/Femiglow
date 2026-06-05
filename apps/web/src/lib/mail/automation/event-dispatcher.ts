/**
 * Event trigger dispatcher (chantier 1.7 — moteur d'automations câblé).
 *
 * ── Le défaut corrigé ────────────────────────────────────────────────────
 * Avant ce module, `email_automation.triggerType` / `triggerConfig` /
 * `triggerConditions` étaient persistés par le wizard puis JAMAIS lus par le
 * runtime. Le seul déclencheur câblé était l'appel en dur à
 * `triggerAutomation('cart-abandoned-1h', …)` depuis le cart-abandon-scanner.
 * Toute automation créée dans l'UI était donc INERTE.
 *
 * ── Ce que fait le dispatcher ────────────────────────────────────────────
 * À chaque tick du cron, on lit les automations actives, on regarde leur
 * `triggerType` et on matche les `user_event` récents :
 *
 *   triggerType='event'        → match `eventName === triggerConfig.eventName`
 *   triggerType='subscription' → match l'event `newsletter.subscribed`
 *                                 (ou `triggerConfig.eventName` si fourni)
 *   triggerType='schedule'     → PAS piloté par le scan d'events ; log structuré
 *                                 (nécessite l'évaluation d'une expression cron +
 *                                  l'enrôlement d'audience — hors périmètre 1.7)
 *   triggerType='webhook'      → PAS piloté par le scan d'events ; log structuré
 *                                 (push externe signé — entrant, pas un tick)
 *
 * Pour chaque event matché, si `triggerConditions` est non vide on évalue la
 * condition contre le lead (via `evaluateConditionAgainstUser`) avant d'enrôler.
 *
 * ── Idempotence (anti-doublon, oracle AUT-INT idempotence) ───────────────
 * On délègue l'idempotence à `triggerAutomation` : `dedupeKey = event:<eventId>`.
 * Le même `user_event` (même id bigserial) ne crée donc JAMAIS deux runs, même
 * si deux ticks se chevauchent ou si la fenêtre de lookback recouvre l'event
 * plusieurs fois. C'est le filet qui rend le scan « depuis le dernier tick »
 * robuste SANS table de watermark dédiée (schema réservé au chantier suivant).
 *
 * ── Fenêtre de scan ──────────────────────────────────────────────────────
 * On scanne les `user_event` dont `ts >= now - lookbackMs`. Le lookback couvre
 * largement l'intervalle de cron (60s) avec marge ; l'idempotence par eventId
 * garantit qu'un recouvrement ne produit pas de doublon. Cf. `dedupeWindowMs`
 * passé à `triggerAutomation` : il doit être >= lookback pour que la dédup tienne.
 */
import 'server-only';
import { and, gte, inArray, sql } from 'drizzle-orm';
import { db as getDb } from '@/lib/db/client';
import { emailAutomation } from '@/lib/db/schema-emails';
import { userEvent } from '@/lib/db/schema';
import { logger } from '@/lib/logging/logger';
import { triggerAutomation } from './triggers';
import { evaluateConditionAgainstUser } from './condition-evaluator';
import { CANCELLING_EVENTS, cancelSupersededRuns } from './cancel-on-event';
import type { RulesGroup } from '@/lib/mail/audiences/rules-types';

function requireDb() {
  const drizzle = getDb();
  if (!drizzle) throw new Error('Database not configured');
  return drizzle;
}

/** Lookback par défaut : 1h. >> intervalle cron (60s) ; l'idempotence couvre le recouvrement. */
const DEFAULT_LOOKBACK_MS = 60 * 60_000;

/** Fenêtre de dédup `triggerAutomation` : 25h, >= lookback, couvre les re-scans. */
const DEDUPE_WINDOW_MS = 25 * 60 * 60_000;

export type DispatchResult = {
  /** Nombre d'automations actives examinées. */
  automations: number;
  /** Nombre d'events scannés dans la fenêtre. */
  eventsScanned: number;
  /** Nombre de runs effectivement enrôlés (status='enqueued'). */
  enrolled: number;
  /** Nombre de matches ignorés par idempotence (duplicate). */
  deduped: number;
  /** Nombre de matches bloqués par triggerConditions non satisfaites. */
  conditionBlocked: number;
  /** Nombre de runs annulés car rendus caducs par un événement antagoniste (R-027). */
  cancelledSuperseded: number;
};

type ActiveAutomation = {
  id: string;
  slug: string;
  triggerType: 'event' | 'schedule' | 'subscription' | 'webhook';
  triggerConfig: Record<string, unknown> | null;
  triggerConditions: RulesGroup | null;
};

type ScannedEvent = {
  id: number;
  email: string;
  eventName: string;
  properties: Record<string, unknown>;
  leadId: string | null;
};

/**
 * Résout le nom d'event qu'une automation surveille en fonction de son type.
 * Retourne null si l'automation n'est PAS pilotable par le scan d'events
 * (schedule / webhook) ou si la config est incomplète.
 */
function watchedEventName(auto: ActiveAutomation): string | null {
  const cfg = auto.triggerConfig ?? {};
  const configured = typeof cfg.eventName === 'string' ? cfg.eventName : null;
  switch (auto.triggerType) {
    case 'event':
      return configured;
    case 'subscription':
      // Une inscription = l'event newsletter.subscribed par défaut.
      return configured ?? 'newsletter.subscribed';
    case 'schedule':
    case 'webhook':
      return null;
    default:
      return null;
  }
}

/**
 * Scanne les `user_event` récents et enrôle un run pour chaque automation
 * active dont le déclencheur matche. Idempotent par eventId.
 *
 * NB : ne lance jamais — chaque automation est isolée dans un try/catch pour
 * qu'une config corrompue ne bloque pas le dispatch des autres (et le tick).
 */
export async function dispatchEventTriggers(
  now: Date = new Date(),
  opts: { lookbackMs?: number } = {},
): Promise<DispatchResult> {
  const drizzle = requireDb();
  const lookbackMs = opts.lookbackMs ?? DEFAULT_LOOKBACK_MS;
  const since = new Date(now.getTime() - lookbackMs);

  const result: DispatchResult = {
    automations: 0,
    eventsScanned: 0,
    enrolled: 0,
    deduped: 0,
    conditionBlocked: 0,
    cancelledSuperseded: 0,
  };

  // 1) Automations actives uniquement (toggle off => triggerAutomation renvoie
  //    'disabled', mais on évite même de scanner pour elles).
  const autos = (await drizzle
    .select({
      id: emailAutomation.id,
      slug: emailAutomation.slug,
      triggerType: emailAutomation.triggerType,
      triggerConfig: emailAutomation.triggerConfig,
      triggerConditions: emailAutomation.triggerConditions,
    })
    .from(emailAutomation)
    .where(sql`${emailAutomation.active} = true`)) as ActiveAutomation[];

  result.automations = autos.length;
  if (autos.length === 0) return result;

  // 2) Quels eventName surveille-t-on ? (et quelles automations pour chacun)
  const watchers = new Map<string, ActiveAutomation[]>();
  for (const auto of autos) {
    const name = watchedEventName(auto);
    if (name === null) {
      if (auto.triggerType === 'schedule' || auto.triggerType === 'webhook') {
        // JAMAIS un silence : on trace pourquoi cette automation n'est pas
        // pilotée par le tick. (Pilotage prévu hors chantier 1.7.)
        logger.info('automation.dispatch.unsupported_trigger', {
          slug: auto.slug,
          triggerType: auto.triggerType,
          reason:
            auto.triggerType === 'schedule'
              ? 'schedule requires cron-expression evaluation + audience enrolment (not driven by event tick)'
              : 'webhook is push-based (inbound signed endpoint), not driven by event tick',
        });
      } else {
        logger.warn('automation.dispatch.missing_event_name', {
          slug: auto.slug,
          triggerType: auto.triggerType,
        });
      }
      continue;
    }
    const list = watchers.get(name) ?? [];
    list.push(auto);
    watchers.set(name, list);
  }

  const watchedNames = [...watchers.keys()];

  // 2b) Événements ANNULATEURS (R-027) : on les scanne aussi pour passer à
  //     `cancelled` les runs encore en attente rendus caducs (ex. order.placed
  //     annule les relances cart.abandoned). Indépendant des watchers d'enrôlement.
  const cancellerNames = [
    ...new Set(Object.values(CANCELLING_EVENTS).flat()),
  ];

  const scannedNames = [...new Set([...watchedNames, ...cancellerNames])];
  if (scannedNames.length === 0) return result;

  // 3) Scanner les events récents pour les noms surveillés + annulateurs.
  const events = (await drizzle
    .select({
      id: userEvent.id,
      email: userEvent.email,
      eventName: userEvent.eventName,
      properties: userEvent.properties,
      leadId: userEvent.leadId,
    })
    .from(userEvent)
    .where(and(gte(userEvent.ts, since), inArray(userEvent.eventName, scannedNames)))
    .orderBy(userEvent.ts)) as ScannedEvent[];

  result.eventsScanned = events.length;

  // 4) Matcher + enrôler ; et annuler les runs caducs sur événement antagoniste.
  for (const ev of events) {
    // 4a-bis) Annulation des runs périmés (R-027). On le fait AVANT l'enrôlement
    //         de ce même event : un order.placed n'enrôle rien lui-même ici, mais
    //         annule les relances cart.abandoned déjà en attente pour ce lead.
    if (cancellerNames.includes(ev.eventName)) {
      try {
        const cancelled = await cancelSupersededRuns(ev.eventName, ev.email, now);
        result.cancelledSuperseded += cancelled.cancelled;
      } catch (err) {
        logger.error('automation.dispatch.cancel_failed', {
          eventId: ev.id,
          eventName: ev.eventName,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const matched = watchers.get(ev.eventName) ?? [];
    for (const auto of matched) {
      try {
        // 4a) triggerConditions (si non vide) : le lead doit satisfaire la règle.
        if (hasConditions(auto.triggerConditions)) {
          const ok = await evaluateConditionAgainstUser(auto.triggerConditions!, ev.email);
          if (!ok) {
            result.conditionBlocked++;
            continue;
          }
        }

        // 4b) Enrôlement idempotent par eventId.
        const ctx = {
          recipientEmail: ev.email,
          eventId: ev.id,
          eventName: ev.eventName,
          ...(ev.leadId ? { leadId: ev.leadId } : {}),
          ...ev.properties,
        };
        const triggered = await triggerAutomation(auto.slug, ctx, {
          dedupeKey: `event:${ev.id}`,
          dedupeWindowMs: DEDUPE_WINDOW_MS,
        });

        if (triggered.status === 'enqueued') result.enrolled++;
        else if (triggered.status === 'duplicate') result.deduped++;
        // 'disabled'/'unknown' ne devraient pas arriver (auto active + existant).
      } catch (err) {
        // Isolation : une automation cassée ne fait pas tomber le dispatch global.
        logger.error('automation.dispatch.match_failed', {
          slug: auto.slug,
          eventId: ev.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  if (result.enrolled > 0 || result.conditionBlocked > 0 || result.cancelledSuperseded > 0) {
    logger.info('automation.dispatch.completed', { ...result });
  }
  return result;
}

/** Une condition est « active » si c'est un RulesGroup avec au moins une sous-condition. */
function hasConditions(conditions: RulesGroup | null): boolean {
  if (!conditions || typeof conditions !== 'object') return false;
  const groups = (conditions as { conditions?: unknown[] }).conditions;
  return Array.isArray(groups) && groups.length > 0;
}
