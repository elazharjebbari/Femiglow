import { describe, expect, it } from 'vitest';

import {
  EVENT_DEFAULT_GOOGLE_ADS_CATEGORY,
  GOOGLE_ADS_CATEGORIES,
  getEventCategoryDefault,
  resolveEventCategory,
} from './categorization';

describe('GOOGLE_ADS_CATEGORIES', () => {
  it('inclut les 6 catégories Google Ads + none', () => {
    expect(GOOGLE_ADS_CATEGORIES).toEqual([
      'purchase',
      'lead',
      'contact',
      'signup',
      'view_content',
      'none',
    ]);
  });
});

describe('getEventCategoryDefault', () => {
  it("retourne 'purchase' pour purchase + begin_checkout", () => {
    expect(getEventCategoryDefault('purchase')).toBe('purchase');
    expect(getEventCategoryDefault('begin_checkout')).toBe('purchase');
  });

  it("retourne 'lead' pour lead_capture + generate_lead + chat_lead_form_submit", () => {
    expect(getEventCategoryDefault('lead_capture')).toBe('lead');
    expect(getEventCategoryDefault('generate_lead')).toBe('lead');
    expect(getEventCategoryDefault('chat_lead_form_submit')).toBe('lead');
  });

  it("retourne 'contact' pour contact_submit + newsletter_submit", () => {
    expect(getEventCategoryDefault('contact_submit')).toBe('contact');
    expect(getEventCategoryDefault('newsletter_submit')).toBe('contact');
  });

  it("retourne 'signup' pour sign_up", () => {
    expect(getEventCategoryDefault('sign_up')).toBe('signup');
  });

  it("retourne 'view_content' pour view_item + view_item_list", () => {
    expect(getEventCategoryDefault('view_item')).toBe('view_content');
    expect(getEventCategoryDefault('view_item_list')).toBe('view_content');
  });

  it("retourne 'none' pour un event inconnu", () => {
    expect(getEventCategoryDefault('unknown_event')).toBe('none');
    expect(getEventCategoryDefault('')).toBe('none');
  });
});

describe('EVENT_DEFAULT_GOOGLE_ADS_CATEGORY', () => {
  it('est immuable (frozen)', () => {
    expect(Object.isFrozen(EVENT_DEFAULT_GOOGLE_ADS_CATEGORY)).toBe(true);
  });
});

describe('resolveEventCategory', () => {
  it('fallback au default code quand pas de DB (test env sans drizzle)', async () => {
    // En l'absence de drizzle (memory mode), resolveEventCategory tombe sur
    // le default code. Le path "override DB" est couvert en intégration.
    await expect(resolveEventCategory('purchase')).resolves.toBe('purchase');
    await expect(resolveEventCategory('lead_capture')).resolves.toBe('lead');
    await expect(resolveEventCategory('unknown_event')).resolves.toBe('none');
  });
});
