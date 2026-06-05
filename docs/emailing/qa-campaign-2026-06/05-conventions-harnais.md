# Conventions & harnais de test — code de référence

> Code fonctionnel de référence pour la phase 0. À déposer tel quel (chemins
> indiqués), puis importé par tous les specs des modules. Aligné sur l'outillage
> existant du repo : Vitest 2, MSW 2.14, Testing Library 16, Playwright 1.48.

## 1. Serveur MSW partagé — `apps/web/src/test/msw/server.ts`

```ts
/**
 * Serveur MSW partagé pour les tests composant de la section emails.
 * Handlers par défaut = réponses nominales réalistes; chaque test
 * override via `server.use(...)` pour les cas d'échec.
 */
import { setupServer } from 'msw/node';
import { defaultEmailHandlers } from './handlers/emails';

export const server = setupServer(...defaultEmailHandlers);

// À référencer dans vitest.setup.ts (ou setupFiles du projet) :
//   beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
//   afterEach(() => server.resetHandlers());
//   afterAll(() => server.close());
// `onUnhandledRequest: 'error'` est OBLIGATOIRE : tout appel réseau non
// modélisé fait échouer le test au lieu de passer silencieusement.
```

## 2. Handlers par défaut — `apps/web/src/test/msw/handlers/emails.ts`

```ts
import { http, HttpResponse, delay } from 'msw';
import { makeOutboxRow, makeSummary } from '../../factories/emails';

export const defaultEmailHandlers = [
  http.post('/api/admin/emails/transactional/search', () =>
    HttpResponse.json({
      rows: Array.from({ length: 50 }, (_, i) => makeOutboxRow({ seq: i })),
      total: 1234,
      window: 'exact',
    }),
  ),
  http.get('/api/admin/emails/transactional/summary', () =>
    HttpResponse.json(makeSummary()),
  ),
  http.post('/api/admin/emails/transactional/bulk-retry', () =>
    HttpResponse.json({ retried: 0, skipped: 0, skippedIds: [] }),
  ),
  http.post('/api/admin/emails/transactional/bulk-suppress', () =>
    HttpResponse.json({ suppressed: 0, skipped: 0 }),
  ),
  // … un handler par route de l'inventaire (01-inventaire CSV, colonne surface=API)
];

/** Grille d'échecs standard — à utiliser dans CHAQUE suite composant. */
export const failWith = {
  unauthorized: (url: string) =>
    http.post(url, () => HttpResponse.json({ error: 'unauthorized' }, { status: 401 })),
  validation: (url: string, detail = 'invalid ids') =>
    http.post(url, () => HttpResponse.json({ error: 'validation', detail }, { status: 422 })),
  serverError: (url: string) =>
    http.post(url, () => HttpResponse.json({ error: 'internal' }, { status: 500 })),
  hang: (url: string) => http.post(url, async () => { await delay('infinite'); }),
  network: (url: string) => http.post(url, () => HttpResponse.error()),
};
```

## 3. Factories — `apps/web/src/test/factories/emails.ts`

