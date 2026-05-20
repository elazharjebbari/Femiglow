# P2 — Étapes de développement détaillées

Chaque étape est atomique : code + tests + vérification.

---

## Phase P2.1 — Actions de review (rejeter, variation, annuler, archiver)

### Étape 1.1 — Migration DB : colonnes rejectionReason, parentDraftId, cancelReason

**Fichier** : `drizzle/migrations/0060_p2_review_actions.sql`

```sql
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
```

Mettre à jour le schéma Drizzle dans `schema-content-studio.ts` pour refléter ces colonnes.

**Tests** : vérifier que la migration s'applique sans erreur.

**Validation** :
```bash
cd /var/www/femiglow-staging/apps/web
pnpm drizzle-kit push
```

### Étape 1.2 — Types + schémas Zod pour les nouvelles actions

**Fichiers** :
- `src/lib/content-studio/types.ts` — ajouter `RejectDraftInput`, `CancelPostInput`, `VariationInput`, `RescheduleInput`, `ArchiveInput`
- `src/lib/content-studio/schemas.ts` — ajouter `draftRejectSchema`, `postCancelSchema`, `draftVariationSchema`, `postRescheduleSchema`, `archiveSchema`

**Tests** :
- `src/lib/content-studio/schemas.test.ts` — ajouter tests pour chaque nouveau schéma (valid, invalid, edge cases)

**Validation** :
```bash
pnpm vitest run src/lib/content-studio/schemas.test.ts
pnpm tsc --noEmit
```

### Étape 1.3 — Repository : fonctions reject, cancel, archive, variation

**Fichier** : `src/lib/content-studio/repository.ts`

Ajouter :
- `rejectDraft(id, reason?)` — update status → 'rejected', set rejectionReason
- `cancelPost(id, reason?, cancelledBy?)` — update status → 'cancelled', set cancelledAt, cancelledBy, cancelReason
- `archiveIdea(id)` — update status → 'archived'
- `archiveDraft(id)` — update status → 'archived'
- `archivePost(id)` — update status → 'archived'
- `createDraftVariation(fromDraftId, overrides)` — clone le draft avec nouveau variantLabel, lien parentDraftId
- `listReviewsByDraft(draftId)` — historique complet des reviews

**Tests** :
- `src/lib/content-studio/repository.test.ts` — tests unitaires pour chaque nouvelle fonction

### Étape 1.4 — Service : fonctions reject, cancel, archive, variation

**Fichier** : `src/lib/content-studio/service.ts`

Ajouter :
- `rejectContentDraft(draftId, reason?)` — assertTransition(currentStatus, 'rejected'), appel repository
- `cancelScheduledPost(postId, reason?)` — assertTransition(currentStatus, 'cancelled'), appel repository
- `archiveContentIdea(ideaId)` — assertTransition(currentStatus, 'archived')
- `archiveContentDraft(draftId)` — assertTransition(currentStatus, 'archived')
- `archiveContentPost(postId)` — assertTransition(currentStatus, 'archived')
- `createDraftVariation(draftId, overrides)` — assertTransition(draft.status, 'generated'), clone le draft, génère nouveau texte
- `reschedulePost(postId, scheduledAt)` — update scheduledAt sur post

**Tests** :
- `src/lib/content-studio/service.test.ts` — ajouter tests pour chaque nouvelle fonction avec vérification des transitions valides et invalides

### Étape 1.5 — API routes : reject, cancel, archive, variation, reschedule

**Nouveaux fichiers** :
- `src/app/api/admin/content-studio/drafts/[id]/reject/route.ts`
- `src/app/api/admin/content-studio/drafts/[id]/variation/route.ts`
- `src/app/api/admin/content-studio/drafts/[id]/archive/route.ts`
- `src/app/api/admin/content-studio/drafts/[id]/reviews/route.ts`
- `src/app/api/admin/content-studio/posts/[id]/cancel/route.ts`
- `src/app/api/admin/content-studio/posts/[id]/reschedule/route.ts`
- `src/app/api/admin/content-studio/posts/[id]/archive/route.ts`
- `src/app/api/admin/content-studio/ideas/[id]/archive/route.ts`
- `src/app/api/admin/content-studio/ideas/[id]/route.ts` (GET detail)

Chaque route suit le pattern existant :
1. `requireContentStudioEnabled()`
2. `requireAdminApi()`
3. Parse body avec Zod schema
4. Appel service
5. Retour JSON structuré

**Tests MSW** :
- `src/test/msw/content-studio-handlers.ts` — ajouter handlers pour les nouvelles routes
- `src/test/msw/content-studio-handlers.test.ts` — ajouter tests d'intégration

### Étape 1.6 — Frontend : composants RejectDialog, CancelDialog, ArchiveButton

