# Plan d'action — Implémentation Poka-Yoke GTM

## Vue d'ensemble

| Phase | Durée | Bloquante | Livrable |
|---|---|---|---|
| 0. Setup | 30 min | non | branche, todo list |
| 1. Documentation | 4-6h | non | docs/gtm-poka-yoke/ complet |
| 2. Data layer | 2h | oui | migration + schemas Zod |
| 3. Lib core | 4h | oui | bundle-id, pair-validator, drift-detector |
| 4. Backend API | 3h | oui | 3 routes + cron |
| 5. Frontend pages + composants | 6h | oui | sync-status + validate-pair + banner |
| 6. Intégration menu | 30 min | non | 2 onglets dans TrackingShell |
| 7. Tests unit | 3h | non | ≥ 50 tests Vitest |
| 8. Tests MSW + intégration | 2h | non | 15 tests routes |
| 9. Tests E2E Playwright | 2h | non | 4 scénarios |
| 10. Doc runbook GTM | 1h | non | guide opérationnel |
| 11. Smoke prod | 1h | oui | validation post-deploy |

**Total estimé : ~28h** (3.5 jours dev seul, 2 jours en pair).

## Phase 0 — Setup

```bash
git checkout -b feat/gtm-poka-yoke
# pas de modif, juste la branche
```

Préparer la todo list (les phases ci-dessous).

## Phase 1 — Documentation (parallel avec dev)

Le dossier `docs/gtm-poka-yoke/` est livré dans cette même session.

Audience : doit pouvoir être lu par :
- un nouveau dev qui rejoint
- un admin pour comprendre le système
- un sysadmin qui débogue en prod

## Phase 2 — Data layer

### 2.1 Schema Drizzle

```bash
# apps/web/src/lib/db/schema/tracking-gtm-poka-yoke.ts
# Ajouter les 4 tables (cf. 20-data/02-migration.md)
```

### 2.2 Schemas Zod

```bash
# apps/web/src/lib/tracking/gtm/sentinel-schemas.ts
```

### 2.3 Génération + migration

```bash
pnpm db:generate
pnpm db:migrate
```

### Tests

```bash
pnpm test sentinel-schemas
```

## Phase 3 — Lib core

### 3.1 `bundle-id.ts`
Implémentation complète, exports `computeBundleId`, `isValidBundleId`.

### 3.2 `pair-validator.ts`
Implémentation toutes règles R-001 à R-009.

### 3.3 `drift-detector.ts`
Implémentation `classifyDrift`, `recomputeDriftFromPing`, `getCurrentDriftState`.

### 3.4 `gtm-export-utils.ts`
Adapter export bundle pour injecter bundleId dans les 2 JSONs.

### Tests
50+ tests unitaires (cf. 70-tests/02-test-matrix.md).

## Phase 4 — Backend API

### 4.1 `POST /api/track/sentinel` (public)
- Rate limit, CORS, Zod parse, INSERT, `recomputeDriftFromPing`.

### 4.2 `GET /api/admin/tracking/gtm/sync-status` (admin)
- requireAdmin, fetch DAL, retour structuré.

### 4.3 `POST /api/admin/tracking/gtm/validate-pair` (admin)
- requireAdmin, Zod parse, `pairValidator.validate()`.

### 4.4 `GET /api/admin/tracking/gtm/drift-banner` (admin, cache)
- requireAdmin, fetch léger, cache mémoire 60s.

### 4.5 `POST /api/cron/gtm-silence-check` (cron secret)
- Authentification secret, `recomputeDriftFromTimer`.

### 4.6 Adapter export mapping
- Modifier la route export existante pour injecter bundleId.

## Phase 5 — Frontend

### 5.1 Page `/admin/tracking/gtm/sync-status/page.tsx`
- Server component qui fetch initial state.
- Wraps avec `<SyncStatusLive />`.

### 5.2 Composant `SyncStatusLive` (client)
- Auto-refresh 30s.
- Délègue rendu à `SyncStatusView`.

### 5.3 Composant `SyncStatusView` (présentation)
- Header avec badge global.
- 3 SyncCards.
- PingTimeline.
- Liste transitions.

### 5.4 Composant `DriftBanner`
- Banner global server-side dans TrackingShell.
- Lit `/api/admin/tracking/gtm/drift-banner` avec cache.

### 5.5 Page `/admin/tracking/gtm/validate-pair/page.tsx`
- Server component minimal.
- Renders `<ValidatePairWizard />`.

### 5.6 Composant `ValidatePairWizard` (client)
- 3 étapes, drag & drop.
- POST `/api/admin/tracking/gtm/validate-pair`.
- Affiche résultats via `ValidationDiffViewer`.

### 5.7 Composant `ValidationDiffViewer`
- Sections errors / warnings / recommendations collapsibles.

## Phase 6 — Intégration menu

Modifier `apps/web/src/components/admin/tracking/TrackingShell.tsx` :

```ts
const TABS = [
  // ... existing ...
  { key: 'gtm-sync',     href: '/admin/tracking/gtm/sync-status',  label: 'GTM Sync Status' },
  { key: 'gtm-validate', href: '/admin/tracking/gtm/validate-pair', label: 'Valider import GTM' },
];
```

## Phase 7-9 — Tests

Cf. `70-tests/02-test-matrix.md`. Implémentation au fil de l'eau, ne pas attendre la fin.

## Phase 10 — Doc runbook GTM

Compléter `80-runbook/01-deploy.md` avec les vrais valeurs prod (containerId, etc.).

## Phase 11 — Smoke prod

Checklist post-deploy :
- [ ] Endpoint sentinel répond 204
- [ ] Page sync-status charge
- [ ] Page validate-pair charge
- [ ] Premier ping reçu en prod
- [ ] Banner drift OK
- [ ] Tests E2E passent

## Critères "Done"

Le projet est terminé quand :
- [ ] Toutes les phases sont vertes
- [ ] Couverture tests ≥ cibles (cf. 70-tests/01-strategy.md)
- [ ] MTTD < 5 min mesuré
- [ ] Sara a fait au moins 1 import via la couche A
- [ ] 1 semaine sans faux positif
