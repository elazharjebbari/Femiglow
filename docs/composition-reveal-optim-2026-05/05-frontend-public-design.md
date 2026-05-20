# 05 — Frontend public (rendu, motion, responsive)

Conception détaillée des composants visibles côté public.

## 1. Hiérarchie composant cible

```
CompositionRevealBound (Server Component, resolveOgImage + mediaSlots)
  └─ CompositionReveal (Server Component, layout + map)
       └─ CompositionCard (Client Component, animation + crossfade)
            ├─ NumberBadge (sub-component, pastille or poudré)
            ├─ MediaCrossfade (sub-component, isolated ↔ contextual)
            └─ SensationLine (sub-component, italique + guillemets)
```

`ProductCard` actuelle reste disponible jusqu'à la phase 8 (suppression).

## 2. `CompositionReveal v2`

```tsx
// apps/web/src/components/sections/CompositionReveal.tsx (refonte)
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { CompositionCard } from '@/components/kit/CompositionCard';
import type { SubProduct } from '@/lib/schemas';

interface CompositionRevealProps {
  items: SubProduct[];
  ingredientsAnchor?: string;
  /** Slot par `subProductId` pour image isolated (kit-base, kit-fortifiant, kit-lime). */
  isolatedSlots?: Record<string, React.ReactNode>;
  /** Slot par `subProductId` pour image contextuelle (kit-base-contextual, etc.). */
  contextualSlots?: Record<string, React.ReactNode>;
}

export function CompositionReveal({
  items,
  ingredientsAnchor = 'ingredients-details',
  isolatedSlots,
  contextualSlots,
}: CompositionRevealProps) {
  return (
    <section
      aria-labelledby="composition-title"
      className="bg-[#EFE9DD] py-16 sm:py-24"     // sable, conforme §4.3
    >
      <Container width="wide">
        <div className="mb-10 max-w-2xl space-y-4">
          <Kicker>La composition</Kicker>
          <Heading id="composition-title" as="h2" size="display-sm">
            Trois objets, trois gestes.
          </Heading>
          <Text size="body" tone="secondary" prose>
            Le kit tient dans une main. Chaque pièce a sa place dans le geste,
            sa place sur la table de chevet, sa place dans la saison.
          </Text>
        </div>

        {/* Phase 5 — vue éclatée annotée ici */}

        <ul
          role="list"
          className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-3 sm:gap-12"
        >
          {items.map((item, index) => (
            <li key={item.id}>
              <CompositionCard
                subProduct={item}
                index={index}
                detailsHref={`#${ingredientsAnchor}-${item.id}`}
                isolatedSlot={isolatedSlots?.[item.id]}
                contextualSlot={contextualSlots?.[item.id]}
              />
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
```

Changements vs actuel :

- Fond `#EFE9DD` (sable) au lieu de `bg-creme`.
- 2 props slots (isolated, contextual) au lieu d'un seul `mediaSlots`.
- Passage de `index` à la card pour la pastille numérotée.
- Plus de `ProductCard` — utilise `CompositionCard` dédié.

## 3. `CompositionCard` (nouveau)

```tsx
// apps/web/src/components/kit/CompositionCard.tsx (nouveau)
'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';

import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';
import {
  buildCardHeader,
  formatIndex,
  formatSensation,
  resolveAccentHex,
} from '@/lib/composition/copy';
import type { SubProduct } from '@/lib/schemas';

import { MediaCrossfade } from './MediaCrossfade';
import { NumberBadge } from './NumberBadge';
import { SensationLine } from './SensationLine';

export interface CompositionCardProps {
  subProduct: SubProduct;
  /** 0-based index pour la pastille (« 01 »...). */
  index: number;
  /** Ancre profonde vers INCI (ex: `#ingredients-paste`). */
  detailsHref: string;
  /** Slot media isolated (Component-Media résolu côté server). */
  isolatedSlot?: ReactNode;
  /** Slot media contextual. Si absent, on désactive le crossfade. */
  contextualSlot?: ReactNode;
}

