/**
 * CHAT-067 — Digest email hebdo Care (chat leads des 7 derniers jours).
 *
 * Pourquoi
 * ────────
 * Le manager Care veut un email lundi matin avec ce qui s'est passé sur
 * le chat la semaine précédente — sans devoir se connecter au dashboard.
 * Compte les leads par outcome / trigger, signale les hot leads non
 * traités, et embarque un lien de filtre vers /admin/chat/leads.
 *
 * Sortie
 * ──────
 *  `buildWeeklyDigest({ leads, generatedAt, adminBaseUrl })` retourne
 *  un `RenderedEmail` prêt à être passé au `EmailProvider`. Le sujet
 *  varie selon la présence ou non de hot leads pending.
 *
 * RGPD
 * ────
 * Le contenu textuel embarque les *prénoms* (déjà partagés par le
 * visiteur via formulaire) et le téléphone E.164 *uniquement* pour les
 * leads pending hot (max 5) — l'objet de l'email reste métier. Pas de
 * contenu de message dans le body.
 */
import type { RenderedEmail } from '@/lib/rituals/email-templates';

import type { ChatLeadRow } from '../db/schema';

const HOT_TRIGGERS: ReadonlySet<ChatLeadRow['triggerReason']> = new Set([
  'purchase-intent',
  'explicit-request',
  'inline-contact',
]);

const PENDING_HOT_SAMPLE_MAX = 5;

export interface BuildWeeklyDigestInput {
  leads: ReadonlyArray<ChatLeadRow>;
  generatedAt: Date;
  adminBaseUrl?: string;
  from?: string;
  replyTo?: string;
}

export interface WeeklyDigestSummary {
  total: number;
  pending: number;
  reached: number;
  converted: number;
  discarded: number;
  noAnswer: number;
  hotPending: number;
  byTrigger: Record<string, number>;
  /**
   * KPI Care : nombre de leads pris en charge (handledAt non-null) sur la
   * fenêtre. Sert de dénominateur pour les métriques de temps de réponse.
   */
  handledCount: number;
  /**
   * Médiane du délai (minutes, arrondi entier) entre `createdAt` et
   * `handledAt`. `null` si aucun lead pris en charge.
   *
   * Pourquoi médiane et pas moyenne : un lead pris en charge 3 jours plus
   * tard ne doit pas tirer la moyenne — la médiane reflète la réalité du
   * SLA Care le plus souvent observé.
   */
  medianHandlingMinutes: number | null;
  /**
   * 90ᵉ percentile du délai (minutes). Sert à voir le pire-cas 1-sur-10
   * (KPI cible Care : tous les leads hot traités en < 4h ouvrées).
   */
  p90HandlingMinutes: number | null;
}

function percentile(sorted: ReadonlyArray<number>, p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor(p * sorted.length));
  return sorted[idx]!;
}

function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

export function summarizeWeeklyLeads(
  leads: ReadonlyArray<ChatLeadRow>,
): WeeklyDigestSummary {
  const byTrigger: Record<string, number> = {};
  let pending = 0;
  let reached = 0;
  let converted = 0;
  let discarded = 0;
  let noAnswer = 0;
  let hotPending = 0;
  const handlingMinutes: number[] = [];
  for (const l of leads) {
    byTrigger[l.triggerReason] = (byTrigger[l.triggerReason] ?? 0) + 1;
    switch (l.outcome) {
      case 'pending':
        pending += 1;
        if (HOT_TRIGGERS.has(l.triggerReason)) hotPending += 1;
        break;
      case 'reached':
        reached += 1;
        break;
      case 'converted':
        converted += 1;
        break;
      case 'discarded':
        discarded += 1;
        break;
      case 'no-answer':
        noAnswer += 1;
        break;
    }
    if (l.handledAt) {
      const deltaMs = l.handledAt.getTime() - l.createdAt.getTime();
      if (deltaMs >= 0) handlingMinutes.push(Math.round(deltaMs / 60_000));
    }
  }
  handlingMinutes.sort((a, b) => a - b);
  const handledCount = handlingMinutes.length;
  return {
    total: leads.length,
    pending,
    reached,
    converted,
    discarded,
    noAnswer,
    hotPending,
    byTrigger,
    handledCount,
    medianHandlingMinutes: handledCount > 0 ? percentile(handlingMinutes, 0.5) : null,
    p90HandlingMinutes: handledCount > 0 ? percentile(handlingMinutes, 0.9) : null,
  };
}

export function buildWeeklyDigest(input: BuildWeeklyDigestInput): RenderedEmail {
  const summary = summarizeWeeklyLeads(input.leads);
  const isoDay = input.generatedAt.toISOString().slice(0, 10);
  const subject = summary.hotPending > 0
    ? `[Chat] Digest hebdo — ${summary.total} leads · ${summary.hotPending} hot pending`
    : `[Chat] Digest hebdo — ${summary.total} leads (${isoDay})`;
  const preheader = summary.total === 0
    ? 'Aucun lead chat cette semaine.'
    : `${summary.total} leads · ${summary.converted} conv · ${summary.hotPending} hot pending`;

  const baseUrl = (input.adminBaseUrl ?? '').replace(/\/$/, '');
  const adminLink = baseUrl ? `${baseUrl}/admin/chat/leads` : '/admin/chat/leads';

  const hotPendingSample = input.leads
    .filter(
      (l) => l.outcome === 'pending' && HOT_TRIGGERS.has(l.triggerReason),
    )
    .slice(0, PENDING_HOT_SAMPLE_MAX);

  const lines: string[] = [];
  lines.push(`Digest hebdo chat — semaine du ${isoDay}`);
  lines.push('');
  lines.push(`Total leads      : ${summary.total}`);
  lines.push(`  • Pending      : ${summary.pending}`);
  lines.push(`  • Hot pending  : ${summary.hotPending}`);
  lines.push(`  • Reached      : ${summary.reached}`);
  lines.push(`  • Converted    : ${summary.converted}`);
  lines.push(`  • No answer    : ${summary.noAnswer}`);
  lines.push(`  • Discarded    : ${summary.discarded}`);
  lines.push('');
  if (Object.keys(summary.byTrigger).length > 0) {
    lines.push('Par trigger :');
    for (const [trigger, n] of Object.entries(summary.byTrigger).sort(
      (a, b) => b[1] - a[1],
    )) {
      lines.push(`  • ${trigger.padEnd(20)} ${n}`);
    }
    lines.push('');
  }
  if (summary.handledCount > 0) {
    lines.push(`Temps de prise en charge (${summary.handledCount} traités) :`);
    lines.push(`  • Médiane        : ${formatMinutes(summary.medianHandlingMinutes!)}`);
    lines.push(`  • p90            : ${formatMinutes(summary.p90HandlingMinutes!)}`);
    lines.push('');
  }
  if (hotPendingSample.length > 0) {
    lines.push(`Hot pending à relancer (top ${hotPendingSample.length}) :`);
    for (const l of hotPendingSample) {
      lines.push(
        `  • ${l.firstName} · ${l.phoneE164} · ${l.triggerReason} · ${l.page ?? '—'}`,
      );
    }
    lines.push('');
  }
  lines.push(`Voir la liste : ${adminLink}`);
  lines.push('');
  lines.push('Ce digest est généré automatiquement chaque lundi matin.');

  return {
    subject,
    preheader,
    from: input.from ?? 'FemiGlow Chat <chat@femiglow.local>',
    replyTo: input.replyTo ?? 'care@femiglow.local',
    body: lines.join('\n'),
  };
}
