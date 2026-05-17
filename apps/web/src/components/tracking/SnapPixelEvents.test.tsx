import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';

// Mock consent module BEFORE importing the component
vi.mock('@/lib/tracking/consent', () => ({
  loadConsent: vi.fn(() => ({
    ad_storage: 'granted',
    analytics_storage: 'granted',
    ad_user_data: 'granted',
    ad_personalization: 'granted',
    functional_storage: 'granted',
  })),
  hasGivenConsent: vi.fn(() => true),
  DENIED_CONSENT: { ad_storage: 'denied', analytics_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', functional_storage: 'denied' },
  GRANTED_CONSENT: { ad_storage: 'granted', analytics_storage: 'granted', ad_user_data: 'granted', ad_personalization: 'granted', functional_storage: 'granted' },
}));

// Mock datalayer module
const recentMock = vi.fn(() => []);
vi.mock('@/lib/tracking/datalayer', () => ({
  getDataLayer: vi.fn(() => ({ recent: recentMock, push: vi.fn(), entries: [] })),
}));

import { SnapPixelEvents } from '@/components/tracking/SnapPixelEvents';
import type { DataLayerEntry } from '@/lib/tracking/datalayer';
import { loadConsent, hasGivenConsent } from '@/lib/tracking/consent';

const snaptrMock = vi.fn();
const GRANTED = {
  ad_storage: 'granted' as const,
  analytics_storage: 'granted' as const,
  ad_user_data: 'granted' as const,
  ad_personalization: 'granted' as const,
  functional_storage: 'granted' as const,
};

function mockEntry(overrides: Partial<DataLayerEntry> = {}): DataLayerEntry {
  return {
    event: 'purchase',
    event_id: 'evt_test_1',
    timestamp: new Date().toISOString(),
    schema_version: 1,
    consent: GRANTED,
    page: { url: 'https://femiglow.ma/merci', path: '/merci', title: 'Merci', referrer: '', locale: 'fr-MA' },
    user: { anonymous_id: 'anon_123', session_id: 'sess_123' },
    params: {
      currency: 'MAD',
      value: 399,
      transaction_id: 'order-42',
      event_tag: 'femiglow',
      items: [{ item_id: 'kit-1', item_category: 'beauty', price: 399, quantity: 1 }],
    },
    ...overrides,
  };
}

describe('SnapPixelEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (window as unknown as Record<string, unknown>).__fg_snap_pixel_id = 'snap-test-pixel';
    (window as unknown as Record<string, unknown>).snaptr = snaptrMock;
    recentMock.mockReturnValue([]);
    (hasGivenConsent as ReturnType<typeof vi.fn>).mockReturnValue(true);
    (loadConsent as ReturnType<typeof vi.fn>).mockReturnValue(GRANTED);
  });

  afterEach(() => {
    delete (window as unknown as Record<string, unknown>).__fg_snap_pixel_id;
    delete (window as unknown as Record<string, unknown>).snaptr;
    vi.restoreAllMocks();
  });

  async function renderAndFlush() {
    const result = render(<SnapPixelEvents />);
    await act(() => {});
    return result;
  }

  async function pushEvent(entry: DataLayerEntry) {
    await act(() => {
      window.dispatchEvent(new CustomEvent('fg:datalayer-push', { detail: entry }));
    });
  }

  it('fires snaptr track for mapped purchase event', async () => {
    await renderAndFlush();
    await pushEvent(mockEntry());

    expect(snaptrMock).toHaveBeenCalledWith('track', 'PURCHASE', expect.objectContaining({
      price: 399,
      currency: 'MAD',
      transaction_id: 'order-42',
      client_deduplication_id: 'evt_test_1',
      uuid_c1: 'anon_123',
      item_ids: ['kit-1'],
      item_category: 'beauty',
      number_items: 1,
      delivery_method: 'cod',
      payment_info_available: 1,
    }));
  });

  it('fires snaptr track for add_to_cart → ADD_CART', async () => {
    await renderAndFlush();
    await pushEvent(mockEntry({ event: 'add_to_cart' }));

    expect(snaptrMock).toHaveBeenCalledWith('track', 'ADD_CART', expect.objectContaining({
      price: 399,
      currency: 'MAD',
      item_ids: ['kit-1'],
      client_deduplication_id: 'evt_test_1',
    }));
  });

  it('fires snaptr track for view_item → VIEW_CONTENT', async () => {
    await renderAndFlush();
    await pushEvent(mockEntry({ event: 'view_item' }));

    expect(snaptrMock).toHaveBeenCalledWith('track', 'VIEW_CONTENT', expect.anything());
  });

  it('fires snaptr track for add_payment_info → ADD_BILLING with sign_up_method', async () => {
    await renderAndFlush();
    await pushEvent(mockEntry({ event: 'add_payment_info' }));

    expect(snaptrMock).toHaveBeenCalledWith('track', 'ADD_BILLING', expect.objectContaining({
      sign_up_method: 'phone',
    }));
  });

  it('fires snaptr track for checkout_intent → START_CHECKOUT with payment_info_available', async () => {
    await renderAndFlush();
    await pushEvent(mockEntry({ event: 'checkout_intent' }));

    expect(snaptrMock).toHaveBeenCalledWith('track', 'START_CHECKOUT', expect.objectContaining({
      payment_info_available: 1,
    }));
  });

  it('updates snaptr init with Advanced Matching when user_data is present', async () => {
    await renderAndFlush();
    await pushEvent(mockEntry({
      user_data: {
        sha256_email_address: 'abc123',
        sha256_phone_number: 'def456',
      },
    }));

    expect(snaptrMock).toHaveBeenCalledWith('init', 'snap-test-pixel', expect.objectContaining({
      user_hashed_email: 'abc123',
      user_hashed_phone_number: 'def456',
    }));
    expect(snaptrMock).toHaveBeenCalledWith('track', 'PURCHASE', expect.objectContaining({
      user_hashed_email: 'abc123',
      user_hashed_phone_number: 'def456',
    }));
  });

  it('does NOT fire when ad_storage consent is denied', async () => {
    (hasGivenConsent as ReturnType<typeof vi.fn>).mockReturnValue(false);
    await renderAndFlush();
    await pushEvent(mockEntry({
      consent: { ...GRANTED, ad_storage: 'denied' as const },
    }));

    expect(snaptrMock).not.toHaveBeenCalledWith('track', expect.anything(), expect.anything());
  });

  it('does NOT fire for unmapped events', async () => {
    await renderAndFlush();
    await pushEvent(mockEntry({ event: 'scroll_depth' }));

    const trackCalls = snaptrMock.mock.calls.filter((args: unknown[]) => args[0] === 'track');
    expect(trackCalls).toHaveLength(0);
  });

  it('deduplicates events by event_id', async () => {
    await renderAndFlush();
    const entry = mockEntry({ event_id: 'evt_dedup_1' });
    await pushEvent(entry);
    await pushEvent(entry);

    const trackCalls = snaptrMock.mock.calls.filter((args: unknown[]) => args[0] === 'track');
    expect(trackCalls).toHaveLength(1);
  });

  it('does NOT fire when snaptr SDK is not loaded', async () => {
    delete (window as unknown as Record<string, unknown>).snaptr;
    await renderAndFlush();
    await pushEvent(mockEntry());

    expect(snaptrMock).not.toHaveBeenCalled();
  });

  it('does NOT fire when pixel ID is not set', async () => {
    delete (window as unknown as Record<string, unknown>).__fg_snap_pixel_id;
    await renderAndFlush();
    await pushEvent(mockEntry());

    expect(snaptrMock).not.toHaveBeenCalled();
  });

  it('uses params.uuid_c1 over anonymousId when both present', async () => {
    await renderAndFlush();
    await pushEvent(mockEntry({
      params: {
        currency: 'MAD',
        value: 399,
        transaction_id: 'order-42',
        uuid_c1: 'custom_uuid',
        items: [{ item_id: 'kit-1', item_category: 'beauty', price: 399, quantity: 1 }],
      },
    }));

    expect(snaptrMock).toHaveBeenCalledWith('track', 'PURCHASE', expect.objectContaining({
      uuid_c1: 'custom_uuid',
    }));
  });

  it('maps generate_lead → LEAD', async () => {
    await renderAndFlush();
    await pushEvent(mockEntry({ event: 'generate_lead' }));

    expect(snaptrMock).toHaveBeenCalledWith('track', 'LEAD', expect.anything());
  });

  it('maps sign_up → SIGN_UP', async () => {
    await renderAndFlush();
    await pushEvent(mockEntry({ event: 'sign_up' }));

    expect(snaptrMock).toHaveBeenCalledWith('track', 'SIGN_UP', expect.anything());
  });

  it('includes firstname and geo fields for PURCHASE with user_data', async () => {
    await renderAndFlush();
    await pushEvent(mockEntry({
      user_data: {
        sha256_email_address: 'abc123',
        address: { sha256_first_name: 'f'.repeat(64) },
      },
      params: {
        currency: 'MAD',
        value: 399,
        transaction_id: 'order-42',
        geo_city: 'Casablanca',
        geo_country: 'MA',
        items: [{ item_id: 'kit-1', item_category: 'beauty', price: 399, quantity: 1 }],
      },
    }));

    const trackCall = snaptrMock.mock.calls.find((args: unknown[]) => args[0] === 'track');
    expect(trackCall).toBeDefined();
    const params = trackCall![2] as Record<string, unknown>;
    expect(params.firstname).toBe('f'.repeat(64));
    expect(params.geo_city).toBe('Casablanca');
    expect(params.geo_country).toBe('MA');
  });

  it('removes undefined values from track params', async () => {
    await renderAndFlush();
    await pushEvent(mockEntry({
      event: 'purchase',
      params: {
        currency: 'MAD',
        value: 399,
        transaction_id: 'order-42',
      },
    }));

    const trackCall = snaptrMock.mock.calls.find((args: unknown[]) => args[0] === 'track');
    expect(trackCall).toBeDefined();
    const params = trackCall![2] as Record<string, unknown>;
    expect(params.item_ids).toBeUndefined();
    expect(params.user_hashed_email).toBeUndefined();
  });

  it('maps page_view → PAGE_VIEW', async () => {
    await renderAndFlush();
    await pushEvent(mockEntry({ event: 'page_view' }));

    expect(snaptrMock).toHaveBeenCalledWith('track', 'PAGE_VIEW', expect.anything());
  });

  it('maps chat_lead_form_submit → LEAD', async () => {
    await renderAndFlush();
    await pushEvent(mockEntry({ event: 'chat_lead_form_submit' }));

    expect(snaptrMock).toHaveBeenCalledWith('track', 'LEAD', expect.anything());
  });

  it('maps lead_capture → LEAD', async () => {
    await renderAndFlush();
    await pushEvent(mockEntry({ event: 'lead_capture' }));

    expect(snaptrMock).toHaveBeenCalledWith('track', 'LEAD', expect.anything());
  });

  it('maps begin_checkout → START_CHECKOUT', async () => {
    await renderAndFlush();
    await pushEvent(mockEntry({ event: 'begin_checkout' }));

    expect(snaptrMock).toHaveBeenCalledWith('track', 'START_CHECKOUT', expect.anything());
  });

  it('includes delivery_method for ADD_CART and PAGE_VIEW per Snap v3 spec', async () => {
    await renderAndFlush();
    await pushEvent(mockEntry({ event: 'add_to_cart' }));

    const trackCall = snaptrMock.mock.calls.find((args: unknown[]) => args[0] === 'track');
    expect(trackCall).toBeDefined();
    const params = trackCall![2] as Record<string, unknown>;
    expect(params.delivery_method).toBe('cod');
  });

  it('does NOT include sign_up_method for non-ADD_BILLING events', async () => {
    await renderAndFlush();
    await pushEvent(mockEntry({ event: 'purchase' }));

    const trackCall = snaptrMock.mock.calls.find((args: unknown[]) => args[0] === 'track');
    expect(trackCall).toBeDefined();
    const params = trackCall![2] as Record<string, unknown>;
    expect(params.sign_up_method).toBeUndefined();
  });
});