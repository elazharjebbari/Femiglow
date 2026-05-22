import { describe, it, expect } from 'vitest';
import {
  clearSelection,
  isAllSelected,
  selectAll,
  selectedItems,
  selectionCount,
  toggleSelection,
} from './selection';
import type { LibraryItem } from './types';

function makeItem(id: string): LibraryItem {
  return {
    id,
    draftId: `cd_${id}`,
    postId: id.startsWith('cp_') ? id : null,
    caption: `caption ${id}`,
    variantLabel: 'V',
    platform: 'instagram',
    format: 'post',
    pillar: 'rituel',
    status: 'approved',
    scheduledAt: null,
    publishedAt: null,
    sortAt: '2026-05-15T10:00:00.000Z',
    thumbnail: { url: null, kind: null, alt: '' },
  };
}

describe('library/selection', () => {
  it('toggles a single id (add then remove)', () => {
    let map = clearSelection();
    expect(selectionCount(map)).toBe(0);
    map = toggleSelection(map, 'cp_1');
    expect(map).toEqual({ cp_1: true });
    expect(selectionCount(map)).toBe(1);
    map = toggleSelection(map, 'cp_1');
    expect(map).toEqual({});
    expect(selectionCount(map)).toBe(0);
  });

  it('keeps existing ids when adding a new one (immutable)', () => {
    const a = { cp_1: true } as const;
    const b = toggleSelection(a, 'cp_2');
    expect(b).toEqual({ cp_1: true, cp_2: true });
    expect(a).toEqual({ cp_1: true }); // immutable
  });

  it('selectAll selects every visible item', () => {
    const items = [makeItem('cp_1'), makeItem('cp_2'), makeItem('cp_3')];
    const map = selectAll(items);
    expect(selectionCount(map)).toBe(3);
    expect(isAllSelected(items, map)).toBe(true);
  });

  it('isAllSelected returns false on partial selection', () => {
    const items = [makeItem('cp_1'), makeItem('cp_2')];
    const map = toggleSelection(clearSelection(), 'cp_1');
    expect(isAllSelected(items, map)).toBe(false);
  });

  it('isAllSelected returns false on empty list', () => {
    expect(isAllSelected([], { cp_1: true })).toBe(false);
  });

  it('selectedItems returns the matching items', () => {
    const items = [makeItem('cp_1'), makeItem('cp_2'), makeItem('cp_3')];
    const map = { cp_1: true, cp_3: true } as const;
    const out = selectedItems(items, map);
    expect(out.map((i) => i.id)).toEqual(['cp_1', 'cp_3']);
  });
});
