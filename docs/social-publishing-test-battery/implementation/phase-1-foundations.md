# Phase 1 — Foundations

## Objectif
Poser le socle : MSW catalog + fixtures + Playwright helpers.

## Livrables

### 1. MSW catalog (src/test/msw/social-publishing-handlers.ts)
- Exporte `createPublishHandlers(opts)` factory
- Exporte `applyPlaywrightRoutes(page, opts)`
- 14 handlers × variants (cf 06-msw-handlers-catalog.yaml)
- In-memory state store (PublishMockStore)
- Smoke test : `social-publishing-handlers.test.ts`

### 2. Fixtures (src/test/fixtures/social-publishing/)
- accounts/*.json (5 fichiers)
- jobs/*.json (8 fichiers)
- posts/*.json (5 fichiers)
- postiz-responses/*.json (~10 fichiers)
- media/*.json (3 fichiers)
- index.ts exporte types + helpers (`getAccountFixture(slug)`, etc.)

### 3. Playwright helpers (e2e/social-publishing/helpers.ts)
```ts
export async function registerPublishMocks(page, opts);
export async function driveToPublishStep(page, opts);
export async function assertJobInQueue(page, jobId, status);
export async function waitForJobStatus(page, jobId, status, timeoutMs);
```

### 4. Type-check + smoke
```bash
pnpm run type-check
pnpm vitest run src/test/msw/social-publishing-handlers.test.ts
```

## Durée
~1 j-p

## Acceptance
- [ ] MSW catalog exporte 14 handlers + 30+ variants
- [ ] Fixtures cataloguées avec types
- [ ] Helpers Playwright importables sans erreur
- [ ] Smoke tests verts
