# Runbook — Publication directe depuis Femiglow

Date: 2026-05-19
Worktree obligatoire: `/var/www/femiglow-leads-webhook-multi-step`

## 1. Préparation

Toujours démarrer ici:

```bash
cd /var/www/femiglow-leads-webhook-multi-step
git status --short
```

Ne pas travailler dans `/var/www/femiglow-staging` pour cette feature.

## 2. Vérifier l'état du module AI content

```bash
find docs/ai-content-service -maxdepth 3 -type f -print
rg -n "content-studio|social-publishing|postiz|Postiz|Meta|Instagram|Facebook" apps/web/src docs/ai-content-service
```

Résultat attendu:

- le plan `docs/ai-content-service/plan-publication-directe.md` existe ;
- le module Content Studio est identifié comme existant, absent ou à porter ;
- aucun développement ne démarre sans cette conclusion.

## 3. Préparer les variables d'environnement

Ne jamais afficher les valeurs en clair. Vérifier uniquement la présence.

Variables prévues:

```txt
SOCIAL_PUBLISHING_PROVIDER=dry_run|meta_graph|postiz
SOCIAL_PUBLISHING_DRY_RUN=true
META_GRAPH_API_VERSION=v21.0
META_APP_ID=
META_APP_SECRET=
META_PAGE_ID=
META_IG_USER_ID=
META_PAGE_ACCESS_TOKEN=
POSTIZ_BASE_URL=
POSTIZ_API_KEY=
NEXT_PUBLIC_SITE_URL=
```

Commande de présence, sans impression de secrets:

```bash
node -e "const keys=['SOCIAL_PUBLISHING_PROVIDER','META_GRAPH_API_VERSION','META_PAGE_ID','META_IG_USER_ID','NEXT_PUBLIC_SITE_URL']; for (const k of keys) console.log(k, process.env[k] ? 'set' : 'missing')"
```

## 4. Implémentation slice 1 — dry-run

Créer:

```txt
apps/web/src/lib/social-publishing/contracts.ts
apps/web/src/lib/social-publishing/state-machine.ts
apps/web/src/lib/social-publishing/retry.ts
apps/web/src/lib/social-publishing/errors.ts
apps/web/src/lib/social-publishing/adapters/dry-run.ts
apps/web/src/lib/social-publishing/*.test.ts
```

Tests:

```bash
pnpm --dir apps/web exec vitest run src/lib/social-publishing
pnpm --dir apps/web typecheck
```

Critère: aucune dépendance Meta/Postiz réelle dans cette slice.

## 5. Implémentation slice 2 — data et repository

Ajouter les tables Drizzle:

- `social_accounts`
- `social_credentials`
- `social_publish_jobs`
- `social_publish_attempts`
- `social_publications`
- `social_publish_events`

Puis:

```bash
pnpm --dir apps/web exec vitest run src/lib/social-publishing
pnpm --dir apps/web typecheck
```

Critères:

- idempotency key unique ;
- secrets redacted dans les responses testées ;
- jobs requêtables par statut.

## 6. Implémentation slice 3 — API admin

Créer les routes:

```txt
GET  /api/admin/social/accounts
POST /api/admin/social/accounts/sync
GET  /api/admin/content-studio/posts/[id]/publishability
POST /api/admin/content-studio/posts/[id]/publish-now
POST /api/admin/content-studio/posts/[id]/schedule
POST /api/admin/content-studio/publish-jobs/[id]/retry
POST /api/admin/content-studio/publish-jobs/[id]/cancel
GET  /api/admin/content-studio/publish-jobs
GET  /api/admin/content-studio/publish-jobs/[id]
```

Tests:

```bash
pnpm --dir apps/web exec vitest run src/app/api/admin/content-studio src/app/api/admin/social
```

Critères:

- admin requis ;
- permission publication requise ;
- validation Zod ;
- pas de secret renvoyé.

## 7. Implémentation slice 4 — UI admin

Ajouter dans Content Studio:

- panneau Publication ;
- compte social ;
- preview par plateforme ;
- bouton `Publier maintenant` ;
- bouton `Programmer` ;
- timeline ;
- retry/cancel.

Tests:

```bash
pnpm --dir apps/web exec vitest run src/components/admin
pnpm --dir apps/web exec playwright test e2e/content-studio-social-publish.spec.ts
```

Critères UX:

