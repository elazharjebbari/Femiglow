import type { TrackingComponent, TrackingPage } from '@/lib/db/types';
import type { InventoryManifest, ScannedComponent, ScannedPage } from './scanner';

export interface InventoryDiff {
  componentsToCreate: ScannedComponent[];
  componentsToUpdate: { existing: TrackingComponent; scanned: ScannedComponent }[];
  componentsToDelete: TrackingComponent[];
  pagesToCreate: ScannedPage[];
  pagesToUpdate: { existing: TrackingPage; scanned: ScannedPage }[];
  pagesToDelete: TrackingPage[];
}

export interface DiffInputs {
  manifest: InventoryManifest;
  existingComponents: TrackingComponent[];
  existingPages: TrackingPage[];
}

export function computeInventoryDiff(input: DiffInputs): InventoryDiff {
  const { manifest, existingComponents, existingPages } = input;

  const componentsByPath = new Map(existingComponents.map((c) => [c.path, c]));
  const scannedByPath = new Map(manifest.components.map((c) => [c.path, c]));

  const componentsToCreate: ScannedComponent[] = [];
  const componentsToUpdate: InventoryDiff['componentsToUpdate'] = [];
  for (const scanned of manifest.components) {
    const existing = componentsByPath.get(scanned.path);
    if (!existing) {
      componentsToCreate.push(scanned);
      continue;
    }
    if (
      existing.name !== scanned.name ||
      existing.category !== scanned.category ||
      (scanned.description ?? null) !== (existing.description ?? null)
    ) {
      componentsToUpdate.push({ existing, scanned });
    }
  }
  const componentsToDelete = existingComponents.filter(
    (c) => !scannedByPath.has(c.path) && c.deletedAt === null,
  );

  const pagesByRoute = new Map(existingPages.map((p) => [p.route, p]));
  const scannedPagesByRoute = new Map(manifest.pages.map((p) => [p.route, p]));

  const pagesToCreate: ScannedPage[] = [];
  const pagesToUpdate: InventoryDiff['pagesToUpdate'] = [];
  for (const scanned of manifest.pages) {
    const existing = pagesByRoute.get(scanned.route);
    if (!existing) {
      pagesToCreate.push(scanned);
      continue;
    }
    if (existing.title !== scanned.title || existing.category !== scanned.category) {
      pagesToUpdate.push({ existing, scanned });
    }
  }
  const pagesToDelete = existingPages.filter((p) => !scannedPagesByRoute.has(p.route));

  return {
    componentsToCreate,
    componentsToUpdate,
    componentsToDelete,
    pagesToCreate,
    pagesToUpdate,
    pagesToDelete,
  };
}

export function summarizeDiff(diff: InventoryDiff): string {
  const lines: string[] = [];
  lines.push(`Composants à créer : ${diff.componentsToCreate.length}`);
  lines.push(`Composants à mettre à jour : ${diff.componentsToUpdate.length}`);
  lines.push(`Composants à supprimer : ${diff.componentsToDelete.length}`);
  lines.push(`Pages à créer : ${diff.pagesToCreate.length}`);
  lines.push(`Pages à mettre à jour : ${diff.pagesToUpdate.length}`);
  lines.push(`Pages à supprimer : ${diff.pagesToDelete.length}`);
  return lines.join('\n');
}

export function diffIsEmpty(diff: InventoryDiff): boolean {
  return (
    diff.componentsToCreate.length === 0 &&
    diff.componentsToUpdate.length === 0 &&
    diff.componentsToDelete.length === 0 &&
    diff.pagesToCreate.length === 0 &&
    diff.pagesToUpdate.length === 0 &&
    diff.pagesToDelete.length === 0
  );
}
