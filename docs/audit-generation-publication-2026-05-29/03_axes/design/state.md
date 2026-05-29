# Axe design

> Lentille : cohérence visuelle, système de tokens CSS `--cs-*`, distinction image/vidéo (badges, durée), affordances (régénérer, décrocher), accessibilité visuelle, fidélité des aperçus au rendu réel des réseaux sociaux.
>
> Baseline figée — 2026-05-29 — branche `feat/ai-engine-langgraph-mvp`. Périmètre : pipeline génération + publication, **flux opérateur réel = `B` (`/admin/content-studio-v2/create`)**. Toutes les affirmations « ça marche / ça ne marche pas » sont tracées à un finding confirmé (BUG-xxx) du registre Phase 1, ou à une mesure reproductible décrite ici.

---

## Etat actuel (constaté, avec preuves)

Le design system de Content Studio v2 est, du strict point de vue de la **fabrique visuelle**, le composant le plus mature de tout le périmètre audité. Il faut le dire clairement pour ne pas noyer les vrais problèmes : la couche présentation n'est pas le maillon faible du pipeline. Les blockers (BUG-001 à BUG-004) sont des défauts **backend / câblage**, pas de design. La valeur de cet axe est ailleurs : **le design est devenu un amplificateur de mensonge** — il rend crédibles, soignés et désirables des états que le backend ne sait pas honorer.

### 1. Système de tokens `--cs-*` : complet, scoping correct, thème géré

Source de vérité : `apps/web/src/styles/content-studio-v2/tokens.css`.

- **68 tokens** distincts recensés (`grep -rho -- '--cs-[a-z0-9-]*' | sort -u`), couvrant surfaces (`--cs-bg-base/elevated/sunken/feature/overlay`), texte (`--cs-fg-primary/secondary/muted/on-accent`), accent (`--cs-accent/-hover/-soft/-bg`), statuts (`--cs-success/warning/danger` + `-bg`), bordures (4 niveaux), ombres (3), rayons (5), échelle typographique (9 pas), espacement (10 pas), z-index (ladder de 5), motion (3 durées + easing).
- **Scoping discipliné** : tout est préfixé `--cs-*` et porté par `.cs-v2-shell`, ce qui évite toute fuite dans l'admin legacy et le site public.
- **Thème clair/sombre** géré par `data-theme` avec palettes ré-encodées (`tokens.css:142-232`), plus une **réplique `:root` de secours** pour les portails Radix (Popover/Dialog/DropdownMenu rendus dans `<body>`, hors du sous-arbre `.cs-v2-shell`) — un piège classique correctement anticipé (`tokens.css:13-91`).
- **`prefers-reduced-motion`** respecté côté shell (`apps/web/src/styles/tokens.css:143,224`, `globals.css:182`, `PageTransition.tsx`).

### 2. Distinction image / vidéo : explicite et soignée

Source : `MediaStudio.tsx`, `VideoPlayer.tsx`, `PlatformPreview.tsx`.

- **MediaStudio** matérialise un `radiogroup` « Type de média » image/vidéo (`MediaStudio.tsx:404-465`) avec icônes (`ImageIcon`/`Film`), état `aria-checked`, et **désactivation motivée** de la vidéo hors formats `reel`/`story` (`title` explicatif + `aria-disabled` + hint texte, `MediaStudio.tsx:418-478`).
- Le **bouton de génération est conditionnel au kind** : « Générer une vidéo IA » vs « Générer un visuel IA » avec icône `Film`/`Sparkles` (`MediaStudio.tsx:227,240`).
- Une **bande de métadonnées** affiche kind + durée (`formatDuration`) + dimensions + ratio calculé (gcd) après sélection (`MediaStudio.tsx:246-292`).
- **VideoPlayer** porte un **badge `VIDÉO · m:ss` permanent** (`VideoPlayer.tsx:138-164`), un indicateur de boucle, et des contrôles play/pause/mute avec `aria-label` corrects. La durée fallback est lue depuis `loadedmetadata` si absente du média (`VideoPlayer.tsx:77-81`) — bonne robustesse.

