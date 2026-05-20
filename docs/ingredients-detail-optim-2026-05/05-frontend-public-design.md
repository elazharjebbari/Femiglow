# 05 — Frontend public design

## 1. Hiérarchie cible

```
IngredientsDetailsBound (RSC wrapper)
  └─ IngredientsDetails (Server, layout + intro)
        ├─ <header> kicker + H2 + subtitle
        ├─ mediaSlot? (image éditoriale 16:9)
        └─ Pour chaque SubProduct (×3) :
             SubProductBlock (Server)
                ├─ <details> accordéon mobile, ouvert par défaut sur sm+
                │     ├─ <summary> SubProductHeader
                │     │     ├─ NumberBadge (réutilisé de kit/composition)
                │     │     ├─ Titre + volume + usageHint
                │     │     └─ Chevron (CSS rotation au open)
                │     │
                │     ├─ NarrativeIntro (Client, Cormorant italique)
                │     │
                │     ├─ ResponsiveIngredientList (Client wrapper)
                │     │     ├─ mobile (sm-) : IngredientCard list
                │     │     └─ desktop (sm+) : IngredientsTable
                │     │
                │     ├─ CertificationsList (Server)
                │     │
                │     └─ PostCtaLink (Client) → #commander-femiglow
                │
                └─ AccordionTracking (Client, IntersectionObserver →
                   `composition_narrative_view`)
```

## 2. Composant `IngredientsDetails` (refonte)

`apps/web/src/components/sections/IngredientsDetails.tsx` — refonte.

```tsx
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import type { SubProduct } from '@/lib/schemas';
import { SubProductBlock } from '@/components/commerce/SubProductBlock';

interface IngredientsDetailsProps {
  composition: SubProduct[];
  anchor?: string;
  mediaSlot?: ReactNode;
}

export function IngredientsDetails({
  composition,
  anchor = 'ingredients-details',
  mediaSlot,
}: IngredientsDetailsProps) {
  return (
    <section id={anchor} aria-labelledby="ingredients-title" className="bg-creme-warm py-16 sm:py-24">
      <Container width="wide">
        <div className="mb-12 max-w-2xl space-y-4">
          <Kicker>Le détail</Kicker>
          <Heading id="ingredients-title" as="h2" size="display-sm">
            La composition lue ligne par ligne.
          </Heading>
          <Text size="body" tone="secondary" prose>
            Tout est dit&#x202f;: noms d'usage, INCI, fonction, origine,
            concentration. Pas d'angle mort, pas de promesse cachée derrière
            une formule.
          </Text>
        </div>
        {mediaSlot && (
          <div className="mb-12 overflow-hidden rounded-md">{mediaSlot}</div>
        )}
        <div className="space-y-12">
          {composition.map((sub, index) => (
            <SubProductBlock
              key={sub.id}
              subProduct={sub}
              index={index}
              anchor={anchor}
              defaultOpen={index === 0}  // 1er ouvert par défaut sur mobile
            />
          ))}
        </div>
      </Container>
    </section>
  );
}
```

## 3. Composant `SubProductBlock` (nouveau)

`apps/web/src/components/commerce/SubProductBlock.tsx` (nouveau).

Structure :

