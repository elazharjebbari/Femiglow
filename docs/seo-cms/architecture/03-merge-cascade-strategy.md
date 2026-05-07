# Architecture — Cascade & merge strategy

Comment se compose la metadata finale envoyee a Next.js.

## Ordre de cascade

```
1. Defaults code (env + layout root)
       |
       v
2. seo_settings (DB singleton)
       |
       v
3. seo_overrides scope+targetKey+locale (DB ligne)
       |
       v
4. resolved Metadata (Next.js Metadata object)
```

A chaque etape, **les champs definis ecrasent** les precedents.
Les champs `null`/`undefined` sont ignores (pas d'ecrasement par
absence).

## Helper serveur

Signature :

```ts
import type { Metadata } from 'next';

export async function resolveSeoMetadata(input: {
  scope: 'page' | 'component' | 'product' | 'article';
  targetKey: string;
  locale?: string; // defaut 'fr-MA'
  defaults?: Partial<Metadata>; // defaults specifiques a la page
}): Promise<Metadata>;
```

Usage type dans une page RSC :

```ts
export async function generateMetadata(): Promise<Metadata> {
  return resolveSeoMetadata({
    scope: 'page',
    targetKey: 'kit',
    defaults: { title: 'Le Kit FemiGlow', description: '...' },
  });
}
```

Le helper est cache via `unstable_cache` avec tag `'seo'` et
sous-tag `seo:${scope}:${targetKey}`.

## Regles de merge par champ

| Champ | Strategie |
|---|---|
| `title` | string override remplace |
| `description` | string override remplace |
| `keywords` | array override remplace (pas de merge profond) |
| `openGraph.title` | fallback chain : `og_title` -> `title` |
| `openGraph.description` | fallback : `og_description` -> `description` |
| `openGraph.images` | si `og_image_media_id` -> URL media ; sinon si `og_image_template` -> `/api/og/[scope]/[targetKey]` ; sinon default settings ; sinon SVG existant |
| `twitter.card` | override > settings (`summary_large_image` defaut) |
| `alternates.canonical` | override.canonical sinon construit `${SITE_URL}${path}` |
| `robots` | merge `{ index, follow }` override > settings > defaults |
| `other` (json-ld) | structured_data override est merge profond avec defaults |

### Cas special : `noindex`

Si l'override force `robots_index: false` :
- la metadata renvoie `{ robots: { index: false } }`
- `sitemap.ts` exclut cette URL (filtre sur les overrides charges)
- le linter signale un warning si aussi `published`

## Fallback OG image

```
override.og_image_media_id
    -> media.url
override.og_image_template (enum)
    -> /api/og/{scope}/{targetKey}
seo_settings.default_og_image_media_id
    -> media.url
hard-coded SVG (apps/web/public/og/*.svg)
```

## Cache & invalidation

- Lecture : `unstable_cache(fn, ['seo', scope, targetKey], { tags: ['seo', `seo:${scope}:${targetKey}`] })`
- Mutation API : `revalidateTag('seo')` global + `revalidateTag(\`seo:${scope}:${targetKey}\`)` cible
- Settings : `revalidateTag('seo')` (impact toutes les pages)

## Cas erreur

- DB indisponible -> log + fallback sur defaults code (page rendue)
- JSON structured_data invalide -> ignore + log warning
- Media supprime (FK orphelin) -> fallback OG template
