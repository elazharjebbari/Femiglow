# Plan d'action — Publication directe depuis Femiglow

Date: 2026-05-19
Worktree obligatoire: `/var/www/femiglow-leads-webhook-multi-step`

## Objectif

Mettre en place un système robuste permettant de publier directement depuis l'interface Femiglow vers les réseaux sociaux, sans validation manuelle dans Postiz. Femiglow devient la source de vérité du cycle complet: génération IA, validation interne, programmation, publication, retry, audit et suivi.

## Principes non négociables

- Tout le travail se fait dans `/var/www/femiglow-leads-webhook-multi-step`.
- Aucune logique de publication directe ne doit être dispersée dans une route API isolée.
- Les secrets sociaux ne doivent jamais être exposés au frontend.
- La publication doit être idempotente: un double clic ou retry ne doit pas créer deux posts externes non maîtrisés.
- Toute action de publication doit produire un audit log.
- Postiz peut rester comme adaptateur/fallback, mais Femiglow doit posséder l'état métier.
- Le `dry_run` est obligatoire avant tout test réel Meta/Postiz.

## Architecture cible

### Backend

Créer un domaine dédié:

```txt
apps/web/src/lib/social-publishing/
  contracts.ts
  repository.ts
  service.ts
  state-machine.ts
  media.ts
  retry.ts
  errors.ts
  adapters/
    dry-run.ts
    meta-graph.ts
    postiz.ts
```

Responsabilités:

- `contracts.ts`: types publics, payloads, statuts, capacités provider.
- `repository.ts`: accès DB, jobs, attempts, publications.
- `service.ts`: orchestration métier et permissions.
- `state-machine.ts`: transitions autorisées.
- `media.ts`: résolution URL média publique, validation format/dimensions.
- `retry.ts`: politique de retry bornée.
- `adapters/*`: intégrations provider isolées.

### Data

Tables à prévoir via Drizzle:

- `social_accounts`: compte connecté, provider, platform, remote id, nom, statut.
- `social_credentials`: tokens chiffrés, scopes, expiration, refresh metadata.
- `social_publish_jobs`: demande de publication, post id, account id, statut, idempotency key.
- `social_publish_attempts`: requêtes/réponses provider, erreurs, compteurs.
- `social_publications`: remote id, permalink, date de publication, état provider.
- `social_publish_events`: timeline opérationnelle et audit métier.

Statuts recommandés:

```txt
draft -> approved -> queued -> publishing -> published
                                      -> failed
                                      -> cancelled
```

### Frontend / UI / UX

Dans l'admin Content Studio:

- Ajouter un panneau `Publication`.
- Afficher les comptes sociaux disponibles avec badges: actif, token expiré, permission manquante, format supporté/non supporté.
- Prévisualiser le rendu par plateforme: caption, hashtags, média, alt text, warnings longueur/format.
- Actions: `Publier maintenant`, `Programmer`, `Retry`, `Annuler`, `Envoyer via Postiz` comme fallback optionnel.
- Afficher une timeline: action admin, tentative provider, statut, remote id, lien externe, dernière erreur.

Design attendu:

- Interface dense, calme et opérationnelle.
- Pas de landing page, pas de hero.
- Boutons explicites avec confirmation pour publication immédiate.
- Erreurs actionnables, pas de messages génériques.
- Aucune surcharge visuelle: prioriser statut, compte, format, date, action.

## Plan de conception

### Étape 1 — Audit du worktree

- Confirmer l'état exact de `/var/www/femiglow-leads-webhook-multi-step`.
- Identifier si le module Content Studio est absent, partiel ou à porter depuis staging.
- Lister les routes admin existantes compatibles.
- Lister les composants UI admin réutilisables.

Livrable: note courte dans `docs/ai-content-service/audit-worktree-publication-directe.md`.

### Étape 2 — Contrats métier

- Définir les statuts et transitions.
- Définir les capacités provider: Instagram image post, Facebook image post, carrousel, story, reel.
- Définir les erreurs normalisées: `token_expired`, `permission_denied`, `media_not_public`, `provider_rate_limited`, `provider_unavailable`, `unsupported_format`.

Livrable: `contracts.ts` + tests Vitest.

### Étape 3 — Data model

- Ajouter les tables Drizzle.
- Ajouter les indexes nécessaires: idempotency key unique, job status, post id, account id, remote publication id.
- Prévoir la rétention des payloads provider et leur redaction.

Livrable: migration + repository + tests repository.