```tsx
'use client';

import { useId } from 'react';
import { NumberBadge } from '@/components/kit/NumberBadge';
import { ResponsiveIngredientList } from './ResponsiveIngredientList';
import { CertificationsList } from './CertificationsList';
import { NarrativeIntro } from './NarrativeIntro';
import { PostCtaLink } from './PostCtaLink';
import { resolveAccentHex } from '@/lib/composition/copy';
import type { SubProduct } from '@/lib/schemas';

interface Props {
  subProduct: SubProduct;
  index: number;
  anchor: string;
  defaultOpen?: boolean;
}

export function SubProductBlock({ subProduct, index, anchor, defaultOpen }: Props) {
  const id = `${anchor}-${subProduct.id}`;
  const accent = resolveAccentHex(subProduct.accentColor);
  const titleId = useId();

  return (
    <article id={id} aria-labelledby={titleId}>
      <details
        className="group [&[open]_.chevron]:rotate-180"
        // Sur mobile : accordéon. Sur sm+ : toujours ouvert via CSS forcé.
        // open par défaut si defaultOpen ; sinon stateful.
        open={defaultOpen}
        data-testid={`ingredients-details-${subProduct.id}`}
      >
        <summary
          id={titleId}
          className="cursor-pointer list-none flex items-center gap-3 py-4 sm:py-2 [&::-webkit-details-marker]:hidden"
        >
          <NumberBadge label={String(index + 1).padStart(2, '0')} hex={accent} />
          <div className="flex-1">
            <h3 className="font-display text-2xl text-encre">
              {subProduct.name} — {subProduct.volume}
              {subProduct.usageHint && (
                <span className="ml-2 text-encre/55 font-body italic text-base">
                  · {subProduct.usageHint}
                </span>
              )}
            </h3>
          </div>
          <ChevronDown className="chevron sm:hidden transition-transform" aria-hidden="true" />
        </summary>

        <div className="mt-4 sm:mt-2 space-y-6">
          {subProduct.narrative && (
            <NarrativeIntro
              text={subProduct.narrative}
              subProductId={subProduct.id}
            />
          )}

          <ResponsiveIngredientList
            ingredients={subProduct.ingredients}
            subProductId={subProduct.id}
            accentColor={subProduct.accentColor}
          />

          <CertificationsList items={subProduct.certifications} />

          <PostCtaLink
            href={`#commander-femiglow`}
            subProductId={subProduct.id}
          />
        </div>
      </details>
    </article>
  );
}
```

**Note CSS** : forcer l'accordéon ouvert sur desktop sans casser `<details>` natif :

```css
@media (min-width: 640px) {
  /* sm+ */
  details {
    open: true; /* via attribute selector */
  }
  details > summary > .chevron { display: none; }
}
```

Plus simple : utiliser une class Tailwind avec `[open]:` selector + JS hook qui force `open` au mount sur desktop. Ou utiliser un wrapper qui ne génère `<details>` qu'en mobile. **À trancher en phase 2** (le pragmatisme : utiliser un breakpoint hook).

## 4. Composant `NarrativeIntro` (nouveau)

`apps/web/src/components/commerce/NarrativeIntro.tsx`.

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { useTracking } from '@/lib/tracking/use-tracking';

interface Props {
  text: string;
  subProductId: string;
}

export function NarrativeIntro({ text, subProductId }: Props) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const { emit } = useTracking();

  // IntersectionObserver — émission `composition_narrative_view`
  // une seule fois quand l'intro entre dans le viewport.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let fired = false;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!fired && entry?.isIntersecting) {
          fired = true;
          emit('composition_narrative_view', { sub_product_id: subProductId });
          obs.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [emit, subProductId]);

  return (
    <p
      ref={ref}
      className="font-display italic text-encre/75 text-lg leading-[1.55] max-w-prose"
      data-testid={`composition-narrative-${subProductId}`}
    >
      {text}
    </p>
  );
}
```

## 5. Composant `ResponsiveIngredientList` (nouveau)

`apps/web/src/components/commerce/ResponsiveIngredientList.tsx`.

```tsx
import { IngredientsTable } from './IngredientsTable';
import { IngredientCard } from './IngredientCard';
import { sortByConcentrationDesc } from '@/lib/kit/composition/sort';
import type { IngredientDetailed, SubProductAccentColor } from '@/lib/schemas';

interface Props {
  ingredients: IngredientDetailed[];
  subProductId: string;
  accentColor?: SubProductAccentColor;
}

export function ResponsiveIngredientList({
  ingredients,
  subProductId,
  accentColor,
}: Props) {
  const sorted = sortByConcentrationDesc(ingredients);
  return (
    <>
      {/* Mobile : liste de cards verticales */}
      <ul className="space-y-3 sm:hidden" aria-label="Composition par ordre décroissant">
        {sorted.map((ing) => (
          <li key={ing.inci}>
            <IngredientCard
              ingredient={ing}
              subProductId={subProductId}
              accentColor={accentColor}
            />
          </li>
        ))}
      </ul>

      {/* Desktop : tableau 5 colonnes (existant, lignes alternées) */}
      <div className="hidden sm:block">
        <IngredientsTable ingredients={sorted} subProductId={subProductId} />
      </div>
    </>
  );
}
```

## 6. Composant `IngredientCard` (nouveau — mobile)

`apps/web/src/components/commerce/IngredientCard.tsx`.

