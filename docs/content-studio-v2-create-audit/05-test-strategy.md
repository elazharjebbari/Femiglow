# Stratégie de tests — Content Studio v2 Create

> **Lecture** : ce document décrit la stratégie globale. Pour les détails Vitest/Playwright/MSW, voir `test-battery/`.

## Pyramide de tests

```
                  ▲
                 ╱ ╲
                ╱E2E╲          ~50 scénarios Playwright (UI réelle)
               ╱─────╲
              ╱       ╲
             ╱Component╲       ~140 tests Vitest + RTL (jsdom)
            ╱───────────╲
           ╱             ╲
          ╱   Contract    ╲    ~60 tests Vitest (API + Zod)
         ╱─────────────────╲
        ╱                   ╲
       ╱       Unit          ╲ ~80 tests Vitest (services + hooks + registry)
      ╱───────────────────────╲
     ╱_________________________╲
```

## Principes

### 1. Test what the user does, not what the code does
Pour les composants, on cible le comportement observable par l'utilisateur (clic, voit, lit) — pas l'implémentation. RTL est l'outil de référence.

### 2. Contract first
Les routes API ont un schéma Zod testé en isolation. Les composants front interagissent via MSW (qui valide aussi les schémas). Si le contrat change, le test contract échoue avant l'E2E.

### 3. Mock at the boundary
- Pour les tests unit/component : MSW intercepte les routes
- Pour les tests E2E : on utilise `CONTENT_STUDIO_V2_MOCK_MODE=true` (vrai serveur, fausses inférences)
- Pas de mocks de modules React (jamais `jest.mock(@/components/...)`)

### 4. Determinism
- Tous les tests doivent être reproductibles en l'absence de réseau
- Aucun appel à `Date.now()` non maîtrisé (utiliser `vi.useFakeTimers`)
- IDs déterministes via `nanoid` mockable

### 5. No flaky tests
3 runs consécutifs identiques avant merge. Les tests instables sont quarantainisés (skip + issue).

## Couches de test

### Unit — `pnpm vitest run src/lib/...`

Cibles :
- `lib/content-studio-v2/models/registry.ts` (nouveau) : suggestions par format
- `lib/content-studio/services/generation.ts` : choix modèle texte
- `lib/content-studio/services/image-generation.ts` : mock vs real
- `lib/content-studio/services/video-generation.ts` (nouveau)
- `lib/content-studio-v2/state/StudioContext.tsx` : reducer, autosave
- `lib/content-studio/state-machine.ts` : transitions

### Component — `pnpm vitest run src/components/admin/content-studio-v2/create`

Cibles (un fichier de test par composant) :
- `IntentionForm.test.tsx`
- `VariantsCompare.test.tsx`
- `MediaStudio.test.tsx`
- `ModelPicker.test.tsx` (nouveau)
- `CaptionEditor.test.tsx`
- `PreviewPane.test.tsx`
- `PublishActionGroup.test.tsx`
- `Stepper.test.tsx`
- `CreateWorkspace.test.tsx` (orchestration)

### Contract — `pnpm vitest run src/test/api-contracts`

Cibles (un fichier par route) :
- `content-studio-v2-ideas.contract.test.ts`
- `content-studio-v2-ideas-generate.contract.test.ts`
- `content-studio-v2-drafts-patch.contract.test.ts`
- `content-studio-v2-drafts-generate-visual.contract.test.ts`
- `content-studio-v2-drafts-approve.contract.test.ts`
- `content-studio-v2-posts-publish-now.contract.test.ts`
- `content-studio-v2-posts-schedule.contract.test.ts`
- `content-studio-v2-posts-draft-on-provider.contract.test.ts`
- `content-studio-v2-models.contract.test.ts` (nouveau)

Pour chaque route : valid → 200, invalid (chaque champ) → 400, manque auth → 401, idempotency → 200 cached, rate limit → 429.

### E2E — `npx playwright test e2e/content-studio-v2`

Cibles (un fichier par scénario) :
- `create-golden-path.spec.ts` (S01)
- `create-model-switching.spec.ts` (S02)
- `create-mock-video.spec.ts` (S03)
- `create-step-progression.spec.ts` (S04)
- `create-budget-exhaustion.spec.ts` (S05)
- `create-error-recovery.spec.ts` (S06)
- `create-scheduling.spec.ts` (S07)
- `create-concurrent-edits.spec.ts` (S08)
- `create-a11y.spec.ts` (cross-cutting)
- `create-dark-mode.spec.ts` (cross-cutting)
- `create-responsive.spec.ts` (cross-cutting)
- `create-keyboard.spec.ts` (cross-cutting)

## Données de test

Voir `test-battery/fixtures/`. Trois fixtures principales :

- `mock-drafts.json` : 3 variants déterministes
- `mock-providers.json` : registry serveur
- `mock-media.json` : items image + vidéo mock

## Couverture cible

| Couche | Couverture lignes | Couverture branches |
|--------|-------------------|---------------------|
| Composants `/create` | ≥ 85% | ≥ 75% |
| Services `content-studio*` | ≥ 80% | ≥ 70% |
| State / hooks | ≥ 90% | ≥ 80% |
| Routes API | ≥ 80% | ≥ 70% |
| **Global** | **≥ 75%** | **≥ 65%** |

## Outils

| Outil | Version | Rôle |
|-------|---------|------|
| Vitest | 2.1.x | Test runner |
| @testing-library/react | 16.x | Component testing |
| MSW | 2.x | HTTP mocking |
| Playwright | 1.48 | E2E |
| axe-core | latest | A11y audit |
| fast-check | 4.x | Property-based (optionnel) |

## Boucle de correction

À chaque échec :
1. Identifier nature (bug code vs bug test vs contrat dérivé)
2. Localiser via stack trace
3. Corriger code en priorité, sinon le test si la spec a légitimement évolué
4. Re-run isolé → suite locale → full
5. Documenter dans `test-battery/REGRESSION_NOTES.md` si la correction est instructive

## Critères de done

- [ ] 0 fail Vitest
- [ ] 0 fail Playwright
- [ ] Couverture cibles atteintes
- [ ] Aucun test marqué `.skip` ou `.todo` sans issue associée
- [ ] Run 3× successif identique (anti-flake)
- [ ] CI vert sur PR
