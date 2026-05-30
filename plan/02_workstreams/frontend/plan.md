# Workstream Frontend — Plan d'action (conception)

> FemiGlow Content Studio v2 / AI Engine · pipeline génération + publication
> Cible d'architecture : **ADR-0007 Option 1 — converger vers A (LangGraph moteur unique) ; le create-flow devient une UI au-dessus de A**.
> Statut : **plan de conception** — aucune modification de code applicatif. Sortie = documents seulement.
> Baseline : `docs/audit-generation-publication-2026-05-29/`. Routage : `plan/01_coverage/_routing.json`.

---

## 1. Périmètre du workstream

Le frontend détient la **couche opérateur** du parcours `/admin/content-studio-v2/create` et l'état client qui la pilote. Cinq sujets, tous au cœur de la mécanique « ce que l'UI promet vs ce que le moteur produit » :

1. **`StudioContext` et l'état optimiste vs serveur** — réconcilier l'état affiché avec l'état serveur réel, surtout quand le moteur A devient asynchrone (jobId/polling).
2. **Cookie `cs_generation_mode`** — sa propagation à la génération de **variantes/texte** (aujourd'hui ignorée : le toggle ne pilote que le visuel).
3. **Propagation des métadonnées média** (durée/dimensions) — du `GenerationResult` enrichi jusqu'à `MediaStudio` et aux dialogues de publication.
4. **Branchement réel du create-flow sur le moteur A** — `MediaStudio` devient une UI au-dessus de `invokeEngine`, exposant voix-off/montage à l'opérateur, derrière flag réversible.
5. **Remontée des erreurs typées `HttpError`** en messages UI lisibles, sans perdre le `code` ni écraser le message serveur.

> Le frontend **ne réécrit pas** le moteur ni la façade (workstream architecture/backend). Il conçoit **comment l'UI consomme** le contrat cible : points de couture, contrats d'appel, états de chargement async, et la **vérité affichée** (badges, toasts, méta).

---

## 2. État actuel (vérifié dans le code, 2026-05-29)

| Composant / route | Comportement réel observé | Conséquence |
|---|---|---|
| `app/api/admin/content-studio/ideas/[id]/generate/route.ts` (l.20-27) | Ne lit **jamais** `cookies().get('cs_generation_mode')` ; passe seulement `{ model }` à `generateIdeaDrafts`. | Le toggle Mock/Live **n'a aucun effet sur le texte** (BUG-020). |
| `lib/content-studio/generation.ts:70` | `apiKey = CONTENT_STUDIO_OPENAI_API_KEY ?? CHAT_OPENAI_API_KEY` (les deux vides) → `fallbackGeneration()` **sans erreur**. | En « live », l'opérateur reçoit un **template déterministe** en croyant avoir de l'IA. |
| `CreateWorkspace.tsx` (l.188-247) | `onCreated` POSTe `{ model }` ; au succès, si `runs` absent **assume `provider:'openai'`** (l.221-223) ; badge `Généré par {model} · {provider}`. | Le badge **ment** quand le serveur a dégradé en `fallback`. |
| `MediaStudio.tsx` (l.80-148) | `generateVisual` appelle `POST drafts/[id]/generate-visual` → `generateVisualForDraft` (**système B**). | `composeNode`/`transcodeExportNode` (système A) **jamais invoqués** → montage inatteignable (BUG-033). |
| `lib/content-studio/*` + composants create | **Aucun** import de `ai-engine`, `runGeneration`, `voiceover/music/subtitle`. | Voix-off/musique/sous-titres **réservés à `/ai-engine/create`**, hors parcours opérateur (BUG-048). |
| `PublishActionGroup.tsx` `executePublish` (l.74-112) | Envoie `JSON.stringify({})` — **aucun `accountId`**. | `resolveDefaultAccount` retombe sur « premier compte Postiz actif » → **mauvais compte client** possible en live (BUG-039). |
| `ImageCropper.tsx` (l.42-59) + `upload-image.ts` (l.41-46) | `croppedAreaPixels` (espace **affiché/tourné** de react-easy-crop) passé tel quel à `sharp.rotate(rotation).extract({x,y,w,h})` (espace **canevas tourné agrandi**). | Recadrage **décalé/hors-cadre** pour rotation arbitraire ; 0 test sur rotation ≠ 0 (BUG-061). |
| `errors/messages.ts` `ERROR_MESSAGES` | Mappe ~14 codes mais **ignore** `upstream_failed`, `conflict`, `rate_limited`, `schedule_in_past`, `validation_failed`, `internal_error` (présents dans `http-error.ts`). `MediaStudio` jette `new Error(message)` en **perdant le `code`**. | Toasts génériques ou `HTTP 5xx` brut ; le `code` typé ne remonte pas. |
| `StudioContext.tsx` | État optimiste (`upsertDraft`, `setMediaItems`) ; `mockMode` lu via `/health` (miroir env), **divergent** du cookie réellement envoyé. | Après bascule vers A (async), pas de réconciliation jobId → risque d'afficher un stub comme final ; badge mock incohérent. |

---

## 3. État cible (aligné convergence vers A)

- **Le mode de génération est une source de vérité client unique** (`getClientGenerationMode`) attachée à **toutes** les requêtes de génération (texte ET visuel), et **observable** : le badge reflète le `provider` **reçu**, jamais deviné ; un `fallback` en live est signalé.
- **`MediaStudio` est une UI au-dessus de `invokeEngine`** (ADR-0008) : derrière le flag de bascule par capacité (ADR-0011), `generateVisual` route vers le moteur A ; voix-off/montage/sous-titres/export deviennent **atteignables** par l'opérateur. Le flag `off` garde le chemin B intact (**rollback trivial**).
- **Le contrat `GenerationResult` enrichi** (ADR-0010 / T-104) — `composition.exports[].{durationSec,width,height,thumbnailUrl}` — est projeté par un **adaptateur unique** (`mapEngineAssetToMediaItem`) vers `StudioV2MediaItem`, consommé par `MediaStudio` et le `ConfirmPreview` de publication. Fini les `json.media.*` ad hoc et les `undefined`.
- **La publication impose un compte cible explicite** en live : sélecteur obligatoire, `accountId` dans le body, compte affiché dans le `ConfirmPreview`. Plus jamais « premier compte actif » deviné.
- **Le recadrage avec rotation est exact** : géométrie de crop calculée dans le **même référentiel** que `sharp` (util partagé `cropGeometry`), couvert par des tests rotation 90/180/270/libre.
- **Les erreurs typées remontent fidèlement** : `ERROR_MESSAGES` complet, parsing `HttpError` standardisé (`parseHttpError`) préservant `{ code, message, details }`, `formatError` qui **n'écrase jamais** un message serveur utile.
- **`StudioContext` réconcilie l'optimiste et le serveur** : statut de job par draft (`pending|partial|completed|degraded`), aucun stub affiché comme final, pas de double-comptage à la re-matérialisation A→B (idempotence d'affichage).

