# Runbook P1 — Exécution pas-à-pas

**Serveur** : staging.femiglow-maroc.com (`/var/www/femiglow-staging`)
**Branche** : master
**Environnement** : `apps/web/`

---

## État d'avancement

| Étape | Statut | Commit |
|-------|--------|--------|
| 1 — Bugs backend | ✅ Terminé | `11cf84d` |
| 2 — Types partagés | ✅ Terminé | `d93095f` |
| 3 — Découpage UI | ✅ Terminé | `218b6ae`, `527265c`, `0f2dca0` |
| 4 — Accessibilité | ✅ Terminé (aria-live, noopener, dead code) | `5f717fb` |
| 4b — Validation Zod | ⏳ Non commencé | — |
| 5 — Tests unitaires | ✅ Terminé | `c542e43`, `dc65f9b`, `29353dc` |
| 6 — Tests intégration MSW | ✅ Terminé | `5bd81d6` |
| 7 — Tests E2E Playwright | ⏳ Non commencé | — |
| 8 — Configuration couverture | ✅ Terminé | `dc65f9b` |
| 9 — Mise à jour runbook | ✅ Ce document | — |

### Résumé des commits P1

```
5bd81d6 test(content-studio): add MSW handlers and API integration tests
29353dc test(content-studio): add unit tests for extracted components
0f2dca0 refactor(content-studio): extract major components from monolith
5f717fb fix(content-studio): add aria-live, rel=noopener, remove dead code
527265c refactor(content-studio): extract Select and API helpers to separate files
218b6ae refactor(content-studio): extract utility components and helpers from monolith
d93095f refactor(content-studio): extract shared types to separate module
11cf84d fix(content-studio): enforce state machine transitions and fix insertReview ternary
3757976 fix(content-studio): return JSON 401 instead of redirect on API auth failure
```

### Statistiques tests

- **118 tests** passent sur **14 fichiers** de test
- Couverture : `src/lib/content-studio/**`, `src/components/admin/content-studio/**`
- Seuils : 80% statements/lines/functions, 70% branches

### Réduction du monolithe

| Fichier | Avant | Après |
|---------|-------|-------|
| `ContentStudioClient.tsx` | 1567 lignes | 203 lignes |

Composants extraits : `IdeaForm`, `DraftEditor` (+ `VisualGenerator`, `MediaPicker`, `DeliveryPanel`), `PostizHealthPanel` (+ `OpsMetric`), `EditorialCalendar` (+ `Metric`), `PostizPanel`, `SectionTitle`, `DeliveryStatusBadge`, `PlatformPreview`, `StudioGuide`, `Select`, `api.ts`, `helpers.ts`, `types.ts`

---

## Prérequis

```bash
cd /var/www/femiglow-staging
# Vérifier que le service tourne
systemctl status femiglow-staging
# Vérifier que les tests existants passent
pnpm --filter @femiglow/web test -- --reporter=verbose 2>&1 | tail -20
```

---

## Étape 1 — Corriger les bugs backend ✅

### 1a. Corriger le ternaire identique dans repository.ts ✅

Ligne ~457, remplacé `status: review.status === 'blocked' ? 'needs_review' : 'needs_review'` par `status: 'needs_review'`.

### 1b. Enforcer la state machine dans service.ts ✅

Ajouté `import { assertTransition } from './state-machine'` et appels avant chaque changement de statut.

### 1c. Ajouter les transitions manquantes dans state-machine.ts ✅

Ajouté `['scheduled', 'approved']: true` et `['needs_review', 'generated']: true`.

### 1d. Écrire les tests ✅

Créé `service.test.ts` (40 tests transitions) et `auth.test.ts` (3 tests).

**Commit** : `11cf84d fix(content-studio): enforce state machine transitions and fix insertReview ternary`

---

## Étape 2 — Types partagés ✅

Créé `types.ts` avec `Integration`, `StudioMediaItem`, `DraftAssetsByDraftId`, `MediaCompartment`, `AutomationResponse`, `RunFunction`.

**Commit** : `d93095f refactor(content-studio): extract shared types to separate module`

---

## Étape 3 — Découpage UI ✅

Extraction progressive des composants du monolithe :

