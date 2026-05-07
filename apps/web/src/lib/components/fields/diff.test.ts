import { describe, expect, it } from 'vitest';
import {
  diffModeFor,
  jsonDiff,
  textDiff,
  valueToText,
} from './diff';

describe('textDiff', () => {
  it('renvoie un eq pour deux textes identiques', () => {
    const out = textDiff('Hello\nworld', 'Hello\nworld');
    expect(out.every((l) => l.op === 'eq')).toBe(true);
    expect(out).toHaveLength(2);
  });

  it('détecte une suppression', () => {
    const out = textDiff('a\nb\nc', 'a\nc');
    expect(out.map((l) => l.op)).toEqual(['eq', 'del', 'eq']);
  });

  it('détecte un ajout', () => {
    const out = textDiff('a\nc', 'a\nb\nc');
    expect(out.map((l) => l.op)).toEqual(['eq', 'add', 'eq']);
  });

  it('détecte un remplacement (del puis add)', () => {
    const out = textDiff('Bonjour', 'Bonsoir');
    expect(out.map((l) => l.op).sort()).toEqual(['add', 'del']);
  });

  it('numérote les lignes côté avant et après', () => {
    const out = textDiff('a\nb', 'a\nB');
    const after = out.find((l) => l.op === 'add');
    const before = out.find((l) => l.op === 'del');
    expect(before?.beforeNo).toBe(2);
    expect(before?.afterNo).toBeNull();
    expect(after?.beforeNo).toBeNull();
    expect(after?.afterNo).toBe(2);
  });

  it('normalise les EOL CRLF -> LF', () => {
    const out = textDiff('a\r\nb', 'a\nb');
    expect(out.every((l) => l.op === 'eq')).toBe(true);
  });
});

describe('jsonDiff', () => {
  it('retourne [] pour des objets égaux', () => {
    expect(jsonDiff({ a: 1 }, { a: 1 })).toEqual([]);
  });

  it('détecte un changement de scalaire', () => {
    expect(jsonDiff({ label: 'A' }, { label: 'B' })).toEqual([
      { op: 'change', path: 'label', before: 'A', after: 'B' },
    ]);
  });

  it('détecte un add de clé', () => {
    const d = jsonDiff({ a: 1 }, { a: 1, b: 2 });
    expect(d).toEqual([{ op: 'add', path: 'b', before: undefined, after: 2 }]);
  });

  it('détecte un del de clé', () => {
    const d = jsonDiff({ a: 1, b: 2 }, { a: 1 });
    expect(d).toEqual([{ op: 'del', path: 'b', before: 2, after: undefined }]);
  });

  it('descend récursivement dans les objets', () => {
    const d = jsonDiff(
      { cta: { label: 'Voir', href: '/a' } },
      { cta: { label: 'Voir', href: '/b' } },
    );
    expect(d).toEqual([
      { op: 'change', path: 'cta.href', before: '/a', after: '/b' },
    ]);
  });

  it('descend dans les tableaux avec index', () => {
    const d = jsonDiff(
      { items: [{ label: 'A' }, { label: 'B' }] },
      { items: [{ label: 'A' }, { label: 'C' }] },
    );
    expect(d).toEqual([
      { op: 'change', path: 'items[1].label', before: 'B', after: 'C' },
    ]);
  });

  it('détecte ajout/suppression d\'éléments dans un tableau', () => {
    const d = jsonDiff([1, 2], [1, 2, 3]);
    expect(d).toEqual([{ op: 'add', path: '[2]', before: undefined, after: 3 }]);
    const d2 = jsonDiff([1, 2, 3], [1, 2]);
    expect(d2).toEqual([{ op: 'del', path: '[2]', before: 3, after: undefined }]);
  });

  it('retourne $ comme path pour un changement scalaire racine', () => {
    expect(jsonDiff('A', 'B')).toEqual([
      { op: 'change', path: '$', before: 'A', after: 'B' },
    ]);
  });
});

describe('diffModeFor', () => {
  it('retourne text pour les types texte', () => {
    expect(diffModeFor('text')).toBe('text');
    expect(diffModeFor('multiline')).toBe('text');
    expect(diffModeFor('rich-text')).toBe('text');
    expect(diffModeFor('kicker')).toBe('text');
    expect(diffModeFor('quote')).toBe('text');
  });

  it('retourne json pour les types structurés', () => {
    expect(diffModeFor('cta')).toBe('json');
    expect(diffModeFor('link')).toBe('json');
    expect(diffModeFor('list')).toBe('json');
    expect(diffModeFor('record')).toBe('json');
    expect(diffModeFor('breadcrumb-segment')).toBe('json');
  });
});

describe('valueToText', () => {
  it('retourne la string telle quelle', () => {
    expect(valueToText('hello')).toBe('hello');
  });

  it('extrait .value d\'un kicker', () => {
    expect(valueToText({ value: 'Nouveau', tone: 'pink' })).toBe('Nouveau');
  });

  it('extrait .text d\'une quote', () => {
    expect(valueToText({ text: 'Bonjour', author: 'Z' })).toBe('Bonjour');
  });

  it('JSON-stringifie les structures sans champ texte connu', () => {
    expect(valueToText({ foo: 1 })).toContain('"foo"');
  });

  it('retourne une chaîne vide pour null/undefined', () => {
    expect(valueToText(null)).toBe('');
    expect(valueToText(undefined)).toBe('');
  });
});
