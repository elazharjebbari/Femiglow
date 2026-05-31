# Runbook — Phase B social-publishing (post `2742d2f`)

Date : 2026-05-20
Environnement : staging `/var/www/femiglow-staging` uniquement
Plan parent : `docs/ai-content-service/plan-action-suite-publication-directe-2026-05-20.md` (section 5)

## Objectif de la Phase B

Activer le pipeline `social-publishing` :
- Dispatcher d'adapter provider-aware dans `executeJob` (dry_run + postiz).
- Lock optimiste pour éviter les doubles exécutions concurrentes.
- Worker de scheduling qui pick les jobs `queued` avec `scheduled_at <= now()`.
- Route cron HTTP authentifiée pour déclencher le worker.

## Préconditions

- `git status` propre (commit `2742d2f` appliqué).
- Vars d'env présentes : `CRON_SECRET`, `POSTIZ_BASE_URL`, `POSTIZ_API_KEY`, `NEXT_PUBLIC_SITE_URL`.
- Service `femiglow-staging.service` opérationnel sur port 8012.

## Étape B.1 — Lock optimiste + `listScheduledJobsDue`

### B.1.1 — Ajouter `tryAcquirePublishJobLock` au repository

Fichier : `apps/web/src/lib/social-publishing/repository.ts`

Spécification :
- Signature : `tryAcquirePublishJobLock(input: { jobId: string; allowedFromStatuses: SocialPublishJobStatus[] }): Promise<SocialPublishJob | null>`
- En mode DB Drizzle : `UPDATE social_publish_job SET status='publishing', locked_at=now(), updated_at=now() WHERE id=$1 AND status IN (...) AND locked_at IS NULL RETURNING *`. Si 0 row retournée → `null`. Sinon retourner le job mis à jour.
- En mode mémoire : lire le job, vérifier `status ∈ allowedFromStatuses` et `lockedAt === null`. Si OK, écrire l'update (status='publishing', lockedAt=now()) atomiquement (JS single-threaded). Sinon retourner `null`.
- Émettre un `recordPublishEvent` type `job.publishing` uniquement en cas de succès.

### B.1.2 — Ajouter `listScheduledJobsDue` au repository

Spécification :
- Signature : `listScheduledJobsDue(input: { now: Date; limit: number }): Promise<SocialPublishJob[]>`
- En mode DB Drizzle : `SELECT * FROM social_publish_job WHERE status='queued' AND scheduled_at IS NOT NULL AND scheduled_at <= $1 AND locked_at IS NULL ORDER BY scheduled_at ASC LIMIT $2`.
- En mode mémoire : filtre équivalent + tri par `scheduledAt` ASC + slice limit.

### B.1.3 — Tests vitest

Fichier : `apps/web/src/lib/social-publishing/repository.test.ts`

Cas à couvrir :
- `tryAcquirePublishJobLock` réussit pour un job `queued` non locké → status passe à `publishing`, `lockedAt` non null.
- `tryAcquirePublishJobLock` réussit pour un job `failed` non locké (retry path).
- `tryAcquirePublishJobLock` retourne `null` pour un job déjà `publishing`.
- `tryAcquirePublishJobLock` retourne `null` pour un job avec `lockedAt` non null.
- `tryAcquirePublishJobLock` est idempotent : deux appels concurrents → un seul acquiert (simulation via deux appels séquentiels après le premier réussi).
- `listScheduledJobsDue` retourne les jobs `queued` avec `scheduled_at <= now`.
- `listScheduledJobsDue` ignore les jobs sans `scheduledAt` (publish-now).
- `listScheduledJobsDue` ignore les jobs déjà lockés.
- `listScheduledJobsDue` respecte la limite et l'ordre ascendant par `scheduled_at`.

## Étape B.2 — Dispatcher provider-aware

### B.2.1 — Refactor `admin-service.ts`

Fichier : `apps/web/src/lib/social-publishing/admin-service.ts`

Modifications :
- Remplacer la constante `dryRunAdapter` par une map `adapters: Record<SocialProviderId, SocialPublishingAdapter | null>` avec `dry_run`, `postiz` câblés et `meta_graph: null`.
- Ajouter une fonction `adapterFor(provider): SocialPublishingAdapter` qui retourne l'adapter ou throw `HttpError('not_implemented', ...)` si absent.
- Renommer `executeDryRunJob` → `executeJob`. Sa logique change :
  - Au lieu de `assertSocialPublishJobTransition(status → 'publishing')` puis `updatePublishJobStatus(publishing)`, appeler `tryAcquirePublishJobLock({ jobId, allowedFromStatuses: ['queued', 'failed'] })`.
  - Si le lock retourne `null` :
    - Si le job courant est `published`, retourner le résultat existant via la même logique que `resultForExistingJob`.
    - Sinon retourner un échec normalisé `{ ok: false, error: { code: 'invalid_request', message: 'Job not available for execution', retryable: false } }` sans modifier la DB.
  - Récupérer le compte via `getSocialAccount(job.accountId)`.
  - Appeler `adapterFor(account.provider)` au lieu de `dryRunAdapter`.
  - Le reste de la logique (`recordPublishAttempt`, `createPublication`, `updatePostPlanning`, `updatePublishJobStatus`) reste identique.

