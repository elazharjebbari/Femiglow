# Proposition n°1 — *Le Rail lent*

> **Philosophie :** un header éditorial classique, posé sur la page comme une
> ligne de typographie, qui se rétracte calmement au scroll. Référence
> implicite : Aesop, Cereal Magazine, & Daughter. La marque parle à voix basse,
> mais sans se cacher.

---

## 1. Concept en une phrase

Un rail horizontal mince, fond crème, **logo Pinyon Script à gauche**, **5 liens
Inter uppercase espacés à droite**, **icône panier discret à l'extrême droite**.
Au scroll, il rétrécit en hauteur sans changer de forme. Au mobile, il devient un
sceau + un drawer latéral droit.

## 2. Charte appliquée

| Élément | Token / valeur |
|---|---|
| Fond | `bg-creme` (warm off-white) |
| Texte liens | `text-encre` à 80 % d'opacité au repos, 100 % au hover |
| Hauteur header | 96 px desktop / 64 px scrollé / 64 px mobile |
| Police logo | `font-script` (Pinyon Script), 28 px desktop |
| Police liens | `font-body` (Inter), 12 px, `tracking-[0.2em]`, uppercase |
| Police drawer mobile | `font-display` (Cormorant), 32 px |
| Bordure basse au scroll | 1 px solid `encre/10` |
| Panier | icône SVG fil 1,5 px + badge compteur si > 0 (`bg-encre text-creme` cercle 18 px) |

## 3. Desktop — anatomie

```
┌──────────────────────────────────────────────────────────────────────┐
│  FemiGlow            RITUEL  KIT  JOURNAL  MAISON  CONTACT     ⌶ 2  │
└──────────────────────────────────────────────────────────────────────┘
                                                          ▲
                                          panier (badge si > 0)
```

- **Largeur** : `Container width="page"` (max-width 1280, padding `px-6 lg:px-12`)
- **Hauteur au repos** : 96 px. Le logo respire en haut.
- **Hauteur au scroll** (>40 px) : 64 px, transition 240 ms ease-out, fond
  `creme/95` avec `backdrop-blur-sm`, bordure inférieure 1 px `encre/10`.
- **Distribution** : flexbox 3 zones — logo (gauche), nav (centre-droite,
  `gap-8`), panier (droite, `ml-auto pl-8`).
- **Lien actif** (page courante) : underline solide `encre`, 1 px, `mt-1`,
  trait sous le mot uniquement (pas tout le bloc).
- **Lien hover** : opacité passe de 0.8 à 1, sans soulignement supplémentaire.
- **Lien focus** (clavier) : `outline-2 outline-offset-[3px] outline-encre`.

## 4. Mobile — anatomie

```
┌─────────────────────────────────────┐
│  FemiGlow                ⌶  ☰      │  64 px
└─────────────────────────────────────┘
```

- Hauteur fixe 64 px, fond `creme`, bordure inférieure 1 px `encre/10` permanente.
- Logo Pinyon 22 px à gauche.
- Panier icône à droite (juste avant le burger), badge compteur si > 0.
- Burger : icône custom 24 px (deux traits 1,5 px, écart 6 px — pas le burger
  Hamburger trois-traits banal).
- **Au tap sur burger** : drawer latéral qui glisse de droite à gauche, occupe
  85 % de la largeur (max 380 px), fond `creme`, ombre douce
  `shadow-[-12px_0_32px_rgba(0,0,0,0.06)]`.

### Drawer mobile (state ouvert)

```
                           ┌────────────────┐
                           │              ✕ │
                           │                │
                           │   Rituel       │
                           │   Kit          │
                           │   Journal      │
                           │   Maison       │
                           │   Contact      │
                           │                │
                           │   ─────────    │
                           │   Panier (2)   │
                           │                │
                           │  Casablanca,   │
                           │  saison du     │
                           │  printemps.    │
                           └────────────────┘
```

- Liens en `font-display` (Cormorant) 32 px, regular, espacés 24 px verticalement.
- Pas d'uppercase ici — la lecture est lente, intime, comme un sommaire.
- Footer drawer : ligne fine, lien panier (compteur entre parenthèses), puis
  une signature « *Casablanca, saison du printemps.* » en `font-script` 14 px.
- **Fermeture** : ✕ en haut à droite, ou tap sur l'overlay (`bg-encre/30
  backdrop-blur-sm`), ou swipe vers la droite.

## 5. Animations

| Moment | Détail |
|---|---|
| Mount | Header fade-in 320 ms ease-out, logo et liens en cascade `stagger 60ms` |
| Scroll > 40 px | Hauteur 96 → 64 px, 240 ms ease-out, bordure apparaît |
| Lien hover | opacité 0.8 → 1.0, 160 ms ease-in-out |
| Active page | underline déjà présent, pas d'animation |
| Drawer ouverture | Translation X 100 % → 0, 320 ms ease-out, overlay fade 240 ms |
| Drawer fermeture | Symétrique, 240 ms |
| `prefers-reduced-motion` | toutes les durées passent à 0 ; le header se contente de switcher l'état |

## 6. Accessibilité

- `<header role="banner">`, `<nav aria-label="Navigation principale">`.
- Drawer : `<dialog>` natif avec `aria-labelledby`, focus trap, `Esc` ferme,
  retour focus sur le burger.
- Lien actif : `aria-current="page"`.
- Skip link déjà présent (`SkipLink.tsx`) → cible `#main`.
- Contraste : `encre` sur `creme` = 12.6:1 (WCAG AAA).
- Cible tactile burger / panier : 44×44 px minimum.

## 7. Cohérence avec la marque

- **Forte** sur le minimalisme, l'esprit éditorial, la voix posée.
- Le logo Pinyon pose la signature, les liens Inter posent la rigueur.
- L'absence de fioritures dialogue avec la palette earthen.
- Risque : l'ensemble peut paraître trop sobre, presque administratif, si la
  page derrière n'a pas un héros visuellement riche.

## 8. Forces / faiblesses synthétiques

**Forces**
- Lisibilité immédiate, zéro friction cognitive.
- Implémentable rapidement (un seul `<header>`, deux états sticky).
- Performance excellente : aucune image, aucun JS lourd.
- Compatible WCAG AAA sans effort.

**Faiblesses**
- Peu différenciant — beaucoup de marques font ça.
- Pas d'effet « waouh » qui mémorise la marque.
- Sur mobile, le burger reste un burger — la voix lente ne s'exprime pas.
- Pas de contexte saisonnier ni de hiérarchie visuelle entre les sections.
