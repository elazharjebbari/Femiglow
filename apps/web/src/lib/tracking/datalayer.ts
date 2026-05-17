import type { TrackingConsentState } from '@/lib/db/types';

export interface DataLayerEntry {
  event: string;
  event_id: string;
  timestamp: string;
  schema_version: number;
  consent: TrackingConsentState;
  page: { url: string; path: string; title: string; referrer: string; locale: string };
  user: { anonymous_id: string; session_id: string; user_id?: string };
  source?: { component_id?: string; component_name?: string; page_id?: string };
  context?: Record<string, unknown>;
  params?: Record<string, unknown>;
  /**
   * Bloc Enhanced Conversions (Google Ads) / Advanced Matching (Meta).
   * Champs SHA-256 (hex). Format aligné sur la spec Google Ads :
   * https://support.google.com/google-ads/answer/13262500
   */
  user_data?: {
    sha256_email_address?: string;
    sha256_phone_number?: string;
    address?: {
      sha256_first_name?: string;
      sha256_last_name?: string;
      city?: string;
      country?: string;
    };
  };
  /**
   * Plain-text identity for client-side pixel Advanced Matching
   * (Snap snaptr, Meta fbq). NOT sent to /api/track server-side.
   */
  identity?: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    country?: string;
  };
  /**
   * Attribution multi-canal — résultat de la stratégie active appliquée
   * sur le snapshot du visiteur. Consommé par les conditions GTM pour
   * gater les tags de conversion. Cf. docs/tracking-attribution/.
   */
  attribution?: {
    channel: string;       // AttributionChannel | 'broadcast'
    is_paid: boolean;
    strategy: string;      // AttributionStrategy
    reason: string;        // debug
    click_id?: string;
    click_id_field?: string;
    utm?: {
      source?: string;
      medium?: string;
      campaign?: string;
      term?: string;
      content?: string;
    };
  };
}

const MAX_BUFFER = 200;

interface DataLayerLike {
  push: (entry: DataLayerEntry | Record<string, unknown>) => void;
  recent: (count?: number) => DataLayerEntry[];
  flush: () => DataLayerEntry[];
  size: () => number;
}

export type DataLayer = DataLayerLike & {
  readonly entries: DataLayerEntry[];
};

declare global {
  interface Window {
    femiglowDataLayer?: DataLayer;
    dataLayer?: Array<Record<string, unknown>>;
    /** Pixel ID Snap — positionné par le snippet d'init, lu par SnapPixelEvents. */
    __fg_snap_pixel_id?: string;
  }
}

export function getDataLayer(): DataLayer {
  if (typeof window === 'undefined') {
    return createDataLayer();
  }
  if (!window.femiglowDataLayer) {
    window.femiglowDataLayer = createDataLayer();
  }
  if (!window.dataLayer) window.dataLayer = [];
  return window.femiglowDataLayer;
}

function createDataLayer(): DataLayer {
  const entries: DataLayerEntry[] = [];
  return {
    entries,
    push(entry) {
      entries.push(entry as DataLayerEntry);
      if (typeof window !== 'undefined' && window.dataLayer) {
        window.dataLayer.push(entry as Record<string, unknown>);
      }
      while (entries.length > MAX_BUFFER) entries.shift();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('fg:datalayer-push', { detail: entry }));
      }
    },
    recent(count = 20) {
      return entries.slice(Math.max(0, entries.length - count));
    },
    flush() {
      const out = entries.slice();
      entries.length = 0;
      return out;
    },
    size() {
      return entries.length;
    },
  };
}
