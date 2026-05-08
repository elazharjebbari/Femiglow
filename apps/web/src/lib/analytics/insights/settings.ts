/**
 * Settings d'orchestration du module Analytics Insights.
 * Stockés dans `tracking_settings` (KV JSONB déjà existant).
 *
 * Clés :
 *  - insights.refresh_enabled       boolean (default true)
 *  - insights.refresh_interval_min  5 | 10 | 15 | 30 | 60 (default 15)
 */
import { getTrackingSetting, setTrackingSetting } from '@/lib/db/queries/tracking/settings';

export const INSIGHTS_SETTING_KEYS = {
  REFRESH_ENABLED: 'insights.refresh_enabled',
  REFRESH_INTERVAL_MIN: 'insights.refresh_interval_min',
} as const;

const DEFAULT_INTERVAL = 15;
const ALLOWED_INTERVALS = [5, 10, 15, 30, 60];

export async function getInsightsRefreshEnabled(): Promise<boolean> {
  const v = await getTrackingSetting<unknown>(INSIGHTS_SETTING_KEYS.REFRESH_ENABLED, true);
  return Boolean(v);
}

export async function getInsightsRefreshInterval(): Promise<number> {
  const v = await getTrackingSetting<unknown>(
    INSIGHTS_SETTING_KEYS.REFRESH_INTERVAL_MIN,
    DEFAULT_INTERVAL,
  );
  const n = Number(v);
  if (!Number.isFinite(n) || !ALLOWED_INTERVALS.includes(n)) return DEFAULT_INTERVAL;
  return n;
}

export async function setInsightsRefreshEnabled(
  enabled: boolean,
  options: { actorId?: string | null } = {},
): Promise<void> {
  await setTrackingSetting(INSIGHTS_SETTING_KEYS.REFRESH_ENABLED, enabled, options);
}

export async function setInsightsRefreshInterval(
  minutes: number,
  options: { actorId?: string | null } = {},
): Promise<void> {
  if (!ALLOWED_INTERVALS.includes(minutes)) {
    throw new Error(`intervalMinutes invalide (autorisé : ${ALLOWED_INTERVALS.join(', ')})`);
  }
  await setTrackingSetting(INSIGHTS_SETTING_KEYS.REFRESH_INTERVAL_MIN, minutes, options);
}
