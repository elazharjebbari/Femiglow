# Checklist P1 — Fichiers impactés par tâche

## Étape 1 — Bugs backend

- [ ] `apps/web/src/lib/content-studio/repository.ts` — simplifier ternaire ligne ~457
- [ ] `apps/web/src/lib/content-studio/service.ts` — ajouter `assertTransition()` avant chaque changement de statut
- [ ] `apps/web/src/lib/content-studio/state-machine.ts` — ajouter transitions manquantes (`scheduled→approved`, `needs_review→generated`)
- [ ] `apps/web/src/lib/content-studio/service.test.ts` — nouveau fichier, 6+ tests

## Étape 2 — Types partagés

- [ ] `apps/web/src/components/admin/content-studio/types.ts` — nouveau fichier
- [ ] `apps/web/src/components/admin/content-studio/ContentStudioClient.tsx` — supprimer types inline, importer depuis `./types`

## Étape 3 — Découpage UI

- [ ] `apps/web/src/components/admin/content-studio/StudioGuide.tsx` — nouveau
- [ ] `apps/web/src/components/admin/content-studio/DraftCardList.tsx` — nouveau
- [ ] `apps/web/src/components/admin/content-studio/MediaPicker.tsx` — nouveau
- [ ] `apps/web/src/components/admin/content-studio/PlatformPreview.tsx` — nouveau
- [ ] `apps/web/src/components/admin/content-studio/PostizPanel.tsx` — nouveau
- [ ] `apps/web/src/components/admin/content-studio/IdeaForm.tsx` — nouveau
- [ ] `apps/web/src/components/admin/content-studio/CalendarPipeline.tsx` — nouveau
- [ ] `apps/web/src/components/admin/content-studio/PostizHealthPanel.tsx` — nouveau
- [ ] `apps/web/src/components/admin/content-studio/AutomationActions.tsx` — nouveau
- [ ] `apps/web/src/components/admin/content-studio/ContentStudioClient.tsx` — refactorer en orchestrateur (<200 lignes)

## Étape 4 — Validation client + accessibilité

- [ ] `apps/web/src/components/admin/content-studio/IdeaForm.tsx` — validation Zod avant submit
- [ ] `apps/web/src/components/admin/content-studio/DraftEditor.tsx` (ex-DraftEditor dans ContentStudioClient) — validation Zod
- [ ] `apps/web/src/components/admin/content-studio/ContentStudioClient.tsx` — aria-live sur messages, rel="noopener noreferrer", supprimer dead code

## Étape 5 — Tests unitaires

- [ ] `apps/web/src/lib/content-studio/service.test.ts` — nouveau
- [ ] `apps/web/src/lib/content-studio/auth.test.ts` — nouveau
- [ ] `apps/web/src/components/admin/content-studio/StudioGuide.test.tsx` — nouveau
- [ ] `apps/web/src/components/admin/content-studio/DraftCardList.test.tsx` — nouveau

## Étape 6 — Tests d'intégration API (MSW)

- [ ] `apps/web/src/test/msw/content-studio.ts` — nouveau (handlers MSW)
- [ ] `apps/web/src/lib/content-studio/api-routes.test.ts` — nouveau

## Étape 7 — Tests E2E Playwright

- [ ] `apps/web/e2e/content-studio.spec.ts` — nouveau
- [ ] `apps/web/src/test/factories/content-studio.ts` — nouveau

## Étape 8 — Configuration couverture

- [ ] `apps/web/vitest.config.ts` — ajouter Content Studio au coverage include

## Étape 9 — Runbook

- [ ] `docs/ai-content-studio/130-runbook/prototype-runbook.md` — mettre à jour
- [ ] `docs/ai-content-studio/150-glm-resume/p1-stabilisation/runbook/execution.md` — ce fichier