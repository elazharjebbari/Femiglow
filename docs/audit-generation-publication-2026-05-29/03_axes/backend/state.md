# Axe backend

> Audit FemiGlow Content Studio v2 / AI Engine — pipeline generation+publication.
> Baseline figee : 2026-05-29. Branche : `feat/ai-engine-langgraph-mvp`.
> Lentille de l'axe : routes API, services, generation (texte/image/video), graphe LangGraph, providers,
> gating cle/credential, `HttpError`, idempotence, validation Zod, split de variables d'environnement.
> Tous les constats sont traces a un finding confirme (`BUG-xxx`) ou a une issue manquee (`MISS-xxx`).

---

## Etat actuel (constate, avec preuves)

### 1. Topologie : deux backends de generation paralleles, jamais fusionnes

Le perimetre embarque **deux pipelines de generation distincts** qui ne partagent ni la resolution
de cle, ni les providers, ni les schemas de sortie :

- **Pipeline A — AI-Engine LangGraph** : graphe de 16 noeuds (`src/lib/ai-engine/nodes/*`), orchestre par
  `src/lib/ai-engine/orchestrator.ts` (`runGeneration`), expose UNIQUEMENT par
  `POST /api/admin/ai-engine/generate`. Resolution de cle riche (`engine-config.ts:75` + `api-key-manager.resolveApiKey`,
  DB chiffree + `ENV_KEY_MAP` incluant `OPENAI_API_KEY`). Prompts soignes (PAS/AIDA/BAB, hashtags niche/mid/broad).
- **Pipeline B — create flow / content-studio** : `src/lib/content-studio/{generation,image-generation,video-generation,service}.ts`,
  expose par `POST /api/admin/content-studio/ideas/[id]/generate`, `.../drafts/[id]/generate-visual`,
  `.../drafts/[id]/variation`, etc. C'est **le seul pipeline que l'operateur emprunte reellement** (preuve : E2E
  `golden-path`, `media-kind-toggle` ; `CreateWorkspace.tsx:196` appelle `/api/admin/content-studio/ideas/:id/generate`).

Le **bridge** (`src/lib/ai-engine/bridge/content-studio-bridge.ts`) est **unidirectionnel A->B** et n'est jamais
declenche par le parcours operateur. L'operateur n'atteint donc jamais A. (BUG-015, BUG-026, BUG-033, BUG-047)

**Consequence directe** : tout le travail de copywriting riche, de voix-off, de musique, de sous-titres et de
montage vit dans A, inatteignable depuis B. (BUG-004, BUG-033, BUG-034)

### 2. Couche route (boundary HTTP) : correcte sur la forme, defaillante sur le mode

Les routes inspectees appliquent un patron homogene et sain au bord :
- `requireContentStudioEnabled()` + `requireAdminApi()` (auth/feature-flag),
- validation Zod via `safeParse` puis `HttpError('invalid_input', …, error.flatten())`,
- mapping centralise `formatErrorResponse(err)` (`src/lib/errors/http-error.ts`) avec table
  `STATUS_BY_CODE` (ex. `invalid_state->409`, `budget_exceeded->429`, `upstream_failed->502`).

Preuves : `generate-visual/route.ts:19-23` (Zod `visualGenerationSchema` + 400), `publish-jobs/route.ts:10-27`
(querySchema Zod + 400). Le contrat d'erreur est donc propre **tant que le service leve un `HttpError`**.

**Mais** : le mode de generation est pilote par un cookie `cs_generation_mode` (mock|live), et :
- `generate-visual/route.ts:27-29` le lit mais **defaut code en dur a `'mock'`**, sans lire
  `CONTENT_STUDIO_V2_MOCK_MODE` (MISS-016) ;
- la route **texte** `ideas/[id]/generate` **ne lit jamais ce cookie** : le toggle Mock/Live n'a **aucun effet
  sur la generation de texte** (BUG-020, MISS-001).

### 3. Gating cle/credential : LIVE entierement casse cote operateur (les 2 blockers de generation)

