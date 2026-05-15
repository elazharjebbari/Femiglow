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
 *
 * Le seed inclut aussi le squelette des **conversion labels Google Ads**
 * par event (placeholders `''`), pour que l'admin puisse remplir les
 * valeurs réelles via l'UI sans rien créer manuellement. Les clés sont
 * dérivées du mapping (`event-mapping.ts → google_ads.conversionLabelKey`).
 */
import { EVENT_CATALOG, type EventCatalogEntry } from '@/lib/tracking/event-catalog';
import { listAdsConversionEvents } from '@/lib/tracking/providers/event-mapping';
import type { ProviderId, TrackingEvent, TrackingPlanInput } from './types';

const LEGACY_TO_V2: Record<string, ProviderId> = {
  google_ga4: 'ga4',
  google_ads: 'googleAds',
  meta: 'meta',
  tiktok: 'tiktok',
};

/**
 * Squelette des labels de conversion Google Ads. Les valeurs sont
 * vides — l'admin doit les renseigner depuis l'UI ou via l'éditeur
 * du plan (envProfile config). On dérive la liste des clés depuis le
 * mapping pour qu'un nouvel event-conversion soit automatiquement
 * pré-listé dans le seed sans toucher ce fichier.
 */
export function buildDefaultGoogleAdsConversionLabels(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { conversionLabelKey } of listAdsConversionEvents()) {
    if (!(conversionLabelKey in out)) out[conversionLabelKey] = '';
  }
  return out;
}

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
    envProfiles: [
      {
        env: 'production',
        config: {
          // Skeleton conversion-labels — l'admin renseigne les valeurs
          // réelles depuis l'UI. Liste auto-générée depuis le mapping
          // (cf. listAdsConversionEvents()).
          googleAdsConversionLabels: buildDefaultGoogleAdsConversionLabels(),
        },
      },
    ],
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
