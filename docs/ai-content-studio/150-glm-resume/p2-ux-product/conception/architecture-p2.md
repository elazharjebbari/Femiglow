# Architecture P2 — Modèle de données, API, State Machine

## 1. State Machine — Transitions à ajouter

La state machine actuelle définit déjà toutes les transitions nécessaires pour P2, mais les API routes et fonctions de service n'existent pas encore.

### Transitions existantes sans endpoint API :

| Transition | Endpoint manquant | Service manquant |
|------------|-------------------|-----------------|
| `needs_review → rejected` | `POST /drafts/:id/reject` | `rejectContentDraft()` |
| `generated → rejected` | `POST /drafts/:id/reject` | `rejectContentDraft()` |
| `needs_review → generated` | `POST /drafts/:id/variation` | `createDraftVariation()` |
| `scheduled → cancelled` | `POST /posts/:id/cancel` | `cancelScheduledPost()` |
| `scheduled → approved` | `POST /posts/:id/cancel` (reschedule) | `cancelScheduledPost()` |
| `* → archived` | `POST /:type/:id/archive` | `archiveContent*()` |

### Nouveaux endpoints API nécessaires :

```
POST   /api/admin/content-studio/drafts/:id/reject          — rejeter un brouillon
POST   /api/admin/content-studio/drafts/:id/variation       — créer une variation
POST   /api/admin/content-studio/posts/:id/cancel           — annuler une publication planifiée
PATCH  /api/admin/content-studio/posts/:id/reschedule        — reprogrammer
POST   /api/admin/content-studio/ideas/:id/archive          — archiver une idée
POST   /api/admin/content-studio/drafts/:id/archive          — archiver un brouillon
POST   /api/admin/content-studio/posts/:id/archive           — archiver un post
GET    /api/admin/content-studio/ideas/:id                   — détail idée (avec brief)
GET    /api/admin/content-studio/drafts/:id/reviews          — historique reviews
PATCH  /api/admin/content-studio/briefs/:id                  — modifier un brief
POST   /api/admin/content-studio/posts/:id/notes             — ajouter une note
GET    /api/admin/content-studio/posts/:id/notes             — lister les notes
GET    /api/admin/content-studio/analytics/overview           — dashboard analytics
```

---

## 2. Modèle de données — Migrations nécessaires

### 2a. Colonnes à ajouter (migration SQL)

```sql
-- content_draft : raison de rejet + lien vers le draft parent (variations)
ALTER TABLE content_draft ADD COLUMN IF NOT EXISTS "rejectionReason" text;
ALTER TABLE content_draft ADD COLUMN IF NOT EXISTS "parentDraftId" text
  REFERENCES content_draft(id) ON DELETE SET NULL;

-- content_idea : raison de rejet
ALTER TABLE content_idea ADD COLUMN IF NOT EXISTS "rejectionReason" text;

-- content_post : annulation + reprogrammation
ALTER TABLE content_post ADD COLUMN IF NOT EXISTS "cancelledBy" text;
ALTER TABLE content_post ADD COLUMN IF NOT EXISTS "cancelledAt" timestamptz;
ALTER TABLE content_post ADD COLUMN IF NOT EXISTS "cancelReason" text;

-- content_brand_review : review manuelle
ALTER TABLE content_brand_review ADD COLUMN IF NOT EXISTS "reviewerId" text;
ALTER TABLE content_brand_review ADD COLUMN IF NOT EXISTS "reviewType" text NOT NULL DEFAULT 'auto';
```

### 2b. Tables déjà existantes mais non câblées

```sql
-- content_learning_note : table existante, pas de repository/service/API
-- content_campaign : table existante, pas de repository/service/API
```

### 2c. Index à ajouter

```sql
CREATE INDEX IF NOT EXISTS idx_content_draft_parent ON content_draft("parentDraftId");
CREATE INDEX IF NOT EXISTS idx_content_post_status ON content_post(status);
CREATE INDEX IF NOT EXISTS idx_content_idea_status ON content_idea(status);
```

---

## 3. Types TypeScript — Ajouts

