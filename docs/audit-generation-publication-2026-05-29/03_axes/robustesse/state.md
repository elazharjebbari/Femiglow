# Axe robustesse

> Diagnostic transversal — pipeline **génération + publication** de FemiGlow Content Studio v2 / AI Engine.
> Baseline figée : **2026-05-29**, branche `feat/ai-engine-langgraph-mvp`. Source : findings confirmés Phase 1 (`01_audit/_consolidated.json`), preuves dans `01_audit/evidence/`.
> Lentille : comportement en cas d'échec externe (OpenAI / Higgsfield / Postiz down ou 4xx/5xx), endpoints Higgsfield sync vs async, gestion des erreurs réseau, AbortSignal / timeouts, fallback, dégradation gracieuse, intégrité des états DB (job / attempt / publication / generation_run).

---

## 1. Fonctionnement optimal attendu (référentiel)

Un pipeline génération+publication « robuste » au sens d'une agence haut de gamme doit garantir, pour **chaque** dépendance externe (OpenAI, Higgsfield, Postiz) :

1. **Contrat d'appel correct** — l'URL, la méthode et la forme de réponse correspondent à l'API réelle, dans les deux modes (sync/async), de sorte qu'un credential valide produise un résultat.
2. **Borne de temps** — tout appel réseau porte un `AbortSignal`/timeout : aucune requête ne peut pendre indéfiniment et bloquer la requête HTTP entrante ou le worker.
3. **Reprise sur erreur transitoire** — retry borné avec backoff sur 408/425/429/5xx, distinct des erreurs **non** rejouables (4xx métier, content policy), avec un drapeau `retryable` propagé.
4. **Isolation des pannes** — un disjoncteur (circuit breaker) coupe les appels vers un provider en panne et bascule vers un fallback de provider, plutôt que d'empiler les échecs.
5. **Dégradation explicite, jamais silencieuse** — si un sous-résultat manque (image, voix-off, vidéo), le statut global le reflète (`failed`/`degraded`) ; on ne renvoie JAMAIS un statut `succeeded`/`completed` au-dessus d'un artefact vide.
6. **Intégrité des états DB** — toute tentative, réussie OU échouée, laisse une trace cohérente (`generation_run`, `social_publish_job`, `publication`, `attempt`) ; les transitions sont gardées par une machine à états ; pas d'orphelins ; pas de double-exécution ; idempotence vérifiée avant écriture.
7. **Message d'erreur actionnable** — l'opérateur reçoit la cause réelle (« attachez un visuel », « provider indisponible, réessayez »), jamais un 500 opaque ni un succès trompeur.
8. **Récupération sans intervention exotique** — corriger une clé/config et le système repart (pas de cache 5 min ni de singleton process qui fige l'état jusqu'au redémarrage).

---

## 2. État actuel (constaté, avec preuves)

Le constat structurant : **il existe deux pipelines parallèles avec deux niveaux de robustesse radicalement opposés**, et l'opérateur n'emprunte que le moins robuste.

### 2.1 Système A (AI-Engine LangGraph) — robuste mais inatteignable

Le graphe `lib/ai-engine/*` dispose d'une vraie pile de résilience :
- disjoncteur (`lib/ai-engine/providers/circuit-breaker.ts`, configuré `failureThreshold: 5, resetTimeoutMs: 60000` dans `generate-images.ts:90`),
- retry partagé (`lib/ai-engine/providers/retry.ts`),
- sélection/failover de provider (`ProviderSelector`),
- orchestrateur qui capture l'exception terminale et persiste `status: 'failed'` avec un tableau `errors[]` (`orchestrator.ts:244-269`).

**Mais ce pipeline n'est jamais atteint par le flux opérateur** : le bridge A→B est unidirectionnel et l'opérateur n'utilise que le flux `/create` (système B). Toute cette robustesse est donc **morte pour la production réelle** (cf. **BUG-004**, **BUG-026**, **BUG-033**, **BUG-047**).

### 2.2 Système B (flux create opérateur) — fragile, et c'est le seul utilisé

