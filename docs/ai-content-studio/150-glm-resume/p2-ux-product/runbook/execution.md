# Runbook P2 — Exécution pas-à-pas

**Serveur** : staging.femiglow-maroc.com (`/var/www/femiglow-staging`)
**Branche** : master
**Environnement** : `apps/web/`
**Prérequis** : P1 terminé (126 tests, 15 fichiers, monolithe 203 lignes)

---

## Prérequis

```bash
cd /var/www/femiglow-staging/apps/web
# Vérifier que les tests P1 passent
npx vitest run src/lib/content-studio/ src/components/admin/content-studio/ src/test/msw/content-studio-handlers.test.ts
# Vérifier le build
npx next build 2>&1 | tail -10
# Vérifier la DB
pnpm drizzle-kit push 2>&1 | tail -5
```

---

## Phase P2.1 — Actions de review

### Étape 1.1 — Migration DB

```bash
# Créer le fichier de migration
cat > drizzle/migrations/0060_p2_review_actions.sql << 'EOF'
ALTER TABLE content_draft ADD COLUMN IF NOT EXISTS "rejectionReason" text;
ALTER TABLE content_draft ADD COLUMN IF NOT EXISTS "parentDraftId" text REFERENCES content_draft(id) ON DELETE SET NULL;
ALTER TABLE content_idea ADD COLUMN IF NOT EXISTS "rejectionReason" text;
ALTER TABLE content_post ADD COLUMN IF NOT EXISTS "cancelledBy" text;
ALTER TABLE content_post ADD COLUMN IF NOT EXISTS "cancelledAt" timestamptz;
ALTER TABLE content_post ADD COLUMN IF NOT EXISTS "cancelReason" text;
ALTER TABLE content_brand_review ADD COLUMN IF NOT EXISTS "reviewerId" text;
ALTER TABLE content_brand_review ADD COLUMN IF NOT EXISTS "reviewType" text NOT NULL DEFAULT 'auto';
CREATE INDEX IF NOT EXISTS idx_content_draft_parent ON content_draft("parentDraftId");
CREATE INDEX IF NOT EXISTS idx_content_post_status ON content_post(status);
CREATE INDEX IF NOT EXISTS idx_content_idea_status ON content_idea(status);
EOF

# Appliquer la migration
pnpm drizzle-kit push
```

Mettre à jour `src/lib/db/schema-content-studio.ts` pour refléter les nouvelles colonnes.

### Valider

```bash
pnpm drizzle-kit push
pnpm tsc --noEmit
```

### Commit

```bash
git add -A
git commit -m "feat(content-studio): add P2 migration — rejection, variation, cancellation columns"
```

---

### Étape 1.2 — Types + schémas Zod

```bash
# Modifier src/lib/content-studio/types.ts
# Ajouter : RejectDraftInput, CancelPostInput, VariationInput, RescheduleInput,
#           ArchiveInput, ContentLearningNote, ContentBriefUpdate, AnalyticsOverview

# Modifier src/lib/content-studio/schemas.ts
# Ajouter : draftRejectSchema, postCancelSchema, draftVariationSchema,
#           postRescheduleSchema, archiveSchema, briefUpdateSchema,
#           learningNoteSchema, ideaQuerySchema, draftQuerySchema, postQuerySchema

# Ajouter tests dans src/lib/content-studio/schemas.test.ts
```

### Valider

```bash
npx vitest run src/lib/content-studio/schemas.test.ts
npx tsc --noEmit
```

### Commit

```bash
git add -A
git commit -m "feat(content-studio): add P2 types and Zod schemas for review actions"
```

---

### Étape 1.3 — Repository : nouvelles fonctions

```bash
# Modifier src/lib/content-studio/repository.ts
# Ajouter : rejectDraft, cancelPost, archiveIdea, archiveDraft, archivePost,
#           createDraftVariation, listReviewsByDraft

# Ajouter tests dans src/lib/content-studio/repository.test.ts (nouveau fichier)
```

### Valider

```bash
npx vitest run src/lib/content-studio/repository.test.ts
```

### Commit

```bash
git add -A
git commit -m "feat(content-studio): add repository functions for reject, cancel, archive, variation"
```

---

### Étape 1.4 — Service : nouvelles fonctions

