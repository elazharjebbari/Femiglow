/**
 * D-005 — Catégorisation Google Ads des events (hybride code + override DB).
 *
 * Source de vérité : code (catalog par défaut). Les admins peuvent override
 * un événement individuellement via la table `tracking_event_overrides`.
 *
 * Cf. docs/tracking-improvement/00-overview/success-criteria.md C3.T.2.
 */

import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db/client';

export const GOOGLE_ADS_CATEGORIES = [
  'purchase',
  'lead',
  'contact',
  'signup',
  'view_content',
  'none',
] as const;

export type GoogleAdsCategory = (typeof GOOGLE_ADS_CATEGORIES)[number];

/**
 * Catégorisation par défaut (code-side). Aligne avec le seed SQL de la
 * migration 0029. Les events absents tombent sur 'none'. Garder en sync
 * avec `apps/web/drizzle/migrations/0029_tracking_event_category_default.sql`.
 */
export const EVENT_DEFAULT_GOOGLE_ADS_CATEGORY: Readonly<Record<string, GoogleAdsCategory>> =
  Object.freeze({
    purchase: 'purchase',
    begin_checkout: 'purchase',
    lead_capture: 'lead',
    generate_lead: 'lead',
    sign_up: 'signup',
    contact_submit: 'contact',
    newsletter_submit: 'contact',
    chat_lead_form_submit: 'lead',
    view_item: 'view_content',
    view_item_list: 'view_content',
  });

export function getEventCategoryDefault(eventName: string): GoogleAdsCategory {
  return EVENT_DEFAULT_GOOGLE_ADS_CATEGORY[eventName] ?? 'none';
}

/**
 * Résout la catégorie Google Ads d'un event : override DB > default code.
 * Pas de cache global ici — le dispatcher cache le résultat pour la durée
 * d'une requête. Tests : `categorization.test.ts`.
 */
export async function resolveEventCategory(
  eventName: string,
): Promise<GoogleAdsCategory> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select({ category: schema.trackingEventOverrides.googleAdsCategory })
      .from(schema.trackingEventOverrides)
      .where(eq(schema.trackingEventOverrides.eventName, eventName))
      .limit(1);
    if (rows[0]) return rows[0].category as GoogleAdsCategory;
  }
  // Pas de drizzle (tests sans DB) → on tombe sur le default code.
  // Les tests d'intégration override flow utilisent la DB réelle.
  return getEventCategoryDefault(eventName);
}
