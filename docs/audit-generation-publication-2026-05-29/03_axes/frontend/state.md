# Axe frontend

> Diagnostic transversal — Phase 2 de l'audit FemiGlow Content Studio v2 / AI Engine.
> Baseline figée au **2026-05-29**, branche `feat/ai-engine-langgraph-mvp`.
> Lentille : architecture composants React (`CreateWorkspace`, `MediaStudio`, `PublishActionGroup`, `StudioContext`), état optimiste vs serveur, hydratation, cookie `cs_generation_mode`, propagation des métadonnées média, gestion d'erreurs typées côté client.
>
> Principe directeur (cf. `01_methodology.md` §1) : **la vérité, c'est le comportement réel exercé par un opérateur, pas le rapport de tests.** Tout ce qui n'est pas prouvé en MOCK *et* en LIVE est `broken by default`.

---

## Etat actuel (constaté, avec preuves)

### 1. Architecture des composants — un shell propre, deux pipelines distincts

L'opérateur travaille exclusivement dans le **flux create** (pipeline B, `content-studio`), monté à `/admin/content-studio-v2/create`. La hiérarchie est saine et bien séparée :

- `CreateWorkspace.tsx` — wrapper client `'use client'` qui enveloppe `StudioProvider` + layout 3 colonnes (IntentionForm | MediaStudio + CaptionEditor | PreviewPane) + `Stepper` en tête et `PublishActionGroup` en pied (preuve : `CreateWorkspace.tsx:38-355`). La page reste un Server Component (hydratation des données initiales via `initialIdeas/initialDrafts/initialMediaItems/initialDraftId`).
- `StudioContext.tsx` — source de vérité unique pour `ideas / drafts / posts / jobs / mediaItems / selectedDraftId / mockMode`, exposée par `useStudio()`, avec hooks composables `useDraft()` et `useDraftAutosave()` (debounce 1,5 s, PATCH `/drafts/:id`, gestion `session_expired` sur 401 — `StudioContext.tsx:252-335`).
- `MediaStudio.tsx`, `PublishActionGroup.tsx`, `ModelPicker.tsx`, `IntentionForm.tsx`, `GenerationModeToggle.tsx` — composants feuilles bien isolés, instrumentés pour l'E2E (`data-cs-*`, `data-testid`).

Il existe **un second pipeline parallèle**, l'AI-Engine (pipeline A, LangGraph), avec sa propre UI (`/admin/content-studio-v2/ai-engine/create/page.tsx` + `components/.../ai-engine/GenerationResult.tsx`). **L'opérateur de production n'utilise pas ce flux** ; le bridge A→B est unidirectionnel. Les deux UI ne partagent ni état ni DTO de résultat.

Preuve de couverture de tests composants : 12 fichiers `*.test.tsx` dans `components/.../create/` (ApproveButton, CaptionEditor, GenerationModeToggle, IntentionForm, MediaStudio, MockModeBadge, ModelPicker, PreviewPane ×2, PublishActionGroup, Stepper, VariantsCompare) + `StudioContext.test.tsx`. MSW est utilisé dans 3 d'entre eux (`IntentionForm`, `VariantsCompare`, `MediaStudio` via `@/test/msw/server`).

### 2. Gestion d'état optimiste vs serveur

L'état est **majoritairement optimiste** : après une action, l'UI met à jour le state local avant (ou sans) re-synchroniser le serveur.
- Après approbation, `onApproved` pousse le post dans le contexte et force `draft.status='approved'` localement (`CreateWorkspace.tsx:308-319`) pour débloquer immédiatement `PublishActionGroup`.
- Après sélection de variante, `upsertDraft(v.draft)` met à jour le state puis déclenche en arrière-plan un `POST /review` dont le `.catch(() => {})` est silencieux (`CreateWorkspace.tsx:261-269`).
- `useDraftAutosave` est le seul flux véritablement réconcilié : il renvoie le `draft` serveur et fait `upsertDraft(json.draft)` (`StudioContext.tsx:290-291`).

Le `StudioProvider` expose `value` sur `window.__STUDIO_CTX__` pour Playwright (`StudioContext.tsx:205-210`) — pratique d'instrumentation acceptable mais qui fuit l'état interne sur `window` en production.

### 3. Hydratation et `mockMode`

