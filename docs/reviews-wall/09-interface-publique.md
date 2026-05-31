# 09 — Interface publique : layout, composants, états, comportements

Spécification détaillée de l'UI publique du composant « Rituels partagés ». Couvre le module compact sur `/kit`, le drawer, et la lightbox photo. Le wizard de soumission est décrit dans `11-wizard-soumission.md`.

## 1. Arbre des composants

```
RitualsWallProvider                 (context, state global du wall)
├── RitualsModule                   (module compact /kit)
│   ├── RitualsModuleHeader         (titre + synthèse)
│   ├── RitualsModuleGrid           (3 cards featured)
│   │   └── RitualCard (×3)         (compact)
│   └── RitualsModuleLink           (« Lire les 26 → »)
│
├── RitualsWallDrawer               (drawer ouvert sur demande)
│   ├── RitualsWallHeader           (close + kicker + titre + fleuron)
│   ├── RitualsWallSummary          (synthèse + top tags)
│   ├── RitualsWallFilters          (chips)
│   ├── RitualsWallList             (liste + load more)
│   │   ├── RitualCard (×N)
│   │   ├── RitualsWallSkeleton (×4)
│   │   └── RitualsWallLoadMore     (bouton)
│   ├── RitualsWallEmptyState       (si 0 carte)
│   └── RitualsWallFooter           (lien share + CTA pack + lien policy)
│
├── RitualPolicyView                (vue alternative dans drawer)
│
└── RitualPhotoLightbox             (overlay photo plein écran)
    ├── RitualPhotoLightboxHeader   (close, compteur, nav)
    ├── RitualPhotoLightboxImage    (image)
    └── RitualPhotoLightboxCaption  (légende, signature)
```

Naming code (TypeScript) : `components/sections/rituals/*` côté lecture, `components/sections/rituals/wizard/*` côté soumission.

## 2. RitualsModule (module compact `/kit`)

### 2.1 Position et déclenchement

- Inséré dans `apps/web/src/app/(marketing)/kit/page.tsx` entre la section composition et la section comparatif.
- Composant `RitualsModuleBound.tsx` fetch côté serveur (RSC) les 3 cards `featured = true` + `summary`.
- Rendu progressif : skeleton si fetch lent, fallback gracieux (3 dernières si pas de featured).

### 2.2 Dimensions

| Breakpoint | Layout |
| --- | --- |
| Mobile < 768 | 1 colonne, swipe horizontal sur les 3 cards (snap-x), padding 24 px |
| Tablet 768–1279 | 2 colonnes, 3ᵉ carte en pleine largeur dessous |
| Desktop ≥ 1280 | 3 colonnes égales, gap 24 px, max-width 1200 px |

### 2.3 Anatomie HTML/JSX (extrait)

```tsx
<section aria-labelledby="rituals-module-title" className="ritual-module">
  <header className="ritual-module__header">
    <span className="ritual-module__kicker">LES VOIX DE LA MAISON</span>
    <h2 id="rituals-module-title" className="ritual-module__title">
      26 initiées ont partagé. 24 reprendraient le rituel.
    </h2>
    <Fleuron variant="point" />
  </header>

  <div className="ritual-module__grid" role="list">
    {featured.map(card => (
      <RitualCard
        key={card.publicSlug}
        variant="compact"
        data={card}
        role="listitem"
        onClick={() => openDrawer({ scrollTo: card.publicSlug })}
      />
    ))}
  </div>

  <a
    href="?wall=open"
    className="ritual-module__link"
    onClick={onLinkClick}
  >
    Lire les 26 rituels partagés <span aria-hidden="true">→</span>
  </a>
</section>
```

### 2.4 RitualCard variant `compact`

| Élément | Style |
| --- | --- |
| Photo | 100 % largeur carte, ratio 4:5, lazy load AVIF/WebP, focal-point CSS `object-position` |
| Citation | Cormorant Italic 16 pt, encre, max 3 lignes (ellipsis CSS), ouvrant guillemet `«` espace fine |
| Signature | `— [Prénom], [Ville]` Inter Regular 12 pt brume, puis `Initiée depuis [mois année]` 12 pt brume sur ligne suivante |
| Tags choisis | 1 à 2 tags séparés par ` · `, Inter 12 pt sauge-dark, sous la signature |
| Bordure | 1 px ligne `#E8E0D2`, radius 0 |
| Padding interne | 20 px |
| Fond | Crème pure `#FFFFFF` |
| Hover | translateY(-3 px), transition 200 ms `out-soft` (désactivé `prefers-reduced-motion`) |