```tsx
'use client';

import { InciTooltip } from './InciTooltip';
import type { IngredientDetailed, SubProductAccentColor } from '@/lib/schemas';
import { resolveAccentHex } from '@/lib/composition/copy';

interface Props {
  ingredient: IngredientDetailed;
  subProductId: string;
  accentColor?: SubProductAccentColor;
}

export function IngredientCard({ ingredient, subProductId, accentColor }: Props) {
  const accent = resolveAccentHex(accentColor);
  const pct = ingredient.concentrationPct;
  return (
    <div
      className="rounded-md border border-encre/10 bg-creme p-4"
      data-testid={`ingredient-card-${ingredient.inci}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-base text-encre flex-1">
          {ingredient.name}
        </p>
        {pct !== undefined && (
          <p
            className="font-display text-base font-medium [font-feature-settings:'tnum','lnum']"
            style={{ color: accent }}
          >
            {pct}{' '}%
          </p>
        )}
      </div>
      <p className="mt-1 text-xs text-encre/55 font-body">
        {ingredient.inci}
        {ingredient.inciDefinition && (
          <InciTooltip
            inciTerm={ingredient.inci}
            definition={ingredient.inciDefinition}
            subProductId={subProductId}
          />
        )}
      </p>
      <p className="mt-2 text-sm text-encre/75">
        {ingredient.function} <span className="text-encre/45">·</span> {ingredient.origin}
      </p>
    </div>
  );
}
```

## 7. Composant `InciTooltip` (nouveau)

`apps/web/src/components/commerce/InciTooltip.tsx`.

Pattern ARIA tooltip — utilise un `<button>` + popover positionné par
Floating UI ou pur CSS (fallback `<details>` natif si Floating UI absent).

**Décision** : utiliser **CSS pur** + `popover` HTML5 (`popover="auto"`)
pour rester simple et a11y. Sur navigateurs sans support `popover`
(< Chrome 114), fallback `<details>`.

```tsx
'use client';

import { useId } from 'react';
import { useTracking } from '@/lib/tracking/use-tracking';

interface Props {
  inciTerm: string;
  definition: string;
  subProductId: string;
}

export function InciTooltip({ inciTerm, definition, subProductId }: Props) {
  const popoverId = useId();
  const { emit } = useTracking();

  return (
    <>
      <button
        type="button"
        popoverTarget={popoverId}
        aria-label={`Définition de ${inciTerm}`}
        onClick={() =>
          emit('composition_inci_tooltip_open', {
            sub_product_id: subProductId,
            inci_term: inciTerm,
          })
        }
        className="ml-1 inline-flex items-center justify-center h-5 w-5 rounded-full text-encre/55 hover:text-encre focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-encre/40"
        data-testid={`inci-tooltip-trigger-${inciTerm}`}
      >
        <span aria-hidden="true">ⓘ</span>
      </button>
      <div
        id={popoverId}
        popover="auto"
        role="tooltip"
        className="popover-card rounded-md border border-encre/10 bg-creme p-3 max-w-xs shadow-md"
        data-testid={`inci-tooltip-popover-${inciTerm}`}
      >
        <p className="text-xs uppercase tracking-[0.18em] text-encre/55">{inciTerm}</p>
        <p className="mt-1 text-sm text-encre">{definition}</p>
      </div>
    </>
  );
}
```

**A11y** :
- `<button>` natif → tab navigable, Enter/Space activable
- `popover="auto"` → Esc ferme, tap hors zone ferme
- `role="tooltip"` sur la card
- `aria-label` descriptif

**Cleanup** : pas d'event listener à enregistrer manuellement, le browser gère.

## 8. Composant `PostCtaLink` (nouveau)

`apps/web/src/components/commerce/PostCtaLink.tsx`. Réutilise la logique
de `VideoPostCta` (cf. video phase 5).

```tsx
'use client';

import { useCallback } from 'react';
import { useTracking } from '@/lib/tracking/use-tracking';

interface Props {
  href: string;        // par défaut #commander-femiglow
  subProductId: string;
}

