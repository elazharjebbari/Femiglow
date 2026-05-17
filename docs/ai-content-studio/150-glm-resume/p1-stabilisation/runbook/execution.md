# Runbook P1 — Exécution pas-à-pas

**Serveur** : staging.femiglow-maroc.com (`/var/www/femiglow-staging`)
**Branche** : master
**Environnement** : `apps/web/`

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

## Étape 1 — Corriger les bugs backend

### 1a. Corriger le ternaire identique dans repository.ts

```bash
# Ouvrir apps/web/src/lib/content-studio/repository.ts
# Ligne ~457, remplacer :
#   status: review.status === 'blocked' ? 'needs_review' : 'needs_review',
# par :
#   status: 'needs_review',
```

### 1b. Enforcer la state machine dans service.ts

```bash
# Ouvrir apps/web/src/lib/content-studio/service.ts
# Ajouter en haut :
#   import { assertTransition } from './state-machine';
#
# Avant chaque updateIdeaStatus / updateDraft status / updatePostPlanning :
#   assertTransition(currentStatus, newStatus);
```

### 1c. Ajouter les transitions manquantes dans state-machine.ts

```bash
# Ouvrir apps/web/src/lib/content-studio/state-machine.ts
# Ajouter dans TRANSITIONS :
#   ['scheduled', 'approved']: true,
#   ['needs_review', 'generated']: true,
```

### 1d. Écrire les tests

```bash
# Créer apps/web/src/lib/content-studio/service.test.ts
# Tests : transitions valides, transitions invalides, edge cases
```

### Valider

```bash
cd /var/www/femiglow-staging/apps/web
pnpm vitest run src/lib/content-studio/state-machine.test.ts src/lib/content-studio/service.test.ts
```

### Commit

```bash
git add -A
git commit -m "fix(content-studio): enforce state machine transitions and fix insertReview ternary"
```

---

## Étape 2 — Types partagés

```bash
# Créer apps/web/src/components/admin/content-studio/types.ts
# Déplacer Integration, StudioMediaItem, MediaCompartment, DraftAssetsByDraftId, AutomationResponse
# Mettre à jour les imports dans ContentStudioClient.tsx
```

### Valider

```bash
pnpm tsc --noEmit
```

### Commit

```bash
git add -A
git commit -m "refactor(content-studio): extract shared types to separate module"
```

---

## Étape 3 — Découpage UI

### 3a. StudioGuide

```bash
# Extraire la section d'aide repliable de ContentStudioClient.tsx
# Créer StudioGuide.tsx avec props: enabled: boolean
# Remplacer l'inline par <StudioGuide enabled={enabled} />
```

### 3b-3j. Autres composants

Procéder dans l'ordre : DraftCardList → MediaPicker → PlatformPreview → PostizPanel → IdeaForm → CalendarPipeline → PostizHealthPanel → AutomationActions

Pour chaque composant :
1. Identifier la portion dans ContentStudioClient.tsx (lignes dans l'analyse)
2. Créer le fichier composant avec les props nécessaires
3. Remplacer l'inline par le composant dans ContentStudioClient.tsx
4. Vérifier TypeScript : `pnpm tsc --noEmit`
5. Vérifier visuellement sur staging

### Valider après chaque extraction

```bash
pnpm tsc --noEmit
pnpm next build 2>&1 | tail -5
```

### Commit (regrouper 3-4 composants par commit)

```bash
git add -A
git commit -m "refactor(content-studio): extract StudioGuide, DraftCardList, MediaPicker, PlatformPreview"

git add -A
git commit -m "refactor(content-studio): extract PostizPanel, IdeaForm, CalendarPipeline"

git add -A
git commit -m "refactor(content-studio): extract PostizHealthPanel, AutomationActions, simplify orchestrator"
```

---

## Étape 4 — Validation client + accessibilité

```bash
# Ajouter validation Zod dans IdeaForm, DraftEditor
# Ajouter aria-live sur la zone de message/error
# Ajouter rel="noopener noreferrer" sur les liens externes
# Supprimer le dead code (lignes 436-438)
```

### Valider

```bash
pnpm tsc --noEmit
pnpm next build 2>&1 | tail -5
```

### Commit

```bash
git add -A
git commit -m "feat(content-studio): add client-side Zod validation and accessibility improvements"
```

---

## Étape 5 — Tests unitaires

```bash
# Créer :
#   apps/web/src/lib/content-studio/service.test.ts
#   apps/web/src/lib/content-studio/auth.test.ts
#   apps/web/src/components/admin/content-studio/StudioGuide.test.tsx
#   apps/web/src/components/admin/content-studio/DraftCardList.test.tsx
```

### Valider

```bash
pnpm vitest run src/lib/content-studio/ src/components/admin/content-studio/
```

### Commit

```bash
git add -A
git commit -m "test(content-studio): add service, auth, and component unit tests"
```

---

## Étape 6 — Tests d'intégration API (MSW)

```bash
# Créer :
#   apps/web/src/test/msw/content-studio.ts
#   apps/web/src/lib/content-studio/api-routes.test.ts
```

### Valider

```bash
pnpm vitest run src/lib/content-studio/api-routes.test.ts
```

### Commit

```bash
git add -A
git commit -m "test(content-studio): add MSW handlers and API integration tests"
```

---

## Étape 7 — Tests E2E Playwright

```bash
# Créer :
#   apps/web/e2e/content-studio.spec.ts
#   apps/web/src/test/factories/content-studio.ts
```

### Valider

```bash
# S'assurer que le serveur tourne
systemctl status femiglow-staging
# Lancer les tests E2E
pnpm --filter @femiglow/web test:e2e -- --grep "Content Studio"
```

### Commit

```bash
git add -A
git commit -m "test(content-studio): add Playwright E2E tests and test factories"
```

---

## Étape 8 — Configuration couverture

```bash
# Modifier apps/web/vitest.config.ts
# Ajouter au coverage.include :
#   'src/lib/content-studio/**',
#   'src/components/admin/content-studio/**',
```

### Valider

```bash
pnpm vitest run --coverage 2>&1 | grep "content-studio"
```

### Commit

```bash
git add -A
git commit -m "ci(content-studio): add coverage configuration for content-studio modules"
```

---

## Étape 9 — Mettre à jour le runbook

```bash
# Mettre à jour docs/ai-content-studio/130-runbook/prototype-runbook.md
# Avec les corrections de bugs, le refactoring, les tests, les commits
```

### Commit

```bash
git add -A
git commit -m "docs(content-studio): update runbook with P1 stabilization changes"
```

---

## Validation finale

Après toutes les étapes :

```bash
# TypeScript
pnpm tsc --noEmit

# Tests unitaires
pnpm vitest run src/lib/content-studio/ src/components/admin/content-studio/

# Build
pnpm next build 2>&1 | tail -10

# Redémarrer staging
chown -R nodeapp:nodeapp .next
systemctl restart femiglow-staging

# Vérifier l'interface
curl -s -o /dev/null -w "%{http_code}" http://localhost:8012/admin/content-studio
# Attendu : 307 (redirect vers login)

# Vérifier l'API sans session
curl -s http://localhost:8012/api/admin/content-studio/ideas | python3 -m json.tool
# Attendu : {"error": {"code": "unauthorized", "message": "Session expirée..."}}
```

---

## Rollback

Si une étape casse quelque chose :

```bash
# Voir les commits
git log --oneline -10

# Revenir au commit précédent
git revert HEAD

# Ou annuler les changements non-committés
git checkout -- .
```