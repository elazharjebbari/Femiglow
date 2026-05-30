/**
 * Cache court des queries analytics (findings F-PERF-04 + approche « snapshot »
 * des longues fenêtres validée 2026-05-30).
 *
 * Stratégie de fraîcheur, décidée par `analyticsCacheTtlMs(range)` :
 *  - **Longues fenêtres (≥ 30 j)** : snapshotées par défaut (TTL `LONG_WINDOW`),
 *    car coûteuses à recalculer et peu volatiles → l'opérateur les rafraîchit
 *    à la demande via le bouton « Rafraîchir » (qui vide ce cache).
 *  - **Courtes fenêtres** (today…7d, custom < 30 j) : temps réel par défaut
 *    (TTL 0), activables via `ANALYTICS_CACHE_TTL_MS` pour amortir.
 *
 * Les chiffres restent **exacts** (calcul session-level complet) : le cache ne
 * fait que mémoriser le résultat, il ne l'approxime pas.
 * cf. docs/analytics-audit-qa-2026-05-30.
 */
const store = new Map<string, { at: number; value: unknown }>();

const DAY_MS = 86_400_000;
const LONG_WINDOW_DAYS = 30;
const DEFAULT_LONG_WINDOW_TTL_MS = 300_000; // 5 min

function envInt(name: string): number {
  const raw = Number(process.env[name] ?? 0);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

/**
 * TTL (ms) à appliquer pour une fenêtre donnée. 0 = pas de cache (temps réel).
 * Surcharges : `ANALYTICS_CACHE_TTL_MS` (courtes fenêtres),
 * `ANALYTICS_LONG_WINDOW_CACHE_TTL_MS` (longues fenêtres).
 */
export function analyticsCacheTtlMs(range: { from: Date; to: Date }): number {
  const spanDays = (range.to.getTime() - range.from.getTime()) / DAY_MS;
  if (spanDays >= LONG_WINDOW_DAYS) {
    return envInt('ANALYTICS_LONG_WINDOW_CACHE_TTL_MS') || DEFAULT_LONG_WINDOW_TTL_MS;
  }
  return envInt('ANALYTICS_CACHE_TTL_MS');
}

/** Retourne la valeur en cache si TTL > 0 et entrée fraîche, sinon `null`. */
export function getCachedAnalytics<T>(
  key: string,
  ttlMs: number,
  now: number = Date.now(),
): T | null {
  if (ttlMs <= 0) return null;
  const hit = store.get(key);
  if (hit && now - hit.at < ttlMs) return hit.value as T;
  return null;
}

/** Mémorise une valeur (no-op si TTL ≤ 0). */
export function setCachedAnalytics(
  key: string,
  value: unknown,
  ttlMs: number,
  now: number = Date.now(),
): void {
  if (ttlMs <= 0) return;
  store.set(key, { at: now, value });
}

/** Vide tout le cache analytics (utilisé par le refresh manuel admin). */
export function clearAnalyticsCache(): void {
  store.clear();
}

/** Alias test. */
export const __clearAnalyticsCache = clearAnalyticsCache;
