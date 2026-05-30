# Stratégie MSW + Fixtures — Social Publishing

> Source de vérité pour les mocks. Partagé entre Vitest (composants + contract) et Playwright (E2E mocked).

## Principes

1. **Un seul catalogue** : `src/test/msw/social-publishing-handlers.ts` exporte une factory `createPublishHandlers(opts)` qui retourne un array de handlers.
2. **Composable** : opts permet de surcharger par scénario (`{ publishNow: 'rate_limited' }`).
3. **Type-safe** : utilise les types Zod réels (`SocialPublishJob`, `ContentPost`) ; pas de "any".
4. **State-aware** : un store en mémoire (`Map<id, Job>`) maintient l'état entre appels dans un même test (idempotency, polling JobQueue).
5. **Réutilisable Playwright** : même catalogue exporte `applyPlaywrightRoutes(page, handlers)` pour traduire MSW → `page.route()`.

## Architecture du catalogue

```
src/test/msw/social-publishing-handlers.ts

export interface PublishMocksOpts {
  // Per-route overrides
  publishNow?: 'success' | 'rate_limited' | 'budget_exceeded' | 'auth_failed' | 'no_account' | 'brand_blocked';
  schedule?: 'success' | 'past_date' | 'min_lead' | 'duplicate_key';
  draft?: 'success' | 'failed' | 'success_no_capability';
  jobsList?: 'success' | 'empty' | 'paginated';
  retry?: 'success' | 'still_failing' | 'not_found';
  cancel?: 'success' | 'already_terminal';
  reschedule?: 'success' | 'past_date';
  postizSync?: 'success' | 'unauthorized';

  // Initial state
  initialJobs?: SocialPublishJob[];
  initialAccounts?: SocialAccount[];

  // Behaviour switches
  recordIdempotency?: boolean;  // default true
  pollingDelayMs?: number;       // adds artificial latency for testing loading states
}

export function createPublishHandlers(opts: PublishMocksOpts = {}): HttpHandler[];
export function applyPlaywrightRoutes(
  page: Page,
  opts: PublishMocksOpts,
): Promise<MswState>;
```

## Inventaire des handlers

| ID | Method | Path | Default response | Variants |
|----|--------|------|------------------|----------|
| `pub_now` | POST | `/api/admin/content-studio/posts/:id/publish-now` | 201 `{ status:'queued', jobs:[Job] }` | rate_limited (429), budget_exceeded (402), auth_failed (401), no_account (409), brand_blocked (409) |
| `pub_schedule` | POST | `/api/admin/content-studio/posts/:id/schedule` | 201 `{ status:'scheduled', jobs:[Job] }` | past_date (400), min_lead (400), duplicate_key (200 cached) |
| `pub_draft` | POST | `/api/admin/content-studio/posts/:id/draft-on-provider` | 201 `{ status:'approved', jobs:[Job mode=draft] }` | failed (500), success_no_capability (409) |
| `pub_cancel` | POST | `/api/admin/content-studio/posts/:id/cancel` | 200 `{ post: { status:'cancelled' } }` | already_terminal (409) |
| `pub_reschedule` | PATCH | `/api/admin/content-studio/posts/:id/reschedule` | 200 `{ post:{...} }` | past_date (400) |
| `jobs_list` | GET | `/api/admin/content-studio/publish-jobs` | 200 `{ jobs:[...] }` | empty, paginated |
| `job_retry` | POST | `/api/admin/content-studio/publish-jobs/:id/retry` | 200 `{ job: Job(queued) }` | still_failing (500), not_found (404) |
| `job_cancel` | POST | `/api/admin/content-studio/publish-jobs/:id/cancel` | 200 `{ job: Job(cancelled) }` | already_terminal (409) |
| `postiz_sync` | POST | `/api/admin/content-studio/postiz/integrations/sync` | 200 `{ accounts:[...] }` | unauthorized (401), partial_failure (200 with errors[]) |
| `health` | GET | `/api/admin/content-studio/health` | 200 `{ mockMode:true }` | — |
| `generation_runs` | GET | `/api/admin/content-studio/generation-runs` | 200 budget | budget_exhausted |
| `media_list` | GET | `/api/admin/content-studio/media` | 200 items | empty |
| `drafts_list` | GET | `/api/admin/content-studio/drafts` | 200 drafts | — |
| `posts_list` | GET | `/api/admin/content-studio/posts` | 200 posts | — |

