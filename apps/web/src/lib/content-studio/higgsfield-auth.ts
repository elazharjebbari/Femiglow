import { env } from '@/lib/env';

/**
 * Helpers d'authentification Higgsfield.
 *
 * L'API officielle (https://platform.higgsfield.ai) attend un credential en
 * DEUX parties au format `KEY_ID:KEY_SECRET` via l'en-tête
 * `Authorization: Key KEY_ID:KEY_SECRET`.
 *
 * L'ancienne intégration ciblait `api.higgsfield.ai/v1` avec
 * `Authorization: Bearer <clé>` — host mort (HTTP 522) et schéma d'auth
 * incorrect. Ces helpers centralisent la résolution correcte.
 *
 * NOTE : les CHEMINS d'endpoints (text2image / image2video / requests/{id}/status)
 * et le modèle asynchrone (submit + polling) restent à réécrire et à valider
 * avec un credential complet. Voir image-generation.ts / video-generation.ts.
 */

/** Base URL de l'API Higgsfield, sans slash final. */
export function higgsfieldBaseUrl(): string {
  return env.AI_ENGINE_HIGGSFIELD_BASE_URL.replace(/\/$/, '');
}

/**
 * Construit le credential `KEY_ID:KEY_SECRET`.
 * - Si la clé contient déjà un `:`, on la considère complète.
 * - Sinon on la combine avec le secret fourni séparément.
 * Retourne null si le credential est incomplet (clé seule sans secret).
 */
export function higgsfieldCredential(): string | null {
  const key = env.AI_ENGINE_HIGGSFIELD_API_KEY?.trim();
  if (!key) return null;
  if (key.includes(':')) return key;
  const secret = env.AI_ENGINE_HIGGSFIELD_API_SECRET?.trim();
  if (!secret) return null;
  return `${key}:${secret}`;
}

/** En-tête Authorization au format attendu par Higgsfield, ou null si incomplet. */
export function higgsfieldAuthHeader(): string | null {
  const credential = higgsfieldCredential();
  return credential ? `Key ${credential}` : null;
}
