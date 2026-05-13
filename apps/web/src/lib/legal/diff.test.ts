import { describe, expect, it } from 'vitest';
import { diffBodies, diffLines } from './diff';

describe('diffLines', () => {
  it('renvoie equal pour deux textes identiques', () => {
    const lines = diffLines('a\nb\nc', 'a\nb\nc');
    expect(lines.every((l) => l.op === 'equal')).toBe(true);
  });

  it('détecte une ligne ajoutée', () => {
    const lines = diffLines('a\nc', 'a\nb\nc');
    expect(lines).toHaveLength(3);
    expect(lines[1]?.op).toBe('add');
    expect(lines[1]?.text).toBe('b');
  });

  it('détecte une ligne supprimée', () => {
    const lines = diffLines('a\nb\nc', 'a\nc');
    expect(lines.some((l) => l.op === 'remove' && l.text === 'b')).toBe(true);
  });

  it('détecte une modification (add + remove)', () => {
    const lines = diffLines('a\nb\nc', 'a\nB\nc');
    const removes = lines.filter((l) => l.op === 'remove');
    const adds = lines.filter((l) => l.op === 'add');
    expect(removes).toHaveLength(1);
    expect(adds).toHaveLength(1);
    expect(removes[0]?.text).toBe('b');
    expect(adds[0]?.text).toBe('B');
  });

  it('gère un texte vide vs non-vide', () => {
    const lines = diffLines('', 'hello');
    expect(lines.filter((l) => l.op === 'add')).toHaveLength(1);
  });
});

describe('diffBodies — hunks', () => {
  it('renvoie 0 hunks si textes identiques', () => {
    const r = diffBodies('a\nb\nc', 'a\nb\nc');
    expect(r.hunks).toHaveLength(0);
    expect(r.added).toBe(0);
    expect(r.removed).toBe(0);
  });

  it('compte added/removed correctement', () => {
    const r = diffBodies('a\nb\nc', 'a\nB\nC\nD');
    expect(r.added).toBeGreaterThan(0);
    expect(r.removed).toBeGreaterThan(0);
    expect(r.hunks.length).toBeGreaterThan(0);
  });

  it('inclut du contexte autour des changements', () => {
    const from = ['ctx1', 'ctx2', 'CHANGE_OLD', 'ctx3', 'ctx4'].join('\n');
    const to = ['ctx1', 'ctx2', 'CHANGE_NEW', 'ctx3', 'ctx4'].join('\n');
    const r = diffBodies(from, to);
    expect(r.hunks).toHaveLength(1);
    // Lignes du hunk : ctx1/ctx2 (avant) + CHANGE_OLD (remove) +
    // CHANGE_NEW (add) + ctx3/ctx4 (après)
    expect(r.hunks[0]!.lines.some((l) => l.op === 'equal' && l.text === 'ctx1')).toBe(true);
    expect(r.hunks[0]!.lines.some((l) => l.op === 'remove' && l.text === 'CHANGE_OLD')).toBe(
      true,
    );
    expect(r.hunks[0]!.lines.some((l) => l.op === 'add' && l.text === 'CHANGE_NEW')).toBe(true);
  });

  it('regroupe les changements proches en un seul hunk', () => {
    const from = 'a\nb\nc\nd\ne\nf';
    const to = 'a\nB\nc\nD\ne\nf';
    const r = diffBodies(from, to, 3);
    // Les deux changements (B et D) sont à 2 lignes d'écart < 2*context → 1 hunk
    expect(r.hunks).toHaveLength(1);
  });

  it('sépare les changements éloignés en plusieurs hunks', () => {
    const from = ['A', '', '', '', '', '', '', '', '', '', 'B'].join('\n');
    const to = ['X', '', '', '', '', '', '', '', '', '', 'Y'].join('\n');
    const r = diffBodies(from, to, 1);
    expect(r.hunks.length).toBeGreaterThanOrEqual(2);
  });
});
