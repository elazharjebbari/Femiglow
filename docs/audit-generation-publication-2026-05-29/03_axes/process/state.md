# Axe process

> Diagnostic transversal — Phase 2. Baseline figée **2026-05-29**, branche `feat/ai-engine-langgraph-mvp`.
> Lentille : **processus de dev / CI / qualité / configuration** — comment le pipeline génération+publication est validé, livré et exploité, et pourquoi le voyant « tout vert » ment.
> Principe directeur appliqué (cf. `01_methodology.md` §1) : *la vérité c'est le comportement réel exercé par l'opérateur, pas le rapport de la suite de tests*. Cet axe est précisément l'axe qui mesure l'écart entre les deux.

Toutes les affirmations ci-dessous sont tracées à un finding confirmé (`BUG-xxx`) du registre Phase 1 (`01_audit/bug-register.csv`, `gap-matrix.csv`, `mock-live-parity.csv`, `missed-issues.csv`) et/ou à une preuve archivée dans `01_audit/evidence/`.

---

## Etat actuel (constaté, avec preuves)

L'axe process est aujourd'hui **le maillon faible structurel** de tout le pipeline : c'est lui qui a laissé passer les 4 blockers et 12 critiques en production de staging avec un signal CI réputé vert. Le constat se décompose en six mécanismes observés.

### 1. La porte de qualité (CI gate) est verte alors que le process échoue (exit 1)

- `pnpm exec vitest run …` rapporte **1695 passed / 0 failed / `success:true`** dans le JSON, **mais le process sort en `VITEST_EXIT=1`**.
  Preuve : `evidence/vitest-summary.json` (`numPassedTests:1695`, `processExitCode:1`) et `evidence/vitest-run.txt` (queue de log) :
  > `Test Files 137 passed (137) / Tests 1695 passed (1695) / Errors 1 error … VITEST_EXIT=1`
  > `⎯ Unhandled Rejection ⎯ Error: Higgsfield video failed: content policy violation … video-generation.ts:206`
- Cause technique : promesse rejetée orpheline sous fake-timers dans `video-generation.test.ts` (« polling status=failed »), non drainée avant `useRealTimers()`, aucun `afterEach` global ne fait `vi.clearAllTimers()/restoreAllMocks()` → **BUG-010, BUG-027, BUG-032**.
- Conséquence process : tout orchestrateur (ou humain) qui lit la **ligne de résumé** ou le **JSON** conclut « sain » ; seul le **code retour** révèle l'anomalie. La CI (`.github/workflows/ci.yml` step « Tests vitest » = `pnpm -r test`) **propagerait** ce code retour 1 — mais le décalage de perception est total : l'équipe a livré en croyant la suite verte. C'est l'archétype documenté du *test qui ment*.

### 2. Les tests ne reflètent pas le LIVE — ils valident un contrat fictif

- **0 test sur ~95 du périmètre n'asserte un effet backend réel** ; les doublures `fetch` ne reflètent pas l'API live (**BUG-041**).
- Les nœuds AI-Engine (`generate-script/caption/variants.test.ts`) ne testent **QUE le fallback** : tous les mocks LLM sont `mockRejectedValue(new Error('No API key'))`. Le chemin LLM réel (parsing JSON, `scriptOutputSchema.parse`, calcul de coût, `response_format`) **n'est jamais exercé** → **BUG-018**.
- Les tests Higgsfield (`video-generation.test.ts:124`, `image-generation.test.ts:142/147`) sont écrits **autour d'endpoints synchrones inventés** (`/v1/videos/generate`, `/v1/images/generate`) que l'API réelle `platform.higgsfield.ai` (async, `/v1/image2video/<model>` + poll) ne possède pas. Les tests restent verts **indépendamment** de la réalité fournisseur → **BUG-008, BUG-025, BUG-041, MISS-008, MISS-009**.
- Les tests de montage (`compose.test.ts`, `transcode-export.test.ts`) mockent **intégralement** `sharp` + `fluent-ffmpeg` + `ffmpeg-static` + `node:fs/promises` : **zéro pixel/octet réel produit**, alors que ffmpeg/sharp sont réellement installés (`evidence/ffmpeg-binary-verification.md`) → **BUG-035**.
- La publication n'a **aucun filet de parité** : les fixtures Postiz et l'adapter `dry-run` renvoient des permaliens/shapes (`social.example.test/.../draft/<hash>`, `status:'SENT'`) qui n'existent pas chez Postiz, et **aucun test ne confronte `dry-run` ↔ `PostizSocialPublishingAdapter`** → **BUG-037, BUG-045**.

