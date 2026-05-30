# Runbook — Social Publishing Test Battery

> **Objectif** : exécuter pas-à-pas la batterie complète. Chaque étape a un critère de sortie clair et une commande à copier-coller.
>
> **Pré-requis** : avoir lu `01-action-plan.md`, `02-overview.md`, `03-test-strategy.md`.
>
> **Durée estimée** : 6 à 10 sessions de 2-3h.

---

## P0 — Pré-flight (15 min)

```bash
cd /var/www/femiglow-staging/apps/web

# 1. Versions
node -v          # >= 18
pnpm -v          # >= 9
npx playwright --version  # 1.59+

# 2. DB up
PGPASSWORD=$DB_PASSWORD psql -h 127.0.0.1 -U femiglow -d staging_femiglow -c "\dt social_*"
# attendu : social_account, social_credential, social_publish_job,
#           social_publish_attempt, social_publish_publication, social_publish_event

# 3. Baseline
git checkout -b feat/social-pub-test-battery
pnpm vitest run src/lib/social-publishing src/components/admin/content-studio-v2/create/PublishActionGroup.test.tsx \
  --reporter=verbose 2>&1 | tee /tmp/sp-baseline.log
pnpm run build 2>&1 | tee /tmp/sp-baseline-build.log

# 4. Web server
pm2 status web
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8012/
# attendu : 200
```

**Critère de sortie P0** : baseline sans fail rouge ; build OK ; serveur up.

---

## Phase 1 — Foundations (1 j-p)

Ref : `implementation/phase-1-foundations.md`

### 1.1 Catalogue MSW handlers
```bash
# Créer le fichier source de vérité MSW publish
# apps/web/src/test/msw/social-publishing-handlers.ts (déjà partiellement existant)
# - GET  /api/admin/content-studio/publish-jobs
# - POST /api/admin/content-studio/posts/:id/publish-now
# - POST /api/admin/content-studio/posts/:id/schedule
# - POST /api/admin/content-studio/posts/:id/draft-on-provider
# - POST /api/admin/content-studio/posts/:id/cancel
# - PATCH /api/admin/content-studio/posts/:id/reschedule
# - POST /api/admin/content-studio/publish-jobs/:id/retry
# - POST /api/admin/content-studio/publish-jobs/:id/cancel
# - POST /api/admin/content-studio/postiz/integrations/sync
# - GET  /api/admin/content-studio/health (+ mockMode)
# - Plus tous les variants d'erreur (402, 409, 429, 503)
```
Voir `test-battery/06-msw-handlers-catalog.yaml`.

### 1.2 Fixtures
```bash
# apps/web/src/test/fixtures/social-publishing/
#   - accounts.json  (5 comptes : instagram active, instagram disabled, facebook active, token_expired, postiz mock)
#   - jobs.json      (8 jobs couvrant tous les statuts)
#   - posts.json     (3 posts : approved/scheduled/published)
#   - postiz/        (responses /upload, /posts, /analytics)
```
Voir `test-battery/07-fixtures-catalog.yaml`.

### 1.3 Helpers Playwright partagés
```bash
# apps/web/e2e/social-publishing/helpers.ts
# - registerPublishMocks(page, opts)
# - driveToPublishStep(page) — conduit jusqu'à postId disponible
# - assertJobInQueue(page, jobId, expectedStatus)
```

**Critère de sortie Phase 1** :
- [ ] `social-publishing-handlers.ts` exporte ≥ 14 handlers (≥ 28 incluant variants)
- [ ] Fixtures cataloguées
- [ ] Helpers Playwright importables

---

## Phase 2 — Component tests (2 j-p)

Ref : `implementation/phase-2-component-tests.md`

```bash
# Composants à couvrir (>= 85% lignes) :
pnpm vitest run \
  src/components/admin/content-studio-v2/create/PublishActionGroup.test.tsx \
  src/components/admin/content-studio-v2/plan/JobQueue.test.tsx \
  src/components/admin/content-studio-v2/plan/QuickEditDrawer.test.tsx \
  src/components/admin/content-studio-v2/plan/Calendar.test.tsx \
  src/components/admin/content-studio-v2/plan/CalendarCard.test.tsx \
  src/components/admin/content-studio-v2/home/AccountHealthCard.test.tsx \
  src/components/admin/content-studio-v2/library/LibraryClient.test.tsx \
  --reporter=verbose 2>&1 | tee /tmp/sp-component.log
```