Le chemin réellement exercé (`MediaStudio` → `/api/admin/content-studio/drafts/[id]/generate-visual` → `generateStudioImage` / `generateForIdea` → `lib/content-studio/image-generation.ts`, `video-generation.ts`, `generation.ts`, `postiz.ts`) ne dispose **d'aucune** des protections du système A :
- **Aucun circuit breaker, aucun failover de provider** : un seul provider en dur par modèle.
- **Timeouts incohérents** (cf. §3.3) : présents sur Higgsfield, **absents sur OpenAI**.
- **Fallback silencieux** sur le texte, **throw nu** sur l'image/vidéo.
- **Pas de trace d'échec en DB** sur la génération image/vidéo (cf. §3.6).

### 2.3 Échec externe : le live ne franchit même pas le premier octet réseau

Au gel, **la résistance aux pannes externes de génération est intestable** parce que le live throw **avant tout appel réseau** :
- `image-generation.ts` (l.87/98/111) lit uniquement `env.CONTENT_STUDIO_OPENAI_API_KEY` (vide) → `HttpError('invalid_state')` HTTP 409 ; la clé `OPENAI_API_KEY` valide (164 chars) présente dans le process **n'est ni mappée dans `env.ts` ni lue par ce chemin** (`evidence/runtime-env-state.md`). → **BUG-001**.
- Higgsfield : `AI_ENGINE_HIGGSFIELD_API_KEY` posé **sans `:`**, secret vide → `higgsfieldAuthHeader()` renvoie `null` → throw avant réseau. → **BUG-001**, **BUG-002**.

Conséquence robustesse : on ne peut **pas** observer aujourd'hui comment le système se comporte face à un 500 OpenAI ou un 429 Higgsfield réel — la parité mock/live de la robustesse est **non démontrable** et doit être documentée comme telle (principe directeur §5), pas simulée.

### 2.4 Publication : robustesse réelle côté lifecycle, trous côté planification et garde-fous

Le domaine publication est la **seule** zone disposant d'une robustesse de qualité production :
- machine à états gardée (`state-machine.ts`, transitions explicites, `assertSocialPublishJobTransition`),
- verrou optimiste (`tryAcquirePublishJobLock`) + idempotence (`idempotencyKey`),
- retry borné avec classification transitoire (`retry.ts` : `isTransientHttpStatus` = 408/425/429/≥500 ; `errorFromHttpStatus`),
- drapeau `retryable` propagé jusqu'à l'alerte (`admin-service.ts:497-523`),
- preuve mock : `POST /draft-on-provider` → job `dry_run/published`, permalink factice (`evidence`, domaine publication-postiz).

Mais cette robustesse est **percée** par : la planification non câblée (§3.1), les chemins hors garde-fou (§3.5), et les orphelins/doublons d'état (§3.7).

---

## 3. Problèmes concrets (chacun tracé à un finding)

### 3.1 [BLOCKER] La publication programmée ne s'exécute jamais — le worker n'est branché à aucun cron — **BUG-003**

`runScheduledPublishJobs` (`worker.ts`) n'est appelé QUE par `/api/cron/content-studio/social-publish-scheduler`, route **absente de `vercel.json`**, sans crontab système, et `/api/cron/tick` (seul cron tournant chaque minute) ne la relaie pas. De surcroît le staging tourne en **PM2 / `next start`**, où `vercel.json` n'est de toute façon pas honoré. Un post programmé reste `queued` indéfiniment : l'UI accuse réception (« Publication programmée ») mais rien ne sera jamais publié, ni en mock ni en live. C'est une **rupture totale de la garantie d'exécution différée** — le pire cas de robustesse : promesse acceptée, jamais tenue, sans erreur.

### 3.2 [BLOCKER] Dégradation silencieuse : un job « réussit » au-dessus d'artefacts vides — **BUG-004**, **BUG-012**, **BUG-013**, et MISS-011 (manquant majeur)

