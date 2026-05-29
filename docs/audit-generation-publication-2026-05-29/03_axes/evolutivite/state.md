# Axe evolutivite

> Baseline figee 2026-05-29 — branche `feat/ai-engine-langgraph-mvp`.
> Principe directeur applique : la verite est le comportement reel exerce par un operateur, pas le rapport de tests. Toute capacite non verifiee en MOCK **et** en LIVE est consideree cassee par defaut (`untested != works`).
>
> Lentille de l'axe : capacite du systeme a **absorber un changement de perimetre sans reecriture** — ajout d'un provider IA reel (TTS, video Veo/Sora, musique), ajout d'un reseau social, branchement bidirectionnel A->B, montee en charge du polling, file de jobs de publication, multi-comptes. On ne juge pas « est-ce que ca marche aujourd'hui » (c'est l'objet des axes fiabilite/robustesse) mais « combien coute le prochain ajout, et qu'est-ce qui casse quand il arrive ».

---

## Etat actuel (constate, avec preuves)

### A. Deux pipelines paralleles, et le bon point d'extension est dans le pipeline mort

Le code expose **deux** chaines de generation distinctes :

- **Pipeline A — AI-Engine LangGraph** (`src/lib/ai-engine/`) : possede une **vraie abstraction de providers**.
  - `providers/adapters/base.ts` : classe abstraite `ProviderAdapter` avec `generateText / generateImage / generateVideo / textToSpeech / generateMusic`, capacites declarees (`ProviderCapability`), circuit breaker et retry par adapter, calcul de cout par modele. Les capacites non implementees levent `NotImplementedError` (contrat propre).
  - `providers/selector.ts` : `ProviderSelector` qui filtre par capacite, sante, circuit breaker, budget, puis trie par priorite ; `selectFallback()` pour le basculement. C'est un design **extensible par nature** (ajouter un provider = ajouter un adapter + un `case` dans `createAdapter`).
  - Adapters reels presents : `openai.ts`, `anthropic.ts`, `google.ts`, `higgsfield.ts`.
- **Pipeline B — create flow operateur** (`src/lib/content-studio/`) : c'est **le seul chemin que l'operateur emprunte reellement** (route `/admin/content-studio-v2/create` -> `generate-visual`). Or il **n'utilise pas du tout l'abstraction d'adapters de A**. Il route « a la main » par prefixe d'identifiant de modele.

Preuve du routing par prefixe (extensibilite negative) — `src/lib/content-studio/video-generation.ts:96-124` :
```
if (input.mode === 'mock') return generateMockStudioVideo(input);
if (input.model && /^mock-/i.test(input.model)) return generateMockStudioVideo(input);
if (input.model?.startsWith('hf-')) { ... generateHiggsfieldStudioVideo ... }
if (input.mode === 'live') throw HttpError('invalid_state', 'aucun modele video live disponible');
```
Le routeur reconnait `mock-*`, `hf-*`, `gpt-image-*/dall-e-*` (cote image) — **des prefixes internes en dur**, pas un registre de providers. Ajouter un provider passe donc par l'edition d'une cascade de `if/startsWith`, pas par l'enregistrement declaratif que A offre deja. **L'investissement d'architecture extensible (A) ne beneficie pas au chemin reel (B).** [BUG-015, BUG-026, BUG-047, MISS-022]

### B. Le branchement A->B est unidirectionnel et lossy : tout enrichissement de A est invisible

Le DTO de sortie de l'orchestrateur (`src/lib/ai-engine/orchestrator.ts`, `GenerationResult` + `buildResultFromState`) ne copie que `script, caption, hashtags, images, videos (bruts), qualityScores, moderationResult, costTracking, errors`. **Aucune cle `voiceover / music / subtitles / composition / exports / thumbnails`.** Le bridge `bridge/content-studio-bridge.ts` ne lit jamais ces champs ; l'UI `GenerationResult.tsx` n'a aucun champ audio/sous-titres. [BUG-004, MISS-005]

