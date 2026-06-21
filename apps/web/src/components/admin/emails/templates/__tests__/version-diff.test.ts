// @vitest-environment node
/**
 * F07 P3.4-j (Lot 6) — diff de lignes (LCS) pur.
 */
import { describe, expect, it } from 'vitest';
import { lineDiff, diffStats, diffHunks } from '../version-diff';

describe('F07 — lineDiff', () => {
  it('F07-U-116 — textes identiques → tout en context, 0 add/remove', () => {
    const rows = lineDiff('a\nb\nc', 'a\nb\nc');
    expect(rows.every((r) => r.type === 'context')).toBe(true);
    expect(diffStats(rows)).toEqual({ added: 0, removed: 0 });
  });

  it('F07-U-117 — ligne ajoutée → context + add', () => {
    const rows = lineDiff('a\nb', 'a\nNOUVEAU\nb');
    expect(rows.map((r) => `${r.type}:${r.text}`)).toEqual([
      'context:a',
      'add:NOUVEAU',
      'context:b',
    ]);
    expect(diffStats(rows)).toEqual({ added: 1, removed: 0 });
  });

  it('F07-U-118 — ligne supprimée → remove', () => {
    const rows = lineDiff('a\nVIEUX\nb', 'a\nb');
    expect(diffStats(rows)).toEqual({ added: 0, removed: 1 });
    expect(rows.some((r) => r.type === 'remove' && r.text === 'VIEUX')).toBe(true);
  });

  it('F07-U-119 — ligne modifiée → remove ancienne + add nouvelle', () => {
    const rows = lineDiff('<p>Bonjour</p>', '<p>Salut</p>');
    expect(diffStats(rows)).toEqual({ added: 1, removed: 1 });
    expect(rows.find((r) => r.type === 'remove')!.text).toBe('<p>Bonjour</p>');
    expect(rows.find((r) => r.type === 'add')!.text).toBe('<p>Salut</p>');
  });
});

describe('F07 — diffHunks (navigation entre modifications)', () => {
  it('F07-U-130 — aucun changement → aucun hunk', () => {
    expect(diffHunks(lineDiff('a\nb\nc', 'a\nb\nc'))).toEqual([]);
  });

  it('F07-U-131 — changements contigus = UN seul hunk (1er index modifié)', () => {
    // a / -VIEUX / +NEUF / b → remove+add contigus = 1 hunk démarrant à l'idx 1.
    const rows = lineDiff('a\nVIEUX\nb', 'a\nNEUF\nb');
    expect(diffHunks(rows)).toEqual([1]);
  });

  it('F07-U-132 — changements séparés par du contexte = hunks distincts', () => {
    const rows = lineDiff('a\nX\nb\nc\nY\nd', 'a\nb\nc\nd');
    // 2 suppressions (X, Y) séparées par le contexte b/c → 2 hunks.
    expect(diffHunks(rows).length).toBe(2);
    // Chaque index pointe bien sur une ligne modifiée.
    for (const idx of diffHunks(rows)) expect(rows[idx]!.type).not.toBe('context');
  });
});
