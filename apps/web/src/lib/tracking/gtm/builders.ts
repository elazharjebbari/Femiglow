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

// Le format d'EXPORT du conteneur GTM (utilisé par l'UI « Importer un
// conteneur ») exige des enums **UPPERCASE** pour les `type` de Parameter,
// Trigger, customEventFilter, et `tagFiringOption`. Vérifié sur 4 conteneurs
// réels en exportFormatVersion 2 (Shopify/Stape/Wix/Planet-Caravan) :
//   - parameter.type ∈ { TEMPLATE | BOOLEAN | INTEGER | LIST | MAP |
//                        TAG_REFERENCE | TRIGGER_REFERENCE }
//   - trigger.type   ∈ { PAGEVIEW | CUSTOM_EVENT | CLICK | … }
//   - filter.type    ∈ { EQUALS | CONTAINS | REGEX | … }
//   - tagFiringOption∈ { ONCE_PER_EVENT | ONCE_PER_LOAD | UNLIMITED }
// Les enums lowercase (`template`, `pageview`, `customEvent`…) déclenchent
// « Error deserializing enum type [Type]. Unrecognized value [...] » alors
// même que l'API REST (tagmanager.googleapis.com) les accepte — l'UI
// d'import est plus stricte. Tag.type et Variable.type, eux, restent
// lowercase (identifiants stables : `gaawc`, `gaawe`, `html`, `c`, `v`…).
const param = (
  key: string,
  value: string,
  type: 'TEMPLATE' | 'BOOLEAN' | 'INTEGER' = 'TEMPLATE',
): GtmParameter => ({
  type,
  key,
  value,
});

let idCounter = 1;
const nextId = () => String(idCounter++);
const resetIds = () => {
  idCounter = 1;
};

// GTM impose des `folderId` en base-10 (« Invalid parent_folder_id (base
// 10 number expected) ») : le format `F-00` est refusé à l'import. Les
// IDs ci-dessous sont des chaînes numériques pures. Comme `folderId`,
// `tagId`, `triggerId`, `variableId` vivent dans des espaces de noms
// disjoints côté GTM, des collisions d'entiers entre types n'ont pas
// d'effet — chaque référence (`parentFolderId`, `firingTriggerId`…) cible
// son propre tableau.
const FOLDER_IDS = {
  config: '1',
  page: '2',
  ecommerce: '3',
  lead: '4',
  conversions: '5',
  fgCustom: '6',
  consent: '7',
  helpers: '8',
  chat: '9',
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Built-in variables
// ─────────────────────────────────────────────────────────────────────────────

const BUILTIN_LIST: GtmBuiltInVariable[] = [
  // Built-in variables : le format d'import GTM exige UPPER_SNAKE_CASE
  // (`PAGE_URL`, `CLICK_ELEMENT`…), pas du camelCase. Vérifié sur conteneurs
  // réels exportFormatVersion 2.
  { type: 'PAGE_URL', name: 'Page URL' },
  { type: 'PAGE_HOSTNAME', name: 'Page Hostname' },
  { type: 'PAGE_PATH', name: 'Page Path' },
  { type: 'REFERRER', name: 'Referrer' },
  { type: 'CLICK_ELEMENT', name: 'Click Element' },
  { type: 'CLICK_CLASSES', name: 'Click Classes' },
  { type: 'CLICK_ID', name: 'Click ID' },
  { type: 'CLICK_URL', name: 'Click URL' },
  { type: 'CLICK_TEXT', name: 'Click Text' },
  { type: 'FORM_ELEMENT', name: 'Form Element' },
  { type: 'FORM_CLASSES', name: 'Form Classes' },
  { type: 'FORM_ID', name: 'Form ID' },
  { type: 'FORM_TEXT', name: 'Form Text' },
  { type: 'EVENT', name: 'Event' },
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
      param('dataLayerVersion', '2', 'INTEGER'),
      param('setDefaultValue', 'false', 'BOOLEAN'),
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
    type: 'PAGEVIEW',
    triggerId: nextId(),
    parentFolderId: FOLDER_IDS.page,
  };
}

function buildCustomEvent(eventName: string, folderId: string): GtmTrigger {
  return {
    name: `CE — ${eventName}`,
    type: 'CUSTOM_EVENT',
    customEventFilter: [
      {
        type: 'EQUALS',
        parameter: [
          { type: 'TEMPLATE', key: 'arg0', value: '{{_event}}' },
          { type: 'TEMPLATE', key: 'arg1', value: eventName },
        ],
      },
    ],
    triggerId: nextId(),
    parentFolderId: folderId,
  };
}