**Nouveaux fichiers** :
- `src/components/admin/content-studio/RejectDialog.tsx` — modal avec textarea pour raison
- `src/components/admin/content-studio/CancelDialog.tsx` — modal avec textarea pour raison
- `src/components/admin/content-studio/ArchiveButton.tsx` — bouton générique d'archivage

**Modification** :
- `src/components/admin/content-studio/DraftEditor.tsx` — ajouter boutons "Rejeter", "Variante", "Archiver"
- `src/components/admin/content-studio/api.ts` — ajouter `deleteJson()` pour les routes DELETE/PATCH

**Tests** :
- Tests de rendu pour RejectDialog, CancelDialog, ArchiveButton

### Étape 1.7 — State machine : tests de transitions supplémentaires

**Fichier** : `src/lib/content-studio/state-machine.test.ts`

Ajouter les transitions qui étaient manquantes ou non testées :
- `needs_review → rejected` (nouvelle route)
- `scheduled → cancelled` (nouvelle route)
- `* → archived` (nouvelles routes)
- Vérifier que les transitions invalides lèvent bien HttpError(409)

---

## Phase P2.2 — Brief éditeur + validation Zod client

### Étape 2.1 — API route pour modifier un brief

**Nouveau fichier** : `src/app/api/admin/content-studio/briefs/[id]/route.ts`

- `PATCH` : mise à jour partielle du brief (angle, proof, cta, mediaDirection, constraints)
- Validation avec `briefUpdateSchema`

### Étape 2.2 — Composant BriefEditor

**Nouveau fichier** : `src/components/admin/content-studio/BriefEditor.tsx`

- Formulaire modifiable avec champs : angle, proof, CTA, media direction, constraints
- Sauvegarde via PATCH `/api/admin/content-studio/briefs/:id`
- Affichage en lecture seule si le brief est déjà en statut `generated` ou plus avancé

### Étape 2.3 — Validation Zod côté client

**Modification** : `src/components/admin/content-studio/IdeaForm.tsx`

- Importer `contentIdeaCreateSchema` depuis `@/lib/content-studio/schemas`
- Avant le submit, valider avec `safeParse`
- Afficher les erreurs de validation à côté des champs

**Modification** : `src/components/admin/content-studio/DraftEditor.tsx`

- Importer `draftUpdateSchema` depuis `@/lib/content-studio/schemas`
- Valider le formulaire de sauvegarde avant l'envoi

---

## Phase P2.3 — Calendrier éditorial interactif

### Étape 3.1 — Composants CalendarWeekView, CalendarMonthView, CalendarFilters

**Nouveaux fichiers** :
- `src/components/admin/content-studio/CalendarWeekView.tsx`
- `src/components/admin/content-studio/CalendarMonthView.tsx`
- `src/components/admin/content-studio/CalendarFilters.tsx`

**Modification** : `src/components/admin/content-studio/EditorialCalendar.tsx`

- Ajouter un toggle vue pipeline/semaine/mois
- Ajouter les filtres (plateforme, pilier, statut)
- Intégrer CalendarWeekView et CalendarMonthView

### Étape 3.2 — API : filtres pour les listes

**Modification** : routes existantes `GET /ideas`, `GET /drafts`, `GET /posts`

- Ajouter paramètres de query : `status`, `platform`, `pillar`, `format`, `limit`, `offset`
- Validation via `ideaQuerySchema`, `draftQuerySchema`, `postQuerySchema`

**Tests MSW** : ajouter handlers avec filtres

---

## Phase P2.4 — Notes d'apprentissage + tags + UTM

### Étape 4.1 — Repository + Service pour learning notes

**Fichier** : `src/lib/content-studio/repository.ts`

Ajouter :
- `createLearningNote(postId, note, tags, createdBy)`
- `listLearningNotes(postId)`
- `deleteLearningNote(noteId)`

**Fichier** : `src/lib/content-studio/service.ts`

Ajouter :
- `addLearningNote(postId, note, tags)`
- `listLearningNotes(postId)`
- `removeLearningNote(noteId)`

### Étape 4.2 — API routes pour notes

**Nouveaux fichiers** :
- `src/app/api/admin/content-studio/posts/[id]/notes/route.ts` (GET list, POST create)
- `src/app/api/admin/content-studio/posts/[id]/notes/[noteId]/route.ts` (DELETE)

### Étape 4.3 — Composant LearningNotes

**Nouveau fichier** : `src/components/admin/content-studio/LearningNotes.tsx`

- Formulaire d'ajout de note avec tags (winner, loser, insight)
- Liste des notes existantes
- Bouton de suppression

### Étape 4.4 — UTM Builder

**Nouveau fichier** : `src/lib/content-studio/utm.ts`

- `generateUtmUrl(params)` — construction d'URL UTM
- `parseUtmParams(url)` — parsing d'URL UTM

**Nouveau fichier** : `src/components/admin/content-studio/UtmBuilder.tsx`

