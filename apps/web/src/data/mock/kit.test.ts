/**
 * Tests `mockKitPageContent` — vérifie que le mock TS est valide vis-à-vis
 * de `kitPageContentSchema` après l'extension phase 1 (sensation +
 * accentColor obligatoires sur les 3 sous-produits du Kit).
 *
 * cf. docs/composition-reveal-optim-2026-05/03-data-model.md §4
 */
import { describe, expect, it } from 'vitest';

import { kitPageContentSchema } from '@/lib/schemas';

import { mockKitPageContent } from './kit';

describe('mockKitPageContent', () => {
  it('passe la validation kitPageContentSchema sans erreur', () => {
    expect(() => kitPageContentSchema.parse(mockKitPageContent)).not.toThrow();
  });

  it('contient exactement 3 sous-produits', () => {
    expect(mockKitPageContent.composition).toHaveLength(3);
  });

  it('chaque sous-produit porte une sensation et un accentColor (post-phase 1)', () => {
    for (const sub of mockKitPageContent.composition) {
      expect(sub.sensation, `sub ${sub.id} doit avoir une sensation`).toBeDefined();
      expect(sub.accentColor, `sub ${sub.id} doit avoir un accentColor`).toBeDefined();
    }
  });

  it('mappe l\'accentColor attendu par sous-produit (sauge / petale / ciel)', () => {
    const map = Object.fromEntries(
      mockKitPageContent.composition.map((s) => [s.id, s.accentColor]),
    );
    expect(map['1-paste']).toBe('sauge');
    expect(map['2-powder']).toBe('petale');
    expect(map['polissoir-step-4']).toBe('ciel');
  });
});
