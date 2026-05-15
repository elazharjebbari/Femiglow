import { createHash } from 'crypto';

import type {
  EnvName,
  ExportResult,
  TrackingEvent,
  TrackingPlan,
} from './types';

interface GtmParameter {
  type: string;
  key?: string;
  value?: string;
  list?: GtmParameter[];
}

interface GtmTag {
  tagId: string;
  name: string;
  type: string;
  parameter: Array<{ type: string; key: string; value: string }>;
  consentSettings?: { consentStatus: 'NEEDED'; consentType: GtmParameter };
  firingTriggerId?: string[];
}

function consentTypeList(values: string[]): GtmParameter {
  return {
    type: 'LIST',
    list: values.map((value) => ({ type: 'TEMPLATE', value })),
  };
}

interface GtmVariable {
  variableId: string;
  name: string;
  type: string;
  parameter: Array<{ type: string; key: string; value: string }>;
}

interface GtmTrigger {
  triggerId: string;
  name: string;
  type: string;
}

interface GtmContainer {
  exportFormatVersion: 2;
  containerVersion: {
    accountId: string;
    containerId: string;
    container: { publicId: string };
    tag: GtmTag[];
    trigger: GtmTrigger[];
    variable: GtmVariable[];
    builtInVariable: Array<{ type: string }>;
  };
}

export function exportPlan(plan: TrackingPlan, env: EnvName): ExportResult {
  const profile = plan.envProfiles.find((e) => e.env === env);
  if (!profile) {
    throw new Error(`env_profile_not_found: ${env}`);
  }
  const cfg = profile.config as Record<string, string | undefined>;
  const activeProviders = new Set(plan.providers.filter((p) => p.active).map((p) => p.id));

  const variables: GtmVariable[] = [];
  const tags: GtmTag[] = [];
  // GTM expects EventType enum in SCREAMING_SNAKE_CASE (protobuf name),
  // not lowercase camelCase like the REST API. The container import
  // rejects "pageview" with "Error deserializing enum type [EventType]".
  const triggers: GtmTrigger[] = [
    { triggerId: '1', name: 'All Pages', type: 'PAGEVIEW' },
    { triggerId: '2', name: 'DOM Ready', type: 'DOM_READY' },
  ];

  const varCounter = { value: 0 };
  function makeVar(name: string, value: string): string {
    varCounter.value += 1;
    const id = String(varCounter.value);
    variables.push({
      variableId: id,
      name,
      type: 'c',
      parameter: [{ type: 'TEMPLATE', key: 'value', value }],
    });
    return `{{${name}}}`;
  }

  const idVars: Record<string, string> = {};
  if (activeProviders.has('ga4') && cfg.ga4MeasurementId) {
    idVars.ga4 = makeVar('CONST - GA4 Measurement ID', cfg.ga4MeasurementId);
  }
  if (activeProviders.has('googleAds') && cfg.googleAdsConversionId) {
    idVars.googleAds = makeVar('CONST - Google Ads Conversion ID', cfg.googleAdsConversionId);
  }
  if (activeProviders.has('meta') && cfg.metaPixelId) {
    idVars.meta = makeVar('CONST - Meta Pixel ID', cfg.metaPixelId);
  }
  if (activeProviders.has('tiktok') && cfg.tiktokPixelId) {
    idVars.tiktok = makeVar('CONST - TikTok Pixel ID', cfg.tiktokPixelId);
  }

  const tagCounter = { value: 0 };
  function tagId(): string {
    tagCounter.value += 1;
    return String(tagCounter.value);
  }

  for (const event of [...plan.events].sort((a, b) => a.key.localeCompare(b.key))) {
    addEventTags(event, activeProviders, idVars, tagId, tags);
  }

  const container: GtmContainer = {
    exportFormatVersion: 2,
    containerVersion: {
      accountId: '0',
      containerId: '0',
      container: { publicId: cfg.gtmContainerId ?? 'GTM-UNSET' },
      tag: tags,
      trigger: triggers,
      variable: variables,
      builtInVariable: [
        { type: 'AD_STORAGE' },
        { type: 'ANALYTICS_STORAGE' },
        { type: 'PAGE_PATH' },
        { type: 'PAGE_URL' },
      ],
    },
  };

  const canonical = canonicalize(container);
  const bundleId = createHash('sha256').update(canonical).digest('hex');

  return {
    json: container as unknown as Record<string, unknown>,
    bundleId,
    exportedAt: new Date(),
  };
}

function addEventTags(
  event: TrackingEvent,
  activeProviders: Set<string>,
  idVars: Record<string, string>,
  tagId: () => string,
  tags: GtmTag[],
) {
  for (const [provider, on] of Object.entries(event.providers)) {
    if (!on) continue;
    if (!activeProviders.has(provider)) continue;

    if (provider === 'ga4' && idVars.ga4) {
      tags.push({
        tagId: tagId(),
        name: `GA4 - ${event.key}`,
        type: 'gaawe',
        parameter: [
          { type: 'TEMPLATE', key: 'eventName', value: event.key },
          { type: 'TEMPLATE', key: 'measurementId', value: idVars.ga4 },
        ],
        consentSettings: {
          consentStatus: 'NEEDED',
          consentType: consentTypeList(['analytics_storage']),
        },
      });
    }
    if (provider === 'googleAds' && idVars.googleAds) {
      tags.push({
        tagId: tagId(),
        name: `Ads - ${event.key}`,
        type: 'awct',
        parameter: [
          { type: 'TEMPLATE', key: 'conversionId', value: idVars.googleAds },
          { type: 'TEMPLATE', key: 'eventName', value: event.key },
        ],
        consentSettings: {
          consentStatus: 'NEEDED',
          consentType: consentTypeList(['ad_storage']),
        },
      });
    }
    if (provider === 'meta' && idVars.meta) {
      tags.push({
        tagId: tagId(),
        name: `Meta - ${event.key}`,
        type: 'cvt_meta',
        parameter: [
          { type: 'TEMPLATE', key: 'pixelId', value: idVars.meta },
          { type: 'TEMPLATE', key: 'eventName', value: event.key },
        ],
        consentSettings: {
          consentStatus: 'NEEDED',
          consentType: consentTypeList(['ad_storage']),
        },
      });
    }
    if (provider === 'tiktok' && idVars.tiktok) {
      tags.push({
        tagId: tagId(),
        name: `TikTok - ${event.key}`,
        type: 'cvt_tiktok',
        parameter: [
          { type: 'TEMPLATE', key: 'pixelId', value: idVars.tiktok },
          { type: 'TEMPLATE', key: 'eventName', value: event.key },
        ],
        consentSettings: {
          consentStatus: 'NEEDED',
          consentType: consentTypeList(['ad_storage']),
        },
      });
    }
  }
}

function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    return (
      '{' +
      keys
        .filter((k) => obj[k] !== undefined)
        .map((k) => JSON.stringify(k) + ':' + canonicalize(obj[k]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value);
}

export const __test__ = { canonicalize };
