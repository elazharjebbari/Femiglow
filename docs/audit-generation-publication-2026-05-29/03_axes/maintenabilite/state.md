# Axe maintenabilite

> Audit FemiGlow Content Studio v2 / AI Engine — pipeline génération + publication.
> Baseline figée au **2026-05-29**, branche `feat/ai-engine-langgraph-mvp`.
> Lentille : duplication des deux pipelines A/B, dispersion de la résolution des clés env, couplage UI↔routes, lisibilité, dette, tests qui valident des mocks plutôt que des contrats, documentation du contrat des providers.
> Principe directeur (cf. `01_methodology.md`) : la vérité = le comportement réel exercé par un opérateur, pas le rapport de tests. Toute fonctionnalité non vérifiée en MOCK **et** LIVE est cassée par défaut.

---

## Fonctionnement optimal attendu (référentiel de maintenabilité)

Un système maintenable pour ce périmètre, c'est :

1. **Un seul pipeline de génération** (ou deux pipelines dont l'un consomme explicitement l'autre via un contrat versionné et testé), pas deux implémentations parallèles divergentes de la même capacité (texte, image, vidéo).
2. **Une seule chaîne de résolution de clé OpenAI**, partagée par la découverte de modèles, la génération opérateur et l'AI-Engine — qui neutralise correctement la chaîne vide (cf. `copywriting/spec.md` §8 : *« Une seule chaîne de résolution de clé OpenAI partagée par discovery + génération + AI-Engine »*).
3. **Un contrat de provider externe documenté et asservi** (OpenAI, Higgsfield, Postiz) : doublures de test calquées sur l'OpenAPI réel du fournisseur (sync vs async), de sorte qu'un changement de contrat casse un test plutôt que la prod.
4. **Un couplage UI↔backend où le picker ne propose que ce que le moteur sait exécuter** : la source de vérité du catalogue de modèles et la source de vérité de la clé d'exécution sont les mêmes.
5. **Une suite de tests qui valide des effets backend réels et des contrats**, pas des mocks pré-câblés pour réussir ; et dont le **code de sortie** reflète l'état réel (exit 0 ⇔ vert).
6. **Des frontières de module nettes** : DTO de sortie complet (toute donnée produite par le graphe est exposée), stockage via une abstraction unique, binaire ffmpeg unique, taxonomies/enums partagées.

L'écart entre cet attendu et l'état constaté est l'objet de cet axe.

---

## Etat actuel (constaté, avec preuves)

### A. Deux pipelines parallèles non fusionnés (duplication structurelle)

Le code embarque **deux implémentations complètes et divergentes** de la même capacité de génération :

- **Pipeline A — AI-Engine LangGraph** (`src/lib/ai-engine/`) : **17 nœuds** (`ls lib/ai-engine/nodes/*.ts` hors tests : parse-brief, enrich-knowledge, enrich-trends, generate-script, generate-caption, generate-images, generate-video, generate-voiceover, generate-music, generate-subtitles, compose, transcode-export, quality-check, moderate, human-review, generate-variants), orchestrés par `orchestrator.ts` + `graph/builder.ts`, atteignable **uniquement** par `POST /api/admin/ai-engine/generate` (UI `/ai-engine/create`).
- **Pipeline B — create flow Content Studio** (`src/lib/content-studio/`) : `generation.ts` (texte), `image-generation.ts`, `video-generation.ts`, exposé par `/api/admin/content-studio/...`, c'est **le seul que l'opérateur utilise** (`CreateWorkspace.tsx` → `/api/admin/content-studio/ideas/:id/generate`).

Duplication mesurée (lignes de code de logique métier doublée) :
- Texte : `content-studio/generation.ts` (211 l.) **vs** `ai-engine/nodes/generate-script.ts` (393 l.) + `generate-caption.ts` (193 l.).
- Image : `content-studio/image-generation.ts` (272 l.) **vs** `ai-engine/nodes/generate-images.ts` (202 l.).
- Vidéo : `content-studio/video-generation.ts` (261 l.) **vs** `ai-engine/nodes/generate-video.ts` (250 l.).

