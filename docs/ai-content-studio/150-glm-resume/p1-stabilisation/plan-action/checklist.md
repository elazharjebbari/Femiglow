# Checklist P1 — Fichiers impactés par tâche

## Étape 1 — Bugs backend ✅

- [x] `apps/web/src/lib/content-studio/repository.ts` — simplifier ternaire ligne ~457
- [x] `apps/web/src/lib/content-studio/service.ts` — ajouter `assertTransition()` avant chaque changement de statut
- [x] `apps/web/src/lib/content-studio/state-machine.ts` — ajouter transitions manquantes (`scheduled→approved`, `needs_review→generated`)
- [x] `apps/web/src/lib/content-studio/service.test.ts` — nouveau fichier, 40+ tests

## Étape 2 — Types partagés ✅

- [x] `apps/web/src/components/admin/content-studio/types.ts` — nouveau fichier (Integration, StudioMediaItem, DraftAssetsByDraftId, MediaCompartment, AutomationResponse, RunFunction)
- [x] `apps/web/src/components/admin/content-studio/ContentStudioClient.tsx` — supprimer types inline, importer depuis `./types`

## Étape 3 — Découpage UI ✅

- [x] `apps/web/src/components/admin/content-studio/StudioGuide.tsx` — nouveau
- [x] `apps/web/src/components/admin/content-studio/DraftEditor.tsx` — nouveau (contient aussi VisualGenerator, MediaPicker, DeliveryPanel)
- [x] `apps/web/src/components/admin/content-studio/MediaPicker.tsx` — (inclus dans DraftEditor)
- [x] `apps/web/src/components/admin/content-studio/PlatformPreview.tsx` — nouveau
- [x] `apps/web/src/components/admin/content-studio/PostizPanel.tsx` — nouveau
- [x] `apps/web/src/components/admin/content-studio/IdeaForm.tsx` — nouveau
- [x] `apps/web/src/components/admin/content-studio/EditorialCalendar.tsx` — nouveau (contient aussi Metric)
- [x] `apps/web/src/components/admin/content-studio/PostizHealthPanel.tsx` — nouveau (contient aussi OpsMetric)
- [x] `apps/web/src/components/admin/content-studio/SectionTitle.tsx` — nouveau
- [x] `apps/web/src/components/admin/content-studio/DeliveryStatusBadge.tsx` — nouveau
- [x] `apps/web/src/components/admin/content-studio/Select.tsx` — nouveau
- [x] `apps/web/src/components/admin/content-studio/helpers.ts` — nouveau
- [x] `apps/web/src/components/admin/content-studio/api.ts` — nouveau
- [x] `apps/web/src/components/admin/content-studio/ContentStudioClient.tsx` — refactoré en orchestrateur (203 lignes, était 1567)

## Étape 4 — Validation client + accessibilité ✅ (partiel)

- [ ] `apps/web/src/components/admin/content-studio/IdeaForm.tsx` — validation Zod avant submit (P2)
- [ ] `apps/web/src/components/admin/content-studio/DraftEditor.tsx` — validation Zod (P2)
- [x] `apps/web/src/components/admin/content-studio/ContentStudioClient.tsx` — aria-live sur messages, rel="noopener noreferrer", supprimer dead code

## Étape 5 — Tests unitaires ✅

- [x] `apps/web/src/lib/content-studio/service.test.ts` — 40 tests transitions état
- [x] `apps/web/src/lib/content-studio/auth.test.ts` — 3 tests auth
- [x] `apps/web/src/components/admin/content-studio/SectionTitle.test.tsx` — 4 tests
- [x] `apps/web/src/components/admin/content-studio/DeliveryStatusBadge.test.tsx` — 4 tests
- [x] `apps/web/src/components/admin/content-studio/PlatformPreview.test.tsx` — 3 tests
- [x] `apps/web/src/components/admin/content-studio/IdeaForm.test.tsx` — 3 tests
- [x] `apps/web/src/components/admin/content-studio/EditorialCalendar.test.tsx` — 3 tests
- [x] `apps/web/src/components/admin/content-studio/PostizPanel.test.tsx` — 3 tests

## Étape 6 — Tests d'intégration API (MSW) ✅

- [x] `apps/web/src/test/msw/content-studio-handlers.ts` — nouveau (8 handlers MSW)
- [x] `apps/web/src/test/msw/content-studio-handlers.test.ts` — nouveau (8 tests)

## Étape 7 — Tests E2E Playwright ⏳

- [ ] `apps/web/e2e/content-studio.spec.ts` — nouveau
- [x] `apps/web/src/test/factories/content-studio.ts` — nouveau (5 factories)

## Étape 8 — Configuration couverture ✅

- [x] `apps/web/vitest.config.ts` — ajouté Content Studio au coverage include

## Étape 9 — Runbook ✅

- [x] `docs/ai-content-studio/150-glm-resume/p1-stabilisation/runbook/execution.md` — mis à jour avec état final