Consequence pour l'evolutivite : meme si on cable demain un TTS reel, une musique reelle ou un montage reel **dans A**, l'operateur (B) ne les recevra jamais — le contrat de sortie de l'orchestrateur les jette **avant** le bridge. Toute nouvelle capacite media de A est structurellement non livrable a l'utilisateur tant que le DTO et le bridge ne sont pas elargis. Le pont est un goulot, pas une couture extensible.

### C. Catalogue de providers : enumerations fermees et slots manquants

`src/lib/ai-engine/config/engine-config.ts` definit `EngineConfig.providers` comme des **unions de litteraux fermees** :
- `image.default: 'openai' | 'google' | 'stability' | 'higgsfield' | 'mock'`
- `video.default: 'google' | 'runway' | 'higgsfield' | 'mock'`
- `tts.default: 'elevenlabs' | 'openai' | 'google' | 'mock'`
- **Pas de slot `music`** dans `providers` ni dans `apiKeys`.

Donc :
- Ajouter **Veo/Sora** comme provider video « configurable » suppose d'etendre l'union `video.default`, d'ajouter une cle dans `apiKeys`, **et** d'ajouter un adapter cote A **et** une branche cote B. Aujourd'hui `video.default` liste `runway` et `google` mais **aucun adapter Runway/Google-video n'existe** : ce sont des slots declares non implementes. [BUG-008, BUG-009, BUG-025]
- Ajouter un provider **musique** (Suno/Mubert) impose d'abord d'**ajouter le slot `music` a `EngineConfig.providers` et `apiKeys`** (inexistant), le node `generate-music.ts` etant un stub silencieux qui ne consulte aucun provider. [BUG-050]
- TTS reel : l'infrastructure existe (`generateOpenAITTS`, slot `tts`), mais le defaut est `mock` et ElevenLabs n'a pas de cle. La branche live n'est jamais empruntee. [BUG-049]

### D. La config provider est figee pour la vie du process (pas de reconfiguration a chaud)

`getEngineConfig()` met la config en **singleton module** : `if (_config) return _config` (`engine-config.ts:51-52`). Providers, cles et `tts.default` sont fixes au premier appel pour toute la vie du process PM2. `resetEngineConfig()` existe mais **n'est appele par aucun chemin runtime**. [MISS-033]

A cela s'ajoute le cache de resolution de cles `resolvedKeyCache` (TTL 5 min, `api-key-manager.ts`) **sans invalidation sur changement d'`.env`** : `invalidateCache` n'est declenche que par save/delete en base. [MISS-030]

Consequence d'evolutivite operationnelle : activer un nouveau provider (poser une cle, basculer `AI_ENGINE_DEFAULT_TTS_PROVIDER=openai`) **exige un restart du process** ; il n'existe aucun panneau d'administration qui recharge les providers a chaud. La « configurabilite » annoncee par les pages de config admin est donc partiellement illusoire au niveau runtime.

### E. Deux mecanismes de resolution de cle divergents (dette transverse)

A (`resolveApiKey` dans `api-key-manager.ts`) lit la **DB chiffree puis un ENV_KEY_MAP** (4 variables OpenAI dont `OPENAI_API_KEY`). B (create) lit **directement `env.CONTENT_STUDIO_OPENAI_API_KEY`**. Une cle posee via l'AI-Engine (DB/UI) n'est donc **pas** vue par B. C'est la racine commune de BUG-001 : `OPENAI_API_KEY` valide est present dans le process mais n'est ni mappe dans `env.ts` ni lu par B. [BUG-001, MISS-003]

Consequence : chaque nouveau provider doit etre cable **deux fois** (deux mecanismes de resolution), avec un risque eleve qu'un provider « configure » d'un cote soit invisible de l'autre — exactement le defaut qui rend la generation image live cassee cote operateur aujourd'hui.

### F. Catalogue de modeles decouple du routeur : tout nouvel ID expose casse a l'usage

Le picker materialise des modeles `source:'live'` issus de la **decouverte Higgsfield** avec leurs IDs natifs (`flux_2`, `veo3_1`, `kling3_0`, `seedance_2_0`...). Mais le routeur de generation **n'accepte que les prefixes internes** (`hf-*`, `gpt-image-*`). Un modele live-decouvert selectionne tombe en `409 invalid_state` (video) ou en fallback OpenAI silencieux (image, cle vide -> 409). [BUG-006, BUG-007, BUG-009, BUG-024, BUG-028]

