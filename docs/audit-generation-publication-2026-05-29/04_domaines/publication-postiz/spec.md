## Domaine Publication Postiz — Fonctionnement OPTIMAL attendu

### 1. Vue d'ensemble
Le domaine publie un `content_post` approuvé (issu d'un `content_draft` + média) vers un réseau social (Instagram/Facebook) via un **pattern adapter** sélectionné par `SOCIAL_PUBLISHING_MODE`:
- `dry_run` (défaut, sécurité staging): simule, ne poste rien, permalien factice.
- `live`: publie réellement via **Postiz** (`POSTIZ_BASE_URL` + `POSTIZ_API_KEY`).

Trois intents de publication, tous via le même lifecycle `social_publish_job`:
- **now** (`/publish-now`) — publie immédiatement.
- **schedule** (`/schedule`) — file d'attente, exécutée à échéance par un worker cron.
- **draft** (`/draft-on-provider`) — dépose un brouillon dans la file de revue du provider (Postiz draft) SANS publier; `content_post.status` reste inchangé.

### 2. Sélection du compte (resolveDefaultAccount)
- En dry_run: préfère le compte simulé, sinon premier actif compatible.
- En live: synchronise les comptes Postiz si absents, puis utilise `SOCIAL_PUBLISHING_DEFAULT_ACCOUNT_ID` épinglé (id interne OU remoteId), sinon **doit exiger une sélection explicite** s'il y a plusieurs comptes (pour éviter de publier sur le mauvais compte client). Ne retombe JAMAIS sur dry_run en live.

### 3. Garde de publiabilité (getPostPublishability)
Refuse si: post non approved/scheduled; draft non approved; review bloquée; format non supporté par les capabilities du compte; média requis manquant/non prêt/non public HTTPS; légende > maxCaptionLength; média non servi en HTTPS. Renvoie warnings (>25 hashtags).

### 4. Lifecycle du job (état-machine)
`draft -> approved -> queued -> publishing -> published|failed`; `failed -> queued (retry) | cancelled`; `published`/`cancelled` terminaux. Idempotence par `idempotencyKey` (`content-studio:<postId>:<accountId>:<suffix>`); un job déjà publié est réutilisé. Lock optimiste (`tryAcquirePublishJobLock`) empêche la double exécution concurrente. Retry adapter (3 tentatives) sur erreurs retryables (rate_limited, unavailable).

### 5. Adapter Postiz (live)
- Upload média: `POST /api/public/v1/upload` (multipart, fichier récupéré depuis l'URL HTTPS publique), 3 retries sur statuts transitoires.
- Création post: `POST /api/public/v1/posts` avec payload `{ type: 'now'|'schedule'|'draft', date, tags, posts:[{ integration:{id}, value:[{content,image:[{id,path}]}], settings:{__type:platform, post_type} }] }`.
- Auth: header `authorization: <clé brute>` (PAS Bearer).
- Extraction `remoteId` (recherche récursive id/postId/...) + `permalink` (releaseURL/permalink/url).
- Analytics: `GET /api/public/v1/analytics/post/<id>`.

### 6. Brouillon (draft)
`publishMode=draft` => `type=draft` côté Postiz, `scheduledAt=null`. La publication enregistrée a un permalien /draft/; `content_post.status` n'est PAS basculé en published (l'opérateur publiera manuellement depuis Postiz ou via /publish-now ensuite). Audit `social.draft_created` émis.

### 7. Programmation (schedule) — exécution worker
`/schedule` crée un job `queued` + `scheduledAt` futur, et passe `content_post` en `scheduled`. **Un cron (toutes les minutes) doit appeler `runScheduledPublishJobs`** qui récupère les jobs `queued` dont `scheduledAt <= now` et non lockés, et les exécute (executeJob). Annuler/reprogrammer un post **doit** annuler/mettre à jour le job queued associé (cohérence content_post <-> social_publish_job).

### 8. Échecs & alertes
Échec non-draft => `content_post.status=failed`, alerte webhook (sauf draft), log structuré. Échec draft => reste au dashboard, pas d'alerte, retryable depuis l'UI.

### 9. Sécurité
- dry_run par défaut. Bascule live explicite et auditée.
- Comptes Postiz = vrais comptes clients IG: jamais publier par accident (sélection de compte explicite, garde de mode).
- Routes admin protégées (`requireAdminApi` -> 401 sinon); cron protégé par `CRON_SECRET`.