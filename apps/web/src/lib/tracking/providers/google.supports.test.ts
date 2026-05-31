import { describe, expect, it } from 'vitest';
import { googleAdapter } from './google';

/**
 * T-07 (audit 2026-05-31) — GA4 = client GTM uniquement. Le dispatch MP
 * serveur ne doit PAS doubler les events déjà envoyés par le tag `gaawe`
 * client (GA4 ne déduplique pas gtag ↔ Measurement Protocol).
 */
describe('googleAdapter.supports — GA4 client-only', () => {
  it('skip les events client (scope web/both → tag gaawe déjà présent)', () => {
    expect(googleAdapter.supports('purchase')).toBe(false);
    expect(googleAdapter.supports('generate_lead')).toBe(false);
    expect(googleAdapter.supports('page_view')).toBe(false);
    expect(googleAdapter.supports('add_to_cart')).toBe(false);
  });

  it('dispatche les events server-scope (aucun tag gaawe client)', () => {
    // refund : scope=server, mappé GA4 → seul chemin = MP serveur.
    expect(googleAdapter.supports('refund')).toBe(true);
  });

  it('skip un event inconnu / non mappé GA4', () => {
    expect(googleAdapter.supports('not_a_real_event')).toBe(false);
  });
});