Consequence directe sur l'evolutivite : **le mecanisme de decouverte de nouveaux modeles (« plug and play ») et le mecanisme de routing ne partagent pas de contrat d'ID.** Chaque nouveau modele decouvert est expose a l'operateur comme disponible **avant** d'etre routable. L'extension « ajouter un modele » produit aujourd'hui un faux positif systematique.

### G. Reseaux sociaux : map d'adapters extensible mais avec un slot piege

Cote publication, le design est sain : `adapters: Record<SocialProviderId, SocialPublishingAdapter | null>` (`admin-service.ts:48-52`) avec `adapterFor()` qui leve une erreur claire si null. Ajouter un reseau = ajouter un `SocialProviderId` + un adapter. **Mais** `SOCIAL_PROVIDER_IDS = ['dry_run','meta_graph','postiz']` declare `meta_graph` alors que `adapters.meta_graph = null` : c'est un **provider fantome** qui leve `invalid_state` si jamais selectionne. [BUG-069]

Concretement, l'ajout d'un nouveau reseau passe aujourd'hui presque exclusivement par **Postiz** (un agregateur tiers de 28+ canaux). C'est un bon levier d'evolutivite reseau — mais qui transfere le risque : capacites par reseau persistees en base **stale** (`supportsDraft` absent, IG dry_run sans reel/story), donc l'UI propose/masque des canaux sur des donnees perimees lors de l'ajout. [BUG-063]

### H. Montee en charge du polling : modele synchrone bloquant par requete

La generation video/image live **bloque la requete** pendant le polling : `HIGGSFIELD_POLL_INTERVAL_MS = 5_000`, `HIGGSFIELD_POLL_TIMEOUT_MS = 300_000` (`video-generation.ts:12-13` ; idem `higgsfield.ts:17-18`). Une generation video peut donc **occuper un worker HTTP jusqu'a 5 minutes**, en boucle `while (Date.now() < deadline)` avec `setTimeout`. Il n'y a **aucune file de jobs de generation** : la generation media reelle n'est pas asynchrone cote produit (pas de `generation_job` queued + worker dedie comme la publication). [BUG-008, BUG-025]

Consequence montee en charge : N generations live concurrentes = N workers HTTP mobilises jusqu'a 5 min chacun. Aucune backpressure, aucun débit borne, aucune reprise sur redemarrage (un restart PM2 perd le polling en vol). Le modele actuel ne tient pas au-dela de quelques generations simultanees.

### I. File de jobs de publication : structure presente mais non branchee, non concurrente, non multi-compte

La file existe (`social_publish_job` queued, `runScheduledPublishJobs`, lock par job `tryAcquirePublishJobLock`), mais :
1. **Le worker n'est cable a aucun cron.** `runScheduledPublishJobs` n'est appele que par `/api/cron/content-studio/social-publish-scheduler`, **absente des 15 crons de `vercel.json`** (verifie : `tick`, `media-optimize`, `tracking-purge`, `analytics-refresh`, ... pas de `social-publish-scheduler`), aucun crontab systeme, et `/api/cron/tick` ne fait que `processBatch`/cart-abandon/lead-abandon/listmonk — **il ne relaie pas le scheduler**. De plus l'app tourne en **PM2/`next start`**, pas Vercel : `vercel.json` ne serait de toute facon pas honore. Un job programme reste `queued` a jamais. [BUG-003]
2. **Le worker est serie, debit borne a la main.** `worker.ts` boucle `for (const job of due)` en sequentiel, `DEFAULT_LIMIT = 5`, `MAX_LIMIT = 20`. Aucune concurrence, aucun fan-out par compte/reseau. A volume client reel (multi-comptes, multi-reseaux, pics de planification), 5 jobs/minute en serie est un plafond etroit.
3. **Idempotence fragile a l'echelle multi-actions.** Cles d'idempotence disjointes : `publish-now` -> suffixe `:now`, `schedule` -> `scheduledAt.toISOString()`. Reprogrammer cree un **second** job queued au lieu de muter l'existant ; publish-now n'invalide pas un job programme pre-existant -> **double publication possible**. cancel/reschedule **orphelinent** les jobs queued. [MISS-006, MISS-028, BUG-038]
4. **Multi-comptes non deterministe.** Sans `SOCIAL_PUBLISHING_DEFAULT_ACCOUNT_ID` (non defini en staging) et sans `accountId` envoye par l'UI (PublishActionGroup n'en envoie aucun), `resolveDefaultAccount` retombe sur **le premier compte Postiz actif**, ordre non garanti. Avec 4 comptes IG reels en base, **risque de publier sur le mauvais compte client**. [BUG-039]

