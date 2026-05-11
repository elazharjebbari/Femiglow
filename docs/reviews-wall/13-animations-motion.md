# 13 — Animations et motion

Cadre des animations du composant « Rituels partagés ». Toutes respectent la posture maison : **lentes mais courtes**, **fluides mais discrètes**, jamais répétées (K-LUX-02). Et toutes désactivables via `prefers-reduced-motion: reduce`.

## 1. Tokens de durée et easing

Repris des tokens globaux Tailwind (cf. `apps/web/tailwind.config.ts`) :

| Token | Durée | Usage |
| --- | --- | --- |
| `instant` | 100 ms | Micro feedback (toggle de chip) |
| `fast` | 200 ms | Hover state, fade-in d'un élément simple |
| `base` | 300 ms | Apparition de carte, transition de filtre |
| `slow` | 500 ms | Apparition de section (rare dans le wall) |
| `deliberate` | 800 ms | Confirmation finale, slow motion luxe |
| `cinematic` | 1200 ms | Non utilisé dans le wall |

Easings :

| Token | Valeur cubic-bezier | Usage |
| --- | --- | --- |
| `default` | `cubic-bezier(0.4, 0, 0.2, 1)` | Toggles, fades neutres |
| `out-soft` | `cubic-bezier(0.16, 1, 0.3, 1)` | Apparitions, ouverture du drawer |
| `in-quiet` | `cubic-bezier(0.4, 0, 1, 1)` | Fermetures |
| `in-out-silk` | `cubic-bezier(0.65, 0, 0.35, 1)` | Bascules entre étapes, lightbox |

## 2. Drawer

### 2.1 Ouverture desktop

| Phase | Propriété | De | À | Durée | Easing |
| --- | --- | --- | --- | --- | --- |
| Overlay | `opacity` | 0 | 1 | 220 ms | `out-soft` |
| Drawer | `transform: translateX` | `100%` | `0` | 220 ms | `out-soft` |
| Drawer | `opacity` | 0.9 | 1 | 220 ms | `out-soft` |

### 2.2 Ouverture mobile (bottom sheet)

| Phase | Propriété | De | À | Durée | Easing |
| --- | --- | --- | --- | --- | --- |
| Overlay | `opacity` | 0 | 1 | 280 ms | `out-soft` |
| Drawer | `transform: translateY` | `100%` | `0` | 280 ms | `out-soft` |
| Drag handle | `opacity` | 0 | 1 | 280 ms (delay 100 ms) | `out-soft` |

### 2.3 Fermeture

Toutes propriétés inversées, durée 180 ms, easing `in-quiet`. Pas de courbe rebondissante.

### 2.4 Drag-to-close (mobile)

Pendant le drag :

- `translateY` suit le doigt en temps réel.
- Overlay `opacity` interpolée linéairement avec la distance parcourue.

Au relâchement :

- Si `translateY > 30 % de la hauteur` → animation de fermeture.
- Sinon → animation de retour (snap back), 200 ms `out-soft`.

## 3. Apparition des cartes (load et load more)

Chaque carte apparaît avec :

| Propriété | De | À | Durée | Easing | Stagger |
| --- | --- | --- | --- | --- | --- |
| `opacity` | 0 | 1 | 300 ms | `out-soft` | 50 ms par carte |
| `transform: translateY` | 8 px | 0 | 300 ms | `out-soft` | 50 ms par carte |

Stagger appliqué uniquement aux nouvelles cartes chargées via load more (pas au chargement initial). Au chargement initial, toutes les cartes apparaissent ensemble (économie de motion).

## 4. Skeleton loaders

Pendant le fetch initial ou les load more :

