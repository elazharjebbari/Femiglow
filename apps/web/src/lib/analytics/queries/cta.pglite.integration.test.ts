// @vitest-environment node
/**
 * Test d'intégration — exerce le VRAI chemin SQL de getCtaData contre un Postgres
 * in-process (PGlite), sans base distante. Valide que le harnais reflète le path
 * neon/postgres-js, verrouille AF-02 (revenu MAD) côté SQL et F-SEC-01 (la requête
 * paramétrée gère une valeur arbitraire sans injection).
 * cf. docs/analytics-audit-qa-2026-05-30.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';

import { __resetTestDb, __setTestDb } from '@/lib/db/client';
import type { AnalyticsFilters } from '../filters';
import { getCtaData } from './cta';

let client: PGlite;
let db: ReturnType<typeof drizzlePglite>;

const FILTERS: AnalyticsFilters = {
  period: 'custom',
  device: 'all',
  traffic: 'all',
  from: '2026-05-01',
  to: '2026-05-31',
};
const NOW = new Date('2026-05-20T12:00:00Z');

beforeAll(async () => {
  client = new PGlite();
  // En prod, `drizzle.execute()` (neon-http / postgres-js) renvoie le tableau de
  // lignes ; drizzle-pglite renvoie `{ rows }`. On enveloppe pour que le harnais
  // reflète fidèlement le contrat de prod sur lequel s'appuient les queries.
  const raw = drizzlePglite(client);
  db = new Proxy(raw, {
    get(target, prop, recv) {
      if (prop === 'execute') {
        return async (q: unknown) => {
          const res = (await (target as unknown as {
            execute: (x: unknown) => Promise<unknown>;
          }).execute(q)) as { rows?: unknown[] } | unknown[];
          return Array.isArray(res) ? res : (res?.rows ?? []);
        };
      }
      return Reflect.get(target as object, prop, recv);
    },
  }) as ReturnType<typeof drizzlePglite>;
  await db.execute(
    sql.raw(`CREATE TABLE tracking_events_log (
      id text PRIMARY KEY, event_id text, event_name text, event_category text,
      page_id text, component_id text, page_route text, anonymous_id text,
      session_id text, user_id text, consent_snapshot jsonb, payload jsonb,
      ua_hash text, ip_anonymized text, device text, locale text,
      is_conversion boolean, providers_dispatched jsonb, providers_results jsonb,
      received_at timestamptz, schema_version integer, traffic_source text,
      traffic_medium text, experiment_id text, experiment_variant text
    );`),
  );
  await db.execute(
    sql.raw(`CREATE TABLE tracking_components (
      id text PRIMARY KEY, name text, path text, category text, description text,
      enabled boolean, default_params jsonb, created_at timestamptz,
      updated_at timestamptz, deleted_at timestamptz
    );`),
  );
  __setTestDb(db as unknown as Parameters<typeof __setTestDb>[0]);
});

afterAll(() => {
  __resetTestDb();
});

beforeEach(async () => {
  await db.execute(sql.raw('DELETE FROM tracking_events_log'));
  await db.execute(sql.raw('DELETE FROM tracking_components'));
});

async function insertComponent(id: string, label: string): Promise<void> {
  await db.execute(sql`INSERT INTO tracking_components
    (id, name, path, category, enabled, default_params, created_at, updated_at, deleted_at)
    VALUES (${id}, ${label}, '/kit', 'cta_primary', true,
            ${JSON.stringify({ label })}::jsonb, now(), now(), null)`);
}

async function insertEvent(o: {
  id: string;
  session: string;
  anon: string;
  name: string;
  componentId?: string | null;
  route?: string;
  at: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await db.execute(sql`INSERT INTO tracking_events_log
    (id, event_id, event_name, event_category, component_id, page_route,
     anonymous_id, session_id, consent_snapshot, payload, ua_hash, ip_anonymized,
     device, locale, is_conversion, providers_dispatched, providers_results,
     received_at, schema_version)
    VALUES (${o.id}, ${'e_' + o.id}, ${o.name}, 'ecommerce', ${o.componentId ?? null},
            ${o.route ?? '/kit'}, ${o.anon}, ${o.session},
            ${JSON.stringify({ analytics_storage: 'granted' })}::jsonb,
            ${JSON.stringify(o.payload ?? {})}::jsonb, 'ua', '0.0.0.0',
            'mobile', 'fr-FR', ${o.name === 'purchase'}, '[]'::jsonb, '{}'::jsonb,
            ${o.at}, 1)`);
}

describe('getCtaData — intégration PGlite (vrai chemin SQL)', () => {
  it('AF-02 — revenu attribué en MAD via la requête réelle', async () => {
    await insertComponent('c1', 'Acheter');
    await insertEvent({ id: '1', session: 's1', anon: 'a1', name: 'cta_impression', componentId: 'c1', at: '2026-05-20T09:00:00Z' });
    await insertEvent({ id: '2', session: 's1', anon: 'a1', name: 'cta_click', componentId: 'c1', at: '2026-05-20T09:01:00Z', payload: { cta_intent: 'purchase' } });
    await insertEvent({ id: '3', session: 's1', anon: 'a1', name: 'purchase', at: '2026-05-20T09:05:00Z', payload: { value: 199, currency: 'MAD' } });

    const data = await getCtaData(FILTERS, NOW);
    expect(data.totals.impressions).toBe(1);
    expect(data.totals.clicks).toBe(1);
    expect(data.totals.revenueAttributedCents).toBe(19900); // 199 MAD
    expect(data.rows.find((r) => r.componentId === 'c1')?.purchasesAttributed).toBe(1);
  });

  it('F-SEC-01 — une valeur de filtre arbitraire ne casse pas la requête ni la table', async () => {
    await insertComponent('c1', 'X');
    await insertEvent({ id: '1', session: 's1', anon: 'a1', name: 'cta_click', componentId: 'c1', at: '2026-05-20T09:00:00Z' });
    const filters = {
      ...FILTERS,
      device: "desktop'; DROP TABLE tracking_events_log;--",
    } as unknown as AnalyticsFilters;

    const data = await getCtaData(filters, NOW);
    expect(data.totals.clicks).toBe(0); // device ne matche aucune ligne
    const check = (await db.execute(
      sql.raw('SELECT count(*)::int AS n FROM tracking_events_log'),
    )) as unknown as Array<{ n: number }>;
    expect(check[0]?.n).toBe(1); // table intacte
  });
});
