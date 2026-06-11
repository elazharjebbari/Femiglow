/**
 * Vérifie que les 4 events wizard CHA-230 sont correctement déclarés dans
 * `EVENT_CATALOG`. Référence : docs/checkout-funnel/05-plan-action.md §2 PR #1.
 *
 * Important : ces tests garantissent qu'un builder GTM (cf. gtm/builders.ts)
 * pourra fabriquer triggers + tags pour chacun de ces events sans crasher,
 * et que la taxonomie reste cohérente avec la doc.
 */
import { describe, expect, it } from 'vitest';

import { EVENT_CATALOG, findEventInCatalog } from '../event-catalog';

const WIZARD_EVENTS = [
  'lead_capture',
  'address_completed',
  'wizard_error',
  'wizard_abandoned',
] as const;

describe('event-catalog — CHA-230 wizard events', () => {
  for (const name of WIZARD_EVENTS) {
    it(`registre l'event \`${name}\``, () => {
      const entry = findEventInCatalog(name);
      expect(entry).not.toBeNull();
      expect(entry?.name).toBe(name);
    });
  }

  it('lead_capture marqué isConversion=true (semantique GA4 generate_lead)', () => {
    const entry = findEventInCatalog('lead_capture');
    expect(entry?.isConversion).toBe(true);
  });

  it('address_completed, wizard_error, wizard_abandoned ne sont PAS des conversions', () => {
    expect(findEventInCatalog('address_completed')?.isConversion).toBe(false);
    expect(findEventInCatalog('wizard_error')?.isConversion).toBe(false);
    expect(findEventInCatalog('wizard_abandoned')?.isConversion).toBe(false);
  });

  it('les events wizard ont scope=web (UI only)', () => {
    for (const name of WIZARD_EVENTS) {
      expect(findEventInCatalog(name)?.scope).toBe('web');
    }
  });

  it('lead_capture par défaut sur google_ga4 + meta + snap — google_ads retiré (fix double-comptage)', () => {
    // `google_ads` est porté UNIQUEMENT par `generate_lead` depuis l'audit
    // google-ads-2026-06-03 (cf. commentaire du catalogue) — ce test était
    // resté sur l'ancien routing et échouait aussi sur master.
    const entry = findEventInCatalog('lead_capture');
    expect(entry?.defaultProviders).toEqual(
      expect.arrayContaining(['google_ga4', 'meta', 'snap']),
    );
    expect(entry?.defaultProviders).not.toContain('google_ads');
  });

  it('chaque entry a un paramsSchema avec `form_mode`/`step_name`/`variant_key`', () => {
    for (const name of WIZARD_EVENTS) {
      const entry = findEventInCatalog(name);
      const props = (entry?.paramsSchema as { properties?: Record<string, unknown> })
        ?.properties;
      expect(props).toBeDefined();
      expect(props).toHaveProperty('form_mode');
      expect(props).toHaveProperty('step_name');
      expect(props).toHaveProperty('variant_key');
    }
  });

  it('aucun doublon de nom dans le catalogue', () => {
    const names = EVENT_CATALOG.map((e) => e.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});
