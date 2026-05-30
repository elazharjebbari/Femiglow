# Architecture Overview — Content Studio v2 Create

> **Lecture** : ce document trace la carte du module tel qu'il existe **aujourd'hui** (mai 2026).
> Pour les **manques**, voir `04-gaps-and-issues.md`. Pour le **futur cible**, voir `01-action-plan.md`.

## 1. Carte logique 3 couches

```
┌──────────────────────────────────────────────────────────────────┐
│  UI                  /admin/content-studio-v2/create             │
│  ────────────────────────────────────────────                    │
│  page.tsx (Server Component)                                     │
│   └─ AppShell                                                    │
│       └─ CreateWorkspace (Client Component)                      │
│           ├─ Stepper          (frame|generate|visual|validate)   │
│           ├─ IntentionForm    (col gauche)                       │
│           ├─ VariantsCompare  (col centre haut)                  │
│           ├─ MediaStudio      (col centre milieu)                │
│           ├─ CaptionEditor    (col centre bas)                   │
│           ├─ PreviewPane      (col droite)                       │
│           └─ PublishActionGroup (footer)                         │
│                                                                  │
│  State : StudioProvider (React Context)                          │
│   • ideas, drafts, posts, jobs, mediaItems                       │
│   • selectedDraftId                                              │
│   • useDraftAutosave (debounce 1500ms)                           │
└──────────────────────────────────────────────────────────────────┘
            │  fetch/axios                  │
            ▼                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  API   /api/admin/content-studio/*                               │
│  ────────────────────────────────────────────                    │
│  POST /ideas                          → Create idea              │
│  POST /ideas/[id]/generate            → Brief + 3 drafts         │
│  PATCH /drafts/[id]                   → Edit fields (autosave)   │
│  POST /drafts/[id]/generate-visual    → Image (DALL-E or SVG)    │
│  POST /drafts/[id]/review             → Brand rule check         │
│  POST /drafts/[id]/approve            → Create post              │
│  POST /drafts/[id]/reject             → Reject variant           │
│  POST /posts/[id]/publish-now         → Immediate publish        │
│  POST /posts/[id]/schedule            → Scheduled publish        │
│  POST /posts/[id]/draft-on-provider   → Provider-side draft      │
│  GET  /generation-runs                → List runs + budget       │
│  GET  /media                          → Media library            │
└──────────────────────────────────────────────────────────────────┘
            │  Drizzle ORM                  │
            ▼                               ▼
┌──────────────────────────────────────────────────────────────────┐
│  DB                                                              │
│  ────────────────────────────────────────────                    │
│  content_idea ──► content_brief ──► content_draft                │
│        │                                  │                      │
│        │                                  ├─► content_brand_review│
│        │                                  ├─► content_asset_binding│
│        │                                  │   └─► media          │
│        │                                  ├─► content_post       │
│        │                                  │   └─► content_postiz_delivery│
│        │                                  └─► content_generation_run│
│        ▼                                                         │
│  content_campaign                                                │
└──────────────────────────────────────────────────────────────────┘
```

## 2. Flux runtime — parcours nominal

