# Axe débogabilité

> Axe transversal de l'audit FemiGlow Content Studio v2 / AI Engine — pipeline génération + publication.
> Baseline figée : **2026-05-29**. Branche : `feat/ai-engine-langgraph-mvp`.
> Lentille : **pourquoi un bug d'usage réel n'est pas attrapé en amont** — observabilité, logs structurés, erreurs typées remontées à l'opérateur, traçabilité (`content_generation_run` / `social_publish_event`), corrélation, échecs silencieux, feedback UI sur échec.

---

## Fonctionnement optimal attendu (référentiel)

Un pipeline génération+publication « débogable » doit permettre, **à froid et sans relancer l'app**, de répondre à trois questions pour n'importe quel incident opérateur :

1. **Que s'est-il passé ?** — un log structuré (JSON, niveau, événement nommé) par étape clé (résolution de clé, appel provider, fallback, écriture média, publication), corrélé par un identifiant unique de requête/job qui traverse middleware → route → service → nœud → provider.
2. **Pourquoi ça a échoué ?** — une erreur **typée** (code + message + détails) à la fois (a) tracée côté serveur avec sa cause racine et (b) remontée à l'opérateur sous une forme actionnable (« clé manquante », « credential incomplet », « format non supporté »), jamais avalée ni masquée par un libellé générique.
3. **L'état du système le permettait-il ?** — un endpoint de santé/diagnostic qui reflète la **capacité réelle** (clé live résoluble ? credential Higgsfield complet ? scheduler branché ? provider TTS configuré ?), de sorte qu'un état « live cassé » soit visible **avant** que l'opérateur ne clique.

À cela s'ajoute le principe directeur de l'audit : **les tests doivent refléter le comportement réel** ; un échec d'usage doit produire un signal rouge (exit code, assertion, log d'erreur), pas un faux vert.

Le système réel s'écarte de chacune de ces trois exigences. Le diagnostic ci-dessous trace chaque écart à un finding confirmé.

---

## État actuel (constaté, avec preuves)

### 1. Deux loggers structurés divergents, jamais reliés

Deux implémentations de journalisation coexistent et ne partagent ni format, ni niveau, ni contexte :

- `src/lib/logging/logger.ts` — logger JSON avec redaction PII, niveaux, et un **contexte de corrélation** (`request_id`, `admin_id`, `route`, `ip_hash`) porté par `AsyncLocalStorage` via `withLogContext()`.
- `src/lib/ai-engine/utils/logger.ts` — `createLogger(module)` au format **texte** `[ts][LEVEL][ai-engine:module][job:xxxx][node:yyy]`, niveau piloté par une **autre** variable (`AI_ENGINE_LOG_LEVEL` au lieu de `LOG_LEVEL`), sans redaction PII, sans `request_id`.

Conséquence : impossible de corréler un log d'une route content-studio (pipeline B) avec un log de nœud AI-Engine (pipeline A) — formats, clés et identifiants sont disjoints. Cela calque exactement la fracture architecturale **A/B** des findings **BUG-015, BUG-026, BUG-033, BUG-047, BUG-048** : deux pipelines parallèles, donc deux régimes d'observabilité parallèles.

### 2. Le contexte de corrélation est du code mort

`withLogContext()` (le seul moyen de peupler `request_id` / `admin_id`) **n'est appelé nulle part** en dehors de sa propre définition :

```
$ grep -rn "withLogContext(" src/ --include=*.ts | grep -v "lib/logging/logger.ts" | grep -v test
(0 résultat)
```

Le `src/middleware.ts` génère bien un `nonce` CSP par requête mais **n'émet aucun `request_id`** et **n'enveloppe aucun handler** dans `withLogContext`. Tout log émis via `logger.*` part donc avec un contexte de corrélation **systématiquement vide**. Il est impossible, à partir d'un log, de remonter à la requête HTTP, à l'admin, ou de relier plusieurs étapes d'un même parcours.

### 3. Les routes de génération opérateur (pipeline B) ne loggent pas

Les deux routes que l'opérateur exerce réellement (cf. BUG-015) n'importent aucun logger :

