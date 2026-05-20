# Checklist P2 — Fichiers impactés par tâche

## Phase P2.1 — Actions de review

### Étape 1.1 — Migration DB
- [ ] `drizzle/migrations/0060_p2_review_actions.sql` — nouveau
- [ ] `src/lib/db/schema-content-studio.ts` — ajouter colonnes rejectionReason, parentDraftId, cancelledBy, cancelledAt, cancelReason, reviewerId, reviewType

### Étape 1.2 — Types + schémas Zod
- [ ] `src/lib/content-studio/types.ts` — ajouter RejectDraftInput, CancelPostInput, VariationInput, RescheduleInput, ArchiveInput, ContentLearningNote, ContentBriefUpdate, AnalyticsOverview
- [ ] `src/lib/content-studio/schemas.ts` — ajouter draftRejectSchema, postCancelSchema, draftVariationSchema, postRescheduleSchema, archiveSchema, briefUpdateSchema, learningNoteSchema, ideaQuerySchema, draftQuerySchema, postQuerySchema
- [ ] `src/lib/content-studio/schemas.test.ts` — ajouter tests pour nouveaux schémas

### Étape 1.3 — Repository
- [ ] `src/lib/content-studio/repository.ts` — ajouter rejectDraft, cancelPost, archiveIdea, archiveDraft, archivePost, createDraftVariation, listReviewsByDraft

### Étape 1.4 — Service
- [ ] `src/lib/content-studio/service.ts` — ajouter rejectContentDraft, cancelScheduledPost, archiveContentIdea, archiveContentDraft, archiveContentPost, createDraftVariation, reschedulePost
- [ ] `src/lib/content-studio/service.test.ts` — ajouter tests pour nouvelles fonctions

### Étape 1.5 — API routes
- [ ] `src/app/api/admin/content-studio/drafts/[id]/reject/route.ts` — nouveau
- [ ] `src/app/api/admin/content-studio/drafts/[id]/variation/route.ts` — nouveau
- [ ] `src/app/api/admin/content-studio/drafts/[id]/archive/route.ts` — nouveau
- [ ] `src/app/api/admin/content-studio/drafts/[id]/reviews/route.ts` — nouveau
- [ ] `src/app/api/admin/content-studio/posts/[id]/cancel/route.ts` — nouveau
- [ ] `src/app/api/admin/content-studio/posts/[id]/reschedule/route.ts` — nouveau
- [ ] `src/app/api/admin/content-studio/posts/[id]/archive/route.ts` — nouveau
- [ ] `src/app/api/admin/content-studio/ideas/[id]/archive/route.ts` — nouveau
- [ ] `src/app/api/admin/content-studio/ideas/[id]/route.ts` — nouveau (GET detail)

### Étape 1.6 — Frontend composants
- [ ] `src/components/admin/content-studio/RejectDialog.tsx` — nouveau
- [ ] `src/components/admin/content-studio/CancelDialog.tsx` — nouveau
- [ ] `src/components/admin/content-studio/ArchiveButton.tsx` — nouveau
- [ ] `src/components/admin/content-studio/DraftEditor.tsx` — ajouter boutons Rejeter, Variante, Archiver
- [ ] `src/components/admin/content-studio/api.ts` — ajouter deleteJson, nouvelles routes

### Étape 1.7 — State machine tests
- [ ] `src/lib/content-studio/state-machine.test.ts` — ajouter tests pour nouvelles transitions

---

## Phase P2.2 — Brief éditeur + validation Zod

- [ ] `src/app/api/admin/content-studio/briefs/[id]/route.ts` — nouveau (PATCH)
- [ ] `src/components/admin/content-studio/BriefEditor.tsx` — nouveau
- [ ] `src/components/admin/content-studio/IdeaForm.tsx` — ajouter validation Zod
- [ ] `src/components/admin/content-studio/DraftEditor.tsx` — ajouter validation Zod

---

## Phase P2.3 — Calendrier éditorial