```
User                  UI                   API                   DB
 │                    │                     │                     │
 │ remplit IntentionF │                     │                     │
 │ click "Enregistrer"│                     │                     │
 ├───────────────────►│                     │                     │
 │                    │ POST /ideas         │                     │
 │                    ├────────────────────►│                     │
 │                    │                     │ INSERT idea         │
 │                    │                     ├────────────────────►│
 │                    │ {idea}              │                     │
 │                    │◄────────────────────┤                     │
 │                    │                     │                     │
 │                    │ POST /ideas/:id/    │                     │
 │                    │      generate       │                     │
 │                    ├────────────────────►│                     │
 │                    │                     │ generateForIdea()   │
 │                    │                     │   (OpenAI gpt-4o-mini│
 │                    │                     │    or fallback)     │
 │                    │                     │ INSERT brief        │
 │                    │                     │ INSERT 3 drafts     │
 │                    │                     │ INSERT generation_run│
 │                    │                     ├────────────────────►│
 │                    │ {idea, brief, drafts}                     │
 │                    │◄────────────────────┤                     │
 │                    │                     │                     │
 │                    │ render Variants     │                     │
 │ click variant      │                     │                     │
 ├───────────────────►│                     │                     │
 │                    │ selectDraft(...)    │                     │
 │                    │ (local state only)  │                     │
 │                    │                     │                     │
 │ edit caption       │                     │                     │
 ├───────────────────►│                     │                     │
 │                    │ useDraftAutosave    │                     │
 │                    │  PATCH /drafts/:id  │                     │
 │                    ├────────────────────►│                     │
 │                    │                     │ UPDATE caption      │
 │                    │                     │ (re-brand-review)   │
 │                    │                     ├────────────────────►│
 │                    │◄────────────────────┤                     │
 │                    │                     │                     │
 │ click "Générer un  │                     │                     │
 │  visuel IA"        │                     │                     │
 ├───────────────────►│                     │                     │
 │                    │ POST /drafts/:id/   │                     │
 │                    │  generate-visual    │                     │
 │                    ├────────────────────►│                     │
 │                    │                     │ generateStudioImage │
 │                    │                     │  (SVG mock or DALL-E)│
 │                    │                     │ INSERT media        │
 │                    │                     │ INSERT asset_binding│
 │                    │                     │ INSERT generation_run│
 │                    │                     ├────────────────────►│
 │                    │ {media}             │                     │
 │                    │◄────────────────────┤                     │
 │                    │ (UI binds locally)  │                     │
 │                    │                     │                     │
 │ ⚠ pas d'action UI  │                     │                     │
 │   pour approve     │                     │                     │
 │   → postId jamais  │                     │                     │
 │   créé             │                     │                     │
 │                    │                     │                     │
 │ click Publier      │                     │                     │
 │ (disabled)         │                     │                     │
 │ ❌                 │                     │                     │
```

**Bug critique** : le parcours utilisateur ne contient aucun déclencheur d'approbation explicite. Le bouton Publier reste donc disabled à vie en l'état.

## 3. Composants React — hiérarchie + rôles

| Composant | Fichier | Rôle |
|-----------|---------|------|
| `page.tsx` | `app/admin/content-studio-v2/create/page.tsx` | Server entry, auth gate, layout AppShell |
| `CreateWorkspace` | `components/admin/content-studio-v2/create/CreateWorkspace.tsx` | Orchestrateur, monte Provider, fetch initial |
| `Stepper` | `…/create/Stepper.tsx` | 4 étapes : frame/generate/visual/validate. Dérive l'étape active depuis `draft.status` |
| `IntentionForm` | `…/create/IntentionForm.tsx` | Form pilier/objectif/plateforme/format/prompt → POST /ideas |
| `VariantsCompare` | `…/create/VariantsCompare.tsx` | 3 cartes variantes, sélection, rejet, toggle diff |
| `MediaStudio` | `…/create/MediaStudio.tsx` | Picker média + bouton Générer visuel IA (image only) |
| `CaptionEditor` | `…/create/CaptionEditor.tsx` | Édition caption/hook/cta/hashtags + autosave |
| `PreviewPane` | `…/create/PreviewPane.tsx` | Aperçu plateforme/format avec media + caption |
| `PublishActionGroup` | `…/create/PublishActionGroup.tsx` | Footer dropdown 3 modes (now/schedule/draft) |
| `StudioProvider` | `lib/content-studio-v2/state/StudioContext.tsx` | Context global : ideas/drafts/posts/media |
| `useDraftAutosave` | idem | Debounce 1500ms, PATCH /drafts/:id |

## 4. État `StudioContext`

```ts
interface StudioState {
  ideas: ContentIdea[];
  drafts: ContentDraft[];
  posts: ContentPost[];
  jobs: SocialPublishJob[];
  mediaItems: StudioV2MediaItem[];
  selectedDraftId: string | null;
  loading: boolean;
  error: string | null;
}

interface StudioActions {
  selectDraft(id: string | null): void;
  upsertDraft(d: ContentDraft): void;
  upsertPost(p: ContentPost): void;
  upsertMedia(m: StudioV2MediaItem): void;
  reload(): Promise<void>;
}
```

Autosave :

```ts
useDraftAutosave({ draftId, getPatch, debounceMs: 1500 })
  → returns { status, isDirty, lastSavedAt, error, flush, patch }
```

## 5. API — surface concernée par /create

Voir `data-contracts/api-endpoint-catalog.yaml` pour le contrat complet.

