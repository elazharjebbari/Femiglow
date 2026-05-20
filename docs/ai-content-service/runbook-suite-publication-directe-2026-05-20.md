# Runbook — Suite publication directe Phase A (post `f4e6506`)

Date : 2026-05-20
Environnement : staging `/var/www/femiglow-staging` uniquement
Plan parent : `docs/ai-content-service/plan-action-suite-publication-directe-2026-05-20.md`

## Préconditions

- Travailler depuis `/var/www/femiglow-staging`.
- `git status` propre (commit `f4e6506` appliqué).
- Vars d'env présentes : `POSTIZ_BASE_URL`, `POSTIZ_API_KEY`, `NEXT_PUBLIC_SITE_URL`, `CONTENT_STUDIO_ENABLED=true`.
- DB staging accessible.
- Service `femiglow-staging.service` disponible.

## Découverte préalable (confirmé 2026-05-20)

- L'UI retry/cancel **est déjà implémentée** dans `SocialPublishingPanel.tsx` lignes 235-241 et couverte par des tests dans `SocialPublishingPanel.test.tsx`. **L'étape A.3 du plan est donc déjà terminée** — le runbook ne la rejoue pas.
- Le fix utile sur l'UX est mineur (confirmation cancel), il est listé comme nice-to-have non bloquant.

## Étape A.1 — Cohérence state machine `content_post`

### A.1.1 — Lister les transitions manquantes

État courant (`apps/web/src/lib/content-studio/state-machine.ts`) :
```
approved: ['scheduled', 'archived']
scheduled: ['published', 'failed', 'cancelled', 'approved']
published: ['measured', 'archived']
```

Manquants pour le chemin `publishContentPostNow` (approved → publication directe sans scheduled intermédiaire) :
- `approved → published`
- `approved → failed`

### A.1.2 — Modifier le state machine

Fichier : `apps/web/src/lib/content-studio/state-machine.ts`

Remplacer :
```ts
approved: ['scheduled', 'archived'],
```
par :
```ts
approved: ['scheduled', 'published', 'failed', 'archived'],
```

### A.1.3 — Enforcer `assertTransition` dans `updatePostPlanning`

Fichier : `apps/web/src/lib/content-studio/repository.ts:691`

Ajouter avant la mise à jour Drizzle :
```ts
if (input.status && input.status !== existing.status) {
  assertTransition(existing.status, input.status);
}
```
Importer `assertTransition` depuis `./state-machine` si pas déjà fait.

### A.1.4 — Tests vitest

Fichier : `apps/web/src/lib/content-studio/state-machine.test.ts`

Ajouter :
```ts
it('autorise approved → published', () => {
  expect(canTransition('approved', 'published')).toBe(true);
});
it('autorise approved → failed', () => {
  expect(canTransition('approved', 'failed')).toBe(true);
});
it('rejette approved → measured directement', () => {
  expect(canTransition('approved', 'measured')).toBe(false);
});
```

### A.1.5 — Lancer les tests state machine

```bash
pnpm --dir apps/web exec vitest run src/lib/content-studio/state-machine.test.ts
```

Attendu : tous verts.

## Étape A.2 — Postiz adapter scaffold

### A.2.1 — Créer `adapters/postiz.ts`

Fichier nouveau : `apps/web/src/lib/social-publishing/adapters/postiz.ts`

Spécification :
- Classe `PostizSocialPublishingAdapter` implémentant `SocialPublishingAdapter`.
- `provider = 'postiz'`.
- `listCapabilities(account)` retourne :
  - Instagram : post (media required, caption max 2200, scheduling true), carousel (media required, caption max 2200), reel (media required, caption max 2200), story (media required, caption max 2200).
  - Facebook : post (media optional, caption max 63206, scheduling true).
- `publish(request)` :
  - Valide idempotencyKey, provider account, status active, format supporté, media HTTPS si requis.
  - Si présent → `uploadPostizMediaFromUrl({ url: media[0].url, filename: …, retry: { attempts: 3 } })`.
  - Build payload via `buildPostizDraftPayload({ integrationId: account.remoteId, platform, format, content: caption, scheduledAt, tags, image: uploadedMedia })`.
  - Appelle `createPostizDraft(payload, { retry: { attempts: 3 } })` (fonction à confirmer en lecture du fichier).
  - Extrait l'ID via `extractPostizPostId(response.body)`.
  - Retourne `SocialPublishSuccess` avec `remoteId`, `permalink` si dispo, `publishedAt = now`, `raw = redactProviderPayload(response.body)`.
  - Mapping d'erreurs :
    - HTTP 401/403 → `token_expired` ou `permission_denied`.
    - HTTP 422 → `invalid_request`.
    - HTTP 429 → `provider_rate_limited` (retryable).
    - HTTP 5xx → `provider_unavailable` (retryable).
    - Autre → `unknown_provider_error`.

### A.2.2 — Tests vitest

Fichier nouveau : `apps/web/src/lib/social-publishing/adapters/postiz.test.ts`

Cas couverts :
- `listCapabilities()` retourne 4 capabilities pour Instagram, 1 pour Facebook.
- `listCapabilities()` retourne 0 pour un account non actif.
- `publish()` succès : mock `uploadPostizMediaFromUrl` + `createPostizDraft`, vérifie mapping de la réponse.
- `publish()` rejette idempotencyKey vide.
- `publish()` rejette media non HTTPS.
- `publish()` mappe HTTP 429 → `provider_rate_limited` retryable=true.
- `publish()` mappe HTTP 5xx → `provider_unavailable` retryable=true.
- `publish()` mappe HTTP 403 → `permission_denied` retryable=false.

### A.2.3 — Lancer les tests adapter

