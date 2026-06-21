// @vitest-environment node
/**
 * F07 P3.4-f (Lot 2) — resolvedVarsMap : carte clé→valeur affichable du panneau.
 */
import { describe, expect, it } from 'vitest';
import { resolvedVarsMap } from '../resolved-vars';

describe('F07 — resolvedVarsMap', () => {
  it('F07-U-114 — coerce en chaîne, vide pour null/undefined, exclut trigger', () => {
    const map = resolvedVarsMap({
      firstName: 'Fatima',
      orderCount: 3,
      phone: '',
      lastOrderId: null,
      trigger: { eventName: 'x' },
    });
    expect(map.firstName).toBe('Fatima');
    expect(map.orderCount).toBe('3'); // nombre → chaîne
    expect(map.phone).toBe('');
    expect(map.lastOrderId).toBe(''); // null → vide
    expect(map).not.toHaveProperty('trigger'); // imbriqué exclu
  });

  it('F07-U-115 — tronque les valeurs longues (avec ellipse)', () => {
    const long = 'a'.repeat(200);
    const map = resolvedVarsMap({ siteUrl: long }, 80);
    expect(map.siteUrl!.length).toBe(81); // 80 + ellipse
    expect(map.siteUrl!.endsWith('…')).toBe(true);
  });
});