- statut clair ;
- erreur actionnable ;
- confirmation avant publication immédiate ;
- pas de dépendance à l'interface Postiz.

## 8. Implémentation slice 5 — MSW

Créer:

```txt
apps/web/src/test/msw/social-publishing-handlers.ts
```

Scénarios requis:

- dry-run published ;
- Meta publish success ;
- 429 puis retry ;
- 401 token expired ;
- 403 permission denied ;
- media invalid ;
- Postiz fallback success/failure.

Commande:

```bash
pnpm --dir apps/web exec vitest run src/test/msw
```

## 9. Implémentation slice 6 — Postiz fallback

Objectif: garder Postiz comme provider optionnel, sans validation manuelle.

Tests:

```bash
pnpm --dir apps/web exec vitest run src/lib/social-publishing/adapters/postiz.test.ts
```

Critères:

- `postizPostId` stocké comme remote id ;
- réponse provider redacted ;
- retry borné ;
- échec visible dans job.

## 10. Implémentation slice 7 — Meta Graph

Commencer uniquement par:

- Instagram image post ;
- Facebook page image post.

Ne pas inclure reels, stories ou carrousels dans la première livraison.

Tests:

```bash
pnpm --dir apps/web exec vitest run src/lib/social-publishing/adapters/meta-graph.test.ts
pnpm --dir apps/web exec vitest run src/lib/social-publishing
```

Critères:

- container créé ;
- publication confirmée ;
- remote id stocké ;
- erreurs Meta normalisées ;
- token expiré non retryé automatiquement ;
- 429 retryé.

## 11. Validation complète

```bash
pnpm --dir apps/web exec vitest run src/lib/social-publishing src/test/msw
pnpm --dir apps/web exec playwright test e2e/content-studio-social-publish.spec.ts
pnpm --dir apps/web typecheck
pnpm --dir apps/web build
```

## 12. Smoke staging dry-run

```bash
pnpm --dir apps/web build
systemctl restart femiglow-staging.service
curl -s -I http://127.0.0.1:8012/admin/content-studio
```

Résultat attendu:

- service actif ;
- page admin répond ;
- publication dry-run visible dans la timeline ;
- aucun post externe créé.

## 13. Smoke réel Meta

À exécuter seulement si:

- le compte Instagram est professionnel ;
- la page Facebook est liée ;
- les permissions Meta sont validées ;
- les tokens sont présents et non expirés ;
- un média HTTPS public est disponible ;
- le dry-run et Playwright sont verts.

Résultat attendu:

- job `published` ;
- remote id non null ;
- permalink si disponible ;
- audit log présent ;
- aucune validation Postiz requise.

## 14. Rollback

Si la publication directe échoue:

1. Désactiver `meta_graph`.
2. Revenir à `dry_run` ou `postiz`.
3. Ne pas supprimer les jobs échoués.
4. Conserver attempts/responses redacted pour diagnostic.
5. Rebuild + restart si changement de config.

## 15. Diagnostic rapide

- `token_expired`: renouveler token, ne pas retry automatiquement.
- `permission_denied`: vérifier scopes/app review.
- `media_not_public`: vérifier `NEXT_PUBLIC_SITE_URL` et URL média HTTPS.
- `provider_rate_limited`: retry avec backoff.
- `unsupported_format`: bloquer côté publishability avant l'appel provider.
- `duplicate_external_post`: vérifier idempotency key et lock job.


## 16. Exécution réelle — tranche 1 terminée

Date d'exécution: 2026-05-19
Worktree: `/var/www/femiglow-leads-webhook-multi-step`

### Livré

- Audit du worktree: `docs/ai-content-service/audit-worktree-publication-directe.md`.
- Noyau backend pur: `apps/web/src/lib/social-publishing`.
- Contrats provider/platform/format/statuts/erreurs.
- State machine de publication.
- Erreurs normalisées + redaction de secrets provider.
- Retry borné.
- Adapter `dry_run` sans dépendance externe.
- Service `publishWithAdapter`.
- Tests Vitest ciblés.

### Validation exécutée

```bash
pnpm --dir apps/web exec vitest run src/lib/social-publishing
pnpm --dir apps/web typecheck
pnpm --dir apps/web build
```

Résultats:

- Vitest social-publishing: `5 passed`, `17 tests passed`.
- Typecheck: OK.
- Build Next.js: OK.

