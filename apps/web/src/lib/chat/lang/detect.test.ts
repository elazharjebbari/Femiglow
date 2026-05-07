import { describe, it, expect } from 'vitest';
import { detectLanguage } from './detect';

describe('detectLanguage', () => {
  it('detects French as default', () => {
    expect(detectLanguage('quel est le délai de livraison ?')).toBe('fr');
    expect(detectLanguage('je voudrais un kit')).toBe('fr');
  });

  it('detects classical Arabic via script', () => {
    expect(detectLanguage('السلام عليكم')).toBe('ar');
    expect(detectLanguage('كم سعر الكيت ؟')).toBe('ar');
  });

  it('detects darija (FR-script)', () => {
    expect(detectLanguage('bghit nchri kit dyalkom')).toBe('ar-MA');
    expect(detectLanguage('chno kayn 3andkom')).toBe('ar-MA');
  });

  it('falls back to FR for ambiguous short messages', () => {
    expect(detectLanguage('bonjour')).toBe('fr');
    expect(detectLanguage('')).toBe('fr');
  });
});