### J. Couplage implicite au cwd pour le stockage media (frein au scale-out)

Tous les nodes media calculent `MEDIA_DIR = join(process.cwd(), '../../.media-storage/ai-engine')` (`generate-voiceover.ts:13`, `generate-music.ts:13`, `generate-video.ts:16`, `compose.ts:15`, `transcode-export.ts:15`, `generate-subtitles.ts:8`). Le chemin **depend du cwd** du process : fonctionne lance depuis `apps/web`, casse silencieusement depuis un worker/cron/script lance ailleurs, et n'est pas un stockage objet partage. [MISS-024, MISS-032, BUG-062]

Consequence : passer a un worker de generation hors-requete, a plusieurs instances PM2, ou a un deploiement Vercel/serverless **casse le stockage media** — couture de scale-out absente (pas d'adapter de stockage unifie ; l'upload v2 utilise deja un storage adapter mais compose/transcode codent le chemin en dur, incoherence relevee BUG-062).

### K. Le filet de tests ne protege aucune de ces extensions

Le harnais ne valide que des chemins mockes : 0/95 test n'assert un effet backend reel, 58 mockent `fetch`, les doublures ne refletent pas l'API live (BUG-041). MSW 2.14.2 est installe mais **non cable en harnais de parite global** ; le seul contract test MSW ne couvre **pas** les providers externes (OpenAI/Higgsfield/Postiz) (BUG-046, MISS-008). Aucun test n'exerce un ID de modele live-decouvert en mode live (MISS-022). La suite est tout-verte (1695 passed) mais le process sort en **exit 1** (BUG-010/032).

Consequence d'evolutivite : il n'existe **aucun garde-fou** qui revele qu'un nouveau provider/modele/reseau ajoute est reellement routable et fonctionnel en LIVE. Chaque extension future repose sur la meme illusion de couverture qui masque deja les 4 blockers. **Sans harnais de parite mock/live, l'evolutivite est aveugle.**

---

## Problemes concrets (chacun trace a un finding)