- `StudioGuide.tsx`, `SectionTitle.tsx`, `DeliveryStatusBadge.tsx`, `PlatformPreview.tsx`, `helpers.ts`, `Select.tsx`, `api.ts`
- `IdeaForm.tsx`, `DraftEditor.tsx` (+ VisualGenerator, MediaPicker, DeliveryPanel), `PostizHealthPanel.tsx` (+ OpsMetric), `EditorialCalendar.tsx` (+ Metric), `PostizPanel.tsx`

ContentStudioClient.tsx passé de 1567 → 203 lignes.

**Commits** : `218b6ae`, `527265c`, `0f2dca0`

---

## Étape 4 — Validation client + accessibilité ✅ (partiel)

- ✅ aria-live="polite", role="status", role="alert" sur messages/erreurs
- ✅ rel="noopener noreferrer" sur liens externes
- ✅ Dead code supprimé
- ⏳ Validation Zod côté client — non commencé (P2)

**Commit** : `5f717fb fix(content-studio): add aria-live, rel=noopener, remove dead code`

---

## Étape 5 — Tests unitaires ✅

- `state-machine.test.ts` — 40 tests transitions
- `auth.test.ts` — 3 tests auth
- `automation.test.ts` — 3 tests (préexistant)
- `SectionTitle.test.tsx` — 4 tests
- `DeliveryStatusBadge.test.tsx` — 4 tests
- `PlatformPreview.test.tsx` — 3 tests
- `IdeaForm.test.tsx` — 3 tests
- `EditorialCalendar.test.tsx` — 3 tests
- `PostizPanel.test.tsx` — 3 tests

**Commits** : `c542e43`, `dc65f9b`, `29353dc`

---

## Étape 6 — Tests d'intégration API (MSW) ✅

Créé `content-studio-handlers.ts` avec 8 handlers MSW et `content-studio-handlers.test.ts` avec 8 tests couvrant :
- POST /ideas (création)
- POST /ideas/:id/generate (génération)
- PATCH /drafts/:id (mise à jour)
- POST /drafts/:id/approve (approbation)
- GET /media (liste médias)
- POST /automation (jobs)
- POST /postiz/integrations/sync (sync)

**Commit** : `5bd81d6 test(content-studio): add MSW handlers and API integration tests`

---

## Étape 7 — Tests E2E Playwright ⏳

Non commencé — nécessite un serveur en cours d'exécution et une configuration Playwright.

---

## Étape 8 — Configuration couverture ✅

Ajouté `src/lib/content-studio/**/*.{ts,tsx}` et `src/components/admin/content-studio/**/*.{ts,tsx}` au coverage include dans `vitest.config.ts`.

**Commit** : `dc65f9b test(content-studio): add test factories and extend vitest coverage config`

---

## Validation finale

```bash
cd /var/www/femiglow-staging/apps/web

# TypeScript (seulement 3 erreurs pré-existantes dans postiz.test.ts)
npx tsc --noEmit

# Tests unitaires (118 tests, 14 fichiers)
npx vitest run src/lib/content-studio/ src/components/admin/content-studio/

# Build
npx next build

# Redémarrer staging
systemctl restart femiglow-staging

# Vérifier l'API sans session
curl -s http://localhost:8012/api/admin/content-studio/ideas | python3 -m json.tool
# Attendu : {"error": {"code": "unauthorized", "message": "Session expirée..."}}
```

---

## Problèmes connus (pré-existants)

1. **`image-generation.test.ts`** : Le test `sharp` ne fonctionne pas en environnement de test (module natif non disponible). Pas lié aux changements P1.
2. **`postiz.test.ts`** : 3 erreurs TypeScript "Object is possibly 'undefined'" — pré-existantes, pas liées aux changements P1.

---

## Rollback

Si une étape casse quelque chose :

```bash
git log --oneline -10
git revert HEAD
# Ou annuler les changements non-committés
git checkout -- .
```

---

## P2 et suivants (non commencés)

- **P2** : Actions de review (approbation/refus), éditeur de brief
- **P3** : Calendrier éditorial interactif, tableau de bord Postiz
- **P4** : Notes/tags, tracking UTM, analytics
- **P5** : Job queue, idempotence, pages séparées