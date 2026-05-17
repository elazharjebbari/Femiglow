# P3 — Plan d'Action Détaillé

Chaque étape est un commit. Chaque commit inclut les tests correspondants.
Tout s'exécute sur le serveur de staging `/var/www/femiglow-staging`.

---

## P3.1 — Configuration & Documentation Environnement

### Étape 1.1 — .env.example + validation boot

**Fichiers modifiés** :
- `apps/web/.env.example` — ajouter les 10 variables Content Studio
- `apps/web/src/lib/content-studio/auth.ts` — ajouter un warning console quand `CONTENT_STUDIO_ENABLED=false`

**Critères de validation** :
- `grep CONTENT_STUDIO apps/web/.env.example` retourne les 10 variables
- Lint OK, build OK

**Commit** : `docs(content-studio): P3.1.1 — env.example + boot validation`

---

### Étape 1.2 — Warning memory store + health endpoint

**Fichiers modifiés** :
- `apps/web/src/lib/db/client.ts` — log warning quand `db()` retourne null (memory mode)
- `apps/web/src/app/api/admin/content-studio/health/route.ts` — NEW, retourne `{ mode: 'drizzle' | 'memory', enabled: true/false }`

**Tests** :
- MSW handler pour GET /health
- Test MSW pour vérifier la réponse

**Critères de validation** :
- `GET /api/admin/content-studio/health` retourne le mode actuel
- Warning logged au boot si memory mode

**Commit** : `feat(content-studio): P3.1.2 — memory store warning + health endpoint`

---

## P3.2 — Pagination Serveur & Performance

### Étape 2.1 — Repository : fonctions de liste avec filtres

**Fichiers modifiés** :
- `apps/web/src/lib/content-studio/repository.ts` — signature `listIdeas(filters?)`, `listDrafts(filters?)`, `listPosts(filters?)` avec limit/offset/status/platform
- `apps/web/src/lib/content-studio/types.ts` — types `ListFilters` si nécessaire

**Pattern** : chaque fonction accepte un objet `filters` optionnel :
```ts
interface ListFilters {
  status?: string;
  platform?: string;
  limit?: number;
  offset?: number;
}
```

**Tests** :
- Tests unitaires pour chaque fonction de liste avec filtres (node, pas JSX)

**Critères de validation** :
- `listIdeas({ status: 'idea', limit: 10, offset: 0 })` retourne uniquement les idées filtrées
- Memory fallback fonctionne aussi

**Commit** : `feat(content-studio): P3.2.1 — repository list functions with pagination filters`

---

### Étape 2.2 — API routes : query params pagination

**Fichiers modifiés** :
- `apps/web/src/app/api/admin/content-studio/ideas/route.ts` — GET parse query params via `ideaQuerySchema`
- `apps/web/src/app/api/admin/content-studio/drafts/route.ts` — GET parse via `draftQuerySchema`
- `apps/web/src/app/api/admin/content-studio/posts/route.ts` — GET parse via `postQuerySchema`
- `apps/web/src/app/api/admin/content-studio/learning-notes/route.ts` — GET accept limit/offset
- `apps/web/src/app/api/admin/content-studio/generation-runs/route.ts` — GET accept limit/offset

**Tests** :
- MSW handlers mis à jour pour supporter les query params
- Tests MSW pour vérifier la pagination

**Critères de validation** :
- `GET /ideas?limit=5&offset=10&status=idea` fonctionne
- `GET /drafts?platform=instagram&limit=20` fonctionne

**Commit** : `feat(content-studio): P3.2.2 — API route pagination via query params`

---

### Étape 2.3 — Service layer : passer les filtres

**Fichiers modifiés** :
- `apps/web/src/lib/content-studio/service.ts` — `listIdeas(filters?)`, `listDrafts(filters?)`, `listPosts(filters?)` passent les filtres au repo

**Tests** :
- Test unitaire du service avec filtres

**Commit** : `feat(content-studio): P3.2.3 — service layer passes pagination filters`

---

### Étape 2.4 — Composant LoadMore

**Nouveau fichier** :
- `apps/web/src/components/admin/content-studio/LoadMore.tsx` — bouton "Charger plus" avec count/offset

**Pattern** :
```tsx
<LoadMore
  currentCount={ideas.length}
  totalCount={ideasTotal}
  onLoadMore={() => setIdeaOffset((o) => o + 50)}
  disabled={isPending}
/>
```

**Tests** :
- Test de rendering (si rolldown fixé) ou test Playwright

**Commit** : `feat(content-studio): P3.2.4 — LoadMore component for incremental loading`

---