- Formulaire avec : base URL, source (auto depuis platform), medium (social), campaign (auto depuis pillar), content (auto depuis format)
- Prévisualisation de l'URL générée
- Bouton copier

**Modification** : `src/components/admin/content-studio/DeliveryPanel.tsx` (dans DraftEditor)

- Intégrer UtmBuilder dans la section Postiz
- Stocker l'URL UTM dans `post.utm`

**Tests** :
- `src/lib/content-studio/utm.test.ts` — tests unitaires pour generateUtmUrl et parseUtmParams

---

## Phase P2.5 — Dashboard analytics + santé Postiz

### Étape 5.1 — Service analytics

**Nouveau fichier** : `src/lib/content-studio/analytics-service.ts`

- `getAnalyticsOverview()` — agrège : total posts par statut, par plateforme, par pilier, score moyen, snapshots récents, santé delivery

### Étape 5.2 — API route analytics

**Nouveau fichier** : `src/app/api/admin/content-studio/analytics/overview/route.ts`

### Étape 5.3 — Composant AnalyticsDashboard

**Nouveau fichier** : `src/components/admin/content-studio/AnalyticsDashboard.tsx`

- KPIs : posts par statut, taux d'approbation, score moyen
- Graphiques simples (barres) : distribution par pilier, par plateforme
- Tableau des derniers snapshots de performance

**Modification** : `src/components/admin/content-studio/ContentStudioClient.tsx`

- Ajouter AnalyticsDashboard en haut de la page

---

## Phase P2.6 — Budget tracking + idempotence

### Étape 6.1 — Module budget

**Nouveau fichier** : `src/lib/content-studio/budget.ts`

- `getDailyBudgetStatus()` — consulte content_generation_run pour le jour courant
- Vérification du budget dans `service.ts` avant chaque appel OpenAI

**Cron** : ajouter route `GET /api/cron/content-studio/budget-reset` (ou intégrer dans le cron existant)

### Étape 6.2 — Idempotence

**Modification** : `src/lib/content-studio/service.ts`

- Ajouter `idempotencyKey` aux mutations critiques (generate, review, approve, postiz-draft)
- Vérifier en DB si la clé existe déjà avant d'exécuter
- Retourner le résultat existant si clé déjà utilisée

---

## Phase P2.7 — Pages séparées + navigation

### Étape 7.1 — Layout avec sidebar

**Nouveau fichier** : `src/app/admin/content-studio/layout.tsx`

- Sidebar avec liens : Tableau de bord, Idées, Brouillons, Calendrier, Postiz, Analytics, Paramètres
- Utiliser le layout admin existant

### Étape 7.2 — Pages séparées

**Nouveaux fichiers** :
- `src/app/admin/content-studio/page.tsx` — Tableau de bord (analytics overview)
- `src/app/admin/content-studio/ideas/page.tsx` — Liste des idées
- `src/app/admin/content-studio/ideas/[id]/page.tsx` — Détail idée + brief
- `src/app/admin/content-studio/drafts/page.tsx` — Liste des brouillons
- `src/app/admin/content-studio/drafts/[id]/page.tsx` — Éditeur de brouillon
- `src/app/admin/content-studio/calendar/page.tsx` — Calendrier éditorial
- `src/app/admin/content-studio/postiz/page.tsx` — Santé Postiz

Chaque page est un Server Component qui fetch les données initiales et passe au Client Component.

---

## Phase P2.8 — Tests E2E Playwright + MSW étendu

### Étape 8.1 — Tests E2E Playwright

**Nouveau fichier** : `e2e/content-studio.spec.ts`

Scénarios :
1. Créer une idée → vérifier l'affichage
2. Générer des brouillons → vérifier le score
3. Rejeter un brouillon → vérifier le statut
4. Approuver un brouillon → vérifier le post créé
5. Annuler un post planifié → vérifier le statut
6. Archiver une idée → vérifier la disparition
7. Modifier un brief → vérifier la sauvegarde
8. Ajouter une note d'apprentissage → vérifier l'affichage
9. Builder UTM → vérifier l'URL générée

### Étape 8.2 — MSW handlers étendus

**Modification** : `src/test/msw/content-studio-handlers.ts`

- Ajouter handlers pour : reject, variation, cancel, archive, briefs, notes, analytics

### Étape 8.3 — Tests unitaires supplémentaires

- `src/lib/content-studio/utm.test.ts`
- `src/lib/content-studio/budget.test.ts`
- `src/lib/content-studio/analytics-service.test.ts`
- `src/components/admin/content-studio/BriefEditor.test.tsx`
- `src/components/admin/content-studio/LearningNotes.test.tsx`
- `src/components/admin/content-studio/UtmBuilder.test.tsx`
- `src/components/admin/content-studio/RejectDialog.test.tsx`
- `src/components/admin/content-studio/CalendarWeekView.test.tsx`