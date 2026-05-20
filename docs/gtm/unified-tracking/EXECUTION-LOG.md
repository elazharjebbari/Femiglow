# Execution log — Unified Tracking TP2

> Journal d'exécution du plan d'action `12-action-plan/`. Mis à jour à chaque
> sprint livré. Pour les détails conceptuels, voir les sections 01 → 14.

## Statut global

| Sprint | Périmètre                                                                 | Statut         |
| ------ | ------------------------------------------------------------------------- | -------------- |
| 0      | Discovery (audit existing, dual-driver, vitest, migrations)               | **Livré**      |
| 1      | Backend foundations : types Zod, Drizzle schema, migration 0050, store    | **Livré**      |
| 2      | Backend API : validator, exporter, differ, cache, service, 9 endpoints    | **Livré**      |
| 3      | Frontend primitives : Zustand store, hooks fetch, 4 composants partagés   | **Livré**      |
| 4      | Wizard 5 étapes + page détail plan + activation + export GTM              | **Livré**      |
| 5      | Mode expert (JSON brut) + page historique audit                           | **Livré (partiel — redirects legacy reportés)** |
| 6      | Tests verts (5130/5130) + execution log + runbook minimal                 | **Livré**      |
| 7      | Suivi : bascule store DB, middleware legacy 302, diagnostics drift, script migration, Playwright golden path | **Livré**      |

## Fichiers livrés (code, hors documentation)

### Backend (`apps/web/src/lib/tracking/plan/`)

- `types.ts` — Schémas Zod canoniques (providers, events, envProfiles, audit).
- `validator.ts` — Règles R-001 → R-005 (placeholder, active provider, required IDs,
  production env, unique event keys) + warnings W-001/W-003/W-004.
- `exporter.ts` — Export GTM déterministe avec canonicalize() + SHA-256 bundleId.
- `differ.ts` — `diffPlans()` retournant ChangeSet + détection de chemins
  breaking (active providers, IDs production).
- `cache.ts` — `PlanCache` TTL 30s pour getActive/getById.
- `service.ts` — `TrackingPlanService` orchestrant store + cache + validation.
- `store-memory.ts` — `MemoryPlanStore` implémentant `PlanStore`.
- `repository.ts` — `TrackingPlanRepository` (DB-backed, encore non câblé en
  production — bascule via `getTrackingPlanService()` quand prêt).
- `index.ts` — Factory singleton + barrel exports.
- `__tests__/{types,validator,exporter}.test.ts` — 24 tests.
- `client/` — `api-client.ts`, `use-plans.ts`, `wizard-store.ts` (Zustand persist).

### Backend (`apps/web/src/lib/db/`)

- `schema-tracking-plan.ts` — Tables Drizzle `tracking_plans`,
  `tracking_plan_audit`, `tracking_defaults`. Index unique partiel sur
  `status='active'` ; enum `tracking_plan_status` et `tracking_plan_audit_action`.

### Migration

- `apps/web/drizzle/migrations/0050_tracking_plan_v2.sql`
  - Création tables + index.
  - Fonction PL/pgSQL `tracking_plan_audit_block_mutations()` + triggers
    BEFORE UPDATE / BEFORE DELETE sur l'audit (append-only garanti).

### API REST (`apps/web/src/app/api/admin/tracking/plans/`)

- `route.ts` — `GET /` (list), `POST /` (create).
- `[id]/route.ts` — `GET /:id`, `PATCH /:id` (If-Match obligatoire, 409 sur
  version_conflict).
- `[id]/activate/route.ts` — `POST` (422 si plan invalide, archive l'actif).
- `[id]/archive/route.ts` — `POST`.
- `[id]/validate/route.ts` — `GET` (ValidationResult).
- `[id]/export/route.ts` — `GET ?env=production|staging|local`.
- `audit/route.ts` — `GET ?planId=` (audit log).
- `defaults/route.ts` — `GET` (valeurs auto-prefill).
- `diff/route.ts` — `GET ?a=&b=`.
- `__tests__/api.test.ts` — 24 tests d'intégration mockant uniquement
  `getAdminSession`, exerçant la pile route → service → store.

### Frontend (`apps/web/src/app/admin/tracking/plans/`)

- `page.tsx` — Home : liste plans + plan actif mis en avant.
- `new/page.tsx` + `WizardClient.tsx` — Wizard 5 étapes (providers, envProfiles,
  events, settings, review) avec persist sessionStorage via Zustand.
- `[id]/page.tsx` — Détail + actions (Activer, Exporter, Archiver) +
  validation live.
- `[id]/expert/page.tsx` + `ExpertEditor.tsx` — Édition JSON brute + If-Match.
- `[id]/history/page.tsx` — Journal audit.

### Composants partagés (`apps/web/src/components/admin/tracking/plans/`)

- `StatusBadge.tsx` — Badge statut (draft/active/archived).
- `IdInput.tsx` — Input ID avec validation regex live + a11y (aria-invalid).
- `EventMatrixRow.tsx` — Ligne de la matrice event × outils.
- `JsonPreview.tsx` — Aperçu JSON read-only + copier + télécharger.
- `WizardStepper.tsx` — Stepper a11y (aria-current="step").
- `wizard/Step{Providers,EnvProfiles,Events,Settings,Review}.tsx` — 5 étapes.

### TrackingShell (édité)

- `apps/web/src/components/admin/tracking/TrackingShell.tsx` —
  Ajout de l'onglet `plans` ("Plans (unifié)") en première position après
  Vue d'ensemble.

## Tests

- **5 130 tests passent / 0 échec / 11 skip** (suite vitest complète, 560 fichiers).
- 24 tests d'intégration sur les 9 endpoints (auth + happy path + erreurs
  4xx/5xx + transitions activate/archive avec audit).
