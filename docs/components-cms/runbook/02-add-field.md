# R2 — Ajouter un champ à un composant existant

> Cas le plus fréquent. Un composant existe déjà au registre, on
> veut exposer une nouvelle valeur éditable (ex : ajouter un
> `kicker` au `home-hero`).
>
> Durée moyenne : **30 min** (dev) + **15 min** (review).

## Pré-requis

- Le composant cible est déjà au registre (`SITE_COMPONENT_REGISTRY`).
- Bootstrap (R1) effectué en local et en prod.
- Branche dédiée (ex `feat/home-hero-kicker`).

## Vue d'ensemble

```
1. Registre TS         (registry.ts : ajouter un ComponentFieldDefinition)
2. RSC consumer        (Hero.tsx : remplacer la valeur en dur par <ComponentField>)
3. Seed local          (pnpm seed:components-fields → crée la ligne 'published')
4. Tests               (Vitest scénario + RTL si éditeur custom)
5. Catalogue           (catalog/<componentKey>.md)
6. (optionnel) Validateur custom Zod
7. PR + review
8. Migrate prod        (déjà géré : pas de migration DDL à appliquer)
```

> **Pas de migration DDL.** L'ajout d'un champ est purement additif :
> les colonnes DB ne changent pas, seul le `fields` jsonb du
> `siteComponents` est repoussé par le seed.

## Étape 1 — Déclarer le champ au registre

Fichier : `apps/web/src/lib/components/registry.ts`.

```ts
{
  key: 'home-hero',
  name: 'Hero — accueil',
  // … existant : pageGroup, slots, defaultSvgFallback, …
  fields: [
    // existant
    {
      key: 'title',
      label: 'Titre principal',
      type: 'text',
      required: true,
      defaultValue: 'Le rituel du soir, en cinq minutes.',
      config: { maxLength: 80 },
      group: 'Hero',
      order: 10,
    },
    // ◄── nouveau
    {
      key: 'kicker',
      label: 'Kicker (mini-titre au-dessus)',
      type: 'kicker',
      required: false,
      defaultValue: 'Notre rituel',
      description: 'Petit texte en capitales au-dessus du titre. Max 30 c.',
      config: { maxLength: 30 },
      group: 'Hero',
      order: 5,    // s'insère avant title
      fallbackToDefault: true,
    },
  ],
},
```

**Règles** :

| Règle | Pourquoi |
|-------|----------|
| `key` jamais renommé | une fois publié, devient une clé DB. |
| `key` en `kebab-case` | convention partagée avec slots/animations. |
| `defaultValue` obligatoire si `required: true` | I6 dans A2. |
| `group` cohérent avec les autres champs du composant | UX : panneau admin lisible. |
| `order` espacé de 5 ou 10 | pour insérer entre deux ultérieurement. |
| `config.maxLength` aligné avec la maquette | éviter overflow visuel. |

## Étape 2 — Mettre à jour le RSC consumer

Avant :

```tsx
// apps/web/src/components/sections/Hero.tsx
<Heading as="h1" size="xl">
  Le rituel du soir, en cinq minutes.
</Heading>
```

Après :

```tsx
import { ComponentField } from '@/components/cms/ComponentField';

<ComponentField componentKey="home-hero" fieldKey="kicker">
  {(kicker) => kicker.value && (
    <Eyebrow>{kicker.value}</Eyebrow>
  )}
</ComponentField>

<ComponentField componentKey="home-hero" fieldKey="title">
  {(title) => (
    <Heading as="h1" size="xl">{title.value}</Heading>
  )}
</ComponentField>
```

> Les deux `<ComponentField>` voisins **ne provoquent pas** deux
> requêtes DB — `resolveComponentFields` est cached et résout tout
> le composant en un seul SELECT (cf. A3).

Référence d'usage du helper RSC : F2.

## Étape 3 — Seed local

```bash
pnpm --filter @femiglow/web seed:components-fields --filter-page-group home
```

Vérification :

```sql
SELECT field_key, status, version, value
FROM component_field_bindings
WHERE component_id = (SELECT id FROM site_components WHERE key = 'home-hero')
  AND field_key = 'kicker';

-- Attendu : 1 ligne, status='published', version=1, value={"v":"Notre rituel"}
```

> Le seed est **conservatif** : si une ligne `published` existe déjà
> pour cette `(componentId, fieldKey)`, elle n'est **pas écrasée**
> (cf. EC2 dans A3, R3 dans `risks`). Si on a besoin d'écraser, on
> passe par l'admin (qui crée un draft puis republie).

## Étape 4 — Tests

### Scénario unitaire (Vitest)

Fichier : `apps/web/src/lib/components/__tests__/scenarios/home-hero.spec.ts`.

