import { describe, expect, it } from 'vitest';

import { ADDRESS_STEP_EVENTS } from './address-step-events';
import { isFirstPartyOnlyEvent } from './first-party-events';
import { getEventCategory, getEventSchema } from './schemas';

const VALID: Record<string, Record<string, unknown>> = {
  address_step_view: { step2_variant: 'control', viewport_h: 844, kit_angle: 'none' },
  address_city_focus: { step2_variant: 'v2' },
  address_city_selected: {
    step2_variant: 'control',
    matched: true,
    city_slug: 'casablanca',
    delivery_price_mad: 35,
    eta: '24h-48h',
  },
  address_line_focus: { step2_variant: 'control' },
  address_validation_error: { step2_variant: 'v2', field: 'addressLine1', code: 'too_small' },
  address_cta_tap_incomplete: { step2_variant: 'control', missing_field: 'city' },
  address_cta_visible: { step2_variant: 'control', ms_since_view: 1200 },
  address_step_abandon: {
    step2_variant: 'control',
    phase: 'address',
    has_city: true,
    ms_on_step: 8000,
  },
  address_note_opened: { step2_variant: 'v2' },
};

describe('événements de l’étape 2', () => {
  const names = Object.values(ADDRESS_STEP_EVENTS);

  it('chaque événement a un exemple dans ce test', () => {
    expect(Object.keys(VALID).sort()).toEqual([...names].sort());
  });

  it.each(names)('%s est accepté, classé et first-party', (name) => {
    const schema = getEventSchema(name);
    expect(schema?.safeParse(VALID[name]).success).toBe(true);
    expect(getEventCategory(name)).toBe('engagement');
    expect(isFirstPartyOnlyEvent(name)).toBe(true);
  });

  it.each(names)('%s refuse toute donnée personnelle', (name) => {
    const schema = getEventSchema(name);
    for (const personal of [
      { address: 'Hay Salam, rue 4' },
      { address_line1: 'Hay Salam' },
      { first_name: 'Yasmine' },
      { phone: '+212612345678' },
      { city: 'Douar X' },
    ]) {
      expect(schema?.safeParse({ ...VALID[name], ...personal }).success).toBe(false);
    }
  });

  it('un texte libre ne peut pas passer pour un slug de ville', () => {
    const schema = getEventSchema('address_city_selected');
    expect(
      schema?.safeParse({ ...VALID.address_city_selected, city_slug: 'Rue 4, Hay Salam' }).success,
    ).toBe(false);
  });

  it('address_completed accepte step2_variant, purchase le conserve', () => {
    const completed = getEventSchema('address_completed');
    const base = {
      form_id: 'wizard_kit',
      form_mode: 'wizard_embed',
      step_name: 'address',
      variant_key: 'A',
      schema_version: 'v1',
      currency: 'MAD',
    };
    expect(completed?.safeParse({ ...base, step2_variant: 'v2' }).success).toBe(true);
    expect(completed?.safeParse({ ...base, step2_variant: 'autre' }).success).toBe(false);

    const purchase = getEventSchema('purchase')?.parse({
      transaction_id: 'o_1',
      step2_variant: 'v2',
    }) as { step2_variant?: string };
    expect(purchase.step2_variant).toBe('v2');
  });
});
