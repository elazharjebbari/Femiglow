/**
 * Garantie : chaque PNG présent dans `docs/images/values/<group>/` est mappé
 * dans `IMAGE_TO_COMPONENT`. Aucun « unmapped » ne doit subsister.
 *
 * Ce test agit comme contrat : si quelqu'un ajoute un PNG dans le dossier
 * source sans rajouter d'entrée dans `seed-mapping.ts`, le test casse.
 */
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import {
  IMAGE_TO_COMPONENT,
  listSeedSourcePaths,
  listUnmapped,
} from './seed-mapping';
import { SITE_COMPONENT_REGISTRY } from './registry';

// Tests lancés depuis `apps/web` (vitest cwd). On remonte au repo root.
const ROOT = resolve(process.cwd(), '../..', 'docs/images/values');

function listFiles(): string[] {
  const out: string[] = [];
  const dirs = readdirSync(ROOT, { withFileTypes: true });
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    const sub = readdirSync(join(ROOT, d.name));
    for (const f of sub) {
      const stat = statSync(join(ROOT, d.name, f));
      if (stat.isFile() && f.toLowerCase().endsWith('.png')) {
        out.push(`${d.name}/${f}`);
      }
    }
  }
  return out.sort();
}

describe('seed-mapping (contrat de couverture)', () => {
  it('chaque PNG sur disque a un mapping', () => {
    const files = listFiles();
    const unmapped = listUnmapped(files);
    expect(unmapped, `Fichiers non mappés:\n${unmapped.join('\n')}`).toEqual([]);
  });

  it('chaque mapping pointe vers un composant qui existe dans le registry', () => {
    const keys = new Set(SITE_COMPONENT_REGISTRY.map((c) => c.key));
    const orphans = Object.entries(IMAGE_TO_COMPONENT).filter(
      ([, m]) => !keys.has(m.componentKey),
    );
    expect(orphans, `Mappings orphelins: ${JSON.stringify(orphans)}`).toEqual([]);
  });

  it('chaque mapping pointe vers un slot qui existe dans le composant cible', () => {
    const byKey = new Map(SITE_COMPONENT_REGISTRY.map((c) => [c.key, c]));
    const bad: string[] = [];
    for (const [path, m] of Object.entries(IMAGE_TO_COMPONENT)) {
      const cmp = byKey.get(m.componentKey);
      if (!cmp) continue;
      if (!cmp.slots.find((s) => s.key === m.slot)) {
        bad.push(`${path} → ${m.componentKey}#${m.slot}`);
      }
    }
    expect(bad, `Slots inexistants: ${bad.join(', ')}`).toEqual([]);
  });

  it('aucun couple (componentKey, slot) ne reçoit deux fichiers différents', () => {
    const seen = new Map<string, string>();
    const dup: string[] = [];
    for (const [path, m] of Object.entries(IMAGE_TO_COMPONENT)) {
      const k = `${m.componentKey}#${m.slot}`;
      if (seen.has(k)) dup.push(`${k}: ${seen.get(k)} vs ${path}`);
      else seen.set(k, path);
    }
    expect(dup, `Doublons: ${dup.join(', ')}`).toEqual([]);
  });

  it('listSeedSourcePaths retourne des chemins relatifs cohérents', () => {
    const paths = listSeedSourcePaths();
    expect(paths.length).toBeGreaterThan(0);
    for (const p of paths) {
      expect(p).toMatch(/^[a-z]+\/[a-z0-9-]+\.png$/);
    }
  });
});
