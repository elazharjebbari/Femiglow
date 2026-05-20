# Plan d'action — Suite publication directe (post `f4e6506`)

Date : 2026-05-20
Environnement : staging `/var/www/femiglow-staging`
Branche : `master`
Auteur : Codex
Référence : audit `docs/codex/audit-general-content-studio-2026-05-20.md` (section 12)

## 0. Contexte

Le commit `f4e6506` (2026-05-20) a posé les fondations du module `social-publishing` :
- 6 tables DB (migration `0062_social_publishing`).
- Domain layer complet (contrats, repository, service, state machine, retry, errors).
- Adapter `dry_run` opérationnel avec simulation de 9 codes d'erreur.
- 9 routes API admin.
- UI `SocialPublishingPanel` intégrée à `ContentStudioClient`.
- 9 fichiers tests vitest (33 tests) + 1 spec Playwright (2 tests).

Ce plan organise les **7 recommandations P1→P7** issues de l'audit en trois phases (A, B, C) et précise le scope exécutable maintenant (Phase A).

## 1. Objectifs

1. **Consolider** le pipeline `social-publishing` pour qu'il soit utilisable end-to-end en mode dry-run avec retry/cancel UI complet.
2. **Éliminer** la divergence d'état entre le state machine `content-studio` et celui de `social-publishing`.
3. **Préparer** l'arrivée des adapters réels (Postiz, Meta Graph) sans refactor douloureux.
4. **Documenter** la décision architecturale entre les deux pipelines de publication.

## 2. Principes non négociables

- Aucune publication réelle sans validation `dry_run` préalable.
- Aucun secret en clair en DB (pour les futurs tokens Meta).
- Idempotence par `idempotencyKey` sur toutes les actions publiantes.
- Toute action produit un audit log.
- Pas de bypass du state machine `content-studio` : les mutations de `content_post.status` doivent toujours passer par `assertTransition()`.
- Tests obligatoires : vitest + typecheck + build + smoke + Playwright avant tout commit.

## 3. Vue d'ensemble des phases

```
Phase A — Consolidation (cette session, ~1h)
  ├─ A.1 P7 : cohérence state machine content_post ↔ social_publish_job
  ├─ A.2 P5 : Postiz adapter scaffold (interface, non câblé en prod yet)
  ├─ A.3 P6 : UI retry/cancel dans SocialPublishingPanel
  └─ A.4    : validation vitest + typecheck + build + smoke + commit

Phase B — Activation (next session)
  ├─ B.1 P2 : Worker scheduling (cron pick queued + scheduled_at <= now)
  ├─ B.2    : Lock optimiste pour éviter doubles exécutions
  ├─ B.3    : Dispatcher d'adapter dans executeJob (provider-aware)
  └─ B.4    : Tests vitest worker + E2E scheduling

Phase C — Production (sessions suivantes, multi-PR)
  ├─ C.1 P3 : Chiffrement credentials (KMS ou env-based AES-GCM)
  ├─ C.2 P4 : Adapter meta_graph réel (OAuth + Graph API)
  ├─ C.3 P5 : Adapter postiz « consolidé » qui remplace le chemin legacy
  └─ C.4 P1 : Migration des données content_postiz_delivery → social_publish_job + dépréciation
```

---

## 4. Phase A — Consolidation (cette session)

### A.1 — P7 : Cohérence du state machine `content_post` ↔ `social_publish_job`

**Constat (audit N5)** : `lib/social-publishing/admin-service.ts:311` appelle `updatePostPlanning({ postId, status: 'failed' })` après un échec de publication. Cette mutation directe **bypasse** `assertTransition()` du state machine `content-studio`. Si le post est en `scheduled` ou `approved`, la transition vers `failed` n'est pas listée dans `state-machine.ts:8-15` (qui ne contient pas `failed` parmi les targets de `scheduled`).