- `mockMode` est hydraté **après le montage** par un `fetch('/api/admin/content-studio/health')` qui lit `CONTENT_STUDIO_V2_MOCK_MODE` (`StudioContext.tsx:104-114`). En staging cette variable n'est pas définie → `health.mockMode = false`.
- `GenerationModeToggle` hydrate son mode depuis `localStorage` dans un `useEffect` (anti-mismatch SSR), avec un état `hydrated` qui pilote l'opacité (`GenerationModeToggle.tsx:47-57`). **Au montage, il pose immédiatement le cookie** via `persistMode(next)` (ligne 56), même sans choix opérateur.

### 4. Le cookie `cs_generation_mode` — clé de voûte fragile

`GenerationModeToggle` maintient **deux** clés de persistance distinctes :
- `localStorage['cs-generation-mode']` (lecture rapide client, tirets) ;
- cookie `cs_generation_mode` (lecture serveur, underscores) — `GenerationModeToggle.tsx:9-10`.

Grep exhaustif du dépôt : le cookie `cs_generation_mode` n'est lu **que** par `app/api/admin/content-studio/drafts/[id]/generate-visual/route.ts:27`. Aucune autre route serveur ne le consomme. La fonction utilitaire `readGenerationModeFromCookie` (qui sait pourtant prendre un `envDefault`) n'est appelée par aucune route.

### 5. Propagation des métadonnées média

`MediaStudio.generateVisual()` adapte la réponse v1 du service (`StudioMediaItem`) vers la forme du picker v2 (`StudioV2MediaItem`), puis remonte via `onUploaded`/`onSelect` (`MediaStudio.tsx:118-138`). Ces métadonnées (kind, durationSec, width/height, ratio calculé) sont rendues deux fois : le bandeau `[data-cs-section="media-metadata"]` (`MediaStudio.tsx:246-293`) et le récapitulatif `ConfirmPreview` des dialogues de publication (`PublishActionGroup.tsx:339-481`). La chaîne `selectedMedia → preview → ConfirmPreview` est cohérente et complète côté image.

### 6. Gestion d'erreurs typées côté client

Le mapping d'erreurs serveur passe par `formatError` (`lib/content-studio-v2/errors/messages.ts`). Les composants attrapent l'enveloppe structurée `{ code, message }` et la passent à `formatError` (`PublishActionGroup.tsx:90-108`). Le pattern est correct **là où il est appliqué** — mais il est appliqué de façon inégale (cf. problèmes ci-dessous).

### 7. Preuves de réalité (parcours opérateur)

- **Playwright opérateur : 37 passed / 2 failed** (`evidence/playwright-operator-journeys.txt`). Les 2 échecs sont des défauts de **test frontend** (sélecteur de libellé obsolète, nom de table de seed) — pas de l'app.
- **Vitest : 1695 passed / 0 failed mais process EXIT 1** (`evidence/vitest-summary.json`) — décalage canonique test↔réalité (BUG-010, hors périmètre strict frontend mais structurant).
- **Parité MOCK/LIVE** (`mock-live-parity.csv`) : pour le flux create, le **MOCK réussit, le LIVE échoue systématiquement** (génération) ou n'a aucun effet (texte). La parité live n'est pas démontrable au gel (clé create vide, credential Higgsfield incomplet).

---

## Problèmes concrets

> Chaque problème référence le(s) finding(s) confirmé(s) (`BUG-xxx`) et, le cas échéant, les angles morts relevés par le réfuteur (`MISS-xxx`).

### P1 — Le `ModelPicker` propose des modèles « Live » qui échouent tous à la génération, et en pré-sélectionne un d'office  *(BUG-006, BUG-007, BUG-024, BUG-028 ; MISS-002, MISS-015)*

Le picker liste 14–18 modèles image badgés `source:'live'` (badge vert « Live »), dont **aucun n'est générable** par le flux create : les OpenAI throwent (`CONTENT_STUDIO_OPENAI_API_KEY` vide), les Higgsfield throwent (credential incomplet), et `materialiseDiscoveredModel` force `source:'live'` même quand la discovery a renvoyé `'fallback'`.

