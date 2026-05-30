# Workstream UI/UX — Plan d'action

> FemiGlow Content Studio v2 / AI Engine · pipeline génération + publication
> Préfixe d'action : **ACT-UX-###**
> Baseline figée : `docs/audit-generation-publication-2026-05-29/`
> Cible d'architecture : **ADR-0007 Option 1 — converger vers A (LangGraph moteur unique) ; le create-flow (B) devient une UI au-dessus de A**.
> Statut : **plan de conception** (aucune modification de code applicatif).

---

## 1. Objectifs du workstream

**Honnêteté de l'UI opérateur.** L'audit prouve que l'interface de `/create` (et du picker partagé) **promet des capacités que le moteur ne produit pas** : 14-18 modèles badgés « Live » dont **aucun** n'est générable, un toggle mock/live dont l'affichage contredit le comportement réel et qui n'a **aucun effet** sur le texte, un message d'échec qui écrase le message serveur utile, et un aperçu qui se rabat sur une vignette basse-déf. Le rôle de ce workstream est de **faire dire à l'UI la vérité du moteur**, capacité par capacité, en parité mock **et** live, et de **supprimer les fausses affordances** (features A non atteignables avant convergence).

Concrètement :

1. **Picker honnête** — un badge « Live » ⟺ un modèle réellement générable par le même chemin de credential que le générateur (alignement `resolveProviderCredential`). Suppression des badges mensongers, de la pré-sélection d'un modèle non-fonctionnel, du custom non validé, de la desync catalogue↔exécution image/vidéo.
2. **Cohérence du mode mock/live** — une source de vérité unique : toggle = badge = défaut de route = effet réel ; fin du contrôle fantôme texte.
3. **États opérateur explicites** — chargement / erreur / succès lisibles ; messages d'échec **actionnables** (ne pas écraser le message serveur précis) ; distinction nette **image / vidéo** ; aperçu fidèle (pas de rabattement silencieux sur une vignette).

> Frontière avec les autres workstreams : ce workstream **ne répare pas les providers** (image/vidéo/texte live = backend, ACT-BE) ni le **pont A→B** (architecture, ACT-ARC). Il rend l'UI **fidèle à l'état réel** que ces workstreams produisent, et **dépend** de leur livraison pour passer du « affiché honnêtement comme indisponible » à « affiché honnêtement comme Live ».

---

## 2. État cible (aligné convergence vers A)

Dans la cible (A = moteur unique, B = UI au-dessus de A), l'opérateur accède réellement aux capacités riches (voix-off, montage, export). L'UI doit donc :

- **Ne badger `Live` que ce que A peut produire** via la même résolution de credential que le moteur. Pendant la bascule incrémentale (par flag), une capacité non encore déléguée à A s'affiche comme **indisponible/à venir** — jamais comme une affordance cliquable qui throw.
- **Refléter l'asynchronicité** des providers (Higgsfield submit+poll, T-103) : états « en cours » explicites, pas un faux « Live » synchrone.
- **Distinguer image et vidéo** dans le catalogue et le routage : un modèle vidéo non routable n'est pas proposé en live tant que l'intégration async n'existe pas (BUG-009).
- **Exposer la composition/exports** quand le pont A→B (T-104) les remontera — sans les **promettre avant** : tant que MISS-005/BUG-004 ne sont pas levés, l'UI ne montre pas de bouton « monter/voix-off » menant à `undefined`.

L'UI honnête est ce qui rend la convergence **vérifiable** : à chaque flag activé, le badge/état UI doit basculer en cohérence avec le moteur, prouvé en mock ET live.

---

## 3. Approche & séquençage

Ce workstream suit l'ordonnancement macro (P0 vérité+parité → P2 honnêteté → P4/P5 dette/cohérence). Aucune action UI n'est un blocker au sens moteur, mais **deux criticals d'honnêteté (BUG-006/007)** sont en P2 et **dépendent** de T-005/T-101/T-201. Les autres sont des majors/minors/info d'hygiène, planifiés en P3-P5.

**Vague A — Honnêteté du picker (P2, dépend de T-005/T-101/T-103/T-201)**
- ACT-UX-001 : badge `source` propagé (fin du `Live` forcé), liste blanche de générabilité par rôle. → BUG-006, BUG-007.
- ACT-UX-002 : desync catalogue↔exécution vidéo (route par provider + mapping / filtrage). → BUG-009.
- ACT-UX-003 : pré-sélection conditionnelle + `allowCustom=false` par défaut + validation. → MISS-002, MISS-015.
- ACT-UX-004 : persistance/honneur du `model` choisi (trace fidèle). → MISS-012.

