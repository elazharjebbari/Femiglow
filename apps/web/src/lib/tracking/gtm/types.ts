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
  /**
   * `priority` est sérialisé en `Parameter` dans le format d'EXPORT GTM. GTM
   * exige spécifiquement `type: 'INTEGER'` (et pas `TEMPLATE`) — sinon l'UI
   * rejette « La valeur de la priorité de déclenchement doit être un nombre
   * entier ». La valeur reste un string décimal (le format Parameter encode
   * tout en string, mais le type informe le parser GTM de la coercion).
   */
  priority?: { type: 'INTEGER'; key?: string; value: string };
  tagFiringOption?: 'ONCE_PER_EVENT' | 'ONCE_PER_LOAD' | 'UNLIMITED';
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
