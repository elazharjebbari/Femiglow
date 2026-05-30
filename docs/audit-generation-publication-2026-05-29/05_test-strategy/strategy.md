# Stratégie de test — FemiGlow Content Studio v2 / AI Engine

> Pipeline **génération + publication**. Baseline figée **2026-05-29**, branche `feat/ai-engine-langgraph-mvp`.
> Lentille : **point de vue opérateur** (celui qui clique dans `/admin/content-studio-v2/create`), niveau grosse agence tech.
> Cette stratégie **ferme le gap test↔réalité** identifié en Phase 1 (`01_audit/`). Chaque mécanisme proposé est tracé à un finding `BUG-xxx` / `MISS-xxx` confirmé.

---

## 0. Le principe directeur, transposé en règle de test (non négociable)

> **La vérité, c'est le comportement réel de l'application exercée par l'opérateur — pas le rapport de la suite de tests.** (`01_methodology.md` §1)

Conséquence pour cette stratégie, qui devient la **définition de fin (DoD)** de tout test :

1. **Un test n'a de valeur que s'il échoue AVANT le correctif et passe APRÈS.** Tout test ajouté ici doit d'abord rougir contre le code au gel (révéler le BUG), sinon il est un faux filet.
2. **Aucune assertion n'est valide si elle ne vérifie pas un effet observable côté opérateur ou backend** : un asset servi en HTTP 200, une ligne `content_generation_run` avec un `provider` réel, un `social_publish_job` qui transite, un toast d'erreur visible. Asserter qu'« un mock a répondu au mock » est interdit (c'est exactement la racine de BUG-041).
3. **Toute fonctionnalité doit être prouvée en mode MOCK ET en mode LIVE** par le **même scénario**. Tant qu'un chemin n'est pas prouvé dans les deux modes, il est `broken by default` (`untested ≠ works`).
4. **Le réseau externe est intercepté au niveau RÉSEAU par MSW** (jamais `vi.mock('node-fetch')` ni un double calqué sur le code). La doublure est calquée sur **l'OpenAPI/spec fournisseur réelle**, pas sur l'implémentation actuelle (qui est fausse — cf. BUG-008/025).
5. **Le gate échoue sur le code de sortie**, pas sur la ligne de résumé (BUG-010 : 1695 passed mais `exit 1`).

---

## 1. Pourquoi les tests actuels mentent — les 7 « mensonges de test » à fermer

L'audit Phase 1 a isolé sept familles de mensonge. La stratégie est structurée pour **fermer chacune** par un mécanisme nommé et traçable.

| # | Mensonge de test (Phase 1) | Findings | Mécanisme de fermeture (section) |
|---|---|---|---|
| M1 | **Le rapport ment sur le process** : 1695 « passed » mais `VITEST_EXIT=1` (unhandled rejection fake-timer non drainée). Un gate sur le résumé conclut « sain ». | BUG-010, BUG-027, BUG-032 | §4.1 (gate exit-code + `afterEach` global + `unhandledRejection→fail`) |
| M2 | **La doublure est calquée sur le code faux, pas sur la spec** : endpoints Higgsfield synchrones inventés (`/v1/videos/generate`) verrouillés par les mocks ; ils restent verts même si l'API réelle est async (`/v1/image2video/<model>` + poll). | BUG-008, BUG-025, BUG-041, MISS-008, MISS-009 | §5 (contrats MSW dérivés de la spec) + §6 (contract-tests) |
| M3 | **Seul le fallback est testé** : tous les mocks LLM des nœuds AI-Engine sont `mockRejectedValue('No API key')` → le chemin LLM réel (parsing JSON, `scriptOutputSchema.parse`, coût, `response_format`) n'est jamais exercé. | BUG-018 | §6.2 (cas succès LLM via MSW), §3.2 |
| M4 | **0/95 test n'asserte un effet backend réel** ; ~42-58 mockent `fetch` avec des formes inventées ; aucun test ne touche DB/réseau réel ni le point de vue opérateur. | BUG-041, BUG-011 | §3 (pyramide ré-ancrée sur l'effet) + §6 |
| M5 | **Le montage est 100 % mocké** : `sharp` + `fluent-ffmpeg` + `ffmpeg-static` + `node:fs/promises` intégralement remplacés → zéro octet réel, alors que les binaires sont installés. De plus les tests polluent le stockage prod (977 stubs 10-14 o). | BUG-031, BUG-035, MISS-004, MISS-024 | §7 (intégration média réelle en tmpdir isolé) |
| M6 | **Aucun parcours opérateur E2E vert fiable** : les 2 specs du parcours réel échouent (sélecteur obsolète `Générer un visuel IA` vs `Générer une vidéo IA` ; table `audit_event` inexistante vs `audit_events`). | BUG-023, BUG-029, BUG-042, BUG-055, BUG-064 | §8 (Playwright opérateur, mock+live) |
| M7 | **Aucun harnais de parité mock/live** : MSW installé mais non monté globalement ; le seul contract-test couvre les routes internes, jamais les providers externes ; fixtures Postiz/dry-run inventées ; le toggle Mock/Live n'est validé dans aucun mode fidèlement. | BUG-037, BUG-045, BUG-046, MISS-008, MISS-031 | §4.2 (MSW global), §9 (harnais de parité) |