```bash
pnpm --dir apps/web exec vitest run src/lib/social-publishing/adapters/
```

Attendu : tous verts.

### A.2.4 — Pas de câblage en prod (Phase A)

L'adapter est **uniquement scaffoldé**. Il n'est référencé dans aucune route ni dans `executeDryRunJob`. Le câblage interviendra en Phase B.

## Étape A.3 — Confirmation déjà faite

L'UI retry/cancel existe et est testée. Pas d'action runbook.

## Étape A.4 — Validation Phase A complète

### A.4.1 — Vitest scope élargi

```bash
pnpm --dir apps/web exec vitest run \
  src/lib/content-studio/state-machine.test.ts \
  src/lib/content-studio/repository.test.ts \
  src/lib/social-publishing/ \
  src/components/admin/content-studio/SocialPublishingPanel.test.tsx \
  src/test/msw/content-studio-handlers.test.ts \
  src/test/msw/social-publishing-handlers.test.ts
```

Attendu : 100% green. Rapport en stdout.

### A.4.2 — Typecheck

```bash
pnpm --dir apps/web typecheck
```

Attendu : OK.

### A.4.3 — Build

```bash
pnpm --dir apps/web build
```

Attendu : OK (warnings Handlebars / dynamic server existants tolérés).

### A.4.4 — Permissions et restart staging

```bash
chmod -R a+rwX apps/web/.next
chown -R nodeapp:nodeapp apps/web/.next
systemctl restart femiglow-staging.service
systemctl status femiglow-staging.service --no-pager
```

Attendu : `active (running)`.

### A.4.5 — Smoke HTTP

```bash
curl -s -I http://127.0.0.1:8012/admin/content-studio
curl -s -I http://127.0.0.1:8012/api/admin/social/accounts
```

Attendu : 307 (redirect login) ou 200/401 selon session.

### A.4.6 — Playwright social-publishing

```bash
cd apps/web && npx playwright test e2e/content-studio-social-publishing.spec.ts --project=chromium --reporter=line
```

Attendu : 2 passed.

### A.4.7 — Bilan

- Tests vitest élargis : ✅ ou ❌ (avec failure list).
- Typecheck : ✅.
- Build : ✅.
- Restart staging : ✅.
- Smoke HTTP : 2 réponses correctes.
- Playwright : 2/2 passed.

## Étape A.5 — Commit

Si toutes les validations passent :

```bash
git add apps/web/src/lib/content-studio/state-machine.ts \
        apps/web/src/lib/content-studio/state-machine.test.ts \
        apps/web/src/lib/content-studio/repository.ts \
        apps/web/src/lib/social-publishing/adapters/postiz.ts \
        apps/web/src/lib/social-publishing/adapters/postiz.test.ts \
        docs/ai-content-service/plan-action-suite-publication-directe-2026-05-20.md \
        docs/ai-content-service/runbook-suite-publication-directe-2026-05-20.md
git status
```

Vérifier que seuls ces fichiers sont staged.

Message de commit :
```
feat(social-publishing): postiz adapter scaffold + content-studio state coherence

Backend:
- add lib/social-publishing/adapters/postiz.ts implementing SocialPublishingAdapter
- the adapter is scaffolded only and not yet routed in executeDryRunJob
- map Postiz HTTP errors to normalized error codes (token_expired,
  permission_denied, provider_rate_limited, provider_unavailable,
  invalid_request, unknown_provider_error)
- list Postiz capabilities for instagram (post/carousel/reel/story)
  and facebook (post)

Content Studio:
- allow approved -> published and approved -> failed transitions to
  support direct publish-now without a scheduled intermediate
- enforce assertTransition in updatePostPlanning to keep the state
  machine the single source of truth for content_post.status changes

Tests:
- new vitest coverage for the new transitions
- new vitest coverage for the postiz adapter (capabilities, success,
  http error mappings)

Docs:
- add plan-action-suite-publication-directe-2026-05-20.md
- add runbook-suite-publication-directe-2026-05-20.md

Validation performed on staging:
- targeted vitest -> OK
- typecheck -> OK
- build -> OK
- restart femiglow-staging.service -> active
- smoke /admin/content-studio and /api/admin/social/accounts -> OK
- Playwright e2e/content-studio-social-publishing.spec.ts -> 2 passed

Phase B (worker scheduling + dispatcher d'adapter) reste à faire dans
une session ultérieure.
```

## Diagnostic incident

- **Vitest state-machine échoue** : vérifier l'ordre des transitions ; l'import `assertTransition` ; l'absence d'`approved → measured`.
- **Vitest postiz adapter échoue** : vérifier le mock de `uploadPostizMediaFromUrl` et `createPostizDraft` ; vérifier le mapping HTTP → code erreur.
- **Typecheck échoue** : `SocialPublishingError` accepte un objet `{code, message, retryable}` ; `SocialPublishProviderResponse` exige `publishedAt: string`.
- **Build échoue avec PageNotFoundError** : redémarrer le service et purger `.next` si nécessaire (`rm -rf apps/web/.next && pnpm --dir apps/web build`).
- **Playwright timeout** : vérifier que le service répond ; vérifier `ADMIN_BOOTSTRAP_*` env vars.

## Rollback

- Annuler les modifs non-commitées via `git restore <file>` si validation échoue.
- Si commit déjà fait : `git revert HEAD` (préférer reverter plutôt que reset --hard sur staging).

## Hors scope

Ce runbook ne couvre PAS :
- L'activation du Postiz adapter dans `executeDryRunJob` (Phase B).
- Le worker de scheduling (Phase B).
- Le chiffrement des credentials (Phase C).
- L'adapter Meta Graph (Phase C).
