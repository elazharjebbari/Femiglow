# Component-Media — frontend integration

## Pattern : RSC bound wrapper

Chaque composant éditorial peut être bindé via un wrapper async server :

```
HeroBound → resolveComponentSlot('home-hero', 'primary')
          → si binding actif : <Hero data={data} mediaSlot={<ComponentMedia .../>} />
          → sinon              : <Hero data={data} />  (fallback CMS)
```

Le composant cible accepte un prop optionnel `mediaSlot?: ReactNode`. C'est
ce qui permet de garder le rendu sync, testable RTL sans MSW, tout en
laissant le wrapper async résoudre la DB.

### Squelette d'un nouveau bound

```tsx
// MyComponentBound.tsx
import 'server-only';
import { MyComponent } from './MyComponent';
import { ComponentMedia } from '@/lib/components/ComponentMedia';
import { resolveComponentSlot } from '@/lib/components/resolver';

export async function MyComponentBound(props: { foo: string }) {
  const resolved = await resolveComponentSlot('my-component-key', 'primary');
  const useBinding = !!(resolved?.binding?.isActive && resolved?.media);
  if (!useBinding) return <MyComponent {...props} />;
  return (
    <MyComponent
      {...props}
      mediaSlot={<ComponentMedia componentKey="my-component-key" slot="primary" />}
    />
  );
}
```

## ComponentMedia — branches de rendu

`<ComponentMedia componentKey slot>` (RSC) — délégué à `MediaImage` / `MediaVideo`
selon `media.kind`, ou `<img src=fallbackSvg>` si pas de binding actif :

| Cas                                    | Rendu                                            |
| -------------------------------------- | ------------------------------------------------ |
| Composant introuvable                  | `<MediaPlaceholder>` muet en dev                 |
| Binding inactif **et** SVG fallback    | `<img src={fallbackSvg}>` (pas de pipeline next/image) |
| Binding inactif **et** pas de fallback | `<MediaPlaceholder>` muet                        |
| Binding actif image                    | `<MediaImage>` (variants AVIF/WebP, blurhash)    |
| Binding actif vidéo                    | `<MediaVideo>` (lazy load + poster)              |

## Loading strategy résolution

Priorité décroissante :

1. `binding.loadingStrategy` (override admin),
2. `siteComponent.defaultLoadingStrategy` (registry),
3. fallback constant : `'viewport'`.

Pour un Hero homepage : registry pose `eager` + `fetchPriority='high'`,
le wrapper passe `forcePriority` au RSC.

## Animations

Le selector admin écrit dans `componentAnimationBindings` avec
`isDefault=true` exclusif (un seul default par composant). Côté RSC, on lit le
default via `getDefaultAnimationForComponent(componentId)`. La couche client
applique le profil :

- `framer-motion` → `<m.div initial={...} whileInView={...}>` via le `LazyMotion` racine.
- `css` → classes Tailwind/keyframes injectées au build.
- `svg` → SMIL/CSS dans le SVG inline.
- `none` → render statique.

**Tous les profils respectent `prefers-reduced-motion: reduce`** quand
`respectsReducedMotion=true` (défaut). Implémentation côté client via
`useReducedMotion()` de framer-motion.

## Cache & revalidation

- `resolveComponentSlot` est wrappé par `unstable_cache` avec `tags: ['components']`.
- Toute mutation admin (POST/PATCH/DELETE binding ou animation) appelle
  `revalidateTag('components')`. Pas de bust manuel à faire.

## Surfaces actuelles

| Page                            | Bound                  | Composant cible        | Slot                    |
| ------------------------------- | ---------------------- | ---------------------- | ----------------------- |
| `app/(marketing)/page.tsx`      | `HeroBound`            | `Hero`                 | `home-hero/primary`     |
| `app/(marketing)/page.tsx`      | `JournalExtraitsBound` | `JournalExtraits`      | `journal-article-{slug}/cover` |
| `app/(marketing)/journal/page.tsx` | `FeaturedArticleBound` | `FeaturedArticle`   | `journal-featured/primary` |
| `app/(marketing)/journal/[slug]` | `ArticleHeroBound`     | `ArticleHero`        | `journal-article-{slug}/cover` |

`ArticleGrid` (client component) reste sur `featuredImage` du CMS pour
l'instant (pagination client-side ; binding initial uniquement nécessitera
une refonte legère pour passer un `Map<slug, mediaSlot>` depuis le parent
server).
