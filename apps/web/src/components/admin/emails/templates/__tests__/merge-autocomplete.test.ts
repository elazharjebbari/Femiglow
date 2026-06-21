// @vitest-environment node
/**
 * F07 P3.4-d (Lot 2) — autocomplete `{{` : détection du jeton actif + complétion.
 */
import { describe, expect, it } from 'vitest';
import { activeMergeQuery, applyMergeCompletion } from '../merge-autocomplete';

describe('F07 — activeMergeQuery', () => {
  it('F07-U-108 — jeton ouvert → partiel + index du {{', () => {
    expect(activeMergeQuery('{{fir', 5)).toEqual({ query: 'fir', start: 0 });
    expect(activeMergeQuery('Bonjour {{first', 15)).toEqual({ query: 'first', start: 8 });
    expect(activeMergeQuery('{{', 2)).toEqual({ query: '', start: 0 }); // « {{ » → propose tout
  });

  it('F07-U-109 — jeton fermé / absent → null', () => {
    expect(activeMergeQuery('{{firstName}}', 13)).toBeNull(); // fermé
    expect(activeMergeQuery('aucune accolade', 8)).toBeNull();
    expect(activeMergeQuery('{{fir}} suite', 13)).toBeNull(); // après un jeton fermé
  });

  it('F07-U-110 — espace / point interrompent (≠ jeton custom)', () => {
    expect(activeMergeQuery('{{ .Subscriber', 14)).toBeNull(); // syntaxe Listmonk
    expect(activeMergeQuery('{{first name', 12)).toBeNull(); // espace
  });
});

describe('F07 — applyMergeCompletion', () => {
  it('F07-U-111 — remplace le partiel par le jeton complet', () => {
    expect(applyMergeCompletion('Hi {{fir', 8, 'firstName')).toEqual({
      value: 'Hi {{firstName}}',
      cursor: 16,
    });
  });

  it('F07-U-112 — consomme un }} déjà présent (pas de }}}})', () => {
    expect(applyMergeCompletion('Hi {{fir}}', 8, 'firstName')).toEqual({
      value: 'Hi {{firstName}}',
      cursor: 16,
    });
  });

  it('F07-U-113 — hors jeton ouvert → insère au curseur', () => {
    expect(applyMergeCompletion('Hello', 5, 'email')).toEqual({
      value: 'Hello{{email}}',
      cursor: 14,
    });
  });
});
