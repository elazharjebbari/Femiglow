# P3 — Runbook d'Exécution

## Prérequis

```bash
# 1. Vérifier que le serveur de staging est opérationnel
cd /var/www/femiglow-staging
git status  # branche master, pas de changes non-commités

# 2. Vérifier les variables d'environnement
cat apps/web/.env | grep -E 'CONTENT_STUDIO|POSTIZ|DATABASE_URL'

# 3. Vérifier que les tests existants passent
cd apps/web && npx vitest run src/test/msw/content-studio-handlers.test.ts
# → 29 tests pass

# 4. Vérifier le lint
npx next lint
# → 0 errors
```

---

## P3.1 — Configuration & Documentation Environnement

### Étape 1.1 — .env.example + validation boot

```bash
# ÉDITER apps/web/.env.example — ajouter après la section existante :
# Content Studio
CONTENT_STUDIO_ENABLED=false
POSTIZ_BASE_URL=
POSTIZ_API_KEY=
CONTENT_STUDIO_DEFAULT_TIMEZONE=Africa/Casablanca
CONTENT_STUDIO_OPENAI_API_KEY=
CHAT_OPENAI_API_KEY=
CONTENT_STUDIO_TEXT_MODEL=gpt-4o-mini
CONTENT_STUDIO_IMAGE_PROVIDER=mock
CONTENT_STUDIO_IMAGE_MODEL=gpt-image-1-mini
CONTENT_STUDIO_DAILY_GENERATION_BUDGET_CENTS=500

# ÉDITER apps/web/src/lib/content-studio/auth.ts — ajouter dans requireContentStudioEnabled() :
if (!enabled) {
  console.warn('[content-studio] Feature désactivée. Activez CONTENT_STUDIO_ENABLED=true en staging.');
}

# VALIDER
npx next lint
git add apps/web/.env.example apps/web/src/lib/content-studio/auth.ts
git commit -m "docs(content-studio): P3.1.1 — env.example + boot validation"
```

---

### Étape 1.2 — Memory store warning + health endpoint

```bash
# ÉDITER apps/web/src/lib/db/client.ts — dans la fonction db(), ajouter :
if (!client) {
  console.warn('[db] Aucune connexion DATABASE_URL — mode mémoire (données perdues au redémarrage).');
}

# CRÉER apps/web/src/app/api/admin/content-studio/health/route.ts
# → GET retourne { mode: 'drizzle'|'memory', enabled: boolean, version: 'P3' }

# AJOUTER handler MSW dans content-studio-handlers.ts
# AJOUTER tests dans content-studio-handlers.test.ts
#   - GET /health retourne le mode
#   - GET /health retourne enabled

# VALIDER
npx vitest run apps/web/src/test/msw/content-studio-handlers.test.ts
npx next lint

git add apps/web/src/lib/db/client.ts \
        apps/web/src/app/api/admin/content-studio/health/route.ts \
        apps/web/src/test/msw/content-studio-handlers.ts \
        apps/web/src/test/msw/content-studio-handlers.test.ts
git commit -m "feat(content-studio): P3.1.2 — memory store warning + health endpoint"
```

---

## P3.2 — Pagination Serveur & Performance

### Étape 2.1 — Repository pagination filters

```bash
# ÉDITER apps/web/src/lib/content-studio/repository.ts
# Modifier les signatures :
#   listIdeas(filters?: { status?: string; pillar?: string; platform?: string; limit?: number; offset?: number })
#   listDrafts(filters?: { status?: string; platform?: string; format?: string; limit?: number; offset?: number })
#   listPosts(filters?: { status?: string; scheduledAfter?: string; scheduledBefore?: string; limit?: number; offset?: number })

# Pour chaque fonction :
# - Drizzle : ajouter .where() et .limit()/.offset() basés sur filters
# - Memory : filtrer le Map avec les mêmes critères

# CRÉER apps/web/src/lib/content-studio/repository.test.ts (memory store tests)
# - listIdeas with status filter
# - listIdeas with limit/offset
# - listDrafts with platform filter
# - listPosts with date range

# VALIDER
npx vitest run apps/web/src/lib/content-studio/repository.test.ts

git add apps/web/src/lib/content-studio/repository.ts \
        apps/web/src/lib/content-studio/repository.test.ts
git commit -m "feat(content-studio): P3.2.1 — repository list functions with pagination filters"
```