L'etat runtime au gel (`evidence/runtime-env-state.md`, `/proc/<pid>/environ`) :

| Variable | Etat reel | Effet backend |
|---|---|---|
| `OPENAI_API_KEY` | **PRESENTE et VALIDE** (`sk-`, 164 chars) | mais **non declaree dans `src/lib/env.ts`** (ni schema ni mapping runtime) -> invisible a l'objet `env` typE ; lue uniquement via `process.env` par le pipeline A |
| `CONTENT_STUDIO_OPENAI_API_KEY` | **vide** | seule variable lue par le flux create (B) -> gen OpenAI impossible cote operateur |
| `CHAT_OPENAI_API_KEY` | absente | pas de fallback texte |
| `AI_ENGINE_HIGGSFIELD_API_KEY` | presente (67 chars) **sans `:`** | moitie `KEY_SECRET` manquante |
| `AI_ENGINE_HIGGSFIELD_API_SECRET` | **absente** | credential incomplet -> `higgsfieldAuthHeader()` renvoie `null` |
| `AI_ENGINE_DEFAULT_TTS_PROVIDER` | `mock` | branche TTS live jamais empruntee |
| `AI_ENGINE_ELEVENLABS_API_KEY` | vide | ElevenLabs `configured:false` |
| `SOCIAL_PUBLISHING_MODE` | non defini -> defaut `dry_run` | publication simulee |

Verifie au source :
- `generation.ts:70` : `const apiKey = env.CONTENT_STUDIO_OPENAI_API_KEY ?? env.CHAT_OPENAI_API_KEY;` puis
  `if (!apiKey) return fallbackGeneration(idea);` -> **texte toujours en fallback deterministe** (BUG-005).
- `image-generation.ts:88-90,98-99,111` : chaque chemin live lit **uniquement** `env.CONTENT_STUDIO_OPENAI_API_KEY`
  ou `higgsfieldAuthHeader()` -> `throw HttpError('invalid_state')` (409) **avant tout appel reseau** (BUG-001).
- `engine-config.ts:75` (pipeline A) **a** le fallback `process.env.OPENAI_API_KEY`, B **ne l'a pas** : c'est
  une **divergence de resolution de cle transverse** (BUG-001, MISS-003).

> Le blocage LIVE de l'operateur n'est **pas** une cle manquante mais un **split de variable d'environnement** :
> debloquer OpenAI = correctif **bon marche** (ajouter `OPENAI_API_KEY` au schema+mapping `env.ts` et a la chaine
> de resolution de B). C'est l'item a plus fort ratio impact/cout de l'axe.

### 4. Providers Higgsfield : contrat d'API faux (sync vs async) — casse meme avec credential

Le host et le schema d'auth ont ete migres (`higgsfield-auth.ts` : `platform.higgsfield.ai`, `Key KEY_ID:KEY_SECRET`),
mais **les endpoints et le modele async n'ont pas ete reecrits** :
- `image-generation.ts:171` -> `POST /v1/images/generate` (synchrone, attend `json.images[]`) ;
- `video-generation.ts:157` -> `POST /v1/videos/generate` ; `:187` -> poll `/v1/videos/status/{jobId}`.

La vraie API est **asynchrone** : `POST /v1/text2image/<model>` ou `/v1/image2video/<model>` puis poll
`/v1/requests/{id}/status`. Des TODO le reconnaissent dans le code (`video-generation.ts:153-155`,
`image-generation.ts:167-170`). (BUG-008, BUG-025, MISS-009)

> Meme une fois `AI_ENGINE_HIGGSFIELD_API_SECRET` fourni, **chaque appel live echouerait** (404 / forme de
> reponse inattendue). Le perimetre image ET video est concerne.

### 5. Graphe LangGraph : DTO de sortie tronque + erreurs media invisibles