Voir `test-battery/06-msw-handlers-catalog.yaml` pour le JSON détail de chaque variant.

## State store (en-mémoire)

```ts
class PublishMockStore {
  private jobs = new Map<string, SocialPublishJob>();
  private idempotencyMap = new Map<string, string>(); // key → jobId

  createJob(j: SocialPublishJob): SocialPublishJob;
  findByIdempotency(key: string): SocialPublishJob | null;
  updateStatus(id: string, status: JobStatus): SocialPublishJob;
  listByStatus(status: JobStatus): SocialPublishJob[];
  reset(): void; // called by tests in beforeEach
}
```

Le store permet :
- Tester l'idempotency (mêmê key → 200 cached, pas duplicate)
- Tester le polling JobQueue (status change entre 2 polls)
- Tester le cycle de vie (queued → publishing → published)

## Fixtures

Voir `test-battery/fixtures/`. Structure :

```
test-battery/fixtures/
├── accounts/
│   ├── instagram-active.json        (Postiz IG, active)
│   ├── instagram-disabled.json      (status=disabled)
│   ├── instagram-token-expired.json (status=token_expired)
│   ├── facebook-active.json
│   └── dry-run.json
├── posts/
│   ├── approved-post.json           (ready to publish)
│   ├── scheduled-post.json          (with scheduledAt future)
│   ├── published-post.json          (with publishedAt past)
│   ├── failed-post.json
│   └── cancelled-post.json
├── jobs/
│   ├── job-queued-now.json
│   ├── job-queued-schedule.json
│   ├── job-publishing.json
│   ├── job-published.json
│   ├── job-failed-rate-limit.json
│   ├── job-failed-auth.json
│   ├── job-cancelled.json
│   └── job-retried.json
├── postiz-responses/
│   ├── upload-success.json
│   ├── posts-now-success.json
│   ├── posts-schedule-success.json
│   ├── posts-draft-success.json
│   ├── analytics-day-7.json
│   ├── integrations-list.json
│   ├── error-401.json
│   ├── error-422-caption-too-long.json
│   ├── error-429-rate-limit.json
│   └── error-503-down.json
└── media/
    ├── ai-image-1080.json
    ├── ai-video-9x16.json
    └── uploaded-image.json
```

## Réutilisation Playwright

```ts
// e2e/social-publishing/helpers.ts
import { createPublishHandlers, type PublishMocksOpts } from '@/test/msw/social-publishing-handlers';

export async function registerPublishMocks(page: Page, opts: PublishMocksOpts = {}) {
  const handlers = createPublishHandlers(opts);
  for (const h of handlers) {
    await page.route(h.path, async (route) => {
      const req = route.request();
      const body = req.postDataJSON();
      const res = await h.handler({ request: req, body });
      await route.fulfill({
        status: res.status,
        contentType: 'application/json',
        body: JSON.stringify(res.body),
      });
    });
  }
}
```

## Smoke tests des handlers

Sur PR qui touche le catalogue, run :
```bash
pnpm vitest run src/test/msw/social-publishing-handlers.test.ts
```

Vérifie que chaque variant retourne la shape attendue + status code attendu.

## Évolution

- Ajout d'un nouveau handler → l'ajouter à la table du `06-msw-handlers-catalog.yaml` puis au catalogue TypeScript
- Modification d'un contrat API réel → mettre à jour le handler + bumper la version du catalog dans `01-action-plan.md`
- Si Postiz ajoute un endpoint → handler dans `test-battery/fixtures/postiz-responses/` + entrée dans catalog

## Anti-patterns

- ❌ Ne pas hardcoder des fixtures dans les specs ; toujours via `import` depuis `fixtures/`
- ❌ Ne pas modifier les fixtures en place dans un test ; cloner via `structuredClone()` si modification needed
- ❌ Ne pas laisser des handlers résiduels entre tests (`server.resetHandlers()` dans `afterEach`)
- ❌ Ne pas faire de `page.route()` avant `page.goto()` — sinon le routing n'est pas appliqué à la 1ère navigation
