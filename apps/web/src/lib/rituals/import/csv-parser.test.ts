import { describe, expect, it } from 'vitest';
import { CsvParseError, parseCSV } from './csv-parser';

describe('parseCSV', () => {
  it('parse un CSV minimal avec point-virgule', () => {
    const csv = 'body;wouldRecommend\n"Trois mois...";oui';
    const result = parseCSV(csv);
    expect(result.headers).toEqual(['body', 'wouldRecommend']);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual({
      body: 'Trois mois...',
      wouldRecommend: 'oui',
    });
  });

  it('détecte la virgule automatiquement', () => {
    const csv = 'body,wouldRecommend\n"a",oui';
    const result = parseCSV(csv);
    expect(result.rows[0]).toEqual({ body: 'a', wouldRecommend: 'oui' });
  });

  it('détecte la tabulation', () => {
    const csv = 'body\twouldRecommend\n"a"\toui';
    const result = parseCSV(csv);
    expect(result.rows[0]?.body).toBe('a');
  });

  it('gère doubles guillemets internes', () => {
    const csv = 'body;wouldRecommend\n"Il dit ""bonjour""";oui';
    const result = parseCSV(csv);
    expect(result.rows[0]?.body).toBe('Il dit "bonjour"');
  });

  it('gère sauts de ligne dans cellules quotées', () => {
    const csv = 'body;wouldRecommend\n"Ligne 1\nLigne 2";oui';
    const result = parseCSV(csv);
    expect(result.rows[0]?.body).toContain('\n');
  });

  it('accepte BOM UTF-8', () => {
    const csv = '﻿body;wouldRecommend\n"a";oui';
    const result = parseCSV(csv);
    expect(result.headers).toEqual(['body', 'wouldRecommend']);
  });

  it('rejette les en-têtes dupliquées', () => {
    const csv = 'body;body\n"a";"b"';
    expect(() => parseCSV(csv)).toThrow(CsvParseError);
  });

  it('rejette les fichiers > maxRows', () => {
    const rows = Array.from({ length: 6 }, (_, i) => `"row ${i}";oui`).join('\n');
    const csv = `body;wouldRecommend\n${rows}`;
    expect(() => parseCSV(csv, { maxRows: 5 })).toThrow(/Trop de lignes/);
  });

  it('rejette les fichiers > maxBytes', () => {
    const csv = 'body;wouldRecommend\n"a";oui';
    expect(() => parseCSV(csv, { maxBytes: 5 })).toThrow(/volumineux/);
  });

  it('rejette un CSV vide', () => {
    expect(() => parseCSV('')).toThrow(/vide/i);
  });

  it('séparateur explicite force', () => {
    const csv = 'body,wouldRecommend\n"a",oui';
    // Avec ; explicite : tout en une seule colonne car aucun ; trouvé
    const result = parseCSV(csv, { separator: ';' });
    expect(result.headers).toEqual(['body,wouldRecommend']);
  });
});
