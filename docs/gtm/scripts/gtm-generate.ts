#!/usr/bin/env tsx
/**
 * Générateur de container.json GTM depuis le catalogue d'events FemiGlow.
 *
 * Usage :
 *   pnpm tsx docs/gtm/scripts/gtm-generate.ts \
 *     --spec docs/gtm/annexes/gtm-spec.yaml \
 *     --out  infra/gtm/container.production.json \
 *     [--env production|stage|preview|dev]
 *
 * Lit :
 *   - apps/web/src/lib/tracking/event-catalog.ts
 *   - apps/web/src/lib/tracking/providers/event-mapping.ts
 *   - docs/gtm/annexes/gtm-spec.yaml
 *
 * Produit :
 *   - container.json importable dans GTM (UI Admin → Import)
 *   - utilisable aussi par scripts/gtm-push.ts pour sync API.
 *
 * NOTE : ce fichier est un SQUELETTE documenté. Les builders sont
 *        décrits dans docs/gtm/10-automatisation.md §5. À implémenter
 *        ticket par ticket (GTM-011 → GTM-040).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

// Imports du code applicatif (chemins relatifs au repo)
import { EVENT_CATALOG, type EventCatalogEntry } from '../../../apps/web/src/lib/tracking/event-catalog';
import { mapEventName } from '../../../apps/web/src/lib/tracking/providers/event-mapping';

// ───────────────────────────────────────────────────────────────────────────
// Types simplifiés du format container.json GTM (subset)
// ───────────────────────────────────────────────────────────────────────────

type Parameter = { type: string; key: string; value?: string; list?: Parameter[]; map?: Parameter[] };
type Variable  = { name: string; type: string; parameter?: Parameter[]; variableId?: string; folderId?: string };
type Trigger   = { name: string; type: string; customEventFilter?: any[]; filter?: any[]; triggerId?: string; folderId?: string };
type Tag       = {
  name: string;
  type: string;
  parameter?: Parameter[];
  firingTriggerId?: string[];
  blockingTriggerId?: string[];
  priority?: { type: 'integer'; value: string };
  tagFiringOption?: 'oncePerEvent' | 'oncePerLoad' | 'unlimited';
  setupTag?: { tagName: string; stopOnSetupFailure?: boolean }[];
  folderId?: string;
};
type Folder    = { name: string; folderId: string };

type Container = {
  exportFormatVersion: 2;
  exportTime: string;
  containerVersion: {
    path: string;
    accountId: string;
    containerId: string;
    container: { accountId: string; containerId: string; name: string; usageContext: ['WEB'] };
    tag: Tag[];
    trigger: Trigger[];
    variable: Variable[];
    folder: Folder[];
    builtInVariable: { type: string; name: string }[];
  };
};

type Spec = {
  account_id: string;
  container_id: string;
  container_path: string;
  default_workspace_id: string;
  constants: Record<string, string>;
  environments: Record<string, { hostname_match: string[]; auth: string; enabled_providers: string[] }>;
  custom_dimensions: { name: string; scope: 'event' | 'user'; source: string }[];
  consent_mode: { defaults: Record<string, string | number> };
  extra_triggers?: { id: string; type: string; name: string; conditions?: any[] }[];
  extra_tags?: { id: string; name: string; type: string; code?: string; triggers?: string[]; priority?: number }[];
};

// ───────────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────────

function param(key: string, value: string, type: 'template' | 'boolean' | 'integer' = 'template'): Parameter {
  return { type, key, value };
}

let nextId = 1;
const id = () => String(nextId++);

// ───────────────────────────────────────────────────────────────────────────
// Builders — variables
// ───────────────────────────────────────────────────────────────────────────

const BUILTIN_VARIABLES = [
  'pageUrl', 'pageHostname', 'pagePath', 'referrer',
  'clickElement', 'clickClasses', 'clickId', 'clickUrl', 'clickText',
  'formElement', 'formClasses', 'formId', 'formText',
  'event',
];

function buildBuiltinList() {
  return BUILTIN_VARIABLES.map((t) => ({ type: t, name: t }));
}

function buildConstants(consts: Record<string, string>): Variable[] {
  return Object.entries(consts).map(([key, value]) => ({
    name: `CONST - ${key}`,
    type: 'c',                 // Constant
    parameter: [param('value', value)],
    variableId: id(),
  }));
}

function buildDataLayerVar(name: string, dataLayerName: string): Variable {
  return {
    name,
    type: 'v',                 // Data Layer Variable
    parameter: [
      param('name', dataLayerName),
      param('dataLayerVersion', '2', 'integer'),
      param('setDefaultValue', 'false', 'boolean'),
    ],
    variableId: id(),
  };
}

function buildAllDLV(): Variable[] {
  const dlvs: { name: string; path: string }[] = [
    { name: 'DLV - event_id',                   path: 'event_id' },
    { name: 'DLV - timestamp',                  path: 'timestamp' },
    { name: 'DLV - schema_version',             path: 'schema_version' },
    { name: 'DLV - consent.analytics_storage',  path: 'consent.analytics_storage' },
    { name: 'DLV - consent.ad_storage',         path: 'consent.ad_storage' },
    { name: 'DLV - consent.ad_user_data',       path: 'consent.ad_user_data' },
    { name: 'DLV - consent.ad_personalization', path: 'consent.ad_personalization' },
    { name: 'DLV - page.url',                   path: 'page.url' },
    { name: 'DLV - page.path',                  path: 'page.path' },
    { name: 'DLV - page.title',                 path: 'page.title' },
    { name: 'DLV - page.referrer',              path: 'page.referrer' },
    { name: 'DLV - page.locale',                path: 'page.locale' },
    { name: 'DLV - user.anonymous_id',          path: 'user.anonymous_id' },
    { name: 'DLV - user.session_id',            path: 'user.session_id' },
    { name: 'DLV - user.user_id',               path: 'user.user_id' },
    { name: 'DLV - ecommerce.value',            path: 'ecommerce.value' },
    { name: 'DLV - ecommerce.currency',         path: 'ecommerce.currency' },
    { name: 'DLV - ecommerce.items',            path: 'ecommerce.items' },
    { name: 'DLV - ecommerce.transaction_id',   path: 'ecommerce.transaction_id' },
    { name: 'DLV - ecommerce.coupon',           path: 'ecommerce.coupon' },
    { name: 'DLV - ecommerce.tax',              path: 'ecommerce.tax' },
    { name: 'DLV - ecommerce.shipping',         path: 'ecommerce.shipping' },
    { name: 'DLV - user_data.email_sha256',     path: 'user_data.email_sha256' },
    { name: 'DLV - user_data.phone_sha256',     path: 'user_data.phone_sha256' },
    { name: 'DLV - user_data.first_name_sha256', path: 'user_data.first_name_sha256' },
    { name: 'DLV - user_data.last_name_sha256',  path: 'user_data.last_name_sha256' },
  ];
  return dlvs.map((d) => buildDataLayerVar(d.name, d.path));
}

// ───────────────────────────────────────────────────────────────────────────
// Builders — triggers
// ───────────────────────────────────────────────────────────────────────────

function buildCustomEventTrigger(eventName: string): Trigger {
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
    triggerId: id(),
  };
}

function buildAllCustomEventTriggers(): Trigger[] {
  return EVENT_CATALOG.map((ev) => buildCustomEventTrigger(ev.name));
}

function buildPageViewAllPagesTrigger(): Trigger {
  return { name: 'PV — All Pages', type: 'pageview', triggerId: id() };
}

// ───────────────────────────────────────────────────────────────────────────
// Builders — tags
// ───────────────────────────────────────────────────────────────────────────

function findTriggerId(triggers: Trigger[], name: string): string {
  const t = triggers.find((x) => x.name === name);
  if (!t) throw new Error(`Trigger introuvable : ${name}`);
  return t.triggerId!;
}

function buildGa4ConfigTag(triggers: Trigger[], spec: Spec): Tag {
  return {
    name: 'GA4 Cfg — Production',
    type: 'gaawc',                                    // GA4 Configuration
    parameter: [
      param('measurementId', '{{LUT - GA4 Measurement ID by Env}}'),
      param('sendPageView', 'false', 'boolean'),
      // user-provided data
      // custom dimensions
    ],
    firingTriggerId: [findTriggerId(triggers, 'PV — All Pages')],
    priority: { type: 'integer', value: '80' },
    tagFiringOption: 'oncePerEvent',
  };
}

function buildGa4EventTag(ev: EventCatalogEntry, triggers: Trigger[]): Tag | null {
  if (!ev.defaultProviders.includes('google_ga4')) return null;
  return {
    name: `GA4 Evt — ${ev.name}`,
    type: 'gaawe',                                    // GA4 Event
    parameter: [
      param('eventName', mapEventName(ev.name, 'google_ga4') ?? ev.name),
      param('measurementId', '{{LUT - GA4 Measurement ID by Env}}'),
      // event_id pour dedup
      // params dérivés du paramsSchema → à compléter
    ],
    firingTriggerId: [findTriggerId(triggers, `CE — ${ev.name}`)],
  };
}

function buildMetaEventTag(ev: EventCatalogEntry, triggers: Trigger[]): Tag | null {
  const metaName = mapEventName(ev.name, 'meta');
  if (!metaName) return null;
  return {
    name: `Meta Evt — ${metaName}`,
    type: 'html',                                     // Custom HTML
    parameter: [
      param('html', `<script>fbq('track', '${metaName}', { /* params */ }, { eventID: {{DLV - event_id}} });</script>`),
      param('supportDocumentWrite', 'false', 'boolean'),
    ],
    firingTriggerId: [findTriggerId(triggers, `CE — ${ev.name}`)],
    setupTag: [{ tagName: 'Meta Init — production', stopOnSetupFailure: false }],
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Main
// ───────────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const specPath = args.spec ?? 'docs/gtm/annexes/gtm-spec.yaml';
  const outPath  = args.out  ?? 'infra/gtm/container.production.json';
  const env      = args.env  ?? 'production';

  const specRaw = await fs.readFile(specPath, 'utf-8');
  const spec = parseYaml(specRaw) as Spec;

  // Variables
  const variables: Variable[] = [];
  variables.push(...buildConstants(spec.constants));
  variables.push(...buildAllDLV());
  // TODO: lookups, regex, JS, URL — à compléter dans GTM-014..017

  // Triggers
  const triggers: Trigger[] = [];
  triggers.push(buildPageViewAllPagesTrigger());
  triggers.push(...buildAllCustomEventTriggers());
  // TODO: groupes, exceptions — à compléter dans GTM-022..023

  // Tags
  const tags: Tag[] = [];
  tags.push(buildGa4ConfigTag(triggers, spec));
  for (const ev of EVENT_CATALOG) {
    const ga4Tag = buildGa4EventTag(ev, triggers);
    if (ga4Tag) tags.push(ga4Tag);
    const metaTag = buildMetaEventTag(ev, triggers);
    if (metaTag) tags.push(metaTag);
    // TODO: TikTok, Snap, Pinterest, Google Ads
  }

  // Folders (TODO)
  const folders: Folder[] = [
    { folderId: 'F-00', name: '00 — Configuration' },
    { folderId: 'F-01', name: '01 — Page & Engagement' },
    { folderId: 'F-02', name: '02 — E-commerce' },
    { folderId: 'F-03', name: '03 — Lead & Form' },
    { folderId: 'F-04', name: '04 — Conversions' },
    { folderId: 'F-05', name: '05 — FemiGlow custom' },
    { folderId: 'F-06', name: '06 — Consent Mode' },
    { folderId: 'F-07', name: '07 — Helpers' },
    { folderId: 'F-99', name: '99 — Test / sandbox' },
  ];

  // Assemble
  const container: Container = {
    exportFormatVersion: 2,
    exportTime: new Date().toISOString(),
    containerVersion: {
      path: spec.container_path,
      accountId: spec.account_id,
      containerId: spec.container_id,
      container: {
        accountId: spec.account_id,
        containerId: spec.container_id,
        name: 'FemiGlow Web',
        usageContext: ['WEB'],
      },
      tag: tags,
      trigger: triggers,
      variable: variables,
      folder: folders,
      builtInVariable: buildBuiltinList(),
    },
  };

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(container, null, 2));

  console.log(`✓ ${tags.length} tags, ${triggers.length} triggers, ${variables.length} variables`);
  console.log(`✓ Écrit : ${outPath}`);
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=', 2);
      out[k] = v ?? argv[++i];
    }
  }
  return out;
}

main().catch((err) => {
  console.error('✗', err);
  process.exit(1);
});
