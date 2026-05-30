# Workstream ARCHITECTURE — Plan d'action

> FemiGlow Content Studio v2 / AI Engine · pipeline génération + publication
> Préfixe d'action : **ACT-ARC-###** · Statut : conception (aucune modification de code applicatif)
> Cible : **ADR-0007 Option 1 — convergence vers A (LangGraph = moteur unique)**, bascule **incrémentale et réversible par flag**
> Baseline figée : `docs/audit-generation-publication-2026-05-29/` (2026-05-29) · Routage 102 points : `plan/01_coverage/_routing.json`
> ADR de ce workstream : `adr/adr-0008..0011` · ADR amont applicables : `docs/.../decisions/adr-0002..0007`

---

## 0. Périmètre du workstream

Ce workstream possède la **forme** de la convergence (le COMMENT structurel), subordonné au *risque-first* sur l'ordre (vérité d'abord, garde-fou anti-doublon en gate dur) et au *valeur-first* sur le rythme (quick-win OpenAI tôt, bascule incrémentale). Il **ne réimplémente pas** les providers (workstream backend) ni l'UI (workstreams frontend/ui-ux/design) : il pose les **frontières** dans lesquelles ces réparations se font une seule fois.

Couverture : il fournit les **fondations transverses** dont dépendent les autres workstreams :
- contrat de sortie unique du moteur (`GenerationResult` complet + taxonomie d'erreurs) ;
- façade d'invocation unique (`invokeEngine`) + pont bidirectionnel idempotent ;
- file de jobs async unique (polling Higgsfield + scheduler publication) ;
- harnais de parité mock/live (MSW réseau, contract-tests fournisseurs, détecteur de divergence) ;
- résolution de credentials unifiée + picker honnête (même source que le moteur) ;
- isolation/unification du stockage média ;
- architecture de test honnête (pourquoi 0/95 assert un effet réel) + bascule incrémentale par flag.

28 IDs assignés : `BUG-004, BUG-011, BUG-015, BUG-016, BUG-018, BUG-019, BUG-024, BUG-026, BUG-027, BUG-031, BUG-034, BUG-035, BUG-037, BUG-041, BUG-043, BUG-045, BUG-046, BUG-047, BUG-052, BUG-062, BUG-069, MISS-005, MISS-007, MISS-008, MISS-009, MISS-019, MISS-022, MISS-031`.

---

## 1. Objectifs

1. **Rendre exposable tout ce que A produit** : `GenerationResult` propage `voiceover/music/subtitles/composition/exports/thumbnails`, sans quoi aucun pont — même bidirectionnel — ne peut livrer voix-off/montage à l'opérateur (BUG-004, BUG-034, MISS-005).
2. **Un moteur unique derrière une frontière unique** : `invokeEngine` + pont bidirectionnel idempotent, retrait progressif de la duplication B (texte/image) (BUG-015, BUG-026, BUG-047).
3. **Une seule infra de jobs async** : polling Higgsfield (async submit+poll, routage par identité provider) + scheduler publication, déterministe en stockage (MISS-009, MISS-022, BUG-037, BUG-062).
4. **Un instrument de mesure honnête** : MSW réseau global fidèle aux contrats réels, contract-tests fournisseurs, détecteur de divergence, exit-code = vérité (BUG-011, BUG-018, BUG-027, BUG-041, BUG-045, BUG-046, MISS-007, MISS-008, MISS-031).
5. **Une source unique de credentials + un picker honnête** : `resolveProviderCredential` consommée par A, B et le picker ; badge « Live » ⇔ même résolution que le moteur ET provider joignable (BUG-016, BUG-019, BUG-024, BUG-043, MISS-019, MISS-007).
6. **Taxonomies & registre de providers cohérents** : enums objective/pillar/tone unifiés A↔B, taxonomie d'erreurs partagée, registre de providers honnête (BUG-052, BUG-069).

---

## 2. État cible (résumé, cf. `plan/00_overview/target-architecture.md`)

| Dimension | Aujourd'hui | Cible (ce workstream) |
|---|---|---|
| Moteurs | Deux (A riche, B pauvre), dupliqués | Un (A) ; B = UI/façade via `invokeEngine` |
| Pont A/B | Unidirectionnel A→B, lossy | Bidirectionnel idempotent ; `GenerationResult` complet |
| Capacités composées | Jetées avant le bridge (`buildResult`) | Propagées (composition/exports/thumbnails) |
| Async (Higgsfield) | Endpoints sync faux, poll dans le handler | Async submit+poll dans la file de jobs unique |
| Credentials | ≥ 3 chemins divergents | 1 source `resolveProviderCredential` |
| Picker « Live » | Mensonger (source forcée `live`, cache fantôme) | Honnête (même source que le moteur, vraie `source`) |
| Stockage | `process.cwd()` relatif, deux conventions, tests polluent prod | `MEDIA_DIR` absolu injecté, `getStorage()` unique, isolé en test |
| Test | 1695 verts / exit 1 ; 0/95 effet réel ; MSW non câblé | Harnais de parité, MSW global `onUnhandledRequest:'error'`, exit-code = vérité |
| Taxonomies | Enums A≠B (ZodError au branchement) | Unifiées + mapping inverse B→A |

---

## 3. Approche & changements requis (le quoi + le pourquoi)

### 3.1 Contrat de sortie complet (pré-requis structurel absolu)
`buildResultFromState` perd `composition/exports/thumbnails` **avant** le pont (MISS-005) ; l'interface `GenerationResult` ne les déclare même pas. C'est la racine de BUG-004 et le verrou de toute convergence : un pont bidirectionnel lirait `undefined`. → **ACT-ARC-001** (contrat complet + contrat d'erreur honnête, ADR-0010, T-104). Doit précéder ACT-ARC-002/003.

### 3.2 Pont bidirectionnel idempotent + façade
Le bridge actuel ne lit que les métadonnées textuelles et crée des drafts sans média approuvable (BUG-034). On étend le bridge pour persister les assets composés (table `media`, mapping `assetId` réel) puis on introduit `invokeEngine` comme frontière B→A. → **ACT-ARC-002** (bridge bidirectionnel, ADR-0008, T-104) puis **ACT-ARC-003** (façade `invokeEngine`, ADR-0008, T-901).

### 3.3 File de jobs async unique
Le polling Higgsfield (async, jusqu'à plusieurs minutes) ne doit pas vivre dans le handler HTTP ; le scheduler de publication a les mêmes besoins. On mutualise (worker resumable, idempotence/locking, retry borné, heartbeat, déclencheur self-hosted). → **ACT-ARC-006** (architecture de la file + scheduler, ADR-0009, T-103b/T-204/T-301/T-302) et **ACT-ARC-007** (architecture Higgsfield async submit+poll + routage par identité provider + contrat Postiz live, ADR-0009, T-103/T-006). Pré-requis stockage : **ACT-ARC-009**.

### 3.4 Harnais de parité mock/live (pièce maîtresse de vérification)
MSW est installé mais non câblé en serveur global ; 58/95 fichiers mockent `fetch` directement ; les doublures inventent des contrats synchrones faux ; le contract-test existant ne couvre que les routes internes (MISS-008) ; `next/navigation` est mocké globalement, neutralisant les assertions de navigation (MISS-031) ; aucun test n'assert un effet backend réel (BUG-041) ; le live cassé n'est pas couvert (BUG-011) ; les nœuds A ne testent que le fallback LLM en rejet (BUG-018). → **ACT-ARC-004** (architecture de test : pourquoi 0/95 effet réel + politique MSW global + exit-code), **ACT-ARC-005** (contract-tests fournisseurs fidèles + détecteur de divergence + parité dry_run↔Postiz), **ACT-ARC-012** (architecture de bascule incrémentale gardée par smoke opérateur).

### 3.5 Résolution de credentials unifiée + picker honnête
La clé valide `OPENAI_API_KEY` est déjà dans le process (MISS-007) mais lue via une chaîne divergente côté génération (B) vs découverte (picker). On unifie `resolveProviderCredential` (consommée par A, B, picker) et on aligne le picker : badge « Live » ⇔ même source que le moteur ET provider joignable ; vraie `source` propagée (pas forcée `live`) ; liste blanche par rôle ; discovery Higgsfield sur le bon host/auth (ne plus fetch le host mort à chaque GET). → **ACT-ARC-013** (résolution unifiée, ADR-0004, T-005) et **ACT-ARC-008** (alignement picker↔générateur, T-202).

### 3.6 Stockage unifié & isolé
`compose/transcode` écrivent en dur via `join(process.cwd(),'../../.media-storage/ai-engine')` (deux conventions d'URL, couplage cwd) tandis que les uploads v2 passent par `getStorage()` ; les tests polluent le stockage prod (977 stubs 10-14 o). → **ACT-ARC-009** (abstraction de stockage unique `getStorage()` + `MEDIA_DIR` absolu + isolation test + purge stubs, T-306/T-411).

### 3.7 Taxonomies & registre cohérents
Enums objective/pillar incompatibles A↔B (ZodError au branchement) ; provider `meta_graph` déclaré mais `adapter=null`. → **ACT-ARC-011** (taxonomies unifiées + mapping inverse + taxonomie d'erreurs + registre honnête, ADR-0010, T-412).

### 3.8 Bascule incrémentale
La convergence se fait capacité par capacité derrière un flag, chaque pas prouvé en parité mock+live, rollback trivial. → **ACT-ARC-010** (stratégie de bascule + flag + retrait dette, ADR-0011, T-901) et **ACT-ARC-012** (gate de bascule par smoke).

---

## 4. Dépendances inter-workstreams

| De ce workstream | Fournit à | Reçoit de |
|---|---|---|
| `GenerationResult` complet (ACT-ARC-001) | backend (providers), frontend (rendu), ui-ux | — |
| `invokeEngine` + pont (ACT-ARC-002/003) | backend, frontend, ui-ux | backend (nœuds providers réparés) |
| File de jobs (ACT-ARC-006/007) | backend (publication), data (état jobs) | data (schéma `social_publish_job`), backend (adapters) |
| Harnais de parité (ACT-ARC-004/005) | **tous** (DoD mock+live exige MSW fidèle) | — |
| `resolveProviderCredential` (ACT-ARC-013) | backend (génération), ui-ux (picker) | data (table clés) |
| Stockage unifié (ACT-ARC-009) | backend (compose/transcode), data | data (table `media`) |
| Taxonomies/erreurs (ACT-ARC-011) | backend, frontend, ui-ux | — |
| Bascule par flag (ACT-ARC-010/012) | **tous** (gate de release) | — |

Garde-fous transverses (P3, non négociables, portés par data/backend, gardés par ce workstream) : T-204 (idempotence) + T-301 (sync état) **précèdent** l'activation live de T-103b (scheduler) dans la file de jobs (ACT-ARC-006).

---

## 5. Couverture audit (id → action(s)) — preuve des 28 IDs

| ID | Sév | Domaine | Action(s) | Justification |
|---|---|---|---|---|
| BUG-004 | blocker | voix-off | ACT-ARC-001, ACT-ARC-002 | `GenerationResult`/`buildResult` ne propagent pas composition/exports/thumbnails → voix-off/montage inatteignables ; contrat complet + pont les remontent |
| MISS-005 | major | montage-composition | ACT-ARC-001 | Racine : perte des assets composés dans `buildResult` AVANT le bridge |
| BUG-034 | major | montage-composition | ACT-ARC-002 | Le bridge ignore composition/exports/thumbnails et crée des drafts sans média approuvable → pont bidirectionnel persistant les assets |
| BUG-015 | major | copywriting | ACT-ARC-003, ACT-ARC-010 | Deux systèmes texte non connectés → façade `invokeEngine` + bascule du texte vers A par flag |
| BUG-026 | major | generation-image | ACT-ARC-003, ACT-ARC-010 | Deux systèmes image non connectés → même façade + bascule image |
| BUG-047 | major | test-mock-infra | ACT-ARC-004, ACT-ARC-012 | Couverture porte sur A, opérateur n'utilise que B → architecture de test + gate de bascule (smoke route B→A) |
| BUG-037 | major | publication-postiz | ACT-ARC-007, ACT-ARC-005 | Live Postiz jamais exercé E2E → contrat Postiz live dans la file + contract-test fidèle |
| BUG-062 | minor | montage-composition | ACT-ARC-009 | Incohérence chemin stockage (compose `fs` direct vs `getStorage()`) → abstraction unique |
| BUG-031 | major | generation-video | ACT-ARC-009 | Tests polluent le stockage prod (`MEDIA_DIR` relatif partagé) → isolation + `MEDIA_DIR` absolu + purge |
| BUG-035 | major | montage-composition | ACT-ARC-009, ACT-ARC-004 | Tests mockent intégralement sharp+ffmpeg+fs (zéro preuve réelle) → stockage isolé + architecture de test d'intégration réelle |
| BUG-027 | major | generation-image | ACT-ARC-004, ACT-ARC-005 | 1695 verts / exit 1 + mauvais contrat HF synchrone → exit-code = vérité + contract-test rouge sur sync faux |
| BUG-011 | critical | test-mock-infra | ACT-ARC-004, ACT-ARC-013 | Live cassé non couvert (clés vides/incomplètes) → healthcheck honnête + credential unifié |
| BUG-018 | major | copywriting | ACT-ARC-005 | Nœuds A ne testent que le fallback LLM (rejet) → contract-test LLM succès (chemin live) |
| BUG-041 | major | test-mock-infra | ACT-ARC-004 | 0/95 assert un effet backend réel → architecture de test : effet réel exigé |
| BUG-045 | major | test-mock-infra | ACT-ARC-005 | dry-run/fixtures divergent de Postiz réel → parité dry_run↔Postiz au même contrat |
| BUG-046 | major | test-mock-infra | ACT-ARC-004 | MSW non câblé en serveur global ; setup mocke trop large → MSW global `onUnhandledRequest:'error'` |
| MISS-007 | major | test-mock-infra | ACT-ARC-013, ACT-ARC-008 | Clé OpenAI réelle présente mais aucun chemin de génération ne sait l'utiliser → résolution unifiée + picker aligné |
| MISS-008 | major | test-mock-infra | ACT-ARC-005 | Contract-test existant ne couvre pas les providers externes ni sync/async → contract-tests fournisseurs |
| MISS-031 | minor | test-mock-infra | ACT-ARC-004 | `next/navigation` mocké globalement neutralise les assertions de navigation → politique MSW/mocks honnête |
| BUG-016 | major | copywriting | ACT-ARC-008 | Picker role=chat propose whisper-1 'live' jamais appelé → liste blanche + même clé que la génération |
| BUG-019 | major | create-ui-flow | ACT-ARC-008 | role=chat expose 106 modèles non-chat → liste blanche de capacités par rôle + validation schéma |
| BUG-024 | major | create-ui-flow | ACT-ARC-008 | `materialiseDiscoveredModel` force `source='live'` sur fallback → propager la vraie `source` |
| BUG-043 | major | test-mock-infra | ACT-ARC-008, ACT-ARC-013 | Badge 'Live' depuis cache mémoire + clé divergente → libellé distinct cache/live + même résolution |
| MISS-019 | minor | generation-image | ACT-ARC-008 | Discovery Higgsfield fetch le host mort à chaque GET → court-circuit + bon host/auth |
| MISS-009 | major | test-mock-infra | ACT-ARC-007, ACT-ARC-005 | image-generation utilise endpoints HF sync faux → async submit+poll + contract-test rouge |
| MISS-022 | minor | generation-video | ACT-ARC-007 | Routeur vidéo `startsWith('hf-')` au lieu de `provider==='higgsfield'` → routage par identité dans la file |
| BUG-052 | minor | copywriting | ACT-ARC-011 | Taxonomies objective/pillar incompatibles A↔B (ZodError) → unification + mapping inverse |
| BUG-069 | info | publication-postiz | ACT-ARC-011 | `meta_graph` déclaré provider mais adapter=null → registre de providers honnête |

**Les 28 IDs sont couverts.** (BUG-044 réfuté = hors périmètre, conforme au routage.)

---

## 6. Séquencement interne (lots P0..P5)

- **P0 (vérité + parité, non négociable)** : ACT-ARC-004 (architecture de test + MSW global), ACT-ARC-005 (contract-tests fournisseurs + détecteur de divergence), ACT-ARC-013 (résolution credentials unifiée — débloque OpenAI live), ACT-ARC-008 (picker honnête).
- **P1 (moteur unique + blockers)** : ACT-ARC-001 (contrat complet — pré-requis), ACT-ARC-002 (pont bidirectionnel), ACT-ARC-009 (stockage déterministe — avant worker), ACT-ARC-006 (file de jobs + scheduler sous garde-fou), ACT-ARC-007 (Higgsfield async + Postiz live).
- **P2 (convergence amorcée)** : ACT-ARC-003 (façade `invokeEngine`).
- **P5 (convergence finale + dette)** : ACT-ARC-010 (bascule incrémentale par flag + retrait dette), ACT-ARC-011 (taxonomies/erreurs/registre), ACT-ARC-012 (gate de bascule par smoke).

Chemin critique : `ACT-ARC-004/005/013/008 [P0]` → `ACT-ARC-001 → ACT-ARC-002 → (ACT-ARC-009 → ACT-ARC-006/007) [P1]` → `ACT-ARC-003 [P2]` → `ACT-ARC-010/011/012 [P5]`.

---

## 7. Definition of Done (gabarit appliqué à chaque action)

Conforme à `plan/00_overview/guiding-principles.md` :
1. Comportement réel exercé, **effet backend** asserté (P1).
2. Prouvé en **MOCK** (MSW fidèle) **ET LIVE** (credential de test, jamais client) par le **même** scénario opérateur (P2). Sous-DoD live découplé si credential externe manquant (Higgsfield).
3. Aucun faux succès silencieux (P1/P5).
4. Si publication live touchée : garde-fous anti-doublon satisfaits **avant** activation (P3).
5. Parité automatique (contract-test de divergence vert) ; CI échoue sur l'exit-code (P1/P2).
6. Pas de régression du smoke opérateur mock+live (P8).
