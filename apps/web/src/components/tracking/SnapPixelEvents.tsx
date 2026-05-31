'use client';

import { useEffect, useRef } from 'react';
import { getDataLayer, type DataLayerEntry } from '@/lib/tracking/datalayer';
import { loadConsent, hasGivenConsent } from '@/lib/tracking/consent';
import type { TrackingConsentState } from '@/lib/db/types';

/**
 * Mapping FemiGlow event → Snap pixel event name (client-side).
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
 * Fields per Snap v3 event for client-side snaptr('track') calls.
 * Each key is the Snap event name, value is the set of fields to include.
 */
const EVENT_FIELDS: Record<string, Set<string>> = {
  PAGE_VIEW: new Set([
    'item_ids', 'item_category', 'uuid_c1', 'price', 'transaction_id',
    'client_deduplication_id', 'delivery_method', 'number_items',
    'user_email', 'user_phone_number', 'user_hashed_email', 'user_hashed_phone_number',
  ]),
  VIEW_CONTENT: new Set([
    'price', 'currency', 'item_ids', 'item_category', 'uuid_c1',
    'transaction_id', 'client_deduplication_id',
    'user_email', 'user_phone_number', 'user_hashed_email', 'user_hashed_phone_number',
  ]),
  ADD_CART: new Set([
    'price', 'currency', 'item_ids', 'item_category', 'number_items',
    'uuid_c1', 'transaction_id', 'client_deduplication_id', 'delivery_method',
    'user_email', 'user_phone_number', 'user_hashed_email', 'user_hashed_phone_number',
  ]),
  START_CHECKOUT: new Set([
    'price', 'currency', 'item_ids', 'item_category', 'number_items',
    'payment_info_available', 'uuid_c1', 'transaction_id', 'client_deduplication_id',
    'user_email', 'user_phone_number', 'user_hashed_email', 'user_hashed_phone_number',
  ]),
  ADD_BILLING: new Set([
    'price', 'currency', 'uuid_c1', 'transaction_id',
    'item_ids', 'item_category', 'sign_up_method',
    'user_email', 'user_phone_number', 'user_hashed_email', 'user_hashed_phone_number',
  ]),
  PURCHASE: new Set([
    'price', 'currency', 'transaction_id', 'item_ids', 'item_category', 'number_items',
    'uuid_c1', 'client_deduplication_id', 'delivery_method', 'payment_info_available',
    'user_email', 'user_phone_number', 'user_hashed_email', 'user_hashed_phone_number',
    'firstname', 'geo_city', 'geo_country',
  ]),
};

/**
 * Builds all candidate fields, then filters to only those allowed for the event.
 */
function buildClientParams(entry: DataLayerEntry): Record<string, unknown> {
  const params = (entry.params ?? {}) as Record<string, unknown>;
  const items = Array.isArray(params.items)
    ? (params.items as Array<{ item_id?: string; item_category?: string; price?: number; quantity?: number }>)
    : [];
  const snapName = SNAP_EVENT_MAP[entry.event] ?? '';
  const allowed = EVENT_FIELDS[snapName];
  const identity = entry.identity;

  // Build all candidate values
  const candidates: Record<string, unknown> = {
    price: params.value ?? params.price,
    currency: params.currency,
    uuid_c1: params.uuid_c1 ?? entry.user.anonymous_id,
    transaction_id: params.transaction_id,
    client_deduplication_id: entry.event_id,
    delivery_method: params.delivery_method ?? 'cod',
    payment_info_available: params.payment_info_available ?? 1,
    sign_up_method: params.sign_up_method ?? 'phone',
    number_items: items.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0),
  };

  if (items.length > 0) {
    candidates.item_ids = items.map((i) => i.item_id).filter(Boolean);
    candidates.item_category = items[0]?.item_category;
  }

  // Plain text identity (Snap SDK normalizes + hashes before sending)
  if (identity?.email) candidates.user_email = identity.email;
  if (identity?.phone) candidates.user_phone_number = identity.phone;

  // Pre-hashed identity (from hashIdentityBrowser)
  const ud = entry.user_data;
  if (ud?.sha256_email_address) candidates.user_hashed_email = ud.sha256_email_address;
  if (ud?.sha256_phone_number) candidates.user_hashed_phone_number = ud.sha256_phone_number;

  // PURCHASE-specific
  if (snapName === 'PURCHASE') {
    if (ud?.address?.sha256_first_name) candidates.firstname = ud.address.sha256_first_name;
    if (params.geo_city) candidates.geo_city = params.geo_city;
    if (params.geo_country) candidates.geo_country = params.geo_country;
  }

  // Filter to only allowed fields for this event, remove undefined
  const result: Record<string, unknown> = {};
  if (allowed) {
    for (const key of Object.keys(candidates)) {
      if (allowed.has(key) && candidates[key] !== undefined) {
        result[key] = candidates[key];
      }
    }
  } else {
    // Unknown events: include all non-undefined
    for (const key of Object.keys(candidates)) {
      if (candidates[key] !== undefined) result[key] = candidates[key];
    }
  }

  return result;
}

