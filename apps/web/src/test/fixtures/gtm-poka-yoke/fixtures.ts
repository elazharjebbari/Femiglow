/**
 * Fixtures pour les tests du système GTM Poka-Yoke.
 * Réutilisables Vitest + MSW + Playwright (via JSON exports).
 */
import { computeBundleId } from '@/lib/tracking/gtm/bundle-id';

export const EVENTS_FIXTURE = [
  { name: 'purchase', resolvedNames: { meta: 'Purchase', google_ga4: 'purchase' } },
  { name: 'view_content', resolvedNames: { meta: 'ViewContent', google_ga4: 'view_item' } },
  { name: 'add_to_cart', resolvedNames: { meta: 'AddToCart', google_ga4: 'add_to_cart' } },
];

export const BASE_BUNDLE_INPUT = {
  mappingVersion: 'v17',
  configVersion: 'v4',
  containerId: 'GTM-ABCD',
  events: EVENTS_FIXTURE,
  generatedAt: '2026-05-13T19:30:00.000Z',
};

export const BUNDLE_ID = computeBundleId(BASE_BUNDLE_INPUT);

export type ConfigFixture = {
  containerVersion: {
    container: { publicId: string };
    variable: Array<{ name: string; type?: string; parameter: Array<{ type?: string; key: string; value: string }> }>;
    trigger?: Array<{ name: string; parameter?: Array<{ key: string; value: string }> }>;
  };
};

export function makeConfigFixture(opts: Partial<{ bundleId: string; configVersion: string; containerId: string }> = {}): ConfigFixture {
  return {
    containerVersion: {
      container: { publicId: opts.containerId ?? 'GTM-ABCD' },
      variable: [
        {
          name: 'FG Bundle Id',
          type: 'c',
          parameter: [{ type: 'TEMPLATE', key: 'value', value: opts.bundleId ?? BUNDLE_ID }],
        },
        {
          name: 'FG Config Version',
          type: 'c',
          parameter: [{ type: 'TEMPLATE', key: 'value', value: opts.configVersion ?? 'v4' }],
        },
        { name: 'FG Mapping Version', type: 'c', parameter: [{ key: 'value', value: 'v17' }] },
      ],
      trigger: [
        { name: 'event purchase', parameter: [{ key: 'eventName', value: 'purchase' }] },
        { name: 'event view_content', parameter: [{ key: 'eventName', value: 'view_content' }] },
        { name: 'event add_to_cart', parameter: [{ key: 'eventName', value: 'add_to_cart' }] },
      ],
    },
  };
}

export type MappingFixture = {
  manifest: {
    schemaVersion: string;
    bundleId: string;
    mappingVersion: string;
    requiredConfigVersion: string;
    containerId: string;
    generatedAt: string;
  };
  mappings: Record<string, unknown>;
};

export function makeMappingFixture(
  opts: Partial<{
    bundleId: string;
    mappingVersion: string;
    requiredConfigVersion: string;
    containerId: string;
    extraEvents: string[];
  }> = {},
): MappingFixture {
  return {
    manifest: {
      schemaVersion: 'fg-mapping/2.0',
      bundleId: opts.bundleId ?? BUNDLE_ID,
      mappingVersion: opts.mappingVersion ?? 'v17',
      requiredConfigVersion: opts.requiredConfigVersion ?? 'v4',
      containerId: opts.containerId ?? 'GTM-ABCD',
      generatedAt: '2026-05-13T19:30:00.000Z',
    },
    mappings: {
      purchase: { meta: { eventName: 'Purchase' }, google_ga4: { eventName: 'purchase' } },
      view_content: { meta: { eventName: 'ViewContent' } },
      add_to_cart: { meta: { eventName: 'AddToCart' } },
      ...(opts.extraEvents ?? []).reduce<Record<string, unknown>>((acc, e) => {
        acc[e] = { meta: { eventName: e } };
        return acc;
      }, {}),
    },
  };
}