- `src/app/api/admin/content-studio/drafts/[id]/generate-visual/route.ts` : `catch (err) { const { status, body } = formatErrorResponse(err); return NextResponse.json(body, { status }); }` — **aucun `logger`, aucun `console`**. Un `internal_error` (500) repart vers l'opérateur en « Erreur interne » sans **aucune** trace serveur de la cause.
- `src/app/api/admin/content-studio/ideas/[id]/generate/route.ts` : idem, catch → `formatErrorResponse`, sans journalisation.

À l'inverse `src/app/api/admin/ai-engine/generate/route.ts` (pipeline A, non utilisé par l'opérateur) utilise un `console.error('[ai-engine:generate] …')` brut — non structuré, non corrélé, et notamment pour l'échec du **bridge** qu'il qualifie explicitement de « non-blocking » (cf. BUG-034).

`src/lib/content-studio/*` n'utilise `@/lib/logging/logger` que dans `automation.ts` et `insights-worker.ts` (workers périphériques) — **jamais** dans le chemin de génération `generation.ts` / `service.ts` / `image-generation.ts` / `video-generation.ts`.

### 4. `formatErrorResponse` n'enregistre jamais la cause

`src/lib/errors/http-error.ts` : pour tout ce qui n'est pas un `HttpError`, `formatErrorResponse(err)` renvoie `{ status: 500, body: { error: { code: 'internal_error', message: 'Erreur interne' } } }` **sans logguer `err`**. La pile, le message et la cause de toute exception inattendue sont **perdus** au moment précis où ils sont le plus utiles. C'est le mécanisme générique qui transforme un bug réel en boîte noire 500.

### 5. Échecs silencieux côté UI : l'opérateur reste bloqué sans signal

- **BUG-022** — `CreateWorkspace.tsx` (`onCreated`, ~l.196-228) : la génération de variantes est appelée dans un `try { if (res.ok) { … } } catch { /* Generation failure is not blocking — user can retry. */ }`. **Aucune branche `else`** sur `!res.ok`, **catch vide**. Si la génération échoue (budget, provider, 500), l'idée est créée **sans variantes, sans toast, sans log** : l'opérateur est bloqué sans explication.
- **BUG-054** — `errors/messages.ts::formatError` écrase le message serveur utile par un libellé générique (« État de draft invalide ») avant même de considérer `e.message` ; l'opérateur perd la cause précise renvoyée par le serveur.
- **BUG-051** — re-générer une idée déjà `generated` lève une erreur générique non reconnue comme `HttpError` → **HTTP 500 opaque** au lieu d'un message actionnable.

### 6. Les nœuds AI-Engine signalent un succès en cas d'échec (échec invisible au quality-gate)

Vérifié en code : les blocs `catch` de `generate-voiceover.ts`, `generate-music.ts`, `generate-video.ts`, `compose.ts` retournent un asset `url:''` / `provider:'fallback'` puis loggent un message de **succès** trompeur (`log.info('Voiceover generated', …)`), et **n'ajoutent jamais d'entrée dans `state.errors`** (MISS-011). `routeAfterQuality` (routing) ne note que les scores texte (≥0.65 → `pass`). Résultat probé : job **`completed` quality 0.91** alors qu'aucun média audio/vidéo n'existe (BUG-004, BUG-012, BUG-013, BUG-030). Le contrat d'erreur du graphe est **structurellement absent** : le quality-gate ne peut jamais détecter un média manquant. C'est l'archétype du « tout-vert » qui ment, transposé du test au runtime.

### 7. Le rapport de tests ment sur l'état du process (le cas d'école de l'audit)

`evidence/vitest-summary.json` : **1695 passed / 0 failed**, mais **`processExitCode: 1`** (unhandled rejection sur un test fake-timer de polling Higgsfield). Findings **BUG-010, BUG-027, BUG-032**. Un *gate* CI lisant la ligne de résumé conclut « tout vert » ; seul le code de sortie révèle l'échec. C'est la débogabilité **inversée** : l'outil censé détecter les régressions masque activement un défaut. Causes aggravantes : absence d'`afterEach` global (`vi.clearAllTimers()`/`restoreAllMocks()`), et `vitest.setup.ts` qui mocke globalement `next/navigation` (push/replace/refresh = no-op, MISS-031) — donc des assertions « après publish, refresh de la liste » passent sans rien prouver.

### 8. Aucune doublure fidèle ni harnais de parité mock/live

