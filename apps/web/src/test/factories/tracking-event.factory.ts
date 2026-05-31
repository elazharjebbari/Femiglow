/**
 * Factory pour générer des `TrackingEventLogEntry` typés en tests.
 *
 * Référence : `docs/test-strategy-2026-05/03-data-strategy.md`
 */
import type { TrackingEventLogEntry, TrackingConsentState } from '@/lib/db/types';
import type { TrafficBucket } from '@/lib/analytics/attribution';

import { defineFactory, createCounter, testId } from './base';

const counter = createCounter();

const GRANTED_CONSENT: TrackingConsentState = {
  ad_storage: 'granted',
  analytics_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted',
  functional_storage: 'granted',
};

export const trackingEventFactory = {
  ...defineFactory<TrackingEventLogEntry>(() => {
    const n = counter.next();
    return {
      id: testId('tev'),
      eventId: testId('evt'),
      eventName: 'page_view',
      eventCategory: 'page',
      pageId: 'kit',
      componentId: null,
      pageRoute: '/kit',
      anonymousId: `anon_${n}`,
      sessionId: `sess_${n}`,
      userId: null,
      consentSnapshot: GRANTED_CONSENT,
      payload: {},
      uaHash: 'test_ua_hash',
      ipAnonymized: '0.0.0.0',
      device: 'desktop',
      locale: 'fr-MA',
      isConversion: false,
      providersDispatched: [],
      providersResults: {},
      receivedAt: new Date('2026-05-24T10:00:00.000Z'),
      schemaVersion: 1,
      trafficSource: null,
      trafficMedium: null,
    };
  }),

  /** Trait — event marketing avec attribution Meta paid. */
  metaPaid(overrides: Partial<TrackingEventLogEntry> = {}): TrackingEventLogEntry {
    return this.build({
      trafficSource: 'paid_social' as TrafficBucket,
      trafficMedium: 'cpc',
      ...overrides,
    });
  },

  /** Trait — event Google paid (gclid). */
  googlePaid(overrides: Partial<TrackingEventLogEntry> = {}): TrackingEventLogEntry {
    return this.build({
      trafficSource: 'paid_search' as TrafficBucket,
      trafficMedium: 'cpc',
      ...overrides,
    });
  },

  /** Trait — purchase conversion event. */
  purchase(overrides: Partial<TrackingEventLogEntry> = {}): TrackingEventLogEntry {
    return this.build({
      eventName: 'purchase',
      eventCategory: 'ecommerce',
      isConversion: true,
      payload: { value: 199, currency: 'MAD' },
      ...overrides,
    });
  },

  /** Trait — lead capture conversion. */
  generateLead(
    overrides: Partial<TrackingEventLogEntry> = {},
  ): TrackingEventLogEntry {
    return this.build({
      eventName: 'generate_lead',
      eventCategory: 'lead',
      isConversion: true,
      ...overrides,
    });
  },

  /** Trait — event mobile (device override). */
  mobile(overrides: Partial<TrackingEventLogEntry> = {}): TrackingEventLogEntry {
    return this.build({ device: 'mobile', ...overrides });
  },

  /** Trait — consent denied. */
  consentDenied(
    overrides: Partial<TrackingEventLogEntry> = {},
  ): TrackingEventLogEntry {
    return this.build({
      consentSnapshot: {
        ad_storage: 'denied',
        analytics_storage: 'denied',
        ad_user_data: 'denied',
        ad_personalization: 'denied',
        functional_storage: 'denied',
      },
      ...overrides,
    });
  },

  /** Reset counter (à appeler dans afterEach si besoin). */
  __resetCounter(): void {
    counter.reset();
  },
};
