# Frontend — Intégration médias produit

Le module produits ne réinvente **pas** la gestion média : il
réutilise `component-media-system` via une convention de nommage
des `componentKey`.

## Convention

```
component_media_bindings.component_key = `product:${slug}`
component_media_bindings.slot          = 'packshot' | 'lifestyle' | 'gallery'
```

Le slot `gallery` est multi (0..N) ; les autres sont single.

## Déclaration des slots

`apps/web/src/lib/components/registry/products.ts` :

```ts
export const productComponent = (slug: string) =>
  defineComponent({
    key: `product:${slug}`,
    label: `Produit ${slug}`,
    slots: [
      {
        key: 'packshot',
        label: 'Packshot principal',
        kind: 'single',
        acceptKinds: ['image'],
        aspectRatioHint: '1 / 1',
        required: true,
      },
      {
        key: 'lifestyle',
        label: 'Photo lifestyle',
        kind: 'single',
        acceptKinds: ['image'],
        aspectRatioHint: '4 / 3',
      },
      {
        key: 'gallery',
        label: 'Galerie additionnelle',
        kind: 'multi',
        acceptKinds: ['image', 'video'],
        max: 8,
      },
    ],
  });
```

Le registre est généré dynamiquement à partir de la liste des
slugs publiés (`listPublishedProductSlugs()`).

## Helper RSC `resolveProductMedia`

`apps/web/src/lib/products/media.ts` :

```ts
export async function resolveProductMedia(
  slug: string,
  slot: 'packshot' | 'lifestyle' | 'gallery',
): Promise<ResolvedMedia | ResolvedMedia[] | null> {
  const componentKey = `product:${slug}`;
  if (slot === 'gallery') {
    return resolveMediaList(componentKey, 'gallery');   // → []
  }
  return resolveMediaSingle(componentKey, slot);        // → ResolvedMedia | null
}
```

## Composants RSC

### `<ProductPackshot>`

```tsx
export async function ProductPackshot({ slug }: { slug: string }) {
  const media = await resolveProductMedia(slug, 'packshot');
  if (!media) return <FallbackPackshot slug={slug} />;
  return <ResponsiveImage media={media} sizes="(min-width: 768px) 50vw, 100vw" />;
}
```

### `<ProductGallery>`

```tsx
export async function ProductGallery({ slug }: { slug: string }) {
  const items = await resolveProductMedia(slug, 'gallery') as ResolvedMedia[];
  if (items.length === 0) return null;
  return <Carousel items={items} />;
}
```

### Fallback

`<FallbackPackshot>` rend un SVG placeholder avec le nom du produit
au centre. Évite les espaces vides en prod si un produit publié n'a
pas (encore) de packshot — un guard publish empêche normalement ce
cas.

## Côté admin

L'onglet **Médias** de `/admin/products/[slug]` rend
`<ProductMediaPanel>` qui mappe les 3 slots vers `<SlotCard>` du
component-media-system :

```tsx
<SlotCard
  slot={slotDefinition}                  // packshot | lifestyle | gallery
  binding={currentBinding}
  fallbackSvg={null}
  busy={isMutating}
  onPick={() => openPicker({ componentKey: `product:${slug}`, slot: 'packshot' })}
  onUnassign={() => unassign(...)}
  onToggleActive={...}
  onDelete={...}
/>
```

## Cache

Pas de cache propre. Le helper `resolveMediaSingle/List` du
component-media-system a déjà :

- `unstable_cache` avec tag `media`
- Invalidation auto sur les bindings changes via `revalidateTag('media')`

Au publish d'un produit qui a changé son packshot :

```ts
// dans la route publish
invalidateProduct(slug);                  // products + product:slug
revalidateTag('media');                    // safety pour les bindings
```

## Variantes et médias

Question récurrente : « peut-on lier un packshot par variante ? »

V1 : non. Un seul packshot par produit. Si besoin de visuels par
variante, utiliser le slot `gallery` avec convention naming dans
le `caption` du média.

Post-v1 : ajouter un slot dynamique
`packshot:variant:${variantId}` (TBD).

## OG image

Quand un override SEO `scope=product, targetKey=<slug>` a un
`og_image_template='product'`, la route `/api/og/product/[slug]`
charge le packshot via `resolveProductMedia(slug, 'packshot')`
pour le composer dans le PNG.

## Tests

- Unitaires sur `resolveProductMedia` (slot single vs multi, fallback null)
- RTL sur `<ProductMediaPanel>` (intégration SlotCard)
- E2e Playwright : créer un produit, uploader un packshot, vérifier
  que `/produits/[slug]` rend bien la photo
