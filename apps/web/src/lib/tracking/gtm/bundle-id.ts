import { createHash } from 'crypto';

/**
 * Génère un identifiant déterministe partagé entre une config GTM et un
 * mapping FemiGlow. Injecté dans les 2 exports pour la couche C (Poka-Yoke).
 *
 * cf. docs/gtm-poka-yoke/10-architecture/adr/003-bundle-id-hashing.md
 */

const BUNDLE_ID_LENGTH = 12;

export type BundleIdInput = {
  mappingVersion: string;
  configVersion: string;
  containerId: string;
  events: ReadonlyArray<{
    name: string;
    resolvedNames: Record<string, string>;
  }>;
  generatedAt: string;
};

export function computeBundleId(input: BundleIdInput): string {
  const canonical = canonicalize(input);
  return createHash('sha256').update(canonical).digest('hex').slice(0, BUNDLE_ID_LENGTH);
}

function canonicalize(input: BundleIdInput): string {
  const sortedEvents = [...input.events]
    .map((e) => ({
      name: e.name,
      resolvedNames: Object.keys(e.resolvedNames)
        .sort()
        .reduce<Record<string, string>>((acc, k) => {
          acc[k] = e.resolvedNames[k] ?? '';
          return acc;
        }, {}),
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
