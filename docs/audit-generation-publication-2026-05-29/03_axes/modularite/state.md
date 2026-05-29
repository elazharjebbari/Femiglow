# Axe modularite

> Diagnostic transversal — baseline figee 2026-05-29, branche `feat/ai-engine-langgraph-mvp`.
> Lentille : pattern adapter de publication (dry-run / Postiz) bien isole ? Frontiere A/B et bridge, separation gen / compose / publish, injection des providers, testabilite par substitution (le point fort a etendre a la generation).
> Principe directeur applique : la verite est le comportement reel de l'operateur (pipeline B), pas le rapport de tests. Toute capacite non prouvee en mock ET en live reste cassee par defaut.

---

## Etat actuel (constate, avec preuves)

La modularite du systeme est **fortement asymetrique**. Il existe un sous-systeme exemplaire (la publication) et un sous-systeme pauvre (la generation operateur, pipeline B), avec une frontiere mal cablee entre les deux pipelines de generation (A LangGraph / B create-flow).

### 1. Publication — pattern adapter exemplaire (le point fort)

Le module `src/lib/social-publishing` applique correctement le pattern Strategy/Adapter :

- **Contrat explicite et stable** : `SocialPublishingAdapter` (`contracts.ts:240-249`) definit `provider`, `listCapabilities()`, `publish()`, `getInsights?()`. Tous les types d'echange (`SocialPublishRequest`, `SocialPublishResult` en union discriminee `{ok:true}|{ok:false}`, `SocialPublishingCapability`, `SocialPublishErrorCode`) sont normalises et provider-agnostiques (`contracts.ts:1-249`).
- **Deux implementations interchangeables** : `DryRunSocialPublishingAdapter` (`adapters/dry-run.ts:27`) et `PostizSocialPublishingAdapter` (`adapters/postiz.ts:44`), toutes deux `implements SocialPublishingAdapter`. La validation (`validateRequest`, `validateSchedule`) est dupliquee mais coherente entre les deux.
- **Fabrique de selection** : `adapterFor(provider)` (`admin-service.ts:48-60`) resout l'adapter via une map `Record<SocialProviderId, SocialPublishingAdapter|null>`. Provider non implemente (`meta_graph: null`) -> `HttpError('invalid_state')` au lieu d'un crash silencieux.
- **Selection par mode = env** : `resolveDefaultAccount(platform, {mode})` (`admin-service.ts:566-612`) bascule dry_run/live sur `env.SOCIAL_PUBLISHING_MODE`. La substitution du comportement (simule vs reel) est un parametre de configuration, pas un changement de code.
- **Injection de dependances pour la testabilite** : `PostizAdapterDeps` (`adapters/postiz.ts:38-54`) injecte `uploadMedia`, `createDraft`, `fetchAnalytics` via le constructeur, avec defaut sur les implementations reelles. Le seam de substitution existe **au niveau de l'I/O reseau** — exactement ce qu'il faut pour des tests fideles.
- **Garde de coherence** : `publishWithAdapter()` (`service.ts:5-15`) refuse un adapter dont le `provider` ne correspond pas au compte (`Adapter X cannot publish for account provider Y`).

C'est la reference de modularite du depot : interface -> implementations -> fabrique -> selection par config -> DI pour la substitution.

### 2. Generation pipeline A (LangGraph) — modulaire mais hors du chemin operateur

Le module `src/lib/ai-engine/providers` possede une abstraction de providers **encore plus riche** que la publication :

- `ProviderAdapter` (classe abstraite, `providers/adapters/base.ts:21-104`) : `generateText/Image/Embedding` obligatoires, `generateVideo/textToSpeech/generateMusic` optionnels (defaut `NotImplementedError`), `CircuitBreaker` + `RetryPolicy` + cost-tracking integres, cle API resolue via `config.apiKeyEnvVar`.
- `ProviderSelector` (`providers/selector.ts:25-106`) : selection par **capability + priorite**, filtrage des circuit-breakers OPEN, `listAvailable()`, fabrique `createAdapter(config)`. Injection de configuration par `ProviderConfig`.

**Mais ce sous-systeme n'est jamais atteint par l'operateur.** Le parcours reel (`/admin/content-studio-v2/create`) est cable sur le pipeline B (`CreateWorkspace.tsx` -> `/api/admin/content-studio/ideas/:id/generate` et `/drafts/:id/generate-visual`). Aucun import croise `content-studio -> ai-engine/nodes`. (BUG-015, BUG-026, BUG-033, BUG-047, BUG-048)