| # | Probleme d'evolutivite | Findings |
|---|---|---|
| P1 | Le pipeline reel (B) n'utilise pas l'abstraction de providers extensible (A) ; routing par prefixe `startsWith` en dur. Ajouter un provider = editer une cascade de `if`, pas enregistrer un adapter. | BUG-015, BUG-026, BUG-047, MISS-022 |
| P2 | Pont A->B unidirectionnel et lossy : voiceover/music/subtitles/composition/exports jettes par le DTO de l'orchestrateur avant le bridge. Toute nouvelle capacite media de A est non livrable a l'operateur. | BUG-004, MISS-005, BUG-033, BUG-034 |
| P3 | `EngineConfig.providers` = unions de litteraux fermees ; **pas de slot `music`** ; slots `video: runway/google` declares sans adapter. Ajouter Veo/Sora/Suno impose d'etendre l'enum + apiKeys + adapter A + branche B. | BUG-050, BUG-008, BUG-009, BUG-025 |
| P4 | Config provider figee en singleton process ; `resetEngineConfig` jamais appele en runtime ; cache de cle 5 min sans invalidation env. Activer un provider exige un restart PM2 ; pas de reconfiguration a chaud. | MISS-033, MISS-030 |
| P5 | Deux mecanismes de resolution de cle divergents (DB chiffree+ENV_KEY_MAP en A vs lecture directe env en B). Tout provider doit etre cable deux fois ; cle « configuree » d'un cote invisible de l'autre. | BUG-001, MISS-003 |
| P6 | Catalogue de modeles decouple du routeur : IDs live-decouverts (flux_2, veo3_1...) exposes comme disponibles mais non routables -> 409/fallback. L'extension « ajouter un modele » produit un faux positif systematique. | BUG-006, BUG-007, BUG-009, BUG-024, BUG-028 |
| P7 | Polling synchrone bloquant par requete (5 s / 300 s), pas de file de jobs de generation, pas de backpressure, pas de reprise sur restart. La generation media reelle ne tient pas la montee en charge. | BUG-008, BUG-025 |
| P8 | File de publication non branchee a un cron (scheduler absent de vercel.json + PM2 self-hosted), serie (limit 5/20), idempotence disjointe (double-publication), cancel/reschedule orphelins. | BUG-003, BUG-038, MISS-006, MISS-028 |
| P9 | Multi-comptes non deterministe : fallback « premier compte actif » sans pin, UI sans accountId -> risque mauvais compte client. | BUG-039 |
| P10 | Reseaux sociaux : provider `meta_graph` declare mais adapter null (trappe) ; capacites par reseau persistees stale. Ajout de reseau via Postiz transfere le risque de capacites. | BUG-069, BUG-063 |
| P11 | Stockage media couple au cwd (`process.cwd()+'../../'`), chemins codes en dur dans compose/transcode -> scale-out (worker hors-requete, multi-instance, serverless) casse le stockage. | MISS-024, MISS-032, BUG-062 |
| P12 | Aucun harnais de parite mock/live ; MSW non cable globalement ; providers externes non couverts ; suite exit 1. Aucune extension future n'est verifiable en LIVE. | BUG-041, BUG-046, BUG-010, BUG-032, MISS-008, MISS-022 |

---

## Causes racines

1. **Double pipeline non consolide (A theorique, B reel).** L'investissement d'architecture extensible a ete fait dans LangGraph (A), mais l'operateur passe par le create flow (B) qui a une logique de routing ad hoc. Le bon point d'extension n'est pas sur le chemin critique. -> P1, P2, P5, P6.
2. **Contrats fermes par enumeration de litteraux + DTO de sortie etroit.** Les unions `'openai'|'google'|...` et le `GenerationResult` minimal sont des frontieres rigides : chaque ajout change un type partage et un pont, plutot que d'enregistrer une implementation derriere une interface stable. -> P2, P3.
3. **Configuration statique au boot, sans plan de cycle de vie.** Singletons modules + caches TTL sans invalidation : l'app a ete pensee « pose la config dans l'env au demarrage », pas « ajoute/bascule un provider en exploitation ». -> P4.
4. **Identite de modele incoherente entre decouverte et routing.** La couche decouverte (IDs natifs provider) et la couche routing (prefixes internes) ne partagent aucun contrat d'identifiant ni de mapping. -> P6.
5. **Asynchronisme produit absent : tout est synchrone dans la requete.** Pas de notion de `job` pour la generation (contrairement a la publication qui a la structure mais pas le cablage). Le polling bloquant et la file serie en sont les symptomes. -> P7, P8.
6. **Cron/worker non cables a l'execution reelle (Vercel-isme dans un deploiement PM2).** Le scheduler de publication a ete concu pour `vercel.json` alors que le runtime est self-hosted PM2 ; personne ne declenche le worker. -> P8.
7. **Stockage local couple au cwd au lieu d'un adapter de stockage unifie.** Le scale-out horizontal n'a pas ete une hypothese de conception des nodes media. -> P11.
8. **Absence de harnais de parite mock/live.** Sans contrat verifie contre l'API reelle, l'evolutivite est non testable : on ajoute des providers/modeles/reseaux « a l'aveugle ». -> P12, et amplificateur de P3/P6/P10.

---

## Criticite (justifiee) : **MAJOR** (avec ancrage dans 4 blockers)

