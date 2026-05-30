# Plan d'action priorisé — pipeline génération + publication

> FemiGlow Content Studio v2 / AI Engine. Baseline figée **2026-05-29**, branche `feat/ai-engine-langgraph-mvp`.
> Source de vérité (cf. `01_audit/01_methodology.md` §1) : **le comportement réel de l'application exercée par l'opérateur, PAS le rapport de la suite de tests.**
> Chaque tâche est tracée à un ou plusieurs findings confirmés (`BUG-xxx`, `MISS-xxx`) du registre Phase 1 (`01_audit/bug-register.csv`, `_consolidated.json`, `missed-issues.csv`) et porte un **critère de fin MESURABLE** — jamais « fait », toujours « prouvé en exerçant tel chemin opérateur, en mock ET en live quand c'est possible ».

---

## 0. Principe d'ordonnancement

Le constat de l'audit est qu'on ne peut **pas faire confiance au signal de vérification actuel** : 1695 tests « passed » alors que le process sort en `EXIT 1` (BUG-010), 2 E2E rouges sur le seul parcours opérateur (BUG-023/029/042), un picker qui annonce « Live » des modèles non générables (BUG-006/007/024), une publication programmée qui accuse réception sans jamais s'exécuter (BUG-003). **Tant que la vérité n'est pas rétablie, corriger un blocker peut régresser sans alerte, et l'on ne saura pas distinguer un vrai correctif d'un faux succès.**

L'ordonnancement est donc le suivant, et il est **non négociable** :

1. **P0 — Sécurité-vérité d'abord.** Rendre le gate honnête (exit-1, smoke opérateur vert, harnais de parité mock/live), débloquer la config OpenAU live (correctif bon marché), et fermer les contournements de garde-fou de publication. *Sans cette couche, aucune correction ultérieure n'est vérifiable.*
2. **P1 — Les 4 blockers.** Génération image live (BUG-001), génération vidéo live (BUG-002), publication programmée (BUG-003), bridge média A→B inatteignable (BUG-004). Chacun n'est « fini » que prouvé bout-en-bout par un chemin opérateur.
3. **P2 — Criticals.** Texte figé en template, picker mensonger, desync clé, double-publication latente.
4. **P3 — Majors.** Synchronisation d'état de publication, variation de draft, fallbacks audibles, hygiène stockage, mismatch d'enum, legacy Postiz.
5. **P4 — Dette / minors / info.** Caches process, couplage cwd, taxonomies, qualité du fallback texte, contrôle d'accès `/_media`.

> **Garde-fou de séquencement critique** : BUG-003 (brancher le scheduler) **ne doit pas être activé en production avant** la correction de F8/F9 (désync content_post↔job + déduplication d'idempotence, tâches T-301/T-302), sous peine de transformer un blocker inerte en **incident `critical` à impact client** (doubles publications, publication d'un post annulé). Le scheduler peut être branché et **testé en mock/staging** avant, mais son activation live est gardée par ces tâches.

---

## Chemin critique (résumé visuel)

```
T-001 (gate exit-1)  ─┐
T-002 (drain timers) ─┼─► T-010 (smoke opérateur CI, mock) ─► [filet de vérité actif]
T-003 (fix 2 E2E)    ─┘                                         │
T-005 (env.ts OPENAI_API_KEY + resolveApiKey unifié) ──────────┼─► T-101 (image live)  ─┐
                                                                │   T-201 (texte live)  ─┤
T-006 (MSW global + contract tests providers) ──────────────────┘                       ├─► [génération live prouvée]
T-103 (Higgsfield async submit+poll) ──────────────────────────────────────────────────┘
T-301/302 (sync job + dédup idempotence) ─► T-103b (brancher scheduler) ─► [publication asynchrone fiable]
T-401 (remonter composition/exports dans buildResult) ─► T-402 (bridge média) ─► T-403 (compose réel) ─► [montage atteignable]
```

Le **chemin critique** est : `T-005 → T-101 → (T-006, T-103) → activation live` pour la génération, et `T-301/302 → T-103b` pour la publication. La fondation de tout est `T-001/002/003/006/010` (la couche de vérité), qui **conditionne la vérifiabilité de toutes les autres tâches**.