MSW 2.x est installé et un serveur existe (`src/test/msw/server.ts`) avec un contract test des **routes internes** (`content-studio-handlers.contract.test.ts`), mais **aucun handler n'est calqué sur l'OpenAPI réel des providers externes** (OpenAI/Higgsfield/Postiz) et MSW **n'est pas monté en harnais global** (BUG-041, BUG-045, BUG-046, MISS-008). Les tests « live » mockent des credentials idéaux (`hf_test:secret_test`) et des endpoints **synchrones fictifs** (`/v1/videos/generate`) qui ne correspondent pas à l'API async réelle (BUG-008, BUG-025, MISS-009) ; ils restent verts quoi qu'il arrive en prod. Conséquence débogabilité : il n'existe **aucun filet** qui révélerait la divergence contrat/réalité avant qu'un opérateur ne la rencontre en live.

### 9. La traçabilité persistée existe mais est partielle, non corrélée et trompeuse

- `content_generation_run` (`schema-content-studio.ts:134`) capture `provider`, `model`, `status`, `costCents`, `errorMessage`, `input`/`output` — **mais aucun `request_id`/`correlation_id`** et **aucun lien vers un job ou un parcours**. Pour le texte opérateur, la ligne est toujours `provider=fallback, model=deterministic-template, cost=0` (BUG-005, BUG-020, MISS-012) : la trace dit « réussi » alors que rien n'a été généré par un LLM. Le modèle choisi dans le picker n'y est même pas conservé (MISS-012).
- `social_publish_event` (`schema-social-publishing.ts:142`) est conçu comme journal de cycle de vie d'un `social_publish_job` (type/message/metadata/actor) — **mais le scheduler n'étant branché à aucun cron** (BUG-003), aucun événement d'exécution n'est jamais émis pour un post programmé : le job reste `queued` indéfiniment, **sans la moindre trace** d'échec ou de tentative. La programmation est un accusé de réception inerte et **muet**.
- `buildSocialContent` force `metadata.dryRun=true` même en mode live (BUG-065) : la trace persistée **ment** sur le mode réel.

### 10. Aucun diagnostic de capacité (health) ne reflète l'état « live cassé »

`GET /api/admin/content-studio/health` n'expose que `mockMode` (lu de `CONTENT_STUDIO_V2_MOCK_MODE`). Il **ne vérifie pas** : clé OpenAI résoluble côté flux create, complétude du credential Higgsfield, branchement du scheduler, provider TTS. Or l'état runtime réel (`evidence/runtime-env-state.md`) est : `CONTENT_STUDIO_OPENAI_API_KEY` **vide**, `AI_ENGINE_HIGGSFIELD_API_SECRET` **absent**, `OPENAI_API_KEY` présent mais **non mappé dans `env.ts`** ni lu par le pipeline B. Aucun signal n'avertit l'opérateur que **tout** parcours live va échouer (BUG-001, BUG-002, BUG-006, BUG-007, BUG-011, BUG-024). Pire, le picker affiche un badge **« Live » mensonger** sur des modèles non générables (BUG-006, BUG-007, BUG-024, BUG-043) : l'indicateur de capacité existe… et il est faux.

### 11. Caches mémoire silencieux qui figent l'état observé

- `model-discovery` : cache in-process TTL 5 min sans invalidation au changement de clé → le picker peut servir « live » depuis un cache périmé (BUG-043, MISS-030).
- `api-key-manager` : `resolvedKeyCache` TTL 5 min, invalidé seulement sur save/delete DB, pas sur changement d'env (MISS-030).
- `engine-config` : config en **singleton module** (`if (_config) return _config`) → changer provider/clé n'a aucun effet sans redémarrage process ; `resetEngineConfig` n'est appelé par aucun chemin runtime (MISS-033).

Ces caches rendent le système **non observable en temps réel** : ce que l'opérateur voit peut diverger de la config réelle pendant 5 min ou jusqu'au prochain restart PM2, sans aucune trace de l'écart.

### 12. Couplage de chemin média fragile, non journalisé