Aucun nœud média (`generate-voiceover.ts:213-230`, `generate-music.ts:78-95`, `generate-video.ts:207-226`, `compose.ts:286-293`) ne pousse jamais une entrée dans `state.errors`. En cas d'échec TTS/ffmpeg, ils retournent un asset `url: ''` / `provider: 'fallback'` (vérifié l.220-229 de `generate-voiceover.ts`) ET le job finit `completed` avec `quality 0.91`. Le quality-gate (`routing.ts`) ne note que les scores texte (≥0.65 → pass) : **il ne peut structurellement JAMAIS détecter un média manquant**. C'est l'archétype du faux-vert. (Le diagnostic ffmpeg/lavfi initial a été **réfuté** — `evidence/ffmpeg-binary-verification.md` — d'où BUG-012/013 ramenés à `minor` ; le défaut de robustesse réel est l'**absence de contrat d'erreur du graphe**, et l'inatteignabilité opérateur **BUG-004**, qui reste blocker.)

### 3.3 [CRITICAL] Timeouts incohérents / absents sur les appels réseau de génération — **BUG-001**, **BUG-005**

- **OpenAI image** (`image-generation.ts:121`, `callOpenAiImage`) : `fetch` **sans `AbortSignal`, sans timeout**. Une connexion OpenAI lente/pendante bloque la requête HTTP entrante jusqu'à `maxDuration = 120` (route `generate-visual`) sans la moindre coupure côté client.
- **OpenAI texte** (`generation.ts:75`, `generateForIdea`) : `fetch` **sans timeout** non plus.
- **Higgsfield image/vidéo** : eux portent bien `AbortSignal.timeout(60_000)` / `AbortSignal.timeout(30_000)` (`image-generation.ts:185/204`, `video-generation.ts:168/189`).

L'asymétrie est le défaut : le provider le plus utilisé (OpenAI) est précisément celui sans garde-temps. Un OpenAI « down/hang » n'est pas dégradé — il fait traîner la requête opérateur.

### 3.4 [CRITICAL] Contrat Higgsfield faux (sync au lieu d'async) : le live échouerait même credential complet — **BUG-008**, **BUG-025**

Le code POST sur `${base}/v1/videos/generate` puis poll `/v1/videos/status/{id}` (sync, inventés ; `video-generation.ts:157/187`) et `/v1/images/generate` côté image. L'API réelle est **async** : submit `/v1/image2video/<model>` (ou `/v1/text2image/<model>`) puis poll `/v1/requests/{id}/status` (cf. mémoire « Higgsfield API mismatch »). Host et auth ont été corrigés ; les endpoints et la forme de réponse non (TODO explicites `video-generation.ts:153-155`, `image-generation.ts:167-170`). Donc même en fournissant le secret, chaque appel live échouerait (404 / forme inattendue : le code attend `{job_id}` et `{status,video_url}` inexistants). **La robustesse est compromise à la racine : le contrat est faux.**

### 3.5 [MAJOR] Chemin de publication hors garde-fou dry_run/live — **BUG-040**

La route legacy `/postiz-draft` (`createDraftInPostiz`, dépréciée Sunset 2026-08-01) appelle **directement** `createPostizDraft`/`uploadPostizMediaFromUrl` **sans passer par l'adapter ni `resolveDefaultAccount`**, et **ignore `SOCIAL_PUBLISHING_MODE=dry_run`**. Dès qu'on lui fournit un `integrationId`, elle POST sur l'API Postiz réelle, même en staging. C'est un **contournement du garde-fou de simulation** : une robustesse de sécurité (« par défaut on ne poste rien ») trouée par un chemin résiduel encore vivant.

### 3.6 [MAJOR/CRITICAL] Intégrité du ledger de génération : aucun `generation_run` en échec — **BUG-001**, **BUG-005**, **BUG-051**, MISS-020