### Étape 2.5 — Intégration pagination dans ContentStudioClient

**Fichiers modifiés** :
- `apps/web/src/components/admin/content-studio/ContentStudioClient.tsx` — add offset states, LoadMore buttons, total counts from API responses

**Tests** :
- E2E Playwright : vérifier que LoadMore apparaît quand il y a plus de 50 idées

**Commit** : `feat(content-studio): P3.2.5 — integrate LoadMore and pagination in ContentStudioClient`

---

### Étape 2.6 — Lazy loading des onglets

**Fichiers modifiés** :
- `apps/web/src/components/admin/content-studio/ContentStudioClient.tsx` — `React.lazy()` pour AnalyticsDashboard, BudgetSummary, EditorialCalendar

**Tests** :
- E2E : vérifier que le contenu apparait après navigation tab

**Commit** : `perf(content-studio): P3.2.6 — lazy load tab components`

---

## P3.3 — Hardening Idempotence & Budget

### Étape 3.1 — Migration DB : content_idempotency_keys

**Nouveau fichier** :
- `apps/web/drizzle/migrations/0061_p3_idempotency_campaigns.sql`

**Contenu** :
```sql
CREATE TABLE IF NOT EXISTS "content_idempotency_key" (
  "id" text PRIMARY KEY,
  "key" text NOT NULL UNIQUE,
  "response_json" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT NOW(),
  "expires_at" timestamptz NOT NULL
);
CREATE INDEX "content_idempotency_key_expires_idx" ON "content_idempotency_key" ("expires_at");
```

**Ajout au schema Drizzle** :
- `apps/web/src/lib/db/schema-content-studio.ts` — ajout `contentIdempotencyKeys` table

**Commit** : `feat(content-studio): P3.3.1 — migration + schema for idempotency keys table`

---

### Étape 3.2 — Repository idempotence DB-backed

**Fichiers modifiés** :
- `apps/web/src/lib/content-studio/idempotency.ts` — refactor vers DB-backed avec fallback memory
- `apps/web/src/lib/content-studio/repository.ts` — ajout `getIdempotencyEntry(key)`, `setIdempotencyEntry(key, response, expiresAt)`, `cleanExpiredIdempotencyKeys()`

**Tests** :
- Tests unitaires pour le store et retrieval
- Test du fallback memory

**Commit** : `feat(content-studio): P3.3.2 — DB-backed idempotency store with memory fallback`

---

### Étape 3.3 — Budget enforcement

**Nouveau fichier** :
- `apps/web/src/lib/content-studio/budget.ts` — `checkDailyBudget(estimatedCostCents)`, `getDailySpentCents()`

**Fichiers modifiés** :
- `apps/web/src/lib/content-studio/service.ts` — appel `checkDailyBudget()` dans `generateIdeaDrafts` et `generateVisualForDraft`
- `apps/web/src/lib/content-studio/repository.ts` — `sumDailyGenerationCostCents()`

**Tests** :
- Test unitaire budget : vérifie que le budget bloqué lève HttpError
- Test que le budget non dépassé passe

**Commit** : `feat(content-studio): P3.3.3 — daily generation budget enforcement`

---

### Étape 3.4 — Budget restant dans l'UI

**Fichiers modifiés** :
- `apps/web/src/components/admin/content-studio/BudgetSummary.tsx` — affiche budget restant, barre de progression
- `apps/web/src/app/api/admin/content-studio/generation-runs/route.ts` — expose `dailyBudgetCents`, `dailySpentCents`

**Tests** :
- E2E : vérifier que le budget apparait dans l'onglet Budget

**Commit** : `feat(content-studio): P3.3.4 — daily budget remaining in BudgetSummary UI`

---

## P3.4 — Couverture de Tests MSW & Lib

### Étape 4.1 — MSW : tests manquants (generate, postiz-draft)

**Fichiers modifiés** :
- `apps/web/src/test/msw/content-studio-handlers.test.ts` — ajout 4 tests

**Nouveaux tests** :
1. `POST /ideas/:id/generate` — crée drafts et update idea status
2. `POST /ideas/:id/generate` 404 — idée inexistante
3. `POST /posts/:id/postiz-draft` — crée delivery et update post
4. `POST /posts/:id/postiz-draft` 404 — post inexistant

**Commit** : `test(content-studio): P3.4.1 — MSW tests for generate and postiz-draft handlers`

---

### Étape 4.2 — MSW : tests 404 manquants (archive handlers)

**Fichiers modifiés** :
- `apps/web/src/test/msw/content-studio-handlers.test.ts` — ajout 3 tests