- `orchestrator.ts` interface `GenerationResult` (l.30-45) et `buildResultFromState` (l.116-131) ne propagent que
  `script, caption, hashtags, images, videos, qualityScores, moderationResult, costTracking, errors`.
  **Aucune cle** `voiceover/music/subtitles/composition/exports/thumbnails`. Preuve probe : les cles de la reponse
  API ne contiennent ni `voiceover`, ni `music`, ni `subtitles`. (BUG-004, MISS-005)
- Les noeuds media (`generate-voiceover.ts:213-230`, `generate-music.ts:78-95`, `generate-video.ts:207-226`,
  `compose.ts:286-293`) avalent leurs echecs en renvoyant un asset `url=''` provider `fallback`/`compose:empty`
  **sans jamais pousser dans `state.errors`**. Le quality-gate (`routing.ts:41-63`) ne voit rien -> statut
  `completed` **trompeur**. (MISS-011)
- Mismatch d'enum `tone` entre l'UI AI-Engine et `parse-brief.ts:9` (`z.enum([... 'inspiring'])`) :
  `empowering/authentic/urgent` provoquent une ZodError -> `runGeneration` throw -> `failed` **avant tout noeud
  audio**. Le DTO route flat ne valide pas le ton. (BUG-014). Taxonomies objectifs/piliers egalement incompatibles
  entre A et B (BUG-052).

### 6. Publication : le scheduler n'est branche a aucun cron (3e blocker)

`runScheduledPublishJobs` (worker) n'a **qu'un seul appelant non-test** :
`src/app/api/cron/content-studio/social-publish-scheduler/route.ts`. Or :
- cette route est **absente de `vercel.json`** (verifie : `grep social-publish vercel.json` -> rien) ;
- `vercel.json` n'est de toute facon **pas honore** en staging (PM2 / `next start`, crons reels = timers systemd) ;
- aucun timer systemd / crontab ne cible cette route ;
- `cron/tick` (seul cron a la minute) appelle `processBatch`, `scanAndDispatchCartAbandon`,
  `scanAndDispatchLeadStep1Abandon`, `syncCampaignStatuses` — **jamais** `runScheduledPublishJobs`.

> Un `social_publish_job` `queued` avec `scheduledAt` futur reste `queued` **indefiniment**, en mock comme en live.
> Le bouton "Programmer" est un **accuse de reception inerte**. (BUG-003)

### 7. Services : idempotence et coherence d'etat fragiles

- **Cancel/Reschedule orphelins** : `cancelScheduledPost` (service.ts:568) et `reschedulePost` (:603) ne touchent
  que `content_post`, jamais la ligne `social_publish_job`. Desync latente (masquee tant que le scheduler dort,
  active des qu'il tourne). (BUG-038)
- **Cle d'idempotence disjointe** : `publish-now` suffixe `:now`, `scheduleContentPost` suffixe
  `scheduledAt.toISOString()`. -> **double-publication possible** : publier-maintenant n'invalide pas un job
  `queued` programme pre-existant (MISS-006) ; re-programmer cree un **second** job `queued` au lieu de muter
  l'existant (MISS-028).
- **Route legacy `/postiz-draft`** (`createDraftInPostiz`) appelle DIRECTEMENT l'API Postiz reelle, **hors du
  garde-fou `SOCIAL_PUBLISHING_MODE=dry_run`** : breche de simulation (cree un brouillon reel cote client). (BUG-040)
- **`resolveDefaultAccount`** : en live + plusieurs comptes + sans pin, choix implicite du compte Postiz le plus
  recemment mis a jour -> risque de publier sur le mauvais compte client via l'UI v2 (PublishActionGroup n'envoie
  aucun `accountId`). (BUG-039)
- **`buildSocialContent`** force `metadata.dryRun=true` meme en live -> trace/audit trompeuse. (BUG-065)
- **`meta_graph`** declare dans `SOCIAL_PROVIDER_IDS` mais `adapter=null` -> trappe `invalid_state`. (BUG-069)

### 8. Erreurs serveur opaques (mauvais mapping HttpError en profondeur)