```ts
/**
 * Factories déterministes (seed par défaut) à valeurs réalistes Maroc.
 * Chaque factory accepte un Partial<T> d'overrides.
 */
import type { EmailOutboxRow } from '@/lib/db/schema-emails';

let counter = 0;
const nid = (p: string) => `${p}_${(++counter).toString(36).padStart(8, '0')}`;

export function makeOutboxRow(over: Partial<EmailOutboxRow> & { seq?: number } = {}) {
  const { seq = 0, ...rest } = over;
  return {
    id: nid('eo'),
    idempotencyKey: nid('idem'),
    template: 'order-confirmation',
    templateVersion: 1,
    toEmail: `client${seq}@exemple.test`,
    toName: ['Kaoutar', 'Loutfi', 'Nourelhouda', 'Yassine'][seq % 4],
    fromEmail: 'info@femiglow-maroc.com',
    subject: `Confirmation commande o_test${seq}`,
    payloadJson: { firstName: 'Kaoutar', orderId: `o_test${seq}`, orderTotal: '199.00 MAD', itemsCount: 1, deliveryEstimate: '2-4 jours ouvrés' },
    htmlSnapshot: '<html>…</html>',
    textSnapshot: '…',
    status: 'sent' as const,
    attempts: 1,
    maxAttempts: 5,
    nextRetry: null,
    lastError: null,
    smtpMessageId: `<msg-${seq}@femiglow-maroc.com>`,
    createdAt: new Date('2026-06-01T10:00:00Z'),
    updatedAt: new Date('2026-06-01T10:00:05Z'),
    ...rest,
  };
}

export function makeSummary(over: Record<string, unknown> = {}) {
  return {
    kpis: { sent7d: 120, delivered7d: 108, failed7d: 4, queuedNow: 2 },
    comparison: { sentPct: 12, deliveredPct: 9, failedPct: -20 },
    sparklines: { sent: [10, 14, 18, 22, 19, 21, 16], delivered: [9, 13, 16, 20, 18, 19, 13] },
    ...over,
  };
}

// + makeAutomation(), makeAutomationRun(), makeAudience(), makeSnapshot(),
//   makeCampaignLink(), makeSuppression(), makeStalwartEvent(), makeListmonkEvent()
//   — mêmes principes; champs alignés sur schema-emails.ts (source de vérité).
```

## 4. Harnais DB de test — `apps/web/src/test/db/setup.ts`

```ts
/**
 * Postgres de test : vraies migrations drizzle, troncature entre tests.
 * Couche qui attrape les drifts de schéma (leçon lead_tag uuid/text).
 */
import postgres from 'postgres';

const TEST_URL = process.env.DATABASE_URL_TEST
  ?? 'postgresql://localhost/femiglow_test';

if (/femiglow(?!_test)/.test(TEST_URL)) {
  throw new Error('SÉCURITÉ : DATABASE_URL_TEST pointe vers une base non-test.');
}

export const testSql = postgres(TEST_URL, { max: 4 });

const EMAIL_TABLES = [
  'email_event', 'email_outbox', 'email_automation_run', 'email_automation',
  'email_audience_snapshot_member', 'email_audience_snapshot', 'email_audience',
  'email_campaign_link', 'email_audience_link', 'email_subscriber_link',
  'email_suppression', 'email_template_custom_version', 'email_template_custom',
  'email_template_meta', 'admin_email_view', 'lead_tag',
];

export async function truncateEmailTables(): Promise<void> {
  await testSql.unsafe(
    `TRUNCATE ${EMAIL_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}
```

## 5. Pattern de suite composant (modèle canonique)

```ts
/**
 * CKP-MSW-001..005 — BulkActionsBar : grille d'échecs sur bulk-retry.
 * Modèle canonique : copier cette structure pour toute action réseau.
 */
