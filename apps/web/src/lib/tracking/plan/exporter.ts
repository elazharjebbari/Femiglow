import { createHash } from 'crypto';

import type {
  EnvName,
  ExportResult,
  TrackingEvent,
  TrackingPlan,
} from './types';

type GtmParameter = {
  type: string;
  key?: string;
  value?: string;
  list?: GtmParameter[];
};

interface GtmTag {
  tagId: string;
  name: string;
  type: string;
  parameter: GtmParameter[];
  firingTriggerId?: string[];
  setupTag?: Array<{ tagName: string; stopOnSetupFailure: boolean }>;
  tagFiringOption?: 'ONCE_PER_EVENT' | 'UNLIMITED' | 'ONCE_PER_LOAD';
  priority?: GtmParameter;
  parentFolderId?: string;
}

interface GtmTriggerFilter {
  type: 'EQUALS';
  parameter: GtmParameter[];
}

interface GtmTrigger {
  triggerId: string;
  name: string;
  type: 'PAGEVIEW' | 'CUSTOM_EVENT' | 'DOM_READY' | 'WINDOW_LOADED';
  customEventFilter?: GtmTriggerFilter[];
  parentFolderId?: string;
}

interface GtmVariable {
  variableId: string;
  name: string;
  type: string;
  parameter: GtmParameter[];
  parentFolderId?: string;
}

interface GtmBuiltInVariable {
  name: string;
  type: string;
}

interface GtmFolder {
  folderId: string;
  name: string;
}

interface GtmContainerVersion {
  path: string;
  accountId: string;
  containerId: string;
  container: {
    accountId: string;
    containerId: string;
    name: string;
    usageContext: ['WEB'];
  };
  tag: GtmTag[];
  trigger: GtmTrigger[];
  variable: GtmVariable[];
  folder: GtmFolder[];
  builtInVariable: GtmBuiltInVariable[];
}

interface GtmContainer {
  exportFormatVersion: 2;
  exportTime?: string;
  containerVersion: GtmContainerVersion;
}

// GA4 event_name → Meta standard event mapping. For unmapped keys, the
// GA4 key is used verbatim as the fbq event name (custom Meta event).
const META_EVENT_MAP: Record<string, string> = {
  page_view: 'PageView',
  view_item_list: 'ViewContent',
  view_item: 'ViewContent',
  search: 'Search',
  add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout',
  add_payment_info: 'AddPaymentInfo',
  purchase: 'Purchase',
  generate_lead: 'Lead',
  lead_capture: 'Lead',
  sign_up: 'CompleteRegistration',
  contact_submit: 'Contact',
};

// Built-in variables that ship with every GTM container by default.
// Note: AD_STORAGE / ANALYTICS_STORAGE are NOT built-in variable types
// (those are consent storage keys, surfaced via the Consent built-in
// or DLV - consent.*). Putting them here breaks the import with
// "Error deserializing enum type [BuiltInVariableType]".
const BUILT_IN_VARIABLES: GtmBuiltInVariable[] = [
  { name: 'Page URL', type: 'PAGE_URL' },
  { name: 'Page Hostname', type: 'PAGE_HOSTNAME' },
  { name: 'Page Path', type: 'PAGE_PATH' },
  { name: 'Referrer', type: 'REFERRER' },
  { name: 'Click Element', type: 'CLICK_ELEMENT' },
  { name: 'Click Classes', type: 'CLICK_CLASSES' },
  { name: 'Click ID', type: 'CLICK_ID' },
  { name: 'Click URL', type: 'CLICK_URL' },
  { name: 'Click Text', type: 'CLICK_TEXT' },
  { name: 'Form Element', type: 'FORM_ELEMENT' },
  { name: 'Form Classes', type: 'FORM_CLASSES' },
  { name: 'Form ID', type: 'FORM_ID' },
  { name: 'Form Text', type: 'FORM_TEXT' },
  { name: 'Event', type: 'EVENT' },
];

const FOLDERS: GtmFolder[] = [
  { folderId: '1', name: '00 — Configuration' },
  { folderId: '2', name: '01 — Events' },
  { folderId: '3', name: '02 — Helpers' },
];

function makeIdGen(): () => string {
  let n = 0;
  return () => {
    n += 1;
    return String(n);
  };
}

