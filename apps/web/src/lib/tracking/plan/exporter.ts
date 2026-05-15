import { createHash } from 'crypto';

import {
  getAdsConversionLabelKey,
  getEventIdentityFields,
  getEventMapping,
} from '@/lib/tracking/providers/event-mapping';
import type {
  EnvName,
  ExportResult,
  GoogleAdsConversionLabels,
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

/**
 * Renvoie le nom Meta canonique pour cet event, en consultant le
 * mapping unique de vérité (`event-mapping.ts`). Pour les events non
 * mappés vers Meta, on fallback sur le nom GA4 (sera traité comme
 * un Meta CustomEvent).
 */
function metaEventNameFor(eventKey: string): string {
  const m = getEventMapping(eventKey);
  return m?.meta?.name ?? eventKey;
}

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
  const cfg = profile.config as Record<string, string | undefined> & {
    googleAdsConversionLabels?: GoogleAdsConversionLabels;
  };
  const conversionLabels = cfg.googleAdsConversionLabels ?? {};
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

  // ─── DLV helpers ─────────────────────────────────────────────────
  // Génère une Data Layer Variable nommée et la mémorise pour éviter
  // de la pousser deux fois. Renvoie le placeholder {{...}} prêt à
  // être injecté en TEMPLATE.
  const dlvByName = new Map<string, string>();
  function ensureDlv(displayName: string, dlvPath: string, folder = '3'): string {
    const existing = dlvByName.get(displayName);
    if (existing) return existing;
    variables.push({
      variableId: nextVariable(),
      name: displayName,
      type: 'v',
      parameter: [
        { type: 'TEMPLATE', key: 'name', value: dlvPath },
        { type: 'INTEGER', key: 'dataLayerVersion', value: '2' },
        { type: 'BOOLEAN', key: 'setDefaultValue', value: 'false' },
      ],
      parentFolderId: folder,
    });
    const placeholder = `{{${displayName}}}`;
    dlvByName.set(displayName, placeholder);
    return placeholder;
  }

  // DLV - event_id : fbq dedup côté Meta + alignement Stape/server CAPI
  const needsMeta = activeProviders.has('meta') && !!cfg.metaPixelId;
  if (needsMeta) ensureDlv('DLV - event_id', 'event_id');

  // ─── Variables CONST pour les conversion labels Google Ads ──────
  // Une CONST par label réellement défini en envConfig. Le tag awct
  // de chaque event-conversion référencera son label via cette CONST.
  const adsLabelVarByKey = new Map<string, string>();
  function ensureAdsLabelVar(key: string): string | null {
    const cached = adsLabelVarByKey.get(key);
    if (cached) return cached;
    const value = conversionLabels[key];
    if (!value) return null; // pas de label saisi en envConfig → pas de tag awct
    const placeholder = makeConst(`CONST - Ads Label - ${key}`, value);
    adsLabelVarByKey.set(key, placeholder);
    return placeholder;
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
      const metaName = metaEventNameFor(event.key);
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
      // Lookup du label de conversion pour cet event (purchase →
      // 'purchase', lead_capture → 'lead', checkout_intent →
      // 'checkout_intent', etc.). Si l'admin n'a pas rempli le label
      // dans envConfig, on saute le tag — sinon GTM importerait un
      // tag avec un label vide qui n'enverrait aucune conversion.
      const labelKey = getAdsConversionLabelKey(event.key);
      const labelVar = labelKey ? ensureAdsLabelVar(labelKey) : null;
      if (labelVar) {
        // DLVs ecommerce nécessaires pour la conversion (transaction,
        // currency, value). Idempotent — déjà créés au besoin.
        const txnIdVar = ensureDlv('DLV - ecommerce.transaction_id', 'ecommerce.transaction_id');
        const currencyVar = ensureDlv('DLV - ecommerce.currency', 'ecommerce.currency');
        const valueVar = ensureDlv('DLV - ecommerce.value', 'ecommerce.value');
        tags.push({
          tagId: nextTag(),
          name: `Ads Conv — ${event.key} (${labelKey})`,
          type: 'awct',
          parameter: [
            { type: 'TEMPLATE', key: 'conversionId', value: idVars.googleAds },
            { type: 'TEMPLATE', key: 'conversionLabel', value: labelVar },
            { type: 'TEMPLATE', key: 'orderId', value: txnIdVar },
            { type: 'TEMPLATE', key: 'currencyCode', value: currencyVar },
            { type: 'TEMPLATE', key: 'conversionValue', value: valueVar },
            // Enhanced Conversions automatiques : le tag GTM scrape le
            // dataLayer (user_data.*) sans intervention manuelle.
            {
              type: 'BOOLEAN',
              key: 'enhancedConversionsAutomaticMode',
              value: 'true',
            },
          ],
          firingTriggerId: [triggerId],
          parentFolderId: '2',
        });
      }
    }

    // ── Enhanced Conversions / Advanced Matching : DLV user_data ──
    // Pour chaque champ d'identity que l'event hydrate (cf. mapping),
    // on s'assure que la DLV correspondante existe dans le container.
    // Les tags GTM (Google Ads + Meta) pourront alors lire user_data
    // pour Enhanced Conv. / Advanced Matching.
    const identityFields = getEventIdentityFields(event.key);
    if (identityFields.length > 0) {
      if (identityFields.includes('email')) {
        ensureDlv('DLV - user_data.email_sha256', 'user_data.sha256_email_address', '3');
      }
      if (identityFields.includes('phone')) {
        ensureDlv('DLV - user_data.phone_sha256', 'user_data.sha256_phone_number', '3');
      }
      if (identityFields.includes('firstName')) {
        ensureDlv(
          'DLV - user_data.address.first_name_sha256',
          'user_data.address.sha256_first_name',
          '3',
        );
      }
      if (identityFields.includes('lastName')) {
        ensureDlv(
          'DLV - user_data.address.last_name_sha256',
          'user_data.address.sha256_last_name',
          '3',
        );
      }
      if (identityFields.includes('city')) {
        ensureDlv('DLV - user_data.address.city', 'user_data.address.city', '3');
      }
      if (identityFields.includes('country')) {
        ensureDlv('DLV - user_data.address.country', 'user_data.address.country', '3');
      }
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