**Vague B — Cohérence du mode mock/live (P3, dépend de T-005/T-201/health)**
- ACT-UX-005 : source unique toggle/badge/route (`envDefault` depuis `health.mockMode`, défaut route lit l'env). → BUG-021, MISS-016.
- ACT-UX-006 : route texte honore le cookie (fin du contrôle fantôme) + scope cookie cohérent. → MISS-001, MISS-034.

**Vague C — États & messages opérateur (P3-P4)**
- ACT-UX-007 : `formatError` privilégie le message serveur utile sur le libellé générique. → BUG-054.
- ACT-UX-008 : aperçu fidèle pleine/grande résolution (pas de rabattement vignette). → BUG-053.

> **Principe transverse (ADR-0002)** : chaque DoD ci-dessous est **prouvée en MOCK ET en LIVE** par un chemin opérateur concret (probe `GET /models`, parcours `/create`, toast observé) — jamais « fait », toujours « prouvé en exerçant X ».

### Garde-fou de séquencement

ACT-UX-001/002/003/004 (badge « Live ») ne peuvent être **validées « Live »** qu'**après** T-005 (credential unique) + T-101 (image live) / T-103 (vidéo async) / T-201 (texte LLM). **Avant** ces tâches, leur DoD se vérifie à l'état honnête attendu : le picker affiche `Statique`/`Cache` et **aucun** modèle ne ment. C'est une dépendance, pas un blocage : l'UI honnête est livrable indépendamment et **doit** précéder l'activation live pour que la parité soit vérifiable.

---

## 4. Dépendances inter-workstreams

| Dépendance | Fournie par | Consommée par (ACT-UX) | Nature |
|---|---|---|---|
| `resolveProviderCredential()` unique (T-005) | architecture (ACT-ARC-RESOLVE-CRED) | 001, 003, 004, 005 | La règle « Live ⟺ même clé que le générateur » exige une résolution unique. |
| Image live OpenAI (T-101) | backend (ACT-BE) | 001 | Permet de **prouver Live** sur les modèles OpenAI image. |
| Vidéo Higgsfield async submit+poll (T-103) | backend (ACT-BE) | 002 | Détermine quels modèles vidéo sont routables → catalogue honnête. |
| Texte réellement LLM + lecture cookie route texte (T-201) | backend (ACT-BE) | 004, 005, 006 | Fin du fallback figé ; le mode et le `model` deviennent effectifs et traçables. |
| `health.mockMode` exposé (route health) | backend | 005 | Source d'intention serveur pour `envDefault` du toggle. |
| Pont A→B + `buildResult` (T-104 / MISS-005) | architecture (ACT-ARC) | (cible) | Conditionne l'exposition future de composition/voix-off/montage sans fausse affordance. |
| Smoke opérateur mock+live (T-010) | architecture / backend | 001-008 | Harnais de preuve E2E du parcours `/create`. |

**Fourni par ce workstream aux autres** : le contrat d'affichage du picker (ADR-0012) et la source unique de mode (ADR-0013) figent ce que l'UI attend du backend (champ `source` fidèle, route texte lisant le cookie, `model` persisté) — à intégrer dans les DoD backend correspondantes.

---

## 5. ADR proposés par ce workstream

- **ADR-0012 — Picker honnête** (`adr/adr-0012-picker-honnete-contrat-source-generabilite.md`) : le badge « Live » est lié à la générabilité réelle (même résolution de clé que le générateur), `source` propagé et non forcé, générabilité par capacité (image/vidéo), pré-sélection conditionnelle, custom borné, `model` tracé. Couvre BUG-006/007/009, MISS-002/012/015.
- **ADR-0013 — Source unique mock/live** (`adr/adr-0013-mode-mock-live-source-unique.md`) : une seule intention serveur (`CONTENT_STUDIO_V2_MOCK_MODE` via `health`), toggle/badge/route alignés, route texte honore le cookie, scope cookie cohérent. Couvre BUG-021, MISS-001/016/034.

Les findings BUG-053 (aperçu) et BUG-054 (message d'erreur) sont des correctifs ponctuels d'honnêteté UI **sans décision structurante** → pas d'ADR dédié (traités par ACT-UX-007/008, réutilisant T-414/T-413-adjacent).

---

## 6. Tableau de couverture audit (12 IDs → action(s))

| ID | Sév. | Domaine | Action(s) ACT-UX | T-ref réutilisée | ADR |
|---|---|---|---|---|---|
| BUG-006 | critical | create-ui-flow | ACT-UX-001 | T-202, T-005, T-101 | ADR-0012 |
| BUG-007 | critical | generation-image | ACT-UX-001 | T-202, T-005, T-101 | ADR-0012 |
| BUG-009 | critical | generation-video | ACT-UX-002 | T-202, T-103 | ADR-0012 |
| BUG-021 | major | create-ui-flow | ACT-UX-005 | T-413 | ADR-0013 |
| BUG-053 | minor | create-ui-flow | ACT-UX-008 | — | — |
| BUG-054 | minor | create-ui-flow | ACT-UX-007 | T-414 | — |
| MISS-001 | major | copywriting | ACT-UX-006 | T-413, T-201 | ADR-0013 |
| MISS-002 | major | create-ui-flow | ACT-UX-003 | T-202 | ADR-0012 |
| MISS-012 | minor | copywriting | ACT-UX-004 | T-201, T-202 | ADR-0012 |
| MISS-015 | minor | create-ui-flow | ACT-UX-003 | T-202 | ADR-0012 |
| MISS-016 | minor | create-ui-flow | ACT-UX-005 | T-413 | ADR-0013 |
| MISS-034 | info | create-ui-flow | ACT-UX-006 | T-413 | ADR-0013 |

**Vérification : les 12 IDs assignés sont chacun reliés à ≥1 action.** Aucun ID non couvert.

---

## 7. Détail des findings traités (le quoi + le pourquoi)

- **BUG-006 / BUG-007** (`ModelPicker.tsx`, `models/route.ts:62-88`, `image-generation.ts`) : sources de clé divergentes (discovery `resolveApiKey('openai')` vs générateur `CONTENT_STUDIO_OPENAI_API_KEY`) + `materialiseDiscoveredModel` force `source:'live'` même sur fallback. → ACT-UX-001 : propager `r.source`, ne badger `Live` que ce que le générateur peut lire, liste blanche par rôle.
- **BUG-009** (`models?role=video` ↔ `video-generation.ts:100-124`) : catalogue par IDs natifs Higgsfield, routeur attend `hf-*` → throw avec message faux. → ACT-UX-002 : router par `provider==='higgsfield'`+mapping ou filtrer à la générabilité réelle tant que T-103 n'est pas livré.
- **BUG-021** (`GenerationModeToggle`/`MediaStudio`/`StudioContext`) : toggle sans `envDefault` → cookie `mock` au montage ≠ `health.mockMode`. → ACT-UX-005 : `envDefault` depuis health, badge sur même source.
- **BUG-053** (`generate-visual` mock + `MediaStudio.tsx:127`) : `originalUrl:null`, aperçu retombe sur vignette `avif/sm`. → ACT-UX-008 : exposer/choisir la plus grande dérivée pour l'aperçu.
- **BUG-054** (`errors/messages.ts:39-41` + `service.ts` approve) : `formatError` mappe `invalid_state` → libellé générique et **ignore** le message serveur précis. → ACT-UX-007 : préférer `e.message` serveur pour `invalid_state`.
- **MISS-001** (`ideas/[id]/generate/route.ts`) : la route texte ne lit jamais `cs_generation_mode` → toggle fantôme pour le texte. → ACT-UX-006 (UI annonce le périmètre exact) + câblage route texte (avec T-201).
- **MISS-002** (`ModelPicker.tsx:103-118`) : auto-sélection du suggested `live` au montage → throw au 1er clic. → ACT-UX-003 : pré-sélection conditionnée à la générabilité.
- **MISS-012** (`ideas/route.ts:53` + `generation.ts:196`) : `model` strippé à la création, écrasé en `deterministic-template` → choix sans effet ni trace. → ACT-UX-004 : persister/honorer le `model`, trace fidèle.
- **MISS-015** (`ModelPicker` `allowCustom` défaut true) : id libre non validé atteint le générateur. → ACT-UX-003 : `allowCustom=false` par défaut + validation registre.
- **MISS-016** (`generate-visual/route.ts:27-29`) : défaut route `mock` en dur, ignore l'env. → ACT-UX-005 : route lit `CONTENT_STUDIO_V2_MOCK_MODE` via le helper.
- **MISS-034** (`GenerationModeToggle.tsx:20`) : cookie `path=/` vs commentaire « admin ». → ACT-UX-006 : aligner scope/commentaire.

---

## 8. Definition of Done globale du workstream

Le workstream est « prouvé » (pas « fait ») quand, sur la baseline et par chemin opérateur :

1. **MOCK** : à `/create`, le picker n'affiche `Live` sur **aucun** modèle non générable ; le toggle, le badge et le comportement concordent ; sélectionner un modèle et générer aboutit à un résultat cohérent ; un échec d'approbation sans média affiche le message serveur précis ; l'aperçu n'est pas une vignette rabattue.
2. **LIVE** (après T-005/T-101/T-103/T-201) : un modèle badgé `Live` **génère réellement** (ne throw plus) ; basculer le toggle en live appelle de vrais providers pour image **et** texte ; le `model` choisi apparaît dans le `run log` (pas `deterministic-template`) ; un id custom invalide est refusé par l'UI avant l'API.
3. **Parité** : pour chaque capacité, l'état UI (badge/mode/message) est **identique à la réalité moteur** en mock comme en live — vérifié par probe `GET /models` + smoke opérateur (T-010).