### 3. Generation pipeline B (create-flow) — anti-pattern : routing en dur, zero substitution

Le module reellement exerce par l'operateur **n'a aucune des proprietes du point fort** :

- **Routing par chaine de `if` sur prefixe de modele** : `generateStudioImage` (`image-generation.ts:41-115`) enchaine `if input.mode==='mock'`, `if isMockImageModel`, `if model.startsWith('hf-')`, `if isOpenAiImageModel`, etc. Pas d'interface provider, pas de registre, pas de capability. Tout id non prefixe `mock-/hf-/gpt-image-/dall-e-` tombe sur le defaut OpenAI (BUG-028).
- **Lecture directe de l'env, sans seam** : `env.CONTENT_STUDIO_OPENAI_API_KEY` lue en dur (`image-generation.ts:87,98,111,124`), idem `generation.ts:70`. Aucune indirection `resolveApiKey()`/`ProviderConfig`. C'est la cause proximale du blocker live (BUG-001, BUG-006) : la cle valide `OPENAI_API_KEY` (len 164) presente dans le process n'est pas mappee dans la chaine de ce module, alors que la **decouverte** de modeles (`models/route.ts` via `resolveApiKey`) la trouve. **Deux chemins de resolution de cle divergents** = desync UI/realite (BUG-007, BUG-043).
- **Aucune DI** : pas de constructeur deps, pas d'injection de `fetch`/upload. Les tests mockent `globalThis.fetch` en dur (BUG-041) plutot que de substituer un adapter.

### 4. Frontiere A/B et bridge — couplage par DB, pont unidirectionnel et a perte

- **Le bridge `content-studio-bridge.ts` est unidirectionnel A->B** (`bridge.ts:81`), declenche uniquement par 3 routes AI-Engine (`generate`, `generate-stream`, `jobs/[id]/review`), jamais par le create-flow (BUG-048). Il n'y a pas de pont B->A : l'operateur ne peut pas "router vers A" depuis B.
- **Le bridge est a perte** : il ne propage que `script/caption/hashtags/images` (`bridge.ts:106-162`). Les champs `voiceover/music/subtitles/composition/exports/thumbnails` ne sont meme pas dans le DTO `GenerationResult` de l'orchestrateur, donc perdus avant le bridge (BUG-004, BUG-034, BUG-066). Le seul rattachement media tente (`upsertPrimaryAsset`, `bridge.ts:153-161`) echoue silencieusement car l'`assetId` synthetique n'a pas de row `media` correspondante (BUG-034).
- **Le couplage A/B passe par la base** (insert idea/brief/draft/run cote A, lecture cote B), pas par un contrat de service partage. Les **taxonomies divergent** (`OBJECTIVE_MAP`/`PILLAR_MAP` du bridge, `bridge.ts:20-49`) et le mapping inverse n'existe pas (BUG-014, BUG-052).

### 5. Separation gen / compose / publish

- **gen vs publish** : bien separes. La publication ne connait que `SocialPublishContent` (caption + media URLs), pas la generation. Bonne frontiere.
- **gen vs compose** : **mal separes selon le pipeline**. En A, `compose`/`transcode-export` sont des nodes du graphe (`nodes/compose.ts`, `transcode-export.ts`) — modulaires mais inatteignables (BUG-033, BUG-047). En B, **il n'existe aucune etape compose** : `generateVisualForDraft` ne fait que generer un asset isole. Le montage promis (mux voix-off/musique, burn-in sous-titres, transcode au spec plateforme) est un module mort pour l'operateur.
- **Stockage non abstrait dans A** : `compose`/`transcode` ecrivent en dur via `fs` + chemin relatif `join(process.cwd(),'../../.media-storage/ai-engine')` au lieu de `getStorage()` utilise par les uploads v2 (BUG-062). Rupture de l'abstraction de stockage : bascule de driver = rupture silencieuse. De meme deux binaires ffmpeg (PATH systeme vs `ffmpeg-static`) selon le module (BUG-068).

### 6. Testabilite par substitution

