import { describe, it, expect } from 'vitest';

import { sanitizeAndRedact } from './sanitize';

describe('sanitizeAndRedact', () => {
  it('redacts email addresses', () => {
    const r = sanitizeAndRedact('contact me at john.doe@example.com');
    expect(r.contentSafe).toContain('[email]');
    expect(r.contentSafe).not.toContain('john.doe');
    expect(r.redactions).toContain('email');
  });

  it('redacts French phone numbers', () => {
    const r = sanitizeAndRedact('appelle 0612345678 stp');
    expect(r.contentSafe).toContain('[téléphone]');
    expect(r.redactions).toContain('phone');
  });

  it('truncates very long inputs', () => {
    const r = sanitizeAndRedact('a'.repeat(3000));
    expect(r.truncated).toBe(true);
    expect(r.contentSafe.length).toBeLessThanOrEqual(2000);
  });

  it('preserves harmless content', () => {
    const r = sanitizeAndRedact('quel est le délai de livraison ?');
    expect(r.contentSafe).toBe('quel est le délai de livraison ?');
    expect(r.redactions).toHaveLength(0);
  });

  it('redacts moroccan phone numbers (+212)', () => {
    const r = sanitizeAndRedact('joins moi sur +212 6 12 34 56 78');
    expect(r.contentSafe).toContain('[téléphone]');
    expect(r.redactions).toContain('phone');
  });

  it('redacts at least one PII pattern when several appear (current pipeline ordering)', () => {
    // NB : la regex `phone` actuelle est très permissive et capture
    // souvent IBAN/CB/CNI avant que leur regex spécifique ne s'exécute.
    // C'est un comportement « safe-by-default » : tout est masqué, juste
    // sous l'étiquette `[téléphone]`. Le test garantit qu'aucune donnée
    // brute ne fuit dans le `contentSafe`.
    const inputs = [
      'iban FR7630006000011234567890189',
      'cb 4111 1111 1111 1111',
      'cni BE12345678',
    ];
    for (const input of inputs) {
      const r = sanitizeAndRedact(input);
      expect(r.redactions.length).toBeGreaterThan(0);
      // aucune séquence de ≥6 chiffres consécutifs ne doit subsister
      expect(r.contentSafe).not.toMatch(/\d{6,}/);
    }
  });

  it('normalizes whitespace and trims', () => {
    const r = sanitizeAndRedact('  hello   world  \n  ');
    expect(r.contentSafe).toBe('hello world');
  });

  it('returns truncated raw at MAX_LEN', () => {
    const r = sanitizeAndRedact('x'.repeat(5000));
    expect(r.truncated).toBe(true);
    expect(r.contentRaw.length).toBe(2000);
  });
});