Aggravation frontend pure (MISS-002, vérifié `ModelPicker.tsx:103-118`) : un `useEffect` **fetch eager** au changement de role/format, puis un second `useEffect` **auto-sélectionne le `suggested`** dès que `value === null`. Conséquence : sans aucune action opérateur, `body.model = gpt-image-1-mini` est armé dans `MediaStudio`. Couplé au toggle Live, **le tout premier clic « Générer un visuel IA » part avec un modèle live non fonctionnel → HTTP 409 immédiat**. Le picker monte aussi `allowCustom=true` par défaut (MISS-015) : un id arbitraire saisi librement atteint l'API sans validation de registre.

L'écart est un **désync UI/réalité total** : l'UI promet une capacité (« Live ») que le moteur ne peut jamais honorer, et engage cette capacité par défaut.

### P2 — Le toggle Mock/Live est un contrôle fantôme pour la génération de texte  *(BUG-020 ; MISS-001)*

Le `GenerationModeToggle` pose le cookie `cs_generation_mode`, mais la route texte `ideas/[id]/generate/route.ts` **ne le lit jamais**. `generation.ts` retombe inconditionnellement sur `fallbackGeneration` (clés vides) sans lever d'erreur. **Basculer Mock↔Live dans l'UI ne change strictement rien au texte** : l'opérateur en « Live » croit obtenir du texte IA, il reçoit un template déterministe (`provider:'fallback'`, `model:'deterministic-template'`). Le badge « Généré par … » de `CreateWorkspace.tsx:235-250` affiche alors un modèle qui n'a jamais tourné. Parité confirmée (`mock-live-parity.csv`, ligne create-ui-flow texte) : MOCK = LIVE = template.

### P3 — Triple source de vérité désynchronisée sur l'état « mode »  *(BUG-021 ; MISS-016, MISS-034)*

Trois sources concurrentes pilotent l'affichage et le comportement de mode :
1. **le toggle** → cookie `cs_generation_mode`, défaut codé en dur `'mock'` car `MediaStudio.tsx:179` rend `<GenerationModeToggle />` **sans `envDefault`** ;
2. **le badge global** `MockModeBadge` → `StudioContext.mockMode` ← `health.mockMode` (env, `false` en staging) ;
3. **le défaut serveur** de `generate-visual/route.ts:28-29` → `'mock'` codé en dur, ignorant `CONTENT_STUDIO_V2_MOCK_MODE` (MISS-016).

Résultat constaté : le toggle dit MOCK, le `MockModeBadge` ne s'affiche pas (health=false), les générations partent en mock. Incohérence cosmétique aujourd'hui (le réfuteur a ramené BUG-021 à un défaut d'affichage, pas de comportement), mais c'est une **fragilité structurelle** : il existe une fenêtre (avant montage de `MediaStudio` / cookie purgé) où la route part en mock indépendamment de l'intention env. À noter aussi (MISS-034) : le cookie est posé `path=/` (toute l'app) malgré le commentaire « scoped to the admin path ».

### P4 — Échecs silencieux côté client : aucune remontée d'erreur typée sur des chemins critiques  *(BUG-022 ; corrélé MISS-001)*

Dans `CreateWorkspace.onCreated` (lignes 195-228), si la génération de variantes échoue, **rien ne se passe** : pas de branche `else` sur `!res.ok`, et le `catch {}` est vide (commentaire « Generation failure is not blocking — user can retry »). L'opérateur se retrouve avec une idée créée, zéro variante, aucun feedback, aucun état de chargement/échec. C'est l'antithèse de la gestion d'erreur typée que le projet applique ailleurs via `formatError`. Le `POST /review` post-sélection a la même pathologie (`.catch(() => {})`, ligne 269).

### P5 — Le DTO de résultat de l'AI-Engine ampute audio/sous-titres/composition/exports avant l'UI  *(BUG-004 ; MISS-005)*

Côté pipeline A (UI `ai-engine`), `GenerationResultData` (`GenerationResult.tsx:6-19`, vérifié) ne déclare que `script / caption / images / videos`. **Aucun champ `voiceover / music / subtitles / composition / exports`.** Tout le travail audio/montage produit côté serveur est jeté avant d'atteindre l'UI. Même si le bridge A→B était corrigé, ces champs seraient `undefined` (la cause racine remonte à `orchestrator.buildResult`, MISS-005). Côté opérateur (pipeline B), cette fonctionnalité est de toute façon **inatteignable** (bridge unidirectionnel). C'est le volet frontend d'un blocker transverse.