---

## 2. Architecture de test cible (vue d'ensemble)

```
                          ┌───────────────────────────────────────────────┐
                          │  GATE CI honnête (exit-code, pas résumé)        │  §4.1  (M1)
                          └───────────────────────────────────────────────┘
   Coût ▲                                                         Fidélité ▲
        │   ┌─────────────────────────────────────────────────────────┐
   E2E  │   │  PLAYWRIGHT — parcours opérateur (idea→variants→média→    │   §8 (M6)
        │   │  approve→publish) en MOCK *et* en LIVE-gated. Assertions  │
        │   │  sur l'effet (asset 200, job transité, toast d'erreur).   │
        │   └─────────────────────────────────────────────────────────┘
        │   ┌─────────────────────────────────────────────────────────┐
  INTEG │   │  VITEST + MSW global — routes Next exercées de bout en    │   §3.3 §6
        │   │  bout, réseau externe via MSW calqué sur la spec réelle.  │   (M2,M4)
        │   │  + INTÉGRATION MÉDIA RÉELLE (ffmpeg/sharp, tmpdir isolé). │   §7 (M5)
        │   └─────────────────────────────────────────────────────────┘
        │   ┌─────────────────────────────────────────────────────────┐
 CONTRACT│  │  CONTRACT-TESTS providers (OpenAI/Higgsfield/Postiz) :    │   §6 (M2,M3)
        │   │  le MÊME handler MSW sert les tests ET valide le code     │
        │   │  contre la spec ; rouge si le code parle au mauvais       │
        │   │  endpoint (sync faux). + PARITÉ dry_run↔Postiz.           │   §9 (M7)
        │   └─────────────────────────────────────────────────────────┘
        │   ┌─────────────────────────────────────────────────────────┐
  UNIT  │   │  VITEST — logique pure (routing clé, enum tone, idempo-   │   §3.1
        │   │  tence, state-machine, parsing). Pas de réseau.           │
        ▼   └─────────────────────────────────────────────────────────┘
```

Outillage figé : **Vitest** (unit/intégration), **MSW 2.14.2** (interception réseau, déjà installé), **Playwright** (E2E opérateur), **ffmpeg-static/sharp réels** (intégration média). Aucun nouvel outil n'est requis — la dette est d'**intégration**, pas d'absence (cf. `debogabilite/state.md` cause racine #2).

---

## 3. Les trois types de test, ré-ancrés sur l'effet opérateur

### 3.1 Unitaire (Vitest, sans réseau) — logique pure, là où la racine est déterministe

Cible : les fonctions où le bug est **purement logique** et reproductible sans réseau. Chaque test doit rougir au gel.

- **Résolution de clé divergente** (`resolveApiKey` vs lecture brute `env.CONTENT_STUDIO_OPENAI_API_KEY`). Test : « le flux create doit résoudre `OPENAI_API_KEY` quand `CONTENT_STUDIO_OPENAI_API_KEY` est vide » → rouge au gel (BUG-001, BUG-005, MISS-003, MISS-007). Inclure le cas `''` (chaîne vide) pour fermer le `??` au lieu de `||` (MISS-013).
- **Enum `tone`** : table de parité UI (`TONES`) ↔ DTO route ↔ `parse-brief.ts` ; tout ton offert dans l'UI doit passer `parseBrief` (BUG-014).
- **Routing de modèle** : `gpt-image-*`/`hf-*`/`mock-*`/id-découvert/id-custom → provider attendu ou `invalid_state` typé (BUG-009, BUG-028, MISS-015, MISS-022).
- **Idempotence & state-machine** : clé indépendante de `scheduledAt` ; transitions interdites ; pas de second job au reschedule (MISS-006, MISS-028, BUG-038) ; transition `generated→generated` mappée en `409` métier, pas 500 (BUG-051).
- **`createDraftVariation`** : doit régénérer (ou au moins honorer `promptOverride`), pas cloner (BUG-017).