- 4 skeletons affichés, dimensions identiques à la carte.
- Fond crème-pure.
- Pas de pulse animé (l'absence de pulse renforce la posture « lente »).
- Apparence simple : 1 rectangle photo gris pâle + 3 lignes de texte gris pâle.

Si la modératrice veut un signal de vie : pulse opacity 0.6 → 1 en 1 500 ms `default`, désactivé `prefers-reduced-motion`.

## 5. Filtres (chips)

### 5.1 Click sur un chip

| Propriété | De | À | Durée | Easing |
| --- | --- | --- | --- | --- |
| `background-color` | crème | sauge | 150 ms | `default` |
| `border-color` | ligne | sauge-dark | 150 ms | `default` |

### 5.2 Liste après filter change

| Phase | Propriété | Durée |
| --- | --- | --- |
| Old list out | `opacity 1 → 0` | 200 ms `in-quiet` |
| Skeleton apparition | `opacity 0 → 1` | 200 ms `out-soft` |
| New list in | Apparition cartes (cf. § 3) | 300 ms par carte |

Pas de translation, juste un fade pour ne pas désorienter.

## 6. Lightbox photo

### 6.1 Ouverture

| Propriété | De | À | Durée | Easing |
| --- | --- | --- | --- | --- |
| Overlay | `opacity 0 → 1` | — | 240 ms | `in-out-silk` |
| Image | `transform: scale(0.96) → scale(1)` | — | 240 ms | `in-out-silk` |
| Image | `opacity 0 → 1` | — | 240 ms | `in-out-silk` |

### 6.2 Navigation (← / →)

| Propriété | De | À | Durée | Easing |
| --- | --- | --- | --- | --- |
| Old image out | `opacity 1 → 0, translateX 0 → ±24 px` | — | 200 ms | `in-quiet` |
| New image in | `opacity 0 → 1, translateX ±24 px → 0` | — | 200 ms | `out-soft` |

### 6.3 Fermeture

Inversée, 200 ms `in-quiet`.

## 7. Bascule wizard

### 7.1 Drawer → mode wizard

Cross-fade :

| Phase | Propriété | Durée |
| --- | --- | --- |
| Liste / footer out | `opacity 1 → 0` | 180 ms `in-quiet` |
| Wizard étape 1 in | `opacity 0 → 1, translateY 12 px → 0` | 280 ms `in-out-silk`, delay 100 ms |

### 7.2 Entre étapes

Cross-fade horizontal :

| Phase | Propriété | Durée |
| --- | --- | --- |
| Étape N out | `opacity 1 → 0, translateX 0 → -16 px` | 180 ms `in-quiet` |
| Étape N+1 in | `opacity 0 → 1, translateX 16 px → 0` | 280 ms `in-out-silk`, delay 100 ms |

Pour la navigation `← Retour`, inverser la direction du translateX.

### 7.3 Confirmation finale

Apparition contemplative :

| Phase | Propriété | Durée | Easing | Delay |
| --- | --- | --- | --- | --- |
| Fleuron haut | `opacity 0 → 1` | 400 ms | `out-soft` | 0 |
| Titre | `opacity 0 → 1, translateY 8 px → 0` | 600 ms | `out-soft` | 200 ms |
| Body 1 | `opacity 0 → 1` | 400 ms | `out-soft` | 600 ms |
| Body 2 | `opacity 0 → 1` | 400 ms | `out-soft` | 900 ms |
| Signature | `opacity 0 → 1` | 400 ms | `out-soft` | 1300 ms |
| Fleuron bas | `opacity 0 → 1` | 400 ms | `out-soft` | 1700 ms |
| CTA | `opacity 0 → 1, translateY 8 px → 0` | 400 ms | `out-soft` | 2000 ms |

Durée totale : ~2,4 sec. C'est lent **assumé** — la confirmation est un moment, pas un toast.

Auto-close 8 secondes après l'apparition complète, sauf interaction.

## 8. Toasts éditoriaux

Pour les messages discrets (emoji retiré, brouillon sauvegardé) :

```
┌─────────────────────────────────────┐
│  Les émoticônes ne sont pas dans    │
│  notre grammaire.                   │
└─────────────────────────────────────┘
```

| Propriété | Durée |
| --- | --- |
| Apparition `translateY -8 px → 0, opacity 0 → 1` | 200 ms `out-soft` |
| Tenue | 2 000 ms (lisible) |
| Disparition `opacity 1 → 0` | 200 ms `in-quiet` |

Position : top centré du wizard, jamais des coins (fragile sur mobile).

## 9. CTA hover (desktop)

| Élément | Propriété | Durée | Easing |
| --- | --- | --- | --- |
| Bouton encre | `background-color encre → encre-claire` | 200 ms | `default` |
| Bouton secondaire | `background-color → sauge-pale` | 200 ms | `default` |
| Carte hover | `translateY 0 → -3 px` + `box-shadow subtle` | 200 ms | `out-soft` |

## 10. Active states (click feedback)

| Élément | Propriété |
| --- | --- |
| Bouton primaire | `transform: scale(0.98)` pendant `:active` |
| Carte clickable | Aucun changement visuel (le focus ring fait le job en clavier) |
| Chip | Le `:checked` est le feedback |

## 11. Respect `prefers-reduced-motion: reduce`

Quand activé, toutes les animations sont :

- Réduites à **80 ms maximum**, fade uniquement.
- Sans translation, sans scale, sans stagger.
- Sans drag visuel sur le bottom sheet (le sheet apparaît / disparaît directement).

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.08s !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.08s !important;
    scroll-behavior: auto !important;
  }

  .ritual-card,
  .ritual-drawer,
  .ritual-lightbox-image,
  .ritual-wizard-step {
    transform: none !important;
  }
}
```

Plus précis encore : utiliser le hook `useReducedMotion` de Framer Motion pour skipper les variants entiers.

## 12. Performance des animations

### 12.1 Propriétés autorisées

Seules `transform` et `opacity` sont animées. Jamais `width`, `height`, `top`, `left`, `margin`. Garantit le rendu GPU.

### 12.2 will-change

Le drawer et la lightbox photo activent `will-change: transform, opacity` 200 ms avant l'animation, puis le retirent à la fin pour libérer la mémoire GPU.

### 12.3 Composite layers

Le drawer en mode ouvert est promu en composite layer via `transform: translateZ(0)`.

### 12.4 Frame budget

Cible : 60 FPS sur iPhone 12, MacBook M1, Android milieu de gamme (Galaxy A53). Aucune frame > 16 ms en condition de stress (load more avec 12 cartes simultanées).

Mesurable via DevTools Performance : profile sur la séquence `open → scroll → filter → load more`.

## 13. Bibliothèque retenue

**Framer Motion 11** déjà installé. Pattern d'usage :

```tsx
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