Preuve d'exercice : le parcours Playwright confirme `data-cs-video-badge`, `<video>` visible, et le toast « Visuel IA généré » en mode mock (`evidence/playwright-operator-journeys.txt` l.161-181). Le mock vidéo opérateur est visuellement complet (BUG-067, verdict `works`).

### 3. Affordances « Régénérer » / « Décrocher » : présentes et conditionnées

- **Régénérer** n'apparaît que pour un média `ai_generated` (`MediaStudio.tsx:198-212`, `data-cs-regenerate-button`, `title="Régénérer avec les mêmes paramètres"`).
- **Décrocher** apparaît dès qu'un média est attaché (`MediaStudio.tsx:213-223`), confirmé visible en E2E (`Décrocher button visible (=media is bound): true`).
- États `loading`/`disabled` propagés aux boutons pendant la génération.

### 4. Fidélité des aperçus réseaux : maquette riche, multi-plateforme

`PlatformPreview.tsx` (313 lignes) rend des chromes crédibles **Instagram** (feed/story/reel/carousel) et **Facebook** (feed/vertical/carousel) : en-têtes avatar dégradé, barre d'actions, compteurs de likes, mise en forme des hashtags, ratios par format (`ASPECT`), troncatures de caption par format. `PreviewPane.tsx` permet de basculer plateforme et format en `tablist`/`tab` accessibles, avec guidage contextuel (`computeGuidance`).

### Synthèse de l'état

| Sous-axe design | État | Preuve |
|---|---|---|
| Tokens `--cs-*` | Mature, scopé, thèmes | `tokens.css` (68 tokens) |
| Distinction image/vidéo | Explicite (badge, durée, icône, ratio) | `MediaStudio.tsx`, `VideoPlayer.tsx` |
| Affordances régénérer/décrocher | Présentes, conditionnées | `MediaStudio.tsx:198-223` |
| Aperçus réseaux | Maquette riche IG/FB | `PlatformPreview.tsx` |
| **Vérité visuelle vs backend** | **Rompue** | BUG-007/024/021/053 |
| **Accessibilité contraste** | **3 paires < WCAG AA** | mesures ci-dessous |

---

## Problèmes concrets