// Events de conversion : key events GA4 + Custom Conversions Meta. Routés
// vers le dossier « 04 — Conversions » indépendamment de leur catégorie
// d'origine (ecommerce/lead) pour matcher la sémantique GTM standard.
// `chat_lead_form_submit` et `chat_lead_webhook_sent` priment sur le préfixe
// `chat_` (qui irait sinon dans le dossier Chat).
const CONVERSION_EVENTS = new Set<string>([
  'purchase',
  'refund',
  'generate_lead',
  'sign_up',
  'contact_submit',
  'newsletter_submit',
  'chat_lead_form_submit',
  'chat_lead_webhook_sent',
]);

function categoryToFolder(category: string, eventName: string): string {
  if (CONVERSION_EVENTS.has(eventName)) return FOLDER_IDS.conversions;
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
      param('sendPageView', 'false', 'BOOLEAN'),
    ],
    firingTriggerId: [findTriggerId(triggers, 'PV — All Pages')],
    priority: { type: 'INTEGER', key: 'priority', value: '80' },
    tagFiringOption: 'ONCE_PER_EVENT',
    parentFolderId: FOLDER_IDS.config,
  };
}

function buildGa4EventTag(ev: EventCatalogEntry, triggers: GtmTrigger[]): GtmTag | null {
  if (!ev.defaultProviders.includes('google_ga4')) return null;
  const ga4Name = mapEventName(ev.name, 'google_ga4') ?? ev.name;
  // Le template GA4 Event (`gaawe`) v2 exige `measurementIdOverride`
  // (« vendorTemplate.parameter.measurementIdOverride : Vous devez indiquer
  // une valeur »). Le champ `measurementId` est réservé au tag de config
  // (`gaawc`) et déclenche une erreur de validation côté UI.
  return {
    name: `GA4 Evt — ${ev.name}`,
    type: 'gaawe',
    parameter: [
      param('eventName', ga4Name),
      param('measurementIdOverride', '{{CONST - GA4 Measurement ID}}'),
    ],
    firingTriggerId: [findTriggerId(triggers, `CE — ${ev.name}`)],
    parentFolderId: categoryToFolder(ev.category, ev.name),
  };
}

function buildMetaEventTag(ev: EventCatalogEntry, triggers: GtmTrigger[]): GtmTag | null {
  const metaName = mapEventName(ev.name, 'meta');
  if (!metaName) return null;
  // Le nom du tag inclut l'event FemiGlow source pour éviter les doublons
  // quand plusieurs events FemiGlow mappent vers le même event Meta
  // (ex. view_item_list / view_item / view_cart → tous ViewContent).
  return {
    name: `Meta Evt — ${ev.name} (${metaName})`,
    type: 'html',
    parameter: [
      param(
        'html',
        `<script>fbq('track', '${metaName}', { event_id: {{DLV - event_id}} });</script>`,
      ),
      param('supportDocumentWrite', 'false', 'BOOLEAN'),
    ],
    firingTriggerId: [findTriggerId(triggers, `CE — ${ev.name}`)],
    setupTag: [{ tagName: 'Meta Init — production', stopOnSetupFailure: false }],
    parentFolderId: categoryToFolder(ev.category, ev.name),
  };
}

function buildMetaInitTag(triggers: GtmTrigger[], cfg: GtmEnvConfig): GtmTag {
  return {
    name: 'Meta Init — production',
    type: 'html',
    parameter: [
      param(
        'html',
        `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${cfg.metaPixelId}');fbq('track','PageView');</script>`,
      ),
      param('supportDocumentWrite', 'false', 'BOOLEAN'),
    ],
    firingTriggerId: [findTriggerId(triggers, 'PV — All Pages')],
    priority: { type: 'INTEGER', key: 'priority', value: '70' },
    tagFiringOption: 'ONCE_PER_EVENT',
    parentFolderId: FOLDER_IDS.config,
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
    // Meta Init doit être créé avant les Meta Events qui le référencent en setupTag.
    tags.push(buildMetaInitTag(triggers, cfg));
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

/**
 * @deprecated Générateur GTM **legacy** (utilisé seulement par le
 * drift-detector via `gtm/snapshot.ts`, aucune route d'export). Ne gère que
 * GA4 + Meta (ni Google Ads/awct, ni Conversion Linker, ni TikTok/Snap/
 * Pinterest, ni value/currency). Cf. audit `docs/tracking-audit-2026-05-31`
 * (T-09). **Source canonique = `plan/exporter.ts` (`exportPlan`).**
 * Follow-up : rebrancher le drift-detector sur `exportPlan` puis retirer ce module.
 */
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