export function PostCtaLink({ href, subProductId }: Props) {
  const { emit } = useTracking();
  const onClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      emit('composition_post_cta_click', {
        sub_product_id: subProductId,
        cta_target: href,
      });
      if (href.startsWith('#')) {
        const target = document.getElementById(href.slice(1));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    },
    [emit, href, subProductId],
  );
  return (
    <div className="text-right">
      <a
        href={href}
        onClick={onClick}
        data-testid={`composition-post-cta-${subProductId}`}
        className="inline-flex items-center gap-1 pt-1 font-body text-[12px] uppercase tracking-[0.18em] text-encre/70 underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-encre/40"
      >
        Voir le pack <span aria-hidden="true">↓</span>
      </a>
    </div>
  );
}
```

## 9. Refactor `IngredientsTable` (existant)

`apps/web/src/components/commerce/IngredientsTable.tsx` — adapté :
- accepte `ingredients: IngredientDetailed[]` au lieu de `subProduct: SubProduct`
- ajoute lignes alternées `bg-creme` / `bg-creme-warm/40`
- accepte `subProductId` pour clés stables
- accepte `accentColor` pour teinter la colonne `%`

```tsx
import { sortByConcentrationDesc } from '@/lib/kit/composition/sort';
import { InciTooltip } from './InciTooltip';
import type { IngredientDetailed, SubProductAccentColor } from '@/lib/schemas';
import { resolveAccentHex } from '@/lib/composition/copy';

interface Props {
  ingredients: IngredientDetailed[];
  subProductId: string;
  accentColor?: SubProductAccentColor;
}