---

## 4. Approche & séquencement (subordonné au macro-séquencement P0..P5)

Le frontend **n'introduit aucune régression du seul parcours qui marche** (mock B, prouvé par les E2E golden-path / media-kind-toggle). Chaque pas est gardé par le smoke opérateur (T-010) en **MOCK ET LIVE** et réversible par flag (ADR-0011).

- **P2 — Honnêteté du mode & du provider** (dépend du moteur livré côté backend pour le live, mais l'UI peut être conçue tôt) :
  - `ACT-FE-002` (helper de mode client unique) → `ACT-FE-001` (propagation + badge honnête, fin de la dégradation silencieuse affichée). Réutilise **T-201/T-413**.
- **P3 — Honnêteté de la publication & des erreurs** :
  - `ACT-FE-006` (compte Postiz explicite — garde-fou anti mauvais-compte, complément UI de **T-303** ; aligné sur le garde-fou anti-incident du macro-plan).
  - `ACT-FE-008` (erreurs typées lisibles — **T-414**), dépend de `ACT-FE-002` pour le helper de parsing partagé.
- **P4 — Convergence des capacités vers A** (après T-104 contrat + façade) :
  - `ACT-FE-004` (brancher MediaStudio sur `invokeEngine`, image/vidéo, flag) → `ACT-FE-005` (voix-off/montage atteignables) ; `ACT-FE-003` (métadonnées média via contrat enrichi) et `ACT-FE-009` (réconciliation état async) consomment le contrat A. Réutilisent **T-104/T-901**.
- **P5 — Dette/robustesse** :
  - `ACT-FE-007` (recadrage rotation correct + couverture) — **T-902**.

**Chemin critique frontend :** `ACT-FE-002 → ACT-FE-001 [P2]` (honnêteté mode/provider) en parallèle de `ACT-FE-006 / ACT-FE-008 [P3]` ; puis, après livraison du contrat moteur (T-104) et de la façade (ADR-0008), `ACT-FE-004 → ACT-FE-005` avec `ACT-FE-003 / ACT-FE-009 [P4]` ; `ACT-FE-007 [P5]`.

---

## 5. Changements requis (le quoi + le pourquoi)

1. **Helper de mode client (`ACT-FE-002`)** — *pourquoi* : le mode vit aujourd'hui à 3 endroits divergents (cookie, `StudioContext.mockMode`, rien sur le texte) ; sans source unique, la propagation BUG-020 ne sera jamais cohérente, et le badge mock ment dès que l'opérateur bascule.
2. **Propagation + badge honnête (`ACT-FE-001`)** — *pourquoi* : la racine de BUG-020 côté front est double — la route texte ignore le cookie **et** `CreateWorkspace` invente `provider:'openai'`. Corriger l'un sans l'autre laisse l'UI mentir. La DoD exige que `provider` affiché soit **reçu** du serveur.
3. **Adaptateur média unique (`ACT-FE-003`)** — *pourquoi* : `MediaStudio` et `ConfirmPreview` lisent `durationMs/width/height` de façon ad hoc ; après convergence, ces champs viennent de `GenerationResult.composition.exports[]` (T-104). Un adaptateur unique évite la divergence et le `undefined` silencieux.
4. **Branchement create→A (`ACT-FE-004`/`ACT-FE-005`)** — *pourquoi* : c'est la convergence elle-même côté UI. `MediaStudio.generateVisual` est le point de couture ; il doit consommer `invokeEngine` derrière flag, gérer l'async (jobId/poll) et rendre les capacités riches. **Concevoir le contrat d'appel UI**, pas implémenter la façade.
5. **Compte Postiz explicite (`ACT-FE-006`)** — *pourquoi* : le seul risque **irréversible** du projet est publier sur le mauvais compte IG client ; l'UI envoie `{}` aujourd'hui. Le frontend doit **forcer** la désambiguïsation en live (bouton désactivé sans `accountId`).
6. **Géométrie de crop (`ACT-FE-007`)** — *pourquoi* : désalignement référentiel react-easy-crop ↔ sharp ; recadrage faux dès rotation non triviale, 0 couverture. Util partagé + tests rotation.
7. **Erreurs typées (`ACT-FE-008`)** — *pourquoi* : `formatError` ne peut mapper que ce que l'appelant lui transmet ; `MediaStudio` perd le `code`. Standardiser `parseHttpError` + compléter `ERROR_MESSAGES`.
8. **Réconciliation état (`ACT-FE-009`)** — *pourquoi* : A est async ; sans statut de job et idempotence d'affichage, l'optimiste de `StudioContext` montrera des stubs ou doublonnera les médias à la re-matérialisation A→B.

---

## 6. Dépendances inter-workstreams

| Dépend de | Pour | Tâches amont |
|---|---|---|
| **architecture** | Façade `invokeEngine` (contrat d'appel B→A), pont bidirectionnel idempotent, contrat `GenerationResult` enrichi, flag de bascule par capacité, file de jobs async. | ADR-0008, ADR-0010, ADR-0011, ADR-0009 ; `ACT-ARC-*` ; T-104, T-901 |
| **backend** | Lecture du cookie côté route texte + `throw invalid_state` en live sans clé (la moitié serveur de BUG-020) ; `generateVisualForDraft`/service qui délègue à A derrière flag ; `resolveDefaultAccount` qui exige `accountId` en live ; correction `upload-image.ts` (géométrie sharp côté serveur) ; codes `HttpError` émis fidèlement. | T-201, T-303, T-902, T-414 |
| **ui-ux** | Picker honnête (badges Live ⇔ générabilité réelle) — cohérent avec le mode envoyé et le provider reçu ; design du sélecteur de compte et des contrôles audio/montage. | T-202 |
| **data** | Route(s) de comptes éligibles pour le sélecteur de publication ; persistance `provider/model` du run pour le badge. | — |

> **Découplage explicite** : les tâches P2/P3 frontend (`ACT-FE-001/002/006/008`) peuvent être **conçues et testées en mock** sans attendre la façade. Les tâches P4 (`ACT-FE-003/004/005/009`) **bloquent** sur T-104 (contrat) et la façade (ADR-0008). La DoD live de chacune est **découplée** : prouvable dès que la dépendance amont live est disponible.

---

## 7. Tableau de couverture audit (preuve : 5/5 ids traités)

| ID assigné | Sévérité | Domaine | Action(s) frontend | t_ref réutilisé |
|---|---|---|---|---|
| **BUG-020** | major | create-ui-flow — cookie mode ignoré, dégradation silencieuse texte | `ACT-FE-001` (propagation + badge honnête), `ACT-FE-002` (helper mode unique), `ACT-FE-008` (erreur typée si live sans clé) | T-201, T-413, T-414 |
| **BUG-033** | major | montage-composition — compose/transcode inatteignables par l'opérateur | `ACT-FE-004` (branchement create→A image/vidéo), `ACT-FE-003` (métadonnées média via contrat), `ACT-FE-009` (réconciliation async), `ACT-FE-008` (erreurs) | T-104, T-901, T-414 |
| **BUG-039** | major | publication-postiz — choix implicite du premier compte actif | `ACT-FE-006` (sélection compte explicite/obligatoire en live), `ACT-FE-008` (erreurs) | T-303, T-414 |
| **BUG-048** | major | voix-off — parcours opérateur sans lien avec voix-off/musique/sous-titres | `ACT-FE-005` (exposer voix-off/montage via A), `ACT-FE-004` (couture create→A), `ACT-FE-009` (réconciliation) | T-901, T-104 |
| **BUG-061** | minor | montage-composition — recadrage rotation rotate→extract non vérifié | `ACT-FE-007` (géométrie crop alignée + tests rotation) | T-902 |

**Couverture : 5/5.** Chaque id apparaît dans le champ `audit_lie` d'au moins une action de `tasks.csv` (vérifié mécaniquement).

---

## 8. Principe de preuve (mock ET live)

Conformément à `guiding-principles.md` : « fait » est interdit ; chaque DoD exige « prouvé en exerçant X en mock ET live ». Pour le frontend, cela se traduit en :

- **MOCK** : test unitaire/composant (vitest) + E2E (Playwright) assertant un **effet observable** (requête réseau portant le bon `mode`/`accountId`, badge reflétant le `provider` reçu, état `StudioContext` réconcilié) — **pas seulement un rendu**.
- **LIVE** : parcours opérateur réel sur `/create` avec credentials, assertant un **effet backend réel** (asset servi 200, `generation_run`/`social_publish_job` créé, `ffprobe` validant la durée affichée, compte cible exact). La parité UI↔fichier/état serveur est l'instrument de vérité.

Voir `tasks.csv` colonne `dod_mesurable` pour le détail par action.

---

## 9. ADR proposés

Le focus frontend ne crée pas de décision d'architecture structurante nouvelle : il **consomme** les ADR architecture (0008 façade, 0009 jobs, 0010 contrat, 0011 flag). Une seule décision propre au frontend mérite un ADR car elle fixe un contrat d'affichage transverse et durable :

- `adr/adr-0012-contrat-affichage-honnete-mode-provider-erreurs.md` — règle invariante : **l'UI n'affiche jamais une provenance, un mode ou un statut qu'elle n'a pas reçu du serveur** (pas de `provider:'openai'` deviné, pas de stub affiché comme final, pas de message générique écrasant un message serveur utile). Fonde `ACT-FE-001/002/003/008/009`.
