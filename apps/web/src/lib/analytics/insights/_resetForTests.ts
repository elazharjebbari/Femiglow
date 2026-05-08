/**
 * Vide les tables insights_* pour les tests.
 * Ne s'utilise qu'en test (NODE_ENV=test ou VITEST=true).
 */
import { db, memoryStore, schema } from '@/lib/db/client';

export async function _resetInsightsForTests(): Promise<void> {
  if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
    throw new Error('_resetInsightsForTests doit être appelé uniquement en test');
  }
  const drizzle = db();
  if (drizzle) {
    await drizzle.delete(schema.insightsEventDaily);
    await drizzle.delete(schema.insightsPageDaily);
    await drizzle.delete(schema.insightsComponentDaily);
    await drizzle.delete(schema.insightsSectionDaily);
    await drizzle.delete(schema.insightsFunnelDaily);
    await drizzle.delete(schema.insightsRefreshRun);
  } else {
    const store = memoryStore();
    store.insightsEventDaily.clear();
    store.insightsPageDaily.clear();
    store.insightsComponentDaily.clear();
    store.insightsSectionDaily.clear();
    store.insightsFunnelDaily.clear();
    store.insightsRefreshRun.clear();
  }
}