### 2.5 Fallback

Si moins de 3 cards `featured = true` disponibles :

1. Compléter avec les témoignages `APPROVED` les plus récents qui ont au moins 1 photo `OK`.
2. Si toujours moins de 3, ne pas afficher le module entier (graceful degradation). Le lien autonome `Lire les 26 rituels partagés →` reste visible plus bas dans la page.

## 3. RitualsWallDrawer

### 3.1 Conteneur

Implémenté sur **Radix Dialog** (déjà présent dans la stack) ou **Headless UI Dialog** :

- `<Dialog>` avec `aria-modal="true"`.
- `<DialogOverlay>` semi-transparent encre `rgba(44, 42, 40, 0.30)`.
- `<DialogContent>` ancré à droite (desktop) ou bas (mobile), focus trap intégré.

### 3.2 Dimensions

| Breakpoint | Largeur / hauteur |
| --- | --- |
| Mobile < 768 | 92 vh, bottom sheet, drag handle 36×4 px crème en haut |
| Tablet 768–1279 | 420 px largeur, 100 vh, drawer right |
| Desktop ≥ 1280 | 480 px largeur, 100 vh, drawer right |
| Desktop ≥ 1920 | 520 px largeur max |

### 3.3 Header

```
┌──────────────────────────┐
│  [×]                     │  ← Bouton 48×48, focus initial
│                          │
│  RITUELS PARTAGÉS        │  ← Kicker Inter SemiBold 9 pt sauge-dark
│  Les voix de la maison.  │  ← H1 Cormorant Light 28 pt encre
│                          │
│  ╌╌╌╌◆╌╌╌╌               │  ← Fleuron variante A 96×14 px champagne
└──────────────────────────┘
```

Padding : 32 px top, 32 px sides, 16 px bottom (desktop). Sur mobile : 24 px / 24 px / 16 px.

### 3.4 Summary

```
26 initiées ont partagé.
24 reprendraient le rituel.

Ongles plus lisses · Plaque souple ·
Cuticules apaisées
```

- Première ligne : Cormorant Italic 18 pt encre.
- Deuxième ligne : Cormorant Italic 18 pt encre.
- Top tags : Inter Regular 12 pt brume, séparés par ` · ` champagne.

Pas d'histogramme.

### 3.5 Filters

Chips horizontaux, scroll horizontal sur mobile :

```
┌───────────────────────────────────────────────┐
│ ●Tous    Avec photos    Halal    Récents      │
└───────────────────────────────────────────────┘
```

- Chip default : fond crème pure, bordure 1 px ligne, padding 8×14 px, radius 0.
- Chip actif : fond sauge `#C5DBC4`, bordure sauge-dark, texte encre.
- Hauteur 32 px, touch target 44 px via padding click area.
- Hover : transition 150 ms.
- Au-delà de la viewport, scroll-snap horizontal sur mobile, ombre droite suggérant le scroll.

### 3.6 List

Cartes verticales empilées, gap 16 px.

```
┌─────────────────────────────────┐
│  ┌────────┐                     │
│  │ photo  │  « citation Cormorant
│  │  80px  │    italic 17 pt »    │
│  └────────┘                     │
│                                 │
│  — Amal, Rabat                  │
│  Initiée depuis février 2026    │
│                                 │
│  ongles plus lisses · plus de   │
│  casse                          │
│                                 │
│  [Reviendrait]                  │
└─────────────────────────────────┘
```

#### 3.6.1 RitualCard variant `default` (drawer)

| Élément | Style | Position |
| --- | --- | --- |
| Photo | 80×80 px, AVIF, lazy | top-left, float CSS |
| Photo absent | Pas de placeholder ; le texte occupe toute la carte | — |
| Citation | Cormorant Italic 17 pt encre, line-height 1.6 | Wrap autour de la photo |
| Signature 1 | `— [Prénom], [Ville]` Inter 12 pt brume | Sous citation |
| Signature 2 | `Initiée depuis [mois année]` Inter 12 pt brume | Sous signature 1 |
| Tags choisis | Inter 12 pt sauge-dark, séparés ` · ` | Sous signature 2 |
| Badge « Reviendrait » | Inter SemiBold 9 pt sauge-dark, kicker tracking 2 px, sous-bord 1 px sauge-pale | Bottom-right de la carte si `would_recommend = oui` |
| Fond | Crème pure `#FFFFFF` | |
| Bordure | 1 px `#E8E0D2` | |
| Padding | 20 px | |
| Radius | 0 | |