`formatErrorResponse` ne mappe proprement que les `HttpError` ; tout autre throw -> **500 `internal_error`** generique.
Cas avere : re-generer une idee deja `generated` -> **HTTP 500 opaque** (une exception non-`HttpError` est levee dans
`generateIdeaDrafts` avant `insertGenerationRun`). L'operateur ne comprend pas l'echec ; ecriture partielle possible
de brief/drafts (hors transaction). (BUG-051)

### 9. Caches process figes (effets de bord operationnels)

- `getEngineConfig()` met la config en **singleton module** (`engine-config.ts:51-52`) : changer
  `AI_ENGINE_DEFAULT_TTS_PROVIDER` ou les cles **n'a aucun effet sans restart PM2**. (MISS-033)
- `resolvedKeyCache` (api-key-manager, TTL 5 min) sans invalidation env (`invalidateCache` seulement sur save/delete DB). (MISS-030)
- `generation.ts:70` utilise `??` : une chaine **vide** (`''`) ne declenche pas le fallback `CHAT_OPENAI_API_KEY`. (MISS-013)

### 10. Decalage test<->realite cote backend

- **1695 tests "passed" mais process EXIT 1** : unhandled rejection sous fake-timers dans
  `video-generation.test.ts` (polling `status=failed`). Un gate sur la ligne de resume passe ; un gate sur l'exit
  code echoue. (BUG-010, BUG-032 ; `evidence/vitest-summary.json`)
- **0/95 tests touchent une vraie DB ou un vrai reseau ; 58/95 mockent `fetch`** avec des formes **inventees**
  qui ne correspondent pas aux API reelles (Higgsfield sync vs async). Les tests valident le **mauvais contrat**. (BUG-041)
- **MSW present mais non cable en harnais global** : pas de `setupServer` global ni
  `onUnhandledRequest:'error'` ; le contract test existant ne couvre que les routes internes, pas les providers
  externes (OpenAI/Higgsfield/Postiz). (BUG-046, MISS-008)
- **Tests des noeuds AI-Engine** : tous les `invoke` LLM `mockRejectedValue('No API key')` -> seul le **fallback**
  est exerce ; le parsing JSON LLM + `scriptOutputSchema.parse` + cout ne sont jamais testes en succes. (BUG-018)
- Parcours operateur Playwright : **37 passed / 2 failed** (publish-draft Postiz : `relation "audit_event" does not exist` ;
  create-mock-video : video jamais visible). (BUG-023, BUG-029 ; `evidence/playwright-operator-journeys.txt`)

---

## Problemes concrets (chaque item trace a un finding)

