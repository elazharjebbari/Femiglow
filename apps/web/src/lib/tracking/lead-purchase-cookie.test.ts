import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LEAD_PURCHASE_COOKIE,
  isLeadAsPurchaseClientEnabled,
  markLeadAsPurchaseCookie,
  getJourneyPurchaseId,
} from './lead-purchase-cookie';

const ORIG = process.env.NEXT_PUBLIC_META_LEAD_AS_PURCHASE_ENABLED;

beforeEach(() => {
  // jsdom : reset cookies
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0]?.trim();
    if (name) document.cookie = `${name}=; max-age=0; path=/`;
  });
});
afterEach(() => {
  if (ORIG === undefined) delete process.env.NEXT_PUBLIC_META_LEAD_AS_PURCHASE_ENABLED;
  else process.env.NEXT_PUBLIC_META_LEAD_AS_PURCHASE_ENABLED = ORIG;
});

describe('getJourneyPurchaseId (jpid de parcours)', () => {
  it('flag OFF → no-op (pas de cookie, retourne null)', () => {
    process.env.NEXT_PUBLIC_META_LEAD_AS_PURCHASE_ENABLED = 'false';
    expect(isLeadAsPurchaseClientEnabled()).toBe(false);
    expect(getJourneyPurchaseId(24)).toBeNull();
    expect(document.cookie).not.toContain(LEAD_PURCHASE_COOKIE);
  });

  it('flag ON → pose le cookie avec un jpid (uuid) et le retourne', () => {
    process.env.NEXT_PUBLIC_META_LEAD_AS_PURCHASE_ENABLED = 'true';
    const jpid = getJourneyPurchaseId(24);
    expect(jpid).toBeTruthy();
    expect(jpid!.length).toBeGreaterThan(10);
    expect(document.cookie).toContain(`${LEAD_PURCHASE_COOKIE}=${jpid}`);
  });

  it('idempotent : 2 appels (même parcours) → MÊME jpid', () => {
    process.env.NEXT_PUBLIC_META_LEAD_AS_PURCHASE_ENABLED = 'true';
    const a = getJourneyPurchaseId(24);
    const b = getJourneyPurchaseId(24);
    expect(a).toBe(b); // réutilise le cookie → dédup native garantie
  });

  it('markLeadAsPurchaseCookie (back-compat) pose aussi le cookie jpid', () => {
    process.env.NEXT_PUBLIC_META_LEAD_AS_PURCHASE_ENABLED = 'true';
    markLeadAsPurchaseCookie(24);
    expect(document.cookie).toContain(`${LEAD_PURCHASE_COOKIE}=`);
    expect(document.cookie).not.toContain(`${LEAD_PURCHASE_COOKIE}=;`);
  });
});