export function RitualCard({ card, index, isNew }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.article
      initial={isNew ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={
        reduceMotion
          ? { duration: 0.08 }
          : { duration: 0.3, ease: [0.16, 1, 0.3, 1], delay: index * 0.05 }
      }
    >
      ...
    </motion.article>
  );
}
```

Pour le drawer, Radix Dialog + Framer Motion `AnimatePresence` autour de `DialogContent`.

## 14. Synthèse — règles d'or motion

1. **Aucune animation répétée.** Pas de pulse, pas de blink, pas de shake.
2. **Aucune animation > 500 ms** sauf la confirmation finale (deliberate).
3. **Aucune translation sur axe Z** (pas de rotation 3D, pas de flip).
4. **Aucun overshoot ni bounce.** Les easings sont `ease-out` ou `ease-in-out`, jamais `ease-out-back`.
5. **Aucune animation sur des propriétés non GPU-friendly.**
6. **`prefers-reduced-motion: reduce` est respecté absolument** — pas de fallback subtil, juste fade 80 ms.
7. **Le drag-to-close mobile est lui aussi désactivé** sous reduced motion (drawer fermable uniquement par bouton ou ESC).
8. **L'animation de confirmation est un moment éditorial assumé** (~2,4 sec) — ce n'est pas un toast, c'est une fin de lettre.