| # | Probleme backend | Findings |
|---|---|---|
| P1 | Generation **image LIVE** cote operateur : tout chemin throw `invalid_state` (409) avant tout reseau (OpenAI key non lue + Higgsfield credential incomplet) | **BUG-001** (blocker), BUG-011 |
| P2 | Generation **video LIVE** : credential Higgsfield incomplet -> throw avant reseau | **BUG-002** (blocker), BUG-011 |
| P3 | Publication **PROGRAMMEE** jamais executee : `runScheduledPublishJobs` branche a aucun cron | **BUG-003** (blocker) |
| P4 | Voix-off/musique/sous-titres/compose/export **inatteignables** depuis le flux operateur (DTO tronque + bridge A->B unidirectionnel) | **BUG-004** (blocker), BUG-033, BUG-034, MISS-005 |
| P5 | **Texte operateur fige en fallback deterministe** (jamais LLM), mock==live | **BUG-005** (critical), BUG-020, MISS-001, MISS-013, MISS-014 |
| P6 | Endpoints **Higgsfield sync faux** (image+video) vs API async reelle -> live casse meme avec credential | **BUG-008** (critical), BUG-025, MISS-009 |
| P7 | **Deux pipelines** A/B non fusionnes ; bridge unidirectionnel ; resolution de cle divergente | BUG-015, BUG-026, BUG-047, MISS-003 |
| P8 | **Variation de draft** = clone exact (aucune regeneration ; `promptOverride` ignore) | BUG-017 |
| P9 | Mismatch enum `tone` (UI<->parse-brief) + taxonomies objectifs/piliers incompatibles -> ZodError en aval | **BUG-014** (critical), BUG-052 |
| P10 | **Cancel/Reschedule orphelinent** les `social_publish_job` queued ; cles idempotence disjointes -> double-publication / jobs orphelins | BUG-038, MISS-006, MISS-028 |
| P11 | Route legacy **`/postiz-draft`** contourne le garde-fou `dry_run` (API Postiz reelle) | BUG-040 |
| P12 | **`resolveDefaultAccount`** implicite (mauvais compte client en live, UI v2 sans accountId) | BUG-039 |
| P13 | **Erreur 500 opaque** sur re-generation d'idee `generated` (throw non-HttpError mal mappe ; ecriture hors transaction) | BUG-051 |
| P14 | **Echec silencieux** de generation de variantes cote UI (pas de branche else / catch vide) | BUG-022 |
| P15 | **Aucun provider TTS/musique reel** : TTS=mock, ElevenLabs absent ; musique = stub silencieux non cable | BUG-049, BUG-050 |
| P16 | Noeuds media **n'ecrivent jamais dans `state.errors`** -> statut `completed` trompeur | MISS-011 |
| P17 | **Caches process figes** (engine-config singleton, key cache TTL 5min) -> config inerte sans restart | MISS-030, MISS-033 |
| P18 | Cout image **incoherent** entre registry / service / image-generation (unites melangees) | BUG-057 |
| P19 | `buildSocialContent` force `dryRun:true` ; `meta_graph` adapter null | BUG-065, BUG-069 |
| P20 | Decalage test<->realite : EXIT 1 vert ; 0/95 effet backend reel ; MSW non cable ; noeuds LLM jamais testes en succes | BUG-010, BUG-032, BUG-041, BUG-046, BUG-018, MISS-008 |

---

## Causes racines

1. **Split de variable d'environnement non gouverne** (cause racine de P1, P5 ; transverse).
   `OPENAI_API_KEY` valide n'est meme **pas declare** dans `src/lib/env.ts` (schema + mapping runtime).
   Deux mecanismes de resolution coexistent sans source unique : pipeline A (`resolveApiKey` DB+ENV_KEY_MAP incluant
   `OPENAI_API_KEY`) vs pipeline B (lecture directe `env.CONTENT_STUDIO_OPENAI_API_KEY`, sans fallback). (BUG-001, BUG-005, MISS-003)

2. **Architecture a deux pipelines jamais unifiee** (cause racine de P4, P7, P8, P15, P16).
   Le bridge n'a ete concu que pour les metadonnees textuelles A->B et n'est jamais declenche par l'operateur ;
   le DTO `GenerationResult` de l'orchestrateur n'a jamais ete etendu aux assets composes/audio. Tout le travail
   media de A est jete avant d'atteindre l'API/UI. (BUG-004, BUG-015, BUG-026, BUG-033, BUG-034, MISS-005)

3. **Migration provider partielle** (cause racine de P6).
   Higgsfield : host + auth migres, **endpoints + modele async non reecrits**, et les tests ont ete ecrits AUTOUR
   du code faux (mauvais contrat). (BUG-008, BUG-025, BUG-041, MISS-009)

4. **Orchestration de crons incomplete** (cause racine de P3).
   Route scheduler creee mais jamais enregistree dans l'orchestrateur de crons reel (ni `vercel.json`, ni
   `cron/tick`, ni timer systemd). (BUG-003)

5. **Deux sous-systemes d'etat non synchronises + cles d'idempotence non canoniques** (cause racine de P10).
   Planning editorial (`content_post`) vs lifecycle de job (`social_publish_job`) ; les cles incluent le timing
   (`:now` vs ISO), empechant le rapprochement. (BUG-038, MISS-006, MISS-028)

6. **Garde-fou `dry_run` non centralise** (cause racine de P11, P12, P19).
   Le mode de publication n'est pas applique uniformement : la route legacy le contourne, `buildSocialContent`
   le hardcode, `resolveDefaultAccount` choisit implicitement. (BUG-040, BUG-039, BUG-065)

