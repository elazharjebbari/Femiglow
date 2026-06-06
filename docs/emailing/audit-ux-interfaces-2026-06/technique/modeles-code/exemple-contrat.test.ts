/**
 * MODÈLE — test de CONFORMITÉ DE CONTRAT (05-strategie-tests.md §3.2).
 *
 * Problème visé : un handler MSW qui dérive du backend réel fait passer des
 * tests composant sur un mensonge. Parade : le handler ET la route partagent
 * le MÊME schéma Zod ; ce test force la réponse du mock à parser avec le
 * schéma de PROD. Toute évolution de contrat casse d'abord ici.
 *
 * À dupliquer pour CHAQUE endpoint touché par le programme (gate G9).
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'vitest';
import { server } from '@/test/msw/server';
import { emailsHandlers } from '@/test/msw/emails-handlers';
import { z } from 'zod';

// ── Schémas de PROD (source de vérité unique — lib/mail/**/schemas.ts).
// Exemple sur le contrat de recherche du cockpit ; remplacer par l'import réel
// du schéma de l'endpoint testé.
import {
  OutboxSearchResponseSchema, // { rows, total, window }
} from '@/lib/mail/transactional/schemas';

const ENDPOINTS: Array<{
  name: string;
  request: () => Promise<Response>;
  schema: z.ZodTypeAny;
}> = [
  {
    name: 'POST /api/admin/emails/transactional/search',
    request: () =>
      fetch('/api/admin/emails/transactional/search', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filters: {}, freetext: '', pagination: { limit: 50, offset: 0 } }),
      }),
    schema: OutboxSearchResponseSchema,
  },
  // … 1 entrée par endpoint du chantier (summary, export, suppression, dry-run…)
];

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Conformité contrat — handlers MSW vs schémas Zod de prod', () => {
  it.each(ENDPOINTS)('F00-U-9xx — $name : la réponse du mock parse avec le schéma de prod', async ({ request, schema }) => {
    server.use(...emailsHandlers);
    const res = await request();
    expect(res.ok).toBe(true);

    const body = await res.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      // Message d'échec exploitable en triage : chemin + attendu.
      throw new Error(
        `Le handler MSW a dérivé du contrat de prod :\n${parsed.error.issues
          .map((i) => `  · ${i.path.join('.')}: ${i.message}`)
          .join('\n')}`,
      );
    }
  });
});

/**
 * Variante INTÉGRATION (node + femiglow_test) : même table d'endpoints, mais
 * `request()` appelle la vraie route (supertest/fetch sur l'app testée) et on
 * vérifie en plus : 401 sans session admin, 422 sur payload invalide (avec
 * détail), audit-log émis. Cf. fonctionnalites/Fxx/03-batterie-tests.csv
 * couche I.
 */