export function CompositionCard({
  subProduct,
  index,
  detailsHref,
  isolatedSlot,
  contextualSlot,
}: CompositionCardProps) {
  const header = buildCardHeader(subProduct);
  const sensation = formatSensation(subProduct);
  const number = formatIndex(index);
  const accentHex = resolveAccentHex(subProduct.accentColor);

  return (
    <motion.article
      className="relative flex flex-col gap-4 rounded-md border border-[#C7CCC2] bg-[#FBFAF6] p-4 sm:p-5"
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{
        duration: 0.6,
        delay: index * 0.12,
        ease: [0.22, 1, 0.36, 1],
      }}
      data-testid={`composition-card-${subProduct.id}`}
    >
      <NumberBadge label={number} hex={accentHex} />

      <MediaCrossfade
        isolated={isolatedSlot ?? subProduct.image}
        contextual={contextualSlot}
        alt={subProduct.image.alt}
      />

      <div className="space-y-2">
        <Heading as="h3" size="sm">
          {subProduct.name}
          <span className="ml-2 align-baseline text-stone-500 font-body text-base [font-variant-numeric:tabular-nums]">
            · {subProduct.volume.toLowerCase()}
          </span>
        </Heading>

        <Text size="body" tone="secondary" prose>
          {subProduct.shortDescription}
        </Text>

        {sensation ? <SensationLine text={sensation} /> : null}

        <a
          href={detailsHref}
          className="inline-flex items-center gap-1 pt-1 text-xs uppercase tracking-[0.18em] text-encre underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C8A876]/40"
          data-testid={`composition-card-link-${subProduct.id}`}
        >
          Lire le détail <span aria-hidden="true">↓</span>
        </a>
      </div>
    </motion.article>
  );
}
```

## 4. Sous-composants

### 4.1 `NumberBadge`

```tsx
// apps/web/src/components/kit/NumberBadge.tsx (nouveau)
interface NumberBadgeProps {
  label: string;     // « 01 »
  hex: string;       // #A8B89E (sauge), etc.
}

export function NumberBadge({ label, hex }: NumberBadgeProps) {
  return (
    <span
      aria-hidden="true"
      className="absolute -top-3 -left-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-[#FBFAF6] font-display text-base shadow-sm ring-1 [font-variant-numeric:tabular-nums]"
      style={{ color: hex, boxShadow: `0 0 0 1px ${hex}40` }}
    >
      {label}
    </span>
  );
}
```

### 4.2 `MediaCrossfade`

```tsx
// apps/web/src/components/kit/MediaCrossfade.tsx (nouveau)
'use client';

import { useState, type ReactNode } from 'react';

interface MediaCrossfadeProps {
  isolated: ReactNode;
  contextual?: ReactNode;
  alt: string;
}

export function MediaCrossfade({ isolated, contextual, alt }: MediaCrossfadeProps) {
  const [contextualActive, setContextualActive] = useState(false);
  const hasContextual = Boolean(contextual);

  return (
    <div
      className="relative overflow-hidden rounded-sm"
      onMouseEnter={hasContextual ? () => setContextualActive(true) : undefined}
      onMouseLeave={hasContextual ? () => setContextualActive(false) : undefined}
      onTouchStart={hasContextual ? () => setContextualActive((p) => !p) : undefined}
      role={hasContextual ? 'button' : undefined}
      aria-label={hasContextual ? `Voir « ${alt} » en contexte` : undefined}
      aria-pressed={hasContextual ? contextualActive : undefined}
      tabIndex={hasContextual ? 0 : undefined}
      onKeyDown={
        hasContextual
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setContextualActive((p) => !p);
              }
            }
          : undefined
      }
      data-testid="composition-card-media"
    >
      <div
        className={[
          'transition-opacity duration-500',
          contextualActive ? 'opacity-0' : 'opacity-100',
        ].join(' ')}
      >
        {isolated}
      </div>
      {hasContextual ? (
        <div
          className={[
            'absolute inset-0 transition-opacity duration-500',
            contextualActive ? 'opacity-100' : 'opacity-0',
          ].join(' ')}
          aria-hidden={!contextualActive}
        >
          {contextual}
        </div>
      ) : null}
    </div>
  );
}
```

### 4.3 `SensationLine`

```tsx
// apps/web/src/components/kit/SensationLine.tsx (nouveau)
interface SensationLineProps {
  text: string;     // déjà encadré « ... »
}