**Nouveaux tests** :
1. `POST /drafts/:id/archive` 404 — draft inexistant
2. `POST /posts/:id/archive` 404 — post inexistant
3. `GET /generation-runs` — vérifier la structure de réponse

**Commit** : `test(content-studio): P3.4.2 — MSW 404 tests for archive and generation-runs`

---

### Étape 4.3 — MSW : handlers pagination + health

**Fichiers modifiés** :
- `apps/web/src/test/msw/content-studio-handlers.ts` — ajout handlers GET /health, query param support sur listes
- `apps/web/src/test/msw/content-studio-handlers.test.ts` — tests pagination + health

**Nouveaux tests** :
1. `GET /health` — retourne le mode
2. `GET /ideas?limit=1` — retourne 1 idée
3. `GET /ideas?status=archived` — filtre par status

**Commit** : `test(content-studio): P3.4.3 — MSW handlers for health endpoint and pagination`

---

### Étape 4.4 — Tests lib : generation.ts

**Nouveau fichier** :
- `apps/web/src/lib/content-studio/generation.test.ts`

**Tests** :
1. `fallbackGeneration()` produit 3 variants structurés
2. `fallbackGeneration()` utilise le pillar/objective de l'idée
3. Structure du `GenerationResult` valide

**Commit** : `test(content-studio): P3.4.4 — unit tests for generation fallback logic`

---

### Étape 4.5 — Tests lib : idempotency.ts + repository.ts

**Nouveaux fichiers** :
- `apps/web/src/lib/content-studio/idempotency.test.ts`
- `apps/web/src/lib/content-studio/repository.test.ts` (tests memory store uniquement)

**Tests idempotency** :
1. Store et retrieve une clé
2. Clé expirée retourne null
3. Cleanup supprime les clés expirées

**Tests repository** :
1. `createLearningNote` + `listLearningNotesForPost` roundtrip
2. `listGenerationRuns` en mode mémoire
3. Pagination filters en mode mémoire

**Commit** : `test(content-studio): P3.4.5 — unit tests for idempotency and repository`

---

## P3.5 — Tests Composants (Workaround Rolldown)

### Étape 5.1 — Hook : useDraftValidation

**Nouveaux fichiers** :
- `apps/web/src/lib/content-studio/hooks/useDraftValidation.ts`
- `apps/web/src/lib/content-studio/hooks/useDraftValidation.test.ts`

**Logique extraite** : validation Zod `draftUpdateSchema.safeParse()` avec mapping des erreurs

**Tests** :
1. Données valides → pas d'erreurs
2. Caption vide → erreur caption
3. Caption > 2200 → erreur caption
4. Hashtags > 30 → erreur hashtags

**Commit** : `test(content-studio): P3.5.1 — useDraftValidation hook + tests`

---

### Étape 5.2 — Hook : useBudgetStatus

**Nouveaux fichiers** :
- `apps/web/src/lib/content-studio/hooks/useBudgetStatus.ts`
- `apps/web/src/lib/content-studio/hooks/useBudgetStatus.test.ts`

**Logique** : fetch `/generation-runs`, calcul budget restant, pourcentage

**Tests** :
1. Budget non dépassé → status='ok'
2. Budget à 80% → status='warning'
3. Budget dépassé → status='exceeded'

**Commit** : `test(content-studio): P3.5.2 — useBudgetStatus hook + tests`

---

### Étape 5.3 — Tests helpers.ts (purs, pas JSX)

**Nouveau fichier** :
- `apps/web/src/components/admin/content-studio/helpers.test.ts`

**Tests** :
1. `formatShortDate` — format français
2. `defaultScheduleValue` — retourne demain à l'heure pile
3. `toIsoOrNull` — conversion et null
4. `toLocalDatetimeInput` — format YYYY-MM-DDTHH:mm
5. `extractUploadedImage` — parsing Postiz request
6. `summarizeSnapshot` — formatage analytics

**Commit** : `test(content-studio): P3.5.3 — unit tests for helpers utilities`

---

### Étape 5.4 — Tests api.ts (purs, pas JSX)

**Nouveau fichier** :
- `apps/web/src/components/admin/content-studio/api.test.ts`

**Tests** :
1. `getJson` — construit la bonne URL
2. `postJson` — envoie le bon body
3. `patchJson` — méthode PATCH
4. Error handling — status non-200

**Commit** : `test(content-studio): P3.5.4 — unit tests for API client`

---

## P3.6 — E2E Playwright — Workflow Complet

### Étape 6.1 — Setup auth pour content-studio E2E

**Fichiers modifiés** :
- `apps/web/e2e/content-studio.spec.ts` — refactor en `test.describe` avec beforeAll auth