#### 3.6.2 Si photo cliquable

Photo a `cursor: pointer`, `aria-label="Voir la photo en grand"`. Clic ouvre `RitualPhotoLightbox` (cf. § 4).

### 3.7 LoadMore

```
┌─────────────────────────────┐
│  Afficher plus (12 / 26)    │
└─────────────────────────────┘
```

- Bouton plein largeur, fond transparent, bordure 1 px ligne, hauteur 48 px.
- Texte Inter Medium 13 pt encre.
- Hover : fond sauge-pale.
- État chargement : remplacé par 4 skeletons + spinner discret 12×12 px.
- Disabled si plus de cartes à charger : devient un texte centré « Vous avez lu toutes les voix de la maison. »

### 3.8 Empty state

```
La maison écoute.

Soyez la première à partager votre rituel.

[Partager mon rituel →]
```

S'affiche si `totalCount = 0`. Cormorant Italic 18 pt centré, fleuron en haut, CTA secondaire dessous.

### 3.9 Footer sticky

```
─────────────────────────────────

Partager mon rituel →

[Recevoir le pack — 199 dh]
 Livraison offerte au Maroc

Comment ces rituels partagés sont vérifiés →
```

- Position sticky bottom.
- Padding 24 px.
- Fond crème, ombre supérieure subtle `0 -1px 8px rgba(44, 42, 40, 0.06)`.
- `Partager mon rituel` : Inter Medium 13 pt encre, lien.
- CTA pack : bouton plein largeur, fond encre, hauteur 56 px, hover encre-claire.
- Sous-CTA : Inter Regular 12 pt brume.
- `Comment...vérifiés` : Inter Regular 12 pt brume avec flèche, lien.

## 4. RitualPhotoLightbox

### 4.1 Ouverture

- Trigger : clic sur thumbnail dans `RitualCard`.
- Animation : opacité 0 → 1 + scale 0.96 → 1, 240 ms `in-out-silk`.
- Focus se pose sur le bouton fermer.

### 4.2 Layout

```
┌────────────────────────────────────────────┐
│ [×]            Photo 1 / 3            [→]  │  ← Header sticky
│ [←]                                        │
│                                            │
│                                            │
│            [Image plein cadre]             │
│                                            │
│                                            │
│                                            │
│                                            │
│   Mains d'Amal, six semaines après le      │  ← Caption Cormorant
│   début du rituel.                         │     Italic 15 pt
│                                            │
│   — Amal, Rabat                            │  ← Signature 12 pt brume
└────────────────────────────────────────────┘
```

- Fond noir 95 % opacité (`rgba(0, 0, 0, 0.95)`).
- Image centrée, max 90 vh hauteur, max 90 vw largeur.
- Navigation arrows desktop : 48×48 px, fond `rgba(255,255,255,0.15)`, click précédent/suivant.
- Mobile : swipe horizontal pour naviguer.
- Header : titre `Photo X / Y`, close (Esc), nav (← →).
- Caption en bas, sur fond noir transparent.

### 4.3 Navigation clavier

- `Esc` ferme.
- `←` / `→` navigue.
- `Tab` cycle entre close + arrows + caption link.

## 5. RitualPolicyView

### 5.1 Déclencheur

Clic sur `Comment ces rituels partagés sont vérifiés →` dans le footer du drawer.

### 5.2 Comportement

Vue interne au drawer (pas une modale empilée) : la liste disparaît, remplacée par le texte de politique. Bouton `← Revenir aux rituels` en haut.

### 5.3 Contenu

Texte Cormorant Regular 15 pt encre, max-width 480 px (largeur drawer). 4 paragraphes :

1. **Qui peut partager** — chaque initiée ayant reçu le pack.
2. **Comment nous lisons** — modération humaine 24 à 48 h.
3. **Ce que nous publions** — mains, gestes, table. Ce que nous ne publions pas : visages, émoticônes, marques tierces.
4. **Vos données** — RGPD, droit à l'oubli, contact `info@femiglow-maroc.com`.

Texte stocké en BDD via table `app_config` section `rituals_policy`, éditable dans `/admin/rituals/politique`.

## 6. États du composant

### 6.1 Drawer