---

## LOT P0 — Sécurité & vérité (débloquer la vérification avant toute correction)

> Objectif : un signal de vérification auquel on peut se fier. À la fin de ce lot, un correctif faux ne peut plus passer pour un succès, et la génération OpenAI live devient réellement exerçable.

### T-001 — Faire échouer la CI sur le code de sortie, pas sur la ligne de résumé
- **Findings** : BUG-010, BUG-027, BUG-032.
- **Action** : garantir que le step `Tests vitest` (`pnpm -r test`) et la collecte E2E propagent le code retour ; interdire tout `dangerouslyIgnoreUnhandledErrors` ; ajouter un `process.on('unhandledRejection', () => process.exitCode = 1)` au harnais.
- **Critère de fin mesurable** : sur la baseline figée, `pnpm exec vitest run … ; echo $?` renvoie **1** ET la CI passe au rouge (révèle BUG-010) AVANT toute autre correction. Une fois T-002 appliqué, le même run renvoie **0**.
- **Effort** : S. **Dépendances** : aucune.

### T-002 — Réparer la fuite fake-timer + filet global de drain de timers
- **Findings** : BUG-010, BUG-027, BUG-032.
- **Action** : dans `video-generation.test.ts` (« polling status=failed », l. 198-224), `await`/drainer la promesse de poll avant `useRealTimers()`. Ajouter dans `vitest.setup.ts` un `afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); })` global.
- **Critère de fin mesurable** : `pnpm exec vitest run src/lib/content-studio/video-generation.test.ts ; echo $?` = **0**, ligne `Errors 0`, et la suite complète repasse `EXIT 0` (vérifié par re-run, pas par le seul JSON).
- **Effort** : S. **Dépendances** : T-001 (le gate doit d'abord révéler le rouge).

### T-003 — Corriger les 2 E2E du parcours opérateur réel
- **Findings** : BUG-023, BUG-029, BUG-042, BUG-055, BUG-064.
- **Action** : corriger le sélecteur de `create-mock-video.spec.ts:8` (`Générer une vidéo IA` conditionnel au kind) ; corriger le nom de table `audit_event` → `audit_events` dans `content-studio-social-publishing-draft.spec.ts:207,227` ; brancher ces E2E sur une DB de test au schéma Drizzle réel.
- **Critère de fin mesurable** : `PLAYWRIGHT_EXIT=0` sur le parcours create→generate→publish-draft (mock), prouvé par `evidence`-équivalent rejoué (les 2 specs passent contre la vraie DB ; `to_regclass('audit_events')` non null assertée par le seed).
- **Effort** : S. **Dépendances** : aucune.

### T-005 — Source de vérité unique pour la résolution de clés + déblocage OpenAI live (flux create)
- **Findings** : BUG-001 (partie OpenAI), BUG-005, BUG-006, BUG-007, MISS-003, MISS-007, MISS-013.
- **Action** : déclarer `OPENAI_API_KEY` dans `src/lib/env.ts` (schéma + mapping). Faire que le flux create (`image-generation.ts`, `generation.ts`) **réutilise `resolveApiKey('openai')`** (même chaîne que la discovery du picker) au lieu de lire `env.CONTENT_STUDIO_OPENAI_API_KEY` brut. Remplacer le `??` de `generation.ts:70` par une neutralisation de chaîne vide (`if (val)`). *(Correctif bon marché : la clé valide `sk-…` len 164 est déjà dans le process.)*
- **Critère de fin mesurable** : depuis `/admin/content-studio-v2/create` en mode **Live**, « Générer un visuel IA » (modèle `gpt-image-1-mini`) produit un asset réel servi en **HTTP 200** avec un `generation_run provider=openai status=succeeded cost>0` ; ET en **mock** le même chemin produit toujours l'asset SVG/PNG. Prouvé par probe opérateur authentifiée dans les deux modes.
- **Effort** : M. **Dépendances** : T-001/T-002 (filet de vérité), T-006 souhaité pour la couverture mais non bloquant.

### T-006 — Harnais de parité MOCK/LIVE : MSW global + contract-tests fournisseurs
- **Findings** : BUG-041, BUG-045, BUG-046, BUG-037, MISS-008, MISS-009, BUG-011, BUG-018.
- **Action** : monter `setupServer` MSW dans `vitest.setup.ts` avec politique `onUnhandledRequest:'error'`. Écrire des contract-tests calqués sur l'OpenAPI/spec **réelle** des fournisseurs : OpenAI (images/chat), Higgsfield `platform.higgsfield.ai` (async `/v1/image2video/<model>` + poll `/v1/requests/{id}/status`, auth `Key KEY_ID:KEY_SECRET` — cf. mémoire higgsfield-api-mismatch), Postiz (`/api/public/v1/integrations`, `/posts`, upload). Ajouter un test de parité dry_run↔PostizAdapter sur le **même contrat** (shape de permalien, statuts, codes d'erreur). Couvrir le chemin LLM réel des nœuds (`generate-script/caption/variants`) avec un mock LLM qui **réussit** (pas seulement en rejet).
- **Critère de fin mesurable** : un test devient **rouge** si le code appelle un endpoint synchrone faux (`/v1/videos/generate`) au lieu du contrat async réel ; tout `fetch` non déclaré dans MSW fait échouer le test ; au moins 1 test de parité dry_run↔live partage les mêmes assertions de contrat et passe à l'identique.
- **Effort** : L. **Dépendances** : T-001/T-002.

