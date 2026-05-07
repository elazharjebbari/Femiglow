# Proposition n°2 — *Le Sceau*

> **Philosophie :** la marque ne montre pas ses entrées. Au repos, on ne voit
> que le sceau « FemiGlow » et un mot discret — *Sommaire* — qui ouvre un
> sommaire plein-écran calligraphique. Référence implicite : Maison Margiela
> web, Augustinus Bader, certaines galeries d'art. Acte d'élégance radicale.

---

## 1. Concept en une phrase

Pas de menu visible. Juste **le sceau Pinyon Script à gauche** et **un mot
*Sommaire* à droite**. Au clic, **un overlay plein-écran** crème glisse depuis
le haut, révélant les pages en très grand Cormorant italique, comme une page
de garde de magazine.

## 2. Charte appliquée

| Élément | Token / valeur |
|---|---|
| Header au repos | hauteur 64 px, fond transparent (sur fond `creme` de la page) |
| Sceau logo | `font-script` (Pinyon), 24 px, `text-encre` |
| Mot trigger | `font-body` (Inter), 12 px, `tracking-[0.18em]`, uppercase, soulignement 1 px |
| Overlay fond | `bg-creme` plein, opacité 1 (pas de transparence — c'est une page) |
| Overlay liens | `font-display` (Cormorant), italique, 56 px desktop / 36 px mobile |
| Overlay sous-texte | `font-script` (Pinyon), 18 px, signature de fin |
| Texte secondaire | `text-encre/60` |
| Trace hover lien | underline SVG dessiné à la main (animation `stroke-dashoffset`) |

## 3. Desktop — anatomie

### State 1 — repos

```
┌──────────────────────────────────────────────────────────────────────┐
│  FemiGlow                                              SOMMAIRE  ⌶ 2 │
└──────────────────────────────────────────────────────────────────────┘
        (sceau)                                          (trigger)  (panier)
```

- Header sans fond, sans bordure, sans ombre. Il *flotte* sur la page.
- À gauche : sceau Pinyon (24 px), c'est un lien vers `/`.
- À droite : *SOMMAIRE* + icône panier discrète. Rien d'autre.
- Hauteur 64 px, padding `px-6 lg:px-12`.
- Au scroll : le header reste visible, fond passe à `creme/85
  backdrop-blur-sm`, bordure 1 px `encre/10`.

### State 2 — overlay ouvert

```
┌──────────────────────────────────────────────────────────────────────┐
│  FemiGlow                                              FERMER    ⌶  │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                                                                      │
│        Le rituel                                                     │
│        Le kit                                                        │
│        Le journal                                                    │
│        La maison                                                     │
│        Contact                                                       │
│                                                                      │
│                                                                      │
│                                       Casablanca, saison du printemps│
└──────────────────────────────────────────────────────────────────────┘
```

- L'overlay occupe **100 % du viewport**, fond `creme` opaque, le header
  reste visible en haut (mais le mot *SOMMAIRE* devient *FERMER*).
- Liens disposés **à gauche**, avec une marge de tiers (`ml-[16vw]`),
  empilés verticalement, espacés `mb-6`.
- Chaque lien est en **Cormorant italique 56 px**, regular weight, alignés
  à gauche. Pas d'uppercase, pas de tracking.
- L'article *Le* / *La* / *Contact* est nommé en français entier — c'est un
  sommaire, pas un index.
- En bas à droite : signature `Casablanca, saison du printemps.` en
  `font-script` 18 px, `text-encre/60`.
- **Hover** : un fin trait sous le mot se dessine de gauche à droite (350 ms
  ease-out), comme un soulignement à la main. Aucune autre transformation.
- **Active page** : trait permanent sous le mot, légèrement plus épais (1.5 px).

## 4. Mobile — anatomie

### Repos

```
┌─────────────────────────────────────┐
│  FemiGlow            ⌶    SOMMAIRE  │  56 px
└─────────────────────────────────────┘
```

- Hauteur 56 px, sans bordure.
- *SOMMAIRE* en uppercase 11 px Inter, soulignement 1 px.

### Overlay ouvert

```
┌─────────────────────────────────────┐
│  FemiGlow                  FERMER   │
├─────────────────────────────────────┤
│                                     │
│   Le rituel                         │
│   Le kit                            │
│   Le journal                        │
│   La maison                         │
│   Contact                           │
│                                     │
│   ─────────                         │
│                                     │
│   Panier (2)                        │
│                                     │
│   Casablanca, saison du printemps   │
└─────────────────────────────────────┘
```

- Overlay plein écran (100 vw × 100 vh), même fond crème.
- Liens en Cormorant italique 36 px, alignés à gauche, padding `px-8`.
- Le panier descend dans la liste comme un lien secondaire séparé par un
  trait fin.
- La signature reste en bas, en Pinyon 16 px.
- **Fermeture** : tap sur *FERMER*, swipe vers le haut, ou `Esc` (clavier
  externe).

## 5. Animations

| Moment | Détail |
|---|---|
| Mount header | Sceau fade-in 480 ms ease-out, *SOMMAIRE* en cascade 80 ms après |
| Hover sceau | Sceau passe de `text-encre` à `text-encre/70`, 220 ms |
| Scroll > 40 px | Fond du header se matérialise (transparence → `creme/85`), 280 ms |
| Click *SOMMAIRE* | Overlay descend du haut vers le bas, 480 ms `cubic-bezier(0.22,1,0.36,1)` (ease-out-expo). Liens en cascade `stagger 80 ms`, fade-up 24 px. |
| Hover lien overlay | Trait SVG sous le mot, `stroke-dashoffset` de 100 % à 0 %, 350 ms ease-out |
| Sortie hover | Trait revient de droite à gauche (`stroke-dashoffset` 0 → 100 %), 280 ms |
| Click *FERMER* | Overlay remonte vers le haut, 360 ms ease-in, liens disparaissent en cascade inversée |
| `prefers-reduced-motion` | Les transitions passent à un simple crossfade 200 ms, pas de translation |

## 6. Accessibilité

- L'overlay est un `<dialog>` natif, modal, focus trap automatique.
- `aria-labelledby` pointe vers un `<h2 className="sr-only">Sommaire</h2>`.
- Liens dans l'ordre logique (1: rituel, 2: kit…), `Tab` parcourt, `Esc` ferme.
- L'icône panier dans l'overlay reçoit son focus avant le bouton *FERMER*.
- Le trigger *SOMMAIRE* a `aria-expanded` et `aria-controls`.
- Le trait hover SVG ne porte aucune information — pure décoration.
- Contraste `encre` sur `creme` partout = 12.6:1 (AAA).
- Le swipe-down mobile ne remplace pas la fermeture — *FERMER* texte reste l'option principale.

## 7. Cohérence avec la marque

- **Très forte.** L'absence de menu visible matérialise la « beauté lente » —
  on ne crie pas ses entrées, on les confie.
- Le Cormorant italique en très grand est exactement la voix typographique de
  la maison.
- La signature `Casablanca, saison du printemps.` ancre la marque dans son
  lieu et son temps, à chaque ouverture.
- Le geste — *Sommaire* — emprunte au vocabulaire éditorial, pas au commerce.
- Risque : un visiteur pressé peut ne pas comprendre où sont les sections au
  premier regard.

## 8. Forces / faiblesses synthétiques

**Forces**
- Identité immédiate, mémorable.
- L'overlay devient un moment fort à chaque visite.
- Le mobile bénéficie autant du concept que le desktop.
- Espace publicitaire visuel : page débarrassée de chrome, hero respire.
- Très accessible une fois ouvert (grand caractère, fort contraste).

**Faiblesses**
- Coût d'apprentissage : le visiteur doit cliquer pour découvrir les pages.
- Risque pour le SEO comportemental (taux de clic vers les sections plus bas
  si l'overlay n'est pas découvert).
- Demande un héros home très fort pour compenser l'absence de contexte.
- Animation d'overlay = pic de complexité ; à mal coder, ça peut sentir le
  *fancy* plutôt que le *quiet*.
