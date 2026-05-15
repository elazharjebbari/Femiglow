/**
 * Server-side helpers pour la stratégie d'attribution.
 *
 * Source de vérité : `tracking_settings.attribution_strategy`. Lue en
 * SSR pour passer au TrackingProvider (qui l'injecte dans le
 * TrackingClient côté navigateur).
 */
import 'server-only';
import {
  getTrackingSetting,
  setTrackingSetting,
  TRACKING_SETTING_KEYS,
} from '@/lib/db/queries/tracking/settings';
import {
  ATTRIBUTION_STRATEGIES,
  DEFAULT_ATTRIBUTION_STRATEGY,
  type AttributionStrategy,
} from './types';

function isValidStrategy(value: unknown): value is AttributionStrategy {
  return typeof value === 'string' &&
    (ATTRIBUTION_STRATEGIES as readonly string[]).includes(value);
}

/**
 * Renvoie la stratégie active. Si pas de setting OU valeur corrompue,
 * retourne le défaut (`last_paid_touch`).
 */
export async function getAttributionStrategy(): Promise<AttributionStrategy> {
  try {
    const raw = await getTrackingSetting<string>(
      TRACKING_SETTING_KEYS.ATTRIBUTION_STRATEGY,
      DEFAULT_ATTRIBUTION_STRATEGY,
    );
    if (isValidStrategy(raw)) return raw;
    return DEFAULT_ATTRIBUTION_STRATEGY;
  } catch {
    return DEFAULT_ATTRIBUTION_STRATEGY;
  }
}

/**
 * Persiste une nouvelle stratégie. Lève si la valeur n'est pas
 * supportée. `actorId` est tracé dans la table settings pour l'audit.
 */
export async function setAttributionStrategy(
  strategy: AttributionStrategy,
  options: { actorId?: string } = {},
): Promise<void> {
  if (!isValidStrategy(strategy)) {
    throw new Error(`invalid_attribution_strategy:${String(strategy)}`);
  }
  await setTrackingSetting(
    TRACKING_SETTING_KEYS.ATTRIBUTION_STRATEGY,
    strategy,
    { actorId: options.actorId },
  );
}