### P6 — `formatError` écrase le message serveur contextuel par un libellé générique  *(BUG-054)*

`errors/messages.ts:40-41` retourne le libellé mappé **avant** de considérer `e.message`. Pour `invalid_state` (ex. approbation sans média), le message serveur précis (« Un visuel doit être associé avant approbation… ») est remplacé par « État de draft invalide pour cette action. ». Le réfuteur a ramené l'impact à `minor` (le bouton Approve est `disabled` sans média, donc chemin atteignable seulement par contournement API), mais le **pattern de priorité du mapping** est généralisable et masque l'information utile dès qu'un futur chemin l'emprunte.

### P7 — Métadonnées média : preview mock = thumbnail AVIF basse-déf, pas d'original  *(BUG-053)*

La génération mock renvoie `originalUrl:null` et `previewUrl='/_media/.../avif/sm.avif'`. `MediaStudio.tsx:127-128` fait `previewUrl = thumbUrl ?? originalUrl` → le `PreviewPane` et le `ConfirmPreview` affichent une **vignette small AVIF** au lieu de la pleine résolution. Non bloquant en mock, mais l'aperçu de publication n'est pas représentatif. Risque latent côté vidéo (MISS-021) : `VideoPlayer` rend `<video src=''>` sans garde si un asset fallback remonte une url vide.

### P8 — Le picker de modèle texte expose 106 modèles non-chat  *(BUG-019 ; MISS-018)*

`IntentionForm` monte `ModelPicker role="chat"` (vérifié `IntentionForm.tsx:347-348`). La route renvoie 106 entrées dont `whisper-1` (STT), `omni-moderation`, `sora-2`, `gpt-realtime/audio`, `davinci/babbage`. L'opérateur peut sélectionner `whisper-1` comme modèle de génération de caption ; aucune validation côté client ni `contentIdeaCreateSchema`. Désync UI/capacité dans le même fichier de discovery.

### P9 — Deux parcours opérateur frontend sans couverture E2E verte  *(BUG-023, BUG-029, BUG-055)*

Les 2 échecs Playwright (37/2) sont des **bugs de test frontend**, pas de l'app :
- BUG-023 : le seed E2E publish-draft requête `audit_event` (singulier) alors que la table est `audit_events` (pluriel) → crash au seed. Le parcours « Brouillon Postiz » n'a donc **aucune validation E2E** alors que la prod fonctionne.
- BUG-029/BUG-055 : le spec cible `getByRole('button', {name:/Générer un visuel IA/i})` mais en mode vidéo le libellé réel est « Générer une vidéo IA » (`MediaStudio.tsx:240`, ternaire conditionnel au `kind`). Le test timeout → faux rouge sur un backend vidéo mock pourtant fonctionnel.

Ces deux cas illustrent la cause racine de l'audit : les tests ne reflètent pas le comportement réel de l'UI.

### P10 — Stubs de test qui neutralisent l'effet réel de l'UI  *(MISS-031 ; corrélé BUG-046)*

`vitest.setup.ts:63` mocke globalement `next/navigation` (`push/replace/refresh` = no-op, vérifié). Tout composant create-flow qui déclenche `router.refresh()/push()` après publication/génération voit son effet de routing **neutralisé** dans les tests : un test qui « valide » la redirection/refresh après publish passe sans rien prouver. MSW est présent (3 tests create) mais les handlers sont définis ad-hoc par test, sans harnais de parité mock/live (BUG-046).

---

## Causes racines

1. **Pas de source unique de vérité pour le « mode »** (RC commune à P1, P2, P3). Le mode de génération vit dans trois endroits non synchronisés (cookie posé par le toggle avec défaut codé en dur, `health.mockMode` côté contexte, défaut codé en dur côté route) et n'est lu que par une seule route serveur. Le toggle n'est jamais alimenté par l'état serveur (`envDefault` non transmis).

2. **Le picker reflète la *discovery*, pas la *capacité de génération*** (RC de P1, P8). Deux chaînes de résolution de clé divergent : la discovery utilise `resolveApiKey()` (qui trouve `OPENAI_API_KEY`), le générateur lit `env.CONTENT_STUDIO_OPENAI_API_KEY` (vide) — cf. MISS-003. L'UI badge « Live » et auto-sélectionne sur la base de la discovery, jamais sur celle de la routabilité réelle.

