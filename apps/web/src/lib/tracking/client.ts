'use client';

import type { TrackingConsentState } from '@/lib/db/types';
import { getDataLayer, type DataLayerEntry } from '@/lib/tracking/datalayer';
import { uuidv7 } from '@/lib/tracking/uuid';
import { readAttributionCookie } from '@/lib/tracking/attribution/cookie';
import { applyStrategy } from '@/lib/tracking/attribution/strategy';
import {
  DEFAULT_ATTRIBUTION_STRATEGY,
  type AttributionStrategy,
} from '@/lib/tracking/attribution/types';

export interface EmitOptions {
  componentId?: string;
  componentName?: string;
  pageId?: string;
  context?: Record<string, unknown>;
  /** Override timestamp (utile pour replay tests). */
  timestamp?: string;
  /**
   * Bloc `user_data` (déjà hashé SHA-256) à attacher à l'entry. Voir
   * `hashIdentityBrowser()`. Consommé par les tags GTM Google Ads
   * (Enhanced Conversions) et Meta pixel (Advanced Matching).
   */
  userData?: Record<string, unknown>;
  /**
   * Clé de dédup personnalisée. Si fournie, l'event ne sera pas
   * réémis pour la même clé pendant la fenêtre de redondance (ou
   * jamais si la fenêtre vaut 0). Utile pour les events « 1 fois par
   * formulaire » (ex. checkout_intent).
   */
  dedupKey?: string;
}

export interface TrackingClientConfig {
  endpoint?: string;
  consent: () => TrackingConsentState;
  user: () => { anonymous_id: string; session_id: string; user_id?: string };
  page: () => DataLayerEntry['page'];
  /** D\u00e9bouncer batch en ms. */
  batchIntervalMs?: number;
  /** Taille max d\u2019un batch envoy\u00e9. */
  maxBatchSize?: number;
  /** Cache LRU dedup (event_id) max. */
  dedupSize?: number;
  /** R\u00e8gles anti-redondance par event. */
  redundancyWindows?: Record<string, number>;
  /**
   * Strat\u00e9gie d'attribution multi-canal. Lue \u00e0 chaque emit pour
   * annoter `dataLayer.attribution`. Cf.
   * docs/tracking-attribution/.
   */
  attributionStrategy?: () => AttributionStrategy;
}

interface QueuedEvent {
  entry: DataLayerEntry;
  attempts: number;
}

const DEFAULT_REDUNDANCY: Record<string, number> = {
  page_view: 0,
  view_item: 30_000,
  add_to_cart: 5_000,
  scroll_depth: 0,
  fg_section_view: 60_000,
  // form_start est émis par useFormTracking au 1er focus. GTM le détecte
  // aussi via son trigger built-in « form interaction ». On dedup sur
  // une fenêtre courte par form_id pour éviter le double-push observé
  // en QA (Mode A + Mode B montés simultanément).
  form_start: 5_000,
  // checkout_intent : 1 seule fois par instance de formulaire — la
  // dedupKey suffixée par form_id garantit l'unicité.
  checkout_intent: 0,
};

export class TrackingClient {
  private readonly config: Required<
    Omit<TrackingClientConfig, 'redundancyWindows' | 'attributionStrategy'>
  > & {
    redundancyWindows: Record<string, number>;
    attributionStrategy: () => AttributionStrategy;
  };
  private queue: QueuedEvent[] = [];
  private dedupCache = new Map<string, number>();
  private lastEmitByKey = new Map<string, number>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(config: TrackingClientConfig) {
    this.config = {
      endpoint: config.endpoint ?? '/api/track',
      consent: config.consent,
      user: config.user,
      page: config.page,
      batchIntervalMs: config.batchIntervalMs ?? 1500,
      maxBatchSize: config.maxBatchSize ?? 25,
      dedupSize: config.dedupSize ?? 500,
      redundancyWindows: { ...DEFAULT_REDUNDANCY, ...(config.redundancyWindows ?? {}) },
      attributionStrategy: config.attributionStrategy ?? (() => DEFAULT_ATTRIBUTION_STRATEGY),
    };
  }