```bash
# Modifier src/lib/content-studio/service.ts
# Ajouter : rejectContentDraft, cancelScheduledPost, archiveContent*,
#           createDraftVariation, reschedulePost

# Ajouter tests dans src/lib/content-studio/service.test.ts
```

### Valider

```bash
npx vitest run src/lib/content-studio/service.test.ts
```

### Commit

```bash
git add -A
git commit -m "feat(content-studio): add service functions for review actions with state machine enforcement"
```

---

### Étape 1.5 — API routes

```bash
# Créer les nouvelles routes API
mkdir -p src/app/api/admin/content-studio/drafts/\[id\]/reject
mkdir -p src/app/api/admin/content-studio/drafts/\[id\]/variation
mkdir -p src/app/api/admin/content-studio/drafts/\[id\]/archive
mkdir -p src/app/api/admin/content-studio/drafts/\[id\]/reviews
mkdir -p src/app/api/admin/content-studio/posts/\[id\]/cancel
mkdir -p src/app/api/admin/content-studio/posts/\[id\]/reschedule
mkdir -p src/app/api/admin/content-studio/posts/\[id\]/archive
mkdir -p src/app/api/admin/content-studio/ideas/\[id\]/archive

# Chaque route suit le pattern existant :
# 1. requireContentStudioEnabled()
# 2. requireAdminApi()
# 3. Parse body avec Zod schema
# 4. Appel service
# 5. Retour JSON structuré
```

### Valider

```bash
npx tsc --noEmit
npx next build 2>&1 | tail -10
```

### Commit

```bash
git add -A
git commit -m "feat(content-studio): add API routes for reject, cancel, archive, variation, reschedule"
```

---

### Étape 1.6 — Frontend : composants RejectDialog, CancelDialog, ArchiveButton

```bash
# Créer les composants
# src/components/admin/content-studio/RejectDialog.tsx
# src/components/admin/content-studio/CancelDialog.tsx
# src/components/admin/content-studio/ArchiveButton.tsx

# Modifier DraftEditor.tsx pour ajouter les boutons
# Modifier api.ts pour ajouter deleteJson et les nouvelles routes

# Ajouter tests de rendu
```

### Valider

```bash
npx vitest run src/components/admin/content-studio/
npx tsc --noEmit
npx next build
```

### Commit

```bash
git add -A
git commit -m "feat(content-studio): add RejectDialog, CancelDialog, ArchiveButton components"
```

---

### Étape 1.7 — State machine : tests de transitions supplémentaires

```bash
# Modifier src/lib/content-studio/state-machine.test.ts
# Ajouter tests pour : needs_review → rejected, scheduled → cancelled, * → archived
```

### Valider

```bash
npx vitest run src/lib/content-studio/state-machine.test.ts
```

### Commit

```bash
git add -A
git commit -m "test(content-studio): add state machine transition tests for P2 actions"
```

---

## Phase P2.2 — Brief éditeur + validation Zod

### Étape 2.1 — API route brief

```bash
mkdir -p src/app/api/admin/content-studio/briefs/\[id\]
# Créer route.ts avec PATCH
```

### Étape 2.2 — Composant BriefEditor

```bash
# Créer src/components/admin/content-studio/BriefEditor.tsx
# Formulaire modifiable avec : angle, proof, CTA, media direction, constraints
```

### Étape 2.3 — Validation Zod côté client

```bash
# Modifier IdeaForm.tsx — ajouter validation avec contentIdeaCreateSchema
# Modifier DraftEditor.tsx — ajouter validation avec draftUpdateSchema
```

### Valider + Commit (regroupé)

```bash
npx vitest run src/lib/content-studio/ src/components/admin/content-studio/
npx next build
git add -A
git commit -m "feat(content-studio): add brief editor and client-side Zod validation"
```

---

## Phase P2.3 — Calendrier éditorial

### Étape 3.1 — Composants Calendar

```bash
# Créer CalendarWeekView.tsx, CalendarMonthView.tsx, CalendarFilters.tsx
# Modifier EditorialCalendar.tsx pour intégrer les vues
```

### Étape 3.2 — API filtres

```bash
# Modifier routes GET /ideas, /drafts, /posts pour accepter query params
# Ajouter validation avec ideaQuerySchema, draftQuerySchema, postQuerySchema
```

### Valider + Commit

