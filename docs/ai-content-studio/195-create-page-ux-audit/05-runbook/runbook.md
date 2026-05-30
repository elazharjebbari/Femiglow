# Runbook d'Execution -- Corrections UX Page Creation AI Engine

**Version:** 1.0
**Date:** 2026-05-27
**Prerequis:** Node 20+, pnpm, branch `feat/create-page-ux-fixes` creee depuis `feat/ai-engine-langgraph-mvp`

---

## Table des matieres

1. [Prerequisites et setup](#1-prerequisites-et-setup)
2. [Phase 1 -- P6 Stepper horizontal](#2-phase-1--p6-stepper-horizontal)
3. [Phase 2 -- P5 Mock publish chain](#3-phase-2--p5-mock-publish-chain)
4. [Phase 3 -- P3 Toggle review humaine](#4-phase-3--p3-toggle-review-humaine)
5. [Phase 4 -- P4 Video player](#5-phase-4--p4-video-player)
6. [Phase 5 -- P1 Model Preset Selector](#6-phase-5--p1-model-preset-selector)
7. [Phase 6 -- P2 Section Parametres avances](#7-phase-6--p2-section-parametres-avances)
8. [Validation finale](#8-validation-finale)
9. [Procedure de rollback global](#9-procedure-de-rollback-global)

---

## 1. Prerequisites et setup

### 1.1 Verifier l'environnement

```bash
# Verifier Node
node --version   # >= 20.0.0

# Verifier pnpm
pnpm --version   # >= 8.0.0

# Verifier que le projet compile
cd apps/web
pnpm run build --no-lint 2>&1 | tail -5
```

### 1.2 Creer la branche de travail

```bash
git checkout feat/ai-engine-langgraph-mvp
git pull origin feat/ai-engine-langgraph-mvp
git checkout -b feat/create-page-ux-fixes
```

### 1.3 Verifier que les tests existants passent

```bash
# Tests unitaires
pnpm vitest run src/app/admin/content-studio-v2/ai-engine/create/ --reporter=verbose

# Tests E2E (si Playwright configure)
pnpm playwright test e2e/content-studio-v2/ --grep "ai-engine"
```

### 1.4 Identifier les fichiers cles

```
apps/web/src/app/admin/content-studio-v2/ai-engine/create/page.tsx       # Page principale (927 lignes)
apps/web/src/components/admin/content-studio-v2/ai-engine/GenerationResult.tsx  # Affichage resultat
apps/web/src/components/admin/content-studio-v2/ai-engine/GenerationProgress.tsx # Progression pipeline
apps/web/src/components/admin/content-studio-v2/ai-engine/ModelSelector.tsx     # Selecteur modele
apps/web/src/test/msw/ai-engine-handlers.ts                                    # Handlers mock
```

---

## 2. Phase 1 -- P6 Stepper horizontal

### 2.1 Creer le composant Stepper

**Fichier:** `src/components/admin/content-studio-v2/ai-engine/Stepper.tsx`

Creer le composant avec:
- Interface `StepDef { label: string; status: 'pending' | 'active' | 'completed' }`
- Interface `StepperProps { steps: StepDef[]; mockMode?: boolean }`
- Rendu: 4 cercles numerotes + lignes horizontales + labels
- Couleurs: pending=gray, active=accent+pulse, completed=green+checkmark
- Badge "Mode Mock" optionnel en haut a droite

### 2.2 Creer les tests du Stepper

**Fichier:** `src/components/admin/content-studio-v2/ai-engine/__tests__/Stepper.test.tsx`

Tests a couvrir:
- Affiche 4 etapes avec les bons labels
- L'etape active a la classe/style accent
- Les etapes completees ont un checkmark
- Les etapes futures sont grisees
- Le badge "Mode Mock" s'affiche quand mockMode=true
- Le badge "Mode Mock" ne s'affiche pas quand mockMode=false

### 2.3 Integrer dans page.tsx

Modifier `src/app/admin/content-studio-v2/ai-engine/create/page.tsx`:

1. Ajouter l'import du Stepper
2. Creer la fonction `mapPhaseToSteps(phase: Phase): StepDef[]`
3. Ajouter `<Stepper steps={mapPhaseToSteps(phase)} />` apres le header, avant le contenu conditionnel

### 2.4 Verification Phase 1

```bash
# Tests unitaires du Stepper
pnpm vitest run src/components/admin/content-studio-v2/ai-engine/__tests__/Stepper.test.tsx --reporter=verbose

# Tests existants ne cassent pas
pnpm vitest run src/app/admin/content-studio-v2/ai-engine/create/ --reporter=verbose

# Build check
pnpm run build --no-lint 2>&1 | tail -5

# TypeScript check
pnpm tsc --noEmit 2>&1 | grep -c "error" || echo "0 errors"
```

### 2.5 Commit Phase 1

```bash
git add src/components/admin/content-studio-v2/ai-engine/Stepper.tsx
git add src/components/admin/content-studio-v2/ai-engine/__tests__/Stepper.test.tsx
git add src/app/admin/content-studio-v2/ai-engine/create/page.tsx
git commit -m "feat(ui): add horizontal stepper (P6) to AI Engine create page

4-step stepper: Brief > Generation > Review > Publication
Maps Phase state machine to visual progression indicators.
Completed steps show green checkmark, active step pulses accent."
```

---

## 3. Phase 2 -- P5 Mock publish chain

### 3.1 Enrichir la reponse mock

Le MOCK_GENERATION_RESULT dans `ai-engine-handlers.ts` contient deja un `bridgeResult`. Verifier qu'il est bien present:

```typescript
bridgeResult: { ideaId: 'ci_test001', briefId: 'cb_test001', draftId: 'cd_test001' },
```

### 3.2 Modifier page.tsx pour le fallback bridgeResult

Dans `handleGenerate()`, apres reception de `data`:

```typescript
const effectiveBridgeResult = data.bridgeResult ?? {
  ideaId: `mock-idea-${Date.now()}`,
  briefId: `mock-brief-${Date.now()}`,
  draftId: `mock-draft-${Date.now()}`,
};
```

Utiliser `effectiveBridgeResult` au lieu de `data.bridgeResult`.

### 3.3 Ajouter le badge "Mode Mock" dans PublishSection

Modifier `GenerationResult.tsx` -- ajouter dans `PublishSection`:
- Detecter si le draftId est un mock (prefix `mock-` ou `cd_test`)
- Afficher un badge discret "Mode Mock" en orange

### 3.4 Enrichir le handler mock publish (optionnel)

Si le handler existant est suffisant (`{ success: true, postId: 'post-001' }`), pas de modification necessaire. Sinon, enrichir avec le mode (now/schedule) et un message de confirmation.

### 3.5 Verification Phase 2

```bash
# Tests unitaires
pnpm vitest run src/app/admin/content-studio-v2/ai-engine/create/ --reporter=verbose
pnpm vitest run src/components/admin/content-studio-v2/ai-engine/ --reporter=verbose

# Build check
pnpm run build --no-lint 2>&1 | tail -5

# Verification manuelle (dev server)
# 1. Ouvrir /admin/content-studio-v2/ai-engine/create
# 2. Remplir le brief et generer
# 3. Verifier que la section "Publier" apparait
# 4. Verifier que le badge "Mode Mock" est visible
# 5. Cliquer "Publier maintenant" et verifier le message de succes
```

### 3.6 Commit Phase 2

```bash
git add src/app/admin/content-studio-v2/ai-engine/create/page.tsx
git add src/components/admin/content-studio-v2/ai-engine/GenerationResult.tsx
git add src/test/msw/ai-engine-handlers.ts  # si modifie
git commit -m "feat(ui): enable publish section in mock mode (P5)

BridgeResult fallback ensures PublishSection always renders after generation.
Mock publish handler returns simulated success.
Discreet 'Mode Mock' badge warns operator when using mock IDs."
```

---

## 4. Phase 3 -- P3 Toggle review humaine

### 4.1 Ajouter le state humanReviewEnabled

Dans `page.tsx`, ajouter:
- `const [humanReviewEnabled, setHumanReviewEnabled] = useState(false)`
- `const [pendingResult, setPendingResult] = useState<any>(null)`

### 4.2 Ajouter le toggle dans le brief form

Position temporaire: apres la grille des textareas, avant le bouton "Generer".

### 4.3 Modifier handleGenerate()

Ajouter la logique conditionnelle:
- Si `humanReviewEnabled` ET le backend ne retourne pas `status: 'review'`
- Construire un `reviewPayload` a partir du resultat genere
- Stocker le resultat dans `pendingResult`
- Transitionner vers `phase === 'review'`

### 4.4 Modifier handleReviewDecision()

Ajouter la gestion des decisions mock:
- `approved` : utiliser `pendingResult` comme resultat final
- `rejected` : retourner au brief (`handleReset()`)
- `edit_requested` : simuler un delai puis rester en review

### 4.5 Ajouter humanReviewRequired au body POST

Ajouter `humanReviewRequired: humanReviewEnabled` dans le body JSON.

### 4.6 Modifier le handler MSW generate

Rendre le handler conditionnel : si le body contient `humanReviewRequired: true`, retourner `status: 'review'`.

### 4.7 Nettoyer pendingResult dans handleReset

Ajouter `setPendingResult(null)` dans `handleReset()`.

### 4.8 Verification Phase 3

```bash
# Tests unitaires
pnpm vitest run src/app/admin/content-studio-v2/ai-engine/create/ --reporter=verbose

# Build check
pnpm run build --no-lint 2>&1 | tail -5

# Verification manuelle
# 1. Ouvrir /admin/content-studio-v2/ai-engine/create
# 2. Cocher "Review humaine avant publication"
# 3. Remplir le brief et generer
# 4. Verifier que le stepper montre etape 3 (Review) active
# 5. Verifier que le ReviewPanel affiche le contenu genere
# 6. Cliquer "Approuver" -> verifier transition vers resultat
# 7. Recommencer, cette fois cliquer "Rejeter" -> verifier retour au brief
# 8. Recommencer, decocher le toggle, generer -> verifier que review est bypassee
```

### 4.9 Commit Phase 3

```bash
git add src/app/admin/content-studio-v2/ai-engine/create/page.tsx
git add src/test/msw/ai-engine-handlers.ts
git commit -m "feat(ui): add human review toggle with mock support (P3)

Toggle 'Review humaine avant publication' in brief form.
When enabled, generation passes through review phase with mock payload.
Approve/Edit/Reject buttons functional. MSW handler respects the flag."
```

---

## 5. Phase 4 -- P4 Video player

### 5.1 Enrichir l'interface GenerationResultData

Ajouter le type `VideoAsset` et le champ `videos?: VideoAsset[]` dans `GenerationResult.tsx`.

### 5.2 Ajouter la section Videos dans GenerationResult

Apres la section "Visuels" (images), ajouter une CollapsibleSection "Videos" avec:
- Player `<video controls>` pour chaque video
- Badges: duree, resolution, provider
- Condition: `videos && videos.length > 0`

### 5.3 Ajouter l'import Film de lucide-react

```typescript
import { ..., Film } from 'lucide-react';
```

### 5.4 Enrichir les mock videos dans MSW

Modifier `MOCK_GENERATION_RESULT.videos` dans `ai-engine-handlers.ts`:

```typescript
videos: [
  {
    assetId: 'mock-video-001',
    url: '/_media/ai-engine/mock/test-video.mp4',
    mimeType: 'video/mp4',
    width: 1080,
    height: 1920,
    durationMs: 15000,
    provider: 'mock',
  },
],
```

### 5.5 Verification Phase 4

```bash
# Tests unitaires
pnpm vitest run src/components/admin/content-studio-v2/ai-engine/ --reporter=verbose

# Build check
pnpm run build --no-lint 2>&1 | tail -5

# Verification manuelle
# 1. Ouvrir /admin/content-studio-v2/ai-engine/create
# 2. Generer du contenu
# 3. Verifier que la section "Videos (1)" apparait dans le resultat
# 4. Verifier que le player video est present avec controles
# 5. Verifier les badges (15.0s, 1080x1920, mock)
# 6. Verifier que la section n'apparait PAS si videos est vide
```

### 5.6 Commit Phase 4

```bash
git add src/components/admin/content-studio-v2/ai-engine/GenerationResult.tsx
git add src/test/msw/ai-engine-handlers.ts
git commit -m "feat(ui): add video player section in GenerationResult (P4)

HTML5 video player with controls for generated videos.
Duration, resolution, and provider badges displayed.
Mock video URL from FFmpeg mock generator."
```

---

## 6. Phase 5 -- P1 Model Preset Selector

### 6.1 Creer ModelPresetSelector.tsx

**Fichier:** `src/components/admin/content-studio-v2/ai-engine/ModelPresetSelector.tsx`

Implementer:
- 4 boutons segmentes: Auto | Rapide | Premium | Personnalise
- Mode "Personnalise" affiche le ModelSelector existant
- Mapping preset -> modele concret

### 6.2 Creer les tests

**Fichier:** `src/components/admin/content-studio-v2/ai-engine/__tests__/ModelPresetSelector.test.tsx`

Tests a couvrir:
- Affiche 4 boutons avec les bons labels
- Le bouton selectionne a le style accent
- Cliquer change le preset
- Mode "custom" affiche le ModelSelector
- Mode "auto" ne montre pas le ModelSelector

### 6.3 Integrer dans page.tsx (position temporaire)

Ajouter les states et le composant dans le formulaire brief, apres le select "Ton".

### 6.4 Envoyer le modele dans le POST body

Ajouter `textModel` dans le body JSON de `handleGenerate()`.

### 6.5 Verification Phase 5

```bash
# Tests unitaires du composant
pnpm vitest run src/components/admin/content-studio-v2/ai-engine/__tests__/ModelPresetSelector.test.tsx --reporter=verbose

# Tests existants
pnpm vitest run src/app/admin/content-studio-v2/ai-engine/create/ --reporter=verbose

# Build check
pnpm run build --no-lint 2>&1 | tail -5

# Verification manuelle
# 1. Ouvrir la page creation
# 2. Verifier que le segmented control apparait
# 3. Cliquer "Rapide" -> verifier que le bouton est mis en valeur
# 4. Cliquer "Personnalise" -> verifier que le ModelSelector s'ouvre
# 5. Selectionner un modele -> generer -> verifier le body dans Network tab
```

### 6.6 Commit Phase 5

```bash
git add src/components/admin/content-studio-v2/ai-engine/ModelPresetSelector.tsx
git add src/components/admin/content-studio-v2/ai-engine/__tests__/ModelPresetSelector.test.tsx
git add src/app/admin/content-studio-v2/ai-engine/create/page.tsx
git commit -m "feat(ui): add model preset selector for text generation (P1)

4-button segmented control: Auto | Rapide | Premium | Personnalise.
Custom mode opens full ModelSelector with capability=text filter.
Selected model sent in POST /generate body as textModel field."
```

---

## 7. Phase 6 -- P2 Section Parametres avances

### 7.1 Creer AdvancedParams.tsx

**Fichier:** `src/components/admin/content-studio-v2/ai-engine/AdvancedParams.tsx`

Implementer la section pliable contenant:
1. ModelPresetSelector (texte)
2. ModelSelector (image, capability=image)
3. ModelSelector (video, capability=video, conditionnel)
4. Toggle "Generer les visuels"
5. Toggle "Review humaine"

### 7.2 Creer les tests

**Fichier:** `src/components/admin/content-studio-v2/ai-engine/__tests__/AdvancedParams.test.tsx`

Tests a couvrir:
- Section fermee par defaut
- Cliquer ouvre la section
- Tous les sous-composants sont rendus
- Le modele video est masque pour text_post
- Le modele video est visible pour reel
- Les toggles fonctionnent

### 7.3 Integrer dans page.tsx et nettoyer

1. Ajouter les nouveaux states (imageModel, videoModel, generateVisuals)
2. Remplacer le toggle review temporaire par le composant AdvancedParams
3. Retirer le ModelPresetSelector temporaire du brief form
4. Ajouter les nouveaux champs au body POST
5. Ajouter la logique conditionnelle `showVideoModel`

### 7.4 Verification Phase 6

```bash
# Tests unitaires du composant
pnpm vitest run src/components/admin/content-studio-v2/ai-engine/__tests__/AdvancedParams.test.tsx --reporter=verbose

# TOUS les tests unitaires
pnpm vitest run src/components/admin/content-studio-v2/ai-engine/ --reporter=verbose
pnpm vitest run src/app/admin/content-studio-v2/ai-engine/create/ --reporter=verbose

# Build check
pnpm run build --no-lint 2>&1 | tail -5

# TypeScript check
pnpm tsc --noEmit 2>&1 | grep -c "error" || echo "0 errors"
```

### 7.5 Commit Phase 6

```bash
git add src/components/admin/content-studio-v2/ai-engine/AdvancedParams.tsx
git add src/components/admin/content-studio-v2/ai-engine/__tests__/AdvancedParams.test.tsx
git add src/app/admin/content-studio-v2/ai-engine/create/page.tsx
git commit -m "feat(ui): add collapsible advanced params section (P2)

Groups text/image/video model selectors with visual generation
and human review toggles. Closed by default.
Video model hidden for text_post/infographic formats.
Consolidates P1 and P3 controls into single advanced section."
```

---

## 8. Validation finale

### 8.1 Suite complete de tests unitaires

```bash
cd apps/web

# Tous les tests AI Engine
pnpm vitest run src/components/admin/content-studio-v2/ai-engine/ --reporter=verbose
pnpm vitest run src/app/admin/content-studio-v2/ai-engine/ --reporter=verbose

# Compter les tests
pnpm vitest run src/components/admin/content-studio-v2/ai-engine/ 2>&1 | tail -3
pnpm vitest run src/app/admin/content-studio-v2/ai-engine/ 2>&1 | tail -3
```

### 8.2 Build complet

```bash
pnpm run build 2>&1 | tail -10
# Verifier: "Build completed successfully" ou equivalent
# Verifier: 0 erreurs TypeScript
```

### 8.3 Tests E2E

```bash
# Golden path complet
pnpm playwright test e2e/content-studio-v2/ --grep "ai-engine" --reporter=list

# Tests specifiques si existants
pnpm playwright test e2e/content-studio-v2/ --grep "create" --reporter=list
```

### 8.4 Verification manuelle complete

Effectuer le parcours complet sur le dev server:

```bash
pnpm dev
# Ouvrir http://localhost:3000/admin/content-studio-v2/ai-engine/create
```

**Checklist manuelle:**

1. [ ] Le stepper 4 etapes est visible en haut de page
2. [ ] L'etape "Brief" est active au chargement
3. [ ] La section "Parametres avances" est visible, fermee par defaut
4. [ ] Ouvrir les parametres avances montre tous les controles
5. [ ] Le ModelPresetSelector texte affiche 4 boutons
6. [ ] Le ModelSelector image est present
7. [ ] Le ModelSelector video est present (pour format reel)
8. [ ] Changer le format en "Post texte" masque le modele video
9. [ ] Le toggle "Generer les visuels" fonctionne
10. [ ] Le toggle "Review humaine" fonctionne
11. [ ] Remplir le brief et generer sans review: stepper passe 1->2->4
12. [ ] Activer review et generer: stepper passe 1->2->3
13. [ ] En review: approuver -> stepper passe 3->4, resultat affiche
14. [ ] En review: rejeter -> retour au brief
15. [ ] En review: modifier -> reste en review avec textarea
16. [ ] Dans le resultat: section "Videos" visible avec player
17. [ ] Dans le resultat: badges duree/resolution/provider
18. [ ] Dans le resultat: section "Publier" visible avec badge "Mode Mock"
19. [ ] Publier maintenant: message de succes
20. [ ] Planifier: datetime picker + message de succes

### 8.5 Verification de regression

```bash
# Tests de toute la suite Content Studio v2 (pas seulement AI Engine)
pnpm vitest run src/components/admin/content-studio-v2/ --reporter=verbose
pnpm vitest run src/app/admin/content-studio-v2/ --reporter=verbose
```

### 8.6 Lint et format

```bash
pnpm lint -- --fix
pnpm format 2>/dev/null || npx prettier --write "src/components/admin/content-studio-v2/ai-engine/**/*.{ts,tsx}"
```

### 8.7 Commit final (si nettoyage lint)

```bash
git add -A
git diff --cached --stat
git commit -m "chore: lint and format fixes after UX corrections"
```

### 8.8 Push et PR

```bash
git push -u origin feat/create-page-ux-fixes

gh pr create \
  --base feat/ai-engine-langgraph-mvp \
  --title "feat(ui): fix 6 UX problems on AI Engine Create page" \
  --body "## Summary
- P6: Horizontal 4-step stepper (Brief > Generation > Review > Publication)
- P5: Mock publish chain with bridge result fallback + Mode Mock badge
- P3: Human review toggle with full mock support (approve/edit/reject)
- P4: Video player section in GenerationResult with metadata badges
- P1: Model preset selector (Auto/Fast/Premium/Custom) for text generation
- P2: Collapsible Advanced Params section grouping all model/toggle controls

## Test plan
- [ ] All new unit tests pass (Stepper, ModelPresetSelector, AdvancedParams)
- [ ] Existing test suite has no regressions
- [ ] Build succeeds with zero TypeScript errors
- [ ] Manual walkthrough of complete golden path (brief > generate > review > result > publish)
- [ ] Responsive check on mobile viewport"
```

---

## 9. Procedure de rollback global

### 9.1 Rollback complet (toutes les phases)

```bash
# Identifier le commit avant les changements
git log --oneline -10

# Revenir au commit initial
git revert --no-commit HEAD~6..HEAD
git commit -m "revert: rollback all 6 UX fixes on Create page"
```

### 9.2 Rollback partiel (une phase specifique)

Chaque phase est un commit atomique. Pour reverter une phase specifique:

```bash
# Trouver le hash du commit a reverter
git log --oneline -10

# Reverter ce commit specifique
git revert <commit-hash>
```

**Attention aux dependances:**
- Reverter P6 (Stepper) sans reverter P3/P5 est possible (le stepper est additif)
- Reverter P5 (Mock Publish) sans reverter P3 est possible
- Reverter P3 (Toggle Review) necessite de verifier que P2 n'utilise pas le toggle
- Reverter P1 (Model Preset) necessite de reverter P2 (qui l'integre)
- Reverter P2 (Advanced Params) necessite de remettre les controles temporaires de P1 et P3

### 9.3 Rollback fichier par fichier

Si un fichier specifique cause un probleme:

```bash
# Restaurer un fichier specifique a l'etat avant les changements
git checkout feat/ai-engine-langgraph-mvp -- path/to/file.tsx
git add path/to/file.tsx
git commit -m "fix: restore original version of file.tsx"
```

### 9.4 Verification post-rollback

Apres tout rollback:

```bash
pnpm vitest run src/app/admin/content-studio-v2/ai-engine/ --reporter=verbose
pnpm vitest run src/components/admin/content-studio-v2/ai-engine/ --reporter=verbose
pnpm run build --no-lint 2>&1 | tail -5
```