`MEDIA_DIR = join(process.cwd(),'../../.media-storage/ai-engine')` (nœuds AI-Engine) dépend du `cwd` du process (MISS-024, MISS-032). Aucun log n'indique le chemin effectif résolu ; un changement de `cwd` (cron, worker, build standalone) ferait écrire/servir ailleurs **silencieusement**. De plus les médias sont servis via `/_media` **sans authentification** (MISS-010) : un débogage par inspection d'URL expose des assets clients non publiés, et les tests polluent le stockage de prod avec des stubs de 10 octets (BUG-031, BUG-035) — bruit qui complique tout diagnostic « à la main » du répertoire média.

---

## Problèmes concrets (chacun tracé à un finding)

| # | Problème de débogabilité | Findings concernés |
|---|---|---|
| P1 | **Pas de corrélation** : `withLogContext`/`request_id` jamais câblés (code mort) ; impossible de relier middleware → route → service → nœud → provider. | observation transverse (logger.ts, middleware.ts) appuyant BUG-015, BUG-026, BUG-033, BUG-047, BUG-048 |
| P2 | **Deux loggers divergents** (format, niveau, clés) reflétant les deux pipelines non fusionnés ; aucune vue unifiée. | BUG-015, BUG-047, BUG-048 |
| P3 | **Routes opérateur muettes** : generate-visual et ideas/generate ne loggent rien ; `formatErrorResponse` n'enregistre jamais la cause d'un 500. | BUG-022, BUG-051, BUG-054 (+ http-error.ts) |
| P4 | **Échecs silencieux UI** : catch vide, pas de branche `!res.ok`, message serveur écrasé. | BUG-022, BUG-054, BUG-051 |
| P5 | **Échec média invisible au quality-gate** : nœuds loggent « generated » et renvoient un asset vide sans peupler `state.errors` ; job `completed` quality 0.91 sans média. | BUG-004, BUG-012, BUG-013, BUG-030, MISS-011 |
| P6 | **Le rapport de tests ment** : 1695 passed mais exit 1 ; mocks `next/navigation` neutralisent les assertions ; aucun afterEach de drain. | BUG-010, BUG-027, BUG-032, MISS-031 |
| P7 | **Aucune parité mock/live** : MSW non global, contrats providers fictifs, tests live verts contre endpoints synchrones faux. | BUG-008, BUG-018, BUG-025, BUG-041, BUG-045, BUG-046, MISS-008, MISS-009 |
| P8 | **Trace persistée partielle/trompeuse** : `content_generation_run` sans corrélation et figé en fallback ; `social_publish_event` jamais émis (scheduler absent) ; `dryRun=true` codé en dur en live. | BUG-003, BUG-005, BUG-020, BUG-065, MISS-012 |
| P9 | **Aucun diagnostic de capacité** : health ne reflète pas clé/credential/scheduler ; badge « Live » mensonger. | BUG-001, BUG-002, BUG-006, BUG-007, BUG-011, BUG-024, BUG-043 |
| P10 | **Caches mémoire silencieux** figent l'état observé sans trace de l'écart (5 min / restart). | BUG-043, MISS-030, MISS-033 |
| P11 | **Chemin média fragile + non journalisé + non authentifié** ; pollution de test du stockage prod. | BUG-031, BUG-035, MISS-010, MISS-024, MISS-032 |
| P12 | **Erreurs non typées en aval du picker** : ids custom/non routables atteignent le générateur sans validation tracée → 409 tardif et opaque. | BUG-019, BUG-028, MISS-015 |

---

## Causes racines

1. **Fracture architecturale A/B propagée à l'observabilité.** Deux pipelines (LangGraph vs create flow) jamais fusionnés ⇒ deux loggers, deux régimes de trace, un bridge unidirectionnel qui avale ses propres erreurs (« non-blocking »). La débogabilité a hérité de la dette d'architecture, pas l'inverse. (BUG-015, BUG-026, BUG-033, BUG-034, BUG-047, BUG-048)

2. **L'observabilité a été *écrite mais jamais câblée*.** Le bon outillage existe (logger JSON avec redaction, `AsyncLocalStorage`, tables de trace, MSW, contract test) mais reste **non monté** : `withLogContext` jamais appelé, MSW jamais global, `social_publish_event` jamais alimenté, health réduit à `mockMode`. C'est une dette d'**intégration**, pas d'absence — donc bon marché à résorber, mais aujourd'hui inopérante.