Warnings build connus et non liés à cette tranche:

- Handlebars `require.extensions` dans les templates email.
- Dynamic server usage sur `/api/delivery-cities/search`.
- Dynamic server usage sur `/feed.xml`.

### Limites volontaires de la tranche

- Pas de migration DB encore créée.
- Pas de route API admin encore créée.
- Pas d'UI Content Studio encore créée dans ce worktree.
- Pas d'appel Postiz réel.
- Pas d'appel Meta Graph réel.

Ces limites sont intentionnelles: le worktree ne contient pas encore de module applicatif Content Studio. La prochaine tranche doit d'abord consolider ce module ou créer les routes/data nécessaires autour du noyau `social-publishing`.


## 17. Exécution réelle — tranche 2 Content Studio consolidée

Date d'exécution: 2026-05-19
Worktree: `/var/www/femiglow-leads-webhook-multi-step`

### Livré

- Portage du module Content Studio depuis staging vers le worktree cible.
- Routes admin Content Studio: `apps/web/src/app/api/admin/content-studio`.
- Routes cron Content Studio: `apps/web/src/app/api/cron/content-studio`.
- Page admin: `apps/web/src/app/admin/content-studio/page.tsx`.
- Composants UI admin: `apps/web/src/components/admin/content-studio`.
- Domaine applicatif: `apps/web/src/lib/content-studio`.
- Schéma DB Content Studio: `apps/web/src/lib/db/schema-content-studio.ts`.
- Migration consolidée: `apps/web/drizzle/migrations/0055_ai_content_studio.sql`.
- Variables d'environnement Content Studio ajoutées au contrat `env.ts`.
- Entrée `Studio IA` ajoutée à la navigation admin.
- Métadonnées média `overrides.contentStudio` typées pour distinguer les visuels IA/importés.

### Validation exécutée

```bash
pnpm --dir apps/web exec vitest run src/lib/content-studio/state-machine.test.ts src/lib/content-studio/brand-rules.test.ts src/lib/content-studio/schemas.test.ts src/lib/content-studio/postiz.test.ts src/lib/content-studio/image-generation.test.ts src/lib/content-studio/auth.test.ts src/lib/content-studio/budget.test.ts src/lib/content-studio/idempotency.test.ts src/lib/content-studio/repository.test.ts src/lib/content-studio/automation.test.ts src/lib/social-publishing
pnpm --dir apps/web exec vitest run src/components/admin/content-studio src/app/api/admin/content-studio/ideas/route.test.ts
pnpm --dir apps/web typecheck
pnpm --dir apps/web build
```

Résultats:

- Vitest backend Content Studio + social-publishing: `15 passed`, `125 tests passed`.
- Vitest UI/API Content Studio: `11 passed`, `59 tests passed`.
- Typecheck complet: OK.
- Build Next.js: OK.

Warnings connus et non bloquants observés:

- Warnings React `act(...)` dans `IdeaForm.test.tsx` liés au chargement asynchrone de `CampaignSelect`; les tests passent mais ce point doit être nettoyé dans une tranche qualité UI/tests.
- Warning webpack Handlebars `require.extensions` dans les templates email, préexistant.
- Dynamic server usage sur `/api/delivery-cities/search` et `/feed.xml`, préexistant.

### Limites restantes avant publication sociale complète

- La migration `0055_ai_content_studio.sql` est préparée mais non appliquée par ce runbook.
- Le module `social-publishing` reste en dry-run pur, sans repository DB ni routes admin.
- Le panneau de publication directe n'est pas encore intégré à l'UI Content Studio.
- Aucun appel Postiz réel ni Meta Graph réel n'a été lancé.

Prochaine tranche: connecter `social-publishing` au modèle Content Studio avec tables DB, repository, routes admin de jobs, puis panneau UI de publication en dry-run.

## 18. Exécution réelle — tranche 3 data social-publishing

Date d'exécution: 2026-05-19
Worktree: `/var/www/femiglow-leads-webhook-multi-step`

### Livré

- Schéma Drizzle social-publishing: `apps/web/src/lib/db/schema-social-publishing.ts`.
- Migration dédiée: `apps/web/drizzle/migrations/0056_social_publishing.sql`.
- Repository data: `apps/web/src/lib/social-publishing/repository.ts`.
- Types de persistance ajoutés aux contrats: jobs, attempts, publications, events.
- Tests repository: `apps/web/src/lib/social-publishing/repository.test.ts`.
- Export repository depuis `apps/web/src/lib/social-publishing/index.ts`.