/**
 * Reads the Snap pixel ID from window.__fg_snap_pixel_id or snaptr queue.
 */
function getPixelId(): string | undefined {
  const w = window as unknown as Record<string, unknown>;
  if (w.__fg_snap_pixel_id) return w.__fg_snap_pixel_id as string;
  const snaptr = w.snaptr as unknown;
  if (snaptr && typeof snaptr === 'object') {
    const queue = (snaptr as { queue?: Array<[string, string]> }).queue;
    if (Array.isArray(queue)) {
      for (const call of queue) {
        if (Array.isArray(call) && call[0] === 'init' && call[1]) return call[1];
      }
    }
  }
  return undefined;
}

/**
 * React component that observes the dataLayer and fires client-side
 * `snaptr('track', ...)` calls for mapped Snap events.
 *
 * Snap deduplicates using `client_deduplication_id` = `event_id`.
 */
export function SnapPixelEvents(): null {
  const consentRef = useRef<TrackingConsentState>(loadConsent());
  const processedRef = useRef(new Set<string>());
  const pixelIdAvailableRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const consentHandler = (evt: Event): void => {
      const detail = (evt as CustomEvent<TrackingConsentState>).detail;
      if (detail) consentRef.current = detail;
    };
    window.addEventListener('fg:consent-changed', consentHandler);

    const onPush = (evt: Event): void => {
      const entry = (evt as CustomEvent<DataLayerEntry>).detail;
      if (!entry) return;
      fireSnapEvent(entry);
    };

    window.addEventListener('fg:datalayer-push', onPush);

    // Poll for pixel ID availability (PixelLoader injects async)
    const pollId = setInterval(() => {
      const pixelId = getPixelId();
      if (pixelId && !pixelIdAvailableRef.current) {
        pixelIdAvailableRef.current = true;
        clearInterval(pollId);
        const dataLayer = getDataLayer();
        for (const entry of dataLayer.recent(50)) {
          fireSnapEvent(entry);
        }
      }
    }, 200);

    // Also try immediately in case pixel is already available
    const pixelId = getPixelId();
    if (pixelId) {
      pixelIdAvailableRef.current = true;
      clearInterval(pollId);
      const dataLayer = getDataLayer();
      for (const entry of dataLayer.recent(50)) {
        fireSnapEvent(entry);
      }
    }

    return (): void => {
      window.removeEventListener('fg:consent-changed', consentHandler);
      window.removeEventListener('fg:datalayer-push', onPush);
      clearInterval(pollId);
    };
  }, []);

  function fireSnapEvent(entry: DataLayerEntry): void {
    if (processedRef.current.has(entry.event_id)) return;
    processedRef.current.add(entry.event_id);
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

    const pixelId = getPixelId();
    if (!pixelId) return;

    // Update Advanced Matching if user data is present
    const ud = entry.user_data;
    const identity = entry.identity;
    if (ud?.sha256_email_address || ud?.sha256_phone_number || identity?.email || identity?.phone) {
      const initParams: Record<string, unknown> = {};
      if (identity?.email) initParams.user_email = identity.email;
      if (identity?.phone) initParams.user_phone_number = identity.phone;
      if (ud?.sha256_email_address) initParams.user_hashed_email = ud.sha256_email_address;
      if (ud?.sha256_phone_number) initParams.user_hashed_phone_number = ud.sha256_phone_number;
      snaptr('init', pixelId, initParams);
    }

    const trackParams = buildClientParams(entry);
    snaptr('track', snapName, trackParams);
  }

  return null;
}