```ts
describe('home-hero kicker', () => {
  it('renders the registry default when no binding override', async () => {
    const fields = await resolveComponentFields('home-hero');
    expect(fields.kicker.value).toBe('Notre rituel');
    expect(fields.kicker.meta.source).toBe('default');
  });

  it('renders the published binding when overridden', async () => {
    await seedBinding({ componentKey: 'home-hero', fieldKey: 'kicker',
      value: { v: 'Édition spéciale' }, status: 'published' });
    const fields = await resolveComponentFields('home-hero');
    expect(fields.kicker.value).toBe('Édition spéciale');
    expect(fields.kicker.meta.source).toBe('binding');
  });

  it('rejects values exceeding maxLength', async () => {
    const tooLong = 'x'.repeat(31);
    await expect(patchField({ componentKey: 'home-hero', fieldKey: 'kicker',
      value: { v: tooLong } })).rejects.toMatchObject({ status: 400 });
  });
});
```

### Test admin (RTL + MSW)

Si l'éditeur du type est déjà couvert (cf. T4), **un seul test
intégration** suffit pour vérifier l'apparition du champ dans le
panneau :

```tsx
it('shows the kicker editor in admin panel', async () => {
  render(<ComponentFieldsPanel componentKey="home-hero" />);
  expect(await screen.findByLabelText(/Kicker/)).toBeInTheDocument();
});
```

Cf. T6 pour la matrice des scénarios par composant.

## Étape 5 — Catalogue

Fichier à créer : `docs/components-cms/catalog/home-hero.md` (s'il
n'existe pas) ou édition de la section dédiée. Structure :

```markdown
## Champ `kicker`

- **Type** : `kicker`
- **Requis** : non
- **Défaut** : `Notre rituel`
- **Contraintes** : 30 caractères max.
- **Apparaît** : Hero d'accueil, au-dessus du titre principal.
- **Casse** : capitales (CSS `uppercase`).
```

Le template est dans `catalog/_template.md`.

## Étape 6 — (Optionnel) Validateur custom

Pour 90 % des cas, le validateur Zod générique du type `kicker` suffit
(cf. B2). On ajoute un validateur custom **uniquement si** :

- la valeur dépend d'autres champs (ex : si `cta` présent, `kicker`
  doit l'être aussi),
- la valeur référence une ressource externe (ex : `iconKey` doit
  exister dans `/icons/registry`),
- la valeur a une grammaire non couverte par les types.

Pattern :

```ts
// apps/web/src/lib/components/fields/validators/home-hero-kicker.ts
import 'server-only';
import { z } from 'zod';
import { kickerSchema } from '@/lib/components/fields/schemas';

export const homeHeroKickerSchema = kickerSchema.refine(
  (v) => !v.v.includes('!!'),
  { message: 'Le kicker ne doit pas contenir "!!".' },
);
```

Et l'enregistrer dans le registry des validateurs custom (cf. B2).

## Étape 7 — Checklist PR

```markdown
## Ajout du champ `home-hero / kicker`

- [ ] Registry TS : nouveau `ComponentFieldDefinition`
- [ ] RSC : remplacement de la valeur en dur par `<ComponentField>`
- [ ] Seed local exécuté + binding `published` v1 vérifié en DB
- [ ] Test scénario `home-hero.spec.ts` passe
- [ ] Test RTL admin passe
- [ ] Catalog `catalog/home-hero.md` à jour
- [ ] Validateur custom (n/a OU `home-hero-kicker.ts`)
- [ ] `pnpm tsc --noEmit` ✅
- [ ] `pnpm vitest run` ✅
- [ ] Pas de breaking change (le rendu reste identique tant qu'aucun
      admin n'a touché aux valeurs)
```

## Migration prod

**Aucune migration DDL.** Étapes minimales :

1. Merge de la PR.
2. Déploiement Vercel.
3. Au premier rendu, le seed automatique de boot (cf. B4) crée la
   ligne `published` v1 avec la valeur du registre.
4. (Optionnel) `pnpm seed:components-fields --filter-page-group home`
   en CLI prod si on préfère un seed explicite plutôt qu'au boot.

## Rollback

> Le contrat est : retirer un champ du registre est une **opération
> non-destructive** côté DB. Le binding existe encore mais n'est plus
> lu (cf. EC1 dans A3).

Procédure :

1. Reverter la PR (registry + RSC).
2. Au prochain seed (CLI ou boot), le binding orphelin est passé à
   `status='archived'` automatiquement.
3. Pas de redéploiement manuel nécessaire.

> Si on veut purger immédiatement les bindings archivés, lancer le
> reconcile (cf. R5 / I5). À utiliser avec parcimonie : on perd
> l'historique éditorial du champ.

## Cross-references

- Définition du type → A2 / `ComponentFieldDefinition`
- Cascade et fallback → A3
- Helper RSC `<ComponentField>` → F2
- Editor pour le type `kicker` → F1
- Validation Zod → B2
- Seed → B4
- Scénarios test → T6
