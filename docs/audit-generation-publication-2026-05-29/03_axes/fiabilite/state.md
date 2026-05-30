# Axe fiabilité

> Baseline figée — audit pipeline **génération + publication** FemiGlow Content Studio v2 / AI Engine.
> Date de gel : **2026-05-29**. Branche : `feat/ai-engine-langgraph-mvp`.
> Source de vérité : comportement réel de l'application exercée par l'opérateur, pas le rapport de tests (cf. `01_audit/01_methodology.md` §1).

## Lentille de l'axe

> **Pourquoi ça casse en usage réel et pas en test ?**

La fiabilité est ici la capacité du pipeline à **produire l'effet promis quand l'opérateur l'exerce**, et à **échouer de façon visible et récupérable** quand il ne le peut pas. L'audit Phase 1 démontre, preuves à l'appui, que le système échoue sur les deux plans : des chemins entiers sont **inertes** (la programmation de publication), d'autres **dégradent en silence** (texte figé en template, génération live qui throw, fallbacks qui masquent l'échec), et la suite de tests **certifie un état qui n'existe pas** (1695 « passed » alors que le process sort en exit 1, modèles « Live » non générables, table de DB inexistante interrogée par un test E2E).

La cause systémique n'est pas une absence de code de fiabilité : la state-machine de publication, l'idempotence, le lock optimiste et la politique de retry **existent et sont de bonne facture** (`state-machine.ts`, `retry.ts`, `admin-service.ts::executeJob`). Le problème est que **rien ne déclenche ces mécanismes en conditions réelles**, que **les doublures de test ne reflètent pas le live**, et que **les assertions ne vérifient pas l'effet backend du point de vue opérateur**. Résultat : la fiabilité est *prouvée sur le papier* (tests verts) et *fausse en production* (chemins inertes ou dégradés).

---

## État actuel (constaté, avec preuves)

### 1. La publication PROGRAMMÉE ne s'exécute jamais — chemin totalement inerte [BUG-003]

C'est le défaut de fiabilité le plus grave. Le worker `runScheduledPublishJobs` (`worker.ts`) est correct : il lit les jobs `queued` arrivés à échéance (`listScheduledJobsDue`, `repository.ts:352-381` — filtre `status=queued AND scheduledAt<=now AND lockedAt IS NULL`) et appelle `executeJob`. **Mais aucun déclencheur ne l'appelle jamais** :

- `runScheduledPublishJobs` n'est référencé QUE par `/api/cron/content-studio/social-publish-scheduler/route.ts` (protégée `Bearer CRON_SECRET`) et ses tests.
- Cette route est **absente de `vercel.json`** : 15 crons y sont listés (`/api/cron/tick`, `media-optimize`, `tracking-purge`, `analytics-refresh`, `promote-scheduled-fields`, `purge-field-history`, `chat/*`, `insights-purge`, `legal-link-health`) — **aucun** `social-publish-scheduler`.
- Le déploiement réel **n'est pas Vercel** mais PM2 + systemd timers (staging self-hosted) ; `vercel.json` n'est de toute façon **pas honoré**. L'énumération `systemctl list-timers` (cf. `BUG-003.counter`) ne contient aucun timer `social-publish`.
- `/api/cron/tick` (seul cron tournant chaque minute, piloté par `femiglow-staging-cron-tick.service`) n'appelle que `processBatch`, `scanAndDispatchCartAbandon`, `scanAndDispatchLeadStep1Abandon`, `syncCampaignStatuses` (`cron/tick/route.ts:1-8,31-57`) — **jamais** `runScheduledPublishJobs`.

**Preuve d'effet** : `GET /api/admin/content-studio/publish-jobs?status=queued` → **0 job**. Sur les 12 jobs existants : tous `published/dry_run`, `publishMode {now:11, draft:1}`, **jamais `schedule`** — confirmant qu'aucun job programmé n'a jamais transité. Côté UI, `PublishActionGroup → /schedule` accuse pourtant réception (« Publication programmée ») : **accusé de réception inerte**. Un post programmé reste `queued` indéfiniment, en mock **comme** en live.

> En test, ce défaut est invisible : `worker.test.ts` exerce `runScheduledPublishJobs` directement (en appelant la fonction), donc le worker « marche ». Personne ne teste que **quelque chose appelle le worker** dans le déploiement réel. C'est l'archétype du « ça casse en réel, pas en test ».

### 2. La génération LIVE échoue silencieusement / throw avant tout appel réseau [BUG-001, BUG-002, BUG-005, BUG-020]

Le flux opérateur (`/create`, pipeline B) est cassé en mode LIVE pour **toute** génération, déterministe par code + env (relevé `/proc/<pid>/environ`, cf. `evidence/runtime-env-state.md`) :

- **Image** [BUG-001, blocker] : `image-generation.ts:86-94` lit **uniquement** `env.CONTENT_STUDIO_OPENAI_API_KEY` (VIDE) → `throw HttpError('invalid_state')` → HTTP 409 **avant** tout réseau. La clé `OPENAI_API_KEY` valide (sk-, 164 chars) **présente dans le process** n'est ni mappée dans `env.ts` ni lue par ce chemin. Higgsfield → `higgsfieldAuthHeader()` null (clé `hf_` sans `:`, secret absent) → 409.
- **Vidéo** [BUG-002, blocker] : credential Higgsfield incomplet → tout `hf-video-*` throw `invalid_state`. (Réserve de portée : le défaut opérateur est `mock` ; seule une bascule Live manuelle + sélection `hf-*` déclenche le blocker.)
- **Texte** [BUG-005, critical] : `generation.ts:70` résout `CONTENT_STUDIO_OPENAI_API_KEY ?? CHAT_OPENAI_API_KEY` (les deux vides) → `if (!apiKey) return fallbackGeneration(idea)`. **Tous** les runs texte sont `provider=fallback, model=deterministic-template, status=fallback, cost=0` (preuve : `GET /generation-runs`). MOCK et LIVE produisent **strictement le même template** : le texte LLM n'est **jamais** appelé.
- **Dégradation muette du mode** [BUG-020] : la route `ideas/[id]/generate` ne lit **jamais** le cookie `cs_generation_mode`. En « Live », l'opérateur croit obtenir du texte IA et reçoit un template, **sans erreur ni avertissement**.

> Le picker (`/models?role=…`) affiche pourtant 14+ modèles badgés « Live » (OpenAI gpt-image-*, Higgsfield flux_2/veo3_1…) [BUG-006, BUG-007, BUG-024] — **aucun n'est générable aujourd'hui**. Désynchronisation UI↔réalité totale : l'opérateur choisit un modèle live qui throw systématiquement à l'usage.

### 3. Les mécanismes de retry/state-machine existent mais ne couvrent pas l'échec réel

La state-machine (`state-machine.ts`) et `executeJob` (`admin-service.ts:407-530`) sont solides : lock optimiste (`tryAcquirePublishJobLock`, `repository.ts:312-340`), idempotence (`idempotencyKey`), court-circuit si déjà `published` (`:410-412`), transition `failed → queued` autorisée pour retry manuel (`nextRetryStatus`). **Mais** :

- **Aucun retry automatique** : un job qui échoue passe en `failed` et **y reste**. `listScheduledJobsDue` ne ramasse QUE les `queued` (`repository.ts:364`), jamais les `failed`. Il n'existe **aucun re-enqueue automatique** des `failed` retryables (alors que `retry.ts::isTransientHttpStatus` et le flag `retryable` sont calculés et persistés). Le retry dépend d'une action humaine via `retryJob`. Combiné à BUG-003, la chaîne de fiabilité de publication est **doublement morte** : ni le `queued` programmé ni le `failed` ne sont jamais repris automatiquement.
- **Désynchronisation `content_post` ↔ `social_publish_job`** [BUG-038] : `cancelScheduledPost`/`reschedulePost` (`content-studio/service.ts:568,603`) n'opèrent que sur `content_post`, **jamais** sur la ligne `social_publish_job`. Un post annulé/reprogrammé laisse un job `queued` orphelin avec l'ancienne date. **Latent aujourd'hui** (le scheduler ne tourne pas), **bug actif dès que BUG-003 est corrigé** : publication d'un post annulé / à l'ancienne date.
- **Double-publication latente** [MISS-006, MISS-028] : les clés d'idempotence de `publish-now` (`…:now`) et `schedule` (`…:<ISO>`) sont **disjointes**. Publier maintenant un post qui a déjà un job programmé ne désactive pas ce dernier ; reprogrammer crée un **second** job `queued` au lieu de muter l'existant. Dès le scheduler branché → **doubles publications réelles** sur le compte Instagram client.

### 4. Le mode dry_run « réussit » avec un permalien factice — succès trompeur [BUG-045, BUG-065]

Le dry_run (défaut staging, `SOCIAL_PUBLISHING_MODE` non défini) est **fonctionnel et prouvé** (probe : `draft-on-provider` → `status:published`, `permalink=https://social.example.test/instagram/draft/dry_…`). Mais :

- Le permalien et le `remoteId` (`sha256 → dry_<hex>`) sont **des formes qui n'existent pas chez Postiz** (`dry-run.ts:46-48,141-143`). Un opérateur (ou un test) qui se fie au statut `published` croit avoir publié.
- `buildSocialContent` force `metadata.dryRun=true` **même en live** [BUG-065] (`admin-service.ts:637`) : une vraie publication serait étiquetée `dryRun:true` en base → trace/audit post-mortem trompeuse.
- **Aucun harnais de parité** dry_run↔Postiz : les fixtures Postiz (`status:'SENT'`, `permalink instagram.com/p/abc123`) sont **écrites à la main**, jamais validées contre la vraie API. Le passage dry_run→live n'a **aucun filet** [BUG-045].

### 5. Les fallbacks silencieux transforment les échecs en faux succès

Plusieurs chemins **avalent l'erreur** et renvoient un artefact fantôme, masquant la dégradation :

- **Génération image (graphe A)** [MISS-020] : `generate-images.ts:174-177` catch toute erreur provider → image mock `cost=0` servie **404**. Le job « réussit » avec une image non servable.
- **Voix-off / musique** [BUG-012, BUG-049, BUG-050] : sur échec, assets vides (`url:''`, provider `fallback`), **aucun fichier écrit**, mais les nodes loguent « Voiceover generated » et le job finit `completed quality 0.91`. (Note : la cause racine « lavfi indisponible » a été **réfutée** — cf. `evidence/ffmpeg-binary-verification.md` ; ces nodes sont surtout **inatteignables** depuis le flux opérateur, gouvernés par le blocker BUG-004.)
- **Transcode/export** [MISS-026] : `transcode-export.ts:182-188` crée un export `passthrough` (composition brute non transcodée) si ffmpeg échoue, **sans rethrow** → l'appelant reçoit un « export » qui viole potentiellement toutes les contraintes plateforme, sans signal.
- **Variantes** [BUG-022] : `CreateWorkspace.tsx:201,226` — `if(res.ok)` sans branche `else`, `catch {}` vide (« Generation failure is not blocking »). Un échec budget/provider laisse l'idée **sans variantes et sans feedback**.

### 6. Le rapport de tests ment — le décalage test↔réalité est démontré [BUG-010, BUG-032, BUG-041, BUG-011, BUG-023, BUG-042]

- **Exit-1 masqué** [BUG-010, BUG-032] : `vitest run` rapporte **1695 passed / 0 failed / success:true** (`evidence/vitest-summary.json`) mais le **process sort EXIT 1** : unhandled rejection `Higgsfield video failed: content policy violation` (`video-generation.ts:206`) échappant au test `polling status=failed` sous fake-timers (`video-generation.test.ts:198-224`). Un gate CI sur la ligne de résumé passe ; un gate sur le code de sortie échoue. **Canonique.**
- **0/95 fichiers de test n'assertent un effet backend réel** [BUG-041] ; **58 mockent `fetch`/providers** avec des formes inventées qui **ne correspondent pas** à l'API live (Higgsfield async `/v1/text2image/<model>` + poll `/v1/requests/{id}/status` vs endpoints sync codés). Chaque chemin « live » testé est un **fantôme** [BUG-008, BUG-025].
- **Un test E2E ne pouvait jamais passer** [BUG-023, BUG-042] : `content-studio-social-publishing-draft.spec.ts` interroge la table `audit_event` (singulier) — la vraie table est `audit_events` (`schema.ts:268`). Il n'aurait **jamais** pu passer contre la vraie DB.
- **MSW installé mais non câblé en harnais de parité** [BUG-046] : aucun test ne compare la sortie mock à la sortie live. Le filet de parité mock/live promis par la méthodologie **n'existe pas**.

### 7. Hasards de fiabilité runtime (timeouts, polling, cwd, race)

- **Polling synchrone 5 min dans le handler** : `video-generation.ts:183-212` boucle `while(Date.now()<deadline)` avec `HIGGSFIELD_POLL_TIMEOUT_MS=300_000` (5 min) **dans la requête**. Sur un runtime serverless (ou derrière un proxy avec timeout < 5 min), la requête est tuée bien avant ; aucun état n'est resumable, le job est perdu en cas de crash. Conception non fiable même une fois le credential corrigé.
- **`MEDIA_DIR` dépend du cwd** [MISS-024] : `join(process.cwd(),'../../.media-storage/ai-engine')` — fragile entre build prod / test / cron (cwd différent).
- **Pollution de stockage prod** [BUG-031, MISS-004] : 977 `.jpg` stubs de 10-14 octets (`mock-image`) écrits par les tests dans `.media-storage/ai-engine` **partagé avec le runtime**. Si un `assetId`/url a été persisté en table `media`, un média de 10 octets peut être servi à la place d'un vrai visuel → **corruption de données prod**.
- **`<video src=''>`** [MISS-021] : `VideoPlayer.tsx:120` rend sans garde sur previewUrl vide → erreur de chargement silencieuse si un asset fallback `url:''` remonte (compose/generate-video).
- **Discovery Higgsfield échoue à chaque cache-miss** [MISS-019] : fetch vers host mort `api.higgsfield.ai/v1` avec timeout 5 s → latence ajoutée au picker à chaque expiration de cache, sans jamais réussir.

---

## Problèmes concrets (chacun tracé à un finding)

| # | Problème | Findings | Sév. | Mock | Live |
|---|---|---|---|---|---|
| F1 | Publication **programmée** jamais exécutée (scheduler branché à aucun cron/timer) | **BUG-003** | blocker | broken | broken |
| F2 | Génération **image live** throw avant réseau (clé OpenAI non lue, Higgsfield incomplet) | **BUG-001**, BUG-025, BUG-028 | blocker | works | broken |
| F3 | Génération **vidéo live** throw (credential Higgsfield incomplet + endpoints sync faux) | **BUG-002**, BUG-008, BUG-009 | blocker | n/a | broken |
| F4 | Génération **texte** figée en template déterministe (jamais LLM), mock=live | **BUG-005**, BUG-020 | critical | works | broken |
| F5 | Toggle Mock/Live **sans effet** sur texte/variantes ; dégradation **muette** en « live » | BUG-020, BUG-021 | major | partial | broken |
| F6 | Picker propose des modèles **« Live » non générables** (throw systématique à l'usage) | BUG-006, BUG-007, BUG-024, BUG-019, BUG-043 | critical | n/a | broken |
| F7 | **Aucun retry automatique** des jobs `failed` retryables (état terminal de fait) | BUG-038 (contexte), `state-machine.ts`, `worker.ts` | major | broken | broken |
| F8 | Cancel/Reschedule **orphelinent** les `social_publish_job` queued (désync content_post↔job) | **BUG-038** | major | broken | broken |
| F9 | **Double-publication** latente (clés idempotence disjointes now/schedule ; reschedule crée un 2e job) | **MISS-006**, MISS-028 | major | n/a | untested |
| F10 | `resolveDefaultAccount` choisit implicitement le **1er compte Postiz** → mauvais compte client en live | BUG-039 | major | n/a | untested |
| F11 | Route legacy `/postiz-draft` **contourne** le garde-fou dry_run (poste réel même en staging) | BUG-040 | major | n/a | untested |
| F12 | dry_run « réussit » avec **permalien/remoteId factices** ; `metadata.dryRun=true` forcé même en live | BUG-045, BUG-065 | major | works | untested |
| F13 | **Fallbacks silencieux** transformant échec en faux succès (image 404, audio vide, export passthrough) | MISS-020, BUG-012, BUG-049, BUG-050, MISS-026 | major | broken | broken |
| F14 | Échec de génération de variantes **silencieux** (catch vide, pas de feedback opérateur) | BUG-022 | major | partial | partial |
| F15 | Re-générer une idée `generated` → **500 opaque** (transition non gérée, écritures partielles) | BUG-051 | minor | broken | broken |
| F16 | **Suite tout-verte (1695) mais EXIT 1** — unhandled rejection masquée | **BUG-010**, BUG-032, BUG-027 | critical | n/a | n/a |
| F17 | **0/95 tests** n'assertent un effet backend réel ; 58 mockent `fetch` (formes ≠ API live) | **BUG-041**, BUG-011, BUG-018, BUG-035 | major | works | broken |
| F18 | Test E2E interroge une table inexistante (`audit_event`) — **impossible à passer** | BUG-023, BUG-042 | major | broken | untested |
| F19 | **MSW présent mais aucun harnais de parité** mock/live ; fixtures Postiz inventées | BUG-046, BUG-045 | major | partial | untested |
| F20 | Polling **synchrone 5 min** dans le handler (non resumable, timeout-prone) | BUG-008, `video-generation.ts:183-212` | major | n/a | broken |
| F21 | Tests **polluent le stockage prod** (977 stubs 10-14o) → corruption média possible | BUG-031, MISS-004, MISS-024 | major | broken | n/a |

---

## Causes racines

1. **Aucun déclencheur n'exécute le worker de publication programmée.** Le code (worker, state-machine, idempotence, lock, retry manuel) est complet mais **orphelin** : la route scheduler n'est ni dans `vercel.json`, ni dans un systemd timer, ni relayée par `tick`. Le déploiement réel (PM2/systemd) ne correspond pas à l'hypothèse implicite (Vercel crons). [F1, F7]

2. **Split de variables d'environnement entre les deux pipelines.** Le flux opérateur (B) lit `CONTENT_STUDIO_OPENAI_API_KEY` (vide) sans fallback ; la clé `OPENAI_API_KEY` valide présente dans le process **n'est même pas déclarée dans `env.ts`** et n'est lue que par le pipeline A (`engine-config.ts:75`). Conséquence : génération live impossible côté opérateur, **sans qu'aucune clé ne manque réellement** — correctif bon marché. [F2, F4]

3. **Deux pipelines parallèles non connectés (A=LangGraph, B=create).** L'opérateur n'utilise que B ; le bridge A→B est unidirectionnel et ne propage ni audio, ni composition, ni exports. La couverture de test porte massivement sur A (atteignable seulement via `/api/admin/ai-engine/generate`), pas sur le chemin réel B. [F2, F4, F6, F13]

4. **Les doublures de test ne reflètent pas le live, et les assertions ne vérifient pas l'effet backend.** Mocks de `fetch` aux formes inventées (≠ API Higgsfield/OpenAI/Postiz réelles), aucun test contre DB/réseau réel, fake-timers mal drainés (exit-1), test E2E sur table inexistante. Aucun harnais de parité mock/live (MSW non câblé en contrat). La suite **certifie un état fictif**. [F16, F17, F18, F19]

5. **Culture du fallback silencieux et du « succès par défaut ».** Catch sans rethrow, assets fantômes (`url:''`, image 404, export passthrough), `metadata.dryRun=true` codé en dur, dégradation muette du mode. Le système préfère **simuler le succès** plutôt que **rendre l'échec visible et récupérable** — l'inverse d'un système fiable. [F5, F12, F13, F14, F15]

6. **Désynchronisation d'état entre sous-systèmes et entre couches.** content_post ↔ social_publish_job (cancel/reschedule), clés d'idempotence disjointes (now/schedule), capabilities persistées stale, picker servi depuis un cache mémoire périmé. Latent aujourd'hui, **actif dès que le scheduler tourne**. [F8, F9, F10]

7. **Conception runtime non fiable pour les opérations longues.** Polling synchrone 5 min dans le handler (non resumable), stockage dépendant du `cwd`, stockage prod partagé avec les tests. [F20, F21]

---

## Criticité (justifiée)

**Criticité de l'axe : `blocker`.**

Justification : la promesse centrale du produit — **générer puis publier du contenu** — est rompue sur ses deux extrémités en conditions réelles.

- Côté **publication**, le seul chemin asynchrone (programmer un post) est **totalement inerte** (F1/BUG-003) : un post programmé ne part **jamais**, en mock comme en live, et l'UI ment en accusant réception. C'est un blocker isolément.
- Côté **génération**, **toute** production live est cassée pour l'opérateur (F2, F3, F4) : image et vidéo throw avant réseau, le texte est figé en template. Le mode mock fonctionne, mais le mock **n'est pas le produit** (permaliens factices, contenu déterministe).
- La **détectabilité** de ces pannes est annulée par F16-F19 : les tests sont verts, le picker affiche « Live », rien n'alerte l'opérateur. Un système qui échoue **et** masque ses échecs **et** dont les tests certifient le contraire est, en fiabilité, dans l'état le plus dégradé possible.
- Les défauts `major` latents (F7, F8, F9, F10, F11) ne sont pas bénins : ils sont **armés**. Dès que BUG-003 sera corrigé (prérequis fonctionnel), ils basculent en **doubles publications** et **publications sur le mauvais compte client réel** — i.e. des incidents `critical` à impact client direct.

La sévérité maximale au registre de cet axe est `blocker` (BUG-001, BUG-002, BUG-003, BUG-004), confirmée et non réfutée.

---

## Recommandations (actionnables, priorisées)

### P0 — Débloquer le pipeline et arrêter les faux succès (jours)

1. **Brancher le scheduler de publication** [F1/BUG-003]. Option recommandée : appeler `runScheduledPublishJobs({ limit })` depuis `cron/tick/route.ts` (limite bornée, déjà tournant chaque minute via systemd). Alternative : créer un systemd timer dédié POSTant `/api/cron/content-studio/social-publish-scheduler` avec `Bearer CRON_SECRET`. Ajouter aussi l'entrée à `vercel.json` pour un futur déploiement Vercel.
   *Critère de fin :* programmer un post à T+2 min en staging → vérifier qu'à échéance il transite `queued→publishing→published` et qu'un `social_publish_job` daté apparaît. **Prérequis** : corriger F8/F9 AVANT d'activer, sous peine de doubles publications.
2. **Mapper `OPENAI_API_KEY` en fallback du flux create** [F2/BUG-001, F4/BUG-005]. Déclarer `OPENAI_API_KEY` dans `env.ts` et l'ajouter en queue de résolution dans `image-generation.ts` et `generation.ts` (remplacer `??` par une vérification de chaîne non vide). Correctif **bon marché, fort impact** (la clé valide est déjà dans le process).
   *Critère de fin :* génération image + texte live réelles, prouvées par un `generation-run provider=openai status=succeeded` ET un asset servi en 200.
3. **Rendre l'échec visible** [F5/BUG-020, F14/BUG-022, F15/BUG-051]. Faire lire le cookie `cs_generation_mode` à `ideas/generate` ; en live sans clé → `throw invalid_state` explicite plutôt que dégrader en template. Ajouter la branche `else`/`catch` non vide dans `CreateWorkspace.onCreated` (toast + retry). Mapper la transition `generated→generated` en `409` métier.
4. **Supprimer/sécuriser les contournements de garde-fou** [F11/BUG-040]. Renvoyer `410 Gone` sur `/postiz-draft`, ou router `createDraftInPostiz` via `resolveDefaultAccount` + respect de `SOCIAL_PUBLISHING_MODE`.

### P1 — Armer la fiabilité de publication avant le live (1-2 semaines)

5. **Synchroniser content_post ↔ social_publish_job** [F8/BUG-038]. `cancelScheduledPost` → `cancelPublishJob` sur les jobs `queued` ; `reschedulePost` → muter le `scheduledAt` du job existant (ne pas en créer un second).
6. **Dédupliquer les jobs** [F9/MISS-006, MISS-028]. Avant tout `publish-now`/`schedule`, invalider/réutiliser le job `queued` existant du même post ; clé d'idempotence **indépendante du `scheduledAt`** (clé par post+compte, mutée en place).
7. **Retry automatique des `failed` retryables** [F7]. Faire ramasser par le worker les jobs `failed AND lastError.retryable=true` avec backoff (`retry.ts` existe déjà), borné par un compteur de tentatives, puis `failed` terminal après N essais. Surfacer le `lastError` dans l'UI.
8. **Imposer la sélection de compte en live** [F10/BUG-039]. UI publish envoie un `accountId` explicite ; en live + plusieurs comptes + pas de pin → `invalid_state` (ne jamais deviner le compte client).
9. **Sortir le polling long du handler** [F20]. Découper la génération vidéo Higgsfield en submit + job de poll asynchrone (resumable), ou borner le polling au timeout réel du runtime. Réécrire les endpoints Higgsfield en async submit+poll conformes à l'API réelle [BUG-008].

### P2 — Réaligner la vérité des tests et le picker (continu)

10. **Gate CI sur le code de sortie ET « Errors N error »** [F16/BUG-010]. Ne jamais se fier au seul `numFailedTests`. Drainer les fake-timers (`afterEach` global `vi.clearAllTimers()/useRealTimers()/restoreAllMocks()`).
11. **Harnais de parité mock/live** [F19/BUG-046, F17/BUG-041]. Câbler MSW en handlers **calqués sur les OpenAPI réelles** (Postiz, OpenAI, Higgsfield) ; ajouter des tests de parité asservissant dry_run et l'adapter live au **même contrat** (statuts, shape de permalien, codes d'erreur). Capturer une vraie réponse Postiz (compte jetable) une fois.
12. **Tester l'effet backend du point de vue opérateur** [F17, F18/BUG-023]. Au moins un parcours E2E par chemin contre la **vraie DB** (corriger `audit_event`→`audit_events`), assertant l'effet réel (asset servi 200, job transité, post publié), pas seulement le rendu UI.
13. **Aligner le picker sur la générabilité réelle** [F6]. Ne badger « Live » qu'un modèle dont la clé est effectivement lue par le chemin de génération ; désactiver les modèles non routables et les `allowCustom` non validés.

### P3 — Hygiène runtime et fallbacks (continu)

14. **Rendre les fallbacks audibles** [F13/MISS-020/MISS-026]. Marquer tout asset/job dégradé d'un flag `degraded`+raison ; ne jamais servir une image 404 / un export passthrough comme un succès silencieux. Garde sur `<video src=''>` (MISS-021).
15. **Isoler le stockage des tests** [F21/BUG-031, MISS-004]. `MEDIA_DIR` absolu et propre par environnement ; purger les 977 stubs ; auditer la table `media` pour références orphelines (<100 octets).
16. **Dériver `metadata.dryRun` du mode résolu** [F12/BUG-065], et confronter dry_run/Postiz au même contrat de permalien [BUG-045].

---

## Points à vérifier sous tous les angles (avant clôture de l'axe)

- **Le scheduler tourne réellement** : timer/cron actif, logs d'exécution, un post programmé transite de bout en bout (mock **puis** live sur compte jetable).
- **Aucune double-publication possible** : test explicite publish-now + schedule sur le même post → un seul envoi.
- **Aucun job orphelin** après cancel/reschedule : vérifier l'état `social_publish_job` post-action.
- **Génération live prouvée** : run `provider=openai/higgsfield status=succeeded` + asset servi 200, dans le flux create réel (pas seulement via `/ai-engine/generate`).
- **CI échoue sur exit≠0** : reproduire l'exit-1 et confirmer que le gate le capte.
- **Picker = générabilité** : chaque modèle badgé « Live » génère réellement, ou est masqué.
- **Permissions runtime ffmpeg** : si le graphe A est un jour câblé à B, re-vérifier l'exécution des nodes **sous l'utilisateur PM2 réel** (cf. réserve `evidence/ffmpeg-binary-verification.md`).