3. **Le contrat d'erreur est implicite et permissif.** Les couches choisissent le silence par défaut : `catch {}` vide (UI), `formatErrorResponse` sans log (route), asset vide + log « success » (nœud), `state.errors` jamais peuplé (graphe). Aucune convention « tout échec doit produire (a) une erreur typée remontée ET (b) une trace serveur corrélée » n'est imposée.

4. **Les tests valident la doublure, pas la réalité.** Mocks calqués sur le code (faux) et non sur la spec fournisseur, credentials idéaux, fake-timers mal drainés, gate CI sur la ligne de résumé. Le filet censé attraper les bugs en amont est étalonné pour rester vert. (BUG-010, BUG-018, BUG-041, BUG-046)

5. **L'état runtime n'est pas réifié.** Clés/credentials/mode/scheduler/provider TTS ne sont exposés par aucune surface de diagnostic ; les caches mémoire figent même l'état partiellement observable. Le système ne peut pas se décrire lui-même, donc on ne peut pas savoir « pourquoi ça ne marche pas » sans lire le code et inspecter `/proc/<pid>/environ`. (runtime-env-state.md, BUG-043, MISS-030, MISS-033)

---

## Points à vérifier (sous tous les angles)

- **Corrélation** : vérifier qu'aucun chemin ne peuple `request_id` (confirmé : 0 appelant de `withLogContext`). Étendre au-delà du pipeline génération : tout l'admin partage ce trou.
- **Niveaux de log incohérents** : `LOG_LEVEL` (logger.ts) vs `AI_ENGINE_LOG_LEVEL` (ai-engine logger) — un opérateur qui baisse l'un n'affecte pas l'autre.
- **Redaction PII** : le logger ai-engine n'a **aucune** redaction ; vérifier qu'aucun `data:{…}` de nœud ne logge de contenu client/clé en clair (le logging.ts redige `apikey/secret/token` mais pas le logger A).
- **Exposition des erreurs provider** : confirmer qu'un échec OpenAI/Higgsfield réel (quota, 4xx) serait tracé avec le code HTTP amont — aujourd'hui non, car le live n'est pas atteignable et le catch ne logge pas.
- **`/_media` sans auth** : re-vérifier sous l'utilisateur runtime PM2 (MISS-010) et confirmer qu'aucun asset client non publié n'est devinable.
- **Cohérence trace ↔ réalité** : `content_generation_run.status='succeeded'` alors que `provider=fallback` ⇒ définir si « fallback » doit être un statut distinct observable.
- **`dryRun` dans la trace** : `buildSocialContent` force `true` (BUG-065) — vérifier l'impact sur tout dashboard/alerte qui s'y fierait.
- **Gate CI** : confirmer que la CI lit le **code de sortie** et pas seulement le JSON de résumé (sinon BUG-010 reste invisible).

---

## Criticité (justifiée)

**Criticité de l'axe : `critical`.**

Justification : l'axe débogabilité ne contient pas de *blocker* en propre (aucun parcours opérateur n'est bloqué *par* l'absence de logs), mais il est le **multiplicateur** des 4 blockers et 8 critical confirmés. Concrètement :