### B.2.2 — Capabilities exposed par compte

Adapter `getPostPublishability` pour utiliser l'adapter du provider du compte au lieu de hardcoder `dryRunAdapter.listCapabilities(account)`.

### B.2.3 — Tests vitest

Étendre `apps/web/src/lib/social-publishing/admin-service.test.ts` (créer si absent) :
- Dispatcher dispatch vers `dryRunAdapter` quand compte `provider='dry_run'`.
- Dispatcher dispatch vers `postizAdapter` quand compte `provider='postiz'` (mocké).
- Dispatcher throw `not_implemented` pour `meta_graph`.
- `executeJob` skip un job déjà locké (retourne failure normalisée, ne modifie pas).

## Étape B.3 — Worker + route cron

### B.3.1 — Créer `lib/social-publishing/worker.ts`

Spécification :
- Fonction exportée `runScheduledPublishJobs(input?: { now?: Date; limit?: number }): Promise<{ checked: number; executed: number; skipped: number; failed: number; tookMs: number; errors: Array<{ jobId: string; message: string }> }>`.
- Borne sur `limit` (défaut 5, max 20).
- `const due = await listScheduledJobsDue({ now, limit })`.
- Pour chaque job : `await executeJob({ jobId: job.id, actorId: job.requestedBy })` ; capturer succès/échec/skip ; ne pas throw entre jobs.
- Mesurer `tookMs`.

### B.3.2 — Créer la route cron

Fichier : `apps/web/src/app/api/cron/content-studio/social-publish-scheduler/route.ts`

Pattern identique à `postiz-sync/route.ts` :
- `export const runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, `maxDuration = 60`.
- `POST(request)` : `authorizeCron(request)` (Bearer `CRON_SECRET`).
- Lecture optionnelle de `limit` depuis le body JSON.
- Appel `runScheduledPublishJobs({ limit })`.
- Retour JSON du résumé.

### B.3.3 — Tests vitest

Fichier : `apps/web/src/lib/social-publishing/worker.test.ts`

Cas couverts :
- `runScheduledPublishJobs` exécute les jobs `queued` avec `scheduled_at <= now`.
- Ignore les jobs sans `scheduled_at`.
- Ignore les jobs `lockedAt != null` (déjà pickés).
- Respecte la limite (1, 3, 5).
- Capture les erreurs par job sans bloquer les autres.

Fichier : `apps/web/src/app/api/cron/content-studio/social-publish-scheduler/route.test.ts`

Cas couverts :
- Bearer manquant → 401.
- Bearer correct → 200 et JSON résumé.
- Pas de jobs dus → `executed: 0, checked: 0`.

## Étape B.4 — Validation et commit

### B.4.1 — Vitest élargi

```bash
pnpm --dir apps/web exec vitest run \
  src/lib/content-studio/ \
  src/lib/social-publishing/ \
  src/components/admin/content-studio/SocialPublishingPanel.test.tsx \
  src/test/msw/content-studio-handlers.test.ts \
  src/test/msw/social-publishing-handlers.test.ts \
  src/app/api/admin/content-studio/posts/ \
  src/app/api/cron/content-studio/social-publish-scheduler/
```

### B.4.2 — Typecheck + build

```bash
pnpm --dir apps/web typecheck
pnpm --dir apps/web build
```

### B.4.3 — Restart + smoke

```bash
chmod -R a+rwX apps/web/.next
chown -R nodeapp:nodeapp apps/web/.next
systemctl restart femiglow-staging.service
sleep 3
systemctl status femiglow-staging.service --no-pager | head -10
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:8012/admin/content-studio
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:8012/api/admin/social/accounts
# Smoke cron (sans secret) doit renvoyer 401
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST http://127.0.0.1:8012/api/cron/content-studio/social-publish-scheduler
```

### B.4.4 — Playwright

```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 \
  ADMIN_TEST_EMAIL=admin@femiglow.local \
  ADMIN_TEST_PASSWORD='TeXdExs2hdYVaB+dltbUnjmU' \
  npx playwright test e2e/content-studio-social-publishing.spec.ts --project=chromium --reporter=line
```

### B.4.5 — Commit

Message structuré (voir runbook A pour le format). Inclure :
- Backend : worker, dispatcher, lock optimiste, route cron.
- Tests : repository (lock + listScheduledJobsDue), worker, route cron, admin-service dispatcher.
- Docs : ce runbook.

## Diagnostic incident

- `tryAcquirePublishJobLock` retourne `null` inopinément : vérifier que le job n'est pas `publishing` ou `published` déjà ; vérifier `lockedAt`.
- `listScheduledJobsDue` ne retourne rien : vérifier `scheduled_at` non null et ≤ now ; vérifier que `status='queued'`.
- Worker ne dispatch pas le bon adapter : vérifier la map `adapters` ; vérifier que le `provider` du compte est correct.
- Route cron 401 avec secret correct : vérifier que `CRON_SECRET` est chargé par le runtime Node.

## Hors scope Phase B

- Adapter `meta_graph` réel.
- Chiffrement credentials.
- UI de monitoring du worker (à faire en Phase C ou ailleurs).
- Backfill des `content_postiz_delivery` vers `social_publish_job`.
