# 90.3 — Milestones

## M1 — Foundation backend (J+5)

Migrations + services + résolveur + dispatcher refactor.

- ✅ Migrations 0032-0034 appliquées staging
- ✅ default-mapping.json complet ~30 events
- ✅ Seed __default__ idempotent
- ✅ store.ts + resolver.ts + validator.ts + audit.ts + gtm-export.ts
- ✅ Dispatcher utilise resolveEventMapping (fallback code conservé)
- ✅ 80+ tests vitest unit verts

**Validation** : `pnpm tracking:check-default-mapping` vert + coverage backend > 90%.

## M2 — API admin complète (J+7)

8 routes REST testées intégration.

- ✅ Routes list/create/get/update/delete/activate/test/export/reset/diff/audit
- ✅ Validation Zod stricte par provider
- ✅ Audit log fonctionnel
- ✅ Tests intégration > 80% coverage

**Validation** : OpenAPI contract test passe, 39+ tests intégration verts.

## M3 — UI list + wizard + édition (J+12)

Module visible et utilisable côté admin.

- ✅ Page /admin/tracking/events/mappings (liste + filtres)
- ✅ MappingCreateWizard 3 steps
- ✅ Éditeur matrice + cellule popover
- ✅ Keyboard nav arrow keys
- ✅ Save flow (clone + redirect)
- ✅ Empty state + error state

**Validation** : 12 critères F.1-F.12 + 4 critères UX cochés. Sara teste et valide UX.

## M4 — Diff + Test + Export + Reset (J+14)

Toolbox complète.

- ✅ Diff visualizer side-by-side + inline
- ✅ Test modal dry-run
- ✅ Export GTM avec download
- ✅ Reset au default avec récap
- ✅ Import depuis fichier JSON

**Validation** : 12 critères F validés en e2e, Playwright Sce1-S11 verts.

## M5 — Tests complets + déploiement (J+17)

- ✅ Coverage Vitest > 85%
- ✅ Coverage Playwright tous critères F couverts
- ✅ **Test ULTIMATE round-trip GTM** vert
- ✅ axe-core 0 violation
- ✅ Smoke tests post-deploy passent
- ✅ Documentation finalisée
- ✅ Déploiement prod réussi

**Validation** : staging déployé J+15, prod J+17 avec monitoring intensif J+17 → J+24.

## Récapitulatif

| Milestone | Date cible | Effort cumulé | Critique business |
|---|---|---|---|
| M1 | J+5 | 25h | ⭐⭐⭐⭐⭐ Backend solide |
| M2 | J+7 | 35h | ⭐⭐⭐⭐ API utilisable |
| M3 | J+12 | 55h | ⭐⭐⭐⭐⭐ Marketing peut commencer |
| M4 | J+14 | 67h | ⭐⭐⭐⭐ Toolbox complète |
| M5 | J+17 | 76h | ⭐⭐⭐⭐⭐ Prêt production |

## Critères Go/No-Go par milestone

À chaque milestone, point de revue :
- ✅ Tests verts ?
- ✅ Code review approuvée ?
- ✅ Documentation à jour ?
- ✅ Sara (marketing) a testé et validé ?

Si NO → ne pas avancer.

## Buffer / scope flexibility

Si retard à M3 :
- Reporter M4 ImportButton à V2 (priorité basse)
- Reporter MappingResetDefaultButton modal détaillée à V2 (simple confirm suffit V1)

Si retard à M5 :
- Reporter axe-core a11y exhaustif à V1.1 (juste les critiques pour M5)
- Reporter perf benchmarks à V1.1