L'axe evolutivite n'introduit pas de blocker propre — les blockers (BUG-001/002/003/004) appartiennent aux axes fiabilite/backend. Mais ils sont la **manifestation directe** des defauts d'evolutivite :

- BUG-001 (image live cassee cote B) = symptome de P5 (double resolution de cle) + P6.
- BUG-002/008/025 (video live cassee, endpoints sync vs API async) = symptome de P7 (asynchronisme absent) + P3 (slots non implementes).
- BUG-003 (publication programmee inerte) = symptome de P8 (worker non cable, Vercel-isme en PM2).
- BUG-004 (medias inatteignables) = symptome de P2 (pont lossy).

Donc l'evolutivite est la **cause structurelle commune** : tant qu'elle n'est pas traitee, chaque ajout futur (Veo/Sora, TTS reel, musique, nouveau reseau, multi-comptes, montee en charge) **reproduira ces blockers** plutot que de les eviter. La gravite est `major` (architecture rectifiable a cout maitrise, pas de perte de donnees) mais avec un **risque eleve de regression a chaque extension** tant que les couches A/B ne sont pas consolidees et qu'aucun harnais de parite n'existe. Le sous-element le plus a risque immediat est P8 (file de publication non branchee + idempotence) car il combine inertie totale (BUG-003) et risque de double-publication/mauvais compte client (MISS-006, BUG-039) des qu'on passe en live multi-comptes.

---

## Recommandations (actionnables, priorisees)

### P0 — Debloquer et securiser l'existant avant toute extension
1. **Unifier la resolution de cle (P5).** Faire passer B par `resolveApiKey()` (ou au minimum mapper `OPENAI_API_KEY` dans `env.ts` et le lire dans `image-generation.ts`). Correctif bon marche qui debloque OpenAI cote operateur. [BUG-001, MISS-003]
2. **Brancher le worker de publication a un cron reel (P8).** Appeler `runScheduledPublishJobs` depuis `/api/cron/tick` (boucle bornee) OU poser un cron PM2/systeme qui POST `/api/cron/content-studio/social-publish-scheduler` (Bearer `CRON_SECRET`) chaque minute ; ajouter aussi l'entree a `vercel.json` pour un futur deploiement Vercel. [BUG-003]
3. **Rendre la selection de compte explicite/obligatoire (P9).** PublishActionGroup doit envoyer `accountId` ; en live + multi-comptes sans pin, echouer en `invalid_state` plutot que choisir le premier. Imposer `SOCIAL_PUBLISHING_DEFAULT_ACCOUNT_ID` en prod. [BUG-039]
4. **Fermer la trappe `meta_graph` (P10).** Retirer `meta_graph` de `SOCIAL_PROVIDER_IDS` tant que l'adapter est null, ou implementer l'adapter. [BUG-069]

### P1 — Reparer les coutures d'extension (rendre les ajouts surs)
5. **Router par `provider` et non par prefixe (P1, P6).** Cote B, remplacer `startsWith('hf-')` par `model.provider === 'higgsfield'` et introduire un **mapping ID-natif decouvert -> route**. Valider l'ID cote serveur et renvoyer « modele non supporte » explicite plutot qu'un fallback silencieux. [BUG-009, BUG-028, MISS-022]
6. **Aligner le badge `Live` sur la vraie source (P6).** `materialiseDiscoveredModel` doit propager `r.source` (fallback/cache/live) ; ne badger `Live` (et ne proposer) que les modeles d'un provider reellement generation-ready (credential complet). [BUG-024, BUG-007]
7. **Elargir le DTO du pont A->B (P2).** Etendre `GenerationResult` + `buildResultFromState` + le bridge + `GenerationResultData` pour inclure voiceover/music/subtitles/composition/exports/thumbnails, avec rendu UI (lecteur audio, lien SRT, video composee). Sans cela, aucun provider media reel n'est livrable. [BUG-004, MISS-005, BUG-034]
8. **Ajouter le slot `music` et completer les slots video (P3).** Ajouter `providers.music` + `apiKeys` correspondants a `EngineConfig` ; n'exposer `runway`/`google-video` que si un adapter existe (sinon retirer du type). [BUG-050, BUG-009]
9. **Reecrire les integrations Higgsfield en async reel (P3, P7).** Submit `/v1/text2image/<model>` ou `/v1/image2video/<model>`, poll `/v1/requests/{id}/status` ; adapter le parsing ; valider contre un credential `KEY_ID:KEY_SECRET` complet en staging avant prod. [BUG-008, BUG-025]

