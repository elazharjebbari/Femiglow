# Overview — Carte du système Social Publishing

> Cette carte fixe le vocabulaire et les frontières du système avant tout test.

## 1. Vue d'ensemble

```
┌────────────────────────────────────────────────────────────────────┐
│  UI                                                                │
│  ─────────────────────────────────────────────────────             │
│  /admin/content-studio-v2/create     →  PublishActionGroup         │
│  /admin/content-studio-v2/plan       →  Calendar, JobQueue,        │
│                                          QuickEditDrawer           │
│  /admin/content-studio-v2/library    →  LibraryClient (badges)     │
│  /admin/content-studio-v2/home       →  AccountHealthCard          │
└────────────────────────────────────────────────────────────────────┘
            │ fetch                              │
            ▼                                    ▼
┌────────────────────────────────────────────────────────────────────┐
│  API   /api/admin/content-studio/                                  │
│  ─────────────────────────────────────────────────────             │
│  POST  /posts/:id/publish-now                                      │
│  POST  /posts/:id/schedule                                         │
│  POST  /posts/:id/draft-on-provider                                │
│  POST  /posts/:id/cancel                                           │
│  PATCH /posts/:id/reschedule                                       │
│  GET   /publish-jobs                                               │
│  POST  /publish-jobs/:id/retry                                     │
│  POST  /publish-jobs/:id/cancel                                    │
│  POST  /postiz/integrations/sync                                   │
└────────────────────────────────────────────────────────────────────┘
            │ business services                  │
            ▼                                    ▼
┌────────────────────────────────────────────────────────────────────┐
│  Service Layer  /lib/social-publishing/                            │
│  ─────────────────────────────────────────────────────             │
│  admin-service.ts     publishContentPostNow,                       │
│                       scheduleContentPost,                         │
│                       sendContentPostToDraft,                      │
│                       executeJob, retryPublishJob,                 │
│                       cancelPublishJob, getPostPublishability      │
│  service.ts           publishWithAdapter (retry wrapper)           │
│  state-machine.ts     status transitions                           │
│  retry.ts             exponential backoff                          │
│  errors.ts            HTTP → code mapping                          │
│  repository.ts        Drizzle CRUD (jobs/attempts/events)          │
│  worker.ts            cron: runScheduledPublishJobs                │
│  alerts.ts            Slack webhook on failure                     │
│  adapters/postiz.ts   real provider                                │
│  adapters/dry-run.ts  mock provider                                │
└────────────────────────────────────────────────────────────────────┘
            │ HTTPS                              │ in-memory
            ▼                                    ▼
┌──────────────────────────────────┐   ┌──────────────────────────┐
│  Postiz API (SaaS)               │   │  Dry-Run (synthetic)     │
│  ────────────────────────────    │   │  ──────────────────────  │
│  POST /upload                    │   │  Deterministic IDs       │
│  POST /posts (now/schedule/draft)│   │  Failure simulation      │
│  GET  /posts/:id                 │   │  (via metadata flag)     │
│  GET  /integrations              │   └──────────────────────────┘
│  GET  /analytics/post/:id?date=7 │
└──────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────┐
│  Instagram / Facebook            │
│  (final visible posts)           │
└──────────────────────────────────┘
```

## 2. Composants UI — rôles précis

| Composant | Fichier | Responsabilité |
|-----------|---------|----------------|
| **PublishActionGroup** | `create/PublishActionGroup.tsx` | Dropdown 3 modes (now/schedule/draft) + dialogs avec G12 preview (thumbnail+caption+platform/format) + presets schedule + mock badge inline + error toasts mappés |
| **JobQueue** | `plan/JobQueue.tsx` | Liste jobs récents (7j), polling 30s, retry/cancel inline, badges status, lastError affiché |
| **QuickEditDrawer** | `plan/QuickEditDrawer.tsx` | Reschedule via input datetime, cancel scheduled, validation date min |
| **Calendar** | `plan/Calendar.tsx` | Vues week/month/list, filtres status/platform/pillar, drag-drop reschedule, URL state |
| **CalendarCard** | `plan/CalendarCard.tsx` | Carte d'un post sur le calendrier — badge status, pillar dot, thumbnail média |
| **AccountHealthCard** | `home/AccountHealthCard.tsx` | Tableau de bord home : compte connectés, dernière publication, dernière erreur |
| **LibraryClient** | `library/LibraryClient.tsx` | Liste filtrable des drafts + posts, badges status (approved/scheduled/published/failed) |
| **MockModeBadge** | `create/MockModeBadge.tsx` | Indicateur "Mode mock" inline (cf audit precedent) |

## 3. Endpoints API détaillés

### POST /api/admin/content-studio/posts/:id/publish-now
**Body** : `{ accountId?, idempotencyKey? }`
**Réponse 201** : `{ status: 'queued'|'published', jobs: [{ id, postId, provider, status, ... }] }`
**Effets** :
1. Idempotency check → return existing job if key already used
2. Publishability check (post status, draft approved, brand pass, media OK, caption length)
3. Job INSERT (status='queued', mode='now')
4. executeJob → lock acquire → publishWithAdapter (Postiz ou dry-run) → status='published'

### POST /api/admin/content-studio/posts/:id/schedule
**Body** : `{ scheduledAt: ISO8601, accountId?, idempotencyKey? }`
**Réponse 201** : `{ status: 'scheduled', jobs: [...] }`
**Effets** : INSERT job (queued, scheduledAt future). Worker cron picks it up later.
**Validations** : scheduledAt ≥ now + 60s, dans le futur.

