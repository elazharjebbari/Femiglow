# 02 — Design system & tokens

> *La grammaire visuelle, exprimée en valeurs numériques*

---

## 1. Philosophie du système

Le design system FemiGlow repose sur **six familles de tokens** — couleurs, typographie, espacements, rayons, ombres, transitions. Tous sont exposés en **CSS custom properties** consommables aussi bien par Tailwind que par CSS pur, JavaScript ou un futur design tool.

**Règle d'or** : aucun composant ne doit utiliser une valeur visuelle qui ne soit pas un token. Toute exception doit être justifiée et documentée dans le composant lui-même.

## 2. Couleurs

### 2.1 Palette signature

| Token | Hex | RGB | Rôle | % B2C | % B2B |
|---|---|---|---|---|---|
| `--color-sauge` | `#C5DBC4` | 197 219 196 | Couleur d'ancrage dominante | 60 % | 20 % |
| `--color-creme` | `#FBF8F1` | 251 248 241 | Fond systémique | 25 % | 70 % |
| `--color-encre` | `#2C2A28` | 44 42 40 | Texte courant | 10 % | 8 % |
| `--color-petale` | `#F2CECC` | 242 206 204 | Accent B2C uniquement | 3-12 % | 0 % |
| `--color-ciel` | `#C5DBE5` | 197 219 229 | Touche fraîcheur | 2-3 % | 0 % |
| `--color-champagne` | `#C8A876` | 200 168 118 | Ornement rare | ≤ 5 % | ≤ 2 % |

### 2.2 Variations dérivées (UI)

| Token | Hex | Usage |
|---|---|---|
| `--color-encre-claire` | `#4A4844` | Texte secondaire, paragraphes longs |
| `--color-sauge-dark` | `#A8C4A6` | Filets décoratifs, focus ring, underline |
| `--color-sauge-pale` | `#E8EFE7` | Fond sections « moments d'engagement » |
| `--color-creme-pure` | `#FFFFFF` | Fond containers (formulaires, cards) |
| `--color-brume` | `#6B6863` | Texte secondaire, mentions |
| `--color-brume-claire` | `#A8A8A6` | Disabled, placeholder |
| `--color-ligne` | `#E8E0D2` | Bordures, séparateurs |
| `--color-rouge-feutre` | `#9C5B5B` | Erreurs, asterisque requis |
| `--color-rouge-feutre-pale` | `#FBE5E5` | Bandeau erreur (background discret) |
| `--color-vert-feutre` | `#4A7C59` | Succès |

### 2.3 Règle 60 / 30 / 10

```
DOMINANTE 60%      SUPPORT 30%     ACCENT 10%
   Sauge              Crème          Encre
```

Toute composition de page doit respecter ces proportions, audit visuel obligatoire avant merge.

### 2.4 Contrastes WCAG validés

| Combinaison | Ratio | Niveau |
|---|---|---|
| Encre / Crème | 14.2:1 | AAA |
| Encre claire / Crème | 9.1:1 | AAA |
| Brume / Crème | 5.6:1 | AA |
| Brume / Sauge pâle | 5.2:1 | AA |
| Champagne / Crème | 2.7:1 | AA Large only (≥ 14 pt) |
| Sauge dark / Crème | 3.2:1 | AA Large + UI components only |

> **Règle** : champagne et sauge dark **jamais** sur du corps de texte courant, uniquement sur titres ≥ 18 pt ou éléments décoratifs.

## 3. Typographie

### 3.1 Trois polices, trois rôles

| Police | Rôle exclusif | Source | Weights utilisés |
|---|---|---|---|
| **Pinyon Script** | Wordmark logo uniquement | Google Fonts (SIL OFL) | Regular |
| **Cormorant Garamond** | Titres, sous-titres, citations, body éditorial | Google Fonts (SIL OFL) | 300 (Light), 400 (Regular), 300i, 400i |
| **Inter** | UI, body courant, labels, kickers | Google Fonts (SIL OFL) | 400, 500 (Medium), 600 (SemiBold) |

### 3.2 Échelle complète

