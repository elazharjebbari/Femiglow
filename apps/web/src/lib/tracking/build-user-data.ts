/**
 * Construction de `user_data` (Enhanced Conversions Google Ads / Advanced
 * Matching Meta) côté navigateur, partagée entre tous les emitters de lead
 * (wizard checkout, formulaire chat, Mode B…).
 *
 * Filtre l'identity sur les champs autorisés par le mapping de l'event
 * (`event-mapping.ts → identityFields`), hashe en SHA-256 dans le navigateur
 * (`hashIdentityBrowser`), et renvoie `undefined` si rien à hasher (event sans
 * identity, ou SubtleCrypto indisponible — on n'attache rien mais on ne casse
 * jamais l'emit).
 */
import { getEventIdentityFields } from '@/lib/tracking/providers/event-mapping';
import { hashIdentityBrowser } from '@/lib/tracking/providers/hashing-browser';

export interface TrackingIdentity {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  city?: string;
  country?: string;
}

export async function buildUserDataForEvent(
  eventName: string,
  identity: TrackingIdentity,
): Promise<Record<string, unknown> | undefined> {
  const fields = getEventIdentityFields(eventName);
  if (fields.length === 0) return undefined;
  const filtered: TrackingIdentity = {};
  for (const f of fields) {
    const v = identity[f];
    if (v) (filtered as Record<string, string>)[f] = v;
  }
  if (Object.keys(filtered).length === 0) return undefined;
  try {
    const hashed = await hashIdentityBrowser(filtered);
    return hashed as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
