# 05 — Animations

## Objectif

Centraliser les animations possibles dans un **registre data** et permettre
à l'admin d'**affecter** un profil à un composant. Le code applique l'animation
en respectant `prefers-reduced-motion`.

## Profils livrés en V1

| Key             | Kind            | Description                                         | Cible typique          |
|-----------------|-----------------|-----------------------------------------------------|------------------------|
| `none`          | none            | Aucune animation                                    | Footer, formulaires    |
| `fade-in`       | framer-motion   | Opacity 0→1 sur 600ms                                | Hero subtil            |
| `reveal-up`     | framer-motion   | Opacity 0→1 + translateY 24→0, 700ms ease-out       | Sections narratives    |
| `scale-hover`   | css             | `transform: scale(1.02)` au hover (700ms)           | Cartes article         |
| `parallax-soft` | framer-motion   | translateY scroll-driven, ratio 0.15                 | Backgrounds éditoriaux |
| `schema-svg`    | svg             | pathLength 0→1 par couche                            | SVG anatomiques        |
| `cross-link`    | css             | translateY -4 + group-hover, 500ms                   | Carrousels CrossLink   |

## Configuration `config` (jsonb)

### Framer Motion

```json
{
  "initial": { "opacity": 0, "y": 24 },
  "whileInView": { "opacity": 1, "y": 0 },
  "viewport": { "once": true, "margin": "-15% 0px" },
  "transition": { "duration": 0.7, "ease": [0.23, 1, 0.32, 1] }
}
```

### CSS

```json
{
  "selector": "&",
  "transition": "transform 700ms cubic-bezier(0.23,1,0.32,1)",
  "hover": { "transform": "scale(1.02)" }
}
```

### SVG (pathLength)

```json
{
  "layers": [
    { "selector": "path[data-layer='cuticule']", "duration": 1.2 },
    { "selector": "path[data-layer='lit']", "duration": 1.2, "delay": 0.3 }
  ]
}
```

## Composant runtime `<ComponentAnimationWrapper>`

```tsx
'use client';
import { LazyMotion, domAnimation, m } from 'framer-motion';
import { useReducedMotion } from '@/lib/media/hooks/useReducedMotion';
import type { AnimationProfile } from '@/lib/components/types';

interface Props {
  profile: AnimationProfile | null;
  children: React.ReactNode;
}

export function ComponentAnimationWrapper({ profile, children }: Props): JSX.Element {
  const reduce = useReducedMotion();
  if (!profile || profile.key === 'none' || reduce) {
    return <>{children}</>;
  }
  if (profile.kind === 'framer-motion') {
    const cfg = profile.config as MotionConfig;
    return (
      <LazyMotion features={domAnimation} strict>
        <m.div {...cfg}>{children}</m.div>
      </LazyMotion>
    );
  }
  if (profile.kind === 'css') {
    return <div className={profile.cssClass}>{children}</div>;
  }
  // svg → délégué au composant SVG (qui consomme profile.config.layers)
  return <>{children}</>;
}
```

## Bindings et défaut

- Plusieurs profils peuvent être attachés à un composant.
- Un seul `isDefault=true` par composant.
- L'admin peut basculer le défaut via radio-button.

## Reduced motion

Tous les profils ont `respectsReducedMotion=true` par défaut. Quand le
navigateur indique `prefers-reduced-motion: reduce` :
- `fade-in` → pas d'opacity, rendu direct
- `reveal-up` → pas de translateY
- `scale-hover` → pas de transform
- `parallax-soft` → désactivé
- `schema-svg` → SVG rendu en état final (pathLength=1) sans animer

## Migration des animations existantes

| Lieu actuel                          | Profil cible      | Action                          |
|---------------------------------------|-------------------|---------------------------------|
| `ArticleCard` `group-hover:-translate-y-1` | `cross-link` (CSS) | Garder via Tailwind, profil = info |
| `JournalExtraits` `group-hover:opacity-95` | `cross-link` (CSS) | Idem |
| `CrossLinkCard` `group-hover:scale-[1.02]` | `scale-hover`      | Idem |
| `SectionNarrative` Reveal motion     | `reveal-up`        | Wrap via `<ComponentAnimationWrapper>` |
| `SchemaSVG` pathLength               | `schema-svg`       | Le SVG lit `profile.config.layers` |
| `Reveal.tsx`                         | `reveal-up`        | Le profil par défaut du wrapper devient `reveal-up` |

**Stratégie** : on N'ARRACHE PAS le code existant en V1. Les composants
gardent leurs animations Tailwind/framer-motion. Le profil sert de
métadonnée pour la documentation admin + futures personnalisations.
Migration "totale" en V2 (composants entièrement pilotés par le profil).

## Preview live en admin

`/admin/components/animations` affiche pour chaque profil un bloc
qui boucle l'animation toutes les 3s, avec un bouton "Pause" et un toggle
"Force reduced motion" pour tester l'accessibilité.

```
┌───────────────────────────────┐
│  reveal-up                     │
│  [▶ Boucle]  [Reduced motion]  │
│  ┌──────────────┐              │
│  │   ANIMATING  │ ◄ motion.div │
│  └──────────────┘              │
│  Durée : 700ms · Easing : ...  │
└───────────────────────────────┘
```
