/**
 * Export GTM Container JSON — format compatible avec « Admin → Import Container » UI.
 *
 * Format reference (vérifié sur exportFormatVersion 2 + cohérent avec
 * src/lib/tracking/gtm/builders.ts L94-107) :
 * - tagId / triggerId / variableId : strings encodées en BASE-10 integers
 *   (« Invalid tag_id (base 10 number expected) » si on met `tag_xxx`).
 *   Auto-incrément 1..N par tableau, espace de noms disjoint entre tag /
 *   trigger / variable.
 * - parameter.type : **UPPERCASE** `TEMPLATE | BOOLEAN | INTEGER | LIST | MAP |
 *   TAG_REFERENCE | TRIGGER_REFERENCE`.
 * - trigger.type : **UPPER_SNAKE_CASE** `CUSTOM_EVENT | PAGEVIEW | CLICK |
 *   DOM_READY | WINDOW_LOADED | LINK_CLICK | FORM_SUBMISSION | …`.
 * - customEventFilter[].type : **UPPERCASE** `EQUALS | CONTAINS | MATCH_REGEX | …`.
 * - tag.type : lowercase identifiants stables `gaawc | gaawe | html | cvt_*`.
 * - variable.type : lowercase `v | c | k | u | gas | …`.
 *
 * Les enums lowercase sur parameter/filter (`template`, `equals`, `integer`)
 * déclenchent « Error deserializing enum type [Type]. Unrecognized value
 * [...] » à l'import GTM. L'API REST tagmanager.googleapis.com les accepte —
 * l'UI d'import est plus stricte.
 *
 * Custom Templates (`cvt_meta_pixel`, `cvt_tiktok_pixel`, etc.) doivent être
 * installés AU PRÉALABLE depuis la Template Gallery côté workspace GTM.
 * cf. docs/event-mappings/30-backend/gtm-export.md + ADR-003
 */
import { createHash } from 'node:crypto';
import { PROVIDER_KINDS_FOR_MAPPING, type MappingProviderKind, type Mappings } from './types';

type Env = 'production' | 'stage' | 'preview' | 'dev';

export interface GtmExportInput {
  mappings: Mappings;
  env: Env;
  containerName?: string;
  publicId?: string;
}

interface GtmTag {
  tagId: string;
  name: string;
  type: string;
  parameter: Array<{ type: string; key: string; value: string }>;
  firingTriggerId: string[];
}

interface GtmTrigger {
  triggerId: string;
  name: string;
  type: string;
  customEventFilter?: Array<{
    type: string;
    parameter: Array<{ type: string; key: string; value: string }>;
  }>;
}

interface GtmVariable {
  variableId: string;
  name: string;
  type: string;
  parameter: Array<{ type: string; key: string; value: string }>;
}

export interface GtmContainerJson {
  exportFormatVersion: 2;
  exportTime: string;
  containerVersion: {
    container: {
      name: string;
      publicId: string;
      usageContext: ['WEB'];
    };
    tag: GtmTag[];
    trigger: GtmTrigger[];
    variable: GtmVariable[];
  };
}

export interface GtmExportOutput {
  containerJson: GtmContainerJson;
  meta: {
    sha256: string;
    eventsCount: number;
    tagsCount: number;
    variablesCount: number;
    triggersCount: number;
    env: Env;
  };
}

/**
 * Tag types GTM par provider — TOUS built-in, zéro installation requise.
 *
 *   - `gaawe`  : Google Analytics 4 Event
 *   - `awct`   : Google Ads Conversion Tracking
 *   - `html`   : Custom HTML (snippet inline pour Meta/TikTok/Snap/Pinterest)
 *
 * Précédente version utilisait des Custom Templates (`cvt_meta_pixel`,
 * `cvt_tiktok_pixel`, etc.) qui exigent une installation manuelle depuis la
 * Template Gallery. C'est friction côté admin et casse l'import si oublié.
 * On passe à `html` qui charge la lib + appelle l'event en une seule étape,
 * universel et autonome.
 */
const PROVIDER_TO_GTM_TYPE: Record<MappingProviderKind, string> = {
  meta: 'html',
  google_ga4: 'gaawe',
  google_ads: 'awct',
  tiktok: 'html',
  snap: 'html',
  pinterest: 'html',
};

/**
 * Snippets HTML par provider — chargent la lib de tracking + fire l'event.
 * Idempotents : la lib n'est chargée qu'une fois grâce au check `if (window.X)`.
 * Les Pixel/Tag IDs sont des références à des variables GTM (« {{...}} »)
 * que l'utilisateur configure dans GTM → Variables.
 */
function htmlSnippetForProvider(
  kind: MappingProviderKind,
  mappedName: string,
  isCustom: boolean,
): string {
  if (kind === 'meta') {
    const eventCall = isCustom
      ? `fbq('trackCustom', ${JSON.stringify(mappedName)});`
      : `fbq('track', ${JSON.stringify(mappedName)});`;
    return `<script>
(function(){
  if (!window.fbq) {
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
    n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
    document,'script','https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', '{{Meta Pixel ID}}');
  }
  ${eventCall}
})();
</script>`;
  }
  if (kind === 'tiktok') {
    return `<script>
(function(){
  if (!window.ttq) {
    !function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
    ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"];
    ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
    for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
    ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
    ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};
    ttq.load('{{TikTok Pixel ID}}');
    ttq.page();
    }(window, document, 'ttq');
  }
  ttq.track(${JSON.stringify(mappedName)}, {});
})();
</script>`;
  }
  if (kind === 'snap') {
    return `<script>
(function(){
  if (!window.snaptr) {
    (function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};
    a.queue=[];var s='script';r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u)})(window,document,'https://sc-static.net/scevent.min.js');
    snaptr('init', '{{Snap Pixel ID}}');
  }
  snaptr('track', ${JSON.stringify(mappedName)});
})();
</script>`;
  }
  if (kind === 'pinterest') {
    return `<script>
(function(){
  if (!window.pintrk) {
    !function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var n=window.pintrk;n.queue=[],n.version="3.0";
    var t=document.createElement("script");t.async=!0,t.src=e;var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
    pintrk('load', '{{Pinterest Tag ID}}');
    pintrk('page');
  }
  pintrk('track', ${JSON.stringify(mappedName)});
})();
</script>`;
  }
  return '';
}

