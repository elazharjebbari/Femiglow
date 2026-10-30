/**
 * Kit CRO v2 §2 — exposition A/B : paramètres et unicité par page vue.
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { getEventSchema } from '@/lib/tracking/schemas';
import {
  KIT_CHECKOUT_EXPOSURE_EVENT,
  __resetKitCheckoutExposureForTests,
  buildKitCheckoutExposureParams,
  claimKitCheckoutExposure,
} from './kit-checkout-exposure';

beforeEach(() => __resetKitCheckoutExposureForTests());

describe('buildKitCheckoutExposureParams', () => {
  it('forme conforme au schéma strict, angle omis quand absent', () => {
    const params = buildKitCheckoutExposureParams({
      assignment: { mode: 'scroll', source: 'ab' },
      cmsMode: 'ab',
      sharePct: 50,
      kitAngle: null,
    });
    expect(params).toEqual({
      assigned_mode: 'scroll',
      mode_source: 'ab',
      cms_mode: 'ab',
      share_pct: 50,
    });
    expect(getEventSchema(KIT_CHECKOUT_EXPOSURE_EVENT)!.safeParse(params).success).toBe(true);
  });

  it('angle repris tel quel (y compris « none ») ; part bornée', () => {
    const params = buildKitCheckoutExposureParams({
      assignment: { mode: 'sheet', source: 'override' },
      cmsMode: 'scroll',
      sharePct: 140,
      kitAngle: 'none',
    });
    expect(params).toMatchObject({ share_pct: 100, kit_angle: 'none' });
    expect(getEventSchema(KIT_CHECKOUT_EXPOSURE_EVENT)!.safeParse(params).success).toBe(true);
  });
});

describe('claimKitCheckoutExposure', () => {
  it('une seule fois par chargement de page', () => {
    expect(claimKitCheckoutExposure()).toBe(true);
    expect(claimKitCheckoutExposure()).toBe(false);
    __resetKitCheckoutExposureForTests();
    expect(claimKitCheckoutExposure()).toBe(true);
  });
});