- **Publication** : bonne (DI au niveau I/O), MAIS les doublures **divergent du contrat reel** Postiz (permalinks `social.example.test`, fixtures inventees, `dryRun:true` force) sans contract-test de parite dry_run<->postiz (BUG-045, BUG-065).
- **Generation B** : mauvaise. Le seul seam est `vi.mock('fetch')`, qui verrouille un **contrat fictif** (endpoints Higgsfield synchrones inventes) identique entre code et mock — donc vert independamment de l'API reelle (BUG-008, BUG-025, BUG-041).
- **Harnais global absent** : `msw@2.14.2` est installe et un `setupServer` + un contract-test partiel existent (`src/test/msw/server.ts`, `content-studio-handlers.contract.test.ts`), mais il **n'est pas monte globalement** dans `vitest.setup.ts` et ne couvre **aucun provider externe** (OpenAI/Higgsfield/Postiz) (BUG-046). Pas de politique "tout reseau passe par MSW".

---

## Problemes concrets

Chaque probleme reference les findings confirmes.

**P1 — Asymetrie d'architecture : le pattern adapter est present cote publication ET cote generation-A, mais absent du seul chemin que l'operateur emprunte (generation-B).**
Le create-flow route par `if model.startsWith(...)` et lit l'env en dur, sans interface ni DI. Resultat direct : le blocker live (cle non lue) et la desync picker/realite.
Findings : BUG-001, BUG-006, BUG-007, BUG-028, BUG-043, BUG-056.

**P2 — Deux pipelines de generation paralleles (A LangGraph / B create) jamais fusionnes ; la richesse modulaire de A est inaccessible.**
Toute la chaine voix-off / musique / sous-titres / compose / transcode vit dans A, modulaire mais hors du parcours operateur.
Findings : BUG-015, BUG-026, BUG-030, BUG-033, BUG-047, BUG-048.

**P3 — Bridge A->B unidirectionnel et a perte : le DTO de sortie de l'orchestrateur ne porte pas les medias composes/audio, donc le bridge ne peut rien propager.**
Le contrat `GenerationResult` est sous-dimensionne ; le seul rattachement media echoue dans un `catch` vide.
Findings : BUG-004 (blocker), BUG-034, BUG-066, BUG-036.

**P4 — Resolution de cle/credential dupliquee et divergente entre modules (decouverte vs generation).**
`models/route.ts` utilise `resolveApiKey()` (chaine ENV_KEY_MAP -> trouve `OPENAI_API_KEY`) tandis que `image-generation.ts`/`generation.ts` lisent une autre variable en dur. Pas de source unique de verite des credentials. Symetriquement cote video, le credential Higgsfield incomplet n'est detecte qu'au point d'usage.
Findings : BUG-001, BUG-002, BUG-005, BUG-007, BUG-016, BUG-043.

**P5 — Catalogue de modeles (registre) decouple du routeur d'execution : un id "live" propose n'est pas forcement routable.**
La decouverte materialise `source:'live'` (BUG-007/024) pour des ids natifs Higgsfield (`flux_2`, `veo3_1`) que `generateStudioVideo`/`generateStudioImage` ne savent pas mapper (attendent `hf-*`). Pas de table de mapping id-natif -> id-interne, ni de contrat partage registre<->routeur.
Findings : BUG-009, BUG-019, BUG-024, BUG-028, BUG-057.

**P6 — Pricing/cout non centralise : trois baremes divergents (registry / service / image-generation) avec incoherence d'unite.**
Trois constantes de pricing non factorisees dans un module unique.
Findings : BUG-057.

**P7 — Abstraction de stockage et binaire media contournees dans le pipeline A.**
`compose`/`transcode` ecrivent en dur (`fs`, chemin relatif) au lieu de `getStorage()` ; deux conventions d'URL ; deux binaires ffmpeg (PATH vs `ffmpeg-static`).
Findings : BUG-062, BUG-068, BUG-031.

**P8 — Testabilite par substitution incomplete : le seam reseau de la publication est bon mais les doublures ne sont pas calquees sur le contrat fournisseur, et la generation-B n'a aucun seam d'adapter.**
Pas de harnais MSW global, pas de contract-test de parite dry_run<->postiz ni des providers externes.
Findings : BUG-041, BUG-045, BUG-046, BUG-018, BUG-035, BUG-065.

**P9 — Pipeline legacy de publication (route `/postiz-draft` -> `createDraftInPostiz`) coexiste avec l'abstraction adapter et la contourne (ignore le garde dry_run/live).**
Module historique non decommissionne, hors du contrat `SocialPublishingAdapter`.
Findings : BUG-040, BUG-069.

**P10 — Provenance du media non modularisee dans le worker de publication : `buildSocialContent` force `metadata.dryRun=true` en dur, quel que soit le mode resolu.**
Constante codee en dur heritee du design dry_run-first, jamais parametree par le mode.
Findings : BUG-065, BUG-039.

---

