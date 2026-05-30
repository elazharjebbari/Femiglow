/**
 * Cache court **opt-in** pour les queries analytics (finding F-PERF-04).
 *
 * Désactivé par défaut (TTL 0) → la fraîcheur temps réel est préservée pour
 * l'opérateur (aucun changement de comportement). Activable en prod via
 * `ANALYTICS_CACHE_TTL_MS` (millisecondes) pour amortir les recalculs lors de
 * navigations rapprochées sur la même sélection de filtres.
 *
 * Hypothèse : la clé inclut les filtres ; pour les périodes relatives (today…),
 * la fenêtre est stable intra-journée, donc un cache de quelques dizaines de
 * secondes ne dérive pas. cf. docs/analytics-audit-qa-2026-05-30.
 */
const store = new Map<string, { at: number; value: unknown }>();

function ttlMs(): number {
  const raw = Number(process.env.ANALYTICS_CACHE_TTL_MS ?? 0);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

/** Retourne la valeur en cache si TTL actif et entrée fraîche, sinon `null`. */
export function getCachedAnalytics<T>(key: string, now: number = Date.now()): T | null {
  const ttl = ttlMs();
  if (ttl <= 0) return null;
  const hit = store.get(key);
  if (hit && now - hit.at < ttl) return hit.value as T;
  return null;
}

/** Mémorise une valeur (no-op si le cache est désactivé). */
export function setCachedAnalytics(key: string, value: unknown, now: number = Date.now()): void {
  if (ttlMs() <= 0) return;
  store.set(key, { at: now, value });
}

/** Tests uniquement — vide le cache. */
export function __clearAnalyticsCache(): void {
  store.clear();
}
