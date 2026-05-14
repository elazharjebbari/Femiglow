/**
 * Seed canonique pour le TrackingPlan v2.
 *
 * Génère un `TrackingPlanInput` pré-rempli depuis le catalogue applicatif
 * (`src/lib/tracking/event-catalog.ts`) en mappant les noms de providers
 * legacy (`google_ga4`, `google_ads`, `snap`, `pinterest`) vers les
 * `ProviderId` v2 (`ga4`, `googleAds`, `meta`, `tiktok`, `gtm`).
 *
 * Les providers non-supportés en v2 (snap, pinterest) sont ignorés.
 * GTM n'est pas dans le catalogue applicatif (c'est un container, pas une
 * destination) ; il reste désactivé par défaut.
 */
import { EVENT_CATALOG, type EventCatalogEntry } from '@/lib/tracking/event-catalog';
import type { ProviderId, TrackingEvent, TrackingPlanInput } from './types';

const LEGACY_TO_V2: Record<string, ProviderId> = {
  google_ga4: 'ga4',
  google_ads: 'googleAds',
  meta: 'meta',
  tiktok: 'tiktok',
};

function mapProviders(legacy: readonly string[]): Record<ProviderId, boolean> {
  const out: Partial<Record<ProviderId, boolean>> = {};
  for (const id of legacy) {
    const v2 = LEGACY_TO_V2[id];
    if (v2) out[v2] = true;
  }
  return out as Record<ProviderId, boolean>;
}

function toCanonicalEvent(entry: EventCatalogEntry): TrackingEvent {
  return {
    key: entry.name,
    label: entry.description,
    providers: mapProviders(entry.defaultProviders),
  };
}

export interface CanonicalSeedOptions {
  name?: string;
  includeServerOnly?: boolean;
}

export function buildCanonicalSeed(options: CanonicalSeedOptions = {}): TrackingPlanInput {
  const { name = 'Plan canonique FemiGlow', includeServerOnly = true } = options;

  const events: TrackingEvent[] = EVENT_CATALOG
    .filter((entry) => includeServerOnly || entry.scope !== 'server')
    .map(toCanonicalEvent);

  return {
    name,
    providers: [
      { id: 'ga4', active: true },
      { id: 'googleAds', active: true },
      { id: 'meta', active: true },
      { id: 'tiktok', active: true },
      { id: 'gtm', active: false },
    ],
    envProfiles: [{ env: 'production', config: {} }],
    events,
    settings: {
      consentMode: 'v2',
      consentDefaults: {
        ad_storage: 'denied',
        analytics_storage: 'denied',
      },
    },
  };
}

export function canonicalEventKeys(): string[] {
  return EVENT_CATALOG.map((e) => e.name);
}