---

### Étape 2.2 — API route pagination

```bash
# ÉDITER chaque route GET de liste :
# - ideas/route.ts : parse searchParams avec ideaQuerySchema, passer à listIdeas()
# - drafts/route.ts : parse avec draftQuerySchema, passer à listDrafts()
# - posts/route.ts : parse avec postQuerySchema, passer à listPosts()
# - learning-notes/route.ts : accept limit/offset query params
# - generation-runs/route.ts : accept limit/offset query params

# ÉDITER MSW handlers : supporter les query params sur GET /ideas, /drafts, /posts
# AJOUTER 3 tests MSW pour la pagination

# VALIDER
npx vitest run apps/web/src/test/msw/content-studio-handlers.test.ts
npx next lint

git add apps/web/src/app/api/admin/content-studio/ideas/route.ts \
        apps/web/src/app/api/admin/content-studio/drafts/route.ts \
        apps/web/src/app/api/admin/content-studio/posts/route.ts \
        apps/web/src/app/api/admin/content-studio/learning-notes/route.ts \
        apps/web/src/app/api/admin/content-studio/generation-runs/route.ts \
        apps/web/src/test/msw/content-studio-handlers.ts \
        apps/web/src/test/msw/content-studio-handlers.test.ts
git commit -m "feat(content-studio): P3.2.2 — API route pagination via query params"
```

---

### Étape 2.3 — Service layer filters

```bash
# ÉDITER service.ts :
# - listIdeas(filters?) → passe à repository.listIdeas(filters)
# - listDrafts(filters?) → passe à repository.listDrafts(filters)
# - listPosts(filters?) → passe à repository.listPosts(filters)
# (Ces fonctions sont déjà des re-exports du repo, il faut les wrapper)

# CRÉER ou modifier service.test.ts avec tests filtres

# VALIDER
npx vitest run apps/web/src/lib/content-studio/service.test.ts

git add apps/web/src/lib/content-studio/service.ts \
        apps/web/src/lib/content-studio/service.test.ts
git commit -m "feat(content-studio): P3.2.3 — service layer passes pagination filters"
```

---

### Étape 2.4 — LoadMore component

```bash
# CRÉER apps/web/src/components/admin/content-studio/LoadMore.tsx
#
# export function LoadMore({ currentCount, totalCount, onLoadMore, disabled }) {
#   if (currentCount >= totalCount) return null;
#   return <button onClick={onLoadMore} disabled={disabled}>
#     Charger plus ({totalCount - currentCount} restants)
#   </button>;
# }

# VALIDER lint
npx next lint

git add apps/web/src/components/admin/content-studio/LoadMore.tsx
git commit -m "feat(content-studio): P3.2.4 — LoadMore component for incremental loading"
```

---

### Étape 2.5 — Integrate LoadMore in ContentStudioClient

```bash
# ÉDITER ContentStudioClient.tsx :
# - Ajouter offset states pour ideas, drafts, posts
# - API responses incluent maintenant total count
# - Ajouter <LoadMore> sous chaque liste

# AJOUTER test E2E dans content-studio.spec.ts

# VALIDER
npx next lint

git add apps/web/src/components/admin/content-studio/ContentStudioClient.tsx \
        apps/web/e2e/content-studio.spec.ts
git commit -m "feat(content-studio): P3.2.5 — integrate LoadMore and pagination in ContentStudioClient"
```

---

### Étape 2.6 — Lazy load tab components

