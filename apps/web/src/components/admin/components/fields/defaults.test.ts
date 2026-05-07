/**
 * defaultForType — un default minimal mais éditable pour chaque type.
 */
import { describe, it, expect } from 'vitest';
import { defaultForType } from './defaults';

describe('defaultForType', () => {
  it('renvoie chaîne vide pour les types texte', () => {
    expect(defaultForType('text')).toBe('');
    expect(defaultForType('multiline')).toBe('');
    expect(defaultForType('rich-text')).toBe('');
    expect(defaultForType('kicker')).toBe('');
  });

  it('renvoie 0 ou config.min pour number', () => {
    expect(defaultForType('number')).toBe(0);
    expect(defaultForType('number', { min: 5 })).toBe(5);
  });

  it('renvoie false pour boolean', () => {
    expect(defaultForType('boolean')).toBe(false);
  });

  it('renvoie la première option pour enum', () => {
    expect(
      defaultForType('enum', {
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
      }),
    ).toBe('a');
    expect(defaultForType('enum')).toBe('');
  });

  it('renvoie les sous-formes par défaut pour les composites', () => {
    expect(defaultForType('cta')).toEqual({ label: '', href: '', variant: 'primary' });
    expect(defaultForType('link')).toEqual({ href: '', label: '', external: false });
    expect(defaultForType('quote')).toEqual({ text: '', author: '' });
    expect(defaultForType('breadcrumb-segment')).toEqual({ label: '', href: '' });
  });

  it('renvoie [] pour list et {} pour record', () => {
    expect(defaultForType('list')).toEqual([]);
    expect(defaultForType('record')).toEqual({});
  });

  it('renvoie chaîne vide pour icon et color-token', () => {
    expect(defaultForType('icon')).toBe('');
    expect(defaultForType('color-token')).toBe('');
  });
});