```typescript
// Ajouter à types.ts

// Pour rejectContentDraft
export interface RejectDraftInput {
  reason?: string;  // Raison optionnelle du rejet
}

// Pour cancelScheduledPost
export interface CancelPostInput {
  reason?: string;
}

// Pour createDraftVariation
export interface VariationInput {
  variantLabel?: string;  // Label de la variante (défaut : "Variante N")
  promptOverride?: string;  // Prompt alternatif pour la génération
}

// Pour reschedulePost
export interface RescheduleInput {
  scheduledAt: string;  // ISO 8601
}

// Pour archiveContentIdea/Draft/Post
export interface ArchiveInput {
  reason?: string;
}

// Pour les notes d'apprentissage
export interface ContentLearningNote {
  id: string;
  postId: string;
  note: string;
  tags: string[];  // ['winner', 'loser', 'insight', ...]
  createdBy: string | null;
  createdAt: Date;
}

// Pour le brief éditeur
export interface ContentBriefUpdate {
  angle?: string;
  proof?: string;
  cta?: string;
  mediaDirection?: string;
  constraints?: Record<string, unknown>;
}

// Pour l'analytics overview
export interface AnalyticsOverview {
  totalPosts: number;
  byStatus: Record<ContentStatus, number>;
  byPlatform: Record<string, number>;
  byPillar: Record<string, number>;
  averageScore: number | null;
  recentSnapshots: ContentPerformanceSnapshot[];
  deliveryHealth: {
    sent: number;
    failed: number;
    pending: number;
    authFailed: number;
  };
}
```

---

## 4. Schémas Zod — Ajouts

```typescript
// Ajouter à schemas.ts

export const draftRejectSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const postCancelSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const postRescheduleSchema = z.object({
  scheduledAt: z.string().min(1),  // ISO 8601
});

export const draftVariationSchema = z.object({
  variantLabel: z.string().min(1).max(100).optional(),
  promptOverride: z.string().max(2000).optional(),
});

export const archiveSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const briefUpdateSchema = z.object({
  angle: z.string().max(500).optional(),
  proof: z.string().max(1000).optional(),
  cta: z.string().max(200).optional(),
  mediaDirection: z.string().max(500).optional(),
  constraints: z.record(z.unknown()).optional(),
});

export const learningNoteSchema = z.object({
  note: z.string().min(1).max(2000),
  tags: z.array(z.string()).max(5).optional(),
});

export const ideaQuerySchema = z.object({
  status: z.string().optional(),
  pillar: z.string().optional(),
  platform: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export const draftQuerySchema = z.object({
  status: z.string().optional(),
  platform: z.string().optional(),
  format: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

export const postQuerySchema = z.object({
  status: z.string().optional(),
  scheduledAfter: z.string().optional(),
  scheduledBefore: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});
```

---

## 5. Architecture Frontend — Nouveaux composants

```
src/components/admin/content-studio/
├── ContentStudioClient.tsx      (orchestrateur, ~200 lignes)
├── IdeaForm.tsx                  (existant)
├── DraftEditor.tsx              (existant, à extraire MediaPicker, VisualGenerator, DeliveryPanel)
│   ├── DraftActionButtons.tsx   (NOUVEAU — reject, variation, approve, save)
│   └── DraftReviewPanel.tsx     (NOUVEAU — brand review details + violations)
├── BriefEditor.tsx               (NOUVEAU — éditeur de brief modifiable)
├── EditorialCalendar.tsx         (existant, à enrichir)
│   ├── CalendarWeekView.tsx      (NOUVEAU — vue semaine)
│   ├── CalendarMonthView.tsx     (NOUVEAU — vue mois)
│   └── CalendarFilters.tsx      (NOUVEAU — filtres plateforme/pilier/statut)
├── PostizHealthPanel.tsx         (existant)
├── PostizPanel.tsx               (existant)
├── LearningNotes.tsx             (NOUVEAU — notes + tags sur un post)
├── UtmBuilder.tsx                (NOUVEAU — générateur UTM)
├── AnalyticsDashboard.tsx        (NOUVEAU — overview analytics)
├── RejectDialog.tsx              (NOUVEAU — modal de rejet avec raison)
├── CancelDialog.tsx              (NOUVEAU — modal d'annulation)
├── ArchiveButton.tsx             (NOUVEAU — bouton d'archivage générique)
├── SectionTitle.tsx              (existant)
├── DeliveryStatusBadge.tsx       (existant)
├── PlatformPreview.tsx           (existant)
├── Select.tsx                    (existant)
├── StudioGuide.tsx               (existant)
├── types.ts                      (existant, à enrichir)
├── helpers.ts                    (existant)
└── api.ts                        (existant, à enrichir)
```

---

## 6. Architecture Backend — Nouveaux modules

```
src/lib/content-studio/
├── state-machine.ts              (existant, pas de changement)
├── types.ts                      (existant, à enrichir)
├── schemas.ts                    (existant, à enrichir)
├── brand-rules.ts                (existant)
├── auth.ts                       (existant)
├── repository.ts                (existant, à enrichir)
├── service.ts                    (existant, à enrichir)
├── postiz.ts                     (existant)
├── automation.ts                 (existant)
├── generation.ts                 (existant)
├── image-generation.ts           (existant)
├── brief-service.ts              (NOUVEAU — logique métier brief)
├── analytics-service.ts          (NOUVEAU — agrégation analytics)
├── utm.ts                        (NOUVEAU — générateur UTM)
└── budget.ts                     (NOUVEAU — tracking budget quotidien)
```

