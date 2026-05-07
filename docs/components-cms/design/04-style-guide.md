# D4 — Style guide admin

## Cadrage

L'admin Components-CMS **réutilise** les tokens FemiGlow déjà
définis dans `apps/web/tailwind.config.ts` et le fichier de variables
CSS racine. **On n'invente aucun token.** Quand un usage interne
nécessite une nuance non couverte par le design system public, on
choisit un token existant qui s'en approche, on documente le mapping
ici, et on fait suivre une PR design system si ça revient deux fois.

Cf. principes P1 (calme par défaut) et P3 (statut lisible) pour la
philosophie sous-jacente.

## Palette

### Tokens utilisés

> Source de vérité : `tailwind.config.ts` + `globals.css`.

| Rôle dans l'admin | Token | Usage |
|---|---|---|
| Fond de page | `creme` | `body`, panneaux principaux |
| Fond de carte/zone élevée | `creme-warm` | Cartes de champ, accordéons ouverts |
| Texte principal | `encre` | Body, titres |
| Texte secondaire | `encre-soft` | Descriptions, help text, dates relatives |
| Bordure neutre | `encre-soft` (à 30 % opacité via `border-encre-soft/30`) | Séparateurs, contour des inputs |
| Surbrillance / focus | `encre` (anneau) | Bague de focus, sélection active |
| Statut « publié » | `sauge-soft` (fond), `encre` (texte) | Badge `published` |
| Statut « brouillon » | `champagne-soft` (fond), `encre` (texte) | Badge `draft` |
| Statut « programmé » | `ciel-soft` (fond), `encre` (texte) | Badge `scheduled` |
| Statut « erreur / conflit » | `petale-soft` (fond), `petale-dark` (texte) | Badge `conflict`, messages d'erreur |
| Confirmation / succès | `sauge-dark` (texte), `sauge-soft` (fond) | Check inline, toasts succès |
| CTA primaire admin | `encre` (fond), `creme` (texte) | Bouton « Publier » |
| CTA secondaire admin | `champagne-soft` (fond), `encre` (texte) | Bouton « Aperçu » |
| CTA destructif (rare) | `petale-dark` (fond), `creme` (texte) | « Annuler les brouillons » dans modale confirmée |
| Lien | `encre` souligné `underline-offset-4` | Liens textuels |

### Règles d'application

1. **Pas de couleur saturée pleine** au repos. Les CTA destructifs en
   `petale-dark` n'apparaissent **qu'à l'intérieur** d'une modale de
   confirmation (le reste du temps : variant *ghost*).
2. **Contraste** ≥ 4.5:1 (cf. D5). Toutes les paires ci-dessus
   respectent le seuil ; ne pas dévier sans test axe-core.
3. **Hover** : assombrissement de fond (`bg-X/90`) ou changement de
   bordure, pas de changement de teinte.
4. **Focus visible** : anneau `outline-2 outline-encre outline-offset-2`,
   **jamais** supprimé (`outline-none` sans `focus-visible:ring`).

### Mapping vers la lib FemiGlow publique

L'admin **n'utilise pas** les composants de marque (display-xl,
script). Tout reste dans le sub-set sobre du design system. Les tokens
déclinés en `dark` (`-dark`) et `*` non listés ci-dessus sont
**réservés au front public**.

## Typographie

### Familles

| Usage | Font-family | Stack tailwind |
|---|---|---|
| UI body | Inter (`var(--font-inter)`) | `font-body` |
| Code / clés techniques | system monospace | `font-mono` (Tailwind built-in) |
| (jamais) display serif | — | **interdit** en admin |
| (jamais) script Pinyon | — | **interdit** en admin |

### Échelle (admin uniquement)

L'admin utilise une échelle plus petite et plus dense que le site
public.

