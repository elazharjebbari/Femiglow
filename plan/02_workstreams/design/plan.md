# Workstream DESIGN — plan d'action

> FemiGlow Content Studio v2 / AI Engine · pipeline génération + publication
> Cible d'architecture : **ADR-0007 Option 1 — convergence vers A (LangGraph moteur unique ; le create-flow B devient une UI au-dessus de A)**.
> Baseline figée : `docs/audit-generation-publication-2026-05-29/` (2026-05-29, branche `feat/ai-engine-langgraph-mvp`).
> Préfixe d'action : **ACT-DS-###**. Statut : **conception** — ce document ne modifie aucun code applicatif ; il produit un plan exécutable et les artefacts design (`plan/04_design/*`).
> Lentille : système de tokens `--cs-*`, contraste / WCAG AA, distinction visuelle image/vidéo (badge/durée), fidélité de l'aperçu au rendu réel des réseaux, et — par mandat de couverture — les deux specs E2E faux du parcours vidéo (BUG-029, BUG-055).

---

## 0. IDs assignés et mandat de couverture

| ID assigné | Sévérité | Domaine | Essence | Action(s) couvrante(s) |
|---|---|---|---|---|
| **BUG-029** | major | generation-video | E2E `create-mock-video:8` rouge : le test attend le bouton « Générer un visuel IA » mais en `kind=video` le bouton réel est « Générer une vidéo IA » (`MediaStudio.tsx:240`). **Bug de test, pas de prod.** Un rouge sur une fonctionnalité qui marche masque les vrais signaux. | **ACT-DS-001**, ACT-DS-002 |
| **BUG-055** | minor | create-ui-flow | Même cause racine que BUG-029 (doublon de finding, autre domaine) : sélecteur du spec ne couvre pas le libellé dynamique du bouton → timeout 30 s ; le parcours vidéo n'a donc **aucune** couverture E2E verte malgré un backend prouvé fonctionnel (probe `kind=video durationMs=5000 reel-9x16.mp4 200 video/mp4 62 ko`). | **ACT-DS-001**, ACT-DS-002 |

> Les deux IDs partagent une **cause racine unique** : le libellé du bouton de génération est conditionnel au `kind` (`Générer une vidéo IA` vs `Générer un visuel IA`), et le contrat de sélection des tests s'appuie sur un **libellé textuel** non kind-aware au lieu d'un **hook de design stable** (`data-cs-generate-button`, déjà présent à `MediaStudio.tsx:238`). La réponse design n'est pas « patcher une regex » mais **graver le contrat de la distinction image/vidéo** (hooks stables + invariant kind↔libellé↔icône↔badge) pour que ce type de rupture devienne **impossible** et **détectable en CI**. C'est l'objet de ACT-DS-001 (contrat + correctif des 2 specs) et ACT-DS-002 (garde anti-régression du contrat).

**Vérification mécanique** : `BUG-029` et `BUG-055` apparaissent tous deux dans le champ `audit_lie` de `tasks.csv` (ACT-DS-001 et ACT-DS-002). Voir §8 « Tableau de couverture audit ».

---

## 1. Objectifs du workstream