  emit(eventName: string, params: Record<string, unknown> = {}, options: EmitOptions = {}): void {
    const consent = this.config.consent();
    const now = options.timestamp ? new Date(options.timestamp).getTime() : Date.now();
    const redundancyKey = this.computeRedundancyKey(eventName, params, options);
    const window = this.config.redundancyWindows[eventName];
    if (window && window > 0) {
      const last = this.lastEmitByKey.get(redundancyKey);
      if (last && now - last < window) return;
    } else if (window === 0 && this.lastEmitByKey.has(redundancyKey)) {
      return;
    }
    this.lastEmitByKey.set(redundancyKey, now);

    // Attribution multi-canal — annote chaque entry avec le canal
    // résolu via la stratégie active. Lecture cookie sync (<1ms).
    const strategy = this.config.attributionStrategy();
    const snapshot = readAttributionCookie();
    const attributed = applyStrategy(snapshot, strategy);

    const entry: DataLayerEntry = {
      event: eventName,
      event_id: uuidv7(now),
      timestamp: options.timestamp ?? new Date(now).toISOString(),
      schema_version: 1,
      consent,
      page: this.config.page(),
      user: this.config.user(),
      source: {
        component_id: options.componentId,
        component_name: options.componentName,
        page_id: options.pageId,
      },
      context: options.context,
      params,
      ...(options.userData ? { user_data: options.userData } : {}),
      attribution: {
        channel: attributed.channel,
        is_paid: attributed.is_paid,
        strategy,
        reason: attributed.reason,
        click_id: attributed.click_id,
        click_id_field: attributed.click_id_field,
        utm: attributed.utm,
      },
    };

    if (this.dedupCache.has(entry.event_id)) return;
    this.dedupCache.set(entry.event_id, now);
    if (this.dedupCache.size > this.config.dedupSize) {
      const first = this.dedupCache.keys().next().value;
      if (first) this.dedupCache.delete(first);
    }

    getDataLayer().push(entry);

    if (consent.analytics_storage === 'denied' && consent.ad_storage === 'denied') {
      return;
    }

    this.queue.push({ entry, attempts: 0 });
    this.scheduleFlush();
  }

  private computeRedundancyKey(
    eventName: string,
    params: Record<string, unknown>,
    options: EmitOptions,
  ): string {
    if (options.dedupKey) return `${eventName}:${options.dedupKey}`;
    const id = (params.transaction_id ??
      params.item_id ??
      params.form_id ??
      options.componentId ??
      '') as string;
    return `${eventName}:${id}`;
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    if (this.queue.length >= this.config.maxBatchSize) {
      void this.flush();
      return;
    }
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, this.config.batchIntervalMs);
  }

  async flush(): Promise<void> {
    if (this.queue.length === 0) return;
    const batch = this.queue.splice(0, this.config.maxBatchSize);
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    const body = JSON.stringify({ events: batch.map((b) => b.entry) });
    const ok = await this.sendBatch(body);
    if (!ok) {
      for (const item of batch) {
        if (item.attempts < 3) {
          item.attempts += 1;
          this.queue.push(item);
        }
      }
      if (this.queue.length > 0) this.scheduleFlush();
    }
  }

  private async sendBatch(body: string): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon && body.length < 60_000) {
      try {
        const blob = new Blob([body], { type: 'application/json' });
        const ok = navigator.sendBeacon(this.config.endpoint, blob);
        if (ok) return true;
      } catch {
        // fallthrough to fetch
      }
    }
    if (typeof fetch === 'undefined') return false;
    try {
      const res = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: true,
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  flushSync(): void {
    if (this.queue.length === 0) return;
    const body = JSON.stringify({ events: this.queue.map((q) => q.entry) });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      try {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(this.config.endpoint, blob);
        this.queue = [];
      } catch {
        // ignore
      }
    }
  }
}