```bash
# ÉDITER ContentStudioClient.tsx :
# - const AnalyticsDashboard = React.lazy(() => import('./AnalyticsDashboard'))
# - const BudgetSummary = React.lazy(() => import('./BudgetSummary'))
# - const EditorialCalendar = React.lazy(() => import('./EditorialCalendar'))
# - Wrap avec <Suspense fallback={<p>Chargement…</p>}>

# VALIDER
npx next lint

git add apps/web/src/components/admin/content-studio/ContentStudioClient.tsx
git commit -m "perf(content-studio): P3.2.6 — lazy load tab components"
```

---

## P3.3 — Hardening Idempotence & Budget

### Étape 3.1 — Migration idempotency keys

```bash
# CRÉER apps/web/drizzle/migrations/0061_p3_idempotency_campaigns.sql

# ÉDITER apps/web/src/lib/db/schema-content-studio.ts :
# Ajouter table contentIdempotencyKeys

# VALIDER lint

git add apps/web/drizzle/migrations/0061_p3_idempotency_campaigns.sql \
        apps/web/src/lib/db/schema-content-studio.ts
git commit -m "feat(content-studio): P3.3.1 — migration + schema for idempotency keys table"
```

---

### Étape 3.2 — DB-backed idempotency store

```bash
# ÉDITER apps/web/src/lib/content-studio/idempotency.ts :
# - Refactor : vérifier DB d'abord, fallback mémoire
# - Nouvelles fonctions : getEntry, setEntry, cleanExpired

# ÉDITER apps/web/src/lib/content-studio/repository.ts :
# - Ajouter getIdempotencyEntry, setIdempotencyEntry, cleanExpiredIdempotencyKeys

# CRÉER apps/web/src/lib/content-studio/idempotency.test.ts
# - Store et retrieve
# - Clé expirée
# - Cleanup

# VALIDER
npx vitest run apps/web/src/lib/content-studio/idempotency.test.ts

git add apps/web/src/lib/content-studio/idempotency.ts \
        apps/web/src/lib/content-studio/repository.ts \
        apps/web/src/lib/content-studio/idempotency.test.ts
git commit -m "feat(content-studio): P3.3.2 — DB-backed idempotency store with memory fallback"
```

---

### Étape 3.3 — Budget enforcement

```bash
# CRÉER apps/web/src/lib/content-studio/budget.ts
# - checkDailyBudget(estimatedCostCents: number): Promise<void>
#   → somme des costCents du jour, lève HttpError si dépassé
# - getDailySpentCents(): Promise<number>

# ÉDITER service.ts :
# - Ajouter checkDailyBudget() dans generateIdeaDrafts (avant appel API)
# - Ajouter checkDailyBudget() dans generateVisualForDraft (avant appel API)

# ÉDITER repository.ts :
# - sumDailyGenerationCostCents(): nombre

# CRÉER apps/web/src/lib/content-studio/budget.test.ts
# - Budget OK → passe
# - Budget dépassé → HttpError
# - Budget presque dépassé → passe avec warning

# VALIDER
npx vitest run apps/web/src/lib/content-studio/budget.test.ts

git add apps/web/src/lib/content-studio/budget.ts \
        apps/web/src/lib/content-studio/service.ts \
        apps/web/src/lib/content-studio/repository.ts \
        apps/web/src/lib/content-studio/budget.test.ts
git commit -m "feat(content-studio): P3.3.3 — daily generation budget enforcement"
```

---

### Étape 3.4 — Budget restant dans l'UI

```bash
# ÉDITER generation-runs/route.ts :
# Ajouter dailyBudgetCents et dailySpentCents dans la réponse

# ÉDITER BudgetSummary.tsx :
# - Afficher budget restant / total
# - Barre de progression colorée (vert/orange/rouge)

# VALIDER
npx next lint

git add apps/web/src/app/api/admin/content-studio/generation-runs/route.ts \
        apps/web/src/components/admin/content-studio/BudgetSummary.tsx
git commit -m "feat(content-studio): P3.3.4 — daily budget remaining in BudgetSummary UI"
```

---

## P3.4 — Couverture de Tests MSW & Lib

### Étape 4.1 — MSW generate + postiz-draft