### Couverture fonctionnelle livrée

- Upsert de comptes sociaux par provider + remote id.
- Création de jobs de publication avec idempotency key unique côté repository.
- Listing/filtrage des jobs par statut, post et compte.
- Transitions de statut persistées.
- Attempts avec compteur incrémental.
- Redaction récursive des secrets dans request/response/error/metadata.
- Création de publications externes avec remote id/permalink.
- Timeline d'événements par job.

### Validation exécutée

```bash
pnpm --dir apps/web exec vitest run src/lib/social-publishing
pnpm --dir apps/web typecheck
pnpm --dir apps/web exec vitest run src/lib/content-studio/state-machine.test.ts src/lib/content-studio/brand-rules.test.ts src/lib/content-studio/schemas.test.ts src/lib/content-studio/postiz.test.ts src/lib/content-studio/image-generation.test.ts src/lib/content-studio/auth.test.ts src/lib/content-studio/budget.test.ts src/lib/content-studio/idempotency.test.ts src/lib/content-studio/repository.test.ts src/lib/content-studio/automation.test.ts src/lib/social-publishing src/components/admin/content-studio src/app/api/admin/content-studio/ideas/route.test.ts
pnpm --dir apps/web build
```

Résultats:

- Vitest social-publishing: `6 passed`, `21 tests passed`.
- Typecheck complet: OK.
- Vitest Content Studio + social-publishing + UI/API ciblée: `27 passed`, `188 tests passed`.
- Build Next.js: OK.

Warnings connus et non bloquants observés:

- Warnings React `act(...)` dans `IdeaForm.test.tsx`, préexistants à cette tranche.
- Warning webpack Handlebars `require.extensions`, préexistant.
- Dynamic server usage sur `/api/delivery-cities/search` et `/feed.xml`, préexistant.

### Limites restantes avant publication sociale complète

- Les migrations `0055_ai_content_studio.sql` et `0056_social_publishing.sql` sont préparées mais non appliquées par ce runbook.
- Pas encore de routes admin `publish-now`, `schedule`, `retry`, `cancel`.
- Pas encore de panneau UI de publication directe dans Content Studio.
- Pas encore d'adapter Postiz social-publishing ni Meta Graph.
- Pas encore de Playwright/MSW pour le flux de publication directe.

Prochaine tranche: routes admin `social/accounts` et `content-studio/posts/[id]/publishability|publish-now|schedule`, branchées sur repository + adapter `dry_run` uniquement.

## 19. Exécution réelle — tranche 4 API admin dry-run

Date d'exécution: 2026-05-19
Worktree: `/var/www/femiglow-leads-webhook-multi-step`

### Livré

- Service admin dry-run: `apps/web/src/lib/social-publishing/admin-service.ts`.
- Routes comptes sociaux:
  - `GET /api/admin/social/accounts`
  - `POST /api/admin/social/accounts`
  - `POST /api/admin/social/accounts/sync`
- Routes publication Content Studio:
  - `GET /api/admin/content-studio/posts/[id]/publishability`
  - `POST /api/admin/content-studio/posts/[id]/publish-now`
  - `POST /api/admin/content-studio/posts/[id]/schedule`
- Routes jobs:
  - `GET /api/admin/content-studio/publish-jobs`
  - `GET /api/admin/content-studio/publish-jobs/[id]`
  - `POST /api/admin/content-studio/publish-jobs/[id]/retry`
  - `POST /api/admin/content-studio/publish-jobs/[id]/cancel`
- Tests de routes dry-run: `apps/web/src/app/api/admin/content-studio/posts/[id]/publish-now/route.test.ts`.

### Couverture fonctionnelle livrée

- Auth admin obligatoire sur toutes les routes.
- Feature flag Content Studio obligatoire.
- Synchronisation de deux comptes dry-run: Instagram et Facebook.
- Vérification publishability: statut post, statut draft, review bloquante, capacité compte, média HTTPS public, longueur caption.
- Publication immédiate dry-run avec job, attempt, publication, events et mise à jour du post Content Studio en `published`.
- Idempotence explicite sur `Idempotency-Key`: un double clic retourne le même job publié au lieu de recréer ou rejeter.
- Programmation future en job `queued` avec post Content Studio en `scheduled`.
- Annulation d'un job non terminal.
- Listing et détail de jobs avec events et publications.

