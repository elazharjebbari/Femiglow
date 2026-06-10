# 03 — Audit backend : services, machine à états, publication, génération, données

**Périmètre** (sur master `c55add4b`) : `apps/web/src/lib/content-studio/**`, `apps/web/src/lib/social-publishing/**`, les 36 routes `apps/web/src/app/api/admin/content-studio/**`, schémas drizzle, `lib/env.ts`. Chemins relatifs à `apps/web/src`.

## 1. Architecture générale

```
Idée ──generate──▶ Brief + 3 Drafts ──review/approve──▶ Post ──publish-now/schedule──▶ social_publish_job ──worker/adapter──▶ dry_run | Postiz
                     │ generate-visual                                                        │ events + attempts + publications
                     ▼                                                                        ▼
              content_asset_binding (role)                                          social_publication (unique provider+remoteId)
```

- **Deux pipelines de publication Postiz coexistent** (dette principale) : le legacy `createDraftInPostiz` + `content_postiz_delivery` (`content-studio/service.ts:475-603`, `automation.ts` 359 l., routes `postiz-draft` + jobs retry/import) et le v2 `social_publish_job` (`social-publishing/**`). Deux machines à états, deux retries, deux tables pour la même fonction. Sunset annoncé 2026-08-01 (header Deprecation sur la route legacy) mais `automation.ts` repose encore à 100 % sur le legacy.
- Repository « dual » : chaque fonction de `repository.ts` (1 159 l.) est écrite **deux fois** (branche drizzle + branche store mémoire). ~40 % du fichier est ce boilerplate.

## 2. Machine à états & intégrité

`content-studio/state-machine.ts:4-17` : matrice unique ideas/drafts/posts, `assertTransition` → `HttpError('invalid_state')` → 409. Jobs : `social-publishing/state-machine.ts` (queued→publishing→published/failed, failed→queued).

| Constat | Sévérité | Détail |
|---|---|---|
| `generateIdeaDrafts` : `assertTransition` appelé **après** l'appel OpenAI, la création du brief, des drafts et du run (`service.ts:96-158`, assert ligne 148) | Majeur | Régénérer une idée déjà `generated` : argent dépensé, puis **500** sur la contrainte unique `content_brief_idea_version_unique` (version figée à 1, `repository.ts:282`) avant même l'assert. Asserter en tête + versionner le brief. |
| Édition d'un draft approuvé : le patch est **persisté avant** le contrôle de transition (`service.ts:172-191` — write l.181, assert l.190) | Majeur | La route renvoie 409 mais la caption modifiée est déjà en base → un draft approuvé est altérable silencieusement. (Atténuation : le contenu publié est snapshotté dans le job au moment du publish.) |
| Pas de contrainte unique sur `content_post.draft_id` (index simple seulement, `schema-content-studio.ts:196`) + read-then-insert dans approve (`repository.ts:615-642`, garde `service.ts:392`) | Majeur | Double-clic « approuver » concurrent → deux posts pour le même draft. Ajouter un `uniqueIndex`. |
| Contournements testés et **bloqués** : variation d'un draft approuvé (409), re-review d'un approuvé (409) | ✔ | `service.ts:375,449` |