| Usage | Taille | Line-height | Token Tailwind |
|---|---|---|---|
| H1 d'écran (« home-hero ») | 24 px | 1.25 | `text-2xl font-medium` |
| H2 (titre d'onglet) | 18 px | 1.3 | `text-lg font-medium` |
| H3 (label de groupe d'accordéon) | 14 px | 1.4 | `text-sm font-semibold uppercase tracking-wide` |
| Label de champ | 14 px | 1.4 | `text-sm font-medium` |
| Body / input | 14 px | 1.5 | `text-sm` |
| Description / help text | 12 px | 1.5 | `text-xs text-encre-soft` |
| Compteur de caractères | 12 px | 1.4 | `text-xs tabular-nums` |
| Clé technique (mono) | 12 px | 1.4 | `text-xs font-mono text-encre-soft` |
| Badge de statut | 11 px | 1.4 | `text-[11px] uppercase tracking-wider` |

### Règles d'usage

- **Pas de tracking exotique** sauf badges et kickers. Le `tracking-wide`
  est limité à ces deux usages.
- **`tabular-nums`** systématique sur compteurs et durées (versions,
  dates).
- **Casse** : titres en *casse phrase* (« Le rituel du soir »), badges
  en **majuscules**, monospace en **minuscules**.
- **Nombre maximal de polices à charger pour l'admin** : 1 (Inter).
  La monospace est fournie par le système (`ui-monospace`).

## Spacing

### Échelle

L'admin se cale strictement sur **4 / 8 / 12 / 16 / 24 / 32 / 48** px
(soit `space-1`, `space-2`, `space-3`, `space-4`, `space-6`, `space-8`,
`space-12` en Tailwind).

**Aucune autre valeur** acceptée. Pas de `7px`, pas de `13px`. Si un
écart paraît nécessaire, on choisit la valeur supérieure de l'échelle.

### Patrons

| Espace | Token | Usage |
|---|---|---|
| 4 px (`space-1`) | gap entre une icône et son texte |
| 8 px (`space-2`) | padding interne d'un badge, gap horizontal entre bouton+icône |
| 12 px (`space-3`) | padding interne d'un input, gap entre label et editor |
| 16 px (`space-4`) | padding standard d'une carte de champ |
| 24 px (`space-6`) | gap entre deux champs successifs, padding modal |
| 32 px (`space-8`) | gap entre groupes d'accordéon |
| 48 px (`space-12`) | hauteur d'un header de page sticky |

### Règles

- Le **rythme vertical** dominant est 24 px entre champs.
- Les containers (`<main>`) ont un `max-width` de **1240 px** desktop
  (rail 240 + content 1000), centrés.
- En mobile, padding horizontal `space-4` (16 px), aucun max-width.

## États

Chaque composant interactif (input, bouton, switch, accordéon, item de
liste) traverse les **états standard** suivants. Les classes ci-dessous
sont des exemples ; F1 fixera les tokens via `cva` ou équivalent.

### Inputs (text, textarea, select)

| État | Style |
|---|---|
| Repos | `bg-creme border border-encre-soft/30 text-encre` |
| Hover | `border-encre-soft/60` |
| Focus-visible | `outline-2 outline-encre outline-offset-2 border-encre` |
| Disabled | `opacity-60 cursor-not-allowed` |
| Dirty | bordure gauche `border-l-2 border-l-champagne` (rappel discret) |
| Saving | overlay `bg-creme-warm/40` + `<SaveIndicator>` global |
| Saved (transitoire) | check `sauge-dark` à droite, fade-out 1 s |
| Error | `border-petale-dark text-petale-dark`, message inline en dessous |

### Boutons

| État | Primaire | Secondaire | Destructif |
|---|---|---|---|
| Repos | `bg-encre text-creme` | `bg-champagne-soft text-encre` | `bg-petale-dark text-creme` |
| Hover | `bg-encre/90` | `bg-champagne` | `bg-petale-dark/90` |
| Focus | anneau `encre` | anneau `encre` | anneau `petale-dark` |
| Disabled | `opacity-50` | idem | idem |
| Loading | spinner gauche, label inchangé |

### Badges de statut

Cf. D3 § Status badges. Pas de hover (purement informatifs). Le
**tooltip** ouvre au focus clavier (cf. D5).

### Accordéons

| État | Style |
|---|---|
| Fermé | titre `H3` + chevron `▸`, fond transparent |
| Ouvert | chevron `▾`, séparateur fin `border-b border-encre-soft/20` |
| Hover header | `bg-creme-warm/60` |
| Focus header | anneau focus standard |

### Modales

| Élément | Style |
|---|---|
| Overlay | `bg-encre/40` (assombrissement contenu derrière) |
| Conteneur | `bg-creme rounded-none shadow-md max-w-[640px]` |
| Header | bordure basse `border-b border-encre-soft/20`, padding 24 |
| Body | padding 24, scroll interne si `> 70vh` |
| Footer | bordure haute, actions à droite, `Annuler` à gauche du primaire |

> **Remarque borderless** : le projet FemiGlow déclare `borderRadius.none = 0`.
> L'admin **respecte** cette ligne — pas de coins arrondis, sauf badges
> (qui sont des pilules `rounded-full` autorisées).

## Iconographie

- Source unique : **Lucide** (déjà utilisée dans le repo).
- Tailles : `16 / 18 / 20 / 24` px. Pas d'autre.
- Icônes décoratives : `aria-hidden="true"`.
- Icônes interactives : doivent avoir un **label visible adjacent**
  ou un `aria-label` explicite (D5).

### Glossaire d'icônes admin

| Action | Icône Lucide |
|---|---|
| Sauvegarder (interne) | `cloud-check` |
| Brouillon | `circle-half` |
| Publié | `circle-check` |
| Programmé | `clock` |
| Conflit | `triangle-alert` |
| Restaurer | `rotate-ccw` |
| Historique | `history` |
| Diff | `git-compare` |
| Drag (réorder) | `grip-vertical` |
| Plus | `plus` |
| Supprimer | `x` |
| Aperçu | `eye` |
| Plier accordéon | `chevron-right` (rotate 90 ouvert) |

## Micro-interactions

### Principes

- **Durée par défaut** : 200 ms (`duration-fast` du config Tailwind).
- **Easing** : `ease-out-soft` (`cubic-bezier(0.22, 1, 0.36, 1)`).
- **Aucune** animation > 300 ms en admin (durées `slow` et
  `cinematic` réservées au site public).
- Respect de `prefers-reduced-motion` (D5) : toutes les animations
  passent à `duration-0` sauf le micro-feedback de save (qui devient
  un changement d'état immédiat).

### Catalogue

| Interaction | Détail |
|---|---|
| Save indicator pulse | opacity 0.6 → 1 → 0.6 sur 1.4 s, **2 cycles max** |
| Check de save (inline) | scale 0.9 → 1 + opacity 0 → 1 sur 200 ms, fade-out après 1 s |
| Ouverture accordéon | height auto via `grid-template-rows: 0fr → 1fr`, 200 ms |
| Modale | overlay opacity 0 → 1 (200 ms) + conteneur translateY(8px) → 0 (200 ms) |
| Toast erreur | slide-in droite 240 px → 0 (240 ms) |
| Status badge change | fond bg transition 200 ms (pas de pulse) |
| Focus ring | aucune transition (instantané) |
| Drag list item | `transform translateY` pendant le drag, snap 150 ms à la fin |

### Anti-patrons

- ❌ Bounce, elastic, overshoot.
- ❌ Animations en boucle infinie (sauf indicator pulse, et seulement
  pendant un save actif).
- ❌ Animation au scroll.
- ❌ Spinner full-page (cf. P5).

## Layout

### Grille

```
┌──────┬─────────────────────────────────────────────┐
│ Rail │  Content                                    │
│ 240  │  fluid up to 1000px, centered             │
└──────┴─────────────────────────────────────────────┘
   16   24                                  16   <- gutter en px
```

- Header **sticky** top, hauteur 56 px (`h-14`), fond `creme/95`
  blur léger `backdrop-blur-sm`.
- Footer absent (l'admin n'a pas de footer).

### Breakpoints

| Nom | Largeur |
|---|---|
| `sm` | ≥ 640 px |
| `md` | ≥ 768 px |
| `lg` | ≥ 1024 px |
| `xl` | ≥ 1280 px |

L'admin **cible `lg`** comme expérience principale. En dessous de `md`,
le rail devient drawer (cf. D2).

## Tokens composites

Pour rester DRY, on définit ces classes composées (à introduire en
F1 / F3 sous forme de helpers `cva`).

| Nom | Composition |
|---|---|
| `field-card` | `bg-creme-warm/60 p-4 border-b border-encre-soft/20` |
| `field-card-dirty` | `field-card border-l-2 border-l-champagne` |
| `field-card-error` | `field-card border-l-2 border-l-petale-dark` |
| `chip` | `inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] uppercase tracking-wider` |
| `kbd` | `inline-flex items-center px-1.5 py-0.5 border border-encre-soft/40 text-xs font-mono text-encre-soft` |
| `divider-soft` | `border-t border-encre-soft/20` |

## Checklist d'auto-revue

Avant de merger un PR qui touche le style admin :

- [ ] Aucun token couleur inventé (grep `#` hex hors variables CSS).
- [ ] Aucune valeur d'espacement hors échelle.
- [ ] Aucun `borderRadius` autre que `0` ou `full` (badges).
- [ ] Contraste vérifié sur tous les textes (axe-core).
- [ ] `prefers-reduced-motion` respecté.
- [ ] Aucune animation > 300 ms.
- [ ] `font-display` et `font-script` non utilisés.

## Croisements

| Choix | Source / contrainte |
|---|---|
| Tokens FemiGlow réutilisés | A1, P1 |
| `borderRadius: none` | tailwind.config.ts |
| Échelle 4/8/12/16/24/32 | brief D4 |
| Aucune animation longue | P1 |
| Statut couleurs | D3 |
| Lucide unique source d'icônes | F1 |