Chaque problème référence le(s) finding(s) confirmé(s). Les problèmes sont ordonnés du plus structurant (le design trahit l'opérateur) au plus cosmétique.

### P1 — Le badge « Live » est un signal de confiance mensonger (criticité haute)
**Findings : BUG-007 (critical), BUG-024 (major), BUG-006 (critical), MISS-002.**

Dans `ModelPicker.tsx`, le badge vert « Live » et l'en-tête de source (`● Live`, `ModelPicker.tsx:220-221`, `505-523`) sont rendus **uniquement** à partir de `model.source === 'live'`. Or :
- `materialiseDiscoveredModel` (`models/route.ts`) **force `source:'live'`** même quand la discovery a renvoyé `source='fallback'` (host Higgsfield mort). 100 % des 8+ modèles Higgsfield (`flux_2`, `veo3_1`, `kling3_0`…) sortent donc avec un badge vert « Live » alors qu'ils proviennent d'un fallback statique et **throwent `invalid_state` à la génération** (BUG-024).
- Les modèles OpenAI sont badgés « Live » car la discovery lit `OPENAI_API_KEY` (présente), tandis que le générateur (`generateStudioImage`) lit `CONTENT_STUDIO_OPENAI_API_KEY` (vide) — clés divergentes (BUG-007). Le badge promet une capacité que le chemin de génération n'a pas.

Le design accomplit ici exactement l'inverse de sa mission : la couleur verte est universellement comprise comme « prêt / disponible ». Elle **arme la déception** au premier clic (HTTP 409). C'est aggravé par MISS-002 : le `ModelPicker` **auto-sélectionne le suggested `live` au montage** (`ModelPicker.tsx:114-118`) sans que l'opérateur ait ouvert le picker, donc le 1er clic « Générer » part déjà sur un modèle non générable.

> Fonctionnement optimal attendu : un badge d'état (Live / Cache / Statique / **Indisponible**) qui reflète la **capacité réelle de génération** (même résolution de clé que le générateur), avec les modèles sans credential **grisés/désactivés**, jamais badgés « Live ».

### P2 — Désynchronisation visuelle mode mock/live : deux sources de vérité (criticité moyenne)
**Findings : BUG-021 (major), MISS-001, MISS-016, MISS-034.**

`MediaStudio` rend `<GenerationModeToggle />` **sans prop `envDefault`** (`MediaStudio.tsx:179`), donc le toggle prend par défaut `'mock'` (`GenerationModeToggle.tsx:44`) et **pose le cookie à `mock` au montage** (`persistMode(next)`, l.56). Mais `/health` renvoie `mockMode:false` (env non défini), donc le `StudioContext` **ne montre pas le `MockModeBadge`**. Résultat : le toggle dit MOCK, le bandeau de mode dit LIVE, et les générations partent réellement en mock. Le `MockModeBadge` (warning ambre, `MockModeBadge.tsx`) et le toggle sont **deux indicateurs visuels qui se contredisent**.

Conséquences design transverses :
- L'opérateur ne peut pas faire confiance à ce que l'interface affiche sur le coût réel (« actions simulées » vs « coûts réels »).
- MISS-034 : le cookie est posé sur `path=/` (toute l'app) malgré un commentaire affirmant un scope admin — le badge de mode peut donc fuiter hors du studio.

### P3 — Les aperçus n'affichent pas le rendu réel (résolution + assets fantômes) (criticité moyenne→basse)
**Findings : BUG-053 (minor), MISS-021, MISS-004, MISS-010.**

`PlatformPreview` rend les images via `media.previewUrl` (`PlatformPreview.tsx:300`). Or en mock, `previewUrl` pointe sur une **vignette AVIF basse définition** (`/_media/.../avif/sm.avif`, 1772 octets) et `originalUrl` est `null` (BUG-053). L'aperçu « fidèle au réseau » est donc rendu à partir d'un thumbnail `sm`, pas de la pleine résolution qui sera publiée. La promesse « ce que vous voyez est ce qui sera publié » est rompue, même si c'est visuellement plausible.

Pire structurellement :
- MISS-021 : `VideoPlayer` reçoit `src=''` pour un asset vidéo fallback/vide (compose/generate-video peuvent renvoyer `url=''`) et **tente de lire une vidéo inexistante** — l'aperçu rend un cadre noir sans erreur visible.
- MISS-004 : 977 stubs `.jpg` de 10–14 octets traînent dans le stockage prod ; un `composed-*.jpg`/`export-*.jpg` de 10 octets pourrait être référencé et **servi comme média réel** dans l'aperçu, qui le rendrait comme une image cassée (pas d'état d'erreur dédié).
- MISS-010 : les assets `/_media` (dont les aperçus) sont servis **sans authentification** — concerne aussi la confidentialité du rendu.

### P4 — Accessibilité visuelle : contraste insuffisant sur le texte muet et le badge mock (criticité basse, mais systémique)
**Findings : original axe design (candidat MISS-DESIGN-001/002), recoupe BUG-007/021 sur les surfaces concernées.**

Mesures WCAG 2.1 reproductibles (algorithme de luminance relative standard, sur les valeurs exactes de `tokens.css`) :

| Paire token | Ratio | Verdict | Usage |
|---|---|---|---|
| `--cs-fg-muted #A89D90` / `--cs-bg-base #FBF6F1` | **2.48:1** | **FAIL AA** | texte tertiaire, hints |
| `--cs-fg-muted #A89D90` / `--cs-bg-elevated #FFFFFF` | **2.66:1** | **FAIL AA** | en-tête source picker (font **10px**), métadonnées modèle |
| `--cs-warning #C28846` / `--cs-warning-bg #F5E5CC` | **2.46:1** | **FAIL AA** | **`MockModeBadge`** (texte « Mode mock — actions simulées ») |
| `--cs-success #5A7560` / `--cs-success-bg #DCE5DD` | 3.93:1 | AA-large only | badge « Live » (font **9px** → traité comme texte normal → insuffisant) |
| `--cs-accent #9C2A47` / `bg-base` | 6.9:1 | OK | liens/accents |
| `--cs-fg-on-accent #fff` / `--cs-accent` | 7.41:1 | OK | bouton primaire |
| DARK `--cs-fg-muted #7A6E63` / `bg-base #1A1411` | 3.68:1 | AA-large only | texte muet en sombre |

`--cs-fg-muted` est utilisé partout pour du texte fonctionnel (compteurs, sources, hints, durées) à **10–11px** — donc « texte normal » au sens WCAG, qui exige 4.5:1. Le badge mock, censé **avertir d'un coût simulé**, est sous le seuil de lisibilité. La maquette est élégante mais l'information de second plan est sous-lisible pour les malvoyants et en conditions lumineuses dégradées.

> Note : ce n'est PAS couvert par un BUG-xxx existant (les domaines Phase 1 étaient fonctionnels, pas a11y). C'est une **issue manquée propre à l'axe design**, à verser au registre comme MISS-DESIGN-001 (fg-muted) et MISS-DESIGN-002 (badges warning/success petits).

### P5 — Cohérence d'implémentation : styles inline massifs vs tokens, recipes incomplètes (criticité basse, dette de maintenabilité visuelle)
**Findings : original axe design (candidat MISS-DESIGN-003).**

Les tokens sont excellents, mais leur **application** se fait quasi-exclusivement en `style={{…}}` inline dans chaque composant (`ModelPicker`, `MediaStudio`, `PlatformPreview`, `VideoPlayer`, `PreviewPane`). Conséquences :
- Duplication de recettes visuelles (le pattern « pill badge » est ré-implémenté à l'identique dans ModelPicker, MediaStudio, VideoPlayer, MockModeBadge, PlatformPreview — 5 fois).
- Les commentaires de `tokens.css` annoncent des **primitives boutons « full primitives in Phase 0.6 »** (`tokens.css:276`) jamais livrées : seules 3 recipes `.cs-btn-*` existent, le reste est inline. Pas de couche atomique unifiée → dérive visuelle probable au fil des features.
- Valeurs **hors-token codées en dur** repérées dans les surfaces sociales : `rgba(0,0,0,0.55)`, dégradés `#1877F2/#4267B2` (Facebook), tailles `font-size: 10/11/13` numériques au lieu de `--cs-text-*`. Acceptable pour une maquette « marque réseau », mais cela contourne le système de thème (ces valeurs ne s'adaptent pas au dark mode).
- `tokens.css` contient encore des couleurs « sectorial (kept from legacy) » (`--cs-clay/sage/saffron/violet`) — héritage non rationalisé.

### P6 — Distinction image/vidéo : angles morts de formats et de chevauchement (criticité basse)
**Findings : MISS-023, BUG-066, MISS-017.**

- MISS-023 : `MOCK_ASSETS` ne couvre que `reel`/`story`. Le `radiogroup` désactive correctement la vidéo hors ces formats, mais des chemins (kind forcé) peuvent atteindre « Générer une vidéo IA » et throw « Aucun mock video disponible » — l'affordance promet une action qui n'a pas d'asset.
- BUG-066 : les **sous-titres** (SRT généré fonctionnel) ne sont **jamais exposés visuellement** à l'opérateur (DTO incomplet, BUG-004) ; et le SRT est tronqué à ~117 caractères sans wrapping multi-lignes → sous-titres illisibles si exposés un jour. Le design n'a aucun emplacement prévu pour ce livrable.
- Chevauchement visuel mineur : dans `VideoPlayer`, le bouton mute (bas-droite) et le badge VIDÉO (bas-gauche) partagent la même bande basse ; sur un aperçu story/reel étroit (`maxWidth: 320`) c'est serré mais non bloquant.
- MISS-017 : « Régénérer » renvoie l'ancien `model` d'état sans le re-synchroniser au kind/format courant — peut régénérer avec un modèle d'un autre kind.

---

## Causes racines

1. **Le design est piloté par une donnée de capacité erronée.** Le badge « Live » (P1) et le toggle de mode (P2) consomment des champs (`source`, `envDefault`) qui ne sont **pas alimentés par la capacité réelle de génération**. La cause racine n'est pas dans le composant visuel : `materialiseDiscoveredModel` force `source:'live'` (`models/route.ts`), et `MediaStudio` n'injecte pas `health.mockMode` dans le toggle. Le design fait correctement son travail à partir d'un signal faux. **C'est la conséquence design du défaut d'architecture transverse MISS-003** (résolution de clé divergente picker↔générateur).

2. **L'aperçu consomme le mauvais artefact** (P3). Le pipeline mock ne produit/expose qu'une dérivée optimisée `sm` (`originalUrl=null`), et `MediaStudio.tsx:127` privilégie `previewUrl` (thumbnail) ; `PlatformPreview` n'a aucune logique de « plus grande dérivée disponible ». Couplé à l'absence d'**état d'erreur visuel dédié** (asset vide/manquant → cadre noir ou image cassée), l'aperçu peut mentir sur le rendu final.

3. **Absence de couche d'application des tokens** (P5). Les tokens sont définis (excellent) mais l'application est laissée à des `style={{}}` inline par composant, sans primitives atomiques (promesse « Phase 0.6 » non tenue). La discipline tient aujourd'hui par la qualité des auteurs, pas par un garde-fou structurel → dette visuelle latente.

4. **Aucune vérification d'accessibilité dans la boucle** (P4). Les palettes ont été choisies pour l'élégance éditoriale (ivoire + terracotta) sans audit de contraste sur les **paires faibles** (texte muet, badges de statut à petite taille). Aucun test de contraste, aucun lint a11y dédié sur les `--cs-*`. Cohérent avec le constat global de l'audit : **pas de harnais qui exerce le point de vue réel** — ici, le point de vue d'un utilisateur malvoyant.

5. **Le design n'a pas de slot pour les livrables inatteignables** (P6, BUG-004). Voix-off / musique / sous-titres / vidéo composée sont produits côté serveur puis jetés avant l'UI ; logiquement, **aucun composant visuel n'a été conçu pour les présenter**. Le design reflète fidèlement une architecture où ces livrables n'existent pas pour l'opérateur.

---

## Criticité (justifiée)

**Criticité de l'axe : MAJOR** (et non blocker/critical).

Justification :
- **Aucun blocker n'est imputable au design.** Les 4 blockers (BUG-001…004) sont backend/câblage. La couche présentation est fonctionnelle et soignée — le mock opérateur est visuellement complet (BUG-067 `works`).
- Mais l'axe **hérite et amplifie** des défauts critiques via deux mécanismes de tromperie visuelle directe : le **badge « Live » mensonger** (BUG-007 critical, BUG-024 major) et la **désync visuelle de mode** (BUG-021 major). Ces signaux conduisent l'opérateur à des actions vouées à l'échec (409) ou à de mauvaises hypothèses de coût. Un signal de confiance faux est plus dangereux qu'une absence de signal : il mérite `major` au niveau axe.
- Les problèmes propres au design (contraste P4, dette tokens P5, aperçu basse-déf P3) sont réels et reproductibles mais `minor`/`major` individuellement, non bloquants pour la livraison.
- La maturité du système (tokens, thèmes, reduced-motion, ARIA largement présents) **rabaisse** la criticité : il n'y a pas de chantier de refonte, seulement des correctifs ciblés et des garde-fous.

Verdict : **MAJOR** — le design ne casse pas le pipeline mais il **certifie visuellement des états faux**, ce qui érode la confiance opérateur et masque les blockers. Les correctifs sont bon marché.

---

## Recommandations (actionnables, priorisées)

### Priorité 1 — Supprimer la tromperie visuelle (corrige P1, P2 ; recoupe BUG-007/024/021/006)
1. **Badge de source véridique.** Faire propager la vraie `source` (`live`/`cache`/`fallback`/`static`) dans `materialiseDiscoveredModel` (`models/route.ts`), sans la forcer à `live`. Dans `ModelPicker`, ne rendre le badge vert « Live » **que si la capacité de génération est confirmée** (même résolution de clé que `generateStudioImage`). Ajouter un état visuel **« Indisponible »** (gris, `aria-disabled`) pour les modèles sans credential, et empêcher leur auto-sélection (MISS-002).
2. **Désactiver/griser les modèles non routables** dans le picker plutôt que de laisser le 409 survenir au clic (recoupe BUG-028, MISS-015 : ne pas auto-soumettre un id custom non validé).
3. **Source de vérité unique pour le mode.** Injecter `health.mockMode` dans `<GenerationModeToggle envDefault={...}>` (`MediaStudio.tsx:179`) et unifier `MockModeBadge` sur la même source. Scoper le cookie sur `/admin` (MISS-034). Effet : le toggle, le badge et le coût affiché concordent.

### Priorité 2 — Rendre les aperçus fidèles (corrige P3 ; recoupe BUG-053, MISS-021/004)
4. **Sélection de la plus grande dérivée disponible** pour l'aperçu : exposer une dérivée `md`/`lg` ou l'`originalUrl` dans la réponse `generate-visual`, et faire choisir à `MediaStudio`/`PlatformPreview` la meilleure résolution, pas le thumbnail `sm`.
5. **État d'erreur visuel dédié** dans `PlatformPreview.renderMedia` quand `previewUrl` est vide / l'asset est introuvable / l'asset fait < 1 Ko (placeholder « média indisponible » au lieu d'un cadre noir ou d'une image cassée). Couvre MISS-021 et le risque MISS-004 des stubs 10 octets.

### Priorité 3 — Accessibilité visuelle (corrige P4 ; nouvelles issues MISS-DESIGN-001/002)
6. **Relever `--cs-fg-muted`** à un ton atteignant ≥ 4.5:1 sur `bg-base` ET `bg-elevated` (cible ~`#7E7264` en clair, à recalculer ; idem en sombre). Concerne tout le texte fonctionnel 10–11px.
7. **Corriger le contraste des badges de statut petits** : `MockModeBadge` (warning, actuellement 2.46:1) et badge « Live » (success à 9px). Soit assombrir le texte, soit augmenter la taille à ≥ 14px (texte large WCAG), soit ajouter une bordure de contraste.
8. **Ajouter un lint a11y de contraste sur les `--cs-*`** dans la CI (test reproductible sur les paires token/surface) pour empêcher la régression — c'est le « harnais qui exerce le point de vue réel » appliqué au design.

### Priorité 4 — Dette de cohérence (corrige P5, P6 ; nouvelle issue MISS-DESIGN-003)
9. **Livrer les primitives atomiques promises** (`tokens.css:276` « Phase 0.6 ») : un jeu de composants `Badge`, `Pill`, `Surface`, `Button` consommant les tokens, pour éliminer les 5 ré-implémentations du « pill badge » et les valeurs hors-token (`font-size` numériques, couleurs réseau codées en dur qui ignorent le dark mode).
10. **Slot UI pour les livrables média avancés** (anticipe BUG-004/066) : prévoir, dans `MediaStudio`/`PreviewPane`, des emplacements pour vidéo composée, lecteur voix-off/musique et lien/aperçu sous-titres, afin que la réparation backend ait une cible visuelle. Corriger le wrapping multi-cue des sous-titres avant exposition (BUG-066).
11. **Resynchroniser « Régénérer »** sur le kind/format courant (MISS-017) et couvrir les formats non-vidéo de l'affordance vidéo (MISS-023).

### Points à vérifier sous tous les angles (avant clôture)
- **Contre-vérif contraste** sur les **deux thèmes** et avec les vraies polices `next/font` (le rendu serif peut modifier la perception ; mesurer sur capture).
- **Portails Radix** : vérifier que le badge « Live » et les Popover héritent bien des tokens via le fallback `:root` en dark mode forcé (régression possible).
- **Aperçu vs publication réelle** : une fois le LIVE débloqué, comparer pixel-à-pixel l'aperçu `PlatformPreview` au rendu Postiz/Instagram réel (ratios `post`=4/5 vs IG `1:1` par défaut ; troncatures de caption ; rendu hashtags) — la maquette est plausible mais sa fidélité n'est **pas prouvée** contre le vrai rendu réseau.
- **`src=''` vidéo** : reproduire le rendu d'un asset vide dans tous les chromes (story/reel/feed) pour qualifier l'état d'erreur.