**Décision** :
1. Ajouter explicitement `failed` aux transitions sortantes de `scheduled` et `publishing` (mais pas de `approved` directement — un post approuvé qui échoue doit d'abord avoir été `scheduled` ou en `publishing`).
2. Faire passer **toutes** les mutations de `content_post.status` par `assertTransition()`, y compris depuis `social-publishing/admin-service.ts`.
3. Tests vitest qui couvrent les nouvelles transitions et qui vérifient qu'on ne peut pas faire `approved → failed` directement.

**Critères d'acceptation** :
- `state-machine.test.ts` valide `scheduled → failed` et `published → measured` ; rejette `approved → failed`.
- `admin-service.ts` n'appelle plus `updatePostPlanning` avec un status interdit.
- 0 régression sur les tests vitest existants.

### A.2 — P5 : Postiz adapter scaffold

**Constat** : `executeDryRunJob` hardcode `dryRunAdapter`. Il faudra dispatcher selon `account.provider` quand on aura plusieurs adapters. Plutôt que de tout faire d'un coup, on pose le **scaffold** : un adapter `postiz` qui implémente `SocialPublishingAdapter` en réutilisant le client `lib/content-studio/postiz.ts` (déjà robuste avec retry + extractId). Il **n'est pas encore câblé** dans `executeDryRunJob` ; cette mise en service est faite en Phase B.

**Livrable** : `apps/web/src/lib/social-publishing/adapters/postiz.ts`
- Implémente `SocialPublishingAdapter` (`provider='postiz'`, `listCapabilities`, `publish`).
- `listCapabilities` : retourne les capabilities du provider Postiz (Instagram post/carousel/reel/story, Facebook post).
- `publish` :
  - Valide la request (mêmes règles que dry-run + spécificités Postiz : URL média HTTPS, format supporté).
  - Construit le payload via `buildPostizDraftPayload()` existant.
  - Upload média si présent via `uploadPostizMediaFromUrl()` existant.
  - Crée le draft via `createPostizDraft()` existant.
  - Mappe la réponse vers `SocialPublishProviderResponse` (avec `extractPostizPostId`).
  - Mappe les erreurs Postiz vers les 9 codes normalisés (`token_expired`, `provider_unavailable`, etc.).
- Tests vitest : capabilities, mapping erreur, succès simulé via MSW.

**Critères d'acceptation** :
- `adapters/postiz.ts` exporte une classe `PostizSocialPublishingAdapter`.
- 1 fichier test minimum couvrant : capabilities listing, success path mock, 3 error mappings.
- L'adapter n'est **pas** utilisé en production : `executeDryRunJob` continue d'utiliser `dryRunAdapter`.
- L'adapter ne touche pas la table `content_postiz_delivery` (qui reste sur le chemin legacy).

### A.3 — P6 : UI retry/cancel dans `SocialPublishingPanel`

**Constat** : Les routes `POST /publish-jobs/[id]/retry` et `POST /publish-jobs/[id]/cancel` existent mais ne sont pas exposées dans le panneau (à vérifier dans le composant pour confirmer).

**Livrable** : modifications de `apps/web/src/components/admin/content-studio/SocialPublishingPanel.tsx`
- Si chaque job listé n'a pas déjà des boutons retry/cancel : les ajouter.
- Bouton **Retry** visible uniquement pour status `failed`. Confirmation implicite (clic = action).
- Bouton **Annuler** visible pour status `queued` ou `failed`. Confirmation via dialog.
- Refresh de la liste après action.
- Tests UI vitest dans `SocialPublishingPanel.test.tsx`.

**Critères d'acceptation** :
- Bouton Retry rend uniquement pour `status='failed'` et appelle `POST /publish-jobs/[id]/retry`.
- Bouton Cancel rend uniquement pour `status in ('queued', 'failed')` et appelle `POST /publish-jobs/[id]/cancel` après confirmation.
- Test composant qui simule retry et cancel via MSW.
- Pas de régression sur les tests existants `SocialPublishingPanel.test.tsx`.

### A.4 — Validation Phase A

**Étapes** (détail dans le runbook) :
1. `pnpm --dir apps/web exec vitest run` sur le scope ciblé (social-publishing + content-studio + components + msw).
2. `pnpm --dir apps/web typecheck`.
3. `pnpm --dir apps/web build`.
4. `systemctl restart femiglow-staging.service`.
5. Smoke HTTP `/admin/content-studio` et `/api/admin/social/accounts`.
6. Playwright `e2e/content-studio-social-publishing.spec.ts`.
7. Commit avec message structuré.

---

## 5. Phase B — Activation (next session)

### B.1 — P2 : Worker de scheduling

Nouveau cron `POST /api/cron/content-studio/social-publish-scheduler` :
- Pick `social_publish_job` avec `status='queued' AND scheduled_at <= now() AND locked_at IS NULL`.
- `UPDATE ... SET locked_at = now() RETURNING *` pour lock optimiste (single SQL).
- Pour chaque job pické : `executeJob(jobId, requestedBy)`.
- Borné à N jobs par tick (configurable, défaut 5).
- Authentification `Bearer ${CRON_SECRET}`.
- Tests vitest : pick + lock + execute + un job verrouillé est skip.

### B.2 — Dispatcher d'adapter

Renommer `executeDryRunJob` → `executeJob` et dispatcher selon `account.provider` :
```ts
const adapters: Record<SocialProviderId, SocialPublishingAdapter> = {
  dry_run: new DryRunSocialPublishingAdapter(),
  postiz: new PostizSocialPublishingAdapter(),
  meta_graph: undefined as any, // throws si appelé sans implementation
};
function adapterFor(provider: SocialProviderId): SocialPublishingAdapter {
  const a = adapters[provider];
  if (!a) throw new HttpError('not_implemented', `Provider ${provider} non disponible`);
  return a;
}
```

### B.3 — Lock optimiste dans `executeJob`

Aujourd'hui : `assertSocialPublishJobTransition(status → 'publishing')` puis `UPDATE`. Deux workers concurrents passent le check.
Cible : `UPDATE social_publish_job SET status='publishing', locked_at=now() WHERE id=? AND status IN ('queued', 'failed') AND locked_at IS NULL RETURNING *`. Si 0 row → un autre worker l'a déjà pris, retourner gracieusement.

### B.4 — Tests E2E scheduling

Playwright qui :
- Crée un post approved.
- Schedule à T+5s.
- Attend.
- Vérifie que le job passe à `published` après le cron tick.

---

## 6. Phase C — Production (multi-sessions, multi-PR)

### C.1 — P3 : Chiffrement credentials

**Décision attendue** : KMS managé (AWS KMS / Google KMS) ou chiffrement local (AES-256-GCM avec clé en variable d'env) ?
- Option A (recommandé long terme) : intégration KMS.
- Option B (rapide) : `lib/crypto/secrets.ts` avec `SOCIAL_CREDENTIAL_SECRET_KEY` (32 bytes). Acceptable en staging, doit être remplacé par KMS avant prod.

**Livrable** : `lib/social-publishing/credentials.ts` avec `storeCredential()`, `loadCredential()`, `rotateCredential()`.

### C.2 — P4 : Adapter `meta_graph`

- OAuth 2.0 flow pour Instagram Business + Facebook Pages (App Review nécessaire pour `instagram_content_publish`).
- 2 étapes Instagram (createMediaContainer puis publishMediaContainer).
- Gestion `permission_denied`, `token_expired`, `media_not_public`, `provider_rate_limited`.
- Tests contractuels opt-in (désactivés CI par défaut).

### C.3 — P5 (suite) : Adapter `postiz` consolidé

Une fois Postiz adapter scaffold (Phase A.2) prouvé en staging :
- Câbler dans `executeJob` via le dispatcher (Phase B.2).
- Migrer les tests d'usage de l'ancien chemin (`/posts/[id]/postiz-draft`) vers le nouveau.

### C.4 — P1 : Dépréciation `content_postiz_delivery`

**Plan de dépréciation** :
1. Annoncer la dépréciation : le nouveau chemin `social_publish_job` est officiel.
2. Pour chaque post approuvé futur, créer un `social_publish_job` au lieu d'un `content_postiz_delivery`.
3. Backfill optionnel : copier les `content_postiz_delivery` existants en `social_publish_job` + `social_publication`.
4. Retrait progressif : marquer les routes `posts/[id]/postiz-draft` comme `@deprecated`, garder en lecture pendant 1-2 cycles, puis suppression.
5. Communication : changelog interne + audit.

---

## 7. Mesures de réussite

| Niveau | KPI | Cible |
|---|---|---|
| Phase A | Tests vitest social-publishing + content-studio | 100% pass |
| Phase A | typecheck + build | OK |
| Phase A | Smoke `/admin/content-studio` | 200 ou 307 (login) |
| Phase A | Playwright social-publishing | 2/2 pass |
| Phase A | Régressions content-studio | 0 |
| Phase B | Cron worker pick + execute en < 1s par tick | OK |
| Phase B | Job `scheduled` passe à `published` automatiquement | < 60s après scheduled_at |
| Phase C | Token Meta chiffré au repos | OUI |
| Phase C | 0 occurence de `content_postiz_delivery` dans les nouveaux flows | OUI |

## 8. Risques et mitigations

| # | Risque | Mitigation |
|---|---|---|
| 1 | Régression du chemin Postiz legacy pendant Phase A | Pas de modification des routes `posts/[id]/postiz-draft` ; les tests existants doivent passer. |
| 2 | State machine plus permissif → bugs cachés | Tests explicites pour les transitions interdites. |
| 3 | Adapter Postiz scaffold non testable sans MSW | MSW handlers pour `POST /api/public/v1/upload` et `POST /api/public/v1/posts`. |
| 4 | UI retry/cancel mal-rendu | Tests vitest composant + Playwright. |
| 5 | Build Next échoue après modifs | Build pré-commit obligatoire. |

## 9. Hors scope explicite

- **Phase A** ne touche pas : routes existantes `content-studio/postiz-draft`, table `content_postiz_delivery`, cron jobs existants `import-status/import-performance`.
- **Phase B** ne touche pas : le frontend UI (juste un nouveau cron + dispatcher).
- **Phase C** seulement quand la décision architecturale (déprécation Postiz legacy) est validée par l'utilisateur.

## 10. Suite du document

Pour exécuter la Phase A, voir : `docs/ai-content-service/runbook-suite-publication-directe-2026-05-20.md`.
