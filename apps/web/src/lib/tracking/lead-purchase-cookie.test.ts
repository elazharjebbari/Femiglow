import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  LEAD_PURCHASE_COOKIE,
  isLeadAsPurchaseClientEnabled,
  markLeadAsPurchaseCookie,
} from './lead-purchase-cookie';

const ORIG = process.env.NEXT_PUBLIC_META_LEAD_AS_PURCHASE_ENABLED;

beforeEach(() => {
  // jsdom : reset cookies
  document.cookie
    .split(';')
    .forEach((c) => {
      const name = c.split('=')[0]?.trim();
      if (name) document.cookie = `${name}=; max-age=0; path=/`;
    });
});
afterEach(() => {
  if (ORIG === undefined) delete process.env.NEXT_PUBLIC_META_LEAD_AS_PURCHASE_ENABLED;
  else process.env.NEXT_PUBLIC_META_LEAD_AS_PURCHASE_ENABLED = ORIG;
});

describe('markLeadAsPurchaseCookie', () => {
  it('flag OFF → no-op (pas de cookie)', () => {
    process.env.NEXT_PUBLIC_META_LEAD_AS_PURCHASE_ENABLED = 'false';
    expect(isLeadAsPurchaseClientEnabled()).toBe(false);
    markLeadAsPurchaseCookie(24);
    expect(document.cookie).not.toContain(LEAD_PURCHASE_COOKIE);
  });

  it('flag ON → pose le cookie', () => {
    process.env.NEXT_PUBLIC_META_LEAD_AS_PURCHASE_ENABLED = 'true';
    expect(isLeadAsPurchaseClientEnabled()).toBe(true);
    markLeadAsPurchaseCookie(24);
    expect(document.cookie).toContain(`${LEAD_PURCHASE_COOKIE}=1`);
  });
});