**Idempotence** (`content-studio/idempotency.ts`, table `content_idempotency_key`, TTL 24 h) : utilisée sur **une seule route** (POST /ideas). Sans idempotence : `ideas/[id]/generate` (l'opération la plus coûteuse — double-clic = double appel OpenAI), `drafts/[id]/generate-visual` (deux images facturées), `variation`, `postiz-draft` legacy. Le pipeline de publication a sa propre idempotence (voir §3). Mineur : la clé rejouée avec un body différent renvoie l'ancienne réponse sans signaler le conflit (pas de hash du body).

## 3. Publication : le solide et le dangereux

### Ce qui est solide (préserver)

- **Anti double-clic publish-now** : clé `content-studio:{postId}:{accountId}:now` + lookup + **index unique** `social_publish_job_idempotency_unique` (`schema-social-publishing.ts:85`) + verrou atomique `tryAcquirePublishJobLock` (`UPDATE … WHERE status IN … AND locked_at IS NULL … RETURNING`, `repository.ts:303-331`) + uniques `social_publication_job_unique` et `(provider, remoteId)`. Quadruple verrou, réellement sûr.
- Chaque adapter re-valide que le provider du compte correspond (`adapters/postiz.ts:324`, `adapters/dry-run.ts:110`) — pas de confusion d'adapter possible.

### Ce qui est dangereux

| Constat | Sévérité | Détail |
|---|---|---|
| **Annuler / replanifier ne touche pas les jobs** : `cancelScheduledPost` (`service.ts:418-423`) et `reschedulePost` (`:453-459`) ne modifient que `content_post` ; le `social_publish_job` queued avec son `scheduledAt` d'origine **reste exécutable** par le worker (`worker.ts:33`, `listScheduledJobsDue`) → publication réelle d'un post annulé en mode live. Replanifier via POST /schedule une 2e fois génère une clé différente (suffixe ISO de la date, `admin-service.ts:328`) → **2 jobs queued → double publication**. | **Bloquant** | Annuler les jobs queued du post dans cancel/reschedule + re-vérifier le statut du post dans `executeJob`. |
| **Pas de kill-switch global dry_run/live** : le mode est porté uniquement par le compte (`social_account.provider = dry_run\|postiz`). `defaultAccountForPlatform` (`admin-service.ts:554-563`) préfère dry_run **mais retombe sur `eligible[0]`** (potentiellement un compte Postiz réel) si le compte dry_run manque ou est désactivé. La variable `SOCIAL_PUBLISHING_MODE` n'existe pas sur master (uniquement sur la branche backup). | **Critique** | Env-flag vérifié dans `adapterFor`/`executeJob` ; ne jamais retomber implicitement sur un compte non-dry_run. |
| `executeJob` publie le **snapshot figé à la création du job** (`locked.content`) sans re-vérifier publishability/statut du draft à l'exécution | Majeur | Contenu édité/rejeté entre-temps = publication de contenu périmé. |
| **Verrou sans expiration ni reaper** : crash entre lock et update final, ou erreur tardive (cas réel : post annulé → `assertTransition cancelled→published` lève **après** `createPublication`, `repository.ts:700` via `admin-service.ts:455-471`) → job bloqué `publishing` avec `lockedAt` posé **pour toujours** (le lock exige `locked_at IS NULL`). Irréparable depuis l'UI. | Majeur | Reaper (lock TTL) + ordre des écritures. |
| Course read-then-insert dans `createPublishJob` (`repository.ts:226-254`) rattrapée par l'index unique mais se manifeste en **500** au lieu d'une réponse idempotente/409 | Mineur | Catch de la violation d'unicité → renvoyer le job existant. |

### Scheduler : jamais branché (BUG-003, ouvert depuis l'audit du 29/05)

La route `api/cron/content-studio/social-publish-scheduler` existe mais **aucun cron ne l'appelle** (déploiement self-hosted PM2 : `vercel.json` n'est pas honoré ; le `/tick` général ne la relaie pas ; aucun timer systemd/crontab). La publication programmée **n'a jamais fonctionné sur aucune lignée**. De plus le GET accepte le header **`x-vercel-cron: 1` comme bypass d'auth** (`social-publish-scheduler/route.ts:60-62`) — spoofable hors Vercel (voir `06-securite.md`).

## 4. Génération (texte, image) — mode mock/live

- **Texte** (`generation.ts:32-34`) : live si `CONTENT_STUDIO_OPENAI_API_KEY ?? CHAT_OPENAI_API_KEY` présent, sinon **fallback déterministe silencieux** (templates, provider `'fallback'`, errorMessage tracé dans le run — consultable via `/generation-runs`). Erreur OpenAI (4xx/5xx/JSON malformé) → fallback aussi. Pas de crash, mais pas de signal opérateur non plus. Pas de timeout dédié sur le fetch.
- **Image** (`image-generation.ts:22-57`) : provider via `CONTENT_STUDIO_IMAGE_PROVIDER` (défaut `mock`). **Majeur** : en live, clé manquante ou erreur OpenAI lève un **`Error` brut** → masqué en **500 « Erreur interne »** ; l'opérateur ne distingue jamais clé absente / quota / prompt refusé, et **aucun `generation_run` failed n'est enregistré** (le run n'est écrit qu'après succès, `service.ts:302`). C'est le BUG-001 de l'audit gelé : corrigé sur la branche backup (`provider-credentials.ts`, commit `83e55146`), **toujours présent sur master**. Rappel : une clé `OPENAI_API_KEY` valide existe dans l'environnement mais master ne la lit pas pour ce flux (split env-var).
- Le `health` ne dit pas si le provider live est opérationnel (pas de check de clé).