| État | Description |
| --- | --- |
| `closed` | Drawer fermé, pas de DOM monté |
| `opening` | Animation d'ouverture en cours (220 ms) |
| `open` | Drawer ouvert, contenu monté |
| `closing` | Animation de fermeture en cours |
| `loading` | Drawer ouvert, fetch en cours, skeleton visible |
| `loaded` | Données présentes, liste rendue |
| `error` | Erreur API, message + bouton retry |
| `empty` | 0 résultats (filtres ou volume = 0) |
| `loading_more` | Pagination en cours, 4 skeletons en bas |
| `share_mode` | Wizard de soumission monté (cf. doc 11) |
| `policy_mode` | RitualPolicyView monté |

### 6.2 RitualCard (drawer)

| État | Description |
| --- | --- |
| `default` | Affiché normalement |
| `hover` | translateY -3 px (desktop only) |
| `photo_loading` | Skeleton 80×80 sauge-pale |
| `photo_error` | Pas de photo affichée (la carte fonctionne sans) |

### 6.3 Filter chips

| État | Style |
| --- | --- |
| `default` | Fond crème, bordure ligne |
| `hover` | Fond sauge-pale, bordure sauge-dark |
| `active` | Fond sauge, bordure sauge-dark, texte encre |
| `disabled` | Opacité 40 %, cursor not-allowed (si filtre n'apporterait rien) |

## 7. URL state

| URL | Comportement |
| --- | --- |
| `/kit` | Module visible, drawer fermé |
| `/kit?wall=open` | Drawer ouvert au mount, liste complète |
| `/kit?wall=open&filter=halal` | Drawer ouvert, filtre `halal` pré-sélectionné |
| `/kit?wall=card-k7m3qp2x` | Drawer ouvert, scroll auto jusqu'à la carte, mise en évidence visuelle 2 sec |
| `/kit?wall=share` | Drawer ouvert directement en mode wizard (étape 1) |
| `/kit?wall=share&order=...&hash=...` | Wizard avec `productKey` et `customerHash` pré-remplis (lien e-mail J+45) |

Le push history est non-bloquant : si JavaScript désactivé, le module compact reste visible mais le drawer ne s'ouvre pas — fallback acceptable.

## 8. Tracking attaché

Pour chaque composant, les hooks `data-track` et événements émis sont listés. Détail complet dans `16-tracking-analytics.md`.

```tsx
<RitualsWallDrawer
  data-track="ritual-wall-drawer"
  onOpen={() => emit('ritual_wall_open', { entry_point: 'kit_module_link' })}
  onClose={({ duration_ms, cards_seen }) => emit('ritual_wall_close', { duration_ms, cards_seen })}
>
```

## 9. Accessibilité (résumé)

| Élément | Pratique a11y |
| --- | --- |
| Drawer | `role="dialog"`, `aria-modal="true"`, `aria-labelledby="rituals-wall-title"`, focus trap, ESC ferme |
| Card | `<article>` avec `aria-labelledby`, signature lue après citation par ordre DOM logique |
| Photo | `<img>` avec `alt` éditorial (« Mains d'Amal, six semaines après le début du rituel »), pas de `alt=""` muet |
| Chip filtres | `<button role="checkbox" aria-checked>` ou `<button aria-pressed>` |
| Lightbox | `role="dialog"`, focus trap, swipe + clavier |
| Load more | `<button>` avec `aria-live="polite"` pour annoncer le nouveau compte |

Détail dans `14-accessibilite-ergonomie.md`.

## 10. Notes de design tokens

Quelques tokens spécifiques au wall, en complément des tokens globaux :

```css
:root {
  --ritual-card-padding: 20px;
  --ritual-card-border: 1px solid var(--color-ligne);
  --ritual-card-bg: var(--color-creme-pure);

  --ritual-chip-padding-y: 8px;
  --ritual-chip-padding-x: 14px;
  --ritual-chip-height: 32px;

  --ritual-drawer-width-desktop: 480px;
  --ritual-drawer-width-tablet: 420px;
  --ritual-bottom-sheet-height: 92vh;

  --ritual-photo-thumb-size: 80px;
  --ritual-photo-module-ratio: 4 / 5;

  --ritual-overlay: rgba(44, 42, 40, 0.30);
  --ritual-lightbox-overlay: rgba(0, 0, 0, 0.95);
}
```

Stockés dans `apps/web/src/styles/tokens.css`, exposés à Tailwind via `tailwind.config.ts`.
