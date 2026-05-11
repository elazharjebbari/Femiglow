import { describe, expect, it } from 'vitest';
import { sanitizeBody } from './sanitize-body';

describe('sanitizeBody', () => {
  it('texte propre inchangé', () => {
    const { sanitized, flags } = sanitizeBody('Trois mois et l’ongle.');
    expect(sanitized).toBe('Trois mois et l’ongle.');
    expect(flags).toEqual([]);
  });

  it('strip emoji simple + flag', () => {
    const { sanitized, flags } = sanitizeBody('Très bien 😊');
    expect(sanitized).toBe('Très bien');
    expect(flags).toContain('emoji_detected');
  });

  it('strip plusieurs emojis (espaces collapsés)', () => {
    const { sanitized } = sanitizeBody('🌸 paste 💅 powder ✨');
    expect(sanitized).toBe('paste powder');
  });

  it('convertit apostrophe droite en courbe', () => {
    const { sanitized } = sanitizeBody("l'ongle");
    expect(sanitized).toBe('l’ongle');
  });

  it('respecte apostrophe déjà courbe', () => {
    const { sanitized } = sanitizeBody('l’ongle');
    expect(sanitized).toBe('l’ongle');
  });

  it('ajoute espace fine avant ponctuation forte', () => {
    const { sanitized } = sanitizeBody("bonjour: c'est ?");
    expect(sanitized).toContain('bonjour :');
    expect(sanitized).toContain('?');
  });

  it('trim leading/trailing', () => {
    const { sanitized } = sanitizeBody('  texte  ');
    expect(sanitized).toBe('texte');
  });

  it('collapse spaces multiples', () => {
    const { sanitized } = sanitizeBody('mot   mot');
    expect(sanitized).toBe('mot mot');
  });

  it('Unicode NFC normalization', () => {
    const { sanitized } = sanitizeBody('éclat'); // decomposé
    expect(sanitized).toBe('éclat');
  });

  it('emoji ZWJ sequences', () => {
    const { flags } = sanitizeBody('👨‍👩‍👧');
    expect(flags).toContain('emoji_detected');
  });
});
