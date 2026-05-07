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