**Pattern** :
```ts
test.describe('Content Studio — Workflow', () => {
  test.use({ storageState: ADMIN_STORAGE_PATH });
  // ...
});
```

**Commit** : `test(content-studio): P3.6.1 — refactor E2E auth setup`

---

### Étape 6.2 — E2E : création d'idée

**Nouveaux tests** :
1. Remplir le formulaire idée (pilier, objectif, plateforme, format, prompt)
2. Soumettre → l'idée apparait dans la liste
3. Validation : prompt trop court → erreur affichée

**Commit** : `test(content-studio): P3.6.2 — E2E idea creation flow`

---

### Étape 6.3 — E2E : navigation calendrier

**Nouveaux tests** :
1. Onglet Calendrier → grille 7 jours visible
2. Navigation semaine suivante/précédente
3. Filtre par statut → la grille se met à jour
4. Clic sur un post → retour au pipeline avec draft sélectionné

**Commit** : `test(content-studio): P3.6.3 — E2E calendar navigation and filters`

---

### Étape 6.4 — E2E : onglets analytics & budget

**Nouveaux tests** :
1. Onglet Analytics → tableau de bord visible avec métriques
2. Onglet Budget → coûts de génération visibles
3. Bouton "Charger les données" → données apparues

**Commit** : `test(content-studio): P3.6.4 — E2E analytics and budget tabs`

---

### Étape 6.5 — E2E : error states

**Nouveaux tests** :
1. Désactiver le réseau → message d'erreur visible
2. Feature désactivée (`CONTENT_STUDIO_ENABLED=false`) → banner visible

**Commit** : `test(content-studio): P3.6.5 — E2E error states`

---

## P3.7 — CI/CD & Quality Gates

### Étape 7.1 — Workflow E2E Content Studio

**Nouveau fichier** :
- `.github/workflows/e2e-content-studio.yml`

**Contenu** :
```yaml
name: E2E Content Studio
on:
  pull_request:
    paths:
      - 'apps/web/src/**/content-studio/**'
      - 'apps/web/e2e/content-studio*'
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
      - run: pnpm install --frozen-lockfile
      - run: cd apps/web && npx playwright install chromium
      - run: pnpm build
      - run: cd apps/web && npx playwright test e2e/content-studio.spec.ts
```

**Commit** : `ci(content-studio): P3.7.1 — Playwright E2E workflow for content-studio`

---

### Étape 7.2 — Coverage gate dans CI

**Fichiers modifiés** :
- `.github/workflows/ci.yml` — ajout step coverage
- `apps/web/vitest.config.ts` — coverage thresholds enforcement

**Pattern** :
```yaml
- name: Coverage
  run: cd apps/web && pnpm test:coverage
  env:
    VITE_COVERAGE: "true"
```

**Commit** : `ci(content-studio): P3.7.2 — coverage gate in CI pipeline`

---

### Étape 7.3 — Isolation tests content-studio dans CI

**Fichiers modifiés** :
- `.github/workflows/ci.yml` — step dédié pour content-studio unit tests

**Pattern** :
```yaml
- name: Content Studio tests
  run: cd apps/web && npx vitest run src/lib/content-studio/ src/test/msw/content-studio-handlers.test.ts
```

**Commit** : `ci(content-studio): P3.7.3 — isolated content-studio test step in CI`

---

## P3.8 — Campagnes & Orphan Table

### Étape 8.1 — Repository : campaign CRUD

**Fichiers modifiés** :
- `apps/web/src/lib/content-studio/repository.ts` — `createCampaign`, `listCampaigns`, `getCampaign`, `updateCampaign`, `archiveCampaign`

**Tests** :
- Tests memory store pour chaque fonction

**Commit** : `feat(content-studio): P3.8.1 — campaign repository CRUD functions`

---

### Étape 8.2 — Service : campaign business logic

**Fichiers modifiés** :
- `apps/web/src/lib/content-studio/service.ts` — `createContentCampaign`, `updateContentCampaign`, `archiveContentCampaign`
- `apps/web/src/lib/content-studio/schemas.ts` — `campaignCreateSchema`, `campaignUpdateSchema`

**Tests** :
- Service test pour create + archive

**Commit** : `feat(content-studio): P3.8.2 — campaign service + schemas`

---

### Étape 8.3 — API routes : campaigns

**Nouveaux fichiers** :
- `apps/web/src/app/api/admin/content-studio/campaigns/route.ts` — GET (list), POST (create)
- `apps/web/src/app/api/admin/content-studio/campaigns/[id]/route.ts` — GET, PATCH
- `apps/web/src/app/api/admin/content-studio/campaigns/[id]/archive/route.ts` — POST