### Validation exécutée

```bash
pnpm --dir apps/web exec vitest run src/app/api/admin/content-studio/posts/[id]/publish-now/route.test.ts src/lib/social-publishing
pnpm --dir apps/web exec vitest run src/lib/content-studio/state-machine.test.ts src/lib/content-studio/brand-rules.test.ts src/lib/content-studio/schemas.test.ts src/lib/content-studio/postiz.test.ts src/lib/content-studio/image-generation.test.ts src/lib/content-studio/auth.test.ts src/lib/content-studio/budget.test.ts src/lib/content-studio/idempotency.test.ts src/lib/content-studio/repository.test.ts src/lib/content-studio/automation.test.ts src/lib/social-publishing src/components/admin/content-studio src/app/api/admin/content-studio/ideas/route.test.ts src/app/api/admin/content-studio/posts/[id]/publish-now/route.test.ts
pnpm --dir apps/web typecheck
pnpm --dir apps/web build
```

Résultats:

- Vitest routes dry-run + social-publishing: `7 passed`, `25 tests passed`.
- Suite ciblée Content Studio + social-publishing + UI/API: `28 passed`, `192 tests passed`.
- Typecheck complet: OK.
- Build Next.js: OK.

Warnings connus et non bloquants observés:

- Warnings React `act(...)` dans `IdeaForm.test.tsx`, préexistants.
- Warning webpack Handlebars `require.extensions`, préexistant.
- Dynamic server usage sur `/api/delivery-cities/search` et `/feed.xml`, préexistant.

### Limites restantes avant publication sociale complète

- Les migrations sont toujours préparées mais non appliquées par ce runbook.
- L'UI Content Studio n'affiche pas encore le panneau de publication directe.
- La publication réelle Postiz/Meta n'est pas encore branchée.
- Pas encore de MSW ni Playwright pour le parcours navigateur complet.
- Le retry existe côté route/service mais n'est couvert qu'indirectement par la state machine et le repository; ajouter un test route dédié avant la tranche UI.

Prochaine tranche: panneau UI `Publication` dans Content Studio branché sur ces routes dry-run, avec états publishable/non publishable, confirmation publier maintenant, programmation, timeline job et actions retry/cancel.

## 20. Exécution réelle — tranche 5 UI publication dry-run

Date d'exécution: 2026-05-19
Worktree: `/var/www/femiglow-leads-webhook-multi-step`

### Livré

- Panneau UI: `apps/web/src/components/admin/content-studio/SocialPublishingPanel.tsx`.
- Intégration dans le pipeline Content Studio après `DraftEditor`.
- Tests UI: `apps/web/src/components/admin/content-studio/SocialPublishingPanel.test.tsx`.

### Couverture fonctionnelle livrée

- Synchronisation des comptes dry-run depuis l'interface.
- Sélection du compte social compatible.
- Chargement de la publishability du post sélectionné.
- Affichage statut post, compte, état publiable/bloqué, caption et média public.
- Affichage des erreurs/warnings de publishability.
- Confirmation avant publication immédiate.
- Publication immédiate dry-run via API Femiglow.
- Programmation future via API Femiglow.
- Listing des jobs récents avec statut, tentatives, permalink et timeline courte.
- Actions UI retry/cancel branchées sur les routes existantes.
- Mise à jour locale du statut post après publication ou programmation.

### Validation exécutée

```bash
pnpm --dir apps/web exec vitest run src/components/admin/content-studio/SocialPublishingPanel.test.tsx
pnpm --dir apps/web exec vitest run src/lib/content-studio/state-machine.test.ts src/lib/content-studio/brand-rules.test.ts src/lib/content-studio/schemas.test.ts src/lib/content-studio/postiz.test.ts src/lib/content-studio/image-generation.test.ts src/lib/content-studio/auth.test.ts src/lib/content-studio/budget.test.ts src/lib/content-studio/idempotency.test.ts src/lib/content-studio/repository.test.ts src/lib/content-studio/automation.test.ts src/lib/social-publishing src/components/admin/content-studio src/app/api/admin/content-studio/ideas/route.test.ts src/app/api/admin/content-studio/posts/[id]/publish-now/route.test.ts
pnpm --dir apps/web typecheck
pnpm --dir apps/web build
```

