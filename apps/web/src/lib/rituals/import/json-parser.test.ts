import { describe, expect, it } from 'vitest';
import { JsonParseError, parseJSON } from './json-parser';

describe('parseJSON (array racine)', () => {
  it('parse un array minimal', () => {
    const json = '[{"body":"a","wouldRecommend":"oui"}]';
    const result = parseJSON(json);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.body).toBe('a');
  });

  it('parse objet racine avec rituals', () => {
    const json = '{"version":1,"rituals":[{"body":"a","wouldRecommend":"oui"}]}';
    const result = parseJSON(json);
    expect(result.rows).toHaveLength(1);
  });

  it('rejette JSON malformé', () => {
    expect(() => parseJSON('{invalid')).toThrow(JsonParseError);
  });

  it('rejette si > maxRows', () => {
    const arr = Array.from({ length: 6 }, () => ({ body: 'a', wouldRecommend: 'oui' }));
    expect(() => parseJSON(JSON.stringify(arr), { maxRows: 5 })).toThrow(
      /Trop de rituels/,
    );
  });

  it('rejette format inconnu', () => {
    expect(() => parseJSON('{"foo":"bar"}')).toThrow(/Format attendu/);
  });

  it('rejette tableau d’entrées non-objet', () => {
    expect(() => parseJSON('["a","b"]')).toThrow(/objet attendu/);
  });
});

describe('parseJSON (JSONL)', () => {
  it('parse ligne par ligne', () => {
    const jsonl =
      '{"body":"a","wouldRecommend":"oui"}\n{"body":"b","wouldRecommend":"non"}';
    const result = parseJSON(jsonl, { jsonl: true });
    expect(result.rows).toHaveLength(2);
    expect(result.rows[1]?.body).toBe('b');
  });

  it('ignore lignes vides', () => {
    const jsonl =
      '{"body":"a","wouldRecommend":"oui"}\n\n\n{"body":"b","wouldRecommend":"non"}\n';
    const result = parseJSON(jsonl, { jsonl: true });
    expect(result.rows).toHaveLength(2);
  });

  it('rejette une ligne mal formée', () => {
    const jsonl = '{"body":"a","wouldRecommend":"oui"}\n{invalid}\n';
    expect(() => parseJSON(jsonl, { jsonl: true })).toThrow(/Ligne 2/);
  });
});