### 3.2 Intégration (Vitest + MSW global) — la route Next, du handler au provider

Cible : exercer la **vraie route App Router** (`POST /api/admin/content-studio/drafts/[id]/generate-visual`, `…/ideas/[id]/generate`, `…/posts/[id]/publish-now|schedule|draft-on-provider`) avec une session admin réelle, une DB de test, et le **réseau externe intercepté par MSW** (§5). On asserte l'**effet** : statut HTTP, corps, ET trace persistée (`content_generation_run.provider`, `social_publish_job.status`).

Règle anti-M4 : **chaque test d'intégration asserte au moins un effet backend** (ligne DB, asset, transition de job), jamais seulement la forme de la réponse mockée.

### 3.3 E2E (Playwright) — le clic réel de l'opérateur

Cible : le parcours `/admin/content-studio-v2/create` du point de vue humain, en **mock** (à chaque PR) et en **live-gated** (nightly / on-demand, cf. §8.3). Détail des parcours et sélecteurs : §8 et `playwright-journeys.md`.

---

## 4. Le socle : rendre le signal honnête (préalable à tout le reste)

> Séquencement (cf. `process/state.md` §Recommandations) : **§4 AVANT toute autre correction**, sinon les corrections suivantes ne sont pas vérifiables.

### 4.1 Gate sur le code de sortie + filet anti-fuite (ferme M1)

1. CI : le step de test **doit propager `$?`** ; bannir tout `dangerouslyIgnoreUnhandledErrors`. Ajouter une assertion `pnpm vitest run; test $? -eq 0`.
2. `vitest.setup.ts` : `afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); })` global + `process.on('unhandledRejection', (e) => { throw e })` qui fait **échouer** le run.
3. Corriger `video-generation.test.ts` (« polling status=failed ») : `await` / drainer la promesse de poll avant l'assertion de rejet.

*DoD :* la suite **devient rouge** au gel (révèle BUG-010), puis verte après correction ; `echo $?` = 0. → BUG-010, BUG-027, BUG-032.

### 4.2 MSW monté en harnais global (ferme M7, prérequis M2/M4)

`vitest.setup.ts` doit monter le serveur unique (`src/test/msw/server.ts`) en politique stricte :