### T-010 — Smoke-test « parcours opérateur » en CI (mock), assertant l'effet backend
- **Findings** : BUG-047, BUG-046 (contexte P6/P11 process), BUG-005, BUG-001.
- **Action** : smoke exécuté à chaque PR, en mode mock, réutilisant la session Playwright officielle, couvrant `idea → variants → generate-visual → approve → publish-draft (dry_run)` et **assertant l'effet backend** (asset servi 200, `generation_run` créé, `social_publish_job` daté, statut transité). Câbler dans `ci.yml` et **inclure `src/lib/ai-engine/**`** dans le périmètre vitest.
- **Critère de fin mesurable** : la CI exécute ce smoke à chaque PR ; il **échoue** si l'asset n'est pas servi 200 ou si le job n'est pas créé ; il passe vert sur la baseline corrigée. Couverture vitest inclut désormais les 16 nœuds AI-Engine.
- **Effort** : M. **Dépendances** : T-003, T-005, T-006.

### T-020 — Sécuriser/supprimer le contournement legacy `/postiz-draft`
- **Findings** : BUG-040 (F11).
- **Action** : renvoyer `410 Gone` sur `/api/admin/content-studio/posts/[id]/postiz-draft`, OU router `createDraftInPostiz` via `resolveDefaultAccount` + respect strict de `SOCIAL_PUBLISHING_MODE`.
- **Critère de fin mesurable** : un POST sur `/postiz-draft` en staging (dry_run) **ne crée aucun draft sur l'instance Postiz réelle** (vérifié read-only via `GET integrations` : aucun nouveau draft) — soit 410, soit dry_run honoré.
- **Effort** : S. **Dépendances** : aucune.

### T-021 — Contrôle d'accès sur les médias générés `/_media`
- **Findings** : MISS-010.
- **Action** : exiger une session/jeton pour servir `.media-storage/ai-engine/*` (sous-titres, composés, exports) pouvant contenir du contenu client non publié.
- **Critère de fin mesurable** : `curl` SANS cookie sur un `/_media/ai-engine/subtitles-*.srt` renvoie **401/403** ; avec cookie admin → 200. Prouvé par probe.
- **Effort** : M. **Dépendances** : aucune.

---

## LOT P1 — Les 4 blockers

> Chaque blocker n'est « fini » que **prouvé bout-en-bout depuis le flux opérateur réel** (`/admin/content-studio-v2/create`), pas via `/api/admin/ai-engine/generate` ni un test vert.

