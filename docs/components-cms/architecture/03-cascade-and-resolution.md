# A3 — Cascade et résolution

## Contrat

> Pour un couple `(componentKey, fieldKey, locale='fr')`, le résolveur
> renvoie **toujours** une valeur typée — **jamais** `undefined` ni
> `null` (sauf si le champ est `required=false` et qu'aucune valeur
> n'a été configurée à aucun niveau, auquel cas il renvoie `null`).

## Niveaux de la cascade

```
Niveau 1 : componentFieldBindings.status='published' AND locale='fr'   ◄── plus prioritaire
Niveau 2 : componentFieldBindings.status='published' AND locale='en'   (fallback locale, futur)
Niveau 3 : registry.field.defaultValue                                  ◄── filet final
```

En **v1**, il n'y a qu'une seule locale (`'fr'`), donc la cascade est
de fait à deux niveaux : binding publié, ou défaut du registre.

### Pourquoi pas le `draft` dans la cascade publique

Le rendu public ne lit **jamais** un brouillon. Seule l'iframe de
preview (`/admin/components/[key]/preview?draft=…`) le fait, via un
résolveur `resolveComponentFieldsDraft()` distinct.

C'est ce qui permet à un admin de tâtonner sans impact prod.

### Cas du `scheduled`

Un binding `status='scheduled'` n'est **pas** lu par la cascade
publique tant que `scheduledAt > now()`. Un cron léger
(`/api/cron/promote-scheduled-fields` toutes les 5 min) bascule
`scheduled → published` à l'échéance, en historisant l'opération.
Cf. A4.

## Algorithme

```ts
// pseudo-code, l'implémentation réelle est cached
async function resolveComponentField(
  componentKey: string,
  fieldKey: string,
  locale: string = 'fr',
): Promise<ResolvedField> {
  const component = await getSiteComponentByKey(componentKey);
  if (!component) {
    return notFoundDevPlaceholder(componentKey, fieldKey);
  }

  const fieldDef = component.fields.find((f) => f.key === fieldKey);
  if (!fieldDef) {
    return unknownFieldDevPlaceholder(componentKey, fieldKey);
  }

  // Niveau 1 : binding publié pour la locale demandée
  const binding = await getPublishedBinding(component.id, fieldKey, locale);
  if (binding) {
    return {
      value: decodeValue(binding.value, fieldDef.type),
      meta: {
        source: 'binding',
        bindingId: binding.id,
        version: binding.version,
        publishedAt: binding.publishedAt,
        locale: binding.locale,
      },
    };
  }

  // Niveau 2 : fallback locale (v2)
  // const fallback = await getPublishedBinding(component.id, fieldKey, 'fr');
  // if (fallback && locale !== 'fr') return …

  // Niveau 3 : défaut registre
  if (fieldDef.defaultValue !== undefined) {
    return {
      value: fieldDef.defaultValue,
      meta: { source: 'default', version: 0 },
    };
  }

  if (fieldDef.required) {
    return missingRequiredDevPlaceholder(componentKey, fieldKey);
  }

  return { value: null, meta: { source: 'none', version: 0 } };
}
```

### Optimisation `resolveComponentFields` (pluriel)

Le résolveur unitaire est utile pour debug, mais en pratique on
résout **tous les champs d'un composant en un seul appel**. Cela
limite à un seul SELECT DB par composant et un seul cache hit.

```ts
async function resolveComponentFields(
  componentKey: string,
  locale: string = 'fr',
): Promise<ResolvedFields> {
  const component = await getSiteComponentByKey(componentKey);
  if (!component) return emptyResolvedFields();

  const bindings = await listPublishedBindings(component.id, locale);
  const byKey = Object.fromEntries(bindings.map((b) => [b.fieldKey, b]));

  const out: ResolvedFields = {};
  for (const fieldDef of component.fields) {
    const b = byKey[fieldDef.key];
    out[fieldDef.key] = b
      ? { value: decodeValue(b.value, fieldDef.type), meta: { source: 'binding', … } }
      : { value: fieldDef.defaultValue ?? null, meta: { source: 'default', … } };
  }
  return out;
}
```

Cache : `unstable_cache(['components-fields', componentKey, locale], { tags: ['components', `components:fields:${componentKey}`] })`.

## Type retourné

```ts
interface ResolvedField<T = unknown> {
  value: T;
  meta: {
    source: 'binding' | 'default' | 'none';
    bindingId?: string;
    version: number;
    publishedAt?: Date | null;
    locale?: string;
  };
}

type ResolvedFields = Record<string /*fieldKey*/, ResolvedField>;
```

## Edge cases

### EC1 — Champ supprimé du registre

Un admin a publié un binding pour `field='kicker'`, puis un PR
retire `kicker` du registre du composant.

**Comportement** : le binding existe encore en DB mais aucun lookup
ne le lit. Au prochain seed, il est marqué `status='archived'`. Le
rendu n'a aucune incidence.

### EC2 — Champ ajouté au registre

PR ajoute `field='subtitle'` à un composant. Aucun binding existe.

**Comportement** : la cascade tombe sur `defaultValue`. Tant que
l'admin ne touche pas à ce nouveau champ, le rendu utilise le
defaultValue. Au prochain seed, **un binding `published` initial est
créé** avec la valeur `defaultValue` (cf. B4).

### EC3 — Type changé dans le registre

PR change `field='cta'` de type `cta` à type `link`. Le binding
existant a une valeur encodée pour le type `cta`.

**Politique** : interdit en l'état. Un changement de type doit
passer par un nouveau `key` (`cta-v2`). Une migration de valeurs
est traitée comme une migration DB classique (script ad hoc).

### EC4 — Locale demandée absente

Demande `locale='en'`, aucun binding `en` publié.

**Comportement** : fallback à `locale='fr'` puis `defaultValue`. Le
résolveur logue un signal `field.locale.fallback` pour observer.

### EC5 — Cache stale après publication

Un admin publie. Le binding est dans la DB mais le cache RSC peut
encore servir l'ancienne valeur (jusqu'à `revalidate`).