Résultats:

- Vitest panneau UI: `1 passed`, `4 tests passed`.
- Suite ciblée Content Studio + social-publishing + UI/API: `29 passed`, `196 tests passed`.
- Typecheck complet: OK.
- Build Next.js: OK.

Warnings connus et non bloquants observés:

- Warnings React `act(...)` dans `IdeaForm.test.tsx`, préexistants.
- Warning webpack Handlebars `require.extensions`, préexistant.
- Dynamic server usage sur `/api/delivery-cities/search` et `/feed.xml`, préexistant.

### Limites restantes avant publication réelle

- Les migrations restent préparées mais non appliquées dans une vraie DB par ce runbook.
- Le panneau UI fonctionne sur dry-run uniquement.
- Postiz social-publishing et Meta Graph ne sont pas encore branchés.
- Pas encore de Playwright sur navigateur réel pour le parcours complet.
- Pas encore de MSW partagé pour scénarios provider 401/403/429/media invalid.

Prochaine tranche recommandée: appliquer les migrations dans l'environnement visé, vérifier `/admin/content-studio` en staging avec un vrai admin, puis ajouter Playwright/MSW sur le parcours dry-run avant d'activer Postiz ou Meta.

## 21. Exécution réelle — tranche 6 migration, smoke local et MSW providers

Date d'exécution: 2026-05-20
Worktree: `/var/www/femiglow-leads-webhook-multi-step`

### Livré

- Config Drizzle mise à jour pour inclure:
  - `./src/lib/db/schema-content-studio.ts`
  - `./src/lib/db/schema-social-publishing.ts`
- Journal Drizzle corrigé pour inclure:
  - `0055_ai_content_studio`
  - `0056_social_publishing`
- Migration `0054_inline_contact_webhook_events.sql` rendue compatible avec les DB où `chat_conversation_event.type` est stocké en `text` et non en enum Postgres.
- `CONTENT_STUDIO_ENABLED=true` ajouté dans `apps/web/.env` du worktree cible.
- Handlers MSW providers sociaux: `apps/web/src/test/msw/social-publishing-handlers.ts`.
- Tests handlers MSW: `apps/web/src/test/msw/social-publishing-handlers.test.ts`.

### Migrations appliquées

Commande:

```bash
pnpm --dir apps/web db:migrate-safe
```

Résultat:

- `0054_inline_contact_webhook_events`: appliquée.
- `0055_ai_content_studio`: appliquée.
- `0056_social_publishing`: appliquée.
- Plan final: `Applied: 65`, `Pending: 0`.

Tables vérifiées présentes:

- `content_campaign`
- `content_idea`
- `content_post`
- `social_account`
- `social_publish_job`
- `social_publication`

### Smoke HTTP local

Serveur lancé temporairement:

```bash
pnpm --dir apps/web exec next start -p 3037
```

Checks:

```bash
curl -I http://127.0.0.1:3037/admin/content-studio
curl -s http://127.0.0.1:3037/api/admin/social/accounts
curl -s http://127.0.0.1:3037/api/admin/content-studio/publish-jobs
```

Résultats:

- `/admin/content-studio`: `307` vers `/admin/login?next=%2Fadmin%2Fcontent-studio`, attendu sans session.
- `/api/admin/social/accounts`: réponse JSON `unauthorized`, attendu sans session.
- `/api/admin/content-studio/publish-jobs`: réponse JSON `unauthorized`, attendu sans session.

### Validation exécutée

```bash
pnpm --dir apps/web db:validate
pnpm --dir apps/web db:migrate-safe:plan
pnpm --dir apps/web exec vitest run src/test/msw/social-publishing-handlers.test.ts src/components/admin/content-studio/SocialPublishingPanel.test.tsx src/app/api/admin/content-studio/posts/[id]/publish-now/route.test.ts src/lib/social-publishing
pnpm --dir apps/web exec vitest run src/test/msw/social-publishing-handlers.test.ts src/lib/content-studio/state-machine.test.ts src/lib/content-studio/brand-rules.test.ts src/lib/content-studio/schemas.test.ts src/lib/content-studio/postiz.test.ts src/lib/content-studio/image-generation.test.ts src/lib/content-studio/auth.test.ts src/lib/content-studio/budget.test.ts src/lib/content-studio/idempotency.test.ts src/lib/content-studio/repository.test.ts src/lib/content-studio/automation.test.ts src/lib/social-publishing src/components/admin/content-studio src/app/api/admin/content-studio/ideas/route.test.ts src/app/api/admin/content-studio/posts/[id]/publish-now/route.test.ts
pnpm --dir apps/web typecheck
pnpm --dir apps/web build
```

