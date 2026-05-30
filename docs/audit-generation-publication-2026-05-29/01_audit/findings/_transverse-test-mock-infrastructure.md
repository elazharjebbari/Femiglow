# Transverse — Infra de test & mocks (ou les tests mentent)

## Synthèse

## Verdict: l'infra de test MENT, de façon systémique et démontrable.

La suite affiche **1695 tests verts / 0 failed** (`/tmp/audit-vitest.json`) mais le **process sort EXIT 1** (`VITEST_EXIT=1`) à cause d'une **unhandled rejection** non rattrapée dans `video-generation.test.ts` (`Errors 1 error`, reproduite en isolation : `VITEST_ISOLATED_EXIT` montre 15 passed + 1 error). Un rapport tout-vert masque donc un échec process — l'illustration exacte du décalage test↔réalité.

**La méta-cause quantifiée : sur 95 fichiers de test du périmètre (content-studio + ai-engine + social-publishing), 0 assertent contre une vraie DB ou un vrai réseau ; 58 mockent `fetch`/providers.** Chaque chemin « live » (OpenAI, Higgsfield, Postiz) n'est exercé que contre une doublure `vi.spyOn(globalThis,'fetch').mockImplementation()` qui renvoie des formes inventées (`/videos/generate` → `{job_id}`, poll `/videos/status/` → `{status:'completed'}`). Ces formes **ne correspondent pas à l'API réelle Higgsfield** (async `/v1/text2image/<model>` + poll `/v1/requests/{id}/status`) ni au contrat OpenAI réel. Les tests « live » passent donc tout en testant un fantôme.

**MSW est installé** (`node_modules/msw`, 65 imports) mais en handlers ad-hoc par provider — **pas de harnais de parité mock/live** ni de validation de contrat contre l'API réelle. Aucun test ne compare la sortie mock à la sortie live.

**2 parcours opérateur cassés en MOCK** (`/tmp/audit-playwright.log`, 37 passed / 2 FAILED) : (1) `content-studio-social-publishing-draft.spec.ts` échoue sur `relation "audit_event" does not exist` — la vraie table est `audit_events` (pluriel, `schema.ts:268`), le test interroge le singulier : il **n'aurait jamais pu passer** contre la vraie DB ; (2) `create-mock-video.spec.ts` timeout 30s alors que le même flux produit bien un média dans le bloc diagnostic → **flakiness/race** non maîtrisée.

**Desync UI/réalité prouvé en live** : `GET /api/admin/content-studio/models?role=image` renvoie `gpt-image-1 source:"live"` (probe authentifié, 200) avec `discovery:{"openai":"cache"}` — servi depuis un **cache mémoire 5 min** populé antérieurement, alors que `ai_engine_api_keys` n'existe pas en DB et que `CONTENT_STUDIO_OPENAI_API_KEY` est VIDE. Pire : `image-generation.ts` lit `env.CONTENT_STUDIO_OPENAI_API_KEY` directement (l.87/98/111), pas le `resolveApiKey` DB du picker → le modèle proposé « live » **throw `invalid_state`** à l'usage. Le MOCK marche (assets MP4/PNG servis 200) ; le LIVE est non-fonctionnel et non détecté par les tests.

## Spécification (optimal attendu)

## Spécification — Infra de test & mocks (fonctionnement OPTIMAL attendu)

### Principe : un test vert DOIT impliquer une fonctionnalité réellement utilisable par l'opérateur

### 1. Intégrité du runner
- `vitest run` DOIT sortir EXIT 0 si et seulement si 0 failed ET 0 unhandled error. Toute `Errors N error` ou unhandled rejection DOIT faire échouer le run et la CI, jamais être masquée par `success:true` dans le JSON.
- `afterEach` global : `vi.clearAllTimers()`, `vi.useRealTimers()`, `vi.restoreAllMocks()`, `server.resetHandlers()` (MSW). Aucune promesse/timer ne survit à un test.
- Les tests à fake timers DOIVENT drainer toutes les itérations planifiées et `await` toutes les rejections AVANT `useRealTimers()`.

