/**
 * Export GTM Container JSON.
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
  google_ga4: 'googtag',
  google_ads: 'cvt_google_ads_conversion',
  tiktok: 'cvt_tiktok_pixel',
  snap: 'cvt_snap_pixel',
  pinterest: 'cvt_pinterest_tag',
};

function shortHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 8);
}

export function buildGtmContainer(input: GtmExportInput): GtmExportOutput {
  const triggers: GtmTrigger[] = [];
  const tags: GtmTag[] = [];
  const variableNames = new Set<string>();

  // 1. Variables génériques DLV utilisées
  const baseVariables = ['event_id', 'currency', 'value', 'transaction_id', 'items', 'form_id', 'first_field', 'lead_id', 'method'];
  for (const v of baseVariables) variableNames.add(v);

  // 2. Pour chaque event canonique, créer 1 trigger + 1 tag par cell active
  for (const [eventName, providers] of Object.entries(input.mappings)) {
    const triggerId = `trg_${eventName}_${shortHash(eventName)}`;
    triggers.push({
      triggerId,
      name: `FemiGlow: ${eventName}`,
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
        parameter.push({ type: 'TEMPLATE', key: 'tagId', value: '{{GA4 Measurement ID}}' });
        parameter.push({ type: 'TEMPLATE', key: 'eventName', value: cell.mappedName });
      } else {
        parameter.push({ type: 'TEMPLATE', key: 'eventName', value: cell.mappedName });
      }
      parameter.push({ type: 'TEMPLATE', key: 'eventID', value: '{{DLV - event_id}}' });

      tags.push({
        tagId: `tag_${kind}_${eventName}_${shortHash(`${kind}|${eventName}|${cell.mappedName}`)}`,
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
      variableId: `var_${shortHash(name)}`,
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