export function IngredientsTable({ ingredients, subProductId, accentColor }: Props) {
  const accent = resolveAccentHex(accentColor);
  const sorted = sortByConcentrationDesc(ingredients);

  return (
    <div role="region" aria-label={`Composition`} tabIndex={0} className="focus-visible:outline-none">
      <table className="w-full border-collapse text-sm" data-testid={`ingredients-table-${subProductId}`}>
        <thead className="bg-sauge-soft text-left text-[11px] uppercase tracking-[0.12em] text-encre/70">
          <tr>
            <th scope="col" className="p-3 font-medium">Ingrédient</th>
            <th scope="col" className="p-3 font-medium">INCI</th>
            <th scope="col" className="p-3 font-medium">Fonction</th>
            <th scope="col" className="p-3 font-medium">Origine</th>
            <th scope="col" className="p-3 text-right font-medium">%</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((ing, i) => (
            <tr
              key={`${subProductId}-${ing.inci}`}
              className={i % 2 === 0 ? 'bg-creme' : 'bg-creme-warm/40'}
            >
              <th scope="row" className="p-3 text-left font-medium text-encre">{ing.name}</th>
              <td className="p-3 text-encre/70">
                {ing.inci}
                {ing.inciDefinition && (
                  <InciTooltip
                    inciTerm={ing.inci}
                    definition={ing.inciDefinition}
                    subProductId={subProductId}
                  />
                )}
              </td>
              <td className="p-3 text-encre">{ing.function}</td>
              <td className="p-3 text-encre">{ing.origin}</td>
              <td className="p-3 text-right [font-feature-settings:'tnum','lnum']" style={{ color: ing.concentrationPct ? accent : undefined }}>
                {ing.concentrationPct !== undefined ? `${ing.concentrationPct} %` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## 10. Accordéon — implémentation responsive

Approche pragmatique : **toujours `<details>`** + CSS qui désactive
l'accordéon (force `[open]`, cache chevron) sur `sm+`.

```css
/* via Tailwind arbitrary selectors */
sm:[&_details]:open  /* not standard — need workaround */
```

**Workaround** : utiliser un script léger qui met `open` sur tous les `<details>` quand la window dépasse 640 px. Ou simplement composer un `useBreakpoint('sm')` hook + render conditionnel `<details>` vs `<div>`.

**Décision finale** : composer côté `SubProductBlock` un hook qui détecte
le breakpoint et pose `<details open>` en dur sur desktop. Pas d'animation
nécessaire au passage de breakpoint (jamais visible utilisateur).

## 11. CSS — lignes alternées + tokens

Aucun nouveau token CSS. Utilise les tokens existants :
- `creme` = `#FBFAF6`
- `creme-warm` = `#F7F4EE`
- `encre` = `#2C2A28`
- `sauge-soft` (déjà utilisé pour `<thead>`)

## 12. Performance / SSR

- `IngredientsDetails` reste un **Server Component** (rendu statique).
- `NarrativeIntro` est Client (IntersectionObserver).
- `IngredientCard` peut rester Server, sauf que `InciTooltip` est Client →
  enfant Client dans Server OK avec React 18.
- `SubProductBlock` est Client (le hook breakpoint + state `open`).
- `PostCtaLink` est Client (scroll smooth + emit).

Bundle impact estimé :
- `NarrativeIntro` ~ 0,3 kB
- `IngredientCard` ~ 0,8 kB
- `InciTooltip` ~ 0,7 kB
- `PostCtaLink` ~ 0,4 kB
- `SubProductBlock` ~ 1,5 kB (avec hook breakpoint)
- `ResponsiveIngredientList` ~ 0,3 kB
- Sort helper ~ 0,2 kB

**Total ~ 4,2 kB gzip** ajouté au bundle `/kit`. **Sous la limite de 6 kB**
fixée dans `02-vision-objectifs.md`.

## 13. A11y récap

| Élément | Attribut | Vérification |
|---|---|---|
| `<section>` | `aria-labelledby="ingredients-title"` | snapshot |
| `<article>` SubProductBlock | `aria-labelledby={titleId}` | snapshot |
| `<details>` | `open` (initial) | snapshot + test |
| `<summary>` | text accessible (titre + volume + usageHint) | snapshot |
| `<button>` tooltip | `aria-label`, `popoverTarget`, focus-visible ring | axe + test |
| `popover` | `role="tooltip"` | axe |
| `<a>` PostCtaLink | text accessible « Voir le pack ↓ » | snapshot |
| `<table>` desktop | `role="region"`, `aria-label`, `tabIndex` | déjà présent |
| `<th scope="row">` ingredient name | preservation | snapshot |

Cible : **0 violation axe sérieuse/critique** sur `section#ingredients-details`.

## 14. Tracking events émis

| Event | Émetteur | Quand |
|---|---|---|
| `composition_narrative_view` | `NarrativeIntro` | IntersectionObserver 50 % au viewport |
| `composition_accordion_open` | `SubProductBlock` | Au `onToggle` event si `open === true` |
| `composition_inci_tooltip_open` | `InciTooltip` | Au clic sur le bouton ⓘ |
| `composition_post_cta_click` | `PostCtaLink` | Au clic sur le lien |

## 15. Wireframe mobile final

```
┌────────────────────────────────────────────────┐
│  LE DÉTAIL                                      │
│  La composition lue                             │
│  ligne par ligne.                               │
│  ─────                                          │
│  Tout est dit : noms d'usage, INCI…             │
│                                                 │
│  ┌─[image éditoriale 16:9]────────────────┐     │
│  └────────────────────────────────────────┘     │
│                                                 │
│  ▼ ⓪① 1 Paste — 15 g · une noisette filme dix │  ← summary
│       doigts                                    │
│  ┃                                              │
│  ┃ « 12 % de cire d'abeille, fondue à basse   │  ← intro narrative
│  ┃   T° par la coopérative apicole du Moyen   │     Cormorant italique
│  ┃   Atlas. Une noisette filme dix doigts. »  │
│  ┃                                              │
│  ┃ ╭──────────────────────────────╮            │
│  ┃ │ Cire d'abeille          12 % │ ←accent    │  ← IngredientCard
│  ┃ │ Cera Alba ⓘ                   │            │
│  ┃ │ Filme · Coopérative Atlas      │            │
│  ┃ ╰──────────────────────────────╯            │
│  ┃ ╭──────────────────────────────╮            │
│  ┃ │ Huile de jojoba          8 % │            │
│  ┃ │ Simmondsia Chinensis Seed Oil ⓘ│           │
│  ┃ │ Hémisphage · Souss-Massa      │            │
│  ┃ ╰──────────────────────────────╯            │
│  ┃ …                                            │
│  ┃                                              │
│  ┃ [Cosmos Organic — Ecocert] [Vegan — EVE]    │  ← certifications
│  ┃                                              │
│  ┃                            Voir le pack ↓   │  ← post-CTA
│                                                 │
│  ▶ ⓪② 2 Powder — 8 g · glisse, ne grise pas    │  ← REPLIÉ
│  ▶ ⓪③ 3 Polissoir Step 4 — 1 pièce             │  ← REPLIÉ
└────────────────────────────────────────────────┘
```