`generateVisualForDraft` (`service.ts:341`), `generateVideoForDraft` (`service.ts:433`) et le run texte (`service.ts:130`) n'insèrent un `generation_run` **qu'avec `status: 'succeeded'`**, APRÈS succès. Quand `generateStudioImage` throw (chemin live = HTTP 409), **aucune ligne `generation_run` `failed` n'est écrite** : le ledger de coûts/historique ignore totalement l'échec. À l'inverse, le **texte** dégrade silencieusement en `fallbackGeneration` (provider `fallback`, cost 0) sans erreur opérateur (**BUG-005**, MISS-001) ; et la régénération d'une idée déjà `generated` lève une erreur **non-`HttpError`** → 500 opaque, après écritures partielles possibles (pas de transaction) (**BUG-051**). Côté graphe, MISS-020 : `generate-images.ts:174-177` avale tout échec provider en image mock `cost=0` servie en **404** — succès trompeur + coût faux.

### 3.7 [MAJOR] Désynchronisation d'états DB : orphelins, doublons, double-publication — **BUG-038**, MISS-006, MISS-028

- **BUG-038** : `cancelScheduledPost`/`reschedulePost` n'opèrent que sur `content_post` et **ne touchent jamais** la ligne `social_publish_job`. Un post annulé/reprogrammé laisse son job `queued` avec son ancien `scheduledAt`. Latent aujourd'hui (scheduler off — BUG-003) mais **devient un bug actif dès que le scheduler est branché** : publication d'un post annulé / à l'ancienne date.
- MISS-006 : `publish-now` n'invalide pas un job `queued` programmé pré-existant (clés d'idempotence disjointes `:now` vs `:<ISO>`) → **double-publication** dès scheduler actif.
- MISS-028 : `/schedule` appelé deux fois crée **deux** jobs `queued` (idempotence inclut `scheduledAt`) → publications multiples.

Ce sont des **trous d'intégrité d'état** qui transforment la mise en route du scheduler (correctif BUG-003) en risque de publication erronée — à traiter **conjointement**.

### 3.8 [MAJOR] Sélection de compte implicite en live — risque de publier sur le mauvais client — **BUG-039**

Sans `SOCIAL_PUBLISHING_DEFAULT_ACCOUNT_ID` (non posé) et sans `accountId` UI (l'UI `PublishActionGroup` n'en envoie aucun), `resolveDefaultAccount` retombe sur « le premier compte Postiz actif » dans un ordre **non déterministe garanti**. Avec 4 comptes Instagram clients réels en base, c'est une **publication potentielle sur le mauvais compte** en live. Robustesse = absence de désambiguïsation forcée.

### 3.9 [MAJOR] Erreur de génération non remontée à l'opérateur — **BUG-022**, **BUG-020**

`CreateWorkspace.tsx` (onCreated, l.195-228) : si `res.ok` est faux, **aucune branche else, aucun toast** ; le `catch` (l.226) est **vide** (« Generation failure is not blocking — user can retry »). En cas de `budget_exceeded` / provider down, l'opérateur obtient une idée créée, zéro variante, **zéro feedback** : état UI bloqué sans explication. Dégradation gracieuse côté UX absente.

### 3.10 [MAJOR/CRITICAL] Validation d'entrée fragile qui casse la génération avant tout nœud — **BUG-014**

Enum `tone` désynchronisé : l'UI propose `empowering/authentic/urgent`, le DTO route flat ne valide pas, mais `parse-brief.ts:9` impose un `z.enum` restreint → `ZodError` → `runGeneration` throw → `status: failed` **avant** parseBrief (donc avant tout nœud). 3 des 6 tons UI cassent toute la génération. Robustesse de la frontière d'entrée non assurée (validation non alignée entre couches).

### 3.11 [MINOR] Erreurs HTTP mal typées et messages écrasés — **BUG-051**, **BUG-054**, **BUG-060**

- **BUG-060** : `request.formData()` hors try/catch → corps non-multipart = `TypeError` → **500 `internal_error`** au lieu de **400 `invalid_input`**.
- **BUG-051** : transition `generated→generated` lève une erreur non-`HttpError` → 500 opaque.
- **BUG-054** : `formatError` écrase le message serveur **utile** (« Attachez un visuel… ») par un libellé générique pour `invalid_state` (mapping prioritaire sur `e.message`, `messages.ts:39-41`) ; de surcroît le code documenté `no_media_attached` diverge du code serveur réel `invalid_state`.