export function SensationLine({ text }: SensationLineProps) {
  return (
    <p
      className="font-display italic text-encre/70 text-[15px] leading-snug pt-1"
      data-testid="composition-card-sensation"
    >
      {text}
    </p>
  );
}
```

## 5. Responsive

| Breakpoint | Layout |
|---|---|
| < 640 px | 1 colonne, padding card 16 px, image 4:5 |
| 640-1023 px | 2 colonnes, gap 40 px |
| ≥ 1024 px | 3 colonnes, gap 48 px |

Mobile : pas de hover, le tap toggle le crossfade. Pour les utilisateurs scroll-only, alternative envisagée (cf. backlog P4.1 — scroll-snap horizontal).

## 6. Accessibilité

- **Pastille numérotée** : `aria-hidden="true"` — purement décorative (le numéro est aussi dans le titre via le mock).
- **MediaCrossfade interactive** : `role="button"`, `aria-pressed`, navigation clavier.
- **Lien `Lire le détail`** : focus-visible ring champagne.
- **Section** : `aria-labelledby="composition-title"`.
- **Listes** : `role="list"` + `<li>` (déjà OK).
- **Sensation** : pas en `aria-live` (statique, pas un changement d'état).
- **Réduction motion** : la `motion.article` respecte `prefers-reduced-motion` via Framer Motion (`useReducedMotion` opt-in via `MotionConfig` global).

## 7. Performance

- **Framer Motion** : utiliser `m` (light) au lieu de `motion` pour économiser ~25 kb. Configurable via `LazyMotion`.
- **Images** : `loading="lazy"` sauf si above-the-fold (jamais le cas pour cette section).
- **Pas de `dynamic()` requis** car Framer Motion est déjà chargé pour d'autres animations FemiGlow.
- **Crossfade** : pure CSS via `transition-opacity` — aucun coût JS au mount.

## 8. Animations (Luxury §18)

| Élément | Animation | Durée | Ease |
|---|---|---|---|
| Card reveal | opacity 0→1, translateY 12→0 | 600 ms | `[0.22, 1, 0.36, 1]` |
| Stagger entre cards | delay = index × 120 ms | — | — |
| Crossfade image | opacity 0↔1 | 500 ms | default CSS |
| Hover bordure | rgb(199,204,194) → rgb(168,184,158) | 200 ms | default |

Toutes ≥ 200 ms (interdiction snappy §2.4).

## 9. Palette appliquée

| Élément | Token | Hex |
|---|---|---|
| Fond section | sable | `#EFE9DD` |
| Fond card | ivoire warm | `#FBFAF6` |
| Bordure card | gris-sauge | `#C7CCC2` |
| Pastille fond | ivoire | `#FBFAF6` |
| Pastille texte | accentColor (sauge / petale / ciel / champagne) | dynamique |
| Pastille ring | accentColor 25% | dynamique |
| Texte titre | encre désaturée | `#2A2E2A` |
| Texte volume | stone-500 | (Tailwind) |
| Lien | encre | `#2A2E2A` |

## 10. Cas d'erreur

| Cas | Fallback |
|---|---|
| `subProduct.sensation` absente | Pas de `SensationLine` rendu |
| `contextualSlot` absent | `MediaCrossfade` rend isolated seul, pas de bouton |
| `accentColor` absent | `champagne` (`#B8956B`) par défaut |
| `index` > 99 | `99` affichage capé (impossible côté schema 3-4 cards) |
| `volume` vide | Le `·` n'est pas rendu (vérification dans `buildCardHeader`) |

## 11. Tests de rendu (cf. `07-tests-strategy.md`)

- Vitest snapshot du DOM `CompositionCard` pour chaque accentColor.
- Vitest interaction : `MediaCrossfade` toggle au click/Enter/Space.
- Playwright E2E : visite `/kit`, scroll vers `#composition-title`, vérifie 3 cards + reveal animation déclenchée.