1. **Tuer le bruit rouge qui masque la vérité** (BUG-029/055) en gravant un **contrat de distinction image/vidéo** stable et kind-aware (hooks `data-cs-*`, invariant libellé/icône/badge/durée), et corriger les 2 specs pour qu'ils exercent le **parcours vidéo réel** (preuve mock + smoke).
2. **Supprimer la tromperie visuelle** : le design ne doit plus *certifier visuellement* un état que le backend ne sait pas honorer (badge « Live » mensonger, désync mock/live, aperçu basse-déf). Le design fournit ici le **contrat visuel** ; le câblage de la donnée appartient à ui-ux/frontend/backend (coordination, §7).
3. **Atteindre WCAG AA** sur les paires de tokens `--cs-*` sous-contrastées (texte muet, badges de statut petits) et **verrouiller** ce niveau par un lint a11y de contraste en CI — le « harnais qui exerce le point de vue réel » appliqué au point de vue d'un opérateur malvoyant.
4. **Rendre l'aperçu fidèle au rendu réseau réel** : choisir la plus grande dérivée disponible (pas le thumbnail `sm`), et **dédier un état d'erreur visuel** (asset vide / manquant / stub 10 octets) au lieu d'un cadre noir ou d'une image cassée servie comme succès.
5. **Préparer la surface visuelle de la convergence vers A** : concevoir les **slots UI** (vidéo composée, lecteur voix-off/musique, aperçu sous-titres) que la réparation backend (BUG-004/T-104) doit pouvoir alimenter — sans promettre ces capacités tant qu'elles ne sont pas atteignables (anti-tromperie).
6. **Résorber la dette d'application des tokens** : livrer les primitives atomiques promises (`tokens.css:276` « full primitives in Phase 0.6 ») pour éliminer les 5 ré-implémentations du « pill badge » et les valeurs hors-token qui ignorent le dark mode.

> **Principe directeur (P1/P2 du plan global)** : « fait » est interdit. Chaque DoD est « **prouvé en exerçant X en MOCK ET LIVE** ». Pour un workstream design, « live » signifie : exercé sur le **rendu réel** (capture, mesure de contraste sur les vraies polices `next/font`, comparaison aperçu↔rendu réseau réel une fois le LIVE débloqué), pas seulement sur un snapshot de test.

---

## 2. État actuel (constaté, sourcé)

Synthèse de `03_axes/design/state.md` (verdict d'axe : **MAJOR** — aucun blocker n'est imputable au design ; mais le design **amplifie** des défauts critiques en les rendant crédibles).

- **Tokens `--cs-*`** : 68 tokens, scoping `.cs-v2-shell` discipliné, thèmes clair/sombre, fallback `:root` pour portails Radix, `prefers-reduced-motion` respecté. **Mature.** (`apps/web/src/styles/content-studio-v2/tokens.css`, dupliqué `apps/web/src/styles/tokens.css`.)
- **Distinction image/vidéo** : explicite — `radiogroup` Type de média (`MediaStudio.tsx:404-465`), bouton conditionnel (`MediaStudio.tsx:240`), bande de métadonnées kind+durée+dimensions+ratio (`MediaStudio.tsx:246-292`, hooks `data-cs-meta-*`), badge permanent `VIDÉO · m:ss` (`media/VideoPlayer.tsx:137-163`, hooks `data-cs-video-badge`/`data-cs-video-duration`). **Soigné mais le contrat de sélection n'est pas verrouillé** → BUG-029/055.
- **Affordances** régénérer/décrocher conditionnées (`MediaStudio.tsx:198-223`, `data-cs-regenerate-button`).
- **Aperçus réseaux** : maquette riche IG/FB (`media/PlatformPreview.tsx`, 313 lignes), mais `renderMedia` (`:281-304`) rend l'image via `media.previewUrl` (vignette AVIF `sm` ~1,7 ko en mock, `originalUrl=null`) et **aucun état d'erreur** pour `src=''` (vidéo vide) ou stub 10 octets → cadre noir / image cassée servis comme succès.
- **Contraste** : 3 paires < WCAG AA mesurées sur les valeurs exactes de `tokens.css` :
  - `--cs-fg-muted #A89D90` / `--cs-bg-base #FBF6F1` = **2.48:1** (texte fonctionnel 10–11 px).
  - `--cs-fg-muted #A89D90` / `--cs-bg-elevated #FFFFFF` = **2.66:1**.
  - `--cs-warning #C28846` / `--cs-warning-bg #F5E5CC` = **2.46:1** (`MockModeBadge`).
  - Marginal : badge « Live » `--cs-success #5A7560` / `#DCE5DD` = 3.93:1 à 9 px (traité comme texte normal → insuffisant) ; dark `--cs-fg-muted #7A6E63` / `#1A1411` = 3.68:1.
