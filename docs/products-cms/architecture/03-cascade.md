# Architecture — Cascade défaut → DB

## Principe

Aucune fiche produit n'est cassée par l'introduction du module. La
résolution serveur applique :

```
registry default (codé)
    └── slug-by-slug
       ↓ remplace ou augmente
DB row (status='published')
    ↓ deep-merge (non-null wins)
resolved Product
```

Si aucune ligne DB pour un slug donné → la fiche reste 100% codée.
Si une ligne DB existe mais champ par champ `null` → fallback codé
champ par champ.

## API du helper

`apps/web/src/lib/products/resolve.ts`

```ts
export async function resolveProduct(slug: string): Promise<ResolvedProduct | null> {
  const codedDefault = await getRegistryProduct(slug);
  const dbRow = await getProductFromDb(slug);

  if (!codedDefault && !dbRow) return null;

  if (!dbRow || dbRow.status !== 'published') {
    return codedDefault ? toResolved(codedDefault) : null;
  }

  return mergeProduct(codedDefault, dbRow);
}
```

`mergeProduct` :

- Pour chaque champ de `Product` : DB non-null gagne
- Pour `variants` : 
  - Si DB a au moins 1 variante → DB wins (override total)
  - Sinon → variantes codées
- Pour `media` : résolu séparément via
  `resolveProductMedia(slug, slot)`

## Helpers RSC

`apps/web/src/lib/products/server.ts`

```ts
export async function ProductDescription({ slug }: { slug: string }) {
  const product = await resolveProduct(slug);
  if (!product) return null;
  return <RichText source={product.description} />;
}

export async function ProductVariants({ slug }: { slug: string }) {
  const product = await resolveProduct(slug);
  if (!product) return null;
  return <VariantPicker variants={product.variants} />;
}
```

## Cas particuliers

### Statut `archived`

Une fiche `archived` est :

- exclue des listings publics (`/produits`)
- 410 Gone sur `/produits/[slug]` (au lieu de 404, pour SEO)
- toujours visible dans `/admin/products?status=archived`

### Slug dans le registre mais pas en DB

C'est l'état initial. Le seed migre tous les registres vers la DB en
une fois (`status='published'`). Si un nouveau produit est ajouté
au registre sans seed → fallback codé OK.

### Slug en DB mais pas dans le registre

Cas typique : produit créé entièrement depuis l'admin. Le rendu
fonctionne uniquement avec les données DB. Aucun fallback codé.

→ Couvert par les tests : un produit « né en admin » doit rendre
correctement sans intervention dev.

### Champs nullables côté DB

Convention : tous les champs textuels sont `NOT NULL` dans la table
mais peuvent être chaînes vides. Un champ vide en DB **prend le pas**
sur le défaut codé (l'admin a explicitement effacé). Pour revenir au
défaut codé, il faut `NULL`-er le champ via une action UI dédiée
(« Réinitialiser au défaut »).

### Variantes : tout-ou-rien

Si DB a une seule variante et le registre en avait 3 → l'admin a
supprimé 2 variantes. Le résultat = 1 seule variante (DB wins
totalement, pas de merge partiel).

Pour ajouter une variante manquante : la recréer dans l'admin (UI
fournit un bouton **Repartir des variantes par défaut** qui copie
les variantes codées comme nouvelles lignes DB).

## Cache & invalidation

```ts
const _resolveProductCached = unstable_cache(
  resolveProduct,
  ['products', 'resolve'],
  {
    tags: ['products'],
    revalidate: 3600,
  },
);

export const resolveProductBySlug = (slug: string) =>
  unstable_cache(
    () => resolveProduct(slug),
    ['products', 'resolve', slug],
    {
      tags: ['products', `product:${slug}`],
      revalidate: 3600,
    },
  )();
```

Invalidation : `revalidateTag('products')` après tout publish/archive,
plus `revalidateTag(\`product:${slug}\`)` ciblé.

## Tests cascade

Fixtures dans `apps/web/src/lib/products/__fixtures__/cascade.ts` :

| Cas                                 | Registre | DB   | Résultat |
|-------------------------------------|----------|------|----------|
| Fiche jamais migrée                 | `kit`    | -    | registre |
| Fiche migrée intacte                | `kit`    | `kit` (= registre) | merge identique |
| Fiche migrée modifiée               | `kit`    | `kit` (title custom) | DB title, registre reste pour autres champs |
| Fiche née en admin                  | -        | `nouveau-rituel` | DB only |
| Fiche archivée                      | `kit`    | `kit` archived | null (404 front, 410 si activé) |
| Variantes vidées en admin           | 3 var.   | 1 var. | 1 var. (DB wins) |

100% des branches couvertes.
