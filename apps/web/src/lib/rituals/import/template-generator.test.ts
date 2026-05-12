import { describe, expect, it } from 'vitest';
import { generateTemplate } from './template-generator';
import { parseCSV } from './csv-parser';
import { parseJSON } from './json-parser';

describe('generateTemplate', () => {
  it('CSV (semicolon) parsable et contient 3 fixtures', () => {
    const result = generateTemplate('csv');
    expect(result.filename).toMatch(/\.csv$/);
    expect(result.contentType).toContain('text/csv');
    // strip header comments
    const lines = result.content.split('\n').filter((l) => !l.startsWith('#'));
    const stripped = lines.join('\n');
    const parsed = parseCSV(stripped);
    expect(parsed.rows).toHaveLength(3);
    expect(parsed.rows[0]?.body).toContain('Trois mois');
  });

  it('CSV (comma) utilise la virgule', () => {
    const result = generateTemplate('csv-comma');
    expect(result.content).toContain(
      'body,wouldRecommend,ritualTags',
    );
  });

  it('TSV utilise la tabulation', () => {
    const result = generateTemplate('tsv');
    expect(result.content).toContain('body\twouldRecommend');
  });

  it('JSON contient version et 3 rituels', () => {
    const result = generateTemplate('json');
    const parsed = parseJSON(result.content);
    expect(parsed.rows).toHaveLength(3);
  });

  it('JSONL — un objet par ligne', () => {
    const result = generateTemplate('jsonl');
    const parsed = parseJSON(result.content, { jsonl: true });
    expect(parsed.rows).toHaveLength(3);
  });

  it('filename inclut la date du jour', () => {
    const result = generateTemplate('csv');
    const today = new Date().toISOString().slice(0, 10);
    expect(result.filename).toContain(today);
  });
});
