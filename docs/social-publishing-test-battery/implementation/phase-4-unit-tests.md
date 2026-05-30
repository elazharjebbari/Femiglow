# Phase 4 — Unit tests (services + adapters)

## Objectif
Couverture ≥ 85% sur les services social-publishing, ≥ 90% sur adapters.

## Modules à étendre (cf liste)

- state-machine.ts (22 tests, table-driven 8×8 transitions)
- retry.ts (10 tests, fake timers)
- errors.ts (14 tests, HTTP→code table)
- adapters/postiz.ts (18 tests, payload + errors)
- adapters/dry-run.ts (8 tests)
- worker.ts (10 tests, mock DB queries)
- alerts.ts (6 tests, mock fetch)
- weekly-failure-digest.ts (5 tests)
- repository.ts (extend idempotency 6 tests)
- postiz.ts client (18 tests, payload + media upload + analytics)

## Total ~117 tests

## Durée
~1 j-p

## Commande
```bash
pnpm vitest run src/lib/social-publishing src/lib/content-studio/postiz.test.ts
```

## Acceptance
- [ ] 117 tests verts
- [ ] Coverage atteinte