**Cibles ajoutées (à créer)** :
- `JobQueue.test.tsx` — états (queued, publishing, published, failed), retry, cancel, polling
- `QuickEditDrawer.test.tsx` — reschedule, cancel, validation date
- `Calendar.test.tsx` — filtres status/platform/pillar, drag-drop, vues
- `CalendarCard.test.tsx` — badges, pillar dots, thumbnails

**Critère de sortie Phase 2** : 0 fail, coverage ≥ 85% sur tous ces composants.

---

## Phase 3 — Contract tests API (1 j-p)

Ref : `implementation/phase-3-contract-tests.md`

```bash
pnpm vitest run \
  src/test/api-contracts/social-publishing-*.contract.test.ts \
  --reporter=verbose 2>&1 | tee /tmp/sp-contract.log
```

**Fichiers à créer / compléter** :
- `social-publishing-publish-now.contract.test.ts`
- `social-publishing-schedule.contract.test.ts`
- `social-publishing-draft-on-provider.contract.test.ts`
- `social-publishing-cancel.contract.test.ts`
- `social-publishing-reschedule.contract.test.ts`
- `social-publishing-publish-jobs-list.contract.test.ts`
- `social-publishing-publish-jobs-retry.contract.test.ts`
- `social-publishing-publish-jobs-cancel.contract.test.ts`
- `social-publishing-postiz-sync.contract.test.ts`

Pour chaque : 200 success, 400 validation (chaque champ), 401, 404, 409 état invalide, 429, 500.

**Critère de sortie Phase 3** : 100% des routes ont ≥ 6 cas couverts.

---

## Phase 4 — Unit tests (1 j-p)

Ref : `implementation/phase-4-unit-tests.md`

```bash
pnpm vitest run \
  src/lib/social-publishing \
  src/lib/content-studio/postiz.test.ts \
  --reporter=verbose 2>&1 | tee /tmp/sp-unit.log
```

**Compléments à ajouter** :
- `state-machine` — toutes les transitions valides + invalides
- `retry` — backoff exact, max attempts, transient codes
- `errors` — mapping HTTP code → error code (table complète)
- `idempotency` — race condition (2 requêtes simultanées) via Promise.all

**Critère de sortie Phase 4** : couverture services ≥ 80%.

---

## Phase 5 — E2E mocked (2 j-p)

Ref : `implementation/phase-5-e2e-mocked.md`

```bash
# Démarrer le serveur en mock mode
CONTENT_STUDIO_V2_MOCK_MODE=true pm2 restart web && sleep 5

# Run E2E
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 \
  npx playwright test e2e/social-publishing/*.spec.ts \
  --reporter=list --project=chromium 2>&1 | tee /tmp/sp-e2e.log
```

**Specs à créer (12 fichiers)** :
- `publish-now-golden-path.spec.ts` (S01)
- `schedule-golden-path.spec.ts` (S02)
- `postiz-draft-golden-path.spec.ts` (S03)
- `account-disconnect.spec.ts` (S04)
- `multi-platform-bulk.spec.ts` (S05)
- `failed-then-retried.spec.ts` (S06)
- `scheduled-cancelled.spec.ts` (S07)
- `network-blackout.spec.ts` (S08)
- `idempotency-race.spec.ts` (S11)
- `quick-edit-reschedule.spec.ts` (S07 partial)
- `job-queue-monitoring.spec.ts`
- `calendar-week-view.spec.ts` (S12)

**Critère de sortie Phase 5** : 100% des 12 specs passent.

---

## Phase 6 — Cross-cutting (a11y, dark, responsive, keyboard) (0.5 j-p)

Ref : `implementation/phase-6-cross-cutting.md`

```bash
npx playwright test \
  e2e/social-publishing/a11y.spec.ts \
  e2e/social-publishing/dark-mode.spec.ts \
  e2e/social-publishing/responsive.spec.ts \
  e2e/social-publishing/keyboard.spec.ts \
  --reporter=list --project=chromium
```

**Critère de sortie Phase 6** :
- 0 violation axe critical
- Snapshots dark mode verts
- Aucun overflow horizontal (1440 / 1024 / 414)
- Tab order naturel, Esc ferme dialogs, Cmd+S flush

---

## Phase 7 — Live Instagram (AlFenna Beauty) (1 j-p)