### 3.12 [MINOR] Robustesse du muxage/transcodage vidéo non garantie — **BUG-058**, **BUG-059**, **BUG-068**

- **BUG-058** : `transcode-export.ts` lit `maxFileSizeMb`/`codec` mais ne les **applique jamais** (`libx264` codé en dur, taille jamais comparée) → export pouvant dépasser silencieusement la limite Instagram → échec de publication ultérieur non anticipé.
- **BUG-059** : `compose.ts` utilise `-c:v copy` en muxant l'audio → si la vidéo source n'est pas H.264 compatible MP4+faststart, fichier illisible ou ffmpeg échoue ; non testé en réel.
- **BUG-068** : incohérence de binaire (`ffmpeg` système pour upload-and-trim vs `ffmpeg-static` pour compose/transcode) → robustesse runtime dépendante de deux binaires distincts.

### 3.13 [MINOR] Faux-vert process : la suite ment sur sa propre robustesse — **BUG-010**, **BUG-032**

`vitest run` rapporte **1695 passed / 0 failed** mais **EXIT 1** : une *unhandled rejection* (`Higgsfield video failed: content policy violation`, `video-generation.ts:206`) échappe au test polling sous fake-timers (`video-generation.test.ts`). Un gate CI lisant le compteur `passed` croit la suite saine ; seul le code retour révèle l'échec. C'est la robustesse **de l'observabilité** qui est cassée : on ne peut pas se fier au signal de test pour juger de la robustesse du code.

### 3.14 [MINOR] Récupération impossible sans redémarrage — caches/singletons qui figent l'état — MISS-030, MISS-033, **BUG-043**

`getEngineConfig()` met la config en **singleton module** (`engine-config.ts:51-52`) : provider TTS et clés figés au premier appel pour toute la vie du process. `resetEngineConfig` n'est appelé par aucun chemin runtime. De même `resolvedKeyCache` (TTL 5 min, invalidé seulement sur save/delete DB) et `modelCache` (5 min) : corriger une variable d'env ou une clé n'a **aucun effet avant restart / expiration**. **BUG-043** : le picker sert `gpt-image-1 source:"live"` depuis ce cache mémoire périmé sans clé réelle. Robustesse de récupération (« corriger et repartir ») absente.

---

## 4. Causes racines

