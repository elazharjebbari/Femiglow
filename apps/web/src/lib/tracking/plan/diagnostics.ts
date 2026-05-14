/**
 * Diagnostics de drift entre un TrackingPlan actif et la réalité observée
 * dans le tracking events log.
 *
 * Le module est volontairement pur : il consomme un plan + une liste de
 * noms d'événements observés et retourne un rapport structuré. Le câblage
 * data (DB / memoryStore) est fait côté page.
 */
import type { TrackingPlan } from './types';

export interface DriftReport {
  /** Plan ID inspecté. */
  planId: string;
  /** Fenêtre temporelle des observations (ISO). */
  windowStart: string;
  windowEnd: string;
  /** Nombre d'événements log examinés. */
  observedSampleSize: number;
  /** Événements déclarés au plan mais jamais vus sur la fenêtre. */
  declaredMissing: ReadonlyArray<{ key: string; providers: string[] }>;
  /** Événements vus mais non déclarés au plan (orphelins). */
  orphans: ReadonlyArray<{ key: string; observedCount: number }>;
  /** Événements OK (vus + déclarés). */
  covered: ReadonlyArray<{ key: string; observedCount: number }>;
}

export interface ObservedEvent {
  eventName: string;
  count: number;
}

export function computeDrift(input: {
  plan: TrackingPlan;
  observed: ReadonlyArray<ObservedEvent>;
  windowStart: Date;
  windowEnd: Date;
}): DriftReport {
  const declared = new Map<string, string[]>();
  for (const ev of input.plan.events) {
    const enabledProviders = Object.entries(ev.providers)
      .filter(([, on]) => on === true)
      .map(([id]) => id);
    declared.set(ev.key, enabledProviders);
  }

  const observed = new Map<string, number>();
  for (const o of input.observed) observed.set(o.eventName, o.count);

  const declaredMissing: Array<{ key: string; providers: string[] }> = [];
  const covered: Array<{ key: string; observedCount: number }> = [];
  for (const [key, providers] of declared) {
    const count = observed.get(key);
    if (count === undefined || count === 0) {
      declaredMissing.push({ key, providers });
    } else {
      covered.push({ key, observedCount: count });
    }
  }

  const orphans: Array<{ key: string; observedCount: number }> = [];
  for (const [name, count] of observed) {
    if (!declared.has(name)) orphans.push({ key: name, observedCount: count });
  }

  return {
    planId: input.plan.id,
    windowStart: input.windowStart.toISOString(),
    windowEnd: input.windowEnd.toISOString(),
    observedSampleSize: input.observed.reduce((sum, o) => sum + o.count, 0),
    declaredMissing: declaredMissing.sort((a, b) => a.key.localeCompare(b.key)),
    orphans: orphans.sort((a, b) => b.observedCount - a.observedCount),
    covered: covered.sort((a, b) => b.observedCount - a.observedCount),
  };
}