| Méthode | Path | Schéma req | Schéma réponse |
|---------|------|------------|----------------|
| POST | `/api/admin/content-studio/ideas` | `contentIdeaCreateSchema` | `{ idea }` |
| POST | `/api/admin/content-studio/ideas/[id]/generate` | `{}` | `{ idea, brief, drafts }` |
| PATCH | `/api/admin/content-studio/drafts/[id]` | `draftUpdateSchema` | `{ draft }` |
| POST | `/api/admin/content-studio/drafts/[id]/generate-visual` | `visualGenerationSchema` | `{ media }` |
| POST | `/api/admin/content-studio/drafts/[id]/review` | `{}` | `{ review }` |
| POST | `/api/admin/content-studio/drafts/[id]/approve` | `{}` | `{ post }` |
| POST | `/api/admin/content-studio/drafts/[id]/reject` | `{ reason? }` | `{ draft }` |
| POST | `/api/admin/content-studio/posts/[id]/publish-now` | `{ accountId?, idempotencyKey? }` | `{ status, jobs }` |
| POST | `/api/admin/content-studio/posts/[id]/schedule` | `{ scheduledAt, accountId? }` | `{ status, jobs }` |
| POST | `/api/admin/content-studio/posts/[id]/draft-on-provider` | `{ accountId? }` | `{ status, jobs }` |
| GET | `/api/admin/content-studio/generation-runs` | — | `{ runs, budget }` |
| GET | `/api/admin/content-studio/media` | — | `{ items }` |

## 6. Schéma DB — tables clés

Voir `architecture/data-model.md`. Relations principales :

```
content_idea
  └── content_brief (1..n)
        └── content_draft (1..n)
              ├── content_brand_review (1..n)
              ├── content_asset_binding (1..n) → media
              ├── content_post (0..1)
              │     └── content_postiz_delivery (1..n)
              └── content_generation_run (1..n)
```

## 7. Variables d'environnement

| Variable | Rôle | Défaut |
|----------|------|--------|
| `CONTENT_STUDIO_ENABLED` | Active le module | true |
| `CONTENT_STUDIO_TEXT_MODEL` | Modèle texte | `gpt-4o-mini` |
| `CONTENT_STUDIO_IMAGE_MODEL` | Modèle image | `gpt-image-1-mini` |
| `CONTENT_STUDIO_IMAGE_PROVIDER` | `mock` ou `openai` | `mock` (staging) |
| `CONTENT_STUDIO_OPENAI_API_KEY` | API key (fallback `CHAT_OPENAI_API_KEY`) | undefined |
| `CONTENT_STUDIO_DAILY_GENERATION_BUDGET_CENTS` | Budget quotidien | `100` |
| **À AJOUTER** `CONTENT_STUDIO_V2_MOCK_MODE` | Mock global texte+image+video | false |
| **À AJOUTER** `CONTENT_STUDIO_VIDEO_PROVIDER` | `mock` ou provider | `mock` |
| **À AJOUTER** `CONTENT_STUDIO_VIDEO_MODEL` | Modèle vidéo | `mock-video-1.0` |

## 8. Modes existants

### Mock mode actuel (image only)
Activé via `CONTENT_STUDIO_IMAGE_PROVIDER=mock`. Le service `generateStudioImage` retourne un SVG gradient FemiGlow encodé en PNG via sharp. Cost = 0.

### Fallback text
Si pas d'API key OpenAI, `generateForIdea` retourne un brief + 3 drafts depuis un template (provider='fallback', cost=0).

### Pas de mock vidéo
Aucun chemin code ne sert de vidéo aujourd'hui — le format `reel` repose sur un upload utilisateur ou un visuel image. C'est un trou majeur.

## 9. Surface de tests existante

Voir `test-battery/05-coverage-targets.md` et l'audit dans `04-gaps-and-issues.md`. Synthèse :

| Surface | Tests existants | Couverture estimée |
|---------|-----------------|--------------------|
| Composants `/create` | 67 tests sur 8 fichiers | ~70% |
| Services `lib/content-studio` | partielle | ~60% |
| Contracts API | partielle (handlers MSW) | ~50% |
| Playwright E2E v2 | **0 spec** | **0%** |

Le trou E2E est le plus critique : la régression nominale du parcours n'est pas couverte.

## 10. Limites de l'architecture actuelle

1. **Couplage env-driven** : pas de sélection de modèle utilisateur → coût/qualité non pilotables
2. **Pas de versioning autosave** : seul `updated_at` est tracé, pas d'historique
3. **Pas de mock video** : `format=reel` non testable bout en bout
4. **Step lock implicite** : `draft.status` ne progresse pas tant que `approve` n'est pas explicitement appelé
5. **Pas de feedback budget** : `content_generation_run.costCents` est loggé mais pas surfacé en UI hors `budget` côté MediaStudio
6. **Provider vidéo absent** : tout flux `reel` requiert un upload manuel
