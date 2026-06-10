/**
 * Formatage & sémantique des KPI du dashboard emailing (`/admin/emails`).
 *
 * Fonctions PURES extraites de `page.tsx` pour être testables en isolation
 * (le RSC `page.tsx` lit la DB et n'est pas montable en jsdom). `page.tsx`
 * importe désormais ces helpers — une seule source de vérité pour le formatage
 * et la sémantique couleur des cartes.
 *
 * Oracles métier couverts (module 01, F-001) :
 *  - `pct(num, 0)` → '—' (jamais 'NaN %' ni division par zéro).
 *  - `fmt(n)` → fr-FR avec séparateur de milliers (espace insécable).
 *  - `deliveredTone()` : la carte « Livrés » passe en ALERTE (rose) quand des
 *    emails partent (`sent ≥ seuil`) mais qu'aucune livraison n'est confirmée
 *    (`delivered = 0`) — signalement de l'anomalie « webhook delivery muet »
 *    (audit F-001), au lieu d'un « 0 » neutre trompeur.
 */
import type { OutboxKpi } from '@/lib/admin/emails/queries';
import { DEFAULT_TIMEZONE } from '@/components/admin/emails/ui/format-datetime';

export type KpiTone = 'neutral' | 'amber' | 'rose' | 'emerald';

/**
 * Seuil d'envois à partir duquel un `delivered = 0` devient suspect.
 * En dessous (très petit volume), 0 livraison confirmée peut être un simple
 * effet de bord de timing webhook ; au-dessus, c'est une anomalie à signaler.
 */
export const DELIVERY_SILENCE_MIN_SENT = 1;

/** Seuil au-delà duquel la file d'attente (`pending`) passe en ton ambre. */
export const PENDING_AMBER_THRESHOLD = 50;

const NF_FR = new Intl.NumberFormat('fr-FR');

/** Formate un entier en fr-FR (séparateur de milliers = espace insécable). */
export function fmt(n: number): string {
  return NF_FR.format(n);
}

/**
 * Pourcentage `num/den` à 1 décimale, suffixé ` %`.
 * Quand `den === 0` → '—' (anti-division-par-zéro ; surtout PAS '0.0 %' ni
 * 'NaN %' qui mentiraient sur l'absence de dénominateur).
 */
export function pct(num: number, den: number): string {
  if (den === 0) return '—';
  return ((num / den) * 100).toFixed(1) + ' %';
}

/**
 * `true` si la carte « Livrés » doit basculer en alerte : des emails ont quitté
 * le pipeline (`sent ≥ seuil`) mais zéro livraison confirmée (`delivered = 0`).
 * Symptôme du webhook Stalwart muet (F-001).
 */
export function isDeliverySilent(sent: number, delivered: number): boolean {
  return sent >= DELIVERY_SILENCE_MIN_SENT && delivered === 0;
}

/** Ton de la carte « Livrés » : rose si livraison silencieuse, sinon neutre. */
export function deliveredTone(kpi: Pick<OutboxKpi, 'sentLast7d' | 'deliveredLast7d'>): KpiTone {
  return isDeliverySilent(kpi.sentLast7d, kpi.deliveredLast7d) ? 'rose' : 'neutral';
}

/** Ton de la carte « Échecs » : ambre dès qu'il y a au moins un échec. */
export function failedTone(failed: number): KpiTone {
  return failed > 0 ? 'amber' : 'neutral';
}

/** Ton de la carte « DLQ » : rose dès qu'une ligne est abandonnée. */
export function dlqTone(dlq: number): KpiTone {
  return dlq > 0 ? 'rose' : 'neutral';
}

/** Ton de la carte « En attente » : ambre quand la file dépasse le seuil cron. */
export function pendingTone(pending: number): KpiTone {
  return pending > PENDING_AMBER_THRESHOLD ? 'amber' : 'neutral';
}

/* ───────────────────────── F03 — dashboard fenêtré ──────────────────────── */

/** Fenêtres exposées par le dashboard (le cockpit garde 1h, jamais ici). */
export type DashboardWindow = '24h' | '7d' | '30d';
export const DASHBOARD_WINDOWS: readonly DashboardWindow[] = ['24h', '7d', '30d'];

/** `?window=` → fenêtre dashboard ; absent OU invalide → '7d' (jamais d'erreur). */
export function parseWindow(raw: string | null | undefined): DashboardWindow {
  return raw === '24h' || raw === '7d' || raw === '30d' ? raw : '7d';
}