```bash
# ÉDITER content-studio-handlers.test.ts
# Ajouter 4 tests :
# - POST /ideas/:id/generate → crée drafts + update idea
# - POST /ideas/:id/generate 404
# - POST /posts/:id/postiz-draft → crée delivery
# - POST /posts/:id/postiz-draft 404

# VALIDER
npx vitest run apps/web/src/test/msw/content-studio-handlers.test.ts

git add apps/web/src/test/msw/content-studio-handlers.test.ts
git commit -m "test(content-studio): P3.4.1 — MSW tests for generate and postiz-draft handlers"
```

---

### Étape 4.2 — MSW 404 archive tests

```bash
# ÉDITER content-studio-handlers.test.ts
# Ajouter 3 tests

# VALIDER
npx vitest run apps/web/src/test/msw/content-studio-handlers.test.ts

git add apps/web/src/test/msw/content-studio-handlers.test.ts
git commit -m "test(content-studio): P3.4.2 — MSW 404 tests for archive and generation-runs"
```

---

### Étape 4.3 — MSW health + pagination

```bash
# ÉDITER content-studio-handlers.ts : support query params
# ÉDITER content-studio-handlers.test.ts : 3 tests

# VALIDER
npx vitest run apps/web/src/test/msw/content-studio-handlers.test.ts

git add apps/web/src/test/msw/content-studio-handlers.ts \
        apps/web/src/test/msw/content-studio-handlers.test.ts
git commit -m "test(content-studio): P3.4.3 — MSW handlers for health endpoint and pagination"
```

---

### Étape 4.4 — Generation fallback tests

```bash
# CRÉER apps/web/src/lib/content-studio/generation.test.ts
# - fallbackGeneration() → 3 variants
# - Structure valide
# - Pillar/objective utilisés

# VALIDER
npx vitest run apps/web/src/lib/content-studio/generation.test.ts

git add apps/web/src/lib/content-studio/generation.test.ts
git commit -m "test(content-studio): P3.4.4 — unit tests for generation fallback logic"
```

---

### Étape 4.5 — Idempotency + repository tests

```bash
# Les fichiers de test existent déjà (étape 3.2)
# Ajouter tests repository supplémentaires si nécessaire

# VALIDER
npx vitest run apps/web/src/lib/content-studio/idempotency.test.ts \
             apps/web/src/lib/content-studio/repository.test.ts

git add apps/web/src/lib/content-studio/idempotency.test.ts \
        apps/web/src/lib/content-studio/repository.test.ts
git commit -m "test(content-studio): P3.4.5 — unit tests for idempotency and repository"
```

---

## P3.5 — Tests Composants (Workaround Rolldown)

### Étape 5.1 — useDraftValidation hook

```bash
# CRÉER apps/web/src/lib/content-studio/hooks/useDraftValidation.ts
# CRÉER apps/web/src/lib/content-studio/hooks/useDraftValidation.test.ts

# VALIDER
npx vitest run apps/web/src/lib/content-studio/hooks/useDraftValidation.test.ts

git add apps/web/src/lib/content-studio/hooks/useDraftValidation.ts \
        apps/web/src/lib/content-studio/hooks/useDraftValidation.test.ts
git commit -m "test(content-studio): P3.5.1 — useDraftValidation hook + tests"
```

---

### Étape 5.2 — useBudgetStatus hook

```bash
# CRÉER apps/web/src/lib/content-studio/hooks/useBudgetStatus.ts
# CRÉER apps/web/src/lib/content-studio/hooks/useBudgetStatus.test.ts

# VALIDER
npx vitest run apps/web/src/lib/content-studio/hooks/useBudgetStatus.test.ts

git add apps/web/src/lib/content-studio/hooks/useBudgetStatus.ts \
        apps/web/src/lib/content-studio/hooks/useBudgetStatus.test.ts
git commit -m "test(content-studio): P3.5.2 — useBudgetStatus hook + tests"
```

---

### Étape 5.3 — Helpers unit tests

