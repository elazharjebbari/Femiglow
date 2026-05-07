import { describe, it, expect } from 'vitest';
import { decodeValue, encodeValue, isEmptyValue } from './encoding';

describe('encodeValue / decodeValue', () => {
  it('round-trips a text value through { v }', () => {
    const encoded = encodeValue('hello', 'text');
    expect(encoded).toEqual({ v: 'hello' });
    expect(decodeValue(encoded, 'text')).toBe('hello');
  });

  it('round-trips a number', () => {
    expect(decodeValue(encodeValue(42, 'number'), 'number')).toBe(42);
  });

  it('round-trips a boolean', () => {
    expect(decodeValue(encodeValue(true, 'boolean'), 'boolean')).toBe(true);
    expect(decodeValue(encodeValue(false, 'boolean'), 'boolean')).toBe(false);
  });

  it('keeps a cta object as-is', () => {
    const cta = { label: 'Voir', href: '/voir', variant: 'primary' };
    expect(encodeValue(cta, 'cta')).toBe(cta);
    expect(decodeValue(cta, 'cta')).toBe(cta);
  });

  it('wraps list items', () => {
    const list = ['a', 'b'];
    const encoded = encodeValue(list, 'list');
    expect(encoded).toEqual({ items: ['a', 'b'] });
    expect(decodeValue(encoded, 'list')).toEqual(['a', 'b']);
  });

  it('wraps record fields', () => {
    const record = { x: 1, y: 'two' };
    const encoded = encodeValue(record, 'record');
    expect(encoded).toEqual({ fields: record });
    expect(decodeValue(encoded, 'record')).toEqual(record);
  });

  it('decodeValue tolerates flat scalar (legacy)', () => {
    expect(decodeValue('flat', 'text')).toBe('flat');
  });

  it('decodeValue returns null for nullish input', () => {
    expect(decodeValue(null, 'text')).toBeNull();
    expect(decodeValue(undefined, 'cta')).toBeNull();
  });

  it('isEmptyValue catches missing / empty / blank', () => {
    expect(isEmptyValue(null, 'text')).toBe(true);
    expect(isEmptyValue({ v: '' }, 'text')).toBe(true);
    expect(isEmptyValue({ v: '   ' }, 'text')).toBe(true);
    expect(isEmptyValue({ v: 'x' }, 'text')).toBe(false);
    expect(isEmptyValue({ items: [] }, 'list')).toBe(true);
    expect(isEmptyValue({ items: ['a'] }, 'list')).toBe(false);
  });
});