---

## 7. Routes API — Arbre complet après P2

```
src/app/api/admin/content-studio/
├── ideas/
│   ├── route.ts                          (GET list, POST create)
│   └── [id]/
│       ├── route.ts                       (NOUVEAU — GET detail)
│       ├── generate/route.ts              (POST generate drafts)
│       └── archive/route.ts              (NOUVEAU — POST archive)
├── briefs/
│   └── [id]/route.ts                      (NOUVEAU — PATCH update brief)
├── drafts/
│   ├── route.ts                           (GET list)
│   └── [id]/
│       ├── route.ts                       (GET detail, PATCH update)
│       ├── approve/route.ts               (POST approve)
│       ├── reject/route.ts                (NOUVEAU — POST reject)
│       ├── review/route.ts                (POST brand review)
│       ├── variation/route.ts             (NOUVEAU — POST create variation)
│       ├── generate-visual/route.ts       (POST generate visual)
│       ├── archive/route.ts              (NOUVEAU — POST archive)
│       └── reviews/route.ts               (NOUVEAU — GET review history)
├── posts/
│   ├── route.ts                           (GET list)
│   └── [id]/
│       ├── route.ts                       (NOUVEAU — GET detail)
│       ├── postiz-draft/route.ts          (POST send to Postiz)
│       ├── cancel/route.ts               (NOUVEAU — POST cancel)
│       ├── reschedule/route.ts           (NOUVEAU — PATCH reschedule)
│       ├── archive/route.ts             (NOUVEAU — POST archive)
│       └── notes/
│           ├── route.ts                   (NOUVEAU — GET list, POST create)
│           └── [noteId]/route.ts         (NOUVEAU — DELETE note)
├── media/route.ts                         (GET list)
├── postiz/integrations/sync/route.ts      (POST sync)
├── automation/route.ts                     (POST run jobs)
├── analytics/
│   └── overview/route.ts                  (NOUVEAU — GET overview)
└── campaigns/
    └── route.ts                           (NOUVEAU — GET list, POST create)
```

---

## 8. Validation Zod côté client

Réutiliser les schémas Zod existants côté client via un import partagé :

```typescript
// src/lib/content-studio/schemas.ts — déjà importable côté client
// Ajouter une fonction de validation côté client :
import { contentIdeaCreateSchema, draftUpdateSchema } from '@/lib/content-studio/schemas';

// Dans IdeaForm.tsx :
const result = contentIdeaCreateSchema.safeParse({ pillar, objective, platform, format, prompt });
if (!result.success) {
  setFieldErrors(result.error.flatten().fieldErrors);
  return;
}
```

Les schémas Zod sont déjà utilisables côté client car ils n'importent que `zod` (pas de dépendance serveur).

---

## 9. UTM Builder — Logique

```typescript
// src/lib/content-studio/utm.ts

export function generateUtmUrl(params: {
  baseUrl: string;
  source: ContentPlatform;      // instagram, facebook
  medium: 'social';
  campaign: string;              // pillar ou nom de campagne
  content: string;               // format ou variant
}): string {
  const url = new URL(params.baseUrl);
  url.searchParams.set('utm_source', params.source);
  url.searchParams.set('utm_medium', 'social');
  url.searchParams.set('utm_campaign', params.campaign);
  url.searchParams.set('utm_content', params.content);
  return url.toString();
}
```

---

## 10. Budget Tracking — Architecture

```typescript
// src/lib/content-studio/budget.ts

// Utilise la colonne costCents de content_generation_run
// + variable d'env CONTENT_STUDIO_DAILY_GENERATION_BUDGET_CENTS

export async function getDailyBudgetStatus(): Promise<{
  spentCents: number;
  budgetCents: number;
  remainingCents: number;
  isOverBudget: boolean;
}> {
  const budgetCents = Number(process.env.CONTENT_STUDIO_DAILY_GENERATION_BUDGET_CENTS ?? '100');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const runs = await listGenerationRunsSince(today);
  const spentCents = runs.reduce((sum, r) => sum + (r.costCents ?? 0), 0);
  return {
    spentCents,
    budgetCents,
    remainingCents: Math.max(0, budgetCents - spentCents),
    isOverBudget: spentCents >= budgetCents,
  };
}
```