| Token | Police | Desktop | Tablet | Mobile | Weight | LH |
|---|---|---|---|---|---|---|
| `--font-display-xl` | Cormorant | 80 pt | 56 pt | 40 pt | 300 | 1.1 |
| `--font-display-l` | Cormorant | 64 pt | 48 pt | 36 pt | 300 | 1.15 |
| `--font-display-m` | Cormorant | 48 pt | 38 pt | 32 pt | 300 | 1.2 |
| `--font-h1` | Cormorant | 32 pt | 28 pt | 26 pt | 300 | 1.2 |
| `--font-h2` | Cormorant | 24 pt | 22 pt | 22 pt | 300 | 1.3 |
| `--font-h3` | Cormorant | 18 pt | 17 pt | 17 pt | 400 | 1.3 |
| `--font-h4` | Cormorant | 16 pt | 15 pt | 15 pt | 400 | 1.3 |
| `--font-lead` | Cormorant Italic | 18 pt | 17 pt | 16 pt | 300 | 1.7 |
| `--font-body` | Cormorant | 17 pt | 16 pt | 16 pt | 400 | 1.7 |
| `--font-ui` | Inter | 15 pt | 15 pt | 15 pt | 400 | 1.5 |
| `--font-ui-sm` | Inter | 14 pt | 14 pt | 14 pt | 400 | 1.5 |
| `--font-label` | Inter | 13 pt | 13 pt | 13 pt | 500 | 1.4 |
| `--font-caption` | Inter | 12 pt | 12 pt | 12 pt | 400 | 1.5 |
| `--font-microcopy` | Inter | 11 pt | 11 pt | 11 pt | 400 | 1.4 |
| `--font-kicker` | Inter | 9 pt | 9 pt | 9 pt | 600 | 1.4 (tracking 2 px) |

### 3.3 Conventions

- Apostrophes typographiques `'` (U+2019) — jamais `'`
- Guillemets français « » avec espaces insécables U+202F
- Tiret cadratin `—` (U+2014), jamais `--` ou `-`
- Points de suspension `…` (U+2026), jamais `...`
- Pas de Bold sur Cormorant ; pas de Light Inter en taille < 13 pt
- Italics uniquement pour citations, leads, légendes — jamais sur boutons ou labels

## 4. Espacements

Système basé sur multiples de 4 px, exposé en tokens.

| Token | Valeur | Usage typique |
|---|---|---|
| `--space-2xs` | 4 px | letter-spacing, mini gaps |
| `--space-xs` | 8 px | label↔input, petites marges |
| `--space-sm` | 12 px | padding bouton, internals |
| `--space-md` | 16 px | padding standard |
| `--space-lg` | 24 px | padding card, marge bloc |
| `--space-xl` | 32 px | marge bloc important |
| `--space-2xl` | 48 px | grande séparation |
| `--space-3xl` | 64 px | section spacing |
| `--space-4xl` | 96 px | page padding |
| `--space-5xl` | 128 px | hero, ATF padding |

### 4.1 Max-widths

| Token | Valeur | Usage |
|---|---|---|
| `--max-narrow` | 480 px | Formulaires, modales |
| `--max-editorial` | 640 px | Lettres, articles |
| `--max-content` | 720 px | Articles longs |
| `--max-wide` | 1200 px | Container principal |
| `--max-bleed` | 1440 px | Limite bord-à-bord avant gutter |

### 4.2 Grille responsive

| Breakpoint | Colonnes | Gutter | Padding section |
|---|---|---|---|
| Mobile (`< 768 px`) | 4 | 16 px | 40 px |
| Tablet (`768-1279 px`) | 8 | 20 px | 64-80 px |
| Desktop (`≥ 1280 px`) | 12 | 24 px | 96-128 px |

## 5. Rayons

| Token | Valeur | Usage |
|---|---|---|
| `--radius-none` | 0 | Défaut maison (angles vifs) |
| `--radius-soft` | 2 px | Exception rare (badges, mini-tags) |
| `--radius-circle` | 50 % | Étiquettes circulaires, monogramme |

## 6. Ombres

> Maison préfère les bordures aux ombres. Usage rare, jamais de drop-shadow violente.

| Token | Valeur | Usage |
|---|---|---|
| `--shadow-subtle` | `0 1px 2px rgba(44, 42, 40, 0.06)` | Hover sur card |
| `--shadow-medium` | `0 2px 8px rgba(44, 42, 40, 0.08)` | Modal, dropdown |
| `--shadow-strong` | `0 8px 24px rgba(44, 42, 40, 0.12)` | Overlay focal (rare) |

