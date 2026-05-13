# Implementation Status

> Status of each component of the GTM Poka-Yoke system as of 2026-05-13.

## Légende
- ✅ Implémenté + testé
- 🟡 Implémenté, tests partiels
- 🔄 En cours
- ⬜ Non démarré

## Backend

| Module | Statut | Localisation |
|---|---|---|
| Migration SQL | ✅ | `apps/web/drizzle/migrations/00XX_gtm_poka_yoke.sql` |
| Schema Drizzle | ✅ | `apps/web/src/lib/db/schema/tracking-gtm-poka-yoke.ts` |
| Schemas Zod | ✅ | `apps/web/src/lib/tracking/gtm/sentinel-schemas.ts` |
| `bundle-id.ts` | ✅ | `apps/web/src/lib/tracking/gtm/bundle-id.ts` |
| `pair-validator.ts` | ✅ | `apps/web/src/lib/tracking/gtm/pair-validator.ts` |
| `drift-detector.ts` | ✅ | `apps/web/src/lib/tracking/gtm/drift-detector.ts` |
| `POST /api/track/sentinel` | ✅ | `apps/web/src/app/api/track/sentinel/route.ts` |
| `GET /api/admin/tracking/gtm/sync-status` | ✅ | `apps/web/src/app/api/admin/tracking/gtm/sync-status/route.ts` |
| `POST /api/admin/tracking/gtm/validate-pair` | ✅ | `apps/web/src/app/api/admin/tracking/gtm/validate-pair/route.ts` |
| `GET /api/admin/tracking/gtm/drift-banner` | ✅ | `apps/web/src/app/api/admin/tracking/gtm/drift-banner/route.ts` |
| `POST /api/cron/gtm-silence-check` | 🟡 | TODO Phase 2 production |

## Frontend

| Module | Statut | Localisation |
|---|---|---|
| Page sync-status | ✅ | `apps/web/src/app/admin/tracking/gtm/sync-status/page.tsx` |
| Page validate-pair | ✅ | `apps/web/src/app/admin/tracking/gtm/validate-pair/page.tsx` |
| `SyncStatusView` (server) | ✅ | `apps/web/src/components/admin/tracking/gtm/SyncStatusView.tsx` |
| `SyncStatusLive` (client) | ✅ | `apps/web/src/components/admin/tracking/gtm/SyncStatusLive.tsx` |
| `SyncCard` | ✅ | idem |
| `PingTimeline` | ✅ | idem |
| `DriftBanner` | ✅ | `apps/web/src/components/admin/tracking/gtm/DriftBanner.tsx` |
| `ValidatePairWizard` (client) | ✅ | `apps/web/src/components/admin/tracking/gtm/ValidatePairWizard.tsx` |
| `ValidationDiffViewer` | ✅ | idem |
| Intégration `TrackingShell` | ✅ | `apps/web/src/components/admin/tracking/TrackingShell.tsx` |

## Tests

| Type | Statut | Couverture |
|---|---|---|
| Unit Vitest (bundle-id) | ✅ | 100% |
| Unit Vitest (pair-validator) | ✅ | ≥ 95% |
| Unit Vitest (drift-detector) | ✅ | ≥ 90% |
| Intégration MSW (routes) | ✅ | ≥ 85% |
| E2E Playwright (sync-status) | ✅ | 2 scénarios |
| E2E Playwright (validate-pair) | ✅ | 2 scénarios |

## GTM (à configurer manuellement post-deploy)

| Item | Statut |
|---|---|
| Variable `FG Bundle Id (Config)` | ⬜ à créer |
| Variable `FG Bundle Id (Mapping)` | ⬜ à créer |
| Variable `FG Mapping Version` | ⬜ à créer |
| Variable `FG Config Version` | ⬜ à créer |
| Tag "FG Sentinel Ping" | ⬜ à créer |
| Tag "FG Manifest Check" | ⬜ à créer |
| Trigger "All Pages — once per session" | ⬜ |
| Workspace publié | ⬜ |

## Prochaines étapes (post-merge)

1. Appliquer la migration en prod via `pnpm db:migrate`.
2. Configurer les variables + tags GTM (cf. `80-runbook/01-deploy.md`).
3. Publish workspace GTM.
4. Smoke test : faire un pageview en prod, vérifier ping reçu.
5. Documenter dans le post-mortem du déploiement.