/** Libellé court de fenêtre (bandeau, EmptyState, sous-textes). */
export function windowLabel(w: DashboardWindow): string {
  switch (w) {
    case '24h':
      return '24 h';
    case '7d':
      return '7 j';
    case '30d':
      return '30 j';
  }
}

/** Libellé de la période de comparaison (« vs … »). */
export const PERIOD_LABEL: Record<DashboardWindow, string> = {
  '24h': '24 h préc.',
  '7d': '7 j préc.',
  '30d': '30 j préc.',
};

/** Durée de chaque fenêtre (aligné sur windowToMs du summary). */
export const WINDOW_MS: Record<DashboardWindow, number> = {
  '24h': 86_400_000,
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
};

/**
 * Heure courte Casablanca : 'HH:MM' ; au-delà de 24 h d'âge, 'JJ/MM HH:MM'
 * (une heure seule mentirait sur le jour).
 */
export function fmtClock(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const hm = new Intl.DateTimeFormat('fr-FR', {
    timeZone: DEFAULT_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
  if (now.getTime() - d.getTime() <= 24 * 3_600_000) return hm;
  const dm = new Intl.DateTimeFormat('fr-FR', {
    timeZone: DEFAULT_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
  }).format(d);
  return `${dm} ${hm}`;
}

export type DeliveredState = {
  state: 'tracked' | 'silent' | 'untracked';
  value: string;
  sub: string;
  tone: 'neutral' | 'emerald' | 'rose';
  /** Heure du dernier delivered (fmtClock) quand state==='silent', sinon null. */
  silenceSince: string | null;
};

/** Seuil « bonne santé » : ≥ 95 % de livrés sur les envoyés → ton emerald. */
export const DELIVERED_EMERALD_RATIO = 0.95;

/** Lien « diagnostiquer » de l'état E2 (consommé par la carte Livrés). */
export const DELIVERED_SILENT_DIAGNOSE_HREF =
  '/admin/emails/transactional?status=sent,delivered&from=health&check=deliveredFreshness';

/**
 * Machine à 3 états de la carte « Livrés » (spec F03 §2) — gardes mutuellement
 * exclusives et couvrantes :
 *  - E1 tracked   : delivered > 0 (le webhook parle) ;
 *  - E2 silent    : des envois, zéro livraison, webhook DÉJÀ vu → alerte rose ;
 *  - E3 untracked : aucun envoi, OU webhook jamais armé → '—' neutre (pas
 *    d'alarme sur un système jamais branché — TRV-04).
 */
export function deliveredState(
  input: { sent: number; delivered: number; webhookLastSuccessAt: string | null },
  now: Date = new Date(),
): DeliveredState {
  const { sent, delivered, webhookLastSuccessAt } = input;
  if (delivered > 0) {
    return {
      state: 'tracked',
      value: fmt(delivered),
      sub: `${pct(delivered, sent)} des envoyés`,
      tone: sent > 0 && delivered / sent >= DELIVERED_EMERALD_RATIO ? 'emerald' : 'neutral',
      silenceSince: null,
    };
  }
  if (sent > 0 && webhookLastSuccessAt != null) {
    const clock = fmtClock(webhookLastSuccessAt, now);
    return {
      state: 'silent',
      value: '0',
      sub: `webhook muet depuis ${clock}`,
      tone: 'rose',
      silenceSince: clock,
    };
  }
  return { state: 'untracked', value: '—', sub: 'non suivi', tone: 'neutral', silenceSince: null };
}

/**
 * Tendance « vs période précédente » avec POLARITÉ : une hausse d'échecs est
 * mauvaise (rose), une hausse de livrés est bonne (emerald) — jamais de vert
 * mécanique sur un « + ».
 */
export function trendLabel(
  pctValue: number | undefined,
  periodLabel: string,
  polarity: 'good' | 'bad',
): { text: string; tone: KpiTone } {
  if (pctValue === undefined) return { text: '—', tone: 'neutral' };
  if (pctValue > 0) {
    return { text: `+${pctValue}% vs ${periodLabel}`, tone: polarity === 'good' ? 'emerald' : 'rose' };
  }
  if (pctValue < 0) {
    return { text: `${pctValue}% vs ${periodLabel}`, tone: polarity === 'good' ? 'rose' : 'emerald' };
  }
  return { text: `= vs ${periodLabel}`, tone: 'neutral' };
}
