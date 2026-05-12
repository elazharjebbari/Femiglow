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
  INTENTIONALLY_UNMAPPED,
  listSeedSourcePaths,
  listUnmapped,
} from './seed-mapping';
import { SITE_COMPONENT_REGISTRY } from './registry';

// Tests lancés depuis `apps/web` (vitest cwd). On remonte au repo root.
const ROOT = resolve(process.cwd(), '../..', 'docs/images/values');

/**
 * Dossiers d'audit / référence visuelle non destinés à être seedés dans
 * la CMS (ex: `reviews/` héberge des photos de référence pour le plan
 * `reviews-wall`, pas du contenu produit). On les exclut du contrat.
 */
const AUDIT_ONLY_DIRS = new Set(['reviews']);

function listFiles(): string[] {
  const out: string[] = [];
  const dirs = readdirSync(ROOT, { withFileTypes: true });
  for (const d of dirs) {
    if (!d.isDirectory()) continue;
    if (AUDIT_ONLY_DIRS.has(d.name)) continue;
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

  // CHA-243 — Hero kit pointe vers image-produit.png (asset éditorial principal).
  it('kit/image-produit.png est mappé sur kit-hero-produit/primary', () => {
    expect(IMAGE_TO_COMPONENT['kit/image-produit.png']).toEqual({
      componentKey: 'kit-hero-produit',
      slot: 'primary',
    });
  });

  // CHA-243 — kit-principale.png reste sur disque comme alternative A/B
  // mais ne doit plus créer de binding éditorial.
  it('kit/kit-principale.png est marqué comme intentionnellement non mappé', () => {
    expect(INTENTIONALLY_UNMAPPED.has('kit/kit-principale.png')).toBe(true);
    expect(IMAGE_TO_COMPONENT['kit/kit-principale.png']).toBeUndefined();
  });

  it('listUnmapped ignore les fichiers INTENTIONALLY_UNMAPPED', () => {
    const fake = ['kit/kit-principale.png', 'kit/image-produit.png', 'kit/inexistant.png'];
    expect(listUnmapped(fake)).toEqual(['kit/inexistant.png']);
  });
});