- [ ] `src/components/admin/content-studio/CalendarWeekView.tsx` — nouveau
- [ ] `src/components/admin/content-studio/CalendarMonthView.tsx` — nouveau
- [ ] `src/components/admin/content-studio/CalendarFilters.tsx` — nouveau
- [ ] `src/components/admin/content-studio/EditorialCalendar.tsx` — enrichir avec vues et filtres
- [ ] `src/app/api/admin/content-studio/ideas/route.ts` — ajouter filtres query params
- [ ] `src/app/api/admin/content-studio/drafts/route.ts` — ajouter filtres query params
- [ ] `src/app/api/admin/content-studio/posts/route.ts` — ajouter filtres query params

---

## Phase P2.4 — Notes + UTM

- [ ] `src/lib/content-studio/repository.ts` — ajouter CRUD learning notes
- [ ] `src/lib/content-studio/service.ts` — ajouter learning note functions
- [ ] `src/app/api/admin/content-studio/posts/[id]/notes/route.ts` — nouveau
- [ ] `src/app/api/admin/content-studio/posts/[id]/notes/[noteId]/route.ts` — nouveau (DELETE)
- [ ] `src/components/admin/content-studio/LearningNotes.tsx` — nouveau
- [ ] `src/lib/content-studio/utm.ts` — nouveau
- [ ] `src/lib/content-studio/utm.test.ts` — nouveau
- [ ] `src/components/admin/content-studio/UtmBuilder.tsx` — nouveau
- [ ] `src/components/admin/content-studio/DraftEditor.tsx` — intégrer UtmBuilder

---

## Phase P2.5 — Analytics dashboard

- [ ] `src/lib/content-studio/analytics-service.ts` — nouveau
- [ ] `src/app/api/admin/content-studio/analytics/overview/route.ts` — nouveau
- [ ] `src/components/admin/content-studio/AnalyticsDashboard.tsx` — nouveau
- [ ] `src/components/admin/content-studio/ContentStudioClient.tsx` — ajouter AnalyticsDashboard

---

## Phase P2.6 — Budget + idempotence

- [ ] `src/lib/content-studio/budget.ts` — nouveau
- [ ] `src/lib/content-studio/budget.test.ts` — nouveau
- [ ] `src/lib/content-studio/service.ts` — ajouter vérification budget avant génération
- [ ] `src/lib/content-studio/service.ts` — ajouter idempotencyKey aux mutations critiques

---

## Phase P2.7 — Pages séparées

- [ ] `src/app/admin/content-studio/layout.tsx` — nouveau (sidebar navigation)
- [ ] `src/app/admin/content-studio/page.tsx` — nouveau (dashboard)
- [ ] `src/app/admin/content-studio/ideas/page.tsx` — nouveau
- [ ] `src/app/admin/content-studio/ideas/[id]/page.tsx` — nouveau
- [ ] `src/app/admin/content-studio/drafts/page.tsx` — nouveau
- [ ] `src/app/admin/content-studio/drafts/[id]/page.tsx` — nouveau
- [ ] `src/app/admin/content-studio/calendar/page.tsx` — nouveau
- [ ] `src/app/admin/content-studio/postiz/page.tsx` — nouveau

---

## Phase P2.8 — Tests E2E + MSW étendu

- [ ] `e2e/content-studio.spec.ts` — nouveau
- [ ] `src/test/msw/content-studio-handlers.ts` — enrichir avec nouvelles routes
- [ ] `src/test/msw/content-studio-handlers.test.ts` — ajouter tests
- [ ] `src/lib/content-studio/analytics-service.test.ts` — nouveau
- [ ] `src/components/admin/content-studio/BriefEditor.test.tsx` — nouveau
- [ ] `src/components/admin/content-studio/LearningNotes.test.tsx` — nouveau
- [ ] `src/components/admin/content-studio/UtmBuilder.test.tsx` — nouveau
- [ ] `src/components/admin/content-studio/RejectDialog.test.tsx` — nouveau
- [ ] `src/components/admin/content-studio/CalendarWeekView.test.tsx` — nouveau