### T-101 — Génération image LIVE depuis le flux create (OpenAI)
- **Findings** : **BUG-001** (blocker), BUG-006, BUG-007, BUG-028.
- **Action** : conséquence directe de T-005 pour OpenAI. Aligner le routing de `image-generation.ts` pour reconnaître les modèles servis par le picker ; refuser proprement (message métier) les modèles non routables au lieu de retomber sur OpenAI clé vide.
- **Critère de fin mesurable** : en Live, générer un visuel avec `gpt-image-1-mini` ET `dall-e-3` produit un asset servi 200 + `generation_run provider=openai succeeded` ; un modèle non routable renvoie un `409` au message explicite (pas « CONTENT_STUDIO_OPENAI_API_KEY manquant »). En mock, inchangé. Prouvé dans les deux modes.
- **Effort** : M. **Dépendances** : T-005.

### T-102 — Génération image/vidéo Higgsfield LIVE : credential complet + auth conforme
- **Findings** : **BUG-001** (partie Higgsfield), **BUG-002** (blocker), BUG-008, BUG-025, MISS-009.
- **Action** : fournir le credential à deux parties (`AI_ENGINE_HIGGSFIELD_API_KEY=KEY_ID:KEY_SECRET` ou paire `_KEY`/`_SECRET`), faire que `higgsfieldAuthHeader()` produise `Authorization: Key KEY_ID:KEY_SECRET` (cf. mémoire higgsfield-api-mismatch), host `platform.higgsfield.ai`. Ajouter la validation au boot (cross-check `:` ou `_SECRET`).
- **Critère de fin mesurable** : `GET /api/admin/ai-engine/config/providers` → Higgsfield `configured:true` ; un appel d'auth read-only (sans génération destructive) renvoie 2xx ; au boot avec credential mono-partie → avertissement explicite + badge « non générable », pas un throw 409 au 1er clic. *(La génération live destructive n'est pas exécutée dans l'audit ; le critère porte sur l'auth et la config.)*
- **Effort** : M. **Dépendances** : T-005 (env.ts unifié), T-006 (contract test pour figer le contrat async).

### T-103 — Réécrire les endpoints Higgsfield en async submit+poll conformes
- **Findings** : **BUG-002**, BUG-008, BUG-025, BUG-009, MISS-009, MISS-022. Lié F20 (polling synchrone dans le handler).
- **Action** : remplacer les endpoints synchrones faux (`/v1/videos/generate`, `/v1/images/generate`) par le pattern réel async (submit `/v1/image2video/<model>` ou `/v1/text2image/<model>` + poll `/v1/requests/{id}/status`). Mapper les IDs natifs du catalogue (veo3_1, kling3_0…) vers le routeur de génération (router par `provider==='higgsfield'`, pas `startsWith('hf-')`). Sortir le polling 5 min du handler (job de poll resumable ou borne au timeout runtime réel).
- **Critère de fin mesurable** : un contract-test (T-006) **échoue** si un endpoint synchrone est appelé ; un modèle vidéo live-découvert (veo3_1) sélectionné dans le picker est routé sans `invalid_state 'aucun modèle vidéo live disponible'` ; le handler ne bloque plus 5 min de façon synchrone (vérifié par test de timeout). En mock, inchangé.
- **Effort** : L. **Dépendances** : T-102, T-006.

