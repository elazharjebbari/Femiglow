/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest';

// `unstable_cache` jette « Invariant: incrementalCache » hors runtime Next.
// On le neutralise (identity) + on force le fallback `mockKit` déterministe
// (pas de DB en test). getKitLeadValue dérive alors du prix public effectif.
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('@/lib/db/queries/products', () => ({
  getProductBySlug: vi.fn().mockResolvedValue(null),
}));

import { buildKitPublicProduct, getKitLeadValue } from './public';

describe('getKitLeadValue (T-06 — valeur du lead = prix kit avec promo)', () => {
  it('= (promoPriceCents ?? priceCents) / 100 du kit public, en devise produit', async () => {
    const kit = await buildKitPublicProduct();
    const lead = await getKitLeadValue();
    // Source de vérité unique : le prix public effectif (promo si valide).
    const effectiveCents = kit.promoPriceCents ?? kit.priceCents;
    expect(lead.value).toBe(effectiveCents / 100);
    expect(lead.currency).toBe(kit.currency);
  });

  it('renvoie une valeur strictement positive en unité majeure (pas en centimes)', async () => {
    const lead = await getKitLeadValue();
    expect(lead.value).toBeGreaterThan(0);
    // garde-fou anti-régression « value en centimes » : un kit ~199 MAD ne
    // doit jamais ressortir à 19900.
    expect(lead.value).toBeLessThan(10_000);
  });
});