export function exportPlan(plan: TrackingPlan, env: EnvName): ExportResult {
  const profile = plan.envProfiles.find((e) => e.env === env);
  if (!profile) {
    throw new Error(`env_profile_not_found: ${env}`);
  }
  const cfg = profile.config as Record<string, string | undefined>;
  const activeProviders = new Set(plan.providers.filter((p) => p.active).map((p) => p.id));

  const nextTag = makeIdGen();
  const nextTrigger = makeIdGen();
  const nextVariable = makeIdGen();

  const variables: GtmVariable[] = [];
  const tags: GtmTag[] = [];
  const triggers: GtmTrigger[] = [];

  // ─── Triggers ────────────────────────────────────────────────────
  const allPagesId = nextTrigger();
  triggers.push({
    triggerId: allPagesId,
    name: 'PV — All Pages',
    type: 'PAGEVIEW',
    parentFolderId: '2',
  });

  const sortedEvents = [...plan.events].sort((a, b) => a.key.localeCompare(b.key));
  const eventTriggerByKey: Record<string, string> = {};
  for (const event of sortedEvents) {
    const id = nextTrigger();
    triggers.push({
      triggerId: id,
      name: `CE — ${event.key}`,
      type: 'CUSTOM_EVENT',
      customEventFilter: [
        {
          type: 'EQUALS',
          parameter: [
            { type: 'TEMPLATE', key: 'arg0', value: '{{_event}}' },
            { type: 'TEMPLATE', key: 'arg1', value: event.key },
          ],
        },
      ],
      parentFolderId: '2',
    });
    eventTriggerByKey[event.key] = id;
  }

  // ─── CONST variables per active provider ─────────────────────────
  const idVars: Record<string, string> = {};
  function makeConst(name: string, value: string): string {
    variables.push({
      variableId: nextVariable(),
      name,
      type: 'c',
      parameter: [{ type: 'TEMPLATE', key: 'value', value }],
      parentFolderId: '1',
    });
    return `{{${name}}}`;
  }
  if (activeProviders.has('ga4') && cfg.ga4MeasurementId) {
    idVars.ga4 = makeConst('CONST - GA4 Measurement ID', cfg.ga4MeasurementId);
  }
  if (activeProviders.has('googleAds') && cfg.googleAdsConversionId) {
    idVars.googleAds = makeConst('CONST - Google Ads Conversion ID', cfg.googleAdsConversionId);
  }
  if (activeProviders.has('meta') && cfg.metaPixelId) {
    idVars.meta = makeConst('CONST - Meta Pixel ID', cfg.metaPixelId);
  }
  if (activeProviders.has('tiktok') && cfg.tiktokPixelId) {
    idVars.tiktok = makeConst('CONST - TikTok Pixel ID', cfg.tiktokPixelId);
  }

  // ─── DLV - event_id (used by Meta tags for fbq deduplication) ───
  const needsMetaDLV = activeProviders.has('meta') && !!cfg.metaPixelId;
  if (needsMetaDLV) {
    variables.push({
      variableId: nextVariable(),
      name: 'DLV - event_id',
      type: 'v',
      parameter: [
        { type: 'TEMPLATE', key: 'name', value: 'event_id' },
        { type: 'INTEGER', key: 'dataLayerVersion', value: '2' },
        { type: 'BOOLEAN', key: 'setDefaultValue', value: 'false' },
      ],
      parentFolderId: '3',
    });
  }

  // ─── GA4 Configuration tag ───────────────────────────────────────
  if (idVars.ga4) {
    tags.push({
      tagId: nextTag(),
      name: 'GA4 Cfg',
      type: 'gaawc',
      parameter: [
        { type: 'TEMPLATE', key: 'measurementId', value: idVars.ga4 },
        { type: 'BOOLEAN', key: 'sendPageView', value: 'false' },
      ],
      priority: { type: 'INTEGER', key: 'priority', value: '80' },
      tagFiringOption: 'ONCE_PER_EVENT',
      firingTriggerId: [allPagesId],
      parentFolderId: '1',
    });
  }

  // ─── Meta Init tag (loads fbq + first PageView) ──────────────────
  const META_INIT_NAME = 'Meta Init';
  if (idVars.meta && cfg.metaPixelId) {
    const initSnippet = [
      `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){`,
      `n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};`,
      `if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];`,
      `t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];`,
      `s.parentNode.insertBefore(t,s)}(window,document,'script',`,
      `'https://connect.facebook.net/en_US/fbevents.js');`,
      `fbq('init','${cfg.metaPixelId}');fbq('track','PageView');</script>`,
    ].join('');
    tags.push({
      tagId: nextTag(),
      name: META_INIT_NAME,
      type: 'html',
      parameter: [
        { type: 'TEMPLATE', key: 'html', value: initSnippet },
        { type: 'BOOLEAN', key: 'supportDocumentWrite', value: 'false' },
      ],
      priority: { type: 'INTEGER', key: 'priority', value: '70' },
      tagFiringOption: 'ONCE_PER_EVENT',
      firingTriggerId: [allPagesId],
      parentFolderId: '1',
    });
  }

  // ─── Per-event tags (GA4 + Meta, wired to CUSTOM_EVENT triggers) ─
  for (const event of sortedEvents) {
    const triggerId = eventTriggerByKey[event.key];
    if (!triggerId) continue;

    if (event.providers.ga4 && idVars.ga4) {
      tags.push({
        tagId: nextTag(),
        name: `GA4 Evt — ${event.key}`,
        type: 'gaawe',
        parameter: [
          { type: 'TEMPLATE', key: 'eventName', value: event.key },
          { type: 'TEMPLATE', key: 'measurementIdOverride', value: idVars.ga4 },
        ],
        firingTriggerId: [triggerId],
        parentFolderId: '2',
      });
    }

    if (event.providers.meta && idVars.meta) {
      const metaName = META_EVENT_MAP[event.key] ?? event.key;
      tags.push({
        tagId: nextTag(),
        name: `Meta Evt — ${event.key} (${metaName})`,
        type: 'html',
        parameter: [
          {
            type: 'TEMPLATE',
            key: 'html',
            value: `<script>fbq('track', '${metaName}', { event_id: {{DLV - event_id}} });</script>`,
          },
          { type: 'BOOLEAN', key: 'supportDocumentWrite', value: 'false' },
        ],
        firingTriggerId: [triggerId],
        setupTag: [{ tagName: META_INIT_NAME, stopOnSetupFailure: false }],
        parentFolderId: '2',
      });
    }

    if (event.providers.googleAds && idVars.googleAds) {
      tags.push({
        tagId: nextTag(),
        name: `Ads Conv — ${event.key}`,
        type: 'awct',
        parameter: [
          { type: 'TEMPLATE', key: 'conversionId', value: idVars.googleAds },
          { type: 'TEMPLATE', key: 'eventName', value: event.key },
        ],
        firingTriggerId: [triggerId],
        parentFolderId: '2',
      });
    }

    if (event.providers.tiktok && idVars.tiktok && cfg.tiktokPixelId) {
      tags.push({
        tagId: nextTag(),
        name: `TikTok Evt — ${event.key}`,
        type: 'html',
        parameter: [
          {
            type: 'TEMPLATE',
            key: 'html',
            value: `<script>if(window.ttq){ttq.track('${event.key}');}</script>`,
          },
          { type: 'BOOLEAN', key: 'supportDocumentWrite', value: 'false' },
        ],
        firingTriggerId: [triggerId],
        parentFolderId: '2',
      });
    }
  }

  const containerName = `FemiGlow Web — ${env}`;
  const accountId = '0';
  const containerId = cfg.gtmContainerId ?? 'GTM-UNSET';

  // Container payload — used both for hashing (deterministic) and for
  // the final JSON. exportTime is added *after* hashing so the bundleId
  // stays stable across exports of the same plan.
  const containerVersion: GtmContainerVersion = {
    path: `accounts/${accountId}/containers/${containerId}`,
    accountId,
    containerId,
    container: {
      accountId,
      containerId,
      name: containerName,
      usageContext: ['WEB'],
    },
    tag: tags,
    trigger: triggers,
    variable: variables,
    folder: FOLDERS,
    builtInVariable: BUILT_IN_VARIABLES,
  };

  const containerForHash: GtmContainer = {
    exportFormatVersion: 2,
    containerVersion,
  };
  const canonical = canonicalize(containerForHash);
  const bundleId = createHash('sha256').update(canonical).digest('hex');

  const exportedAt = new Date();
  const container: GtmContainer = {
    exportFormatVersion: 2,
    exportTime: exportedAt.toISOString(),
    containerVersion,
  };

  return {
    json: container as unknown as Record<string, unknown>,
    bundleId,
    exportedAt,
  };
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
