/**
 * Kit CRO v2 §1 — Web Vitals réels (RUM) → `/api/track` (`web_vitals`).
 *
 * Fonctions **pures** (aucun accès `window`/`document`) : échantillonnage par
 * route, mise en forme des métriques et construction du lot envoyé. Le
 * composant `WebVitalsReporter` ne fait que brancher ces briques sur
 * `useReportWebVitals` et `sendBeacon`.
 *
 * Choix :
 *  - 100 % des pages `/kit` (landing publicitaire, cœur du chantier vitesse),
 *    20 % ailleurs (volume `tracking_events_log` maîtrisé) ;
 *  - `sample_rate` stocké avec chaque mesure → pondération possible à
 *    l'agrégation ;
 *  - jamais sur l'admin ni les routes API ;
 *  - événement first-party uniquement (cf. `first-party-events.ts`).
 *
 * @see docs/kit-cro-v2/DESIGN.md §1
 */
import { isLocale } from '@/i18n.config';
import type { TrackingConsentState } from '@/lib/db/types';
import type { DataLayerEntry } from '@/lib/tracking/datalayer';
import { uuidv7 } from '@/lib/tracking/uuid';

export const WEB_VITALS_EVENT = 'web_vitals';

export const REPORTED_WEB_VITALS = ['LCP', 'FCP', 'CLS', 'INP', 'TTFB'] as const;
export type WebVitalName = (typeof REPORTED_WEB_VITALS)[number];

export type WebVitalRating = 'good' | 'needs-improvement' | 'poor';

/** Taux d'échantillonnage sur la landing `/kit` (toutes locales). */
export const KIT_SAMPLE_RATE = 1;
/** Taux d'échantillonnage sur les autres pages publiques. */
export const DEFAULT_SAMPLE_RATE = 0.2;

/** Sous-ensemble de la métrique fournie par `next/web-vitals`. */
export interface ReportedMetric {
  name: string;
  value: number;
  rating?: string;
  navigationType?: string;
  id?: string;
}

/** Paramètres de l'événement `web_vitals` (cf. `eventSchemas.web_vitals`). */
export interface WebVitalParams {
  name: WebVitalName;
  value: number;
  rating?: WebVitalRating;
  navigation_type?: string;
  page_route: string;
  metric_id?: string;
  sample_rate: number;
}

const REPORTED_SET: ReadonlySet<string> = new Set(REPORTED_WEB_VITALS);
const RATINGS: ReadonlySet<string> = new Set(['good', 'needs-improvement', 'poor']);

function segmentsOf(pathname: string): string[] {
  return pathname.split('/').filter(Boolean);
}

/**
 * `true` pour `/kit`, `/kit/…`, `/{locale}/kit` et `/{locale}/kit/…`.
 * `/kitchen` n'est pas une route kit.
 */
export function isKitRoute(pathname: string): boolean {
  const segments = segmentsOf(pathname);
  const first = segments[0];
  if (first === 'kit') return true;
  return isLocale(first) && segments[1] === 'kit';
}

/** Pages publiques uniquement : ni admin, ni routes API. */
export function isReportableRoute(pathname: string): boolean {
  const first = segmentsOf(pathname)[0];
  return first !== 'admin' && first !== 'api';
}

/** Taux d'échantillonnage applicable à une route (0 = jamais). */
export function sampleRateForRoute(pathname: string): number {
  if (!isReportableRoute(pathname)) return 0;
  return isKitRoute(pathname) ? KIT_SAMPLE_RATE : DEFAULT_SAMPLE_RATE;
}

/** Tirage d'échantillonnage (une fois par chargement de page). */
export function isSampledIn(rate: number, random: () => number = Math.random): boolean {
  if (rate <= 0) return false;
  if (rate >= 1) return true;
  return random() < rate;
}

/** CLS est un score sans unité (≈ 0,0x) → 4 décimales ; le reste en ms entières. */
export function roundMetricValue(name: WebVitalName, value: number): number {
  if (name === 'CLS') return Math.round(value * 10_000) / 10_000;
  return Math.round(value);
}

/**
 * Met en forme une métrique pour l'événement `web_vitals`, ou `null` si elle
 * n'est pas suivie (ex. `FID`, métriques Next.js custom) ou invalide.
 */
export function shapeWebVitalParams(
  metric: ReportedMetric,
  pageRoute: string,
  sampleRate: number,
): WebVitalParams | null {
  if (!REPORTED_SET.has(metric.name)) return null;
  if (!Number.isFinite(metric.value) || metric.value < 0) return null;
  const name = metric.name as WebVitalName;
  const params: WebVitalParams = {
    name,
    value: roundMetricValue(name, metric.value),
    page_route: pageRoute.slice(0, 300) || '/',
    sample_rate: sampleRate,
  };
  if (metric.rating && RATINGS.has(metric.rating)) {
    params.rating = metric.rating as WebVitalRating;
  }
  if (metric.navigationType) params.navigation_type = metric.navigationType.slice(0, 40);
  if (metric.id) params.metric_id = metric.id.slice(0, 80);
  return params;
}

export interface WebVitalsEnvelope {
  consent: TrackingConsentState;
  user: DataLayerEntry['user'];
  page: DataLayerEntry['page'];
  now?: number;
}

/** Un événement par métrique, au format attendu par `/api/track`. */
export interface WebVitalsEvent {
  event: typeof WEB_VITALS_EVENT;
  event_id: string;
  timestamp: string;
  schema_version: 1;
  consent: TrackingConsentState;
  page: DataLayerEntry['page'];
  user: DataLayerEntry['user'];
  params: WebVitalParams;
}

/** Lot `{ events: [...] }` prêt à être sérialisé pour `/api/track`. */
export function buildWebVitalsBatch(
  metrics: readonly WebVitalParams[],
  envelope: WebVitalsEnvelope,
): { events: WebVitalsEvent[] } {
  const now = envelope.now ?? Date.now();
  const timestamp = new Date(now).toISOString();
  return {
    events: metrics.map((params) => ({
      event: WEB_VITALS_EVENT,
      event_id: uuidv7(now),
      timestamp,
      schema_version: 1,
      consent: envelope.consent,
      page: envelope.page,
      user: envelope.user,
      params,
    })),
  };
}

/** `/api/track` rejette un lot quand analytics ET ads sont refusés. */
export function consentAllowsWebVitals(consent: TrackingConsentState): boolean {
  return !(consent.analytics_storage === 'denied' && consent.ad_storage === 'denied');
}
