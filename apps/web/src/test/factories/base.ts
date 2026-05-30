/**
 * Base factory helper — pattern défini pour tous les factories test.
 *
 * Référence : `docs/test-strategy-2026-05/03-data-strategy.md`
 *
 * Pattern :
 *  - `defineFactory(defaults)` retourne un Factory<T> typé
 *  - `build(overrides)` retourne T avec defaults + overrides shallow-merged
 *  - `buildMany(n, overrides)` retourne T[] avec defaults
 *  - `buildList(overrides[])` retourne T[] avec overrides par item
 *
 * Convention :
 *  - Defaults toujours **valides** (Zod schema parse OK)
 *  - Defaults **déterministes** quand testé avec `vi.useFakeTimers()`
 *  - Counter scoped (reset via afterEach si besoin)
 */

export interface Factory<T> {
  /** Build une instance avec defaults + overrides shallow. */
  build(overrides?: Partial<T>): T;
  /** Build N instances identiques (peuvent diverger via counter interne). */
  buildMany(count: number, overrides?: Partial<T>): T[];
  /** Build une liste avec overrides individuels. */
  buildList(overrides: Array<Partial<T>>): T[];
}

/**
 * Crée une factory typée.
 *
 * @param defaults Function qui retourne les defaults (lazy — appelée à chaque build)
 * @returns Factory<T> avec build/buildMany/buildList
 *
 * @example
 * ```ts
 * const orderFactory = defineFactory<Order>(() => ({
 *   id: 'ord_' + Math.random().toString(36).slice(2, 10),
 *   total: 19900,
 *   currency: 'MAD',
 * }));
 *
 * const order = orderFactory.build({ total: 99900 });
 * const orders = orderFactory.buildMany(3);
 * ```
 */
export function defineFactory<T extends object>(
  defaults: () => T,
): Factory<T> {
  return {
    build(overrides = {}) {
      return { ...defaults(), ...overrides };
    },
    buildMany(count, overrides) {
      return Array.from({ length: count }, () => this.build(overrides));
    },
    buildList(overrides) {
      return overrides.map((o) => this.build(o));
    },
  };
}

/**
 * Counter scoped pour génération d'IDs uniques.
 *
 * @example
 * ```ts
 * const counter = createCounter();
 * const id = () => `ord_${counter.next()}`;
 * ```
 */
export function createCounter(start = 0): { next(): number; reset(): void } {
  let value = start;
  return {
    next: () => ++value,
    reset: () => {
      value = start;
    },
  };
}

/**
 * Génère un ID stable + court pour les tests.
 * Format : `<prefix>_<timestamp>_<random>` — short enough for debug.
 */
export function testId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