### T-103b — Brancher le scheduler de publication programmée
- **Findings** : **BUG-003** (blocker, F1).
- **Action** : appeler `runScheduledPublishJobs({ limit })` depuis `/api/cron/tick/route.ts` (déjà déclenché chaque minute par `femiglow-staging-cron-tick.service`), OU créer un systemd timer/crontab POSTant `/api/cron/content-studio/social-publish-scheduler` avec `Bearer CRON_SECRET`. Ajouter aussi l'entrée à `vercel.json` pour un futur déploiement Vercel. Ajouter un contrôle CI « toute route `/api/cron/*` a un déclencheur sur la cible de déploiement effective ».
- **Critère de fin mesurable** : programmer un post à **T+2 min** en staging → à échéance il transite `queued → publishing → published` (dry_run), un `social_publish_job` daté apparaît, et `GET /publish-jobs?publishMode=schedule` montre **≥1** job exécuté (aujourd'hui : 0). Prouvé par probe.
- **Effort** : M. **Dépendances** : **T-301 ET T-302 doivent être faits AVANT l'activation live** (garde-fou doubles publications). Le branchement + test mock peut précéder.

### T-104 — Bridge média A→B : remonter composition/exports/thumbnails jusqu'à l'opérateur
- **Findings** : **BUG-004** (blocker), MISS-005, BUG-034, BUG-033.
- **Action** : étendre `GenerationResult` et `buildResult` (`orchestrator.ts:116-131`) pour propager `composition`, `exports`, `thumbnails` (aujourd'hui présents dans le finalState interne mais jamais remontés). Étendre le bridge `content-studio-bridge.ts` pour persister ces assets en table `media` (mapping `assetId` AI-Engine → row media). Rendre ces champs dans l'UI create.
- **Critère de fin mesurable** : un job AI-Engine (format reel) produit une composition ; après bridge, le draft créé **possède un asset média réel** (row `media`, fichier servi 200) visible dans la bibliothèque ; l'UI rend la composition/exports (pas seulement images/videos). Vérifié en mock ; en live dépend de T-101/T-103. *(Pré-requis structurel : MISS-005 — sans la remontée dans buildResult, le bridge lirait `undefined`.)*
- **Effort** : L. **Dépendances** : T-104 précède T-401/T-402/T-403 (cf. lot montage), s'appuie sur le filet T-006/T-010.

---

## LOT P2 — Criticals

### T-201 — Génération de texte opérateur réellement LLM (sortir du fallback figé)
- **Findings** : **BUG-005**, BUG-020, MISS-001, MISS-012, MISS-013.
- **Action** : `generation.ts` utilise `resolveApiKey('openai')` (suite de T-005) ; `ideas/[id]/generate/route.ts` **lit le cookie `cs_generation_mode`** ; en live sans clé → `throw invalid_state` explicite plutôt que dégrader silencieusement en template ; persister/honorer le `model` choisi dans le `generation_run`.
- **Critère de fin mesurable** : en Live, générer une idée produit des variantes avec `generation_run provider=openai model=<choisi> status=succeeded` ; en mock, fallback déterministe assumé ; le toggle mock/live **change réellement** le comportement (vérifié par comparaison des deux runs). MISS-001 fermé : le cookie a un effet sur le texte.
- **Effort** : M. **Dépendances** : T-005.

### T-202 — Aligner le picker sur la générabilité réelle (badges « Live » honnêtes)
- **Findings** : **BUG-006**, **BUG-007**, BUG-024, BUG-019, BUG-043, BUG-016, MISS-002, MISS-015, MISS-018, MISS-019.
- **Action** : `materialiseDiscoveredModel` **propage `r.source`** (`fallback`/`cache`/`live`) au lieu de forcer `live`. Ne badger « Live » qu'un modèle dont la clé est effectivement lue par le chemin de génération. Liste blanche de capacités par rôle (exclure whisper-1/STT, davinci/babbage/instruct de `role=chat` ; exclure modèles non routables de image/video). Désactiver `allowCustom` non validé (ou valider contre le registre). Ne plus auto-sélectionner un suggested live au montage sans action opérateur (MISS-002). Court-circuiter le fetch vers le host Higgsfield mort (MISS-019).
- **Critère de fin mesurable** : `GET /api/admin/content-studio/models?role=image` ne renvoie `source:'live'` **que** pour les modèles réellement générables ; un modèle Higgsfield issu du fallback porte `source:'fallback'` ; `role=chat` ne contient ni whisper-1 ni davinci-002 ; sélectionner un modèle badgé Live et générer **réussit** (ne throw plus). Prouvé par probe + smoke.
- **Effort** : M. **Dépendances** : T-005, T-101, T-201.

### T-203 — Mismatch d'enum `tone` (UI AI-Engine ↔ parse-brief)
- **Findings** : **BUG-014**.
- **Action** : aligner l'enum `tone` entre l'UI (`ai-engine/create/page.tsx` TONES), le DTO de la route (`generate/route.ts`) et `parse-brief.ts` ; valider le ton au DTO d'entrée.
- **Critère de fin mesurable** : POST `/api/admin/ai-engine/generate` avec chaque ton proposé par l'UI → `status` ≠ `failed`/`invalid_enum_value` ; un ton hors-liste est rejeté au DTO avec un message clair. Prouvé par probe sur tous les tons de l'UI.
- **Effort** : S. **Dépendances** : aucune.

### T-204 — Empêcher la double-publication (idempotence + publishability)
- **Findings** : **MISS-006**, MISS-028, F9 (fiabilité). *Garde-fou de T-103b.*
- **Action** : clé d'idempotence **indépendante du `scheduledAt`** (clé par post+compte, mutée en place). Avant tout `publish-now`/`schedule`, invalider/réutiliser le job `queued` existant du même post. `reschedule` mute le job existant au lieu d'en créer un second.
- **Critère de fin mesurable** : test explicite — publish-now sur un post ayant déjà un job programmé → **un seul** envoi (le job programmé est annulé/réutilisé) ; reschedule deux fois → **un seul** `social_publish_job queued`. Vérifié en mock avec scheduler actif.
- **Effort** : M. **Dépendances** : **précède l'activation live de T-103b**.

---

## LOT P3 — Majors

### T-301 — Synchroniser `content_post` ↔ `social_publish_job` sur cancel/reschedule
- **Findings** : **BUG-038**, F8 (fiabilité). *Garde-fou de T-103b.*
- **Action** : `cancelScheduledPost` → `cancelPublishJob` sur les jobs `queued` ; `reschedulePost` → muter le `scheduledAt` du job existant.
- **Critère de fin mesurable** : annuler un post programmé → le `social_publish_job` passe `cancelled` (vérifié `GET /publish-jobs`) ; avec scheduler actif (T-103b mock), un post annulé n'est **jamais** publié. Prouvé par probe.
- **Effort** : M. **Dépendances** : **précède l'activation live de T-103b**.

### T-302 — Retry automatique des jobs `failed` retryables
- **Findings** : F7 (fiabilité), BUG-038 (contexte). S'appuie sur `retry.ts` existant.
- **Action** : le worker ramasse les jobs `failed AND lastError.retryable=true` avec backoff borné par un compteur de tentatives, puis `failed` terminal après N essais. Surfacer `lastError` dans l'UI.
- **Critère de fin mesurable** : un job mis en échec transitoire (5xx simulé en mock) est repris automatiquement et finit `published` ; après N échecs il reste `failed` avec `lastError` visible dans l'UI. Prouvé en mock.
- **Effort** : M. **Dépendances** : T-103b (scheduler tournant).

### T-303 — Imposer la sélection explicite de compte Postiz en live
- **Findings** : **BUG-039**, F10.
- **Action** : l'UI publish envoie un `accountId` explicite ; en live + plusieurs comptes + pas de pin → `invalid_state` (ne jamais deviner le compte client via `resolveDefaultAccount`).
- **Critère de fin mesurable** : publier sans `accountId` en live avec >1 compte → `409 invalid_state` ; avec `accountId` → publication ciblée. Vérifié en dry_run (statut/permalink dédiés au compte choisi).
- **Effort** : M. **Dépendances** : aucune (mais pertinent avant activation live de la publication).

### T-304 — Rendre les fallbacks audibles (jamais de faux succès silencieux)
- **Findings** : MISS-020, MISS-026, BUG-022, BUG-049, BUG-050, MISS-011, MISS-021, F13.
- **Action** : marquer tout asset/job dégradé d'un flag `degraded` + raison ; les nodes média poussent dans `state.errors` en cas d'échec (MISS-011) ; ne jamais servir une image 404 / un export passthrough comme un succès ; `CreateWorkspace.onCreated` ajoute une branche `else`/`catch` non vide (toast + retry, BUG-022) ; garde sur `<video src=''>` (MISS-021).
- **Critère de fin mesurable** : un échec de génération de variantes affiche un **toast d'erreur** à l'opérateur (plus de catch vide) ; un job avec média manquant n'est **plus** `completed quality 0.91` mais `failed`/`degraded` avec raison ; aucun `<video src=''>` rendu. Prouvé par probe d'erreur provoquée en mock.
- **Effort** : M. **Dépendances** : T-104 (pour les nodes média atteignables), T-010.

### T-305 — Variation de draft : régénérer réellement le texte
- **Findings** : **BUG-017**.
- **Action** : `createDraftVariation` consomme `promptOverride` et régénère caption/hook via le moteur (T-201) au lieu de cloner le parent.
- **Critère de fin mesurable** : POST `/drafts/<id>/variation {promptOverride:'change le hook'}` → caption/hook **différents** du parent ; en mock, variation déterministe distincte. Prouvé par probe (comparaison parent/variante).
- **Effort** : S. **Dépendances** : T-201.

### T-306 — Isoler le stockage des tests + purger les stubs de prod
- **Findings** : **BUG-031**, MISS-004, MISS-024, MISS-032, BUG-035.
- **Action** : injecter `MEDIA_DIR` via env (absolu, propre par environnement), supprimer le chemin relatif `../../.media-storage` des tests (`tmpdir` isolé) ; auditer la table `media` pour références orphelines (<100 octets) ; purger les ~977 stubs `mock-image`.
- **Critère de fin mesurable** : `pnpm vitest run` n'écrit **aucun** fichier dans `.media-storage/ai-engine` runtime ; `find .media-storage/ai-engine -size -100c | wc -l` = 0 après purge ; aucune row `media` ne pointe vers un fichier <100 octets (requête SQL vérifiée). Prouvé.
- **Effort** : M. **Dépendances** : aucune.

### T-307 — Tests d'intégration média réels (ffmpeg/sharp installés)
- **Findings** : **BUG-035**, BUG-036, MISS-025, MISS-026, MISS-027.
- **Action** : tests compose/transcode écrivant dans un `tmpdir`, assertant des **octets JPEG/MP4 valides** (ffmpeg/sharp réels) ; vérifier l'incrustation/mux des sous-titres (BUG-036) ; le chemin sans audio ne doit pas être un no-op de copie binaire (MISS-025) ; borner pixels/résolution en entrée (MISS-027).
- **Critère de fin mesurable** : un test compose produit un MP4 dont `ffprobe` confirme la durée/codec ET une piste sous-titre quand un SRT est fourni ; aucun artefact de 10-14 octets. Prouvé par `ffprobe`/`file`.
- **Effort** : L. **Dépendances** : T-306 (isolation stockage), T-104 (atteignabilité).

### T-308 — dry_run honnête : permaliens/metadata dérivés du mode résolu
- **Findings** : BUG-045, BUG-065, MISS-029, F12.
- **Action** : dériver `metadata.dryRun` du mode réellement résolu (pas codé en dur) ; confronter dry_run et Postiz au **même contrat** de permalien (T-006) ; recalculer/persister les capabilities pour éviter le stale (MISS-029).
- **Critère de fin mesurable** : un post dry_run porte `metadata.dryRun=true`, un live porterait `false` (vérifié sur le code + test de parité) ; `/publishability` ne renvoie plus de capabilities stale incohérentes (account dit ne pas supporter reel mais publishable=true). Prouvé par probe + contract test.
- **Effort** : M. **Dépendances** : T-006.

### T-309 — Re-génération d'une idée `generated` : erreur métier propre
- **Findings** : **BUG-051**.
- **Action** : mapper la transition `generated → generated` en `409` métier (HttpError reconnu par le handler) au lieu d'un 500 opaque.
- **Critère de fin mesurable** : re-POST `/ideas/<id>/generate` sur une idée déjà `generated` → **409** au message clair, pas 500. Prouvé par probe.
- **Effort** : S. **Dépendances** : aucune.

---

## LOT P4 — Dette, minors, info

### T-401 — (déjà tracé dans T-104 comme MISS-005) Remontée structurelle composition/exports
> Tracé dans T-104 ; conservé ici comme rappel : sans la remontée dans `buildResult`, T-402/T-403 sont sans effet. **Voir T-104.**

### T-402 — Bridge média : persistance complète des assets composés
> Tracé dans T-104 (BUG-034). **Voir T-104.**

### T-403 — Compose réel (mux audio + sous-titres)
> Tracé dans T-307 (BUG-036, MISS-025). **Voir T-307.**

### T-410 — Caches process : invalidation sur changement env
- **Findings** : MISS-030, MISS-033, BUG-043, F9.
- **Action** : invalider `getEngineConfig` (singleton), `resolvedKeyCache`/`modelCache` (TTL 5 min) sur changement de config, ou réduire le TTL ; documenter qu'un changement `.env` exige un restart sinon.
- **Critère de fin mesurable** : changer la clé puis re-interroger `/models` reflète l'état réel dans la fenêtre attendue (< TTL documenté) ; aucun `source:'live'` servi depuis un cache après disparition de la clé. Prouvé par probe.
- **Effort** : M. **Dépendances** : T-202.

### T-411 — `MEDIA_DIR` absolu indépendant du cwd
- **Findings** : MISS-024, MISS-032.
- **Action** : résoudre `MEDIA_DIR` via une racine absolue (env/config), pas `join(process.cwd(),'../../')`.
- **Critère de fin mesurable** : lancer un node média depuis un cwd ≠ `apps/web` écrit/serve au bon emplacement (vérifié par test avec cwd modifié). Prouvé.
- **Effort** : S. **Dépendances** : T-306.

### T-412 — Taxonomies objectifs/piliers unifiées + libellés humains
- **Findings** : BUG-052, MISS-014.
- **Action** : table de correspondance unique des enums objective/pillar entre A et B ; table de libellés humains (au lieu d'un `replace` de tirets) ; varier le fallback texte par platform/format/pillar.
- **Critère de fin mesurable** : générer pour chaque combinaison pillar×objective×format produit un texte adapté (pas le même bloc « post » pour un reel) ; aucun label brut à tirets dans l'UI. Prouvé par probe sur ≥3 combinaisons.
- **Effort** : M. **Dépendances** : T-201.

### T-413 — Cohérence du toggle de mode (3 sources de vérité)
- **Findings** : BUG-021, MISS-016, MISS-017, MISS-034.
- **Action** : unifier la source du mode (toggle/cookie/route default/`health.mockMode`) ; `generate-visual/route.ts` lit `CONTENT_STUDIO_V2_MOCK_MODE` au lieu de `mock` codé en dur ; cookie scoping cohérent avec le commentaire.
- **Critère de fin mesurable** : à `/create`, toggle, badge et comportement serveur **concordent** (un seul mode affiché = mode appliqué) ; une génération sans cookie respecte `CONTENT_STUDIO_V2_MOCK_MODE`. Prouvé par probe.
- **Effort** : S. **Dépendances** : T-005.

### T-414 — `formatError` ne doit pas écraser le message serveur utile
- **Findings** : BUG-054.
- **Action** : `errors/messages.ts` privilégie `e.message` serveur quand il est plus précis que le libellé mappé.
- **Critère de fin mesurable** : approuver un draft sans média affiche le message serveur précis, pas « État de draft invalide » générique. Prouvé par probe.
- **Effort** : S. **Dépendances** : aucune.

### T-415 — Garde MOCK_ASSETS / kind=video sur formats non-vidéo
- **Findings** : MISS-023, BUG-029 (contexte).
- **Action** : vérifier que l'UI désactive réellement `kind=video` pour `post`/`carousel` ; sinon erreur métier claire côté backend.
- **Critère de fin mesurable** : impossible de sélectionner `kind=video` sur un format non-vidéo dans l'UI ; un POST forcé renvoie un message clair, pas une 500. Prouvé par probe.
- **Effort** : S. **Dépendances** : aucune.

---

## Synthèse de séquencement

| Lot | Objectif | Tâches | Bloque |
|---|---|---|---|
| **P0** | Vérité + déblocage OpenAI + garde-fous sécurité | T-001, T-002, T-003, T-005, T-006, T-010, T-020, T-021 | Tout le reste (vérifiabilité) |
| **P1** | 4 blockers | T-101, T-102, T-103, T-103b, T-104 | Génération + publication live |
| **P2** | Criticals | T-201, T-202, T-203, T-204 | Picker honnête, double-pub |
| **P3** | Majors | T-301, T-302, T-303, T-304, T-305, T-306, T-307, T-308, T-309 | Fiabilité publication, montage réel |
| **P4** | Dette/minors | T-410, T-411, T-412, T-413, T-414, T-415 | Hygiène |

**Définition de fin globale (DoD)** : système prouvé fonctionnel par des tests orientés opérateur qui passent **à l'identique en MOCK ET en LIVE** (méthodologie §4). Tant qu'un chemin n'est pas prouvé dans les deux modes, il reste `broken by default`.