3. **Gestion d'erreur typée appliquée de façon inégale** (RC de P4, P6). Le projet possède l'outillage (`formatError`, enveloppe `{code,message}`) mais l'applique correctement dans `PublishActionGroup` et l'oublie dans `CreateWorkspace.onCreated` (catch vide) et dans le mapping de priorité (`messages.ts` écrase le message serveur). Pas de convention « tout `!res.ok` doit produire un état d'erreur visible ».

4. **Découplage UI ↔ contrat backend non gouverné** (RC de P5, P7). Le DTO de sortie (AI-Engine `GenerationResultData`, et réponse média mock) est figé sans les champs nécessaires (audio/composition/exports ; original pleine résolution), et l'UI s'adapte par fallbacks (`?? ''`, `?? originalUrl`) qui masquent l'absence plutôt que de la signaler.

5. **Tests qui ne reflètent pas l'UI réelle** (RC de P9, P10). Sélecteurs sur libellés dynamiques figés, seed sur un nom de table inexistant, stub global de `next/navigation`, absence de harnais de parité mock/live : la suite « tout-verte » ne prouve pas le point de vue opérateur.

---

## Criticité (justifiée)

**Criticité de l'axe : `critical`.**

Justification (échelle `01_methodology.md` §6) :
- L'axe **n'héberge pas le seul blocker pur** (les blockers de génération/publication sont des défauts backend/infra : BUG-001/002/003) — mais il **en est la façade et l'amplificateur** : BUG-001 ne devient un échec « au premier clic » qu'à cause de l'auto-sélection eager du picker (MISS-002), et BUG-003 se manifeste comme un accusé de réception inerte (« Publication programmée », `PublishActionGroup.tsx:102`) qui **ment à l'opérateur**.
- L'axe contient en propre des **échecs silencieux** au sens `critical` : P2 (toggle fantôme — l'opérateur croit générer en IA, reçoit un template) et P4 (échec de variantes sans aucun feedback). Ce sont précisément les « échecs silencieux / désync UI/état réel » que l'audit cible.
- Répartition des findings frontend par sévérité : **1 blocker (volet UI de BUG-004), 3 critical (BUG-006, BUG-007, BUG-014\*), 8 major, 3 minor** (\* BUG-014 mismatch d'enum `tone` côté UI ai-engine). Parité : sur 15 findings, le LIVE est `broken` ou `untested` dans 10 cas.

L'axe n'est pas `blocker` car le flux **MOCK** est intégralement opérable côté UI (37 parcours verts), et les vrais blockers sont traçables à des couches en dessous. Il dépasse `major` car il porte des échecs silencieux de classe `critical` et constitue la surface où l'opérateur subit, sans signal fiable, l'ensemble des blockers backend.

---

## Recommandations (actionnables, priorisées)

### Priorité 0 — Cesser de mentir à l'opérateur (sécurité du parcours)

1. **Unifier la source de vérité du mode de génération** (P2, P3). Transmettre `envDefault={mockMode ? 'mock' : 'live'}` depuis `health` à `<GenerationModeToggle />` (`MediaStudio.tsx:179`). Faire lire le cookie par `ideas/[id]/generate` et propager `mode` à `generateForIdea` ; en mode live sans clé, **throw `invalid_state` explicite** au lieu de dégrader en silence. Faire lire `CONTENT_STUDIO_V2_MOCK_MODE` comme défaut serveur dans `generate-visual/route.ts` (au lieu du `'mock'` codé en dur). Cibler : *le toggle, le badge et la route partagent le même état, vérifié en mock ET live.*  → **BUG-020, BUG-021, MISS-001, MISS-016.**

2. **Aligner le picker sur la capacité réelle de génération** (P1, P8). Propager `r.source` réel dans `materialiseDiscoveredModel` (ne badger « Live » que si `discovery.source==='live'`). Filtrer/désactiver les modèles dont le provider n'a pas de credential generation-ready. **Désactiver l'auto-sélection eager** du `suggested` tant que le modèle n'est pas routable (ou n'auto-sélectionner qu'un modèle mock par défaut). Liste blanche d'ids chat (exclure whisper/tts/sora/davinci…). Passer `allowCustom={false}` dans `IntentionForm`/`MediaStudio` ou valider l'id côté serveur. → **BUG-006, BUG-007, BUG-019, BUG-024, BUG-028, MISS-002, MISS-015, MISS-018.**

3. **Désactiver/masquer le mode Live tant que la génération n'est pas configurable** (P1, et cohérence avec BUG-001/002). Tant que `CONTENT_STUDIO_OPENAI_API_KEY` / credential Higgsfield ne sont pas valides, masquer le bouton « Live » du toggle (ou afficher un état « indisponible »), pour ne pas armer un 409 garanti. Débloquer OpenAI à bon marché en faisant lire au flux create la même chaîne que `resolveApiKey` (`OPENAI_API_KEY` en fallback) — correctif transverse (MISS-003).

### Priorité 1 — Rendre les erreurs visibles et typées

4. **Ajouter une branche d'erreur partout où `!res.ok`** (P4, P6). Dans `CreateWorkspace.onCreated` : `toast.error(formatError(json.error))` sur `!res.ok` et dans le `catch` ; afficher un état « échec de génération — réessayer » avec bouton retry. Idem pour le `POST /review` silencieux. Corriger l'ordre de priorité de `formatError` : pour `invalid_state`, préférer `e.message` serveur au libellé générique (ou faire renvoyer par le serveur un code spécifique `no_media_attached`). → **BUG-022, BUG-054.**

### Priorité 2 — Fiabiliser le contrat UI ↔ backend

5. **Étendre le DTO de résultat et le rendu** (P5, P7). Étendre `GenerationResultData` + `buildResult`/`normalizeResultData` pour inclure `voiceover/music/subtitles/composition/exports/thumbnails`, et ajouter le rendu (lecteur audio, lien SRT, vidéo composée). Exposer une dérivée preview md/lg (ou l'original) dans la réponse média et faire choisir à `MediaStudio` la plus grande dérivée disponible. Ajouter une garde dans `VideoPlayer` contre `src` vide. → **BUG-004, BUG-053, MISS-005, MISS-021.**

6. **Corriger l'enum `tone`** (BUG-014, UI ai-engine) : restreindre les options de `page.tsx:85-93` aux valeurs supportées par `parse-brief` (ou mapper `empowering→inspiring`, etc. dans `normalizeRequest`), et valider le ton dès la route avec un message clair.

### Priorité 3 — Faire dire la vérité aux tests

7. **Réparer les 2 parcours opérateur** (P9). Remplacer le sélecteur par `/Générer (un visuel|une vidéo) IA/i` ou cibler `[data-cs-generate-button]` ; corriger le seed E2E pour `audit_events` (pluriel) ; ajouter une couverture E2E réelle du bouton « Brouillon Postiz » (dry_run). → **BUG-023, BUG-029, BUG-055.**

8. **Introduire un harnais de parité mock/live** (P10). Centraliser les handlers MSW pour qu'ils reflètent les contrats live réels (statuts, codes d'erreur), ne plus laisser `next/navigation` no-op masquer les effets de routing post-action, et faire échouer la CI sur le **code de sortie** vitest (pas la ligne de résumé). → **BUG-046, MISS-031, BUG-010.**

### Points à vérifier (sous tous les angles, avant de clore)

- **Hydratation :** vérifier l'absence de mismatch SSR sur le toggle (`hydrated` géré) et que `window.__STUDIO_CTX__` n'est exposé qu'en non-prod.
- **Course :** vérifier la fenêtre entre montage de `MediaStudio` (pose du cookie) et le premier clic ; vérifier le bouton « Régénérer » qui réutilise le `model` d'état après bascule Live sans réouverture du picker (MISS-017).
- **Portée cookie :** restreindre `path=/` à `/admin` (MISS-034).
- **État optimiste :** confirmer que `draft.status='approved'` forcé localement (`CreateWorkspace.tsx:317`) est toujours réconcilié avec le serveur au reload, et qu'aucun divergence ne subsiste si l'approbation serveur échoue partiellement.
- **Vérification finale (DoD) :** chaque correctif doit être prouvé par un parcours opérateur **en mock ET en live** une fois la génération live configurable — jamais « fait » sur la foi d'un test vert.
