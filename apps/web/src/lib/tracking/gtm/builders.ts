/**
 * Builders qui dérivent un container.json GTM depuis :
 *   - le catalogue d'events (`event-catalog.ts`)
 *   - le mapping providers (`event-mapping.ts`)
 *   - la config par environnement passée en paramètre
 *
 * Les builders sont triviaux et explicites : pas de framework, pas de
 * magie. Pour ajouter un type de tag/trigger, on ajoute un builder ici.
 *
 * Cf. docs/gtm/02-architecture-gtm.md, docs/gtm/04-triggers.md,
 * docs/gtm/05-tags.md.
 */

import { EVENT_CATALOG, type EventCatalogEntry } from '@/lib/tracking/event-catalog';
import { mapEventName } from '@/lib/tracking/providers/event-mapping';
import type {
  GtmBuiltInVariable,
  GtmContainer,
  GtmFolder,
  GtmParameter,
  GtmTag,
  GtmTrigger,
  GtmVariable,
  GtmEnvironment,
} from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration par environnement (Pixel IDs publics).
// ─────────────────────────────────────────────────────────────────────────────

export interface GtmEnvConfig {
  ga4MeasurementId: string;
  metaPixelId: string;
  tiktokPixelId: string;
  snapPixelId: string;
  pinterestTagId: string;
  googleAdsCustomerId: string;
  defaultCurrency: string;
  cookieDomain: string;
  enabledProviders: string[];
}