/**
 * Sanitize les noms de tags/triggers/variables pour GTM.
 * Caractères interdits dans l'UI : `:`, certains symboles spéciaux. On
 * remplace par un tiret pour préserver la lisibilité.
 */
function sanitizeGtmName(raw: string): string {
  return raw.replace(/:/g, ' -').replace(/\s+/g, ' ').trim();
}

export function buildGtmContainer(input: GtmExportInput): GtmExportOutput {
  const triggers: GtmTrigger[] = [];
  const tags: GtmTag[] = [];
  const variableNames = new Set<string>();

  // Auto-incrementing IDs per namespace. GTM requires base-10 integer strings.
  let nextTriggerId = 1;
  let nextTagId = 1;
  let nextVariableId = 1;

  // 1. Variables génériques DLV utilisées
  const baseVariables = ['event_id', 'currency', 'value', 'transaction_id', 'items', 'form_id', 'first_field', 'lead_id', 'method'];
  for (const v of baseVariables) variableNames.add(v);

  // 2. Pour chaque event canonique, créer 1 trigger + 1 tag par cell active
  for (const [eventName, providers] of Object.entries(input.mappings)) {
    const triggerId = String(nextTriggerId++);
    triggers.push({
      triggerId,
      name: sanitizeGtmName(`FemiGlow — ${eventName}`),
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
    });

    for (const kind of PROVIDER_KINDS_FOR_MAPPING) {
      const cell = providers[kind];
      if (!cell || !cell.isEnabled || !cell.mappedName) continue;
      const tagType = PROVIDER_TO_GTM_TYPE[kind];
      const parameter: GtmTag['parameter'] = [];
      if (kind === 'meta' || kind === 'tiktok' || kind === 'snap' || kind === 'pinterest') {
        // Tag HTML inline : charge la lib (idempotent) + fire l'event.
        parameter.push({
          type: 'TEMPLATE',
          key: 'html',
          value: htmlSnippetForProvider(kind, cell.mappedName, cell.isCustom),
        });
      } else if (kind === 'google_ga4') {
        // gaawe (GA4 Event) attend `measurementIdOverride` (pas
        // `measurementId`) pour identifier le pixel GA4. Le champ est
        // obligatoire si on n'a pas de GA4 Config Tag séparé référencé.
        parameter.push({
          type: 'TEMPLATE',
          key: 'measurementIdOverride',
          value: '{{GA4 Measurement ID}}',
        });
        parameter.push({ type: 'TEMPLATE', key: 'eventName', value: cell.mappedName });
      } else if (kind === 'google_ads') {
        // awct (Ads Conversion Tracking) built-in. Le mappedName est au
        // format « AW-XXX/conversion_label ». On laisse l'utilisateur
        // configurer conversionId + conversionLabel via les variables CONST.
        parameter.push({
          type: 'TEMPLATE',
          key: 'conversionId',
          value: '{{Google Ads Customer ID}}',
        });
        parameter.push({ type: 'TEMPLATE', key: 'conversionLabel', value: cell.mappedName });
      } else {
        parameter.push({ type: 'TEMPLATE', key: 'eventName', value: cell.mappedName });
      }
      parameter.push({ type: 'TEMPLATE', key: 'eventID', value: '{{DLV - event_id}}' });

      tags.push({
        tagId: String(nextTagId++),
        name: sanitizeGtmName(`FemiGlow — ${kind} — ${eventName}`),
        type: tagType,
        parameter,
        firingTriggerId: [triggerId],
      });
    }
  }

  const variables: GtmVariable[] = Array.from(variableNames)
    .sort()
    .map((name) => ({
      variableId: String(nextVariableId++),
      name: sanitizeGtmName(`DLV - ${name}`),
      type: 'v',
      parameter: [
        { type: 'TEMPLATE', key: 'name', value: name },
        { type: 'INTEGER', key: 'dataLayerVersion', value: '2' },
      ],
    }));

  const container: GtmContainerJson = {
    exportFormatVersion: 2,
    exportTime: new Date().toISOString(),
    containerVersion: {
      container: {
        name: input.containerName ?? `FemiGlow Web (export ${input.env})`,
        publicId: input.publicId ?? 'GTM-XXXXXXX',
        usageContext: ['WEB'],
      },
      tag: tags,
      trigger: triggers,
      variable: variables,
    },
  };

  const containerJsonString = JSON.stringify(container.containerVersion);
  const sha256 = createHash('sha256').update(containerJsonString).digest('hex');

  return {
    containerJson: container,
    meta: {
      sha256,
      eventsCount: Object.keys(input.mappings).length,
      tagsCount: tags.length,
      variablesCount: variables.length,
      triggersCount: triggers.length,
      env: input.env,
    },
  };
}