- Les blockers **BUG-001/002/003/004** sont précisément des bugs qui **auraient dû être attrapés en amont** et qui, en prod, seraient **très coûteux à diagnostiquer** : un opérateur face à un 409 « invalid_state » ou à un post programmé qui ne part jamais n'a **aucune trace corrélée**, **aucun diagnostic de capacité**, et un **rapport de tests vert** qui contredit son vécu. C'est exactement le « décalage test↔réalité » que l'audit cible.
- L'échec média invisible au quality-gate (P5) et la trace trompeuse (P8) créent un risque d'**échec silencieux** (catégorie `critical` de l'échelle) : un job « réussi » sans média, une trace qui dit « publié/dry_run » à tort.
- Le seul élément qui retient la note en deçà de `blocker` : la débogabilité dégradée n'empêche pas *en soi* d'obtenir un résultat ; elle empêche de **comprendre** l'absence de résultat. L'impact est donc systémique et aggravant plutôt que bloquant au sens strict.

---

## Recommandations (actionnables, priorisées)

### P0 — Rendre le « live cassé » visible et arrêter de mentir (faible coût, fort impact)

1. **Logger toute exception non typée.** Dans `formatErrorResponse` (ou un wrapper de route partagé), émettre `logger.error('route_error', { code, route, err })` avant de renvoyer le 500. Référence : http-error.ts, P3. *DoD* : un `internal_error` produit une ligne de log error corrélée, vérifié en mock ET en provoquant un 500 réel.
2. **Câbler la corrélation.** Dans `middleware.ts`, générer un `request_id` (réutiliser le pattern du nonce), le poser en en-tête de réponse `x-request-id`, et envelopper les handlers admin via `withLogContext({ request_id, admin_id, route })`. Référence : P1/P2. *DoD* : un log de route et un log de nœud du même parcours partagent le `request_id`.
3. **Faire échouer le quality-gate sur média manquant.** Les nœuds média doivent `push` dans `state.errors` au lieu de logger « generated » ; `routeAfterQuality` doit dégrader le statut si `state.errors` non vide. Référence : P5, MISS-011, BUG-004/012/013/030. *DoD* : un job sans MP4 finit `failed`/`degraded`, jamais `completed 0.91`.
4. **Enrichir `/health` (ou ajouter `/diagnostics`).** Exposer (booléens, sans fuite de valeur) : `openaiKeyResolvableForCreateFlow`, `higgsfieldCredentialComplete`, `schedulerWired`, `ttsProviderConfigured`, `socialMode`. Référence : P9, runtime-env-state.md. *DoD* : l'endpoint renvoie `false` aujourd'hui sur les trois premiers et `true` après le correctif BUG-001.
5. **Aligner le badge picker sur la capacité réelle** (propager `r.source` au lieu de forcer `'live'`) et **distinguer `cache`/`live`/`fallback`**. Référence : BUG-006/007/024/043. *DoD* : aucun modèle non générable n'affiche « Live ».

### P1 — Supprimer les échecs silencieux côté opérateur

6. **Brancher `!res.ok` et supprimer le `catch {}` vide** dans `CreateWorkspace.onCreated` : toast d'erreur + état d'échec + bouton réessayer. Référence : BUG-022, P4. *DoD* : une génération qui échoue affiche une erreur, en mock ET en live.
7. **Cesser d'écraser le message serveur** dans `formatError` (considérer `e.message` avant le libellé mappé). Référence : BUG-054.
8. **Mapper les erreurs d'état attendues en `HttpError`** (re-génération idée déjà generated → `invalid_state` actionnable, pas 500). Référence : BUG-051.

### P2 — Restaurer la fiabilité du signal de test

9. **Gate CI sur le code de sortie**, pas la ligne de résumé ; ajouter `afterEach(() => { vi.clearAllTimers(); vi.restoreAllMocks(); })` global ; drainer les timers avant l'assertion de rejet. Référence : BUG-010/027/032, P6. *DoD* : `pnpm vitest run; echo $?` = 0.
10. **Monter MSW en harnais global** et ajouter des **contract tests calqués sur l'OpenAPI réel** d'OpenAI/Higgsfield/Postiz (endpoints **async** Higgsfield, shape Postiz réelle). Référence : BUG-008/025/041/045/046, MISS-008/009, P7. *DoD* : un test rouge dès que le code parle à un endpoint synchrone fictif.

### P3 — Unifier et durcir l'observabilité

11. **Un seul logger** (migrer ai-engine vers `@/lib/logging/logger`, conserver les champs `jobId/node/provider/durationMs/costCents` en `fields`) — format, niveau (`LOG_LEVEL` unique) et redaction PII communs. Référence : P2.
12. **Tracer le mode réel** : `buildSocialContent` doit refléter le mode résolu, pas `dryRun=true` codé en dur (BUG-065) ; `content_generation_run` doit porter le `request_id` et un statut `fallback` distinct de `succeeded` (BUG-005/020, MISS-012).
13. **Invalider/observer les caches** : log au service depuis cache vs live ; invalidation des caches clé/modèle sur changement d'env (ou TTL court + en-tête `x-cache`), `resetEngineConfig` appelable à chaud. Référence : P10, BUG-043, MISS-030/033.
14. **Sécuriser et journaliser `/_media`** (auth admin pour les assets non publiés) et **isoler le stockage de test** (tmpdir, chemin absolu paramétré) pour ne plus polluer la prod. Référence : P11, MISS-010, BUG-031/035, MISS-024/032.
