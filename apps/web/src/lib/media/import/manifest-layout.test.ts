/**
 * Garde-fou : chaque sortie déclarée par le manifest du pack de génération
 * (`docs/hero-media-par-angle/manifest.json`) doit être acceptée telle
 * quelle par le parseur d'import. Si le manifest ou la convention 05 §4.8
 * évolue d'un côté seulement, ce test casse avant la mise en production.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildImportPlan, type AltFileContent } from './component-media-import';

interface ManifestImage {
  id: string;
  component: string;
  slot: string;
  variant: string;
  locale: string;
  crossLocale: boolean;
  position: string;
  slug: string;
  outputs: { desktop: string; mobile: string; alt: string };
  alt: Record<string, string>;
}

interface Manifest {
  component: string;
  importRoot: string;
  images: ManifestImage[];
}

// vitest tourne depuis `apps/web` (ou la racine du dépôt avec --root).
const MANIFEST_PATH =
  ['../..', '.']
    .map((up) => path.resolve(process.cwd(), up, 'docs/hero-media-par-angle/manifest.json'))
    .find((p) => existsSync(p)) ?? 'docs/hero-media-par-angle/manifest.json';
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;

/** Chemin du manifest → chemin relatif à la racine d'import. */
function rel(output: string): string {
  expect(output.startsWith(manifest.importRoot)).toBe(true);
  return output.slice(manifest.importRoot.length);
}

describe('manifest.json ↔ parseur d’import', () => {
  const files = manifest.images.flatMap((img) => [rel(img.outputs.desktop), rel(img.outputs.mobile), rel(img.outputs.alt)]);
  const altFiles: Record<string, AltFileContent> = Object.fromEntries(
    manifest.images.map((img) => [rel(img.outputs.alt), { ok: true, value: img.alt }]),
  );
  const plan = buildImportPlan({ files, altFiles });

  it('le manifest déclare des images', () => {
    expect(manifest.images.length).toBeGreaterThan(0);
  });

  it('aucune erreur ni avertissement, aucun fichier ignoré', () => {
    expect(plan.issues).toEqual([]);
    expect(plan.ignored).toEqual([]);
  });

  it('chaque sortie déclarée est reprise dans le plan (desktop et mobile appariés)', () => {
    const planned = new Map(
      plan.sets.flatMap((s) => s.items.map((item) => [item.desktop.relPath, { set: s, item }] as const)),
    );
    for (const img of manifest.images) {
      const hit = planned.get(rel(img.outputs.desktop));
      expect(hit, img.id).toBeDefined();
      expect(hit!.item.mobile?.relPath, img.id).toBe(rel(img.outputs.mobile));
      expect(hit!.item.position, img.id).toBe(Number.parseInt(img.position, 10));
      expect(hit!.item.alt, img.id).toEqual(img.alt);
      expect(hit!.set.componentKey, img.id).toBe(img.component);
      expect(hit!.set.slot, img.id).toBe(img.slot);
      expect(hit!.set.crossLocale, img.id).toBe(img.crossLocale);
      expect(hit!.set.locale, img.id).toBe(img.locale === '_all' ? '*' : img.locale);
    }
    const itemCount = plan.sets.reduce((n, s) => n + s.items.length, 0);
    expect(itemCount).toBe(manifest.images.length);
  });

  it('slugs de média uniques et ≤ 80 caractères', () => {
    const slugs = plan.sets.flatMap((s) =>
      s.items.flatMap((i) => [i.desktop.mediaSlug, ...(i.mobile ? [i.mobile.mediaSlug] : [])]),
    );
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(slugs.every((s) => s.length <= 80)).toBe(true);
  });
});