Ref : `implementation/phase-7-live-instagram.md` + `05-live-testing-protocol.md`

⚠ **À ne lancer qu'après validation** opérateur (impact réseau social réel).

### Pré-requis
```bash
# Variables d'env
export POSTIZ_BASE_URL=https://api.postiz.com
export POSTIZ_API_KEY=<votre-clé>
export E2E_LIVE_POSTIZ=1                 # GATE STRICT
export E2E_LIVE_ACCOUNT_ID=<postiz-integration-id>  # compte AlFenna sur Postiz
export E2E_LIVE_INSTAGRAM_HANDLE=alfenna_beauty
export E2E_LIVE_CLEANUP=1                # auto-unpublish après vérif
```

### Exécution
```bash
# 1. Vérifier que le compte est synchronisé
curl -X POST http://localhost:8012/api/admin/content-studio/postiz/integrations/sync \
  -H "Cookie: <admin-session-cookie>"

# 2. Lancer le live test
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 \
  npx playwright test e2e/social-publishing/live-instagram-alfenna.spec.ts \
  --grep @live \
  --workers=1 \
  --reporter=list --project=chromium

# 3. Vérifier le post sur Instagram
# Ouvrir https://instagram.com/alfenna_beauty manuellement → confirmer le post test

# 4. Vérifier la DB
PGPASSWORD=$DB_PASSWORD psql -h 127.0.0.1 -U femiglow -d staging_femiglow \
  -c "SELECT status, postizPostId, lastError FROM content_postiz_delivery ORDER BY createdAt DESC LIMIT 1;"

# 5. Cleanup (si E2E_LIVE_CLEANUP n'a pas tourné)
# Voir 05-live-testing-protocol.md §6
```

**Critères de sortie Phase 7** :
- [ ] Le post test apparaît bien sur Instagram (vérifié manuellement)
- [ ] `content_postiz_delivery.status='sent'`, `postizPostId` non null
- [ ] Audit log `social.publish.published` enregistré
- [ ] Cleanup réussi (post retiré ou marqué test)

---

## Phase 8 — Correction loop + report (0.5 j-p)

Ref : `implementation/phase-8-correction-loop.md`

```bash
# 1. Aggregate
cat /tmp/sp-*.log | grep -E "(PASS|FAIL|Tests:|fail)" | tail -100

# 2. Fix loop (pour chaque fail)
#   a. Identifier nature : bug code / bug test / contrat dérivé / flake
#   b. Localiser via stack trace
#   c. Corriger code en priorité (sinon test si spec a évolué)
#   d. Re-run le fichier seul → module → full
#   e. Documenter dans REGRESSION_NOTES.md

# 3. Anti-flake (3 runs identiques)
for i in 1 2 3; do
  echo "=== Run $i ==="
  npx playwright test e2e/social-publishing/*.spec.ts --grep -v @live \
    --reporter=line --project=chromium | tail -5
done

# 4. Couverture
pnpm vitest run --coverage \
  src/lib/social-publishing \
  src/components/admin/content-studio-v2/create/PublishActionGroup.tsx \
  src/components/admin/content-studio-v2/plan
```

**Critère de sortie Phase 8** :
- [ ] 0 fail Vitest
- [ ] 0 fail Playwright (mock + live)
- [ ] 3 runs identiques
- [ ] Couvertures cibles atteintes
- [ ] PR ouverte avec lien vers `00-runbook.md`

---

## Boucle de correction (universelle)

```
Pour chaque échec :
1. Stack trace → fichier:ligne
2. Nature ?
   a. Bug code     → fix code → re-run isolé
   b. Bug test     → fix test → re-run isolé
   c. Spec dérivée → update test + spec.md → re-run
   d. Flake        → ajouter wait/retry → re-run 3×
3. Once green isolated → re-run module
4. Once green module → re-run full suite
5. Document significant fixes in REGRESSION_NOTES.md
```

## Critères de done global

- [ ] Phases 1 à 8 toutes vertes
- [ ] `pnpm run build` à 0 erreur TS
- [ ] `pnpm vitest run` à 0 fail
- [ ] `playwright test` (excluant @live) à 0 fail
- [ ] Live test S13 passe avec post réel + cleanup
- [ ] Couverture ≥ cibles (cf `06-coverage-targets.md`)
- [ ] 3 runs anti-flake identiques
- [ ] PR ouverte, lien vers ce runbook dans la description
