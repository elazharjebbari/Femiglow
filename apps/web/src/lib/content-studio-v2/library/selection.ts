/**
 * Pure selection helpers for the Library v2 bulk action bar.
 *
 * Le state de sélection est un `Record<id, true>` plat — facilement
 * sérialisable, immuable, et facile à tester sans render.
 */

import type { LibraryItem } from './types';

export type SelectionMap = Record<string, true>;

export function toggleSelection(map: SelectionMap, id: string): SelectionMap {
  if (map[id]) {
    const { [id]: _omit, ...rest } = map;
    void _omit;
    return rest;
  }
  return { ...map, [id]: true };
}

export function selectAll(items: LibraryItem[]): SelectionMap {
  const next: SelectionMap = {};
  for (const item of items) next[item.id] = true;
  return next;
}

export function clearSelection(): SelectionMap {
  return {};
}

export function selectionCount(map: SelectionMap): number {
  return Object.keys(map).length;
}

export function selectedItems(items: LibraryItem[], map: SelectionMap): LibraryItem[] {
  return items.filter((item) => map[item.id]);
}

export function isAllSelected(items: LibraryItem[], map: SelectionMap): boolean {
  if (items.length === 0) return false;
  return items.every((item) => map[item.id]);
}