### 3. Absence de harnais de parité MOCK/LIVE

- MSW **est** installé (`src/test/msw/server.ts`) et il existe **un** contract-test (`content-studio-handlers.contract.test.ts`), mais il valide **uniquement les routes internes** content-studio contre des schémas Zod. **Aucun contract-test n'asservit les handlers OpenAI/Higgsfield/Postiz à l'OpenAPI fournisseur réel** → **BUG-046, MISS-008**.
- `vitest.setup.ts` **ne monte pas de `setupServer` MSW global** ; chaque test choisit (ou non) un handler, et ~42 fichiers mockent `fetch` directement. Il n'existe **aucune politique « tout réseau passe par MSW »** → **BUG-046**.
- Les mocks globaux du setup (`next/navigation` push/replace/refresh = no-op, `next/font`) sont choisis **pour faire passer les tests RTL**, pas pour la fidélité : un test « après publish, refresh de la liste » passe **sans rien prouver** → **BUG-046, MISS-031**.
- Conséquence directe : **le toggle MOCK/LIVE de l'UI n'est validé dans aucun des deux modes de façon fidèle**. Le DoD global (« passe à l'identique en MOCK ET en LIVE ») est **inatteignable avec l'outillage actuel**.

### 4. Aucun smoke-test orienté opérateur dans la CI

- Le parcours opérateur réel (`/admin/content-studio-v2/create`) **n'est couvert end-to-end par aucun test vert fiable** :
  - `create-mock-video.spec.ts:8` **échoue en timeout** : il clique « Générer un visuel IA » alors que le bouton vidéo dit « Générer une vidéo IA » (sélecteur obsolète) → **BUG-029, BUG-055**.
  - `content-studio-social-publishing-draft.spec.ts:25` **échoue** au teardown : `relation "audit_event" does not exist` (table réelle = `audit_events`) → **BUG-023, BUG-042, BUG-064**.
  - Preuve : `evidence/playwright-operator-journeys.txt` → `2 failed / 37 passed / PLAYWRIGHT_EXIT=1`.
- Il **existe** un script CLI `pnpm smoke:content-studio` (`scripts/smoke-content-studio.ts`), mais (a) il **n'est câblé dans aucun job CI** (absent de `ci.yml`), (b) il **refuse par défaut le mode non-mock** (`--allow-openai` requis), donc il **ne valide jamais le chemin LIVE**. Il n'existe **aucun smoke « idea → variants → image → publish-draft » exécuté en mock à chaque PR** qui assert l'effet backend.
- Le spec `generation-smoke.spec.ts` (« real backend ») existe et tourne, mais son diagnostic montre justement que l'image générée est un **mock** et que le picker sert des modèles `live` non générables (`evidence/playwright-operator-journeys.txt`, blocs DIAGNOSTIC) → il documente l'écart sans le faire échouer.

### 5. Drift de configuration : `.env` ↔ `env.ts` ↔ chaînes de résolution

- Une clé **`OPENAI_API_KEY` valide est présente dans le process** (`sk-`, 164 chars — `evidence/runtime-env-state.md`), **mais elle n'est ni déclarée ni mappée dans `src/lib/env.ts`** (vérifié : `env.ts` déclare `CONTENT_STUDIO_OPENAI_API_KEY`, `CHAT_OPENAI_API_KEY`, `AI_ENGINE_OPENAI_API_KEY`, mais **pas** `OPENAI_API_KEY`). Elle est donc **invisible** à l'objet `env` typé du flux create → **BUG-001, MISS-003, MISS-007**.
- Trois chaînes de résolution de clé **divergentes** coexistent :
  - flux create (pipeline B) : lecture brute de `env.CONTENT_STUDIO_OPENAI_API_KEY` (vide) → image/texte live **impossible** (**BUG-001, BUG-005, BUG-006**) ;
  - discovery du picker : `resolveApiKey('openai')` qui chaîne jusqu'à `OPENAI_API_KEY` (trouve la clé valide) → modèles affichés `live` (**BUG-007, BUG-043**) ;
  - AI-Engine (pipeline A) : `engine-config.ts` retombe sur `process.env.OPENAI_API_KEY` (**parité-live copywriting ligne 15**).
  → **Le picker promet du `live` que le moteur ne peut pas honorer.** Désynchronisation UI/réalité totale, de cause **process** (pas de source de vérité unique pour la résolution de credentials).
- `generation.ts:70` utilise `??` (ne neutralise pas la chaîne vide) là où le reste du repo utilise `if(val)`/`||` → bug latent qui **re-cassera la config LIVE même après ajout d'une clé** → **MISS-013**.
- **Aucune validation des credentials au boot** : toutes les vars sont `.optional()` dans `env.ts`, sans cross-check (ex. « si `AI_ENGINE_HIGGSFIELD_API_KEY` sans `:` alors `AI_ENGINE_HIGGSFIELD_API_SECRET` requis »). Le credential Higgsfield mono-partie (clé sans `:`, secret absent) passe silencieusement le boot et n'échoue qu'au premier appel → **BUG-002, BUG-008**. État env confirmé : `evidence/runtime-env-state.md`.
- Caches process figés sans invalidation : `getEngineConfig()` (singleton module) et `resolvedKeyCache`/`modelCache` (TTL 5 min) figent provider/clé pour la durée de vie du process PM2 → un changement `.env` **n'a aucun effet sans restart**, et la discovery sert `live` depuis un cache même quand la clé a disparu → **MISS-030, MISS-033, BUG-043**.

### 6. Le déclencheur de production n'est pas branché (déploiement ≠ exécution)

- La route `/api/cron/content-studio/social-publish-scheduler/route.ts` **existe** mais :
  - elle est **absente de `apps/web/vercel.json` `crons[]`** (vérifié : la liste contient `tick`, `media-optimize`, `tracking-purge`, `analytics-refresh`, … **jamais** `social-publish-scheduler`) ;
  - `/api/cron/tick/route.ts` **ne la relaie pas** (grep : aucune référence) ;
  - **staging tourne en PM2 / `next start`, pas sur Vercel** → même les crons listés dans `vercel.json` **ne sont pas honorés** ici ; aucun systemd timer / crontab / config PM2 ne cible cette route (grep : la seule occurrence hors `node_modules` est dans les docs d'audit eux-mêmes).
  → **La publication PROGRAMMÉE n'est exécutée par AUCUN déclencheur**, en mock comme en live → **BUG-003** (blocker confirmé). C'est un défaut de **process de déploiement/exploitation** : le code est livré mais jamais ordonnancé, et rien dans la CI ne vérifie la cohérence « toute route `/api/cron/*` a un déclencheur ».

---

## Problèmes concrets

Chaque ligne référence le(s) finding(s) confirmé(s).

| # | Problème (lentille process) | Findings |
|---|---|---|
| P1 | **Gate CI vert malgré exit 1.** Le résumé/JSON vitest dit `success:true` (1695 passed) tandis que le process sort 1 (unhandled rejection fake-timer non drainée). Aucun `afterEach` global de nettoyage de timers ; perception d'équipe « tout vert » fausse. | BUG-010, BUG-027, BUG-032 |
| P2 | **Tests écrits autour du code faux, pas de la spec fournisseur.** Endpoints Higgsfield synchrones inventés verrouillés par les mocks ; le chemin LLM réel jamais exercé (mocks toujours en rejet). | BUG-008, BUG-018, BUG-025, BUG-041, MISS-008, MISS-009 |
| P3 | **Montage 100 % mocké.** `sharp`/`fluent-ffmpeg`/`fs` intégralement mockés ; zéro octet réel ; pourtant les binaires sont installés (parité jamais établie). | BUG-035, BUG-031 |
| P4 | **Pollution du stockage média de PROD par les tests.** `MEDIA_DIR = join(process.cwd(),'../../.media-storage/ai-engine')` (chemin relatif partagé, pas de `tmpdir`) ; ~977 stubs `mock-image` de 10–14 o écrits par `orchestrator/generate-images/job-lifecycle/concurrent/security.test.ts`. Risque qu'un stub soit servi comme média réel. | BUG-031, MISS-004, MISS-024, MISS-032 |
| P5 | **Aucun harnais de parité MOCK/LIVE.** MSW présent mais non monté globalement ; contract-test limité aux routes internes, jamais aux providers externes ; pas de politique « tout réseau via MSW ». DoD « identique en mock+live » inatteignable. | BUG-045, BUG-046, BUG-037, MISS-008, MISS-031 |
| P6 | **Pas de smoke-test opérateur en CI.** Les 2 E2E qui couvrent le parcours réel échouent (sélecteur obsolète + nom de table erroné) ; le script smoke CLI n'est pas câblé en CI et refuse le live. Le parcours create→generate→publish n'est validé par aucun vert fiable. | BUG-023, BUG-029, BUG-042, BUG-055, BUG-064, BUG-047 |
| P7 | **Drift env : `.env` ↔ `env.ts` ↔ résolution de clés.** `OPENAI_API_KEY` valide présent mais non déclaré dans `env.ts` ; 3 chaînes de résolution divergentes ; picker `live` que le moteur ne peut honorer. | BUG-001, BUG-005, BUG-006, BUG-007, BUG-043, MISS-003, MISS-007 |
| P8 | **Pas de validation des credentials au boot.** Toutes les vars `.optional()`, aucun cross-check ; credential Higgsfield mono-partie passe le boot et n'échoue qu'à l'appel ; `??` masque la chaîne vide (bug latent post-fix). | BUG-002, BUG-008, MISS-013 |
| P9 | **Caches process figés sans invalidation env.** `getEngineConfig` singleton + caches clé/modèle TTL 5 min survivent en PM2 ; changement `.env` sans effet sans restart ; `live` servi depuis cache périmé. | BUG-043, MISS-030, MISS-033 |
| P10 | **Déploiement ≠ exécution : cron non branché.** Route scheduler absente de `vercel.json`, non relayée par `tick`, et staging PM2 n'honore pas Vercel. Aucune vérification CI « route cron → déclencheur ». Publication programmée morte. | BUG-003 |
| P11 | **Périmètre CI partiel + coverage opt-in.** Le step « Content Studio » de `ci.yml` n'inclut **pas** `src/lib/ai-engine/**` ; coverage v8 explicitement opt-in (`vitest.config.ts:19-31`), donc les 16 nœuds AI-Engine ne sont pas instrumentés. La couverture verte donne une fausse assurance sur un pipeline (A) jamais atteint par l'opérateur (B). | BUG-046, BUG-047, BUG-018 |
| P12 | **Routes legacy non décommissionnées sous garde-fou faible.** `/postiz-draft` (createDraftInPostiz) contourne `SOCIAL_PUBLISHING_MODE=dry_run` et touche l'API Postiz réelle ; aucune gate process ne l'a supprimée. | BUG-040 |

---

## Causes racines

1. **Tests écrits « autour » de l'implémentation, pas de la réalité.** La doublure est calquée sur le code (endpoints inventés, mocks en rejet), pas sur la spec fournisseur ni sur l'effet backend observable. C'est la racine commune de P2, P3, P5 et de l'illusion « tout vert ». Conséquence systémique : un test ne peut détecter un bug que le développeur n'a pas déjà anticipé dans le mock.

2. **Absence de définition de « réussite » au niveau process.** « Réussite » = ligne de résumé verte, pas « code retour 0 » ni « effet backend prouvé » ni « parité mock/live ». D'où P1 (exit 1 ignoré), P6 (pas de smoke opérateur), P11 (périmètre/coverage partiel). Le DoD du projet (méthodologie §4) n'a jamais été outillé.

3. **Pas de source de vérité unique pour la configuration runtime.** Trois mécanismes de résolution de credentials, un `env.ts` qui ne reflète pas le `.env` réel, des caches figés, aucune validation au boot. D'où P7, P8, P9 — et l'effet le plus pernicieux : l'UI annonce `live` ce que le moteur ne peut produire.

4. **Frontière déploiement/exploitation non testée.** Le code est livré (route créée, vercel.json existant) mais l'ordonnancement réel (PM2 vs Vercel) n'est ni cohérent ni vérifié. D'où P10. Personne ne possède l'invariant « toute route `/api/cron/*` exécutée par un déclencheur réel sur la cible de déploiement effective ».

5. **Dette d'architecture (deux pipelines A/B) répercutée sur le process.** Le test couvre massivement (A) LangGraph que l'opérateur n'emprunte jamais (B), donnant un faux sentiment de complétude (P11). La fusion jamais faite (cf. axes modularité/évolutivité) prive la CI d'un parcours opérateur unique à smoke-tester.

---

## Criticité (justifiée)

**Criticité de l'axe : `blocker`.**

Justification : l'axe process n'a pas qu'une dette propre — il est **la cause permissive** des 4 blockers et 12 critiques du registre. La preuve la plus forte est tenue dans `evidence/` :

- un **gate vert** (`success:true`, 1695 passed) coexiste avec un **process en échec** (`VITEST_EXIT=1`) et **2 E2E rouges** (`PLAYWRIGHT_EXIT=1`) sur le seul parcours opérateur ;
- un **blocker de production** (BUG-003, publication programmée jamais exécutée) qu'**aucun test ne couvre** parce que la frontière déploiement/exécution n'est pas dans le périmètre process ;
- une **génération LIVE 100 % cassée côté opérateur** (BUG-001/002/005/006) qu'**aucun test ne révèle** — au contraire les tests « live » verts donnent l'illusion inverse (BUG-011).

L'impact n'est pas cosmétique : tant que le process ne distingue pas « rapport vert » de « comportement réel prouvé en mock ET live », **toute correction de blocker peut régresser sans alerte**, et l'équipe continuera à livrer en croyant le système sain. C'est l'axe à corriger **en premier**, car il conditionne la fiabilité de la vérification de tous les autres.

---

## Recommandations (actionnables, priorisées)

> Critère de fin (DoD) pour chaque item : **prouvé en exerçant le chemin réel**, jamais « fait ». Toute recommandation de test doit échouer AVANT le correctif et passer APRÈS.

### P0 — Rendre le gate honnête (faible coût, fort impact)

1. **Faire échouer la CI sur le code retour, pas sur le résumé.** S'assurer que le step `Tests vitest` (`pnpm -r test`) et la collecte E2E propagent le code retour ; ajouter une assertion explicite `test -z "$(...)"` / `exit $?` et **interdire** tout `dangerouslyIgnoreUnhandledErrors`. Critère de fin : la suite actuelle **doit devenir rouge** (révéler BUG-010) avant d'être réparée. → P1.
2. **Réparer la fuite fake-timer puis poser un filet global.** Corriger `video-generation.test.ts` (drainer/`await` la promesse de poll) et ajouter dans `vitest.setup.ts` un `afterEach(() => { vi.clearAllTimers(); vi.restoreAllMocks(); })` global + `process.on('unhandledRejection')` qui fait échouer le run. → BUG-010, BUG-027, BUG-032.
3. **Corriger les 2 E2E du parcours opérateur** (sélecteur conditionnel `Générer une vidéo IA` ; nom de table `audit_events`) et **brancher le job E2E sur une DB de test au schéma réel**. Critère : `PLAYWRIGHT_EXIT=0` sur le parcours create→publish-draft. → BUG-023, BUG-029, BUG-042, BUG-055, BUG-064.

### P0 — Débloquer la config LIVE OpenAI (correctif bon marché, cf. `runtime-env-state.md`)

4. **Source de vérité unique pour la résolution de credentials.** Déclarer `OPENAI_API_KEY` dans `env.ts` (schéma + mapping runtime) et faire que le flux create (`image-generation.ts`, `generation.ts`) **réutilise `resolveApiKey('openai')`** (même chaîne que la discovery). Remplacer `??` par une neutralisation de chaîne vide (`if(val)`). Critère : générer un visuel image en LIVE depuis `/create` produit une vraie image (probe opérateur authentifiée). → BUG-001, BUG-005, BUG-006, BUG-007, MISS-003, MISS-007, MISS-013.
5. **Validation des credentials au boot** (fail-fast ou bannière admin) : cross-check `HIGGSFIELD_API_KEY` (`:` présent OU `_SECRET` fourni), cohérence picker `live` ↔ clé réellement lisible par le générateur. Critère : démarrage avec credential Higgsfield mono-partie → log d'avertissement explicite + badge UI « non générable », pas un throw 409 au 1er clic. → BUG-002, BUG-008.

### P1 — Brancher l'exécution de production

6. **Câbler le scheduler.** Soit l'ajouter à `vercel.json` `crons[]`, soit — vu que staging est PM2 — créer un **systemd timer / crontab** (ou un relais dans `/api/cron/tick`) appelant `/api/cron/content-studio/social-publish-scheduler` avec `CRON_SECRET`. **Ajouter un test/contrôle CI** « toute route `/api/cron/*` possède un déclencheur sur la cible de déploiement effective ». Critère : un post programmé à T+1 min passe `queued → published` sans appel manuel (probe). → BUG-003.

### P1 — Construire le harnais de parité MOCK/LIVE

7. **Monter MSW globalement** (`setupServer` dans `vitest.setup.ts`, politique « tout réseau passe par MSW, `onUnhandledRequest:'error'` »). → BUG-046.
8. **Contract-tests fournisseurs** (OpenAI, Higgsfield `platform.higgsfield.ai` async, Postiz) calqués sur l'OpenAPI/spec réelle, partagés entre handlers de test et code. Critère : un test échoue si le code appelle `/v1/videos/generate` (synchrone faux) au lieu du contrat async réel. → BUG-008, BUG-025, BUG-037, BUG-041, BUG-045, MISS-008, MISS-009.
9. **Tests d'intégration média réels** (ffmpeg/sharp installés) écrivant dans un `tmpdir` isolé, assertant des octets JPEG/MP4 valides ; **supprimer le chemin relatif `../../.media-storage`** des tests (injecter `MEDIA_DIR` via env) et purger les ~977 stubs. → BUG-031, BUG-035, MISS-004, MISS-024.

### P1 — Smoke-test opérateur en CI

10. **Smoke « parcours opérateur » exécuté à chaque PR, en mock**, assertant l'effet backend (idea→variants→generate-visual→approve→publish-draft dry_run), réutilisant la session Playwright officielle. Étendre `ci.yml` pour exécuter ce smoke (et inclure `src/lib/ai-engine/**` dans le périmètre vitest). → BUG-046, BUG-047, P6, P11.

### P2 — Hygiène de configuration et legacy

11. **Invalidation de cache** : exposer `resetEngineConfig`/`invalidateCache` sur un signal de reload, ou réduire/forcer le rafraîchissement au changement env ; documenter « restart PM2 requis » à défaut. → MISS-030, MISS-033, BUG-043.
12. **Décommissionner `/postiz-draft`** (route legacy hors garde-fou dry_run) ou la passer sous `SOCIAL_PUBLISHING_MODE`. Critère : aucune route ne touche Postiz réel en `dry_run`. → BUG-040.
13. **Centraliser le pricing** (registry/service/image-generation) pour cohérence budget/affichage/coût enregistré — dette process de duplication de constantes. → BUG-057.

> **Séquencement recommandé** : P0-1→3 (rendre le gate honnête) AVANT toute autre correction, sinon les corrections suivantes ne seront pas vérifiables. P0-4/5 ensuite (débloque le LIVE OpenAI à bas coût). Puis P1 (exécution prod + parité + smoke), enfin P2.
