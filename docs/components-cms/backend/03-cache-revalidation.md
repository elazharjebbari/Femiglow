# B3 — Cache et revalidation

## Contrat

> Le rendu public lit **toujours** via `unstable_cache`. Toute mutation
> qui change ce que verrait un visiteur invalide les tags concernés.
> Toute mutation qui ne change que des drafts **ne touche pas** au cache.

Cette discipline garantit qu'on n'a jamais à invalider en panique
(tag `components` nucléaire) tant qu'on suit les règles ci-dessous.

## Tags utilisés

| Tag | Portée | Réutilisé de l'existant ? |
|---|---|---|
| `components` | nucléaire — invalide tout ce qui dépend du registre/components | oui (existant Component-Media) |
| `components:fields:<componentKey>` | par composant — granulaire | nouveau (CMS) |
| `components:fields:<componentKey>:<locale>` | locale-scoped, futur multilingue | défini, **non utilisé en v1** |

> En v1, on n'a qu'une locale. Le tag `:locale` est **réservé** pour
> qu'une migration v2 (multilingue UI) n'ait pas à toucher au schéma
> de tags. `revalidateTag('components:fields:home-hero:fr')` est
> safe : il n'est juste pas encore associé.

## Clefs `unstable_cache`

```ts
// apps/web/src/lib/components/field-resolver.ts (rappel F2)

// Lecture batchée d'un composant
unstable_cache(fn, ['component-fields-batch'], {
  tags: (componentKey: string, locale = 'fr') => [
    'components',
    `components:fields:${componentKey}`,
    // En v2 : `components:fields:${componentKey}:${locale}`
  ],
});

// Lecture unitaire d'un champ (rarement utilisé)
unstable_cache(fn, ['component-field'], {
  tags: (componentKey: string, _fieldKey: string, _locale = 'fr') => [
    'components',
    `components:fields:${componentKey}`,
  ],
});
```

> Les arguments de la fonction sont injectés dans le **cache key** par
> Next, pas dans le tableau positionnel. Les tags eux sont calculés
> via `tags: (...args) => […]`.

## Matrice de revalidation

