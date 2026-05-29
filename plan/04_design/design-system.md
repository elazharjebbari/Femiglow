# Design system — Content Studio v2 (cible & contrats vérifiables)

> FemiGlow Content Studio v2 / AI Engine · pipeline génération + publication
> Cible d'architecture : ADR-0007 Option 1 (convergence vers A, LangGraph moteur unique).
> Source de vérité tokens : `apps/web/src/styles/content-studio-v2/tokens.css` (réplique `apps/web/src/styles/tokens.css` pour les portails Radix).
> Statut : conception. ADR design liés : ADR-0014 (hooks + WCAG), ADR-0015 (fidélité aperçu).

---

## 1. Tokens `--cs-*` (source de vérité)

68 tokens scopés `.cs-v2-shell` (+ fallback `:root` pour les portails Radix Popover/Dialog/DropdownMenu rendus dans `<body>`). Thèmes `data-theme="light|dark"`. `prefers-reduced-motion` respecté.

Familles : surfaces (`--cs-bg-base/elevated/sunken/feature/overlay`), texte (`--cs-fg-primary/secondary/muted/on-accent`), accent (`--cs-accent/-hover/-soft/-bg`), statuts (`--cs-success/warning/danger` + `-bg`), bordures (4), ombres (3), rayons (5), typo (9 pas), espacement (10 pas), z-index (5), motion (3 durées + easing).

**Règle de scoping (à préserver)** : tout token est `--cs-*` préfixé et porté par `.cs-v2-shell` → aucune fuite dans l'admin legacy ni le site public. Toute primitive nouvelle hérite de ce scope.

---

## 2. Contraste / WCAG AA — mesures et cibles (ACT-DS-003, ADR-0014)

Mesures reproductibles (luminance relative WCAG 2.1) sur les valeurs exactes de `tokens.css`. **Texte normal** (< 18.66 px regular ou < 14 px gras) exige **≥ 4.5:1** ; **texte large** exige ≥ 3:1.

| Paire token×surface | Ratio actuel | Verdict | Usage | Cible |
|---|---|---|---|---|
| `--cs-fg-muted #A89D90` / `--cs-bg-base #FBF6F1` | **2.48:1** | FAIL AA | texte tertiaire, hints, durées 10–11 px | ≥ 4.5:1 (≈ `#7E7264`, à recalculer) |
| `--cs-fg-muted #A89D90` / `--cs-bg-elevated #FFFFFF` | **2.66:1** | FAIL AA | en-tête source picker (10 px), métadonnées modèle | ≥ 4.5:1 |
| `--cs-warning #C28846` / `--cs-warning-bg #F5E5CC` | **2.46:1** | FAIL AA | **MockModeBadge** (« actions simulées ») | ≥ 4.5:1 (assombrir texte / bordure) |
| `--cs-success #5A7560` / `--cs-success-bg #DCE5DD` | 3.93:1 | AA-large only | badge « Live » à **9 px** → traité normal → insuffisant | ≥ 4.5:1 OU taille ≥ 14 px |
| DARK `--cs-fg-muted #7A6E63` / `--cs-bg-base #1A1411` | 3.68:1 | AA-large only | texte muet sombre | ≥ 4.5:1 |
| `--cs-accent #9C2A47` / `bg-base` | 6.9:1 | OK | liens/accents | — |
| `--cs-fg-on-accent #fff` / `--cs-accent` | 7.41:1 | OK | bouton primaire | — |

**Garde-fou (ADR-0014)** : un test de contraste **bloquant en CI** itère les paires token×surface utilisées pour du texte, sur les **deux** thèmes ; échec si < seuil. Empêche toute régression et toute nouvelle palette « élégante mais illisible ». Contre-vérif obligatoire : mesure sur le **DOM rendu** avec les polices `next/font` (le serif peut altérer la perception) — `mock = mesure tokens`, `live = audit du rendu réel (axe/Lighthouse)`.

---

## 3. Contrat de distinction image / vidéo (ACT-DS-001/002, ADR-0014)

Le `kind` (`image` | `video`) est la **source unique** dont dérivent le libellé, l'icône, le badge et la durée. Le contrat est exprimé par des **hooks `data-cs-*` stables**, indépendants de la locale, ciblés par les tests.

| Élément | Hook stable | Dérivé du `kind` | Source |
|---|---|---|---|
| Déclencheur de génération | `data-cs-generate-button` | libellé `Générer une vidéo IA` / `Générer un visuel IA` ; icône `Film` / `Sparkles` | `MediaStudio.tsx:238/240/227` |
| Toggle Type de média | `data-cs-kind="image\|video"` + `role=radio` `aria-checked` | désactivation motivée hors `reel`/`story` | `MediaStudio.tsx:404-465` |
| Bande de métadonnées | `data-cs-section="media-metadata"`, `data-cs-meta-kind/-duration/-dimensions/-ratio` | label `Vidéo`/`Image`, `formatDuration`, dimensions, ratio (gcd) | `MediaStudio.tsx:246-292` |
| Badge média vidéo | `data-cs-video-badge`, `data-cs-video-duration` | `VIDÉO · m:ss` permanent ; durée fallback via `loadedmetadata` | `VideoPlayer.tsx:137-163` |