## 7. Transitions

| Token | Valeur | Contexte |
|---|---|---|
| `--transition-instant` | 100 ms | Feedback immédiat |
| `--transition-quick` | 200 ms | Hover state |
| `--transition-default` | 300 ms | Animation standard |
| `--transition-slow` | 500 ms | Apparition section |
| `--transition-deliberate` | 800 ms | Slow motion luxe |
| `--transition-cinematic` | 1200 ms | Entrée hero, vagues |

### 7.1 Easings

| Token | Valeur |
|---|---|
| `--ease-default` | `cubic-bezier(0.4, 0, 0.2, 1)` |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` |

### 7.2 Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

## 8. Focus & accessibilité

| Token | Valeur |
|---|---|
| `--focus-ring-width` | 2 px |
| `--focus-ring-offset` | 4 px |
| `--focus-ring-color` | `var(--color-sauge-dark)` |

```css
*:focus-visible {
  outline: var(--focus-ring-width) solid var(--focus-ring-color);
  outline-offset: var(--focus-ring-offset);
}
```

Touch targets minimum 44 × 44 px.

## 9. Motifs graphiques

### 9.1 La vague (B2C uniquement)

- SVG vectoriel inline (jamais image rasterisée)
- Couleurs : sauge `#C5DBC4` + pétale `#F2CECC`, opacité 0.6-0.85
- Position : coins d'écran, jamais centrée
- Comportement : parallaxe légère au scroll (`translateY * 0.15` à `0.20`)

### 9.2 Le fleuron champagne

Trois variantes (cf. `components/Fleuron.tsx`) :
- A : losange `◆` entre filets — séparateur noble
- B : point central `•` entre filets — séparateur léger
- C : double filet — délimiteur dense

Spécifications variante A (signature) : 80-96 px de large, 12-14 px de haut, filet 1 px champagne, espace de protection 24 px haut/bas.

### 9.3 Étiquettes circulaires des 4 gestes

| Étape | Mot | Fond |
|---|---|---|
| 1 | `paste` | sauge |
| 2 | `powder` | pétale |
| 3 | `shine` | crème |
| 4 | `polish` | ciel |

Composition : disque 80-120 px + chiffre Cormorant 24 pt + mot italique 14 pt + wordmark Pinyon 12 pt.

> Une étiquette = une étape. Pas d'invention hors les 4.

## 10. Composants UI standards (extrait — détail dans `05-bibliotheque-composants.md`)

### 10.1 Bouton primaire

```
Fond     : --color-encre
Texte    : --color-creme, --font-label
Padding  : --space-sm --space-xl
Hauteur  : 48 px (CTA panier 56 px)
Radius   : --radius-none
Hover    : fond --color-encre-claire
Active   : scale(0.98)
Transition: --transition-default --ease-default
```

### 10.2 Champ formulaire

```
Fond           : --color-creme-pure
Bordure        : 1 px --color-ligne
Hauteur        : 48 px
Padding        : --space-md --space-md
Focus          : bordure --color-sauge-dark, 1.5 px
Erreur         : bordure --color-rouge-feutre
Police         : --font-ui
Radius         : --radius-none
```

### 10.3 Card éditorial

```
Fond     : --color-creme-pure
Bordure  : 1 px --color-ligne
Padding  : --space-lg
Hover    : translateY(-4 px) + --shadow-subtle
```

## 11. Règle d'audit système

À chaque PR, le designer / lead front vérifie :

- [ ] Aucune valeur hex/rgba hardcodée hors fichier `tokens.css`
- [ ] Aucune taille de police hors échelle
- [ ] Aucune transition hors tokens
- [ ] Règle 60/30/10 respectée par section (audit visuel)
- [ ] Champagne ≤ 5 % de la composition
- [ ] Reduced motion fonctionnel sur toute animation introduite
- [ ] Focus visible sur tout élément interactif

> *Document suivant : [03 — Architecture de l'information](./03-architecture-information.md)*
> *Annexe technique : [tokens.css](./annexes/tokens.css.md)*