```bash
# CRÉER apps/web/src/components/admin/content-studio/helpers.test.ts
# - formatShortDate, defaultScheduleValue, toIsoOrNull, etc.

# VALIDER
npx vitest run apps/web/src/components/admin/content-studio/helpers.test.ts

git add apps/web/src/components/admin/content-studio/helpers.test.ts
git commit -m "test(content-studio): P3.5.3 — unit tests for helpers utilities"
```

---

### Étape 5.4 — API client unit tests

```bash
# CRÉER apps/web/src/components/admin/content-studio/api.test.ts
# - getJson, postJson, patchJson, error handling

# VALIDER
npx vitest run apps/web/src/components/admin/content-studio/api.test.ts

git add apps/web/src/components/admin/content-studio/api.test.ts
git commit -m "test(content-studio): P3.5.4 — unit tests for API client"
```

---

## P3.6 — E2E Playwright — Workflow Complet

### Étape 6.1 — Auth refactor

```bash
# ÉDITER apps/web/e2e/content-studio.spec.ts
# Restructurer en describe blocks avec test.use({ storageState })

# VALIDER (si serveur Next.js tourne)
# npx playwright test e2e/content-studio.spec.ts

git add apps/web/e2e/content-studio.spec.ts
git commit -m "test(content-studio): P3.6.1 — refactor E2E auth setup"
```

---

### Étape 6.2 — E2E idea creation

```bash
# AJOUTER tests dans content-studio.spec.ts :
# - Fill idea form, submit, verify idea in list
# - Validation error for short prompt

git add apps/web/e2e/content-studio.spec.ts
git commit -m "test(content-studio): P3.6.2 — E2E idea creation flow"
```

---

### Étape 6.3 — E2E calendar navigation

```bash
# AJOUTER tests :
# - Week grid visible
# - Prev/next navigation
# - Status filter
# - Click post → pipeline tab

git add apps/web/e2e/content-studio.spec.ts
git commit -m "test(content-studio): P3.6.3 — E2E calendar navigation and filters"
```

---

### Étape 6.4 — E2E analytics + budget

```bash
# AJOUTER tests :
# - Analytics tab → dashboard visible
# - Budget tab → costs visible
# - Load data button

git add apps/web/e2e/content-studio.spec.ts
git commit -m "test(content-studio): P3.6.4 — E2E analytics and budget tabs"
```

---

### Étape 6.5 — E2E error states

```bash
# AJOUTER tests :
# - Offline → error message
# - Feature disabled → banner

git add apps/web/e2e/content-studio.spec.ts
git commit -m "test(content-studio): P3.6.5 — E2E error states"
```

---

## P3.7 — CI/CD & Quality Gates

### Étape 7.1 — CI Playwright workflow

```bash
# CRÉER .github/workflows/e2e-content-studio.yml

git add .github/workflows/e2e-content-studio.yml
git commit -m "ci(content-studio): P3.7.1 — Playwright E2E workflow for content-studio"
```

---

### Étape 7.2 — CI coverage gate

```bash
# ÉDITER .github/workflows/ci.yml — ajout step coverage
# ÉDITER apps/web/vitest.config.ts — enforce thresholds

git add .github/workflows/ci.yml apps/web/vitest.config.ts
git commit -m "ci(content-studio): P3.7.2 — coverage gate in CI pipeline"
```

---

### Étape 7.3 — CI isolated test step

```bash
# ÉDITER .github/workflows/ci.yml — ajout step content-studio dédié

git add .github/workflows/ci.yml
git commit -m "ci(content-studio): P3.7.3 — isolated content-studio test step in CI"
```

---

## P3.8 — Campagnes & Orphan Table

### Étape 8.1 — Campaign repository

```bash
# ÉDITER repository.ts : createCampaign, listCampaigns, getCampaign, updateCampaign, archiveCampaign
# AJOUTER tests dans repository.test.ts

# VALIDER
npx vitest run apps/web/src/lib/content-studio/repository.test.ts

git add apps/web/src/lib/content-studio/repository.ts \
        apps/web/src/lib/content-studio/repository.test.ts
git commit -m "feat(content-studio): P3.8.1 — campaign repository CRUD functions"
```

---