**Tests** :
- MSW handlers pour campaigns
- Tests MSW pour chaque opération

**Commit** : `feat(content-studio): P3.8.3 — campaign API routes + MSW handlers + tests`

---

### Étape 8.4 — Composant CampaignSelect

**Nouveau fichier** :
- `apps/web/src/components/admin/content-studio/CampaignSelect.tsx` — dropdown pour choisir une campagne

**Intégration** :
- `IdeaForm.tsx` — ajout CampaignSelect
- `EditorialCalendar.tsx` — filtre par campagne

**Commit** : `feat(content-studio): P3.8.4 — CampaignSelect component + integration in IdeaForm`

---

### Étape 8.5 — Campagne dans le pipeline

**Fichiers modifiés** :
- `apps/web/src/components/admin/content-studio/ContentStudioClient.tsx` — state campaigns, CampaignSelect dans les filtres calendrier
- `apps/web/src/app/admin/content-studio/page.tsx` — charger les campaigns au SSR

**Tests** :
- E2E : créer une campagne, l'associer à une idée

**Commit** : `feat(content-studio): P3.8.5 — campaigns in pipeline and calendar filters`

---

### Étape 8.6 — Campagne dans le calendrier

**Fichiers modifiés** :
- `apps/web/src/components/admin/content-studio/EditorialCalendar.tsx` — filtre campagne
- `apps/web/src/components/admin/content-studio/ContentStudioClient.tsx` — passer campaigns prop

**Commit** : `feat(content-studio): P3.8.6 — campaign filter in editorial calendar`

---

## Récapitulatif des commits P3

| # | Commit | Fichiers | Tests |
|---|--------|----------|-------|
| 1 | P3.1.1 — env.example + boot validation | 2 | 0 |
| 2 | P3.1.2 — memory store warning + health | 3 | 2 |
| 3 | P3.2.1 — repository pagination filters | 2 | 4 |
| 4 | P3.2.2 — API route pagination | 5 | 3 |
| 5 | P3.2.3 — service layer filters | 1 | 1 |
| 6 | P3.2.4 — LoadMore component | 1 | 1 |
| 7 | P3.2.5 — integrate LoadMore in client | 1 | 1 |
| 8 | P3.2.6 — lazy load tab components | 1 | 1 |
| 9 | P3.3.1 — idempotency migration + schema | 2 | 0 |
| 10 | P3.3.2 — DB-backed idempotency store | 2 | 4 |
| 11 | P3.3.3 — budget enforcement | 3 | 3 |
| 12 | P3.3.4 — budget remaining in UI | 2 | 1 |
| 13 | P3.4.1 — MSW generate + postiz tests | 1 | 4 |
| 14 | P3.4.2 — MSW 404 archive tests | 1 | 3 |
| 15 | P3.4.3 — MSW health + pagination | 2 | 3 |
| 16 | P3.4.4 — generation fallback tests | 1 | 3 |
| 17 | P3.4.5 — idempotency + repo tests | 2 | 6 |
| 18 | P3.5.1 — useDraftValidation hook + tests | 2 | 4 |
| 19 | P3.5.2 — useBudgetStatus hook + tests | 2 | 3 |
| 20 | P3.5.3 — helpers unit tests | 1 | 6 |
| 21 | P3.5.4 — API client unit tests | 1 | 4 |
| 22 | P3.6.1 — E2E auth refactor | 1 | 0 |
| 23 | P3.6.2 — E2E idea creation | 1 | 3 |
| 24 | P3.6.3 — E2E calendar navigation | 1 | 4 |
| 25 | P3.6.4 — E2E analytics + budget tabs | 1 | 3 |
| 26 | P3.6.5 — E2E error states | 1 | 2 |
| 27 | P3.7.1 — CI Playwright workflow | 1 | 0 |
| 28 | P3.7.2 — CI coverage gate | 2 | 0 |
| 29 | P3.7.3 — CI isolated test step | 1 | 0 |
| 30 | P3.8.1 — campaign repository | 1 | 3 |
| 31 | P3.8.2 — campaign service + schemas | 2 | 2 |
| 32 | P3.8.3 — campaign API + MSW tests | 3 | 5 |
| 33 | P3.8.4 — CampaignSelect component | 2 | 1 |
| 34 | P3.8.5 — campaigns in pipeline | 2 | 1 |
| 35 | P3.8.6 — campaign calendar filter | 2 | 1 |

**Total : 35 commits, ~75 tests ajoutés**