```bash
npx vitest run
npx next build
git add -A
git commit -m "feat(content-studio): add calendar week/month views and query filters"
```

---

## Phase P2.4 — Notes + UTM

### Étape 4.1-4.4 — Repository, Service, API, Composants

```bash
# Créer : repository functions, service functions, API routes
# Créer : LearningNotes.tsx, utm.ts, UtmBuilder.tsx
# Modifier : DraftEditor.tsx pour intégrer UtmBuilder
# Ajouter : tests unitaires et MSW
```

### Valider + Commit

```bash
npx vitest run src/lib/content-studio/ src/components/admin/content-studio/ src/test/msw/
git add -A
git commit -m "feat(content-studio): add learning notes, UTM builder, and note API routes"
```

---

## Phase P2.5 — Analytics dashboard

```bash
# Créer : analytics-service.ts, API route, AnalyticsDashboard.tsx
# Modifier : ContentStudioClient.tsx pour intégrer le dashboard
# Ajouter : tests
```

### Valider + Commit

```bash
npx vitest run
npx next build
git add -A
git commit -m "feat(content-studio): add analytics dashboard and overview API"
```

---

## Phase P2.6 — Budget tracking + idempotence

```bash
# Créer : budget.ts
# Modifier : service.ts pour vérification budget et idempotencyKey
# Ajouter : tests
```

### Valider + Commit

```bash
npx vitest run
npx next build
git add -A
git commit -m "feat(content-studio): add budget tracking and idempotency keys"
```

---

## Phase P2.7 — Pages séparées

```bash
# Créer : layout.tsx avec sidebar
# Créer : pages pour ideas, drafts, calendar, postiz, analytics
# Modifier : ContentStudioClient.tsx pour router vers les pages
```

### Valider + Commit

```bash
npx next build
git add -A
git commit -m "refactor(content-studio): add separate pages with sidebar navigation"
```

---

## Phase P2.8 — Tests E2E Playwright + MSW étendu

### Étape 8.1 — Configuration Playwright

```bash
# Vérifier que Playwright est configuré
npx playwright --version

# Créer e2e/content-studio-full-flow.spec.ts
# Créer e2e/fixtures/content-studio.ts
```

### Étape 8.2 — Scénarios E2E

```bash
# Créer les fichiers de spec :
# e2e/content-studio-reject.spec.ts
# e2e/content-studio-variation.spec.ts
# e2e/content-studio-cancel.spec.ts
# e2e/content-studio-brief.spec.ts
# e2e/content-studio-notes.spec.ts
# e2e/content-studio-utm.spec.ts
# e2e/content-studio-calendar.spec.ts
```

### Étape 8.3 — MSW étendu

```bash
# Modifier src/test/msw/content-studio-handlers.ts
# Ajouter handlers pour reject, variation, cancel, archive, briefs, notes, analytics
# Ajouter tests dans content-studio-handlers.test.ts
```

### Valider + Commit

```bash
npx vitest run
npx playwright test --grep "content-studio"
git add -A
git commit -m "test(content-studio): add E2E Playwright tests and extend MSW handlers"
```

---

## Validation finale

Après toutes les étapes :

```bash
cd /var/www/femiglow-staging/apps/web

# TypeScript (vérifier qu'il n'y a pas d'erreurs autres que pré-existantes)
npx tsc --noEmit

# Tests unitaires (216+ tests)
npx vitest run src/lib/content-studio/ src/components/admin/content-studio/ src/test/msw/

# Build
npx next build

# Redémarrer staging
systemctl restart femiglow-staging

# Vérifier l'API sans session
curl -s http://localhost:8012/api/admin/content-studio/ideas | python3 -m json.tool
# Attendu : {"error": {"code": "unauthorized", "message": "Session expirée..."}}

# Vérifier les nouvelles routes
curl -s -X POST http://localhost:8012/api/admin/content-studio/drafts/test/reject | python3 -m json.tool
# Attendu : 401 unauthorized
```

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

## Problèmes connus hérités de P1

1. **`image-generation.test.ts`** : Le test `sharp` ne fonctionne pas en environnement de test (module natif non disponible). Pas bloquant.
2. **`postiz.test.ts`** : 3 erreurs TypeScript "Object is possibly 'undefined'" — pré-existantes, pas liées aux changements P1/P2.