import { eq } from 'drizzle-orm';
import { db, memoryStore, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import type { TrackingSetting } from '@/lib/db/types';

/**
 * KV simple pour les flags globaux du tracking (bandeau cookies activé,
 * mode test, etc). On stocke la valeur en JSON pour rester souple :
 * un boolean, un objet, un enum… selon le besoin.
 */

function rowToSetting<T>(
  row: typeof schema.trackingSettings.$inferSelect,
): TrackingSetting<T> {
  return {
    id: row.id,
    key: row.key,
    value: row.value as T,
    updatedAt: row.updatedAt,
    updatedBy: row.updatedBy ?? null,
  };
}

export async function getTrackingSetting<T>(
  key: string,
  defaultValue: T,
): Promise<T> {
  const drizzle = db();
  if (drizzle) {
    const rows = await drizzle
      .select()
      .from(schema.trackingSettings)
      .where(eq(schema.trackingSettings.key, key))
      .limit(1);
    if (rows[0]) return rowToSetting<T>(rows[0]).value;
    return defaultValue;
  }
  for (const setting of memoryStore().trackingSettings.values()) {
    if (setting.key === key) return setting.value as T;
  }
  return defaultValue;
}

export async function setTrackingSetting<T>(
  key: string,
  value: T,
  options: { actorId?: string | null } = {},
): Promise<TrackingSetting<T>> {
  const now = new Date();
  const drizzle = db();
  if (drizzle) {
    const existing = await drizzle
      .select()
      .from(schema.trackingSettings)
      .where(eq(schema.trackingSettings.key, key))
      .limit(1);
    if (existing[0]) {
      await drizzle
        .update(schema.trackingSettings)
        .set({
          value: value as never,
          updatedAt: now,
          updatedBy: options.actorId ?? null,
        })
        .where(eq(schema.trackingSettings.id, existing[0].id));
      return {
        id: existing[0].id,
        key,
        value,
        updatedAt: now,
        updatedBy: options.actorId ?? null,
      };
    }
    const id = createId('tset');
    await drizzle.insert(schema.trackingSettings).values({
      id,
      key,
      value: value as never,
      updatedAt: now,
      updatedBy: options.actorId ?? null,
    });
    return { id, key, value, updatedAt: now, updatedBy: options.actorId ?? null };
  }
  // memoryStore fallback
  for (const [id, setting] of memoryStore().trackingSettings) {
    if (setting.key === key) {
      const updated: TrackingSetting<T> = {
        id,
        key,
        value,
        updatedAt: now,
        updatedBy: options.actorId ?? null,
      };
      memoryStore().trackingSettings.set(id, updated);
      return updated;
    }
  }
  const id = createId('tset');
  const created: TrackingSetting<T> = {
    id,
    key,
    value,
    updatedAt: now,
    updatedBy: options.actorId ?? null,
  };
  memoryStore().trackingSettings.set(id, created);
  return created;
}

/* Clés de configuration connues */
export const TRACKING_SETTING_KEYS = {
  /** Bandeau de consentement actif (true par défaut, désactivable selon juridiction) */
  CONSENT_BANNER_ENABLED: 'consent_banner_enabled',
  /** État de consentement par défaut quand le bandeau est désactivé */
  CONSENT_DEFAULT_GRANTED: 'consent_default_granted',
  /**
   * Stratégie d'attribution multi-canal. Cf.
   * docs/tracking-attribution/ + `lib/tracking/attribution/types.ts`.
   * Valeurs : 'last_paid_touch' | 'first_paid_touch' | 'last_touch' |
   *          'first_touch' | 'broadcast'
   * Défaut runtime si absente : 'last_paid_touch' (recommandé).
   */
  ATTRIBUTION_STRATEGY: 'attribution_strategy',
  /** Envoi automatique du webhook quand le wizard valide l'adresse. */
  LEAD_STEP2_WEBHOOK_ENABLED: 'lead.step2_webhook_enabled',
  /** Scan cron des leads ayant fourni nom + téléphone sans adresse. */
  LEAD_STEP1_ABANDON_ENABLED: 'lead.step1_abandon_enabled',
  /** Délai avant webhook d'abandon step 1, en minutes. */
  LEAD_STEP1_ABANDON_TIMEOUT_MINUTES: 'lead.step1_abandon_timeout_minutes',
  /** Inclusion du transcript chat dans les payloads lead. */
  LEAD_WEBHOOK_CONVERSATION_ENABLED: 'lead.webhook_conversation_enabled',
  /** Nombre max de messages envoyés dans `conversation`. */
  LEAD_WEBHOOK_CONVERSATION_MAX_MESSAGES: 'lead.webhook_conversation_max_messages',
  /** Budget max approximatif du champ `conversation`, en bytes UTF-8. */
  LEAD_WEBHOOK_CONVERSATION_MAX_BYTES: 'lead.webhook_conversation_max_bytes',
  /** Webhook immédiat pour les leads inline-contact (numéro détecté dans le chat). */
  LEAD_INLINE_CONTACT_WEBHOOK_ENABLED: 'lead.inline_contact_webhook_enabled',
} as const;
