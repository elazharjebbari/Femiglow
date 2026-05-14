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
 * - trigger.type : lowercase camelCase `customEvent | pageview | click | …`.
 *   (Trigger types restent lowercase ; ce sont des identifiants stables.)
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

const PROVIDER_TO_GTM_TYPE: Record<MappingProviderKind, string> = {
  meta: 'cvt_meta_pixel',
  google_ga4: 'gaawe', // GA4 Event tag built-in (no custom template needed)
  google_ads: 'cvt_google_ads_conversion',
  tiktok: 'cvt_tiktok_pixel',
  snap: 'cvt_snap_pixel',
  pinterest: 'cvt_pinterest_tag',
};

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
      name: `FemiGlow: ${eventName}`,
      type: 'customEvent',
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
      if (kind === 'meta') {
        parameter.push({ type: 'TEMPLATE', key: 'pixelId', value: '{{Meta Pixel ID}}' });
        parameter.push({
          type: 'TEMPLATE',
          key: 'eventName',
          value: cell.isCustom ? 'trackCustom' : cell.mappedName,
        });
        if (cell.isCustom) {
          parameter.push({ type: 'TEMPLATE', key: 'customEventName', value: cell.mappedName });
        }
      } else if (kind === 'google_ga4') {
        parameter.push({ type: 'TEMPLATE', key: 'measurementId', value: '{{GA4 Measurement ID}}' });
        parameter.push({ type: 'TEMPLATE', key: 'eventName', value: cell.mappedName });
      } else {
        parameter.push({ type: 'TEMPLATE', key: 'eventName', value: cell.mappedName });
      }
      parameter.push({ type: 'TEMPLATE', key: 'eventID', value: '{{DLV - event_id}}' });

      tags.push({
        tagId: String(nextTagId++),
        name: `FemiGlow: ${kind} — ${eventName}`,
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
      name: `DLV - ${name}`,
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
