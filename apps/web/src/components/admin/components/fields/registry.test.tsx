/**
 * Registry exhaustiveness — assure que tout `FieldType` est mappé.
 */
import { describe, it, expect } from 'vitest';
import { FIELD_EDITOR_REGISTRY, getFieldEditor } from './registry';
import type { FieldType } from '@/lib/db/types';

const ALL_FIELD_TYPES: FieldType[] = [
  'text',
  'multiline',
  'rich-text',
  'cta',
  'link',
  'icon',
  'color-token',
  'number',
  'boolean',
  'enum',
  'list',
  'record',
  'kicker',
  'quote',
  'breadcrumb-segment',
];

describe('FIELD_EDITOR_REGISTRY', () => {
  it('contient une entrée pour chaque FieldType', () => {
    for (const type of ALL_FIELD_TYPES) {
      const Editor = FIELD_EDITOR_REGISTRY.get(type);
      expect(Editor, `Missing editor for "${type}"`).toBeDefined();
    }
    // Symétrie : pas de type orphelin dans la map.
    const registered = Array.from(FIELD_EDITOR_REGISTRY.keys());
    expect(registered.sort()).toEqual([...ALL_FIELD_TYPES].sort());
  });

  it('getFieldEditor retourne le bon éditeur', () => {
    const Editor = getFieldEditor('text');
    expect(Editor).toBeDefined();
    expect(typeof Editor).toBe('function');
  });

  it('getFieldEditor jette si type inconnu', () => {
    expect(() => getFieldEditor('unknown' as FieldType)).toThrow(/No editor registered/);
  });
});