### POST /api/admin/content-studio/posts/:id/draft-on-provider
**Body** : `{ accountId?, idempotencyKey? }`
**Réponse 201** : `{ status: 'approved' (unchanged), jobs: [{ ... publishMode: 'draft' }] }`
**Effets** : INSERT job (queued, mode='draft') → executeJob → Postiz reçoit `type='draft'` (post atterrit dans le draft shelf Postiz, pas publié).

### POST /api/admin/content-studio/posts/:id/cancel
**Body** : `{ reason?: string }`
**Réponse 200** : `{ post: { id, status: 'cancelled', ... } }`
**Effets** : Cancel scheduled or queued job → post.status='cancelled'.

### PATCH /api/admin/content-studio/posts/:id/reschedule
**Body** : `{ scheduledAt: ISO8601 }`
**Effets** : Update post.scheduledAt + job.scheduledAt si still queued.

### GET /api/admin/content-studio/publish-jobs
**Query** : `?status=&accountId=&limit=`
**Réponse 200** : `{ jobs: [...], pagination }`

### POST /api/admin/content-studio/publish-jobs/:id/retry
**Effets** : Reset job.status='queued', clear lockedAt, executeJob.

### POST /api/admin/content-studio/publish-jobs/:id/cancel
**Effets** : Set job.status='cancelled', release lock.

### POST /api/admin/content-studio/postiz/integrations/sync
**Effets** : Fetch GET Postiz /integrations → upsert dans social_account.

## 4. Modèle de données

```
social_account (id, provider, platform, remoteId, name, status, capabilities, metadata)
  status ∈ {active, disabled, token_expired, permission_missing}

social_credential (id, accountId FK, secretRef, expiresAt, scopes)

social_publish_job (id, postId FK, accountId FK, provider, platform, format,
                    status, idempotencyKey UNIQUE, content jsonb,
                    scheduledAt, publishedAt, lockedAt, attemptCount, lastError jsonb,
                    requestedBy, createdAt, updatedAt)
  status ∈ {draft, approved, queued, publishing, published, failed, cancelled}

social_publish_attempt (id, jobId FK, attemptNumber, startedAt, finishedAt,
                        status, errorCode, errorMessage)

social_publish_publication (id, jobId FK, accountId FK, remoteId, permalink,
                            publishedAt, metricsSnapshot jsonb)

social_publish_event (id, jobId FK, type, payload jsonb, createdAt)
```

## 5. State machine job

```
       ┌─────┐
       │draft│  ← unused in publish flow (legacy)
       └──┬──┘
          │ approve
          ▼
       ┌──────┐
       │queued│ ← Initial state for now/schedule/draft modes
       └──┬───┘
          │ lock acquired
          ▼
      ┌─────────┐
      │publishing│
      └──┬───────┘
   succeeded│ │ failed (with retry or terminal)
            ▼ ▼
       ┌──────┐ ┌──────┐
       │published│ │failed│
       └────────┘ └─┬────┘
                   │ retryPublishJob
                   ▼
                 (back to queued)

       cancel from any non-terminal → cancelled (terminal)
```

## 6. Provider matrix

| Provider | Status | Supports | Note |
|----------|--------|----------|------|
| **postiz** | active | now, schedule, draft | Instagram, Facebook (+ futurs réseaux via Postiz) |
| **dry_run** | active | now, schedule, draft | Tests + staging ; pas de post réel |
| **meta_graph** | inactive | — | Adapter pas encore implémenté (backlog) |

## 7. Variables d'environnement clés

| Var | Rôle |
|-----|------|
| `POSTIZ_BASE_URL` | Endpoint Postiz API |
| `POSTIZ_API_KEY` | Bearer auth header |
| `CONTENT_STUDIO_LEGACY_POSTIZ_DISABLED` | Si true, désactive l'ancienne route postiz-draft |
| `CONTENT_STUDIO_V2_MOCK_MODE` | Active le mock global (texte/image/vidéo/publish) |
| `CRON_SECRET` | Auth des routes cron |
| `SOCIAL_ALERTS_WEBHOOK_URL` | Slack webhook pour alertes failure |
| `E2E_LIVE_POSTIZ` | **GATE STRICT** : si 1, le live test peut tourner |
| `E2E_LIVE_ACCOUNT_ID` | Postiz integration ID du compte AlFenna |
| `E2E_LIVE_INSTAGRAM_HANDLE` | `alfenna_beauty` |
| `E2E_LIVE_CLEANUP` | Si 1, supprime le post test après vérif |

## 8. Cron jobs

| Cron | Fréquence | Rôle |
|------|-----------|------|
| `/api/cron/content-studio/social-publish-scheduler` | every 5min | Pick jobs queued + scheduledAt due, executeJob |
| `/api/cron/content-studio/postiz-sync` | hourly | Sync Postiz integrations → social_account |
| `/api/cron/content-studio/social-failure-digest` | weekly Monday 9h | Email digest des failures 7j |

## 9. Sécurité / autorisation

- Toutes les routes admin nécessitent une session admin (`requireAdminApi`)
- `CONTENT_STUDIO_ENABLED=true` requis (feature flag)
- Postiz API key jamais exposée au client (server-only)
- Idempotency key UNIQUE constraint au niveau DB → pas de double publish même race condition

## 10. Limites & non-objectifs

- **Pas de Meta Graph direct** : tout passe par Postiz (adapter meta_graph est inactive)
- **Pas de webhook entrant** : Postiz ne notifie pas FemiGlow ; on poll les analytics
- **Pas de retry exhaustif** : 3 attempts max, après quoi le job reste `failed` jusqu'à retry manuel
- **Pas d'auto-republish** : si un post est cancelled, opérateur doit recréer un job

Voir aussi : `architecture/job-state-machine.puml`, `architecture/publish-flow.puml`.