1. **Architecture en double pipeline non convergé** — toute la robustesse industrielle (retry/circuit-breaker/failover/contrat d'erreur du graphe) vit dans le système A inatteignable ; le système B opérateur a été développé en parallèle sans réimporter ces garanties. Cause racine de §2.1–2.2, BUG-004/026/033/047.
2. **Contrat d'erreur du graphe absent** — choix de conception « ne jamais faire échouer un nœud média » (fallback silencieux systématique) sans jamais alimenter `state.errors` → le statut global ment. Cause racine de §3.2 (MISS-011).
3. **Migration de provider partielle** — host/auth Higgsfield migrés, endpoints/modèle async non réécrits. Cause racine de §3.4 (BUG-008/025).
4. **Garde-temps réseau non systématisé** — pas de helper `fetchWithTimeout` imposé sur tous les appels du flux B ; Higgsfield en a, OpenAI non. Cause racine de §3.3.
5. **Deux sous-systèmes de planification non synchronisés** — `content_post` (planning éditorial) vs `social_publish_job` (lifecycle) ne se parlent pas sur cancel/reschedule/publish-now, et le worker n'est rattaché à aucun ordonnanceur réel sur l'hébergement PM2. Cause racine de §3.1, §3.7.
6. **Ledger « happy-path only »** — `generation_run` n'est écrit qu'au succès ; pas de transaction englobante. Cause racine de §3.6.
7. **Frontières de validation et de typage d'erreur non alignées** — enums divergents entre UI/DTO/validation interne ; `formData()`/transitions hors `HttpError`. Cause racine de §3.10, §3.11.
8. **État runtime figé en mémoire** — singletons/caches sans invalidation par changement d'environnement. Cause racine de §3.14.

---

## 5. Criticité (justifiée)

**Criticité globale de l'axe : `blocker`.**

Justification : l'axe robustesse concentre **3 des 4 blockers** de l'audit (BUG-001, BUG-002, BUG-003) et le 4e (BUG-004) se manifeste précisément comme un défaut de robustesse (dégradation silencieuse / pile de résilience morte). Deux constats interdisent une note inférieure :

- **Échec garanti, silencieux, sur un chemin nominal** : un post programmé n'est jamais publié (BUG-003) et un job vidéo/audio « réussit » sans artefact (BUG-004/MISS-011). Ce sont des échecs **invisibles** côté opérateur — la définition même du `critical`/`blocker` (échec silencieux + résultat attendu impossible).
- **Le risque devient destructif dès le déblocage** : corriger BUG-003 (brancher le scheduler) **active** simultanément BUG-038 / MISS-006 / MISS-028 → publication d'un post annulé ou **double-publication sur de vrais comptes clients Instagram**, et BUG-039 (mauvais compte) + BUG-040 (contournement dry_run) aggravent. La robustesse de l'état DB doit être réparée **avant** d'activer la planification.

La parité live de la robustesse de génération est par ailleurs **non démontrable au gel** (live throw avant réseau) : tout chemin de résistance aux pannes externes OpenAI/Higgsfield reste `broken by default`.

---

## 6. Recommandations (actionnables, priorisées)

### P0 — Débloquer + sécuriser avant toute mise en route (ne pas activer le scheduler sans 6.2)

1. **Brancher le worker de planification de façon sûre** (BUG-003) : appeler `runScheduledPublishJobs` (limite bornée) depuis `/api/cron/tick`, OU enregistrer un cron PM2/système POSTant `/api/cron/content-studio/social-publish-scheduler` avec `Bearer CRON_SECRET` chaque minute. Critère de fin : un post programmé en mock passe `queued → published` automatiquement, vérifié en exerçant.
2. **Réparer l'intégrité d'état AVANT d'activer (6.1)** (BUG-038, MISS-006, MISS-028) : `cancelScheduledPost` doit transitionner le job `queued → cancelled` ; `reschedulePost` doit muter (pas dupliquer) le job ; `publish-now` doit annuler tout job programmé préexistant du même post (clé d'idempotence unifiée par post, pas par horaire). Critère : impossible de produire deux publications pour un même post.
3. **Débloquer OpenAI live côté opérateur** (BUG-001, BUG-005) — correctif bon marché : ajouter `?? env.OPENAI_API_KEY` (et déclarer `OPENAI_API_KEY` dans `env.ts`) dans la chaîne de résolution de `image-generation.ts` et `generation.ts` ; remplacer les `??` par un test de chaîne non vide. Critère : image + texte LLM réels générés en live, vérifiés en exerçant.

### P1 — Robustesse réseau et contrat

4. **Imposer un garde-temps sur TOUS les `fetch` externes du flux B** (BUG-001) : helper `fetchWithTimeout(AbortSignal.timeout(...))` sur `callOpenAiImage` (`image-generation.ts:121`) et `generateForIdea` (`generation.ts:75`). Critère : un provider pendant est coupé < 60 s et renvoie une erreur claire.
5. **Réécrire le contrat Higgsfield en async** (BUG-008, BUG-025) : submit `/v1/image2video/<model>` / `/v1/text2image/<model>` + poll `/v1/requests/{id}/status` ; adapter le parsing ; **réécrire les tests contre le vrai contrat**. Tant que non validé contre un credential `KEY_ID:KEY_SECRET` complet : **désactiver/masquer** le mode live Higgsfield dans le picker (cf. BUG-007/009/024).
6. **Décommissionner ou garde-fouter `/postiz-draft`** (BUG-040) : renvoyer 410 Gone, ou router via `resolveDefaultAccount` + respecter `SOCIAL_PUBLISHING_MODE`. Critère : aucun chemin ne poste réellement en dry_run.