## Causes racines

1. **Developpement par accretion de deux pipelines historiques (A puis B, ou inversement) jamais unifies derriere un contrat de generation commun.** La publication a beneficie d'une conception "adapter-first" (phase e visible dans les commentaires de contrats) ; la generation B a ete ecrite en mode imperatif direct (routing en dur, env en dur) et la generation A en mode graphe modulaire — les deux n'ont jamais ete reconciliees. Cause de P1, P2, P3, P5.

2. **Absence d'une frontiere de service explicite entre generation et persistance.** Le couplage A/B passe par la base de donnees et un bridge unidirectionnel ad hoc plutot que par une interface `ContentGenerator` partagee. Le DTO `GenerationResult` a ete pense pour le texte, pas pour les medias composes ; il n'a jamais ete elargi. Cause de P3.

3. **Pas de source unique de verite pour les credentials/providers cote B.** Chaque module re-resout sa cle (chaines d'env divergentes), au lieu d'un `CredentialResolver`/`ProviderRegistry` injecte. Cause de P4 (et, par ricochet, des blockers live BUG-001/002).

4. **Le registre de modeles (discovery) et le routeur d'execution sont deux modules independants sans contrat partage** : la decouverte annonce des capacites que le routeur ne sait pas honorer. Cause de P5.

5. **Constantes transverses (pricing, mode dry_run, chemins de stockage, binaire ffmpeg) dispersees plutot que centralisees/injectees.** Cause de P6, P7, P10.

6. **La strategie de test a ete construite "autour du code" (mocks permissifs au niveau `fetch`, MSW non monte globalement) plutot qu'"autour du contrat fournisseur"** ; le bon seam de substitution de la publication (DI au niveau I/O) n'a pas ete generalise ni alimente par des doublures fideles. Cause de P8.

7. **Dette de decommissionnement** : les modules legacy (route `/postiz-draft`, provider `meta_graph` null) n'ont pas ete retires apres l'introduction de l'abstraction adapter. Cause de P9.

---

## Criticite (justifiee)

**Criticite de l'axe : major.**

Justification :
- L'axe modularite **n'introduit pas a lui seul un blocker** : un systeme peut etre monolithique et fonctionner. Mais ici, **le defaut de modularite cote generation-B est la cause proximale directe** du blocker live BUG-001 (cle non lue faute d'indirection de credential) et de la desync UI/realite (BUG-006/007/043). La mauvaise modularite **materialise** des blockers fonctionnels traites sur d'autres axes.
- L'asymetrie est severe : un sous-systeme exemplaire (publication, generation-A) coexiste avec un sous-systeme non modulaire (generation-B) qui est **precisement celui que l'operateur utilise**. Le point fort existe donc deja dans le depot — il "suffit" de l'etendre, ce qui rend la dette **adressable a cout raisonnable** (ne justifie pas `critical` au sens de l'echelle, qui vise la perte de donnees/publication erronee).
- La frontiere A/B (bridge unidirectionnel, DTO sous-dimensionne) **bloque structurellement** l'acces de l'operateur a des fonctionnalites entieres (voix-off/musique/montage) : c'est l'origine architecturale du blocker BUG-004. A ce titre l'impact transversal est eleve.

Lecture : `major` en tant que dette d'architecture/modularite ; mais cette dette **alimente** des findings `blocker` (BUG-001, BUG-004) qui restent traites comme tels dans leur axe d'origine.

---

## Recommandations (actionnables, priorisees)

### Priorite 0 — Deblocage bon marche qui ne degrade pas la modularite (alignement avec le constat de l'audit)

- **R0.1** Introduire un `resolveContentStudioOpenAiKey()` (un seul module, chaine `CONTENT_STUDIO_OPENAI_API_KEY -> AI_ENGINE_OPENAI_API_KEY -> CHAT_OPENAI_API_KEY -> OPENAI_API_KEY`) et l'utiliser dans `image-generation.ts`, `video-generation.ts`, `generation.ts`. Source unique de verite des credentials cote B. Cible : P4 / debloque BUG-001, BUG-005, BUG-006. **Critere de fin** : meme cle resolue par la decouverte ET la generation, prouve par une generation image live reussie depuis `/create` (mock ET live).

### Priorite 1 — Extraire le pattern adapter de la publication vers la generation-B

- **R1.1** Definir une interface `ImageGenerationProvider` / `VideoGenerationProvider` (calquee sur `SocialPublishingAdapter`) : `provider`, `supports(model)`, `generate(input)`, avec DI des deps reseau au constructeur (comme `PostizAdapterDeps`). Remplacer la chaine de `if` de `generateStudioImage` par une fabrique `providerForModel(model, mode)` + un registre. Cible : P1.
- **R1.2** Etablir un **contrat partage registre<->routeur** : tout id propose par la discovery DOIT etre resolvable par la fabrique (sinon il n'est pas materialise `live`). Ajouter une table de mapping id-natif Higgsfield -> id-interne. Cible : P5 / BUG-009, BUG-024, BUG-028.
- **Critere de fin** : aucun modele affiche `Live` dans le picker ne peut throw `invalid_state` a la generation ; prouve par un test de parite "tout modele liste est routable".

### Priorite 2 — Reparer la frontiere A/B (DTO + bridge)

- **R2.1** Elargir le DTO `GenerationResult` de l'orchestrateur pour inclure `voiceover/music/subtitles/composition/exports/thumbnails` (assets normalises avec URL servable). Cible : P3 / BUG-004, BUG-066.
- **R2.2** Faire que le bridge **materialise reellement** les assets media (creer la row `media` AVANT `upsertPrimaryAsset`, supprimer le `catch {}` silencieux). Cible : BUG-034.
- **R2.3** Decision d'architecture explicite : soit unifier B sur A (un seul moteur derriere une facade `ContentGenerator`), soit cabler le create-flow vers A via le bridge bidirectionnel. Documenter le choix (ADR). Cible : P2.
- **Critere de fin** : une generation `reel` declenchee depuis le parcours operateur produit un MP4 monte (voix-off + sous-titres) visible et publiable, en mock ET en live.

### Priorite 3 — Centraliser les constantes transverses et l'abstraction de stockage

- **R3.1** Un module unique `pricing.ts` (source de verite) consomme par registry / service / image-generation. Cible : P6 / BUG-057.
- **R3.2** Router `compose`/`transcode` via `getStorage()` et `ffmpeg-static` partout ; une seule convention d'URL `_media`. Cible : P7 / BUG-062, BUG-068.
- **R3.3** Parametrer `buildSocialContent.metadata.dryRun` sur le mode resolu (pas de constante en dur). Cible : P10 / BUG-065.

### Priorite 4 — Generaliser le seam de substitution et la fidelite des doublures

- **R4.1** Monter un `setupServer` MSW **global** dans `vitest.setup.ts` avec politique "tout appel reseau externe passe par un handler". Cible : P8 / BUG-046.
- **R4.2** Ecrire des handlers MSW **calques sur les contrats reels** (OpenAI images, Higgsfield text2image/image2video async, Postiz upload+posts) et un **contract-test de parite dry_run<->postiz**. Cible : BUG-041, BUG-045, BUG-018, BUG-035.
- **R4.3** Reecrire les endpoints Higgsfield (async submit+poll) DERRIERE l'interface `VideoGenerationProvider` introduite en R1.1, de sorte que la correction soit locale a un adapter. Cible : BUG-008, BUG-025.
- **Critere de fin** : un test de parite echoue si une doublure devie du contrat fournisseur ; aucun test ne reste vert face a un endpoint provider modifie.

### Priorite 5 — Decommissionner le legacy

- **R5.1** Supprimer la route `/postiz-draft` (`createDraftInPostiz`) au profit de `/draft-on-provider` (passant par l'adapter et le garde dry_run). Cible : P9 / BUG-040.
- **R5.2** Retirer ou implementer `meta_graph` (aujourd'hui `null` -> trappe). Cible : BUG-069.

---

## Points a verifier sous tous les angles (avant cloture de l'axe)

- Confirmer qu'apres R1.1 **aucun chemin de generation B ne lit `env.*` directement** (grep `env\.CONTENT_STUDIO_OPENAI` / `env\.AI_ENGINE_HIGGSFIELD` hors du resolver et des adapters).
- Verifier que la decouverte et la generation partagent **la meme fabrique** (un seul point de verite "ce modele est-il utilisable ?").
- Verifier que le DTO elargi (R2.1) est **consomme** par l'UI (`GenerationResult.tsx`) et **persiste** par le bridge — pas seulement defini.
- Verifier que le harnais MSW global (R4.1) n'introduit pas de regression sur les tests RTL existants (les mocks globaux `next/navigation`/fonts restent compatibles).
- Verifier en mock ET en live (selon le DoD global) que la substitution dry_run->postiz **ne change pas la forme du resultat** observe par l'operateur (parite de contrat).
