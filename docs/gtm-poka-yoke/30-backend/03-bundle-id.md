# `bundleId` — génération et injection

## Vue d'ensemble

Le `bundleId` est un hash SHA-256 court (12 chars hex) qui identifie de manière unique une paire (config GTM, mapping FemiGlow) générée ensemble.

## Localisation

`apps/web/src/lib/tracking/gtm/bundle-id.ts`

## Implémentation

```ts
import { createHash } from 'crypto';

export type BundleIdInput = {
  mappingVersion: string;
  configVersion: string;
  containerId: string;
  events: ReadonlyArray<{
    name: string;                                  // ex: 'purchase'
    resolvedNames: Record<string, string>;          // ex: { meta: 'Purchase', google_ga4: 'purchase' }
  }>;
  generatedAt: string;                              // ISO 8601, milliseconds truncated
};

const BUNDLE_ID_LENGTH = 12;  // chars hex (48 bits)

export function computeBundleId(input: BundleIdInput): string {
  const canonical = canonicalize(input);
  return createHash('sha256').update(canonical).digest('hex').slice(0, BUNDLE_ID_LENGTH);
}

function canonicalize(input: BundleIdInput): string {
  // Tri stable des events pour garantir déterminisme
  const sortedEvents = [...input.events]
    .map((e) => ({
      name: e.name,
      resolvedNames: Object.keys(e.resolvedNames).sort().reduce((acc, k) => {
        acc[k] = e.resolvedNames[k]!;
        return acc;
      }, {} as Record<string, string>),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return JSON.stringify({
    m: input.mappingVersion,
    c: input.configVersion,
    cid: input.containerId,
    e: sortedEvents,
    t: input.generatedAt,
  });
}

export function isValidBundleId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{12}$/.test(value);
}
```

## Injection dans les exports

### Dans le mapping JSON

```ts
// apps/web/src/lib/tracking/gtm/export-mapping.ts (extrait)
export function buildMappingExport(opts: {
  mappingVersion: string;
  configVersion: string;
  containerId: string;
  mappings: Record<string, MappingPerEvent>;
}): MappingExportV2 {
  const events = Object.entries(opts.mappings).map(([name, m]) => ({
    name,
    resolvedNames: {
      meta: m.meta?.eventName ?? '',
      google_ga4: m.googleGa4?.eventName ?? '',
      // ...
    },
  }));
  const generatedAt = new Date().toISOString();
  const bundleId = computeBundleId({
    mappingVersion: opts.mappingVersion,
    configVersion: opts.configVersion,
    containerId: opts.containerId,
    events,
    generatedAt,
  });

  return {
    manifest: {
      schemaVersion: 'fg-mapping/2.0',
      bundleId,
      mappingVersion: opts.mappingVersion,
      requiredConfigVersion: opts.configVersion,
      containerId: opts.containerId,
      generatedAt,
    },
    mappings: opts.mappings,
  };
}
```

### Dans le config GTM JSON

```ts
// apps/web/src/lib/tracking/gtm/export-config.ts (extrait)
export function injectBundleIdIntoConfig(config: GtmContainerExport, bundleId: string): GtmContainerExport {
  // Cherche la variable FG Bundle Id ; si elle existe → met à jour, sinon → ajoute
  const existing = config.containerVersion.variable.find((v) => v.name === 'FG Bundle Id');
  if (existing) {
    const valueParam = existing.parameter.find((p) => p.key === 'value');
    if (valueParam) valueParam.value = bundleId;
    return config;
  }
  config.containerVersion.variable.push({
    name: 'FG Bundle Id',
    type: 'c', // constant
    parameter: [{ type: 'TEMPLATE', key: 'value', value: bundleId }],
  });
  return config;
}
```

## Tests requis

```ts
// bundle-id.test.ts
describe('computeBundleId', () => {
  it('produit un hash 12 chars hex', () => {
    const id = computeBundleId({ /* ... */ });
    expect(id).toMatch(/^[a-f0-9]{12}$/);
  });

  it('est déterministe (même input → même output)', () => {
    const input = mkInput();
    expect(computeBundleId(input)).toBe(computeBundleId(input));
  });

  it("est stable malgré l'ordre des events", () => {
    const input1 = mkInput({ events: [{ name: 'a', ... }, { name: 'b', ... }] });
    const input2 = mkInput({ events: [{ name: 'b', ... }, { name: 'a', ... }] });
    expect(computeBundleId(input1)).toBe(computeBundleId(input2));
  });

  it("change si une seule resolvedName change", () => {
    const a = mkInput();
    const b = mkInput({ /* change Purchase → PremiumPurchase */ });
    expect(computeBundleId(a)).not.toBe(computeBundleId(b));
  });

  it("change si mappingVersion change", () => {
    expect(computeBundleId({ ...base, mappingVersion: 'v17' }))
      .not.toBe(computeBundleId({ ...base, mappingVersion: 'v18' }));
  });
});

describe('isValidBundleId', () => {
  it('accepte un hash valide', () => {
    expect(isValidBundleId('a7c4f2e9b81d')).toBe(true);
  });
  it('rejette les autres formats', () => {
    expect(isValidBundleId('a7c4')).toBe(false);
    expect(isValidBundleId('A7C4F2E9B81D')).toBe(false); // uppercase
    expect(isValidBundleId('')).toBe(false);
    expect(isValidBundleId(123)).toBe(false);
  });
});
```