**Comportement** : le `POST /publish` appelle
`revalidateTag('components')` **et** `revalidateTag('components:fields:<key>')`.
Le rendu suivant est frais. Coût : 1 cache miss.

### EC6 — Race condition sur deux drafts simultanés

Deux admins éditent le même champ en même temps. Optimistic
concurrency : la requête PATCH passe `If-Match: <updatedAt>`. Si la
valeur en DB a bougé, on renvoie 409 et l'UI propose un merge ou un
reload.

### EC7 — Binding orphelin (composant supprimé)

ON DELETE CASCADE garantit qu'aucun binding ne survit à la
suppression de son composant. La table `componentFieldHistory` est
elle aussi cascade-supprimée.

### EC8 — Fuseaux horaires sur `scheduledAt`

`scheduledAt` est stocké en UTC. L'admin saisit l'heure dans son
fuseau (Europe/Paris en pratique), le client convertit avant POST.
Le cron lit en UTC via `now() AT TIME ZONE 'UTC'`.

## Diagnostic

Le résolveur expose une variante diagnostic :

```ts
const diag = await diagnoseComponentFields('home-hero');
// → {
//   componentKey: 'home-hero',
//   locale: 'fr',
//   fields: [
//     { key: 'title',    source: 'binding',  bindingId: 'cfb_…', version: 4 },
//     { key: 'subtitle', source: 'default' },
//     { key: 'cta',      source: 'binding',  bindingId: 'cfb_…', version: 1 },
//   ],
//   bindingsCount: { published: 2, draft: 1, scheduled: 0, archived: 0 },
// }
```

Utile en dev (panneau dev tools) et en runbook (cf. R5).

## Performance attendue

| Métrique | Cible |
|---|---|
| `resolveComponentFields` (cache hit) | < 1 ms |
| `resolveComponentFields` (cache miss) | < 30 ms (1 SELECT en DB) |
| `revalidateTag('components')` après publish | < 50 ms |

Ces chiffres tiennent tant que `n_fields_par_composant ≤ 50` (on est
loin du seuil avec 8 fields moyens).
