# Plan de développement P1 — Étapes détaillées

Chaque étape est atomique et committable indépendamment. L'ordre respecte les dépendances techniques.

---

## Étape 1 — Corriger les bugs backend (B1, B2)

### 1a. Simplifier le ternaire identique dans `insertReview`

**Fichier** : `apps/web/src/lib/content-studio/repository.ts` (ligne ~457)

Remplacer :
```typescript
status: review.status === 'blocked' ? 'needs_review' : 'needs_review',
```
par :
```typescript
// After brand review, draft always moves to needs_review
// regardless of whether violations were found.
// Approval is a separate action that checks for blocking violations.
status: 'needs_review',
```

### 1b. Enforcer la state machine dans `service.ts`

**Fichier** : `apps/web/src/lib/content-studio/service.ts`

Ajouter `assertTransition` avant chaque changement de statut :

```typescript
import { assertTransition } from './state-machine';

// Dans generateIdeaDrafts(), avant updateIdeaStatus :
assertTransition(idea.status, 'generated');

// Dans reviewContentDraft(), avant updateDraft :
assertTransition(draft.status, 'needs_review');

// Dans approveContentDraft(), avant le changement de statut :
assertTransition(draft.status, 'approved');

// Dans createDraftInPostiz(), avant updatePostPlanning :
assertTransition(post.status, 'scheduled');
```

### 1c. Ajouter les transitions manquantes dans `state-machine.ts`

**Fichier** : `apps/web/src/lib/content-studio/state-machine.ts`

Ajouter :
```typescript
// Cancel schedule: scheduled → approved
['scheduled', 'approved']: true,
// Request new generation: needs_review → generated
['needs_review', 'generated']: true,
```

### 1d. Tests pour la state machine enforce

**Fichier** : `apps/web/src/lib/content-studio/service.test.ts` (nouveau)

Tests :
- Transition valide : idea → generated passe
- Transition invalide : idea → approved jette `HttpError('invalid_state')`
- Transition invalide : approved → generated jette `HttpError('invalid_state')`
- Edge case : scheduled → approved (cancel schedule) passe
- Edge case : needs_review → generated (request variation) passe

---

## Étape 2 — Extraire les types partagés du client

### 2a. Créer `types.ts` dans le dossier composant

**Fichier** : `apps/web/src/components/admin/content-studio/types.ts` (nouveau)

Extraire depuis `ContentStudioClient.tsx` :
- `Integration`
- `StudioMediaItem`
- `MediaCompartment`
- `DraftAssetsByDraftId`
- `AutomationResponse`

### 2b. Mettre à jour les imports dans `ContentStudioClient.tsx`

Remplacer les types inline par des imports depuis `./types`.

---

## Étape 3 — Découper le composant monolithique

Découpage dans l'ordre des dépendances (feuilles d'abord, puis parents).

### 3a. Extraire `StudioGuide.tsx`

**Portion** : Section d'aide repliable en haut de page (lignes ~108-132)

Composant pur, pas de state local. Props : `enabled: boolean`.

### 3b. Extraire `DraftCardList.tsx`

**Portion** : Sidebar des drafts (lignes ~451-482)

Props : `drafts`, `selectedDraftId`, `onSelectDraft`.

### 3c. Extraire `MediaPicker.tsx`

**Portion** : Picker de médias avec compartiments importé/IA (lignes ~507-860)

State local : `mediaQuery`, `mediaCompartment`, `isLoadingMedia`.
Props : `mediaItems`, `selectedMediaId`, `onSelectMedia`, `draftId`.

Le `useEffect` de debounced media fetch (lignes 770-789) reste dans ce composant.

### 3d. Extraire `PlatformPreview.tsx`

**Portion** : Preview type réseau social (lignes ~530-544)

Composant pur. Props : `draft`, `mediaUrl`, `scheduledAt`.

### 3e. Extraire `PostizPanel.tsx`

**Portion** : Panneau de livraison Postiz + date cible (lignes ~545-630, ~960-1120)

State local : `integrationId`, `scheduledAt`.
Props : `post`, `deliveries`, `integrations`, `onSchedulePostiz`.

### 3f. Extraire `IdeaForm.tsx`

**Portion** : Formulaire de création d'idée (lignes ~320-430)

State local : `pillar`, `objective`, `platform`, `format`, `prompt`.
Props : `onCreateIdea`, `isPending`.

### 3g. Extraire `CalendarPipeline.tsx`

**Portion** : Pipeline éditorial en haut (lignes ~134-215)

Composant pur. Props : `posts`, `deliveries`, `snapshots`.

### 3h. Extraire `PostizHealthPanel.tsx`

**Portion** : Panneau de santé Postiz + automation (lignes ~943-1120)

State local : `automationJob`, `automationDryRun`.
Props : `deliveries`, `snapshots`, `onRunAutomation`.

### 3i. Extraire `AutomationActions.tsx`

**Portion** : Boutons d'automation dans le panneau santé

Composant pur. Props : `onSync`, `onRetry`, `onImportStatus`, `onImportPerformance`, `isPending`.

### 3j. Simplifier `ContentStudioClient.tsx`

Après extraction, le composant orchestrateur ne contient plus que :
- Le state centralisé (ideas, drafts, posts, etc.)
- Les handlers de mutation
- Le layout des colonnes
- Les appels API

Objectif : < 200 lignes.

---

## Étape 4 — Ajouter la validation client

### 4a. Utiliser les schemas Zod côté client