```ts
import { server } from '@/test/msw/server';
beforeAll(() => server.listen({ onUnhandledRequest: 'error' })); // tout réseau non-stubé = ÉCHEC
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

`onUnhandledRequest:'error'` est la clé : il **interdit** tout appel réseau non décrit par un handler de spec, ce qui force l'équipe à modéliser chaque dépendance externe et **rend impossible** un test qui « passe » en tapant un endpoint fantôme. → BUG-046, MISS-031.

> Note : retirer/réduire les mocks globaux opportunistes de `vitest.setup.ts` (`next/navigation` no-op) au profit de mocks **locaux et explicites** dans les tests qui observent réellement une navigation, sinon un test « après publish, refresh de la liste » continue de passer sans rien prouver (MISS-031).

---

## 5. Couche MSW : doublures fidèles, au niveau réseau, calquées sur la spec réelle

Détail complet (formes de requête/réponse nominales ET erreurs) : **`msw-contracts.md`**. Principes :

- **Higgsfield = ASYNC** (submit + poll), host `platform.higgsfield.ai`, auth `Authorization: Key KEY_ID:KEY_SECRET`. Les handlers modélisent `POST /v1/text2image/<model>` / `POST /v1/image2video/<model>` → `{ id }`, puis `GET /v1/requests/{id}/status` → `in_progress` → `completed`. **Volontairement, AUCUN handler ne répond sur `/v1/videos/generate` ni `/v1/images/generate`** : ainsi le code actuel (sync faux) heurte `onUnhandledRequest:'error'` et **le test rougit** — c'est le filet qui ferme BUG-008/025/MISS-009.
- **OpenAI images** : `POST /v1/images/generations` → `{ data: [{ b64_json }] }` (le handler `openaiImageGenerationHandler` existe déjà et est correct ; on le réutilise). Variantes d'erreur : `content_policy_violation` (400), `rate_limit_exceeded` (429), `401`.
- **Postiz** : host réel `postiz.lumiereacademy.com`, auth `authorization: <clé brute>` (PAS `Bearer`). Handlers `GET /api/public/v1/integrations` (forme prouvée 200, 4 comptes), `POST /api/public/v1/upload` (multipart → `{ id, path }`), `POST /api/public/v1/posts` (type `now|schedule|draft` → forme avec `releaseURL`). Les fixtures actuelles (`status:'SENT'`, `social.example.test`) sont **réécrites** d'après la forme réelle pour fermer BUG-045.

Le **même fichier de handlers** sert (a) les tests d'intégration des routes Next, (b) les contract-tests (§6), (c) le harnais de parité (§9). Source de vérité unique.

---

## 6. Contract-tests providers (ferme M2, M3)

### 6.1 Asservir le code à la spec, pas l'inverse

Un contract-test charge le **handler de spec** (§5) et exerce le **vrai client** du code (`generateHiggsfieldStudioVideo`, `callOpenAiImage`, `PostizSocialPublishingAdapter`). Il asserte :

- le code appelle **le bon endpoint** (rouge si `/v1/videos/generate` sync au lieu de l'async réel) ;
- le code envoie la **bonne forme de requête** (auth header, payload `posts[].settings.__type`, multipart) ;
- le code **parse correctement** la réponse réelle (`releaseURL`/`release_url`/`permalink`, `{ id }` async, `b64_json`).

> Ce contract-test **doit rougir au gel** sur Higgsfield (BUG-008, BUG-025) : c'est la preuve qu'il ferme M2, et non qu'il re-verrouille le contrat fictif.

### 6.2 Cas de succès LLM (ferme M3)

Les nœuds `generate-script/caption/variants` : un test avec un handler OpenAI renvoyant un **JSON valide** doit exercer le parsing, `scriptOutputSchema.parse`, le calcul de coût et `response_format: json_object` — pas seulement le fallback. Conserver le cas fallback, mais **ajouter le cas succès** (BUG-018). Couvrir aussi un id **live-découvert** (`veo3_1`) côté routing pour fermer MISS-022.

---

## 7. Intégration média réelle (ferme M5)

- **ffmpeg-static + sharp réels** : tests d'intégration de `compose`/`transcode-export`/`generate-subtitles` (et `upload-and-crop`/`upload-and-trim`) qui produisent de **vrais octets** et assertent un magic-number JPEG/MP4 valide + `ffprobe` (piste audio muxée, piste sous-titres incrustée). Ferme BUG-035, BUG-036, MISS-025, MISS-026.
- **Isolation stricte** : injecter `MEDIA_DIR` via env vers un **tmpdir par test** (jamais `join(process.cwd(),'../../.media-storage')`). Aucun test n'écrit dans le stockage prod. Ferme BUG-031, MISS-024, MISS-032. Ajouter un test de garde : « aucun fichier < 100 o (`mock-image`) dans `.media-storage/ai-engine` après la suite » + purge des 977 stubs existants (MISS-004).

---

## 8. E2E Playwright orienté opérateur (ferme M6)

Détail des parcours, sélecteurs/testids, étapes nominal/erreur/récupération : **`playwright-journeys.md`**. Principes :

- **Réutiliser la session admin officielle** (`.auth/admin.json` via `e2e/global.setup.ts`) — jamais de brute-force login.
- **DB de test au schéma réel** : corriger `audit_event` → `audit_events` dans seed/cleanup (BUG-023, BUG-042, BUG-064) ; brancher le job E2E sur une DB migrée.
- **Sélecteurs robustes** : préférer les `data-testid` stables (`media-tab-generate`, `model-picker-image`, `approve-draft-button`, `schedule-preset-1h`, `generated-by-badge`) ; pour les boutons conditionnels au `kind`, matcher `Générer une vidéo IA|Générer un visuel IA` (BUG-029, BUG-055).
- **Assertion d'effet, pas de rendu** : après « Générer un visuel IA », vérifier que l'asset est servi **HTTP 200** ; après publish-draft, vérifier le `social_publish_job` et l'`audit_events` en DB.

### 8.3 Bascule mock/live gated

Un drapeau d'environnement (`E2E_LIVE=1` + credentials de test dédiés) fait tourner **les mêmes specs** contre le live. En l'absence de credentials (cas du gel), le job live est **`skip` explicite avec raison loggée** (« génération live non configurable en staging — cf. limites §10 »), jamais un faux vert. C'est l'expression opérationnelle de « untested ≠ works ».

---

## 9. Garantie de parité MOCK/LIVE — le cœur de la stratégie

> **Principe central : un même scénario, décrit une seule fois, est exécuté contre la doublure MSW (mock) ET contre l'implémentation live (gated). Un harnais compare les invariants observables des deux runs et échoue à la moindre divergence de forme ou de comportement.** C'est ce qui rend le DoD (« passe à l'identique en mock ET live ») *outillé* et non incantatoire.

### 9.1 Mécanique

1. **Scénarios partagés** : chaque scénario est une donnée (`{ input, attentes_invariantes }`), pas un test dupliqué. Exemple génération image : `{ prompt, model:'gpt-image-1-mini', mode } → { httpStatus, media.kind, media.previewUrl servi 200, run.provider ∈ {openai} }`.
2. **Deux exécuteurs** :
   - *mock* : MSW (§5) intercepte le provider ; toujours exécuté (CI/PR).
   - *live* : provider réel, exécuté uniquement si `*_LIVE=1` + credentials ; sinon `skip` tracé.
3. **Comparateur d'invariants** : compare **la forme** des réponses (clés présentes, types, codes d'erreur, shape du permalien Postiz, shape async Higgsfield), pas les valeurs volatiles (ids, timestamps). Toute divergence de forme = **échec** (révélerait, p.ex., que dry_run renvoie `social.example.test/...` quand Postiz renvoie `releaseURL` — BUG-045).
4. **Drapeau de bascule unique** : le même drapeau pilote MSW vs live, garantissant que c'est bien *le même scénario* qui tourne des deux côtés.

### 9.2 Ce que la parité ferme, finding par finding

- **Toggle texte fantôme** (BUG-020, MISS-001) : le scénario « générer en `live` » asserte `run.provider != fallback` → rouge au gel (le toggle n'a aucun effet). La parité force mock≠live à diverger correctement.
- **Badge « Live » mensonger** (BUG-006/007/024/043) : un scénario « tout modèle badgé Live doit générer (mock) et générer (live) ou être masqué » → rouge sur les modèles non générables.
- **Postiz dry_run vs live** (BUG-037/045/065) : le comparateur asserte que `dry-run` et `PostizSocialPublishingAdapter` produisent la **même forme** (statut, permalien, code d'erreur) → rouge sur les permaliens factices et sur `metadata.dryRun=true` forcé en live.
- **Higgsfield async** (BUG-008/025) : le scénario live (gated) et le scénario mock partagent le contrat async ; le code sync faux échoue sur les deux.

### 9.3 Limite honnête de la parité au gel

La génération live (OpenAI flux create vide ; credential Higgsfield incomplet) et la publication live (vrais comptes clients) **ne sont pas configurables/déclenchables en staging au gel**. La parité live de la génération est donc **constatée non démontrable aujourd'hui** et **documentée comme telle** (skip tracé), **jamais simulée** par un mock qu'on ferait passer pour du live. Dès que `OPENAI_API_KEY` est mappée au flux create (correctif bon marché — BUG-001/MISS-007) et qu'un compte Postiz de test est fourni, le harnais exécute la branche live sans modification de scénario.

---

## 10. Périmètre, exécution, et critères de fin

- **À chaque PR** : unit + intégration (MSW global) + contract-tests + intégration média (tmpdir) + E2E opérateur **en mock**. Inclure `src/lib/ai-engine/**` dans le périmètre vitest et la couverture (aujourd'hui exclus — BUG-046/047, P11).
- **Nightly / on-demand** : branche **live** du harnais de parité (si credentials), + smoke « idea→variants→média→approve→publish-draft dry_run » assertant l'effet backend.
- **Garde de cohérence de déploiement** : un test/contrôle CI « toute route `/api/cron/*` possède un déclencheur sur la cible effective (PM2/systemd) » — ferme l'angle mort BUG-003 (le code livré mais jamais ordonnancé).
- **Critère de fin global (DoD)** : *système prouvé par des tests orientés opérateur qui passent à l'identique en MOCK ET en LIVE*. Tout chemin non prouvé dans les deux modes reste `broken by default`.

Voir `coverage-matrix.csv` (couverture par domaine/composant/type/scénario, statut mock & live, gap) et `traceability.csv` (une ligne par finding `BUG-xxx` → exigence → test → fichier cible → statut).