### 2. Fidélité des doublures (contract-first)
- Tout appel réseau (OpenAI, Higgsfield, Postiz) passe par une couche MSW GLOBALE montée dans `vitest.setup.ts`, avec `onUnhandledRequest:'error'`.
- Les handlers MSW sont calqués sur l'OpenAPI/contrat RÉEL du fournisseur : Higgsfield async (`POST /v1/text2image/<model>` → request id, poll `GET /v1/requests/{id}/status`), OpenAI Images (`/v1/images/generations` b64_json), Postiz (upload + posts + permalink shape réels).
- Un test de PARITÉ confronte, pour chaque scénario, la sortie de l'adapter mock/dry-run à la sortie de l'adapter live (mêmes statuts, mêmes codes d'erreur, même forme de permalink/remoteId).

### 3. Vérité côté opérateur
- Au moins un E2E par parcours opérateur exerce le chemin SANS mock réseau (smoke 'real backend'), gardé par la présence de credentials ; en leur absence il échoue explicitement avec un message clair (pas un faux vert).
- Les E2E DB référencent les vraies tables (audit_events, social_publish_job, social_publication) ; un job CI avec DATABASE_URL les exécute pour qu'un nom de table faux soit rouge immédiatement.
- Les assertions UI sont doublées d'une assertion d'effet backend (média créé, job en DB, audit event émis) — jamais UI seule.

### 4. Cohérence mock/live exposée à l'UI
- `source:'live'` n'est affiché QUE si la clé est résolue par la MÊME fonction que la génération l'utilise, ET la découverte est réellement 'live' (pas 'cache'). 'cache' a un libellé distinct.
- Le cache de découverte est invalidé au changement de clé ; à clé absente, la découverte renvoie 'fallback' et l'UI n'affiche pas 'Live'.

### 5. Couverture honnête
- `coverage.include` couvre TOUT le périmètre exercé par l'opérateur, y compris `src/lib/ai-engine/**` (les 16 nœuds) et le bridge.
- Le code mort côté opérateur (nœuds jamais atteints depuis l'UI) est détecté et documenté.

### 6. Modes explicites
- Chaque test déclare son MODE (mock|live) ; un test 'live' qui n'exerce qu'un mock est étiqueté 'mock' (pas 'live').
- Un dashboard distingue: tests asservis à un vrai effet vs tests asservis à un mock. La proportion mock-only doit être connue et bornée.

## État réel constaté

## État réel constaté (avec preuves)

### Le runner ment sur son propre statut
- `/tmp/audit-vitest.json`: `numTotalTests:1695, numPassedTests:1695, numFailedTests:0, success:true`.
- `/tmp/audit-vitest.log` (fin): `Tests 1695 passed (1695) | Errors 1 error` puis `VITEST_EXIT=1`.
- Unhandled Rejection: `Error: Higgsfield video failed: content policy violation ❯ generateHiggsfieldStudioVideo src/lib/content-studio/video-generation.ts:206:13`, originant de `video-generation.test.ts` test 'polling status=failed'.
- Reproduit en isolation: `pnpm exec vitest run src/lib/content-studio/video-generation.test.ts` → `15 passed (15) | Errors 1 error`.
- `vitest.setup.ts` n'a AUCUN `afterEach` qui clear timers/restore mocks globalement (seulement `cleanup()` RTL l.47-49).

### Quasi-zéro test exerce le réel
- Périmètre content-studio+ai-engine+social-publishing: **95 fichiers de test, 0 touchant une vraie DB/réseau, 58 mockant fetch/providers.**
- Les mocks live utilisent des endpoints synchrones inventés: `video-generation.test.ts:130 '/videos/generate'`, `:135 '/videos/status/'` — alors que le code (`video-generation.ts:157`) appelle `/v1/videos/generate` et l'API réelle est async `/v1/image2video/<model>` + poll `/v1/requests/{id}/status` (commentaire `video-generation.ts:153-155` + MEMORY higgsfield-api-mismatch).

### 2 parcours opérateur cassés en MOCK
- `/tmp/audit-playwright.log`: `37 passed / 2 FAILED`.
- (1) `content-studio-social-publishing-draft.spec.ts:25` → `PostgresError: relation "audit_event" does not exist` (l.227). Vraie table = `audit_events` (`schema.ts:268`; DB `to_regclass('audit_event')=NULL`, `audit_events` existe).
- (2) `create-mock-video.spec.ts:8` → `Test timeout 30000ms exceeded` sur le bouton 'Générer un visuel IA', alors que le bloc diagnostic du même run montre média créé (me_uu3topxhsoux2dwp) + toast 'Visuel IA généré' + assets servis 200 → race UI.

### MSW installé mais non câblé en harnais; mocks globaux trop larges
- `node_modules/msw` présent, 65 imports, handlers par feature (`src/test/msw/*`), MAIS `vitest.setup.ts` ne monte aucun `setupServer` global.
- `vitest.setup.ts:63-79` mocke `next/navigation` (useRouter no-op), `:51-55` next/font globalement.
- `vitest.config.ts:36-42` coverage.include = products/feed + content-studio, **PAS src/lib/ai-engine/nodes**.

### Desync UI/réalité prouvé en live (probes authentifiés)
- `GET /api/admin/content-studio/health` → 200 authed, 401 sans cookie (auth OK).
- `GET /models?role=image` → `gpt-image-1 ... source:'live'` avec `discovery:{"openai":"cache","higgsfield":"fallback","anthropic":"no-key"}`.
- Cause: `model-discovery.ts:356-359` cache mémoire TTL 5min (`MODEL_CACHE_TTL_MS`) ; `models/route.ts:72` transforme 'cache' en `source:'live'`.
- `ai_engine_api_keys` n'existe pas en DB (`to_regclass`=NULL) ; `.env CONTENT_STUDIO_OPENAI_API_KEY=<EMPTY>`, `AI_ENGINE_OPENAI_API_KEY`/`CHAT_OPENAI_API_KEY` non définis.
- `image-generation.ts:87/98/111` lit `env.CONTENT_STUDIO_OPENAI_API_KEY` directement → en live, `gpt-image-1` throw `invalid_state 'CONTENT_STUDIO_OPENAI_API_KEY manquant'`.
- `whisper-1` (STT) renvoyé sous `role=chat`.

### Live de génération = cassé aujourd'hui
- OpenAI: clé vide → throw invalid_state.
- Higgsfield: clé sans ':' (probe: contains colon? NO) + `AI_ENGINE_HIGGSFIELD_API_SECRET` non défini → `higgsfieldAuthHeader()`=null → throw 'credential incomplet' (`video-generation.ts:107-113`). Base URL: `.env` vide mais `env.ts:160` default `https://platform.higgsfield.ai` s'applique.

### Mock = fonctionnel
- Assets statiques servis: reel-9x16.mp4 (200, 62790 o), story-9x16.mp4, poster-9x16.jpg, sample-1080.png présents et 200.
- service.approval.test.ts (auto-bind visuel) vert; dry-run.test.ts (6) vert.

### Deux systèmes parallèles
- E2E opérateur (golden-path) n'appellent que (B) content-studio; voix-off/musique/sous-titres/compose de (A) AI-Engine ont des tests unitaires isolés verts mais ne sont atteints par aucun parcours opérateur E2E, et ne sont pas dans le coverage.

## Contrats

```yaml
domain: test-mock-infrastructure
description: >
  Contrats observés de l'infra de test et des doublures, avec divergence
  explicite entre comportement MOCK et LIVE constatée sur staging (2026-05-29).

runners:
  vitest:
    command: "pnpm exec vitest run"
    inputs: { include: "src/**/*.test.{ts,tsx}", setup: "vitest.setup.ts", env: jsdom }
    outputs:
      json_report: { numFailedTests: int, success: bool }
      process_exit_code: int
    observed_defect:
      success_json: true
      failed_tests: 0
      errors: 1            # unhandled rejection
      exit_code: 1         # contredit success:true
    expected: "exit_code==0 SSI failed==0 AND errors==0"
  playwright:
    command: "pnpm exec playwright test"
    setup_project: "e2e/global.setup.ts -> .auth/admin.json (storageState)"
    observed: { passed: 37, failed: 2 }
    failures:
      - spec: "content-studio-social-publishing-draft.spec.ts:25"
        cause: 'relation "audit_event" does not exist (vraie table: audit_events)'
      - spec: "create-mock-video.spec.ts:8"
        cause: "timeout 30s bouton Générer (race UI; média réellement créé)"

mock_layer:
  msw:
    installed: true
    global_server: false          # non monté dans vitest.setup.ts
    handlers: "src/test/msw/* (par feature, ad-hoc)"
    onUnhandledRequest: "non configuré (devrait être 'error')"
  direct_fetch_mocks:
    files_in_scope: 95
    files_mocking_fetch_or_providers: 58
    files_asserting_real_db_or_network: 0
  fidelity:
    higgsfield: "FAUX — mock endpoints synchrones /videos/generate & /videos/status/<id> ; API réelle async /v1/text2image|image2video/<model> + poll /v1/requests/{id}/status"
    openai: "mock fetch hand-crafted; pas de contract test"
    postiz: "fixtures inventées (status SENT/DRAFT, permalink instagram.com/p/abc123); dry-run permalink host fictif social.example.test"

api: /api/admin/content-studio/models
  method: GET
  auth: admin session (200 authed, 401 sans cookie)
  query: { role: chat|image|video, format?: ContentFormat }
  output:
    models: "ModelEntry[] avec source: live|cache->live|static|fallback"
    discovery: "{provider: live|cache|fallback|no-key|error}"
  observed_divergence:
    mock: "tests attendent 'fallback' sans clé"
    live: "renvoie source:'live' (discovery:'cache') pour gpt-image-1 alors qu'aucune clé n'est résoluble"
  key_resolution_inconsistency:
    discovery: "resolveApiKey() -> DB(ai_engine_api_keys, ABSENTE) puis env"
    generation: "image-generation.ts lit env.CONTENT_STUDIO_OPENAI_API_KEY directement"

generation:
  image:
    mock: { status: works, output: "/_media/content-studio/mock/sample-1080.png (200)" }
    live:
      status: broken
      error_code: invalid_state
      message: "CONTENT_STUDIO_OPENAI_API_KEY manquant (clé vide en staging)"
  video:
    mock: { status: works, output: "/_media/content-studio/mock/{reel,story}-9x16.mp4 (200)" }
    live:
      status: broken
      error_code: invalid_state
      message: "credential Higgsfield incomplet (clé sans ':' + secret absent)"
      secondary_defect: "endpoints synchrones faux même si credential complet"

publishing:
  mode_env: SOCIAL_PUBLISHING_MODE   # non défini -> dry_run
  dry_run:
    status: works
    permalink: "https://social.example.test/<platform>[/draft]/<remoteId>"   # host fictif
    remoteId: "dry_<sha256[0:18]>"
  postiz_live:
    status: untested                 # interdit de tester (vrais comptes clients)
    credentials_present: true        # POSTIZ_BASE_URL + POSTIZ_API_KEY

error_codes:
  invalid_state: "credential/clé manquant côté génération live"
  PostgresError relation does not exist: "E2E référence mauvaise table (audit_event)"
  Unhandled Rejection: "fake-timer leak -> exit 1 malgré success:true"
```