Résultats:

- Migration validate: OK.
- Migration plan final: `Pending: 0`.
- Tables DB: présentes.
- MSW + UI/API dry-run ciblé: `9 passed`, `33 tests passed`.
- Suite ciblée Content Studio + social-publishing + MSW: `30 passed`, `200 tests passed`.
- Typecheck complet: OK.
- Build Next.js: OK.

Warnings connus et non bloquants observés:

- Warnings React `act(...)` dans `IdeaForm.test.tsx`, préexistants.
- Warning webpack Handlebars `require.extensions`, préexistant.
- Dynamic server usage sur `/api/delivery-cities/search` et `/feed.xml`, préexistant.

### Limites restantes

- Smoke HTTP réalisé sans session admin réelle; le comportement attendu sans session est confirmé.
- Pas encore de test Playwright authentifié sur un vrai navigateur admin.
- Pas encore d'adapter Postiz social-publishing ni Meta Graph branché au service.
- MSW est prêt pour simuler Meta/Postiz, mais pas encore consommé par un adapter réel.

Prochaine tranche recommandée: ajouter un test Playwright admin authentifié du panneau Publication dry-run, puis brancher l'adapter Postiz social-publishing derrière les handlers MSW avant Meta Graph réel.


## 22. Tranche exécutée - Playwright admin publication directe

### Correctif backend découvert

Le test réel a exposé un bug dans `upsertSocialAccount()` : l upsert était fait sur `(provider, remote_id)`, mais la relecture se faisait par le nouvel `id` généré. Quand un compte dry-run existait déjà, l API retournait donc un ID non persistant, puis `publishability` échouait avec `Compte social introuvable`.

Correction appliquée : après l upsert, la relecture se fait maintenant par `(provider, remote_id)`, ce qui retourne toujours la ligne réellement persistée.

### Test Playwright ajouté

Fichier : `apps/web/e2e/content-studio-social-publishing.spec.ts`

Couverture :

- authentification admin via `e2e/global.setup.ts`;
- seed DB isolé d un post Content Studio approuvé avec média HTTPS public;
- nettoyage des fixtures `*_pw_*` avant/après test;
- ouverture réelle de `/admin/content-studio`;
- vérification du panneau `Publication directe`;
- sélection du compte `Instagram dry-run`;
- vérification de l état `publiable`;
- clic `Publier maintenant`;
- vérification UI du statut `published`;
- vérification DB de `social_publish_job` et `social_publication`.

Commande de validation e2e :

```bash
pnpm --dir apps/web build
pnpm --dir apps/web exec next start -p 3038
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3038 pnpm --dir apps/web exec playwright test e2e/content-studio-social-publishing.spec.ts --project=chromium
```

Résultat :

- setup admin Playwright : OK;
- test Chromium publication directe dry-run : OK;
- total : `2 passed`.

### Validations relancées après correctif

```bash
pnpm --dir apps/web exec vitest run src/lib/social-publishing src/components/admin/content-studio/SocialPublishingPanel.test.tsx src/app/api/admin/content-studio/posts/[id]/publish-now/route.test.ts src/test/msw/social-publishing-handlers.test.ts
pnpm --dir apps/web typecheck
pnpm --dir apps/web build
```

Résultats :

- Vitest social-publishing/UI/API/MSW : `9 passed`, `33 tests passed`;
- Typecheck complet : OK;
- Build Next.js : OK;
- Playwright réel admin : `2 passed`.

### Limites restantes mises à jour

- Le flux dry-run est maintenant testé en navigateur réel authentifié.
- Les adapters Postiz social-publishing et Meta Graph restent à brancher derrière les contrats existants.
- Les handlers MSW Meta/Postiz existent, mais ne sont pas encore consommés par un adapter réel en production.
- La prochaine tranche robuste est l adapter Postiz social-publishing, puis Meta Graph avec feature flag, credentials chiffrés, et tests MSW provider-level.

