/**
 * Types simplifiés du format `container.json` GTM (subset utilisé par
 * notre générateur). Référence : Google Tag Manager API v2.
 *
 * Cf. docs/gtm/02-architecture-gtm.md, docs/gtm/10-automatisation.md.
 */

export type GtmEnvironment = 'production' | 'stage' | 'preview' | 'dev';

export type GtmParameter = {
  type: string;
  key: string;
  value?: string;
  list?: GtmParameter[];
  map?: GtmParameter[];
};

export type GtmVariable = {
  name: string;
  type: string;
  parameter?: GtmParameter[];
  variableId?: string;
  parentFolderId?: string;
};

export type GtmTriggerFilter = {
  type: string;
  parameter: GtmParameter[];
};

export type GtmTrigger = {
  name: string;
  type: string;
  customEventFilter?: GtmTriggerFilter[];
  filter?: GtmTriggerFilter[];
  triggerId?: string;
  parentFolderId?: string;
};

export type GtmTag = {
  name: string;
  type: string;
  parameter?: GtmParameter[];
  firingTriggerId?: string[];
  blockingTriggerId?: string[];
  priority?: { type: 'integer'; value: string };
  tagFiringOption?: 'oncePerEvent' | 'oncePerLoad' | 'unlimited';
  setupTag?: { tagName: string; stopOnSetupFailure?: boolean }[];
  parentFolderId?: string;
};

export type GtmFolder = {
  folderId: string;
  name: string;
};

export type GtmBuiltInVariable = {
  type: string;
  name: string;
};

export type GtmContainer = {
  exportFormatVersion: 2;
  exportTime: string;
  containerVersion: {
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
  };
};

export type GtmStats = {
  tags: number;
  triggers: number;
  variables: number;
  folders: number;
  conversions: number;
  chatTriggers: number;
  chatDims: number;
  byCategory: Record<string, number>;
};

export type GtmMeta = {
  generatedAt: string;
  version: string;
  sizeBytes: number;
  lineCount: number;
  sha256: string;
};