7. **Mapping d'erreur partiel + ecriture non transactionnelle** (cause racine de P13, P14).
   Seuls les `HttpError` sont bien mappes ; les throws metier internes degradent en 500 ; pas de transaction
   autour des ecritures multi-tables. (BUG-051, BUG-022)

8. **Strategie de test orientee "vert" plutot que "fidelite live"** (cause racine de P20, et masque P1/P2/P6).
   Mocks systematiquement en succes/echec ideal, pas de harnais MSW de parite, gate CI sur la ligne de resume
   (pas l'exit code). (BUG-010, BUG-018, BUG-041, BUG-046, BUG-032, MISS-008)

---

## Criticite (justifiee)

**Criticite globale de l'axe : BLOCKER.**

L'axe backend porte **4 des 4 blockers** de l'audit (BUG-001/002/003/004) et **5 des 8 criticals**
(BUG-005/008/014 directement backend ; BUG-010/011 test-vs-realite backend). Justification :

- **Generation** : en l'etat du gel, **aucune generation LIVE n'est possible cote operateur** (image, video, texte) —
  soit throw `invalid_state` (image/video live), soit fallback deterministe silencieux (texte). Seul le MOCK produit
  un resultat exploitable, et encore partiellement (voix-off/musique/montage inatteignables). (BUG-001, BUG-002, BUG-004, BUG-005)
- **Publication** : le chemin **"Programmer"** ne s'execute **jamais** (mock comme live) — fonctionnalite annoncee,
  100% inerte. (BUG-003)
- **Severite contextualisee par le mode** : la majorite des risques de publication live (mauvais compte, contournement
  dry_run, double-publication) sont aujourd'hui **masques** par le defaut `dry_run`, mais deviennent **critiques des
  l'activation du live** — ils doivent etre corriges AVANT toute bascule. (BUG-038, BUG-039, BUG-040, MISS-006)
- **Parite live non demontrable au gel** : credential create vide + Higgsfield incomplet -> on ne peut pas prouver
  le live aujourd'hui. A documenter comme tel, **pas a simuler**. (BUG-011, BUG-049, BUG-050)

Note : la **couche route (boundary)** est, elle, de bonne facture (Zod + HttpError + auth homogenes). Le risque est
**en profondeur** (services, providers, orchestration, env), pas au bord HTTP.

---

## Recommandations (actionnables, priorisees)

### P0 — Debloquer le live operateur et la publication programmee (bon marche, fort impact)

1. **Unifier la resolution de cle (correctif bon marche)** : declarer `OPENAI_API_KEY` dans `src/lib/env.ts`
   (schema + mapping runtime) et l'ajouter en fallback de la chaine du pipeline B
   (`generation.ts:70` et `image-generation.ts`), en alignant sur `engine-config.ts:75`. **Remplacer `??` par une
   verification de chaine non vide** (`||` + trim). Debloque texte + image OpenAI live immediatement. (BUG-001, BUG-005, MISS-003, MISS-013)
2. **Brancher le scheduler de publication** : appeler `runScheduledPublishJobs({limit})` dans `cron/tick`
   OU enregistrer un timer systemd qui `POST .../social-publish-scheduler` avec `Bearer CRON_SECRET` chaque minute ;
   et ajouter l'entree a `vercel.json` pour un futur deploiement Vercel. (BUG-003)
3. **Aligner l'UI Live sur la disponibilite reelle** : tant que le credential n'est pas valide, masquer/desactiver
   le mode live ou les badges `source:"live"` mensongers — ou throw `invalid_state` explicite (jamais degrader en
   silence). Faire lire le cookie `cs_generation_mode` par `ideas/generate` et echouer clairement en live sans cle. (BUG-020, MISS-001, MISS-016)

### P1 — Fiabiliser les providers et le pipeline media

4. **Reecrire Higgsfield en async submit+poll** (image ET video) : `POST /v1/text2image/<model>` /
   `/v1/image2video/<model>`, poll `/v1/requests/{id}/status` ; adapter le parsing. Fournir
   `AI_ENGINE_HIGGSFIELD_API_SECRET` (ou cle `KEY_ID:KEY_SECRET`). Valider en staging avant prod. (BUG-002, BUG-008, BUG-025, MISS-009)
5. **Decider d'UN pipeline canonique** (A vs B) et le documenter. A minima : etendre `GenerationResult` +
   `buildResultFromState` aux champs `voiceover/music/subtitles/composition/exports/thumbnails`, et faire propager
   le bridge avec un vrai mapping `assetId -> table media` (via `createMedia` + `upsertPrimaryAsset`). (BUG-004, BUG-026, BUG-033, BUG-034, MISS-005)
6. **Provisionner ou documenter les providers audio** : poser `AI_ENGINE_DEFAULT_TTS_PROVIDER=openai`
   (cle deja presente) ou fournir ElevenLabs ; cabler un provider musique reel ou documenter "musique = silence
   optionnel". **Faire ecrire les echecs media dans `state.errors`** pour ne plus marquer `completed` a tort. (BUG-049, BUG-050, MISS-011)

### P2 — Securiser la publication avant toute bascule live

7. **Synchroniser `content_post` <-> `social_publish_job`** sur cancel/reschedule (transition `queued->cancelled`,
   maj `scheduledAt` du job). Canoniser les **cles d'idempotence** (decoupler du timing) pour empecher double-publication
   et jobs orphelins. (BUG-038, MISS-006, MISS-028)
8. **Decommissionner `/postiz-draft`** (renvoyer 410 Gone) ou router via l'adapter + respecter `SOCIAL_PUBLISHING_MODE`. (BUG-040)
9. **Rendre la selection de compte explicite/obligatoire** dans l'UI publish v2 (envoyer `accountId`) ou imposer
   `SOCIAL_PUBLISHING_DEFAULT_ACCOUNT_ID` + echouer si live+multi-comptes sans pin. Deriver `metadata.dryRun` du mode
   resolu. Retirer `meta_graph` de `SOCIAL_PROVIDER_IDS` tant que non implemente. (BUG-039, BUG-065, BUG-069)

### P3 — Robustesse des services et observabilite

10. **Mapper les erreurs metier en `HttpError`** (ex. re-generation idee `generated` -> 409 `invalid_state`) et
    verifier le statut AVANT toute ecriture ; wrapper les ecritures multi-tables dans une **transaction**. Ajouter
    les branches d'erreur cote UI (`onCreated`) avec toast + retry. (BUG-051, BUG-022)
11. **Brancher la `variation` de draft** sur une vraie regeneration (`generate-variants.ts` ou `generateForIdea`
    cible) et consommer `promptOverride`. (BUG-017)
12. **Aligner les enums/taxonomies** (`tone`, objectifs/piliers) entre UI, DTO route et `parse-brief.ts` ;
    valider le ton des la route. **Centraliser le pricing** dans le registry (unite cents). (BUG-014, BUG-052, BUG-057)
13. **Invalider les caches sur changement de config** (`resetEngineConfig`, invalidation env du key cache) ou
    documenter le besoin de restart. (MISS-030, MISS-033)

### P4 — Restaurer la confiance dans les tests (harnais de parite)

14. **Traiter l'EXIT 1 en CI comme un echec dur** ; corriger le drain de timers + `afterEach(clearAllTimers/restoreAll)`. (BUG-010, BUG-032)
15. **Monter un `setupServer` MSW global** (`onUnhandledRequest:'error'`) avec des handlers **calques sur l'OpenAPI
    reelle** des providers (OpenAI/Higgsfield/Postiz, modele async), partages entre tests et un smoke "parity".
    Ajouter des cas de **succes LLM** mockes pour les noeuds AI-Engine. Ajouter un healthcheck qui **echoue
    explicitement** quand un credential live est absent/incomplet (au lieu de mocker un succes). (BUG-041, BUG-046, BUG-018, BUG-011, MISS-008)
