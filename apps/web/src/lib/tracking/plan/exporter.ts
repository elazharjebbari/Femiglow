import { createHash } from 'crypto';

import {
  getAdsConversionLabelKey,
  getAttributionMode,
  getEventIdentityFields,
  getEventMapping,
} from '@/lib/tracking/providers/event-mapping';
import type { AdsConversionCategory } from '@/lib/tracking/providers/event-mapping';
import { findEventInCatalog } from '@/lib/tracking/event-catalog';
import { DATALAYER_PATHS } from '@/lib/tracking/datalayer-paths';

/**
 * Politique de gating attribution PAR PROVIDER (cf. event-mapping.ts
 * → `getAttributionMode`).
 *
 *   - `'primary'`   → tag attribution-gated (filter `attribution.channel ∈
 *                     {provider|direct|organic|broadcast}`). Réservé aux
 *                     conversions pilotant le bidding (Purchase, Lead).
 *   - `'broadcast'` → tag sans filtre attribution. Pour les secondary
 *                     conversions (add_to_cart, checkout_intent, sign_up,
 *                     newsletter, video_complete, …) ET pour les
 *                     audience events (view_item, view_cart, …) afin
 *                     d'alimenter les algorithmes d'observation.
 *
 * Le flag global `event-catalog.isConversion` est désormais ignoré pour
 * le gating (il reste informatif côté catalogue) — la décision se fait
 * par-provider via `getAttributionMode(eventKey, provider)`.
 */
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
  map?: GtmParameter[];
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
  type: 'EQUALS' | 'CONTAINS' | 'STARTS_WITH' | 'ENDS_WITH' | 'MATCH_REGEX';
  parameter: GtmParameter[];
}