Preuve de la disjonction : `grep -rln "ai-engine" lib/content-studio/ components/admin/content-studio-v2/create/` → **vide** ; `grep -rln "api/admin/ai-engine" components/admin/content-studio-v2/create/` → **vide**. Le create flow n'importe jamais l'AI-Engine et ne référence aucune de ses routes.
→ Findings : **BUG-015** (texte A/B), **BUG-026** (image A/B), **BUG-033** (montage inatteignable), **BUG-047** (la couverture porte sur A alors que l'opérateur n'utilise que B), **BUG-048** (le create flow n'a aucun lien avec voix-off/musique/sous-titres).

Le **bridge** est censé relier les deux (`bridge/content-studio-bridge.ts`, 193 l.) mais il est **unidirectionnel** (A→B), n'est **jamais déclenché par le create flow**, et ne propage que `result.images` (l.147-157) — pas `composition`, `exports`, `thumbnails`, `videos`.
→ Findings : **BUG-034** (bridge ne propage pas composition/exports/thumbnails), **MISS-005** (cause racine plus profonde : voir §F).

### B. Split de clé env dispersé : 4 mécanismes de résolution divergents

`OPENAI_API_KEY` valide (sk-, 164 chars) **est présent** dans le process (`evidence/runtime-env-state.md` l.23), mais **n'est même pas déclaré dans `src/lib/env.ts`** — ni schéma, ni mapping runtime (`grep "OPENAI_API_KEY" lib/env.ts` ne renvoie que les variantes préfixées). Il est donc invisible à l'objet `env` typé.

La résolution de la clé OpenAI est implémentée **quatre fois, de quatre façons incompatibles** :

| Lieu | Mécanisme (chaîne) | Neutralise `''` ? |
|---|---|---|
| `ai-engine/services/api-key-manager.ts:42` | `ENV_KEY_MAP.openai = ['AI_ENGINE_OPENAI_API_KEY','CONTENT_STUDIO_OPENAI_API_KEY','CHAT_OPENAI_API_KEY','OPENAI_API_KEY']` (via `resolveEnvKey` + `if(val)`) | **oui** |
| `ai-engine/config/engine-config.ts:75` | `env.AI_ENGINE_OPENAI_API_KEY \|\| env.CONTENT_STUDIO_OPENAI_API_KEY \|\| env.CHAT_OPENAI_API_KEY \|\| process.env.OPENAI_API_KEY` | **oui** (`\|\|`) |
| `content-studio/generation.ts:70` | `env.CONTENT_STUDIO_OPENAI_API_KEY ?? env.CHAT_OPENAI_API_KEY` | **non** (`??` laisse passer `''`) |
| `content-studio/image-generation.ts:87/98/111/124` | **lecture directe** `env.CONTENT_STUDIO_OPENAI_API_KEY` (aucun fallback) | n/a |

Conséquence : la **découverte de modèles** (pipeline A, `api-key-manager` → trouve `OPENAI_API_KEY`) annonce des modèles OpenAI `source:"live"`, mais la **génération opérateur** (pipeline B, lit `CONTENT_STUDIO_OPENAI_API_KEY` vide) ne peut jamais les exécuter. Une clé sauvegardée en DB via l'AI-Engine (`saveApiKey`) serait totalement invisible au flux create.
→ Findings : **BUG-001** (cause #1 = split de clé), **BUG-005** (texte figé en fallback), **BUG-006/BUG-007** (sources de clé divergentes picker↔générateur), **MISS-003** (défaut transverse de résolution), **MISS-007** (clé présente mais orpheline), **MISS-013** (`??` ne neutralise pas la chaîne vide — re-cassera la config LIVE même après ajout d'une clé).

Côté Higgsfield, même classe de dette : `AI_ENGINE_HIGGSFIELD_API_KEY` mono-partie sans `:`, `AI_ENGINE_HIGGSFIELD_API_SECRET` vide → credential incomplet (`evidence/runtime-env-state.md` l.27-28). → **BUG-002**, **BUG-025**.

### C. Couplage UI↔routes : le picker promet ce que le backend ne sait pas exécuter

Le `ModelPicker` et la route `models/route.ts` constituent une **source de vérité du catalogue** déconnectée de la **source de vérité de l'exécution** :

- `materialiseDiscoveredModel` (route.ts:62-88) **force `source:'live'`** même quand `discoverModels` a renvoyé `source='fallback'` (host Higgsfield mort) → badge « Live » mensonger. → **BUG-007**, **BUG-024**, **BUG-043**.
- `role=chat` expose **106 entrées** dont `whisper-1` (STT), `sora-2`, `gpt-realtime/audio`, `davinci-002` — classés `chat` par défaut par `inferRole` (model-discovery.ts:166), sélectionnables comme « modèle de génération de texte ». → **BUG-016**, **BUG-019**, **MISS-018**.
- `allowCustom` est `true` par défaut ; les schémas Zod acceptent `model: z.string().min(1).max(120)` **sans validation contre le registre** → un id arbitraire atteint le générateur. → **BUG-028**, **MISS-015**.
- `ModelPicker` auto-sélectionne le `suggested` live au montage → le 1er clic « Générer » en live part avec un modèle non-fonctionnel. → **MISS-002**.

Le routeur de génération reconnaît des **préfixes internes** (`mock-`, `hf-`, `gpt-image-`, `dall-e-`) alors que la découverte sert des **IDs natifs** (`flux_2`, `veo3_1`, `kling3_0`) : aucun mapping ID-natif→interne. → **BUG-009**, **BUG-028**, **MISS-022**.

### D. Tests qui valident des mocks plutôt que des contrats

- **871 fichiers de test**, dont **19 mockent `fetch`** avec des réponses idéales. Aucun n'asservit les handlers OpenAI/Higgsfield/Postiz à l'OpenAPI réel du fournisseur. → **BUG-041** (0 test sur 95 n'asserte un effet backend réel ; 58 mockent fetch).
- Les tests des nœuds AI-Engine mockent le LLM **systématiquement en rejet** (`invoke: vi.fn().mockRejectedValue('No API key')`) → seul le chemin **fallback** est exercé, jamais le parsing JSON / `schema.parse` / coût du chemin LIVE. → **BUG-018**.
- Les tests Higgsfield sont écrits **autour du code faux** : ils mockent un endpoint synchrone `/v1/videos/generate` et une clé `hf_test:secret_test`, alors que l'API réelle est async (`/v1/image2video/<model>` + `requests/{id}/status`). Le commentaire `TODO(higgsfield)` du code l'admet (`video-generation.ts:153`, `image-generation.ts:167`). → **BUG-008**, **BUG-025**, **BUG-027**, **MISS-008**, **MISS-009**.
- **MSW est installé** (`msw ^2.14.2`) mais **non câblé en harnais global** : `src/test/msw/server.ts` exporte un `setupServer()` **vide**, et chaque fichier de test appelle son propre `server.listen()` ad hoc. `vitest.setup.ts` ne contient **aucune** référence MSW. Le contract test existant (`content-studio-handlers.contract.test.ts`) ne couvre **que les routes internes** contre des schémas Zod, **jamais les providers externes** — précisément la zone à risque. → **BUG-046**, **MISS-008**.
- Mocks globaux trop larges dans `vitest.setup.ts` (next/navigation push/refresh = no-op) : les tests qui « valident une redirection après publish » n'assertent rien de réel. → **BUG-046**, **MISS-031**.
- Le rapport de tests **ment sur l'état du process** : `1695 passed / 0 failed / success:true` **mais EXIT 1** (unhandled rejection fake-timer non drainée ; aucun `afterEach` global `clearAllTimers/restoreAllMocks`). Un gate CI lisant le compteur ou le JSON conclurait « tout vert ». → **BUG-010**, **BUG-027**, **BUG-032**.
- Tests non isolés : `MEDIA_DIR = join(process.cwd(),'../../.media-storage/ai-engine')` est **partagé entre tests et runtime** ; des stubs texte de 10 octets ont pollué le stockage média de prod (977 .jpg). → **BUG-031**, **BUG-035**, **MISS-004**, **MISS-024**.
- L'E2E publish-draft Postiz cible une table `audit_event` (singulier) **inexistante** (réelle = `audit_events`), donc ces E2E DB ne tournent pas en CI (sinon rouge permanent). → **BUG-023**, **BUG-042**, **BUG-064**.

### E. Documentation du contrat des providers : absente ou contredite par le code

- Le contrat Higgsfield est **faux et signalé comme tel** par des `TODO` dans le code lui-même (sync vs async). Aucune doublure ne reflète l'API réelle. → **BUG-008**, **BUG-025**, **MISS-008/009**, et MEMORY `higgsfield-api-mismatch`.
- Le mode dry_run Postiz / fixtures divergent de l'API Postiz réelle (permalinks fictifs `social.example.test`) ; seul le contrat de **lecture** (`GET /integrations`) est prouvé. → **BUG-037**, **BUG-045**.
- Désaccord code↔commentaire : `GenerationModeToggle.tsx:13` affirme « cookie scoped to the admin path » alors que `:20` pose `path=/`. → **MISS-034**.
- Capabilities sociales **persistées stale** vs code adapter à jour (deux sources de vérité). → **BUG-063**, **MISS-029**.

### F. Frontières de module floues / DTO amputé / singletons figés

- **DTO de sortie amputé** : l'interface `GenerationResult` (`orchestrator.ts:30-37`) ne déclare **que** `images`/`videos`. `composition`, `exports`, `thumbnails` n'existent que dans le `finalState` interne (l.182-184) et **ne sont jamais propagés** par `buildResultFromState` (l.109-123). Même en corrigeant le bridge, ces champs seraient `undefined`. → **MISS-005**, en amont de **BUG-004** et **BUG-034**.
- **Aucun nœud média ne pousse dans `state.errors`** : tout échec audio/vidéo retourne un asset `url=''` sans dégrader le statut → le quality-gate ne peut **jamais** détecter un média manquant → job « completed » trompeur. → **MISS-011**.
- **Stockage à deux abstractions** : `compose`/`transcode` écrivent en `fs` + chemin codé en dur, ignorant `getStorage()` (utilisé par les uploads v2). → **BUG-062**, **MISS-032**.
- **Deux binaires ffmpeg** : `upload-video.ts` utilise le ffmpeg système (PATH) ; les nœuds AI-Engine utilisent `ffmpeg-static`. → **BUG-068**.
- **Taxonomies/enums non partagées** : enum `tone` désynchronisé sur 3 sources (UI / DTO route / parse-brief) → 3 tons sur 6 cassent toute génération ; taxonomies pillar/objective définies indépendamment. → **BUG-014**, **BUG-052**.
- **Singletons figés** : `engine-config.ts:51` met la config en cache module (`if(_config) return`) ; `api-key-manager` met la clé en cache 5 min sans invalidation env. Changer un provider/une clé n'a aucun effet sans restart, et `resetEngineConfig` n'est appelé que par les tests. → **MISS-030**, **MISS-033**.
- **Pricing dupliqué et incohérent** sur 3 couches (registry / service / image-generation), unités divergentes (cents vs cents/appel). → **BUG-057**.

---

## Problèmes concrets (chaque problème → finding(s))

| # | Problème de maintenabilité | Findings |
|---|---|---|
| M1 | **Duplication des deux pipelines A/B** : ~1300 lignes de logique métier doublée (texte/image/vidéo), comportements divergents selon le point d'entrée, le create flow n'importe jamais A. | BUG-015, BUG-026, BUG-033, BUG-047, BUG-048 |
| M2 | **Bridge A→B unidirectionnel et incomplet** : ne propage que les images, jamais composition/exports/thumbnails/vidéo ; jamais déclenché par le create flow. | BUG-004, BUG-034, BUG-047, MISS-005 |
| M3 | **Split de clé OpenAI dispersé sur 4 mécanismes** ; `OPENAI_API_KEY` absent de `env.ts` ; `??` qui ne neutralise pas la chaîne vide. Cause racine la plus rentable à corriger. | BUG-001, BUG-005, BUG-006, BUG-007, MISS-003, MISS-007, MISS-013 |
| M4 | **Couplage UI↔routes désynchronisé** : picker promet des modèles « live » non exécutables ; `materialiseDiscoveredModel` force `source:'live'` ; pas de validation du model contre un registre ; pas de mapping ID-natif→interne. | BUG-006, BUG-007, BUG-009, BUG-016, BUG-019, BUG-024, BUG-028, BUG-043, MISS-002, MISS-015, MISS-018, MISS-022 |
| M5 | **Tests qui valident des mocks, pas des contrats** : nœuds testés en fallback only, doublures Higgsfield sur contrat synchrone faux, MSW non câblé en harnais global. | BUG-018, BUG-027, BUG-041, BUG-045, BUG-046, MISS-008, MISS-009 |
| M6 | **Le rapport de tests ment** : 1695 passed mais EXIT 1 (unhandled rejection fake-timer) ; pas de teardown global. | BUG-010, BUG-027, BUG-032 |
| M7 | **Tests non isolés** : `MEDIA_DIR` partagé tests/runtime, pollution du stockage prod ; E2E sur table inexistante (`audit_event`). | BUG-023, BUG-031, BUG-035, BUG-042, BUG-064, MISS-004, MISS-024 |
| M8 | **Contrats providers non documentés / contredits par le code** : Higgsfield sync/async faux (`TODO` dans le code), fixtures Postiz fictives, capabilities persistées stale. | BUG-008, BUG-025, BUG-037, BUG-045, BUG-063, MISS-008, MISS-009, MISS-029 |
| M9 | **DTO de sortie amputé / contrat d'erreur absent** : composition/exports/thumbnails perdus avant le bridge ; aucun nœud média ne signale son échec. | MISS-005, MISS-011, BUG-004, BUG-034 |
| M10 | **Abstractions dédoublées** : 2 binaires ffmpeg, 2 abstractions de stockage, pricing triplé, taxonomies/enums non partagés. | BUG-014, BUG-052, BUG-057, BUG-062, BUG-068, MISS-032 |
| M11 | **Configuration figée en singleton** : config/clé en cache module sans invalidation env → comportement non reproductible sans restart, piège pour l'exploitant et l'auditeur. | MISS-030, MISS-033 |
| M12 | **Couplage cwd implicite** : `MEDIA_DIR` calculé via `process.cwd()+'../../'` casse hors `apps/web`. | MISS-024, MISS-032 |

---

## Causes racines

1. **Refactor inachevé (A devait remplacer B, ce qui n'a jamais eu lieu).** L'AI-Engine LangGraph (pipeline A) a été développé comme successeur, le create flow (pipeline B) maintenu en parallèle, et le bridge écrit comme rustine partielle au lieu d'une migration. Résultat : double maintenance, double surface de bug, et c'est l'ancien système (B) le moins soigné qui sert l'opérateur. (M1, M2, M9)

2. **Absence de couche unique « configuration / résolution de secrets ».** Chaque module a réimplémenté sa propre résolution de clé au gré des besoins, avec des opérateurs (`||` vs `??`), des chaînes et des sources (env vs DB chiffrée) différentes. `env.ts` n'a jamais été tenu comme **la** source de vérité (OPENAI_API_KEY n'y figure même pas). (M3, M11)

3. **Tests écrits pour passer, pas pour prouver.** La stratégie a été : mocker tout ce qui est externe avec des réponses idéales, et asserter les valeurs de retour du code lui-même. Les doublures ont été calquées sur le code (parfois faux) plutôt que sur le contrat fournisseur. MSW, installé, n'a jamais été promu en politique « tout réseau passe par MSW calqué sur l'OpenAPI réel ». D'où le décalage systématique test↔réalité que le commanditaire constate. (M5, M6, M7, M8)

4. **Couplage présentation↔données non gouverné.** Le catalogue de modèles (discovery) et l'exécution (générateur) ont été câblés indépendamment, sans contrat partagé garantissant qu'un modèle affiché est exécutable. (M4)

5. **Frontières de module non tenues.** DTO non maintenu à mesure que le graphe s'enrichissait (composition/exports ajoutés au state mais pas à l'interface de sortie), abstractions (stockage, ffmpeg) introduites sans rétro-alignement de l'existant, taxonomies dupliquées par copier-coller. (M9, M10, M12)

---

## Criticité (justifiée)

**Criticité de l'axe : `critical`.**

Justification — la maintenabilité n'est pas qu'un confort de développeur ici, c'est **le mécanisme générateur des 4 blockers** :

- La duplication A/B est la cause directe de **BUG-004** (blocker : voix-off/musique/sous-titres/montage inatteignables) et de l'inaccessibilité du montage (**BUG-033**).
- Le split de clé dispersé est la cause #1 de **BUG-001** (blocker : génération image live cassée) et de **BUG-005** (texte figé en fallback).
- Les tests qui valident des mocks plutôt que des contrats sont la raison pour laquelle **aucun de ces blockers n'a été détecté en CI** (1695 « passed »), et **BUG-010** (le rapport ment) institutionnalise l'angle mort.

Ce n'est pas classé `blocker` parce qu'un axe transversal ne bloque pas en lui-même un parcours opérateur unique (ce sont les findings individuels qui le font). Mais la **densité** (M1→M12 référencent ~45 findings distincts, dont les 4 blockers et la majorité des critical) et le **caractère systémique** (chaque correctif ponctuel risque de re-casser faute de source de vérité unique — cf. MISS-013 : la config LIVE re-cassera même après ajout d'une clé tant que `??` n'est pas corrigé) placent l'axe au niveau `critical`. La dette de maintenabilité est ce qui transforme des bugs isolés et bon marché à corriger en un système globalement non livrable et non fiable.

---

## Recommandations (actionnables, priorisées)

### P0 — Débloquer + arrêter l'hémorragie (jours)

1. **Unifier la résolution de clé en une seule fonction partagée** (réutiliser `resolveApiKey`/`ENV_KEY_MAP` de `api-key-manager.ts`), déclarer `OPENAI_API_KEY` dans `env.ts`, et faire pointer `generation.ts` + `image-generation.ts` dessus. Remplacer le `??` par une logique qui traite `''` comme absent. → débloque **BUG-001**, **BUG-005** à coût quasi nul (cf. `runtime-env-state.md` l.48 : « correctif bon marché et à fort impact »). Couvre M3, MISS-007, MISS-013.
2. **Ajouter un teardown global de tests** (`afterEach` → `vi.clearAllTimers()`, `vi.restoreAllMocks()`) et faire échouer la CI sur le **code de sortie**, pas le compteur. → tue **BUG-010/032** (M6) et révèle immédiatement la vraie santé.
3. **Isoler le stockage de test** (`MEDIA_DIR` via env override → `tmpdir()` en test) et **purger les 977 stubs** du stockage prod après audit des références orphelines en table `media`. → M7, **BUG-031/035**, **MISS-004**.
4. **Corriger le nom de table de l'E2E Postiz** (`audit_event` → `audit_events`) et l'intégrer à la CI. → **BUG-023/042**, M7.

### P1 — Aligner UI↔backend sur une source de vérité (1-2 semaines)

5. **Faire de la route `models` la source de vérité unique** : ne lister `source:'live'` que si la **même clé** que celle consommée par le générateur est résoluble ; propager fidèlement `r.source` (`fallback`/`cache`/`live`) ; filtrer par capacité (liste blanche de rôles, exclure whisper/sora/realtime du rôle chat) ; valider `model` côté API contre le registre ; désactiver `allowCustom` par défaut. → M4 (**BUG-006/007/009/016/019/024/028/043**, **MISS-002/015/018/022**).
6. **Documenter et asservir le contrat des providers** : écrire les handlers MSW d'OpenAI/Higgsfield/Postiz **calqués sur l'OpenAPI réel** (Higgsfield async, cf. MEMORY), monter MSW en harnais **global** (`vitest.setup.ts` → `server.listen({onUnhandledRequest:'error'})`), et ajouter des **contract tests** provider. Réécrire les endpoints Higgsfield en async (lever les `TODO`). → M5, M8 (**BUG-008/018/025/041/045/046**, **MISS-008/009**).
7. **Compléter le DTO de sortie de l'orchestrateur** : déclarer et propager `composition`/`exports`/`thumbnails`/`videos` dans `GenerationResult` + `buildResultFromState` ; faire pousser chaque nœud média ses échecs dans `state.errors` pour que le quality-gate dégrade le statut. → M9 (**MISS-005/011**, prérequis de **BUG-004/034**).

### P2 — Réduire la dette structurelle (1-2 mois)

8. **Décider et exécuter la convergence des pipelines** : soit le create flow consomme l'AI-Engine via un bridge **bidirectionnel testé** (avec mapping de taxonomie réconcilié), soit on supprime le pipeline A et on porte ses prompts riches dans B. Interdire la coexistence silencieuse. → M1, M2 (**BUG-015/026/033/047/048**, **BUG-052**).
9. **Centraliser les abstractions transverses** : un seul binaire ffmpeg (`ffmpeg-static` partout), `getStorage()` unique pour compose/transcode, un module de pricing unique, des enums/taxonomies partagés (`tone`, pillar, objective) entre UI/route/nœuds. Résoudre `MEDIA_DIR` via un chemin absolu configuré, pas `process.cwd()`. → M10, M12 (**BUG-014/052/057/062/068**, **MISS-032**).
10. **Supprimer les singletons figés ou les rendre invalidables au runtime** (config/clé) et brancher `resetEngineConfig` sur un signal d'exploitation. → M11 (**MISS-030/033**).

### Critère de fin (DoD maintenabilité)
> Une seule chaîne de résolution de clé ; un seul pipeline (ou A consommé par B via contrat testé) ; MSW global calqué sur l'OpenAPI réel des 3 providers ; CI qui échoue sur le code de sortie ; picker prouvé aligné sur l'exécution en MOCK **et** LIVE. Tant que ces points ne sont pas vérifiés par un parcours opérateur, l'axe reste `critical`.