### P2 — Preparer la montee en charge et le cycle de vie
10. **Introduire une vraie file de jobs de generation (P7).** Materialiser un `generation_job` queued + worker (comme la publication), pour sortir le polling de la requete HTTP, borner le debit, et reprendre sur restart. Mutualiser le pattern avec `runScheduledPublishJobs`.
11. **Rendre le worker de publication concurrent et fiabiliser l'idempotence (P8).** Concurrence bornee (au lieu du `for` serie limit 5), fan-out par compte/reseau ; cle d'idempotence unifiee (un seul job par (post, compte) ; reschedule = mutation, pas creation) ; cancel/reschedule doivent invalider les jobs queued. [BUG-038, MISS-006, MISS-028]
12. **Reconfiguration a chaud des providers (P4).** Remplacer le singleton `getEngineConfig` par un cache invalidable (event sur save de cle/provider en DB), appeler `resetEngineConfig` + `invalidateCache` sur changement de config admin. Eviter le « restart PM2 obligatoire » pour activer un provider. [MISS-033, MISS-030]
13. **Unifier le stockage media derriere l'adapter de stockage existant (P11).** Supprimer `process.cwd()+'../../'` des nodes ; utiliser le storage adapter (deja utilise par l'upload v2) avec un chemin/base absolu configurable ; prerequis a tout worker hors-requete ou multi-instance. [MISS-024, MISS-032, BUG-062]

### P3 — Garde-fou d'evolutivite (sans lui, tout le reste regresse)
14. **Cabler un harnais de parite mock/live avec MSW (P12).** Handlers MSW qui refletent les contrats reels OpenAI/Higgsfield/Postiz ; tests qui exercent un ID live-decouvert en mode live ; au moins un test par provider/reseau ajoute qui prouve le routage **et** l'effet backend. Faire de l'exit-code (pas la ligne de resume) le gate CI. [BUG-041, BUG-046, BUG-010, MISS-008, MISS-022]
15. **Documenter le « contrat d'ajout ».** Un runbook « ajouter un provider IA » / « ajouter un reseau » listant les N points de touche (adapter A, branche B, enum config, apiKeys, resolution de cle, mapping d'ID, DTO de sortie, UI, test de parite). Tant que les points de touche sont multiples (consequence de P1/P2/P5), la doc reduit le risque ; l'objectif cible est de **converger A et B** pour ramener ce nombre a 1 (un adapter).

---

## Points a verifier sous tous les angles (avant de declarer une extension « faite »)

- **Provider IA neuf** : adapter A enregistre ; B route par `provider` (pas par prefixe) ; cle resolue par le **meme** mecanisme des deux cotes ; cout/circuit-breaker cables ; **DTO de sortie propage le media jusqu'a l'UI** ; un test de parite mock/live prouve l'effet backend en LIVE ; pas de restart requis pour l'activer.
- **TTS/musique reels** : slot present dans `EngineConfig.providers` ; node appelle reellement le provider (pas un stub silencieux) ; output (mp3/SRT/piste) expose via le pont jusqu'au lecteur UI.
- **Reseau social neuf** : `SocialProviderId` + adapter non-null ; capacites recalculees a la volee (pas la valeur persistee stale) ; selection de compte explicite ; idempotence (post, compte) unique.
- **Montee en charge** : la generation passe par une file (pas un polling bloquant dans la requete) ; debit borne et concurrence controlee ; reprise sur restart ; stockage media partage independant du cwd.
- **Multi-comptes** : aucun fallback implicite « premier compte » ; pin ou selection obligatoire ; pas de double-job sur reschedule/publish-now.