## 5. Robustesse des données

| Constat | Sévérité | Détail |
|---|---|---|
| **Aucune transaction DB dans tout le périmètre** (grep `transaction|.tx(` négatif) | **Critique** | `generateIdeaDrafts` = 6+ écritures (brief, N drafts, run, reviews, statut) ; `approveDraft` = insert post + update draft ; `executeJob` = attempt + publication + post + job ; `upsertPrimaryAsset` = **delete puis insert** (`repository.ts:459-462`) — un crash entre les deux laisse le draft sans visuel. Envelopper dans `drizzle.transaction()`. |
| Bug SQL : `listPosts(scheduledAfter)` pousse un `desc()` (ORDER BY) **dans le WHERE** (`repository.ts:669`) ; `scheduledBefore` ignoré en branche drizzle | Majeur | Les filtres de date ne marchent qu'en mode mémoire. |
| `listPrimaryAssetsForDrafts` charge **toutes** les bindings puis filtre en JS (pas de `inArray`, `repository.ts:506-511`) ; `listContentStudioMedia` plafonné à 100 puis re-filtré → médias IA au-delà des 100 derniers invisibles dans le picker | Mineur | Pagination/`inArray`. |
| Soft-delete par statut partout (`archived`, `cancelled`), FKs en cascade sur les tables enfants | ✔ | `schema-content-studio.ts:182-183` |
| Fallback store mémoire par process dans tous les repositories : sans `DATABASE_URL`, multi-worker = états divergents | Mineur | Acceptable en dev uniquement. |

## 6. Budget / coûts

`budget.ts:14-25` : `checkDailyBudget(estimé)` → 429 `budget_exceeded` si dépassement de `CONTENT_STUDIO_DAILY_GENERATION_BUDGET_CENTS` (défaut 500¢). **Appliqué avant la dépense** (texte `service.ts:101`, visuel `:265-266`). ✔

- Mineur : `getDailySpentCents` charge les 1 000 derniers runs et filtre en JS → sous-comptage au-delà ; préférer un `SUM` SQL.
- Mineur : estimations désalignées du coût réel enregistré (visuel high estimé 8¢, coût réel 22¢ pour un modèle non-mini, `image-generation.ts:109`) → dépassement possible ×3 sur la dernière génération.
- Mineur : les échecs de génération image ne sont ni comptés ni tracés (pas de run failed) → les boucles de retry après échec ne sont pas freinées.

## 7. Validation d'entrée

`schemas.ts` (150 l.) : zod `.strict()` avec bornes sur tous les payloads métier ; routes publish/schedule/automation avec zod inline. **Aucune route n'accepte de JSON non validé.** ✔

- Mineur : `postRescheduleSchema.scheduledAt` = `z.string().min(1)` sans `.datetime()` ni contrôle « date future » (contrairement à `scheduleContentPost`, `admin-service.ts:321-323`) → replanification dans le passé possible.
- Mineur : `learningNoteSchema.postId` non vérifié → FK violation = 500 au lieu de 404.
- Mineur : `media/route.ts:14-20` et `generation-runs` parsent les query params à la main (bornés/whitelistés, pas de risque, incohérence de style).

## 8. Double pipeline & maintenabilité

- Tailles : `repository.ts` 1 159 l., `service.ts` 651, `admin-service.ts` 606. Zéro TODO/FIXME. ~20 fichiers de tests colocalisés.
- Code quasi-mort : `meta_graph: null` dans la table d'adapters, `promptOverride` déclaré dans `draftVariationSchema` mais ignoré, duplication `absoluteUrl`/`pickPostizMediaUrl` entre `service.ts:617-628` et `admin-service.ts:592-602`.
- v1/v2 côté app : `app/admin/content-studio`, `content-studio-legacy`, `content-studio-v2` coexistent. La vraie dette est le double pipeline Postiz (§1).
