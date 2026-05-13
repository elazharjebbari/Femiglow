/**
 * CHAT-055 — Pure builder du funnel "Business" du chat.
 *
 * Pourquoi
 * ────────
 * Les agrégats viennent de tables séparées (chat_session, chat_message,
 * chat_conversation_event, chat_lead). On centralise ici le calcul des
 * pourcentages "% du palier précédent" + le ratio North Star (orders / sessions)
 * pour pouvoir tester sans Postgres et garder la page RSC sèche.
 *
 * Source de la définition des paliers : `07-analytics/dashboards.md §B2`.
 */
export interface FunnelCounts {
  sessions: number;
  messagesUserSessions: number;
  leadsOffered: number;
  leadsSubmitted: number;
  conversions: number;
}

export interface FunnelStep {
  key: 'sessions' | 'messagesUser' | 'leadsOffered' | 'leadsSubmitted' | 'conversions';
  label: string;
  value: number;
  /** Ratio par rapport à l'étape précédente (0..1) ; null pour la première. */
  fromPrev: number | null;
  /** Ratio par rapport à la base (sessions). */
  fromBase: number;
}

export interface FunnelSummary {
  steps: FunnelStep[];
  /** Conversion rate = orders / sessions (north star Business). */
  conversionRate: number;
}

/** Division défensive : 0 si dénominateur null / zéro / négatif. */
function safeRatio(num: number, denom: number): number {
  if (!Number.isFinite(num) || !Number.isFinite(denom) || denom <= 0) return 0;
  return num / denom;
}

export function buildFunnel(counts: FunnelCounts): FunnelSummary {
  const base = counts.sessions;
  const steps: FunnelStep[] = [
    {
      key: 'sessions',
      label: 'Sessions ouvertes',
      value: counts.sessions,
      fromPrev: null,
      fromBase: counts.sessions > 0 ? 1 : 0,
    },
    {
      key: 'messagesUser',
      label: '≥ 1 message utilisateur',
      value: counts.messagesUserSessions,
      fromPrev: safeRatio(counts.messagesUserSessions, counts.sessions),
      fromBase: safeRatio(counts.messagesUserSessions, base),
    },
    {
      key: 'leadsOffered',
      label: 'LeadForm proposé',
      value: counts.leadsOffered,
      fromPrev: safeRatio(counts.leadsOffered, counts.messagesUserSessions),
      fromBase: safeRatio(counts.leadsOffered, base),
    },
    {
      key: 'leadsSubmitted',
      label: 'Lead soumis',
      value: counts.leadsSubmitted,
      fromPrev: safeRatio(counts.leadsSubmitted, counts.leadsOffered),
      fromBase: safeRatio(counts.leadsSubmitted, base),
    },
    {
      key: 'conversions',
      label: 'Conversion attribuée',
      value: counts.conversions,
      fromPrev: safeRatio(counts.conversions, counts.leadsSubmitted),
      fromBase: safeRatio(counts.conversions, base),
    },
  ];
  return { steps, conversionRate: safeRatio(counts.conversions, base) };
}

/**
 * Distribution d'intents — input : compteurs par clé d'intent. Output : tri
 * desc avec part (0..1). On garde la liste complète, c'est l'UI qui décide
 * où couper (top 10 typiquement).
 */
export interface IntentShare {
  intent: string;
  count: number;
  share: number;
}

export function buildIntentShares(counts: Record<string, number>): IntentShare[] {
  const entries = Object.entries(counts).filter(([, v]) => v > 0);
  const total = entries.reduce((acc, [, v]) => acc + v, 0);
  if (total === 0) return [];
  return entries
    .map(([intent, count]) => ({ intent, count, share: count / total }))
    .sort((a, b) => b.count - a.count);
}