interface GtmTrigger {
  triggerId: string;
  name: string;
  type: 'PAGEVIEW' | 'CUSTOM_EVENT' | 'DOM_READY' | 'WINDOW_LOADED';
  /**
   * Filtre du nom d'event. GTM limite à **UNE SEULE entrée** ici pour
   * les CUSTOM_EVENT triggers (l'erreur « Un déclencheur d'événement
   * personnalisé doit comporter un seul filtre d'événement personnalisé »
   * apparaît sinon). Les conditions supplémentaires (ex. filtre
   * d'attribution) doivent passer dans `filter` ci-dessous.
   */
  customEventFilter?: GtmTriggerFilter[];
  /**
   * Conditions additionnelles évaluées APRÈS le matching event.
   * Tableau libre — autant d'entrées qu'on veut.
   */
  filter?: GtmTriggerFilter[];
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

function snapEventNameFor(eventKey: string): string | null {
  return getEventMapping(eventKey)?.snap?.name ?? null;
}

/**
 * Nom canonique TikTok pour un event FemiGlow (Purchase, AddToCart, …),
 * ou `null` si l'event n'est pas mappé pour TikTok. Le caller skip
 * l'émission de la balise plutôt que de pousser un custom event qui
 * n'optimiserait pas les campagnes Sales/Lead.
 *
 * Liste canonique : ads.tiktok.com/help/article/standard-events-parameters
 * Note : le legacy `CompletePayment` (Events API V1.3 pré-unification)
 * a été remplacé par `Purchase` via event-mapping.ts (cf. fix Purchase).
 */
function tiktokEventNameFor(eventKey: string): string | null {
  return getEventMapping(eventKey)?.tiktok?.name ?? null;
}

// ─── Détection « event monétaire » (catalogue) ───────────────────────
// Le plan `TrackingEvent` ne porte pas la catégorie ; on dérive du catalogue
// (source de vérité) si l'event déclare `value` / `transaction_id`.
function catalogParamProps(eventKey: string): Record<string, unknown> | null {
  const props = (
    findEventInCatalog(eventKey)?.paramsSchema as
      | { properties?: Record<string, unknown> }
      | undefined
  )?.properties;
  return props ?? null;
}
function eventHasValue(eventKey: string): boolean {
  return Boolean(catalogParamProps(eventKey)?.value);
}
function eventHasTransactionId(eventKey: string): boolean {
  return Boolean(catalogParamProps(eventKey)?.transaction_id);
}

// Une ligne `eventSettingsTable` GA4 (`gaawe`) : MAP { parameter, parameterValue }.
function ga4Setting(parameter: string, placeholder: string): GtmParameter {
  return {
    type: 'MAP',
    map: [
      { type: 'TEMPLATE', key: 'parameter', value: parameter },
      { type: 'TEMPLATE', key: 'parameterValue', value: placeholder },
    ],
  };
}

// Une ligne `fieldsToSet` du GA4 Config (`gaawc`) : MAP { fieldName, value }.
// Les champs posés sur la config sont envoyés avec TOUS les events GA4.
function ga4Field(fieldName: string, placeholder: string): GtmParameter {
  return {
    type: 'MAP',
    map: [
      { type: 'TEMPLATE', key: 'fieldName', value: fieldName },
      { type: 'TEMPLATE', key: 'value', value: placeholder },
    ],
  };
}

// Events Meta où value/currency sont injectés EN CLAIR dans le 3e arg de
// `fbq('track', …)`. Restreint aux conversions TOUJOURS valorisées :
// interpoler `{{DLV - value}}` dans un objet JS inline produirait `value: ,`
// (script cassé) si la value manquait. Les autres events ecommerce restent
// en `{}` côté pixel — leur valeur passe par GA4 (param vide toléré) / awct.
const META_VALUE_EVENTS: ReadonlySet<string> = new Set([
  'purchase',
  'generate_lead',
  'lead_capture',
]);

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
    googleAdsEnhancedConversions?: boolean;
    snapAdvancedMatching?: boolean;
    snapEventMode?: 'pixel_only' | 'capi_only' | 'hybrid';
    // Default: 'capi_only' — SnapPixelEvents component handles client-side
    // snaptr('track') calls. GTM tags are skipped to avoid duplicate events.
    // Set 'hybrid' only if SnapPixelEvents is removed from the layout.
  };
  const conversionLabels = cfg.googleAdsConversionLabels ?? {};
  // Enhanced Conversions par défaut activé (admin override possible).
  // Recommandation Google : ~5-30% conversions matchées en plus.
  const enhancedConversionsEnabled =
    cfg.googleAdsEnhancedConversions !== false;
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
    // GTM tag template `awct` (Google Ads Conversion Tracking) attend
    // le `conversionId` SOUS forme numérique uniquement. Si on passe
    // `AW-18136327114`, GTM re-préfixe en interne →
    // `AW-AW-18136327114` dans le ping final, et Google Ads ne
    // compte AUCUNE conversion (Tag Assistant affiche un container
    // fantôme `AW-AW-…`).
    //
    // Notre formulaire admin EXIGE le préfixe `AW-` pour la lisibilité
    // utilisateur. On strip ici avant injection dans la CONST GTM.
    const rawConversionId = cfg.googleAdsConversionId.replace(/^AW-/i, '');
    idVars.googleAds = makeConst('CONST - Google Ads Conversion ID', rawConversionId);
  }
  // Snap GTM tags only generated when explicitly set to 'hybrid' or 'pixel_only'.
  // Default is 'capi_only' — SnapPixelEvents component handles client-side events.
  const snapNeedsGtm =
    cfg.snapEventMode === 'hybrid' || cfg.snapEventMode === 'pixel_only';

  if (activeProviders.has('meta') && cfg.metaPixelId) {
    idVars.meta = makeConst('CONST - Meta Pixel ID', cfg.metaPixelId);
  }
  if (activeProviders.has('tiktok') && cfg.tiktokPixelId) {
    idVars.tiktok = makeConst('CONST - TikTok Pixel ID', cfg.tiktokPixelId);
  }
  if (activeProviders.has('snap') && cfg.snapPixelId && snapNeedsGtm) {
    idVars.snap = makeConst('CONST - Snap Pixel ID', cfg.snapPixelId);
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
  const needsSnapPixel =
    activeProviders.has('snap') &&
    !!cfg.snapPixelId &&
    snapNeedsGtm;
  if (needsMeta || needsSnapPixel) ensureDlv('DLV - event_id', 'event_id');

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
    // `page_locale` posé sur la config → envoyé avec TOUS les events GA4.
    // Permet de segmenter conversions/revenu par langue du site (fr/ar/en).
    // Déclarer une custom dimension `page_locale` côté GA4 pour l'exploiter.
    const localeVar = ensureDlv('DLV - page.locale', DATALAYER_PATHS.pageLocale);
    tags.push({
      tagId: nextTag(),
      name: 'GA4 Cfg',
      type: 'gaawc',
      parameter: [
        { type: 'TEMPLATE', key: 'measurementId', value: idVars.ga4 },
        { type: 'BOOLEAN', key: 'sendPageView', value: 'false' },
        { type: 'LIST', key: 'fieldsToSet', list: [ga4Field('page_locale', localeVar)] },
      ],
      priority: { type: 'INTEGER', key: 'priority', value: '80' },
      tagFiringOption: 'ONCE_PER_EVENT',
      firingTriggerId: [allPagesId],
      parentFolderId: '1',
    });
  }

  // ─── Google Ads Configuration tag (Google Tag / googtag) ─────────
  // Résout le warning Tag Assistant « Hits différés / Certains hits ne
  // seront pas envoyés tant qu'une commande de configuration ne sera
  // pas fournie par le biais d'un appel gtag('config') ou d'une
  // balise Google dans Tag Manager. »
  //
  // Pourquoi cette balise : le template `awct` (Google Ads Conversion
  // Tracking) émet UNIQUEMENT `gtag('event','conversion',{send_to:
  // 'AW-XXX/LABEL'})` — il n'appelle JAMAIS `gtag('config','AW-XXX')`.
  // Côté Tag Assistant, le container AW-XXX est détecté (via la
  // déclaration `destinations`) mais reste "à 0 tags firés" → warning.
  //
  // Le template `googtag` (Google Tag, équivalent gaawc pour Ads)
  // appelle `gtag('config','AW-XXX', { ... })` à chaque PageView. Pas
  // de doublon de conversion : googtag ne fire AUCUN event de
  // conversion — il initialise seulement la destination AW-XXX
  // (cookies, conversion linker, transport_url). Les conversions
  // restent owned par les tags `awct`.
  //
  // Important : tagId doit inclure le préfixe AW- (contrairement au
  // template awct qui le strip). Source : doc Google Tag.
  if (idVars.googleAds && cfg.googleAdsConversionId) {
    const fullAdsId = cfg.googleAdsConversionId.startsWith('AW-')
      ? cfg.googleAdsConversionId
      : `AW-${cfg.googleAdsConversionId}`;
    tags.push({
      tagId: nextTag(),
      name: 'Ads Cfg',
      type: 'googtag',
      parameter: [
        { type: 'TEMPLATE', key: 'tagId', value: fullAdsId },
      ],
      priority: { type: 'INTEGER', key: 'priority', value: '75' },
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

  // ─── Snapchat Init tag (loads snaptr + PageView) ─────────────────
  const SNAP_INIT_NAME = 'Snap Init';
  if (idVars.snap && cfg.snapPixelId && snapNeedsGtm) {
    const initArgs = cfg.snapAdvancedMatching === false
      ? `snaptr('init','${cfg.snapPixelId}');`
      : `snaptr('init','${cfg.snapPixelId}',{user_hashed_email:'{{DLV - user_data.email_sha256}}',user_hashed_phone_number:'{{DLV - user_data.phone_sha256}}'});`;
    if (cfg.snapAdvancedMatching !== false) {
      ensureDlv('DLV - user_data.email_sha256', 'user_data.sha256_email_address', '3');
      ensureDlv('DLV - user_data.phone_sha256', 'user_data.sha256_phone_number', '3');
    }
    const initSnippet = [
      `<script>(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){`,
      `a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};`,
      `a.queue=[];var s='script';var r=t.createElement(s);r.async=!0;r.src=n;`,
      `var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u)`,
      `})(window,document,'https://sc-static.net/scevent.min.js');`,
      initArgs,
      `snaptr('track','PAGE_VIEW');</script>`,
    ].join('');
    tags.push({
      tagId: nextTag(),
      name: SNAP_INIT_NAME,
      type: 'html',
      parameter: [
        { type: 'TEMPLATE', key: 'html', value: initSnippet },
        { type: 'BOOLEAN', key: 'supportDocumentWrite', value: 'false' },
      ],
      priority: { type: 'INTEGER', key: 'priority', value: '65' },
      tagFiringOption: 'ONCE_PER_EVENT',
      firingTriggerId: [allPagesId],
      parentFolderId: '1',
    });
  }

  // ─── TikTok Init tag (bootstrap ttq + Pageview) ──────────────────
  // Charge le SDK officiel TikTok Pixel et déclenche le premier
  // Pageview. Référencé en `setupTag` par chaque TikTok Evt pour
  // garantir que `window.ttq` est défini avant `ttq.track(...)`
  // (GTM dédup `ONCE_PER_EVENT` rend ce chain idempotent).
  // Source SDK : analytics.tiktok.com/i18n/pixel/events.js
  const TIKTOK_INIT_NAME = 'TikTok Init';
  if (idVars.tiktok && cfg.tiktokPixelId) {
    const initSnippet = [
      `<script>!function(w,d,t){w.TiktokAnalyticsObject=t;`,
      `var ttq=w[t]=w[t]||[];`,
      `ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];`,
      `ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};`,
      `for(var i=0;i<ttq.methods.length;i++){ttq.setAndDefer(ttq,ttq.methods[i])}`,
      `ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++){ttq.setAndDefer(e,ttq.methods[n])}return e};`,
      `ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";`,
      `ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;`,
      `ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;`,
      `o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};`,
      `ttq.load('${cfg.tiktokPixelId}');ttq.page();`,
      `}(window,document,'ttq');</script>`,
    ].join('');
    tags.push({
      tagId: nextTag(),
      name: TIKTOK_INIT_NAME,
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

  // ─── Triggers conditionnés par attribution ─────────────────────
  // Pour chaque event-conversion × pixel payant, on génère un trigger
  // dédié qui combine :
  //   - EQUALS sur le nom de l'event (filtre CustomEvent standard)
  //   - MATCH_REGEX sur {{DLV - attribution.channel}} = (provider|direct|organic)
  //
  // Les events d'audience (isConversion=false dans event-catalog)
  // utilisent le trigger CustomEvent classique sans filtre attribution
  // → fire sur tous les pixels.
  const attributionTriggerCache = new Map<string, string>();
  function ensureAttributionTrigger(
    eventKey: string,
    providerKey: 'meta' | 'google_ads' | 'tiktok' | 'snap',
  ): string {
    const cacheKey = `${eventKey}:${providerKey}`;
    const cached = attributionTriggerCache.get(cacheKey);
    if (cached) return cached;
    // Assure que la DLV attribution.channel existe (idempotent).
    ensureDlv('DLV - attribution.channel', 'attribution.channel');
    const id = nextTrigger();
    triggers.push({
      triggerId: id,
      // NB : pas de ':' dans le nom — GTM rejette le caractère ':' à
      // l'import ("The name contains invalid character"). On utilise
      // un séparateur ' / ' pour rester lisible.
      name: `CE — ${eventKey} [attr / ${providerKey}]`,
      type: 'CUSTOM_EVENT',
      // customEventFilter : UN SEUL filtre autorisé par GTM
      // (matching du nom d'event). Si on en met plusieurs, GTM rejette
      // l'import avec "Un déclencheur d'événement personnalisé doit
      // comporter un seul filtre d'événement personnalisé".
      customEventFilter: [
        {
          type: 'EQUALS',
          parameter: [
            { type: 'TEMPLATE', key: 'arg0', value: '{{_event}}' },
            { type: 'TEMPLATE', key: 'arg1', value: eventKey },
          ],
        },
      ],
      // filter : conditions additionnelles évaluées APRÈS le matching
      // du nom d'event. C'est ici qu'on met le filtre d'attribution.
      // MATCH_REGEX → fire si channel = providerKey OU direct OU
      // organic. Le visiteur direct/organic est broadcasté à tous les
      // pixels payants (politique défaut, cf. docs/tracking-attribution/04).
      filter: [
        {
          type: 'MATCH_REGEX',
          parameter: [
            {
              type: 'TEMPLATE',
              key: 'arg0',
              value: '{{DLV - attribution.channel}}',
            },
            {
              type: 'TEMPLATE',
              key: 'arg1',
              value: `^(${providerKey}|direct|organic|broadcast)$`,
            },
          ],
        },
      ],
      parentFolderId: '2',
    });
    attributionTriggerCache.set(cacheKey, id);
    return id;
  }

  // ─── Per-event tags (GA4 + Meta, wired to CUSTOM_EVENT triggers) ─
  for (const event of sortedEvents) {
    const triggerId = eventTriggerByKey[event.key];
    if (!triggerId) continue;

    if (event.providers.ga4 && idVars.ga4) {
      const ga4Parameter: GtmParameter[] = [
        { type: 'TEMPLATE', key: 'eventName', value: event.key },
        { type: 'TEMPLATE', key: 'measurementIdOverride', value: idVars.ga4 },
      ];
      // T-02 — transmettre value/currency(/transaction_id) à GA4 pour les
      // events monétaires (sinon revenu GA4 = 0). Un param absent au runtime
      // est ignoré par GA4 (pas d'erreur, contrairement à l'inline Meta).
      if (eventHasValue(event.key)) {
        const settings: GtmParameter[] = [
          ga4Setting('value', ensureDlv('DLV - value', DATALAYER_PATHS.value)),
          ga4Setting('currency', ensureDlv('DLV - currency', DATALAYER_PATHS.currency)),
        ];
        if (eventHasTransactionId(event.key)) {
          settings.push(
            ga4Setting(
              'transaction_id',
              ensureDlv('DLV - transaction_id', DATALAYER_PATHS.transactionId),
            ),
          );
        }
        ga4Parameter.push({ type: 'LIST', key: 'eventSettingsTable', list: settings });
      }
      tags.push({
        tagId: nextTag(),
        name: `GA4 Evt — ${event.key}`,
        type: 'gaawe',
        parameter: ga4Parameter,
        firingTriggerId: [triggerId],
        parentFolderId: '2',
      });
    }

    if (event.providers.meta && idVars.meta) {
      const metaName = metaEventNameFor(event.key);
      // Attribution-gated UNIQUEMENT pour les Meta primary conversions
      // (Purchase, Lead). Tout le reste (InitiateCheckout, AddToCart,
      // AddPaymentInfo, ViewContent, sign_up CompleteRegistration, …)
      // broadcast sur tous les canaux pour alimenter Custom Audiences
      // + Advantage+ funnel learning.
      const metaTriggerId =
        getAttributionMode(event.key, 'meta') === 'primary'
          ? ensureAttributionTrigger(event.key, 'meta')
          : triggerId;
      // T-03 — custom_data (3e arg fbq) : value/currency pour les conversions
      // valorisées (sinon Purchase/Lead Meta sans valeur → ROAS Meta dégradé).
      const metaCd = META_VALUE_EVENTS.has(event.key)
        ? `{ value: ${ensureDlv('DLV - value', DATALAYER_PATHS.value)}, currency: '${ensureDlv('DLV - currency', DATALAYER_PATHS.currency)}' }`
        : '{}';
      tags.push({
        tagId: nextTag(),
        name: `Meta Evt — ${event.key} (${metaName})`,
        type: 'html',
        parameter: [
          {
            type: 'TEMPLATE',
            key: 'html',
            // Meta CAPI dedup : la 4e arg de `fbq('track', name, params, opts)`
            // doit avoir `eventID` (camelCase) — pas `event_id`. Le 3e arg
            // (`{}`) reste pour custom_data event-level (value/currency/etc.)
            // et n'est pas le bon emplacement pour eventID.
            // cf. https://developers.facebook.com/docs/marketing-api/conversions-api/deduplicate-pixel-and-server-events
            // cf. docs/meta-quality-audit-2026-05/02-plan-dev-action.md step 2.9
            value: `<script>fbq('track', '${metaName}', ${metaCd}, { eventID: {{DLV - event_id}} });</script>`,
          },
          { type: 'BOOLEAN', key: 'supportDocumentWrite', value: 'false' },
        ],
        firingTriggerId: [metaTriggerId],
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
        // T-01 — la valeur vit sous `params.*` dans le dataLayer (jamais
        // `ecommerce.*`, jamais poussé). Lire le bon chemin sinon awct envoie
        // conversionValue/currencyCode/orderId = undefined → ROAS faux + doublons.
        const txnIdVar = ensureDlv('DLV - transaction_id', DATALAYER_PATHS.transactionId);
        const currencyVar = ensureDlv('DLV - currency', DATALAYER_PATHS.currency);
        const valueVar = ensureDlv('DLV - value', DATALAYER_PATHS.value);
        // Catégorie API Google Ads (param `conversionCategory` du tag
        // awct). Permet à Ads d'associer la conversion à la bonne
        // catégorie côté reporting + bidding.
        const adsCategory: AdsConversionCategory =
          getEventMapping(event.key)?.google_ads?.category ?? 'DEFAULT';
        // Nom Google Ads (cf. event-mapping.ts → `google_ads.name`).
        // Permet à un auditeur GTM de voir directement le binding
        // canonique FemiGlow → catégorie Google. Format choisi :
        //   `Ads Conv — checkout_intent → begin_checkout`
        // (au lieu de l'ancien `Ads Conv — checkout_intent (checkout_intent)`
        // qui répétait la canonique deux fois).
        const adsName =
          getEventMapping(event.key)?.google_ads?.name ?? event.key;
        // Attribution-gated UNIQUEMENT pour les Ads PRIMARY conversions
        // (recommendedRole='primary' dans event-mapping). Les SECONDARY
        // conversions (add_to_cart, checkout_intent, sign_up, newsletter,
        // video_complete, journal_read, chat_engagement, download)
        // broadcast sur tous les canaux — alimente Smart Bidding sans
        // skewer l'attribution primary (clean primary attribution +
        // max volume secondary).
        const adsTriggerId =
          getAttributionMode(event.key, 'google_ads') === 'primary'
            ? ensureAttributionTrigger(event.key, 'google_ads')
            : triggerId;
        tags.push({
          tagId: nextTag(),
          name: `Ads Conv — ${event.key} → ${adsName}`,
          type: 'awct',
          parameter: [
            { type: 'TEMPLATE', key: 'conversionId', value: idVars.googleAds },
            { type: 'TEMPLATE', key: 'conversionLabel', value: labelVar },
            { type: 'TEMPLATE', key: 'conversionCategory', value: adsCategory },
            { type: 'TEMPLATE', key: 'orderId', value: txnIdVar },
            { type: 'TEMPLATE', key: 'currencyCode', value: currencyVar },
            { type: 'TEMPLATE', key: 'conversionValue', value: valueVar },
            // Enhanced Conversions : pilote 2 params du tag awct
            //  - enableEnhancedConversions : on/off global de l'EC
            //  - enhancedConversionsAutomaticMode : mode auto-scrape
            //    user_data depuis dataLayer (vs manuel via JS variable)
            // Param admin : envConfig.googleAdsEnhancedConversions
            // (défaut: true). Côté gtag, ça se traduit en
            // `allow_enhanced_conversions: true`.
            {
              type: 'BOOLEAN',
              key: 'enableEnhancedConversions',
              value: enhancedConversionsEnabled ? 'true' : 'false',
            },
            {
              type: 'BOOLEAN',
              key: 'enhancedConversionsAutomaticMode',
              value: enhancedConversionsEnabled ? 'true' : 'false',
            },
          ],
          firingTriggerId: [adsTriggerId],
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
      // Mapping vers le nom canonique TikTok (Purchase, AddToCart, …).
      // Si l'event FemiGlow n'a pas de mapping TikTok, on skip plutôt
      // que d'émettre `ttq.track('<fg_event_key>')` — sinon ça produit
      // un custom event qui n'optimise ni Sales ni Lead.
      //
      // TikTok primary = Purchase (purchase) + SubmitForm (lead).
      // Tout le reste broadcast.
      const tiktokName = tiktokEventNameFor(event.key);
      if (tiktokName) {
        const tiktokTriggerId =
          getAttributionMode(event.key, 'tiktok') === 'primary'
            ? ensureAttributionTrigger(event.key, 'tiktok')
            : triggerId;
        // DLV - event_id requis pour la dédup Pixel ↔ CAPI (fenêtre 48h,
        // tolérance 5min inter-canaux). Idempotent : déjà créé par la
        // branche Meta/Snap si actives, sinon créé ici.
        ensureDlv('DLV - event_id', 'event_id');
        tags.push({
          tagId: nextTag(),
          // Convention de nommage parité Snap : `<provider> Evt — <fg_key> → <VendorName>`
          // pour rendre le mapping visible dans l'UI GTM et faciliter les
          // diagnostics côté Tag Assistant.
          name: `TikTok Evt — ${event.key} → ${tiktokName}`,
          type: 'html',
          parameter: [
            {
              type: 'TEMPLATE',
              key: 'html',
              value: `<script>ttq.track('${tiktokName}', { event_id: {{DLV - event_id}} });</script>`,
            },
            { type: 'BOOLEAN', key: 'supportDocumentWrite', value: 'false' },
          ],
          firingTriggerId: [tiktokTriggerId],
          // Garantit que `TikTok Init` (ttq.load + ttq.page) tourne avant
          // que `ttq.track` ne soit appelé. GTM dédup le setupTag par
          // session ; pas de double-load possible.
          setupTag: [{ tagName: TIKTOK_INIT_NAME, stopOnSetupFailure: false }],
          parentFolderId: '2',
        });
      }
    }

    if (event.providers.snap && idVars.snap && cfg.snapPixelId && snapNeedsGtm) {
      const snapName = snapEventNameFor(event.key);
      if (snapName) {
        const snapTriggerId =
          getAttributionMode(event.key, 'snap') === 'primary'
            ? ensureAttributionTrigger(event.key, 'snap')
            : triggerId;
        const html = [
          `<script>(function(){`,
          `if(!window.snaptr)return;`,
          `var dl=window.dataLayer||[];var entry=null;`,
          `for(var i=dl.length-1;i>=0;i--){if(dl[i]&&dl[i].event==='${event.key}'){entry=dl[i];break;}}`,
          `var params=(entry&&entry.params)||{};var user=(entry&&entry.user_data)||{};var p={};`,
          `function set(k,v){if(v!==undefined&&v!==null&&v!==''&&v!=='undefined')p[k]=v;}`,
          `set('price',params.value);set('currency',params.currency);`,
          `set('transaction_id',params.transaction_id);set('client_deduplication_id',(entry&&entry.event_id)||'{{DLV - event_id}}');`,
          `set('event_tag',params.event_tag);set('description',params.description);`,
          `set('uuid_c1',params.uuid_c1||((entry&&entry.user)&&entry.user.anonymous_id));`,
          `set('geo_city',params.geo_city||params.city);set('geo_country',params.geo_country||params.country);set('geo_region',params.geo_region||params.region);`,
          `set('user_hashed_email',user.sha256_email_address);set('user_hashed_phone_number',user.sha256_phone_number);`,
          `set('firstname',user.address&&user.address.sha256_first_name);`,
          `if(Array.isArray(params.items)){p.item_ids=params.items.map(function(it){return it&&it.item_id;}).filter(Boolean);`,
          `if(params.items[0]){set('item_category',params.items[0].item_category);}}`,
          `snaptr('track','${snapName}',p);`,
          `})();</script>`,
        ].join('');
        tags.push({
          tagId: nextTag(),
          name: `Snap Evt — ${event.key} → ${snapName}`,
          type: 'html',
          parameter: [
            { type: 'TEMPLATE', key: 'html', value: html },
            { type: 'BOOLEAN', key: 'supportDocumentWrite', value: 'false' },
          ],
          firingTriggerId: [snapTriggerId],
          setupTag: [{ tagName: SNAP_INIT_NAME, stopOnSetupFailure: false }],
          parentFolderId: '2',
        });
      }
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