Importer les schemas existants dans les composants de formulaire :
- `contentIdeaCreateSchema` dans `IdeaForm`
- `draftUpdateSchema` dans `DraftEditor`
- `visualGenerationSchema` dans `MediaPicker`
- `postizDraftSchema` dans `PostizPanel`

Valider avant chaque appel API. Afficher les erreurs de validation en inline.

### 4b. Ajouter aria-live pour les messages de statut

Ajouter `role="status"` et `aria-live="polite"` sur la zone de message/error.

### 4c. Ajouter `rel="noopener noreferrer"` sur les liens externes

Corriger le `target="_blank"` sans `rel`.

### 4d. Supprimer le dead code

Supprimer le bloc `if` vide aux lignes 436-438.

---

## Étape 5 — Ajouter les tests unitaires

### 5a. Service tests

**Fichier** : `apps/web/src/lib/content-studio/service.test.ts` (nouveau)

Tests :
- `createContentIdea()` — création avec données valides
- `generateIdeaDrafts()` — transition idea → generated
- `generateIdeaDrafts()` — rejette si statut invalide
- `approveContentDraft()` — transition needs_review → approved
- `approveContentDraft()` — rejette si violations bloquantes
- `createDraftInPostiz()` — transition approved → scheduled

### 5b. Auth tests

**Fichier** : `apps/web/src/lib/content-studio/auth.test.ts` (nouveau)

Tests :
- `requireContentStudioEnabled()` — passe si enabled
- `requireContentStudioEnabled()` — jette HttpError si disabled
- `requireAdminApi()` — jette HttpError 401 si pas de session

### 5c. Component tests

**Fichier** : `apps/web/src/components/admin/content-studio/StudioGuide.test.tsx` (nouveau)

Tests :
- Rend le guide si enabled
- Affiche le warning si disabled

**Fichier** : `apps/web/src/components/admin/content-studio/DraftCardList.test.tsx` (nouveau)

Tests :
- Rend la liste des drafts
- Sélectionne un draft au clic

---

## Étape 6 — Ajouter les tests d'intégration API avec MSW

### 6a. Setup MSW handlers pour Content Studio

**Fichier** : `apps/web/src/test/msw/content-studio.ts` (nouveau)

Handlers MSW pour :
- `GET /api/admin/content-studio/ideas` → 200 avec liste d'idées
- `POST /api/admin/content-studio/ideas` → 201 avec idée créée
- `POST /api/admin/content-studio/ideas/:id/generate` → 200 avec drafts
- `GET /api/admin/content-studio/drafts` → 200 avec liste
- `PATCH /api/admin/content-studio/drafts/:id` → 200 avec draft mis à jour
- `POST /api/admin/content-studio/drafts/:id/approve` → 200 avec post
- `POST /api/admin/content-studio/automation` → 200 avec résultat
- `GET /api/admin/content-studio/media` → 200 avec liste média

### 6b. Tests d'intégration API route

**Fichier** : `apps/web/src/lib/content-studio/api-routes.test.ts` (nouveau)

Tests avec MSW mockant le service layer :
- Auth : sans session → 401
- Auth : sans Content Studio enabled → 403
- CRUD idées : créer, lister
- Workflow : créer idée → générer → reviewer → approuver → programmer
- Erreurs : validation Zod → 400, transition invalide → 409

---

## Étape 7 — Ajouter les tests E2E Playwright

### 7a. Setup E2E pour Content Studio

**Fichier** : `apps/web/e2e/content-studio.spec.ts` (nouveau)

Tests Playwright :
- Page charge correctement quand enabled
- Redirige vers login si pas de session
- Affiche le guide d'aide
- Créer une idée
- Générer des drafts
- Sélectionner un draft
- Approuver un draft (si workflow complet)

### 7b. Ajouter les factories de test

**Fichier** : `apps/web/src/test/factories/content-studio.ts` (nouveau)

Builders :
- `buildContentIdea(overrides)`
- `buildContentDraft(overrides)`
- `buildContentPost(overrides)`
- `buildContentPostizDelivery(overrides)`

---

## Étape 8 — Mettre à jour la configuration de couverture

### 8a. Étendre la config Vitest pour inclure Content Studio

**Fichier** : `apps/web/vitest.config.ts`

Ajouter au coverage `include` :
```
'src/lib/content-studio/**',
'src/components/admin/content-studio/**',
```

### 8b. Configurer les seuils de couverture pour Content Studio

Objectifs :
- Statements : 80%
- Lines : 80%
- Functions : 70%
- Branches : 70%

---

## Étape 9 — Mettre à jour le runbook

### 9a. Mettre à jour `130-runbook/prototype-runbook.md`

Ajouter :
- Les corrections de bugs B1 et B2
- Le refactoring du composant
- La liste des nouveaux tests
- Les 8 commits de référence
- Le plan de reprise P1-P5

---

## Ordre d'exécution

```
Étape 1 (bugs backend) → commit
Étape 2 (types partagés) → commit
Étape 3a-3j (découpage UI) → 1-2 commits par composant, max 5 commits total
Étape 4 (validation + accessibilité) → 1 commit
Étape 5 (tests unitaires) → 1 commit
Étape 6 (MSW + API tests) → 1 commit
Étape 7 (Playwright E2E) → 1 commit
Étape 8 (coverage config) → 1 commit
Étape 9 (runbook) → 1 commit
```

Total estimé : ~12-15 commits