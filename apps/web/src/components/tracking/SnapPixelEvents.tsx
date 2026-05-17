'use client';

import { useEffect, useRef } from 'react';
import { getDataLayer, type DataLayerEntry } from '@/lib/tracking/datalayer';
import { loadConsent, hasGivenConsent } from '@/lib/tracking/consent';
import type { TrackingConsentState } from '@/lib/db/types';

/**
 * Mapping FemiGlow event → Snap pixel event name (client-side).
 * Mirrors the server-side mapping in event-mapping.ts but uses
 * the Snap pixel naming convention (UPPER_SNAKE_CASE).
 */
const SNAP_EVENT_MAP: Record<string, string> = {
  page_view: 'PAGE_VIEW',
  view_item: 'VIEW_CONTENT',
  add_to_cart: 'ADD_CART',
  checkout_intent: 'START_CHECKOUT',
  begin_checkout: 'START_CHECKOUT',
  add_payment_info: 'ADD_BILLING',
  purchase: 'PURCHASE',
  generate_lead: 'LEAD',
  lead_capture: 'LEAD',
  chat_lead_form_submit: 'LEAD',
  sign_up: 'SIGN_UP',
};

/**
 * Builds client-side snaptr('track', name, params) parameters.
 *
 * Snap client-side format differs from CAPI v3:
 * - `price` (not `value`)
 * - `item_ids` (not `content_ids`)
 * - `item_category` (string, not array)
 * - `number_items` (number, not array of strings)
 * - `user_hashed_email` / `user_hashed_phone_number` (not `em`/`ph` arrays)
 * - `uuid_c1` for anonymous dedup
 * - `client_deduplication_id` matches server-side CAPI event_id
 */
function buildClientParams(entry: DataLayerEntry): Record<string, unknown> {
  const params = (entry.params ?? {}) as Record<string, unknown>;
  const items = Array.isArray(params.items)
    ? (params.items as Array<{ item_id?: string; item_category?: string; price?: number; quantity?: number }>)
    : [];

  const result: Record<string, unknown> = {
    price: params.value ?? params.price,
    currency: params.currency,
    uuid_c1: params.uuid_c1 ?? entry.user.anonymous_id,
    transaction_id: params.transaction_id,
    client_deduplication_id: entry.event_id,
  };

  if (items.length > 0) {
    result.item_ids = items.map((i) => i.item_id).filter(Boolean);
    result.item_category = items[0]?.item_category;
    result.number_items = items.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);
  }

  // User data (pre-hashed by hashIdentityBrowser)
  const ud = entry.user_data;
  if (ud?.sha256_email_address) result.user_hashed_email = ud.sha256_email_address;
  if (ud?.sha256_phone_number) result.user_hashed_phone_number = ud.sha256_phone_number;

  // Event-specific fields
  const snapName = SNAP_EVENT_MAP[entry.event];
  if (snapName === 'ADD_BILLING') {
    result.sign_up_method = params.sign_up_method ?? 'phone';
  }
  if (snapName === 'START_CHECKOUT' || snapName === 'PURCHASE') {
    result.payment_info_available = params.payment_info_available ?? 1;
  }
  if (snapName === 'PURCHASE') {
    result.delivery_method = params.delivery_method ?? 'cod';
    if (ud?.address?.sha256_first_name) result.firstname = ud.address.sha256_first_name;
    if (params.geo_city) result.geo_city = params.geo_city;
    if (params.geo_country) result.geo_country = params.geo_country;
  }

  // Remove undefined values (snaptr rejects null/undefined)
  for (const key of Object.keys(result)) {
    if (result[key] === undefined) delete result[key];
  }

  return result;
}

/**
 * React component that observes the dataLayer and fires client-side
 * `snaptr('track', ...)` calls for mapped Snap events.
 *
 * This is the client-side counterpart to the CAPI server-side dispatch.
 * Snap deduplicates using `client_deduplication_id` = `event_id`.
 *
 * Prerequisites:
 *  1. The snaptr SDK must be loaded (injected by PixelLoader)
 *  2. The pixel ID must be stored on `window.__fg_snap_pixel_id`
 *  3. Ad consent must be granted (`ad_storage === 'granted'`)
 */
export function SnapPixelEvents(): null {
  const consentRef = useRef<TrackingConsentState>(loadConsent());
  const processedRef = useRef(new Set<string>());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const pixelId = (window as unknown as Record<string, unknown>).__fg_snap_pixel_id as string | undefined;
    if (!pixelId) return;

    const handler = (evt: Event): void => {
      const detail = (evt as CustomEvent<TrackingConsentState>).detail;
      if (detail) consentRef.current = detail;
    };
    window.addEventListener('fg:consent-changed', handler);

    const onPush = (evt: Event): void => {
      const entry = (evt as CustomEvent<DataLayerEntry>).detail;
      if (!entry) return;

      // Dedup by event_id — process each event only once
      if (processedRef.current.has(entry.event_id)) return;
      processedRef.current.add(entry.event_id);
      // LRU cleanup
      if (processedRef.current.size > 500) {
        const first = processedRef.current.values().next().value;
        if (first) processedRef.current.delete(first);
      }

      const consent = consentRef.current;
      if (!hasGivenConsent(consent) || consent.ad_storage === 'denied') return;

      const snapName = SNAP_EVENT_MAP[entry.event];
      if (!snapName) return;

      const w = window as unknown as Record<string, unknown>;
      const snaptr = w.snaptr as ((...args: unknown[]) => void) | undefined;
      if (typeof snaptr !== 'function') return;

      // Update Advanced Matching if user data is present
      const ud = entry.user_data;
      if (ud?.sha256_email_address || ud?.sha256_phone_number) {
        const initParams: Record<string, unknown> = {};
        if (ud.sha256_email_address) initParams.user_hashed_email = ud.sha256_email_address;
        if (ud.sha256_phone_number) initParams.user_hashed_phone_number = ud.sha256_phone_number;
        snaptr('init', pixelId, initParams);
      }

      const trackParams = buildClientParams(entry);
      snaptr('track', snapName, trackParams);
    };

    window.addEventListener('fg:datalayer-push', onPush);

    // Process any entries that were pushed before mount
    const dataLayer = getDataLayer();
    for (const entry of dataLayer.recent(50)) {
      if (processedRef.current.has(entry.event_id)) continue;
      processedRef.current.add(entry.event_id);
      if (!hasGivenConsent(consentRef.current) || consentRef.current.ad_storage === 'denied') continue;
      const snapName = SNAP_EVENT_MAP[entry.event];
      if (!snapName) continue;
      const w = window as unknown as Record<string, unknown>;
      const snaptr = w.snaptr as ((...args: unknown[]) => void) | undefined;
      if (typeof snaptr !== 'function') continue;
      const trackParams = buildClientParams(entry);
      snaptr('track', snapName, trackParams);
    }

    return (): void => {
      window.removeEventListener('fg:consent-changed', handler);
      window.removeEventListener('fg:datalayer-push', onPush);
    };
  }, []);

  return null;
}