export const ENV_DEFAULTS: Record<GtmEnvironment, GtmEnvConfig> = {
  production: {
    ga4MeasurementId: 'G-PROD0000',
    metaPixelId: '11111111111',
    tiktokPixelId: 'CPROD',
    snapPixelId: 'aaaa-prod',
    pinterestTagId: '0000000001',
    googleAdsCustomerId: '123-456-7890',
    defaultCurrency: 'MAD',
    cookieDomain: 'auto',
    enabledProviders: ['google_ga4', 'meta', 'tiktok', 'snap', 'pinterest', 'google_ads'],
  },
  stage: {
    ga4MeasurementId: 'G-STAGE000',
    metaPixelId: '22222222222',
    tiktokPixelId: '',
    snapPixelId: '',
    pinterestTagId: '',
    googleAdsCustomerId: '',
    defaultCurrency: 'MAD',
    cookieDomain: 'auto',
    enabledProviders: ['google_ga4'],
  },
  preview: {
    ga4MeasurementId: 'G-PREV0000',
    metaPixelId: '',
    tiktokPixelId: '',
    snapPixelId: '',
    pinterestTagId: '',
    googleAdsCustomerId: '',
    defaultCurrency: 'MAD',
    cookieDomain: 'auto',
    enabledProviders: ['google_ga4'],
  },
  dev: {
    ga4MeasurementId: '',
    metaPixelId: '',
    tiktokPixelId: '',
    snapPixelId: '',
    pinterestTagId: '',
    googleAdsCustomerId: '',
    defaultCurrency: 'MAD',
    cookieDomain: 'auto',
    enabledProviders: [],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const param = (key: string, value: string, type: 'template' | 'boolean' | 'integer' = 'template'): GtmParameter => ({
  type,
  key,
  value,
});

let idCounter = 1;
const nextId = () => String(idCounter++);
const resetIds = () => {
  idCounter = 1;
};

const FOLDER_IDS = {
  config: 'F-00',
  page: 'F-01',
  ecommerce: 'F-02',
  lead: 'F-03',
  conversions: 'F-04',
  fgCustom: 'F-05',
  consent: 'F-06',
  helpers: 'F-07',
  chat: 'F-08',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Built-in variables
// ─────────────────────────────────────────────────────────────────────────────

const BUILTIN_LIST: GtmBuiltInVariable[] = [
  { type: 'pageUrl', name: 'Page URL' },
  { type: 'pageHostname', name: 'Page Hostname' },
  { type: 'pagePath', name: 'Page Path' },
  { type: 'referrer', name: 'Referrer' },
  { type: 'clickElement', name: 'Click Element' },
  { type: 'clickClasses', name: 'Click Classes' },
  { type: 'clickId', name: 'Click ID' },
  { type: 'clickUrl', name: 'Click URL' },
  { type: 'clickText', name: 'Click Text' },
  { type: 'formElement', name: 'Form Element' },
  { type: 'formClasses', name: 'Form Classes' },
  { type: 'formId', name: 'Form ID' },
  { type: 'formText', name: 'Form Text' },
  { type: 'event', name: 'Event' },
];

export function buildBuiltinList(): GtmBuiltInVariable[] {
  return BUILTIN_LIST.slice();
}

// ─────────────────────────────────────────────────────────────────────────────
// Variables
// ─────────────────────────────────────────────────────────────────────────────

function buildConstant(name: string, value: string): GtmVariable {
  return {
    name,
    type: 'c',
    parameter: [param('value', value)],
    variableId: nextId(),
    parentFolderId: FOLDER_IDS.config,
  };
}

function buildDLV(name: string, dataLayerName: string, folder: string = FOLDER_IDS.helpers): GtmVariable {
  return {
    name,
    type: 'v',
    parameter: [
      param('name', dataLayerName),
      param('dataLayerVersion', '2', 'integer'),
      param('setDefaultValue', 'false', 'boolean'),
    ],
    variableId: nextId(),
    parentFolderId: folder,
  };
}

export function buildAllVariables(env: GtmEnvironment, cfg: GtmEnvConfig): GtmVariable[] {
  const variables: GtmVariable[] = [];

  // Constants
  variables.push(buildConstant('CONST - GA4 Measurement ID', cfg.ga4MeasurementId));
  variables.push(buildConstant('CONST - Meta Pixel ID', cfg.metaPixelId));
  variables.push(buildConstant('CONST - TikTok Pixel ID', cfg.tiktokPixelId));
  variables.push(buildConstant('CONST - Snap Pixel ID', cfg.snapPixelId));
  variables.push(buildConstant('CONST - Pinterest Tag ID', cfg.pinterestTagId));
  variables.push(buildConstant('CONST - Google Ads Customer', cfg.googleAdsCustomerId));
  variables.push(buildConstant('CONST - Default Currency', cfg.defaultCurrency));
  variables.push(buildConstant('CONST - Cookie Domain', cfg.cookieDomain));
  variables.push(buildConstant('CONST - Environment', env));

  // DLV — identité
  variables.push(buildDLV('DLV - event_id', 'event_id'));
  variables.push(buildDLV('DLV - timestamp', 'timestamp'));
  variables.push(buildDLV('DLV - schema_version', 'schema_version'));

  // DLV — consent
  variables.push(buildDLV('DLV - consent.analytics_storage', 'consent.analytics_storage', FOLDER_IDS.consent));
  variables.push(buildDLV('DLV - consent.ad_storage', 'consent.ad_storage', FOLDER_IDS.consent));
  variables.push(buildDLV('DLV - consent.ad_user_data', 'consent.ad_user_data', FOLDER_IDS.consent));
  variables.push(buildDLV('DLV - consent.ad_personalization', 'consent.ad_personalization', FOLDER_IDS.consent));

  // DLV — page
  variables.push(buildDLV('DLV - page.url', 'page.url'));
  variables.push(buildDLV('DLV - page.path', 'page.path'));
  variables.push(buildDLV('DLV - page.title', 'page.title'));
  variables.push(buildDLV('DLV - page.referrer', 'page.referrer'));
  variables.push(buildDLV('DLV - page.locale', 'page.locale'));

  // DLV — user
  variables.push(buildDLV('DLV - user.anonymous_id', 'user.anonymous_id'));
  variables.push(buildDLV('DLV - user.session_id', 'user.session_id'));
  variables.push(buildDLV('DLV - user.user_id', 'user.user_id'));

  // DLV — ecommerce
  variables.push(buildDLV('DLV - ecommerce.value', 'ecommerce.value', FOLDER_IDS.ecommerce));
  variables.push(buildDLV('DLV - ecommerce.currency', 'ecommerce.currency', FOLDER_IDS.ecommerce));
  variables.push(buildDLV('DLV - ecommerce.items', 'ecommerce.items', FOLDER_IDS.ecommerce));
  variables.push(buildDLV('DLV - ecommerce.transaction_id', 'ecommerce.transaction_id', FOLDER_IDS.ecommerce));

  // DLV — user_data (advanced matching)
  variables.push(buildDLV('DLV - user_data.email_sha256', 'user_data.email_sha256'));
  variables.push(buildDLV('DLV - user_data.phone_sha256', 'user_data.phone_sha256'));

  // DLV — chat (cf. docs/gtm/13-events-chat.md §8)
  variables.push(buildDLV('DLV - chat.session_id', 'params.session_id', FOLDER_IDS.chat));
  variables.push(buildDLV('DLV - chat.message_id', 'params.message_id', FOLDER_IDS.chat));
  variables.push(buildDLV('DLV - chat.role', 'params.role', FOLDER_IDS.chat));
  variables.push(buildDLV('DLV - chat.language', 'params.language', FOLDER_IDS.chat));
  variables.push(buildDLV('DLV - chat.message_index', 'params.message_index', FOLDER_IDS.chat));
  variables.push(buildDLV('DLV - chat.first_token_ms', 'params.first_token_ms', FOLDER_IDS.chat));
  variables.push(buildDLV('DLV - chat.value', 'params.value', FOLDER_IDS.chat));
  variables.push(buildDLV('DLV - chat.error_code', 'params.error_code', FOLDER_IDS.chat));
  variables.push(buildDLV('DLV - chat.intent_dominant', 'params.intent_dominant', FOLDER_IDS.chat));

  return variables;
}

// ─────────────────────────────────────────────────────────────────────────────
// Triggers
// ─────────────────────────────────────────────────────────────────────────────

function buildPageViewAllPages(): GtmTrigger {
  return {
    name: 'PV — All Pages',
    type: 'pageview',
    triggerId: nextId(),
    parentFolderId: FOLDER_IDS.page,
  };
}

function buildCustomEvent(eventName: string, folderId: string): GtmTrigger {
  return {
    name: `CE — ${eventName}`,
    type: 'customEvent',
    customEventFilter: [
      {
        type: 'equals',
        parameter: [
          { type: 'template', key: 'arg0', value: '{{_event}}' },
          { type: 'template', key: 'arg1', value: eventName },
        ],
      },
    ],
    triggerId: nextId(),
    parentFolderId: folderId,
  };
}

function categoryToFolder(category: string, eventName: string): string {
  if (eventName.startsWith('chat_')) return FOLDER_IDS.chat;
  if (eventName.startsWith('fg_')) return FOLDER_IDS.fgCustom;
  switch (category) {
    case 'ecommerce':
      return FOLDER_IDS.ecommerce;
    case 'lead':
      return FOLDER_IDS.lead;
    case 'page':
    case 'engagement':
      return FOLDER_IDS.page;
    case 'admin':
      return FOLDER_IDS.config;
    default:
      return FOLDER_IDS.helpers;
  }
}

export function buildAllTriggers(): GtmTrigger[] {
  const triggers: GtmTrigger[] = [];
  triggers.push(buildPageViewAllPages());
  for (const ev of EVENT_CATALOG) {
    triggers.push(buildCustomEvent(ev.name, categoryToFolder(ev.category, ev.name)));
  }
  return triggers;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tags
// ─────────────────────────────────────────────────────────────────────────────

function findTriggerId(triggers: GtmTrigger[], name: string): string {
  const t = triggers.find((x) => x.name === name);
  if (!t || !t.triggerId) throw new Error(`Trigger introuvable : ${name}`);
  return t.triggerId;
}

function buildGa4ConfigTag(triggers: GtmTrigger[]): GtmTag {
  return {
    name: 'GA4 Cfg — Production',
    type: 'gaawc',
    parameter: [
      param('measurementId', '{{CONST - GA4 Measurement ID}}'),
      param('sendPageView', 'false', 'boolean'),
    ],
    firingTriggerId: [findTriggerId(triggers, 'PV — All Pages')],
    priority: { type: 'integer', value: '80' },
    tagFiringOption: 'oncePerEvent',
    parentFolderId: FOLDER_IDS.config,
  };
}

function buildGa4EventTag(ev: EventCatalogEntry, triggers: GtmTrigger[]): GtmTag | null {
  if (!ev.defaultProviders.includes('google_ga4')) return null;
  const ga4Name = mapEventName(ev.name, 'google_ga4') ?? ev.name;
  return {
    name: `GA4 Evt — ${ev.name}`,
    type: 'gaawe',
    parameter: [
      param('eventName', ga4Name),
      param('measurementId', '{{CONST - GA4 Measurement ID}}'),
    ],
    firingTriggerId: [findTriggerId(triggers, `CE — ${ev.name}`)],
    parentFolderId: categoryToFolder(ev.category, ev.name),
  };
}

function buildMetaEventTag(ev: EventCatalogEntry, triggers: GtmTrigger[]): GtmTag | null {
  const metaName = mapEventName(ev.name, 'meta');
  if (!metaName) return null;
  return {
    name: `Meta Evt — ${metaName}`,
    type: 'html',
    parameter: [
      param(
        'html',
        `<script>fbq('track', '${metaName}', { event_id: {{DLV - event_id}} });</script>`,
      ),
      param('supportDocumentWrite', 'false', 'boolean'),
    ],
    firingTriggerId: [findTriggerId(triggers, `CE — ${ev.name}`)],
    setupTag: [{ tagName: 'Meta Init — production', stopOnSetupFailure: false }],
    parentFolderId: categoryToFolder(ev.category, ev.name),
  };
}

export function buildAllTags(triggers: GtmTrigger[], cfg: GtmEnvConfig): GtmTag[] {
  const tags: GtmTag[] = [];
  if (cfg.enabledProviders.includes('google_ga4') && cfg.ga4MeasurementId) {
    tags.push(buildGa4ConfigTag(triggers));
    for (const ev of EVENT_CATALOG) {
      const tag = buildGa4EventTag(ev, triggers);
      if (tag) tags.push(tag);
    }
  }
  if (cfg.enabledProviders.includes('meta') && cfg.metaPixelId) {
    for (const ev of EVENT_CATALOG) {
      const tag = buildMetaEventTag(ev, triggers);
      if (tag) tags.push(tag);
    }
  }
  return tags;
}

// ─────────────────────────────────────────────────────────────────────────────
// Folders
// ─────────────────────────────────────────────────────────────────────────────

const FOLDER_DEFINITIONS: GtmFolder[] = [
  { folderId: FOLDER_IDS.config, name: '00 — Configuration' },
  { folderId: FOLDER_IDS.page, name: '01 — Page & Engagement' },
  { folderId: FOLDER_IDS.ecommerce, name: '02 — E-commerce' },
  { folderId: FOLDER_IDS.lead, name: '03 — Lead & Form' },
  { folderId: FOLDER_IDS.conversions, name: '04 — Conversions' },
  { folderId: FOLDER_IDS.fgCustom, name: '05 — FemiGlow custom' },
  { folderId: FOLDER_IDS.consent, name: '06 — Consent Mode' },
  { folderId: FOLDER_IDS.helpers, name: '07 — Helpers' },
  { folderId: FOLDER_IDS.chat, name: '08 — Chat assistant' },
];

export function buildFolders(): GtmFolder[] {
  return FOLDER_DEFINITIONS.slice();
}

// ─────────────────────────────────────────────────────────────────────────────
// Container assembly
// ─────────────────────────────────────────────────────────────────────────────

export interface BuildOptions {
  env: GtmEnvironment;
  config?: Partial<GtmEnvConfig>;
  accountId?: string;
  containerId?: string;
  /**
   * Date d'export à inscrire dans `exportTime`. Par défaut : `new Date()`.
   * À fixer dans les tests pour que `prettyPrint` reste byte-identique.
   */
  exportTime?: Date;
}

export function buildContainer(opts: BuildOptions): GtmContainer {
  resetIds();

  const env = opts.env;
  const cfg = { ...ENV_DEFAULTS[env], ...(opts.config ?? {}) };
  const accountId = opts.accountId ?? '6000000000';
  const containerId = opts.containerId ?? '12345678';

  const variables = buildAllVariables(env, cfg);
  const triggers = buildAllTriggers();
  const tags = buildAllTags(triggers, cfg);
  const folders = buildFolders();

  return {
    exportFormatVersion: 2,
    exportTime: (opts.exportTime ?? new Date()).toISOString(),
    containerVersion: {
      path: `accounts/${accountId}/containers/${containerId}`,
      accountId,
      containerId,
      container: {
        accountId,
        containerId,
        name: `FemiGlow Web — ${env}`,
        usageContext: ['WEB'],
      },
      tag: tags,
      trigger: triggers,
      variable: variables,
      folder: folders,
      builtInVariable: buildBuiltinList(),
    },
  };
}