**Invariant testé** (ACT-DS-002) : pour `kind ∈ {image,video}`, `data-cs-generate-button` porte le bon libellé **et** le contexte porte le bon `data-cs-kind` ; un média vidéo rend `data-cs-video-badge`+`data-cs-video-duration`. **Les tests ciblent ces hooks, jamais un libellé localisé seul.** C'est la correction de cause racine de BUG-029/BUG-055 (le spec ciblait `/Générer un visuel IA/i` qui ne matche pas `vidéo`).

---

## 4. Vocabulaire d'états de badge de modèle (contrat visuel ; câblage = ui-ux ACT-UX-001)

Le design **définit** les états ; ui-ux **alimente** la donnée (même résolution de clé que le moteur, T-005/T-202). Le badge ne ment jamais sur la capacité réelle de générer.

| État | Glyphe / couleur | Sémantique | Contraste cible |
|---|---|---|---|
| **Live** | `●` `--cs-success` | clé résolue par le **même chemin** que le générateur ET provider joignable | ≥ 4.5:1 (cf. §2, taille ≥ 14 px) |
| **Cache** | `◐` `--cs-fg-secondary` | issu d'un cache de discovery encore valide | ≥ 4.5:1 |
| **Statique** | `◯` `--cs-fg-muted` (corrigé) | fallback statique (discovery indisponible) | ≥ 4.5:1 |
| **Indisponible** | grisé, `aria-disabled` | aucun credential generation-ready → **non sélectionnable**, jamais auto-sélectionné | n/a (désactivé) |

**Règle anti-tromperie (ADR-0014/P4)** : `materialiseDiscoveredModel` ne force plus `source:'live'`. Un modèle non générable n'affiche jamais `Live` et est grisé `Indisponible`.

---

## 5. Contrat de fidélité d'aperçu (ACT-DS-004, ADR-0015)

- **Plus grande dérivée disponible** : `PlatformPreview.renderMedia` (`media/PlatformPreview.tsx:281`) et `MediaStudio.tsx:127` préfèrent `original`/`lg`/`md` ; `sm` n'est jamais l'aperçu de publication (corrige BUG-053).
- **État d'erreur visuel dédié** : `previewUrl` vide / asset introuvable / < 1 ko → placeholder « média indisponible », jamais cadre noir (`<video src=''>`, MISS-021) ni image cassée (stub 10 octets, MISS-004).

---

## 6. Slots média avancés (cible convergence A — ACT-DS-005, ADR-0015)

Emplacements **conditionnels** (rendus ssi l'asset existe dans `GenerationResult` complet, T-104) :
- **Vidéo composée** (après compose/transcode) — réutilise `VideoPlayer` + badge.
- **Lecteur voix-off / musique** — contrôles play/pause/mute, durée, `aria-label`.
- **Aperçu sous-titres** — rendu multi-cue avec **wrapping** (corrige BUG-066 : SRT tronqué ~117 car. sans wrapping).

Anti-tromperie : aucun slot vide « à venir ». Si l'asset manque, le slot est absent (pas une promesse).

---

## 7. Primitives atomiques (ACT-DS-006 — dette `tokens.css:276`)

Livrer les « full primitives » jamais sorties : `Badge`/`Pill` (remplace les 5 ré-implémentations du pill badge : ModelPicker, MediaStudio, VideoPlayer, MockModeBadge, PlatformPreview), `Surface`, `Button`. La primitive `Badge` applique **automatiquement** le seuil de contraste AA par variante.

Encapsuler les valeurs hors-token réseau (`rgba(0,0,0,0.55)`, `#1877F2`/`#4267B2`, `font-size:10/11/13`) dans des tokens `--cs-brand-*` **thémables** (adaptation dark mode). Rationaliser les couleurs « sectorial legacy » (`--cs-clay/sage/saffron/violet`).

---

## 8. Conventions de hook (pour tout nouveau composant)

1. Tout contrôle structurant porte un `data-cs-*` stable et localisable-agnostique.
2. Tout élément dépendant du `kind`/format dérive d'une **source unique** ; pas de logique dupliquée.
3. Tout texte fonctionnel utilise un token de couleur **vérifié AA** (jamais une valeur en dur).
4. Tout état (chargement/erreur/succès) est **explicite et visible** (cf. `ui-states.md`) — aucun faux succès silencieux.