### Étape 8.2 — Campaign service + schemas

```bash
# ÉDITER service.ts : createContentCampaign, updateContentCampaign, archiveContentCampaign
# ÉDITER schemas.ts : campaignCreateSchema, campaignUpdateSchema
# AJOUTER tests

# VALIDER
npx vitest run apps/web/src/lib/content-studio/service.test.ts

git add apps/web/src/lib/content-studio/service.ts \
        apps/web/src/lib/content-studio/schemas.ts \
        apps/web/src/lib/content-studio/service.test.ts
git commit -m "feat(content-studio): P3.8.2 — campaign service + schemas"
```

---

### Étape 8.3 — Campaign API routes + MSW

```bash
# CRÉER apps/web/src/app/api/admin/content-studio/campaigns/route.ts
# CRÉER apps/web/src/app/api/admin/content-studio/campaigns/[id]/route.ts
# CRÉER apps/web/src/app/api/admin/content-studio/campaigns/[id]/archive/route.ts
# AJOUTER MSW handlers + tests

# VALIDER
npx vitest run apps/web/src/test/msw/content-studio-handlers.test.ts
npx next lint

git add apps/web/src/app/api/admin/content-studio/campaigns/ \
        apps/web/src/test/msw/content-studio-handlers.ts \
        apps/web/src/test/msw/content-studio-handlers.test.ts
git commit -m "feat(content-studio): P3.8.3 — campaign API routes + MSW handlers + tests"
```

---

### Étape 8.4 — CampaignSelect component

```bash
# CRÉER apps/web/src/components/admin/content-studio/CampaignSelect.tsx
# ÉDITER IdeaForm.tsx — intégrer CampaignSelect

# VALIDER
npx next lint

git add apps/web/src/components/admin/content-studio/CampaignSelect.tsx \
        apps/web/src/components/admin/content-studio/IdeaForm.tsx
git commit -m "feat(content-studio): P3.8.4 — CampaignSelect component + integration in IdeaForm"
```

---

### Étape 8.5 — Campaigns in pipeline

```bash
# ÉDITER ContentStudioClient.tsx — state campaigns, CampaignSelect
# ÉDITER page.tsx — load campaigns au SSR
# AJOUTER test E2E

# VALIDER
npx next lint

git add apps/web/src/components/admin/content-studio/ContentStudioClient.tsx \
        apps/web/src/app/admin/content-studio/page.tsx \
        apps/web/e2e/content-studio.spec.ts
git commit -m "feat(content-studio): P3.8.5 — campaigns in pipeline and calendar filters"
```

---

### Étape 8.6 — Campaign calendar filter

```bash
# ÉDITER EditorialCalendar.tsx — filtre campagne
# ÉDITER ContentStudioClient.tsx — passer campaigns prop

# VALIDER
npx next lint

git add apps/web/src/components/admin/content-studio/EditorialCalendar.tsx \
        apps/web/src/components/admin/content-studio/ContentStudioClient.tsx
git commit -m "feat(content-studio): P3.8.6 — campaign filter in editorial calendar"
```

---

## Checklist finale P3

Après toutes les étapes :

```bash
# 1. Tous les tests passent
npx vitest run apps/web/src/test/msw/content-studio-handlers.test.ts
npx vitest run apps/web/src/lib/content-studio/

# 2. Lint OK
npx next lint

# 3. Build OK
npx next build

# 4. E2E OK (si serveur tourne)
# npx playwright test e2e/content-studio.spec.ts

# 5. Commit count
git log --oneline | grep P3 | wc -l
# → 35

# 6. Coverage
# npx vitest run --coverage
# → ≥ 80% statements, ≥ 70% branches
```

---

## Rollback

En cas de problème sur une étape :

```bash
# Annuler le dernier commit (soft — garde les changes)
git reset --soft HEAD~1

# Annuler le dernier commit (hard — perd les changes)
git reset --hard HEAD~1

# Revenir à un commit spécifique
git reset --hard <commit-hash>
```

**Point de restauration P2** : `9101cb7` (dernier commit P2)