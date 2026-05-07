/**
 * Pretty-print stable d'un objet GTM container.
 *
 * L'ordre des clés est figé par `KEY_ORDER` pour qu'une regénération
 * produise un JSON byte-identique → diff Git/distant fiable, sha256
 * reproductible.
 */

const KEY_ORDER = [
  // Racine container.json
  'exportFormatVersion',
  'exportTime',
  'containerVersion',

  // Container envelope
  'path',
  'accountId',
  'containerId',
  'container',
  'name',
  'usageContext',

  // Collections
  'tag',
  'trigger',
  'variable',
  'folder',
  'builtInVariable',

  // Tag / Trigger / Variable
  'type',
  'parameter',
  'priority',
  'tagFiringOption',
  'firingTriggerId',
  'blockingTriggerId',
  'setupTag',
  'customEventFilter',
  'filter',
  'tagId',
  'triggerId',
  'variableId',
  'folderId',
  'parentFolderId',

  // Parameter
  'key',
  'value',
  'list',
  'map',

  // Setup tag
  'tagName',
  'stopOnSetupFailure',
] as const;

const KEY_INDEX = new Map<string, number>(
  KEY_ORDER.map((k, i) => [k, i]),
);

function compareKeys(a: string, b: string): number {
  const ai = KEY_INDEX.get(a);
  const bi = KEY_INDEX.get(b);
  if (ai !== undefined && bi !== undefined) return ai - bi;
  if (ai !== undefined) return -1;
  if (bi !== undefined) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortKeys<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(sortKeys) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([a], [b]) => compareKeys(a, b),
    );
    const out: Record<string, unknown> = {};
    for (const [k, v] of entries) out[k] = sortKeys(v);
    return out as T;
  }
  return value;
}

export function prettyPrint(container: unknown): string {
  return JSON.stringify(sortKeys(container), null, 2) + '\n';
}

export function minified(container: unknown): string {
  return JSON.stringify(sortKeys(container));
}