### P2 — Contrat d'erreur et dégradation explicite

7. **Instaurer un contrat d'erreur du graphe** (BUG-004, MISS-011) : tout nœud média qui produit `url: ''`/asset vide DOIT pousser dans `state.errors` et le quality-gate DOIT dégrader le statut (`failed`/`degraded`). Critère : un job sans média réel ne peut JAMAIS finir `completed`.
8. **Écrire un `generation_run` en échec** (BUG-001, MISS-020) : sur throw de `generateStudioImage`/`generateStudioVideo`, insérer une ligne `status: 'failed'` avec `errorMessage` + coût estimé, dans une transaction englobant brief/drafts pour BUG-051. Critère : tout échec de génération est traçable dans le ledger.
9. **Remonter les échecs de génération à l'opérateur** (BUG-022, BUG-020) : brancher une branche `else`/`catch` avec `toast.error(formatError(...))` et un état « échec — réessayer » dans `CreateWorkspace.tsx`.
10. **Forcer la sélection de compte en live** (BUG-039) : sélection explicite obligatoire dans `PublishActionGroup`, OU exiger `SOCIAL_PUBLISHING_DEFAULT_ACCOUNT_ID` et échouer (`invalid_state`) si live + plusieurs comptes sans pin.

### P3 — Hygiène d'erreur, observabilité, récupération

11. **Aligner les frontières de validation** (BUG-014) : mapper/restreindre les enums `tone` UI↔DTO↔`parse-brief` ; valider dès la route avec message clair.
12. **Corriger le typage d'erreur HTTP** (BUG-060, BUG-051, BUG-054) : `formData()` dans un try/catch → `invalid_input` 400 ; transitions illégales → `HttpError` 409 ; préférer `e.message` serveur pour `invalid_state`.
13. **Durcir le gate CI sur la robustesse de test** (BUG-010, BUG-032) : traiter tout `EXIT != 0` et tout `Errors N error` comme un échec ; drainer les timers (`afterEach(vi.clearAllTimers/useRealTimers/restoreAllMocks)`).
14. **Permettre la récupération sans restart** (MISS-030, MISS-033, BUG-043) : invalider `getEngineConfig`/`resolvedKeyCache`/`modelCache` sur changement d'env, ou exposer une route d'invalidation ; documenter à défaut.
15. **Appliquer les specs de transcodage** (BUG-058, BUG-059) : enforcer `maxFileSizeMb`/`codec`, re-encoder en `libx264` lors du mux audio plutôt que `-c:v copy`.

---

## 7. Points à vérifier sous tous les angles (avant de déclarer l'axe « vert »)

> Conformément au DoD global : prouvé en mock **ET** en live par un chemin opérateur, jamais « fait ».

- [ ] Tuer/ralentir OpenAI (ex. proxy renvoyant 500/timeout) → la requête opérateur est coupée < 60 s, `generation_run` `failed` écrit, toast d'erreur affiché.
- [ ] Higgsfield 429/5xx → retry borné OBSERVÉ, puis échec propre `retryable`.
- [ ] Postiz 500 transitoire → `fetchWithRetry` rejoue puis le job passe `failed` retryable (vérifier aussi qu'un timeout/abort existe sur les appels Postiz `listIntegrations`/`upload`/`posts` — actuellement **aucun garde-temps**).
- [ ] Post programmé en mock → publié automatiquement à échéance (BUG-003) ; puis post programmé **puis annulé** → JAMAIS publié (BUG-038) ; post **publish-now puis échéance** → publié UNE SEULE fois (MISS-006).
- [ ] Job vidéo dont le média échoue → statut final **`failed`/`degraded`**, jamais `completed` (MISS-011).
- [ ] Run vitest → `EXIT 0` (BUG-010).
- [ ] Live multi-comptes sans pin → refus explicite, pas de publication implicite (BUG-039).
- [ ] `/postiz-draft` → 410 Gone ou respecte dry_run (BUG-040).
- [ ] Corriger une clé puis re-tenter sans redémarrer le process → succès (MISS-030/033).
