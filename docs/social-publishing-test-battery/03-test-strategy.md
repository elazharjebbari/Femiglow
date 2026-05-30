# Stratégie de tests — Social Publishing

> **Lecture** : pourquoi cette stratégie. Pour le **comment**, voir `test-battery/01-*` etc.

## Pyramide adoptée

```
                          ▲
                         ╱ ╲
                        ╱ Live ╲          1 spec @live (opt-in)
                       ╱───────╲
                      ╱  E2E    ╲         ~16 specs Playwright (mock + cross-cutting)
                     ╱   mocked  ╲
                    ╱─────────────╲
                   ╱  Components   ╲      ~94 tests Vitest + RTL
                  ╱─────────────────╲
                 ╱   Contract API    ╲    ~60 tests Vitest
                ╱─────────────────────╲
               ╱        Unit           ╲ ~88 tests Vitest (services + adapters)
              ╱─────────────────────────╲
             ╱______________________________╲
```

## Principes directeurs

### 1. UI-first

Les tests modélisent le **comportement observé par l'opérateur**. Pas les détails d'implémentation. Si le UI fait ce qu'il doit, le test passe — peu importe comment.

```ts
// ❌ Non
expect(component.state.isPublishing).toBe(true);

// ✅ Oui
await expect(screen.getByText(/publication lancée/i)).toBeVisible();
```

### 2. Mock at the boundary

- **Component tests** : MSW intercepte les routes API
- **E2E mocked** : `page.route()` Playwright intercepte les fetch
- **Live test** : aucun mock — chaîne réelle complète
- **Jamais** : mocker un module React (jamais `vi.mock('@/components/...')`)

### 3. Catalogue MSW unique

Un seul fichier source `src/test/msw/social-publishing-handlers.ts` exporte des handlers réutilisables. Les specs en composent via une factory.

```ts
import { createPublishHandlers } from '@/test/msw/social-publishing-handlers';

const server = setupServer(...createPublishHandlers({ mode: 'happy' }));
```

### 4. Déterminisme strict

- IDs déterministes via fixtures (`post_e2e_1`, `job_e2e_1`)
- `vi.useFakeTimers` ou `new Date(...)` mockée si dépendance temporelle
- Pas de `setTimeout` arbitraire ; tous les `waitFor` avec timeout explicite ≥ 5s
- Workers Playwright = 2 max ; pas de partage de state global

### 5. Anti-flake

Chaque PR doit passer 3 runs E2E identiques avant merge. Tests détectés flaky → quarantainisés avec issue trackée.

### 6. Lecture business-driven

Chaque test commence par un commentaire qui décrit le scénario en langage métier :

```ts
test('S01 — Opérateur publie un Reel maintenant sur Instagram', async ({ page }) => {
  // Given: 1 post approuvé, 1 compte Instagram actif
  // When : il clique Publier maintenant + confirme
  // Then : le job est créé + status passe à 'published' + toast succès
  ...
});
```

### 7. Live test = guardé fort

- `E2E_LIVE_POSTIZ=1` requis
- Marqué `@live` dans le titre → exclu par défaut (`--grep -v @live`)
- Workers=1 (pas de parallélisme)
- Cleanup automatique du post test (DELETE Postiz)
- Si crash mid-test, hook `afterEach` tente cleanup quand même

## Couches de test

### Unit — `pnpm vitest run src/lib/social-publishing`

Cibles :
- `state-machine.ts` — table des transitions (matrix 8 statuts × actions)
- `retry.ts` — exponential backoff, transient codes detection
- `errors.ts` — mapping HTTP code → app code (table)
- `idempotency` (in repository.ts) — race conditions, key collisions
- `adapters/postiz.ts` — payload mapping, error extraction
- `adapters/dry-run.ts` — synthetic results, failure simulation
- `worker.ts` — lock acquisition, scheduled due query
- `repository.ts` — CRUD + memory store fallback

### Component — `pnpm vitest run src/components/admin/content-studio-v2`

Cibles : 8 composants UI listés dans `02-overview.md`. Tests typiques :
- Rendu initial (states empty/loading/ready/error)
- Interactions (click/tab/escape)
- Props edge cases
- Callbacks fired with correct args
- A11y (roles, aria-labels)
- Async behaviour (loading → result)

### Contract — `pnpm vitest run src/test/api-contracts`

Cibles : 9 routes API publish. Tests typiques par route :
- 200/201 success
- 400 sur chaque champ requis
- 400 sur chaque enum invalide
- 401 unauth
- 404 not-found
- 409 état métier invalide
- 429 rate-limit
- 500 service down
- Idempotency replay (where applicable)

### E2E mocked — `npx playwright test e2e/social-publishing/`

12 specs (cf `00-runbook.md` Phase 5). Mockent toutes les APIs via `page.route`.

### E2E live — `--grep @live` (opt-in)

1 spec : `live-instagram-alfenna.spec.ts`. Poste réellement, vérifie, cleanup. Voir `05-live-testing-protocol.md`.

### Cross-cutting

- A11y (axe-core) — 4 pages × 2 états (avant/après data)
- Dark mode — snapshots `prefers-color-scheme: dark`
- Responsive — 1440 / 1024 / 414 viewports
- Keyboard — Tab order, Esc, Cmd+S

## Données de test (fixtures)

Voir `test-battery/fixtures/` :
- `accounts/` : 5 comptes représentatifs
- `jobs/` : 8 jobs (1 par statut + retries)
- `posts/` : 3 posts approuvés/programmés/publiés
- `postiz-responses/` : réponses Postiz JSON (upload, posts, analytics, errors)
- `media/` : items image + vidéo mock

## Couverture cible

| Couche | Lignes | Branches |
|--------|--------|----------|
| Composants publish (create + plan) | ≥ 85% | ≥ 75% |
| Services social-publishing | ≥ 80% | ≥ 70% |
| Adapters | ≥ 90% | ≥ 80% |
| Routes API publish | ≥ 80% | ≥ 70% |
| **Global module** | **≥ 80%** | **≥ 70%** |

Voir `06-coverage-targets.md`.

## Outils

| Outil | Version | Rôle |
|-------|---------|------|
| Vitest | 2.1.x | Test runner Vitest |
| RTL | 16.x | Component testing |
| MSW | 2.x | HTTP mocking unit/component |
| Playwright | 1.59 | E2E |
| @axe-core/playwright | 4.11 | A11y audit |
| fast-check | 4.x | Property-based (optionnel) |

## Validation de la batterie elle-même

Pour s'assurer que les tests valident vraiment ce qu'on veut :
1. **Mutation testing** (optionnel) — Stryker sur 1-2 modules critiques
2. **3 runs identiques** — anti-flake gate
3. **Coverage gate** — fail si < seuil
4. **Reviewer checklist** — au moins 1 test métier + 1 test erreur par PR

## Boucle de correction

```
Pour chaque échec test :
1. Identifier nature : bug code / bug test / contrat / flake
2. Localiser (stack trace → fichier:ligne)
3. Corriger code en priorité
4. Re-run isolé → module → full
5. Documenter dans REGRESSION_NOTES.md si root cause non triviale
```

## Critères de done

- [ ] Toutes les couches au vert
- [ ] Couverture cibles atteintes
- [ ] 3 runs identiques anti-flake
- [ ] Live test S13 passe + cleanup OK
- [ ] PR review approuvée