### Étape 4 — Adapter `dry_run`

- Simuler une publication réussie.
- Simuler erreurs token, média, permissions, rate limit.
- Générer un remote id déterministe.
- Servir de base pour MSW et Playwright.

Livrable: adapter + tests.

### Étape 5 — Orchestration service

- `publishNow`.
- `schedulePublish`.
- `retryPublishJob`.
- `cancelScheduledPublish`.
- `syncPublicationStatus`.
- Lock transactionnel par job.
- Audit log systématique.

Livrable: service + state machine + tests.

### Étape 6 — Routes API admin

Créer:

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

Sécurité:

- session admin obligatoire ;
- permission dédiée `content.publish` ;
- rate limit par admin et compte social ;
- validation Zod ;
- réponse sans secret.

### Étape 7 — UI admin

- Panneau publication dans la fiche post approuvé.
- Modale confirmation publication immédiate.
- Modale programmation.
- Timeline job/publication.
- Vue filtre des jobs: queued, publishing, published, failed, cancelled.

### Étape 8 — Adapter Meta Graph

Slice initiale:

1. Instagram image post.
2. Facebook page image post.

À gérer:

- token longue durée ;
- expiration ;
- scopes ;
- compte Instagram professionnel ;
- page Facebook associée ;
- média HTTPS public ;
- création container ;
- publication ;
- remote id/permalink ;
- erreurs Meta normalisées.

Ne pas démarrer par reels/stories/carrousels. Ces formats viennent après la preuve robuste du single image post.

### Étape 9 — Postiz fallback

- Garder `postiz` comme adaptateur compatible.
- Ne plus dépendre d'une validation manuelle Postiz.
- Stocker `postizPostId` comme remote id provider.
- Permettre le choix `Publier via Postiz` uniquement si le compte direct n'est pas prêt.

### Étape 10 — Observabilité

- Logs structurés.
- Audit events: `social.publish.requested`, `social.publish.succeeded`, `social.publish.failed`, `social.publish.retry_requested`, `social.publish.cancelled`.
- Dashboard admin minimal: jobs récents et erreurs.

## Plan de tests

### Vitest

```bash
pnpm --dir apps/web exec vitest run src/lib/social-publishing
pnpm --dir apps/web exec vitest run src/app/api/admin/content-studio
```

Couverture minimale:

- transitions state machine ;
- idempotency ;
- retry ;
- repository CRUD ;
- redaction des secrets ;
- mapping erreurs Meta/Postiz ;
- validation média publique ;
- refus publication sans permission admin ;
- refus format non supporté.

### MSW

Créer:

```txt
src/test/msw/social-publishing-handlers.ts
```

Scénarios:

- Meta container créé ;
- Meta publish OK ;
- 429 puis retry OK ;
- 401 token expiré ;
- 403 permission manquante ;
- 400 média invalide ;
- Postiz fallback OK ;
- Postiz fallback failure.

### Playwright

Créer:

```txt
apps/web/e2e/content-studio-social-publish.spec.ts
```

Scénarios:

- publier un post approuvé en `dry_run` ;
- voir le statut publié et remote id ;
- erreur token expiré visible et actionnable ;
- retry d'un job échoué ;
- programmation puis annulation ;
- absence de média bloque la publication image.

Commande:

```bash
pnpm --dir apps/web exec playwright test e2e/content-studio-social-publish.spec.ts
```

### Build et validation

```bash
pnpm --dir apps/web typecheck
pnpm --dir apps/web build
```

## Plan d'exécution recommandé

1. Audit et consolidation Content Studio dans le worktree cible.
2. Contrats `social-publishing` + state machine.
3. Data model + repository.
4. Adapter `dry_run`.
5. Service backend + routes admin.
6. UI publication en dry-run.
7. Tests Vitest + MSW + Playwright.
8. Adapter Postiz fallback.
9. Adapter Meta Graph single image.
10. Smoke staging en dry-run.
11. Smoke réel Meta uniquement après validation des tokens/scopes.

## Critères d'acceptation

- Le système fonctionne sans ouvrir Postiz.
- Un admin peut publier depuis Femiglow après validation interne.
- Un job publié stocke remote id, provider, compte, date, request/response redacted.
- Un échec est visible, compréhensible et réessayable.
- Les tests Vitest/MSW/Playwright couvrent les scénarios nominaux et erreurs.
- Le build passe.
- Le runbook permet à un autre agent d'exécuter le plan sans réinterpréter l'architecture.