import { describe, expect, it, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '@/test/msw/server';
import { failWith } from '@/test/msw/handlers/emails';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const URL = '/api/admin/emails/transactional/bulk-retry';

describe('BulkActionsBar — bulk retry (grille d’échecs)', () => {
  it('CKP-MSW-002 : 401 → message d’erreur visible, sélection conservée', async () => {
    server.use(failWith.unauthorized(URL));
    render(<Harness selectedIds={['a', 'b']} />);
    await userEvent.click(screen.getByRole('button', { name: /retenter/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/session|autoris/i);
    // L’oracle anti-« faux succès » : la sélection n’a PAS été vidée.
    expect(screen.getByText(/2 sélectionnés/i)).toBeInTheDocument();
  });
  // CKP-MSW-003 (422), 004 (500), 005 (hang→loading, anti double-clic)…
});
```

## 6. Conventions Playwright (e2e)

- Fichiers : `e2e/emails-<module>.spec.ts`; réutiliser `e2e/_helpers` (login admin).
- Cible : serveur local de test (`--base-url`), JAMAIS la prod.
- Emails sortants : Mailpit (`http://127.0.0.1:8025/api/v1/messages`) via helper :

```ts
export async function readLastEmail(request: APIRequestContext, to: string) {
  const res = await request.get('http://127.0.0.1:8025/api/v1/search', {
    params: { query: `to:${to}`, limit: 1 },
  });
  const { messages } = await res.json();
  return messages?.[0] ?? null;
}
```

- Simuler le temps : antidater en DB de test puis POST la route cron avec le
  bearer de test (cf. runbook R4.d).

## 7. Hygiène

| Règle | Pourquoi |
|---|---|
| `onUnhandledRequest: 'error'` partout | un appel non modélisé = test cassé, pas un faux vert |
| Pas de `vi.mock` de fetch/axios | MSW teste aussi la construction des requêtes |
| Pas de `sleep`; `findBy*`/`waitFor`/`expect.poll` | anti-flakiness |
| Horloge contrôlée (`vi.useFakeTimers`) pour backoff/quiet-hours | déterminisme |
| Un test = un oracle métier explicite | « ne crashe pas » n'est pas un oracle |
| ID matrice en commentaire de chaque test | traçabilité matrice ↔ code |
| Oracle jamais affaibli pour passer au vert | escalader le bug à la place |
```

---

## 8. Harnais RÉEL livré (phase 0, 2026-06-04) — chemins faisant foi

Le code de référence des §1–6 ci-dessus était THÉORIQUE. Le harnais livré suit
les conventions du repo (qui priment) ; voici la carte réelle :

| Pièce | Chemin réel | Notes |
|---|---|---|
| Serveur MSW | `src/test/msw/server.ts` (préexistant) | lifecycle PAR FICHIER, politique `onUnhandledRequest` par suite |
| Handlers emails | `src/test/msw/emails-handlers.ts` | `emailsHandlers` (23 routes) + `emailsFailWith.{unauthorized,validation,serverError,hang,network}(url, method?)` ; STATELESS (override local pour du stateful) |
| Factories | `src/test/factories/emails.factory.ts` | 13 factories `satisfies $inferInsert` (oracle anti-drift tsc) + `makeStalwartEvent`/`makeListmonkEvent` (parsés contre les vrais Zod) ; `resetEmailFactories()` |
| Harnais DB | `src/test/db/emails-db.ts` | `emailsTestDb()`, `emailsTestSql()`, `truncateEmailTables()` (17 tables), `closeTestDb()`, garde-fou : l'URL DOIT contenir `femiglow_test` |
| Skip honnête | `describeEmailsDb` (même module) | = `describe` si URL femiglow_test, sinon `describe.skip` — OBLIGATOIRE pour tout describe top-level vraie-DB (sinon `pnpm test` global casse) |
| Fixtures | `src/test/fixtures/emails/{stalwart,listmonk}/` | provenance dans les README ; fixture 008 = enveloppe batch native NON parsée (R-021) |
| Mailpit | `scripts/test-mailpit.sh` + `e2e/_helpers/mailpit.ts` | container `femiglow-mailpit`, 127.0.0.1:1025/8025 |
| Scripts npm | `test:emails:{unit,component,integration,e2e,all}` | `integration` = `--env-file=.env.test` + `--no-file-parallelism` |

### Règles durcies par l'expérience des chantiers P0

| Règle | Pourquoi (constat) |
|---|---|
| Suites vraie-DB : JAMAIS en parallèle sur la même base | TRUNCATE croisés → deadlock 40P01 (R-023). Le script npm sérialise ; en run manuel multi-fichiers, ajouter `--no-file-parallelism` |
| Route handlers en intégration : `DATABASE_URL` ET `DATABASE_URL_TEST` sur la DB de test | la lib applicative lit `DATABASE_URL` (src/lib/db/client.ts) |
| Init DB module-level interdite dans les suites | `emailsTestDb()` au top-level throw avant le skip → casse le run global. Init lazy (dans hooks/tests ou Proxy) |
| UPDATE CASE sur colonne enum : cast `::email_outbox_status` explicite | Postgres refuse text→enum implicite dans un SET (42804) |
| Date JS dans un template `sql` postgres-js : binder `${d.toISOString()}::timestamptz` | la Date crue au milieu de refs colonnes → ERR_INVALID_ARG_TYPE |
| Précédence MSW 2.x : dans UN server.use, le PREMIER matchant gagne ; entre server.use successifs, le DERNIER gagne | `emailsFailWith` doit être enregistré dans un server.use SÉPARÉ postérieur au nominal |
