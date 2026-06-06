// @vitest-environment jsdom
/**
 * P0.2 — CONFORMITÉ DES CONTRATS (gate G9) : chaque réponse nominale des
 * handlers MSW emails DOIT parser avec son schéma wire de prod
 * (`lib/mail/wire-schemas.ts`). Un mock qui dérive du contrat réel casse ICI,
 * avant de faire mentir un seul test composant.
 *
 * jsdom (et pas node) : les handlers utilisent des chemins RELATIFS — même
 * convention que emails-handlers.smoke.test.ts.
 *
 * Pendant F02..F10, chaque nouvelle route ajoute SA ligne au tableau (et son
 * pendant intégration valide la route réelle contre le MÊME schéma).
 * Réf : technique/05-strategie-tests.md §3.2 ; modèle : technique/modeles-code/.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { server } from '@/test/msw/server';
import { emailsHandlers } from '@/test/msw/emails-handlers';
import {
  BulkRetryResponseWire,
  BulkSuppressResponseWire,
  NavCountersResponseWire,
  ReapStuckResponseWire,
  SearchResponseWire,
  SummaryResponseWire,
  SuppressionListResponseWire,
  SuppressionRemoveResponseWire,
} from '@/lib/mail/wire-schemas';

type ContractCase = {
  name: string;
  request: () => Promise<Response>;
  schema: z.ZodTypeAny;
};

const post = (path: string, payload: unknown) =>
  fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

const CONTRACTS: ContractCase[] = [
  {
    name: 'POST transactional/search',
    request: () =>
      post('/api/admin/emails/transactional/search', {
        filters: [],
        freetext: '',
        pagination: { limit: 50, offset: 0 },
      }),
    schema: SearchResponseWire,
  },
  {
    name: 'GET transactional/summary?window=24h',
    request: () => fetch('/api/admin/emails/transactional/summary?window=24h'),
    schema: SummaryResponseWire,
  },
  {
    name: 'POST transactional/bulk-retry',
    request: () => post('/api/admin/emails/transactional/bulk-retry', { ids: ['out_1'] }),
    schema: BulkRetryResponseWire,
  },
  {
    name: 'POST transactional/bulk-suppress',
    request: () => post('/api/admin/emails/transactional/bulk-suppress', { ids: ['out_1'] }),
    schema: BulkSuppressResponseWire,
  },
  {
    name: 'POST transactional/reap-stuck',
    request: () => post('/api/admin/emails/transactional/reap-stuck', {}),
    schema: ReapStuckResponseWire,
  },
  {
    name: 'GET suppression (liste)',
    request: () => fetch('/api/admin/emails/suppression?limit=50&offset=0'),
    schema: SuppressionListResponseWire,
  },
  {
    name: 'DELETE suppression',
    request: () =>
      fetch('/api/admin/emails/suppression', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'bounce@exemple.test' }),
      }),
    schema: SuppressionRemoveResponseWire,
  },
  {
    name: 'GET nav-counters (contrat amont F02)',
    request: () => fetch('/api/admin/emails/nav-counters'),
    schema: NavCountersResponseWire,
  },
];

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Conformité contrats — handlers MSW ↔ schémas wire de prod (G9)', () => {
  it.each(CONTRACTS)('$name : la réponse nominale du mock parse avec le schéma wire', async ({ request, schema }) => {
    server.use(...emailsHandlers);
    const res = await request();
    expect(res.ok).toBe(true);

    const body: unknown = await res.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      // Échec exploitable en triage : chemin + raison, pas un dump Zod brut.
      throw new Error(
        `Le handler MSW a dérivé du contrat wire :\n${parsed.error.issues
          .map((i) => `  · ${i.path.join('.') || '(racine)'} : ${i.message}`)
          .join('\n')}\nReçu : ${JSON.stringify(body).slice(0, 400)}`,
      );
    }
  });
});