- 24 tests unitaires sur types / validator / exporter (R-001..R-005,
  déterminisme SHA-256, structure GTM, edge cases).

## Sprint 7 — Suivi (livré dans cette itération)

- **Bascule store DB câblée** :
  `apps/web/src/lib/tracking/plan/index.ts` sélectionne le store via
  `TRACKING_PLAN_STORE` (`memory|db|auto`, défaut `auto`). En `auto`, retombe
  sur `MemoryPlanStore` si `DATABASE_URL` est absent ; sinon utilise le
  `TrackingPlanRepository`. La signature `DrizzleDb` (union Neon + postgres-js)
  est exportée depuis `apps/web/src/lib/db/client.ts` pour garder le code
  driver-agnostic.
- **Redirects legacy** :
  `apps/web/src/lib/tracking/plan/legacy-redirect.ts` expose
  `legacyRedirectIfNeeded(request)` (302 + header `X-Deprecation`), intégré
  dans `apps/web/src/middleware.ts` avant l'auth. Activable via
  `TRACKING_LEGACY_REDIRECT=on`. Mapping :
  `/admin/tracking/{events,providers,gtm}` → `/admin/tracking/plans`.
  6 tests vitest. Une bannière (`LegacyDeprecationBanner.tsx`) reste posée tant
  que le flag est off pour signaler la dépréciation côté UI.
- **Page diagnostics drift** :
  `apps/web/src/app/admin/tracking/plans/[id]/diagnostics/page.tsx` compare
  les events déclarés au plan avec ceux observés dans `tracking_events_log`
  sur 7 jours. Affiche : déclarés-missing, orphelins, couverts. Module pur
  testé (`computeDrift`, 4 tests). Lien ajouté depuis la page détail.
- **Script migration legacy → plan** :
  `apps/web/scripts/migrate-tracking-to-plan.ts` (exposé via
  `pnpm migrate:tracking-to-plan` et `migrate:tracking-to-plan:dry-run`).
  Lit `tracking_providers` + `tracking_event_definitions` + setting
  `consentMode`, mappe `google_ga4→ga4`, `google_ads→googleAds`,
  `meta`, `tiktok`, `gtm` (snap/pinterest/custom skippés), crée un plan en
  `draft`. 8 tests vitest sur les fonctions pures `mapProviders` / `mapEvents`.
- **Tests Playwright golden path** :
  `apps/web/e2e/admin-tracking-plans-wizard.spec.ts` couvre 3 scénarios
  (liste accessible, wizard 5 steps → save → redirect detail, bouton
  "Précédent" désactivé). Pattern habituel : skip si redirect login,
  storageState admin, purge sessionStorage du store wizard avant chaque run.

## Reporté à une itération ultérieure

- i18n complet ar-MA / RTL (la documentation est posée dans
  `14-tests/playwright/i18n.spec.md`).
- Stories Storybook (Storybook n'est pas installé dans le repo).

## Procédure de bascule production

1. Appliquer la migration : `pnpm db:migrate` (ou via le pipeline standard).
2. Définir `DATABASE_URL` (et éventuellement `TRACKING_PLAN_STORE=db` pour
   forcer la DB). En mode `auto` (défaut), le repository est utilisé dès que
   `DATABASE_URL` est posé.
3. Lancer le seed initial : `pnpm migrate:tracking-to-plan:dry-run` puis
   `pnpm migrate:tracking-to-plan` pour créer un plan `draft` depuis les
   données legacy.
4. Inspecter le plan dans `/admin/tracking/plans/[id]`, corriger les IDs
   production si besoin, puis activer (audit + archive automatique de
   l'ancien actif).
5. Vérifier la couverture sur `/admin/tracking/plans/[id]/diagnostics` après
   24-48 h de trafic.
6. Activer `TRACKING_LEGACY_REDIRECT=on` pour rediriger les anciennes pages
   `/admin/tracking/{events,providers,gtm}` vers `/admin/tracking/plans`
   (302 + header `X-Deprecation` exploitable côté monitoring).

## Liens

- Conception : [README](README.md), [01-architecture/](01-architecture/),
  [03-backend/](03-backend/).
- Plan d'action : [12-action-plan/](12-action-plan/).
- Runbook : [13-runbook/](13-runbook/).
- Tests détaillés : [14-tests/](14-tests/).