| Action | Tag(s) à invalider | Pourquoi |
|---|---|---|
| `PATCH /fields/[fieldKey]` (upsert draft) | **aucun** | Le rendu public ne lit pas les drafts. |
| `POST /fields/[fieldKey]/publish` | `components`, `components:fields:<key>` | La valeur publique change. |
| `POST /fields/[fieldKey]/schedule` | aucun | Scheduled n'est pas lu publiquement. |
| `POST /fields/[fieldKey]/cancel-schedule` | aucun | Idem. |
| `POST /fields/[fieldKey]/restore` | aucun | Restore crée un draft, pas un published. |
| Cron `promote-scheduled-fields` | par composant promu : `components`, `components:fields:<key>` | Comme un publish manuel. |
| Seed pipeline (ajout d'un champ avec `defaultValue`) | aucun | Le champ vient d'apparaître ; aucun cache antérieur ne le mentionne. |
| Seed pipeline (archivage d'un champ orphelin) | `components:fields:<key>` | La forme du composant change. |

### Code

```ts
// apps/web/src/app/api/admin/components/[key]/fields/[fieldKey]/publish/route.ts
import { revalidateTag } from 'next/cache';

// … après la transaction de promotion
revalidateTag('components');
revalidateTag(`components:fields:${cmp.key}`);
// pas de revalidatePath !
```

## Pourquoi pas `revalidatePath`

`revalidatePath('/')` invalide la route `/` ; mais un même composant
peut apparaître sur N pages (`/`, `/maison`, `/journal/*`). On
devrait maintenir une carte `componentKey → routes[]`, qui dérive
elle-même des imports → couplage fragile.

`revalidateTag` est tag-driven : tout RSC qui a marqué son fetch
(via `unstable_cache` + tags) est invalidé sans qu'on connaisse les
routes. Découplage propre.

## Stratégie de cache stampede

### Niveau 1 — déduplication React (request-scoped)

Pendant un même request RSC, si `resolveComponentFields('home-hero')`
est appelé deux fois (ex `<Hero>` et `<HeroFooter>`), Next dedupe au
niveau React (`unstable_cache` est mémoizé par `cache()` sous le
capot). Aucune action requise.

### Niveau 2 — ISR + tags

Un cache miss déclenche une seule exécution serveur ; les autres
requêtes concurrentes attendent. Coût : la première qui rate paie le
SELECT (~30 ms, cf. A3).

### Niveau 3 — fan-out post-publish

Si 1000 visiteurs lisent la page au moment où on publie :

1. `revalidateTag('components:fields:home-hero')` marque le tag stale.
2. La requête suivante reconstruit le cache (1 cache miss).
3. Toutes les autres servent le résultat reconstruit.

C'est le comportement standard de Next.js : **pas** de stampede
explicite à gérer.

## Pré-warming

Optionnel, pas implémenté en v1. Si jamais le cache miss post-publish
devient un goulot, on peut lancer une `fetch('/')` avec
`X-Prerender: 1` après chaque publish. Documenté pour mémoire.

## Invalidation en cascade

### Cascade 1 — archivage automatique d'un champ

Le seed (cf. B4) détecte qu'un champ a disparu du registre et marque
le binding `archived`. Effet :

- la cascade A3 retombe sur `defaultValue` (s'il reste un default) ou
  sur `null`.
- on **doit** invalider `components:fields:<key>` pour que le rendu
  reflète l'archivage.

```ts
// apps/web/src/lib/components/seed-pipeline.ts (extension B4)
async function archiveOrphanFieldBindings(componentId: string, registryKeys: Set<string>) {
  const archived = await archiveFieldsNotIn(componentId, registryKeys);
  if (archived.length > 0) {
    revalidateTag('components');
    for (const cmp of new Set(archived.map((b) => b.componentKey))) {
      revalidateTag(`components:fields:${cmp}`);
    }
  }
}
```

### Cascade 2 — composant désactivé

Si `siteComponents.disabledAt` est posé, on archive tous ses
bindings (statut `archived`) et on invalide `components` (nucléaire,
suffisant).

### Cascade 3 — restauration depuis history

Restore crée un **draft**. Pas d'invalidation publique.

## Comment tester l'invalidation

### Unit (Vitest)

```ts
// apps/web/src/lib/components/field-resolver.spec.ts
import { vi } from 'vitest';
import { revalidateTag } from 'next/cache';

vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (fn: any) => fn, // bypass cache pour les tests
}));

it('publish invalide les bons tags', async () => {
  await POST(buildRequest({ headers: { … } }), { params: { key: 'home-hero', fieldKey: 'title' } });
  expect(revalidateTag).toHaveBeenCalledWith('components');
  expect(revalidateTag).toHaveBeenCalledWith('components:fields:home-hero');
  expect(revalidateTag).not.toHaveBeenCalledWith('home');
});
```

### E2E (Playwright, optionnel)

1. Charger `/` (HMR off, build prod).
2. Mesurer le `<h1>` actuel.
3. Via API admin, publier une nouvelle valeur.
4. Recharger `/` ; vérifier que la valeur a changé en < 1 s.

Cf. T5.

## Anti-patterns à éviter

| Anti-pattern | Pourquoi non |
|---|---|
| `revalidatePath('/')` après publish | Couvre seulement les routes connues. |
| `cache: 'no-store'` partout | Casse la perf publique. |
| Invalider sur PATCH (draft) | Le public ne lit pas les drafts → cache miss inutile. |
| Tag par fieldKey (`components:fields:home-hero:title`) | Granularité inutile : 8 fields = 8 tags inutilisables ; on lit toujours par composant. |
| Tag par locale en v1 | Inutile (une seule locale) ; ajouter en v2 sans casser. |

## Visualisation

```
                ┌──────────────────────┐
   PATCH draft  │  no revalidation     │
   ───────────► │                      │
                │  cache reste chaud   │
                │  (prod sert l'ancien │
                │   published)         │
                └──────────────────────┘

                ┌──────────────────────────────────────────────┐
   POST publish │  revalidateTag('components')                  │
   ───────────► │  revalidateTag('components:fields:<key>')     │
                │                                                │
                │  prochain GET RSC : 1 SELECT, repop le cache   │
                │  toutes les requêtes suivantes : cache hit     │
                └──────────────────────────────────────────────┘
```

## Limites connues

1. `unstable_cache` est, comme son nom l'indique, **non-stable** côté
   Next.js. On suit l'évolution Next 15 (`'use cache'` directive).
   Migration possible mais non urgente — on encapsule via
   `field-resolver.ts` pour limiter le blast radius.
2. Les tags sont **process-local** sur Next standalone single-node.
   Pour un déploiement multi-node, prévoir Redis ou un broker — non
   nécessaire en v1 (single-node).

## Cross-références

- A3 : cascade et clefs cache.
- A4 : transitions qui déclenchent la revalidation.
- B1 : routes mutantes.
- B4 : invalidation depuis le seed.
- F2 : consommateurs côté RSC public.
- F4 : preview qui ne cache **pas** (pas concernée par cette doc).
