/**
 * CHAT-066 — Pure builder du dashboard Care.
 *
 * Pourquoi
 * ────────
 * Karim (Care) a besoin d'une vue consolidée pour décider sur quoi taper
 * en premier le matin. Deux signaux clés :
 *
 *  1. Combien de leads "hot pending" (purchase-intent / explicit-request /
 *     inline-contact) attendent encore une prise en charge, et combien ont
 *     déjà dépassé le SLA de 4h.
 *  2. Combien d'événements `frustration_detected` ont été émis ces 24h /
 *     7j et sur combien de sessions distinctes — signal de qualité IA.
 *
 * Builder pur → testable sans Postgres, le RSC `/admin/chat/care` lui
 * passe juste des rows déjà fetchées.
 */
import type { ChatLeadRow } from '../db/schema';

import { HOT_TRIGGERS, isHotPendingOverdue } from './lead-sla';

export interface CareFrustrationEvent {
  sessionId: string;
  occurredAt: Date;
}

export interface CareInputs {
  /** Leads dont `outcome='pending'` (déjà filtré côté query). */
  pendingLeads: ReadonlyArray<ChatLeadRow>;
  /** Events `frustration_detected` sur la fenêtre 7j max. */
  frustrationEvents: ReadonlyArray<CareFrustrationEvent>;
  now: Date;
  slaHours?: number;
}

export interface CareSummary {
  /** Tous leads pending (toutes triggers). */
  pendingTotal: number;
  /** Leads pending avec trigger ∈ HOT_TRIGGERS. */
  hotPending: number;
  /** Leads hot pending dont l'âge dépasse le SLA. */
  hotOverdue: number;
  /** Ratio hotOverdue / hotPending (0..1) — 0 si pas de hot pending. */
  hotOverdueRatio: number;
  /** Events frustration_detected sur 24h. */
  frustration24h: number;
  /** Events frustration_detected sur 7j. */
  frustration7d: number;
  /** Sessions distinctes ayant émis ≥ 1 frustration sur 7j. */
  frustrationSessions7d: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function summarizeCare(input: CareInputs): CareSummary {
  const slaHours = input.slaHours;
  let hotPending = 0;
  let hotOverdue = 0;
  for (const lead of input.pendingLeads) {
    if (!HOT_TRIGGERS.has(lead.triggerReason)) continue;
    hotPending += 1;
    if (isHotPendingOverdue(lead, input.now, slaHours)) {
      hotOverdue += 1;
    }
  }
  const since24h = new Date(input.now.getTime() - DAY_MS);
  const since7d = new Date(input.now.getTime() - 7 * DAY_MS);
  let f24 = 0;
  let f7 = 0;
  const sessions7d = new Set<string>();
  for (const ev of input.frustrationEvents) {
    if (ev.occurredAt >= since7d) {
      f7 += 1;
      sessions7d.add(ev.sessionId);
      if (ev.occurredAt >= since24h) f24 += 1;
    }
  }
  return {
    pendingTotal: input.pendingLeads.length,
    hotPending,
    hotOverdue,
    hotOverdueRatio: hotPending > 0 ? hotOverdue / hotPending : 0,
    frustration24h: f24,
    frustration7d: f7,
    frustrationSessions7d: sessions7d.size,
  };
}
