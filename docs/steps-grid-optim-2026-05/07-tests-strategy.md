# 07 — Stratégie de tests

## 1. Pyramide

```
                   ▲
                  ╱ ╲      E2E Playwright (smoke)
                 ╱   ╲     7 cas — @steps-*
                ╱─────╲
               ╱       ╲   Integration / MSW
              ╱         ╲  ~6 cas (G5 admin API)
             ╱───────────╲
            ╱             ╲ Unit Vitest (cœur)
           ╱_______________╲ ~40 cas
```

## 2. Couverture cible

| Module | Couverture branches |
|---|---|
| `lib/products/feed/types.ts` (juste types) | — |
| `lib/products/feed/schema.ts` (extension stepSchema) | ≥ 90 % |
| `lib/products/feed/kit-feed.ts` (buildSteps, buildHeader, buildPostCta) | ≥ 95 % |
| `lib/kit/steps/*` (G5 si livré) | ≥ 90 % |
| `components/sections/StepsTimeline.tsx` | ≥ 85 % |
| `components/sections/StepCard.tsx` | ≥ 90 % |
| `components/sections/StepIcon.tsx` | ≥ 95 % |
| `components/sections/StepsHeader.tsx` | ≥ 90 % |
| `components/sections/StepsPostCtaLink.tsx` | ≥ 90 % |
| `components/sections/StepsConnector.tsx` | ≥ 80 % |

## 3. Tests unitaires Vitest (détail)

### 3.1 Schemas (`schema.test.ts`)

- step accepte `duration` optionnel
- step accepte `isResult` optionnel
- step accepte `icon` enum
- stepsHeader valide (kicker / totalDuration / lead)
- stepsPostCta valide (label / anchorId)
- icon enum rejette valeur arbitraire

### 3.2 Builder (`kit-feed.test.ts`)

- 4 steps produits, tous avec `duration`
- step 4 a `isResult: true` et `icon: 'mirror'`
- step 1 a `icon: 'buffer'`, step 2 `drop`, step 3 `sparkle`
- stepsHeader.kicker = 'EN TOUT'
- stepsHeader.totalDuration = '5 minutes le soir'
- stepsPostCta.label = 'Démarrer le rituel'
- stepsPostCta.anchorId = 'commander-femiglow'
- assertValidProductFeed continue de passer en mode strict

### 3.3 Helpers (`lib/kit/steps/*.test.ts`)

- `computeTotalDuration` parse « 30 s », « 1 min », « 2 min »
- `pickResultStep` retourne le step `isResult` ou dernier par défaut
- Cas limites : array vide, durées non parseables

### 3.4 Composants

#### `StepsTimeline.test.tsx`
- rend StepsHeader si header présent
- ne rend pas StepsHeader si header absent (rétro-compat)
- rend les 4 cartes
- rend PostCtaLink si présent
- assigne `ref={resultRef}` sur step `isResult`
- IO `pack_steps_view` émis au seuil 0.4
- IO `pack_steps_complete_view` émis au seuil 0.5 sur step result
- `prefers-reduced-motion` désactive Framer Motion (skip wrapper m.div)
- cleanup observers au unmount

#### `StepCard.test.tsx`
- rend pastille avec accent color
- rend duration badge si `duration` présent
- ne rend pas badge si absent
- isResult → anneau doublé + badge RÉSULTAT + italique
- StepIcon rendu si `icon` présent
- pas d'icon si absent

#### `StepIcon.test.tsx`
- 4 icônes connues : buffer / drop / sparkle / mirror
- `aria-hidden=true`
- className propagée

#### `StepsHeader.test.tsx`
- rend kicker, h3, lead
- headingId propagé sur le h3

#### `StepsPostCtaLink.test.tsx`
- rend `<a href="#anchorId">`
- click émet `pack_steps_cta_click` avec cta_target
- preventDefault + scrollIntoView si l'ancre existe
- propage label

#### `StepsConnector.test.tsx`
- rend desktop element (hidden lg:block)
- rend mobile element (sm:hidden)
- les deux ont `aria-hidden=true`

### 3.5 Section parent

#### `ProductFeedSection.test.tsx` (mis à jour)
- garde axe 0 violation
- mock `StepsTimeline` pour isolation (server-only chains)

## 4. Tests MSW (G5 admin uniquement)

Si G5 livré, ajouter `apps/web/src/components/admin/kit-steps/KitStepsEditor.test.tsx` :

- Save → PATCH `/api/admin/kit/steps` (intercepter MSW)
- Publish → POST `/publish`
- Reset → POST `/reset`
- 401 sans session → afficher erreur
- 422 sur validation Zod → afficher détails

## 5. Tests E2E Playwright

### 5.1 `e2e/steps-timeline.spec.ts`

| Tag | Scénario |
|---|---|
| `@steps-render` | Section steps-timeline visible avec header + 4 cartes + PostCta |
| `@steps-render` | Step 4 porte data-is-result="true" |
| `@steps-render` | Pas de scroll horizontal mobile 375 |
| `@steps-interaction` | Click PostCtaLink → scroll vers `#commander-femiglow` |
| `@steps-interaction` | Tracking `pack_steps_cta_click` capturé via `page.on('request')` |
| `@steps-responsive` | Desktop 1280 : 4 colonnes ; mobile 375 : 1 colonne, ligne verticale gauche |
| `@steps-a11y` | 0 violation axe sérieuse/critique |

### 5.2 `e2e/admin-kit-steps.spec.ts` (G5 uniquement)

- Page protégée (redirect login sans session)
- Charge statut Mock
- Save activé après modification
- Reset bloque tant que `RESET-STEPS` non saisi
- Axe 0 violation

## 6. Setup spécifique

- Mock `IntersectionObserver` déjà présent dans `vitest.setup.ts`
- Pour tests émission events : mock custom IO qui déclenche `[{isIntersecting: true, intersectionRatio: 0.5}]`
- Mock `useTracking` retourne `{emit: vi.fn()}`
- Mock `next/dynamic` non nécessaire (composants Server)

## 7. CI / gate

- Pre-commit : `pnpm typecheck` + vitest run sur composants touchés
- CI : full vitest sweep + Playwright tags `@steps-*` × 3 runs (0 flake gate)
- Couverture rapport via `pnpm vitest --coverage` (gate sur seuils 85 % global)
