# P3 — Plan de Conception & Architecture

## Architecture existante

```
┌─────────────────────────────────────────────────────────┐
│                    Navigateur                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Pipeline │  │Calendar  │  │Analytics │  │ Budget   │ │
│  │  Tab     │  │  Tab     │  │  Tab     │  │  Tab     │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘ │
│       └──────────────┴─────────────┴─────────────┘      │
│                         │                                │
│               ContentStudioClient                        │
│               (state: ideas, drafts, posts,              │
│                deliveries, snapshots, notes)            │
└─────────────────────────┬───────────────────────────────┘
                          │ fetch() / JSON
┌─────────────────────────┴───────────────────────────────┐
│               API Routes (Next.js 14)                    │
│  /api/admin/content-studio/*                            │
│  25 routes — requireAdminApi + requireContentStudioEnabled│
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────┐
│                  Service Layer                            │
│  21 fonctions — audit, state machine, business logic     │
│  ┌──────────┐ ┌───────────┐ ┌──────────┐ ┌───────────┐   │
│  │generation│ │brand-rules│ │ postiz   │ │image-gen  │   │
│  └──────────┘ └───────────┘ └──────────┘ └───────────┘   │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────┐
│               Repository Layer                           │
│  34 fonctions — dual-mode: Drizzle/Postgres OU Map mémoire│
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────┴───────────────────────────────┐
│              Drizzle ORM → PostgreSQL                     │
│  11 tables: campaigns, ideas, briefs, drafts,            │
│  assetBindings, brandReviews, generationRuns,            │
│  posts, postizDeliveries, performanceSnapshots,          │
│  learningNotes                                           │
└─────────────────────────────────────────────────────────┘
```

## Décisions architecturales P3

### 1. Pagination serveur

**Problème** : Les endpoints GET (`listIdeas`, `listDrafts`, `listPosts`, `listLearningNotes`, `listGenerationRuns`) retournent l'intégralité des données sans pagination. En production, c'est un problème de perf et mémoire.

**Solution** :
- Ajouter des query params `limit`, `offset`, `status`, `platform` à tous les endpoints de liste
- Zod schemas `ideaQuerySchema`, `draftQuerySchema`, `postQuerySchema` existent déjà dans `schemas.ts`
- Les repository functions doivent accepter ces filtres et les passer au query Drizzle
- Les composants React implémentent un pattern "load more" (pas de pagination classique qui casse le UX)

**Pattern** :
```ts
// API route
const parsed = ideaQuerySchema.safeParse(Object.fromEntries(searchParams));
const ideas = await listIdeas(parsed.data);

// Repository
async function listIdeas(filters?: { status?: string; limit?: number; offset?: number }) {
  const drizzle = db();
  if (drizzle) {
    let query = drizzle.select().from(contentIdeas).orderBy(desc(contentIdeas.createdAt));
    if (filters?.status) query = query.where(eq(contentIdeas.status, filters.status));
    query = query.limit(filters?.limit ?? 50).offset(filters?.offset ?? 0);
    return query;
  }
  // memory fallback with same filtering
}
```

### 2. Idempotence DB-backed

**Problème** : L'idempotency store actuel est in-memory, perdu au redémarrage du serveur.

**Solution** :
- Nouvelle table `content_idempotency_keys` (id, key, response_json, created_at, expires_at)
- Les clés expirées sont nettoyées par l'automation job `cleanup-idempotency`
- Le repository vérifie la DB avant d'exécuter le handler
- Fallback in-memory si `DATABASE_URL` absent (même pattern que le reste)

### 3. Budget quotidien enforced

**Problème** : `CONTENT_STUDIO_DAILY_GENERATION_BUDGET_CENTS=500` existe mais n'est jamais vérifié.

**Solution** :
- Dans `generateForIdea` et `generateStudioImage`, avant l'appel API :
  - Somme des `costCents` des generation runs du jour (via repo)
  - Si total + coût estimé > budget, lever `HttpError('budget_exceeded', ...)`
- Le front-end affiche le budget restant dans le BudgetSummary
- L'endpoint `/generation-runs` expose `dailyBudgetCents` et `dailySpentCents`

### 4. Workaround tests composants (rolldown/JSX)

**Problème** : Vitest v4 avec rolldown ne transforme pas le JSX dans les fichiers `.tsx`.

**Solution** :
- Extraire la logique métier des composants dans des hooks custom testables en `.ts`
- Tests des hooks purs avec `renderHook` ou appels directs
- Tests de rendering uniquement via Playwright E2E (qui fonctionne nativement)
- Exemple : `useDraftValidation.ts` extrait la logique Zod de DraftEditor

### 5. CI/CD Playwright

**Problème** : Les tests Playwright ne tournent pas en CI.

**Solution** :
- Ajouter un workflow `.github/workflows/e2e-content-studio.yml`
- Setup project pour content-studio (login admin + storageState)
- Run sur chaque PR qui touche `apps/web/src/**/content-studio/**`
- Artifact upload des traces en cas d'échec

### 6. Campagnes (orphan table)

**Problème** : La table `contentCampaigns` existe en DB mais n'a aucune route API, repository function, ni UI.

**Solution** :
- CRUD complet : repository (create, list, get, update, archive), service, API routes
- UI : CampaignForm dans le Pipeline tab, filtre par campagne dans les idées
- Liaison : `idea.campaignId` déjà existant, il suffit de le peupler

## Diagramme de flux P3 complet

```
Idée → Brief → Génération (3 drafts + brand review + budget check)
  → Review → Approbation → Post (scheduled)
  → Postiz upload + draft → Publication → Analytics → Learning Notes
  ↑_________________________|
  |  Campagne (optionnel)  |
  |________________________|
```

## Structure des fichiers P3

```
apps/web/src/
├── lib/content-studio/
│   ├── idempotency.ts          # → refactor vers DB-backed
│   ├── budget.ts               # NEW — budget enforcement
│   ├── repository.ts           # → ajout pagination + campaign CRUD
│   ├── service.ts              # → ajout campaign + budget checks
│   └── hooks/                  # NEW — extracted testable hooks
│       ├── useDraftValidation.ts
│       └── useBudgetStatus.ts
├── app/api/admin/content-studio/
│   ├── campaigns/              # NEW — CRUD campaigns
│   ├── ideas/route.ts          # → pagination
│   ├── drafts/route.ts         # → pagination
│   ├── posts/route.ts          # → pagination
│   ├── learning-notes/route.ts # → pagination
│   └── generation-runs/route.ts# → budget data
├── components/admin/content-studio/
│   ├── CampaignForm.tsx        # NEW
│   ├── CampaignSelect.tsx      # NEW
│   ├── LoadMore.tsx            # NEW
│   └── BudgetSummary.tsx       # → budget restant
├── test/
│   ├── msw/content-studio-handlers.ts     # → 6 nouveaux handlers
│   ├── msw/content-studio-handlers.test.ts # → 12 nouveaux tests
│   └── unit/content-studio/    # NEW — hooks & logic tests
│       ├── useDraftValidation.test.ts
│       └── budget.test.ts
└── e2e/
    └── content-studio.spec.ts  # → workflow complet

apps/web/drizzle/migrations/
└── 0061_p3_idempotency_campaigns.sql  # NEW migration
```