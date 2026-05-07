'use client';

import type { CheckoutForm } from '@/lib/schemas';

export const CHECKOUT_DRAFT_KEY = 'checkout-draft';

const SENSITIVE_KEYS = new Set([
  'cardNumber',
  'cvc',
  'cvv',
  'expiry',
  'expMonth',
  'expYear',
  'cardholderName',
]);

function stripSensitive<T>(value: T): T {
  if (Array.isArray(value)) return value.map((v) => stripSensitive(v)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(key)) continue;
      out[key] = stripSensitive(child);
    }
    return out as unknown as T;
  }
  return value;
}

export type CheckoutDraft = Partial<CheckoutForm> & { savedAt: string };

export function saveCheckoutDraft(values: Partial<CheckoutForm>): void {
  if (typeof window === 'undefined') return;
  try {
    const safe = stripSensitive(values);
    const draft: CheckoutDraft = { ...safe, savedAt: new Date().toISOString() };
    window.localStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* localStorage indisponible — silencieux */
  }
}

export function readCheckoutDraft(): CheckoutDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CHECKOUT_DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CheckoutDraft;
  } catch {
    return null;
  }
}

export function clearCheckoutDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CHECKOUT_DRAFT_KEY);
  } catch {
    /* silencieux */
  }
}

export const LAST_ORDER_PREFIX = 'last-order:';

export interface LastOrderPayload {
  orderId: string;
  firstName: string;
  email: string;
  items: Array<{
    productId: string;
    productSlug: string;
    productName: string;
    quantity: number;
    unitPriceCents: number;
    imageSrc?: string;
    imageAlt?: string;
  }>;
  subtotal: number;
  shipping: number;
  total: number;
  address: CheckoutForm['address'];
  paymentMethod: CheckoutForm['paymentMethod'];
  createdAt: string;
}

export function saveLastOrder(payload: LastOrderPayload): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      `${LAST_ORDER_PREFIX}${payload.orderId}`,
      JSON.stringify(payload),
    );
  } catch {
    /* silencieux */
  }
}

export function readLastOrder(orderId: string): LastOrderPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`${LAST_ORDER_PREFIX}${orderId}`);
    if (!raw) return null;
    return JSON.parse(raw) as LastOrderPayload;
  } catch {
    return null;
  }
}