- **Dette tokens** : application quasi-exclusivement inline `style={{}}` ; « pill badge » ré-implémenté 5× ; valeurs hors-token (`rgba(0,0,0,0.55)`, `#1877F2`, `font-size:10/11/13`) qui ignorent le dark mode ; primitives « Phase 0.6 » jamais livrées.
- **Pas de slot** pour voix-off/musique/sous-titres/vidéo composée (conséquence design de BUG-004 ; le bridge A→B unidirectionnel jette ces livrables avant l'UI).

---

## 3. État cible (aligné convergence vers A)

| Sous-axe | Cible | Réf. principe / ADR |
|---|---|---|
| Distinction image/vidéo | **Contrat de sélection stable et kind-aware** : tout point de génération porte `data-cs-generate-button` + `data-cs-kind`, et l'invariant **libellé ⇔ icône ⇔ badge ⇔ durée** est garanti par une primitive partagée. Les specs s'appuient sur les hooks, jamais sur un libellé localisé seul. | P1 (vérité), ADR-0014 |
| Contraste / WCAG AA | **Toutes** les paires token×surface utilisées pour du texte fonctionnel ≥ 4.5:1 (≥ 3:1 pour ≥ 14 px gras/large), dans les **deux** thèmes ; **lint a11y de contraste en CI** bloquant. | P7 (observabilité), ADR-0014 |
| Honnêteté visuelle (badge Live, mode) | Le design **n'affiche jamais** un signal de capacité qu'il ne peut pas prouver. Contrat visuel : badge à 4 états (`Live`/`Cache`/`Statique`/`Indisponible`), source = même résolution que le moteur (T-005/T-202). Câblage data → **ui-ux**. | P4 (frontière unique), ADR-0015 |
| Fidélité aperçu | `PlatformPreview` choisit la **plus grande dérivée disponible** (≥ `md` / `original`), jamais le thumbnail `sm` ; **état d'erreur visuel dédié** (média indisponible/vide/<1 ko) au lieu d'un cadre noir. Une fois le LIVE débloqué, fidélité **prouvée** par comparaison aperçu↔rendu réseau réel. | P5 (fallbacks visibles), ADR-0015 |
| Slots média avancés (convergence A) | Le design prévoit des emplacements pour **vidéo composée**, **lecteur voix-off/musique** et **aperçu sous-titres**, alimentés par `GenerationResult` complet (T-104). Ces slots ne sont **rendus** que si l'asset existe (pas de promesse vide). | P6 (évolutivité), `target-architecture.md §2.1/§4.6` |
| Dette tokens | Primitives atomiques `Badge`/`Pill`/`Surface`/`Button` consommant les tokens ; valeurs hors-token réseau encapsulées dans des tokens « brand-network » thémables. | P8 (maintenabilité) |

> **Pourquoi cet ordonnancement par phases (P0→P5)** : la baseline impose que la vérité du signal de test précède tout (P0). BUG-029/055 sont du **bruit de test** sur le parcours opérateur réel : leur correction est **P0** (avec T-003) car un rouge faux décrédibilise tout le harnais. Le reste (contraste, aperçu, slots) suit la valeur/risque : la tromperie visuelle (P2/P3), puis la fidélité (P4), puis la dette (P5).

---

## 4. Approche

1. **Graver le contrat avant de patcher.** Pour BUG-029/055, on ne se contente pas de corriger la regex : on documente le **contrat de distinction image/vidéo** (`plan/04_design/design-system.md` + ADR-0014), on liste les **hooks de sélection stables** (`data-cs-generate-button`, `data-cs-kind`, `data-cs-video-badge`, `data-cs-meta-*`), et on corrige les 2 specs pour cibler ces hooks (+ assertion `kind=video` envoyée à l'API et asset `video/mp4` joué). Le correctif est minimal côté app (les hooks existent déjà) ; l'investissement est dans le **garde-fou** (ACT-DS-002).
2. **Le design fournit le contrat, pas le câblage.** Badge Live honnête, source unique du mode → la **donnée** est résolue par ui-ux (ACT-UX-001/005) et backend (T-005). Le design définit le **vocabulaire d'états** (`Live`/`Cache`/`Statique`/`Indisponible`) et le contrat de contraste de ces badges. Pas de double-implémentation : coordination explicite (§7).
3. **Mesurable = mesuré sur le vrai rendu.** Le contraste se prouve par un **calcul reproductible** sur les valeurs `tokens.css` (mock = mesure sur tokens) **et** par une **capture du rendu réel** avec les polices `next/font` (live = œil/outil sur le DOM rendu). L'aperçu se prouve en mock (URL d'aperçu ≠ `…/avif/sm.avif`) **et** en live (comparaison pixel-à-pixel aperçu↔Postiz/IG une fois le LIVE débloqué).
4. **Incrémental et réversible.** Les primitives atomiques et les slots média sont introduits **derrière** le travail existant sans casser le mock B (seul parcours qui marche) ; chaque PR gardée par le smoke opérateur (T-010).

---

## 5. Changements requis (le quoi + le pourquoi)

### 5.1 Contrat de distinction image/vidéo + correctif des 2 specs (BUG-029, BUG-055) — P0
- **Quoi** : (a) documenter dans `design-system.md` le contrat « tout déclencheur de génération porte `data-cs-generate-button` et un ancêtre/attribut `data-cs-kind` ; le libellé/icône/badge dérivent du `kind` via une source unique ». (b) Corriger `e2e/content-studio-v2/create-mock-video.spec.ts:28` (et la 2e occurrence ligne 51) pour cibler `[data-cs-generate-button]` (ou la regex tolérante `/Générer (un visuel|une vidéo) IA/i`), conservant l'assertion `state.lastVisualBody.kind==='video'` et l'asset `/_media/.../*.mp4` joué.
- **Pourquoi** : un rouge sur un parcours fonctionnel (probe : `kind=video`, `reel-9x16.mp4` 200 `video/mp4` 62 ko) **masque les vrais signaux** et décrédibilise le harnais (cause racine systémique #1 de l'audit). Le hook `data-cs-generate-button` existe déjà (`MediaStudio.tsx:238`) ; c'est un contrat de design à **graver**, pas à inventer.
- **Note de périmètre** : la 2e moitié de T-003 (table `audit_event`→`audit_events` dans un autre spec) est **hors design** (data/backend). ACT-DS-001 ne couvre que la moitié « libellé bouton vidéo » de T-003.

### 5.2 Garde anti-régression du contrat image/vidéo (BUG-029, BUG-055) — P0
- **Quoi** : un test unitaire (RTL) du contrat : pour `kind∈{image,video}`, le composant rend `data-cs-generate-button` avec le bon libellé ET le bon `data-cs-kind`, et le `VideoPlayer` rend `data-cs-video-badge`+`data-cs-video-duration` pour un média vidéo. Garde aussi l'invariant côté E2E via les hooks.
- **Pourquoi** : empêcher qu'un futur changement de libellé/icône re-casse silencieusement les specs (la régression de BUG-029/055 est née d'un libellé introduit après l'écriture du spec, `root` du finding). Verrouille la cause racine.

### 5.3 Contraste / WCAG AA + lint a11y CI — P3 (MISS-DESIGN-001/002, recoupe BUG-007/021)
- **Quoi** : relever `--cs-fg-muted` (clair ET sombre) à ≥ 4.5:1 sur `bg-base` ET `bg-elevated` (cible ~`#7E7264` clair, à recalculer) ; corriger `MockModeBadge` (warning 2.46:1) et badge « Live » (9 px) par assombrissement du texte / taille ≥ 14 px / bordure de contraste ; ajouter un **test de contraste reproductible** sur les paires token×surface, bloquant en CI.
- **Pourquoi** : `--cs-fg-muted` porte tout le texte fonctionnel 10–11 px (sources, durées, hints) ; le `MockModeBadge`, censé **avertir d'un coût simulé**, est sous le seuil de lisibilité — l'avertissement le plus important est le moins lisible. Aucune vérification a11y dans la boucle aujourd'hui (cause racine #4 de l'axe).

### 5.4 Fidélité de l'aperçu + état d'erreur visuel — P4 (BUG-053, MISS-021, MISS-004 ; recoupe MISS-010)
- **Quoi** : `renderMedia` (`PlatformPreview.tsx:281`) et `MediaStudio.tsx:127` choisissent la plus grande dérivée (`md`/`lg`/`original`) ; un **placeholder « média indisponible »** remplace le rendu quand `previewUrl` est vide / l'asset est introuvable / fait < 1 ko (couvre `<video src=''>` MISS-021 et stubs 10 octets MISS-004).
- **Pourquoi** : la promesse « ce que vous voyez est ce qui sera publié » est rompue par le thumbnail `sm` (BUG-053) ; un asset vide/cassé rendu comme succès est un **faux succès visuel** (viole P1/P5). Le backend doit exposer la dérivée (coordination §7).

### 5.5 Slots UI pour livrables avancés (convergence A) — P4/P5 (anticipe BUG-004/BUG-066)
- **Quoi** : concevoir (maquette + contrat de props) dans `MediaStudio`/`PreviewPane` des slots **vidéo composée**, **lecteur voix-off/musique**, **aperçu sous-titres** (avec wrapping multi-cue), rendus **uniquement** si `GenerationResult` (T-104) fournit l'asset. Documenté dans `ux-flows.puml` + `ui-states.md`.
- **Pourquoi** : la réparation backend (T-104, BUG-004) a besoin d'une **cible visuelle** ; sans slot, A→B re-jetterait les assets. Anti-tromperie : pas de slot vide « à venir » qui promet une capacité inatteignable.

### 5.6 Primitives atomiques de tokens — P5 (MISS-DESIGN-003)
- **Quoi** : livrer `Badge`/`Pill`/`Surface`/`Button` (les « full primitives » de `tokens.css:276`) ; encapsuler les valeurs réseau hors-token dans des tokens `--cs-brand-*` thémables.
- **Pourquoi** : 5 ré-implémentations du pill badge + valeurs codées en dur qui ignorent le dark mode = dérive visuelle latente ; une couche atomique rend le contrat de contraste (5.3) **structurellement** garanti, pas dépendant de la discipline d'auteur.

---

## 6. Phasage

| Phase | Actions design | Pourquoi cette phase |
|---|---|---|
| **P0** (vérité) | ACT-DS-001, ACT-DS-002 | Le bruit rouge sur un parcours fonctionnel décrédibilise tout le harnais — non négociable, avec T-003. |
| **P3** (robustesse/honnêteté) | ACT-DS-003 (contraste + lint) | L'avertissement de coût (MockModeBadge) doit être lisible avant d'activer du live ; harnais a11y. |
| **P4** (compose/montage) | ACT-DS-004 (fidélité aperçu + erreur), ACT-DS-005 (slots média A) | L'aperçu doit être fidèle quand le LIVE arrive ; les slots accueillent les livrables de A (T-104). |
| **P5** (dette finale) | ACT-DS-006 (primitives atomiques) | Verrouille structurellement le contrat de contraste et de distinction ; dette de cohérence. |

---

## 7. Dépendances inter-workstreams

| Dépendance | Direction | Détail |
|---|---|---|
| **ui-ux** | design fournit → ui-ux câble | Contrat visuel badge `Live/Cache/Statique/Indisponible` (ADR-0015) consommé par ACT-UX-001 (source propagée). Le **contraste** du badge (ACT-DS-003) doit être satisfait par les nouveaux états. Source unique mode (ACT-UX-005) : design fournit le contrat visuel de cohérence toggle/badge ; pas de double-impl. |
| **frontend** | frontend câble → design contraint | ACT-FE-003 remonte durée/dimensions média ; ACT-DS-001/002 verrouillent leur **affichage** (`data-cs-meta-*`). ACT-FE-005 expose voix-off/montage ; ACT-DS-005 fournit les **slots visuels** cibles. |
| **backend** | backend produit → design consomme | T-104 (`GenerationResult` complet) alimente les slots ACT-DS-005. T-005/T-202 (clé/source unique) alimentent le badge honnête. La dérivée d'aperçu `md/lg` (ACT-DS-004) requiert que le backend l'expose (coordination avec BUG-053/ACT-UX-008). |
| **data** | — | Aucune dépendance directe (la moitié `audit_events` de T-003 est data/backend, hors design). |

> **Anti-collision explicite** : ui-ux possède **le câblage** du picker honnête (ACT-UX-001/002/003), de la source unique du mode (ACT-UX-005/006) et de la fidélité d'aperçu côté donnée (ACT-UX-008). Le design possède **le contrat visuel** (vocabulaire d'états, contraste, distinction kind, état d'erreur visuel, slots) et les **tokens**. Les deux IDs *assignés* au design (BUG-029/055) ne sont couverts par **aucun** autre workstream — ils sont entièrement à charge design.

---

## 8. Tableau de couverture audit (preuve)

| ID audit (assigné) | Action(s) design qui le portent (champ `audit_lie`) | Type de couverture |
|---|---|---|
| **BUG-029** | **ACT-DS-001** (correctif spec + contrat hooks), **ACT-DS-002** (garde anti-régression) | Correctif + verrou |
| **BUG-055** | **ACT-DS-001** (correctif spec + contrat hooks), **ACT-DS-002** (garde anti-régression) | Correctif + verrou |

IDs additionnels traités (au-delà du mandat strict, pour la cohérence du focus design ; couverts par leurs workstreams primaires mais renforcés ici par le contrat visuel) : MISS-DESIGN-001/002/003 (nouvelles issues d'axe, non au registre Phase 1), BUG-053, MISS-021, MISS-004, BUG-004/BUG-066 (slots). Ceux-ci figurent en `audit_lie` secondaire des actions ACT-DS-003..006 **uniquement** quand ils existent au registre ; les pseudo-IDs `MISS-DESIGN-*` sont notés en clair sans prétendre à un id de registre.

**idsCovered (mandat)** : `BUG-029`, `BUG-055`. **idsNotCovered** : (aucun).

---

## 9. ADR proposés (design)

| ADR | Titre | Décision structurante |
|---|---|---|
| **ADR-0014** | Contrat de design vérifiable : hooks de sélection stables + WCAG AA verrouillé en CI | Les parcours de test ciblent des **hooks `data-cs-*`** (pas des libellés localisés) ; le contraste AA est un **invariant CI** sur les paires token×surface. Résout la cause racine de BUG-029/055 et l'absence de harnais a11y. |
| **ADR-0015** | Contrat de fidélité d'aperçu et d'état d'erreur visuel | L'aperçu rend la **plus grande dérivée disponible** et **jamais** un asset vide/cassé comme succès ; un état d'erreur visuel dédié est obligatoire. Opérationnalise P1/P5 côté présentation. |

> Conformément au mandat, les ADR d'architecture (0008–0011) sont réservés à l'architecture. Le design propose 0014/0015 (numéros libres, 0012/0013 étant pris par ui-ux/frontend) **parce qu'une décision structurante l'exige** : faire du contrat de design (sélecteurs + contraste + fidélité) un invariant vérifiable, et non une convention informelle — c'est précisément l'absence de cet invariant qui a produit BUG-029/055.

---

## 10. Artefacts design produits (livrables transverses)

- `plan/04_design/design-system.md` — tokens `--cs-*`, mesures de contraste, contrat de distinction image/vidéo (hooks), vocabulaire d'états de badge, primitives atomiques cibles.
- `plan/04_design/ux-flows.puml` — parcours opérateur **cible** (convergence A) incluant voix-off/montage via A.
- `plan/04_design/ui-states.md` — états chargement/erreur/succès **vus par l'opérateur** pour **chaque** étape du parcours.
