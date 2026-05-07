# C1 — Template fiche composant

> **Usage** : copier ce fichier sous `docs/components-cms/catalog/<componentKey>.md`,
> renommer le titre en `# C<n> — <componentKey>`, puis remplir chaque section.
> Une fiche **complète** est requise avant qu'un composant ne soit
> migré (cf. `runbook/04-rollout.md`).

> Le format est volontairement strict : il sert d'**input** au seed
> pipeline (`backend/04-seed-pipeline-extensions.md`) et au générateur
> de scénarios MSW (`testing/06-component-scenarios.md`).

---

## 1. Identité

| Clé | Valeur |
|---|---|
| `componentKey` | `<page-group>-<slug>` — identique à `SITE_COMPONENT_REGISTRY[].key` |
| Nom affiché | Nom lisible (ex « Hero Accueil ») |
| Page-group | `home` / `rituel` / `kit` / `maison` / `journal` / `shared` |
| RSC path | `apps/web/src/components/sections/<File>.tsx` |
| Route(s) consommatrice(s) | `/`, `/rituel`, `/maison`, … |
| Statut | `planned` ▸ `migrated` ▸ `live` |
| Dernière revue | YYYY-MM-DD — initiales |

> **Statut**  
> `planned` : la fiche est rédigée, le registre TS n'a pas encore les fields.  
> `migrated` : registre + RSC utilisent `<ComponentField>`.  
> `live` : un binding `published` non-default a été créé en prod.

## 2. Champs éditoriaux

> **Source de vérité** : la colonne `defaultValue` est la valeur
> seedée en `published` au jour J. Toute modification ultérieure
> passe par l'admin et **ne** met **pas** à jour ce tableau (voir
> changelog).

| key | label | type | required | defaultValue | description | group | config |
|-----|-------|------|----------|--------------|-------------|-------|--------|
| `xxxx` | « Libellé admin » | `text` | non | `"…"` | Help text admin | `Header` | `{ maxLength: 70 }` |

> Les types autorisés sont définis dans
> [`architecture/02-data-model.md`](../architecture/02-data-model.md#type--componentfielddefinition-ts-registre)
> (A2) :
> `text`, `multiline`, `rich-text`, `cta`, `link`, `icon`,
> `color-token`, `number`, `boolean`, `enum`, `list`, `record`,
> `kicker`, `quote`, `breadcrumb-segment`.

### Exemples encodés (jsonb)

```jsonc
// type=text
{ "v": "Le rituel du soir, en cinq minutes." }

// type=cta
{ "label": "Découvrir le rituel", "href": "/rituel", "variant": "primary" }

// type=list<record>
{ "items": [{ "fields": { "label": "…", "href": "/…" } }, …] }
```

## 3. Wireframe / contexte

> Schéma ASCII du composant **dans la page**, à l'échelle relative
> de la viewport. Inclure les blocs voisins pour situer.

```
┌──────────────── viewport (1440) ─────────────────────────────────┐
│  [ Header global ]                                                │
│                                                                   │
│  ┌─────────────────────────  Hero  ──────────────────────────┐   │
│  │  kicker (champagne, withRule)                              │   │
│  │  Heading display-xl                                        │   │
│  │  Text lead (subtitle)                                      │   │
│  │  [ CTA primary ]   [ CTA secondary inline ]                │   │
│  │                                          ┌─────────────┐   │   │
│  │                                          │ image 4:5   │   │   │
│  │                                          └─────────────┘   │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  [ Section voisine — GestesGrid ]                                 │
└───────────────────────────────────────────────────────────────────┘
```

> **Capture de référence** : `apps/web/public/_screenshots/<key>.png`
> (à produire au moment de la migration — la commande
> `pnpm --filter @femiglow/web screenshots:capture` la génère).

## 4. Lignes éditoriales (voix FemiGlow)

- **Ton** : chaud, précis, posé. Aucune emphase publicitaire,
  aucune injonction. Le verbe est rarement à l'impératif.
- **Longueur** : on tend vers la **soustraction**. Si un titre
  passe en deux lignes sur mobile sans rupture lisible, on le
  réécrit plus court.
- **Ponctuation** : guillemets français (« … »), apostrophes
  typographiques (’), espaces fines insécables avant `:` `;` `?` `!`.
- **Majuscules** : pas de capitales sur des mots courants (« Le
  Rituel » → « le rituel »).
- **Anglicismes** : à éviter sauf usage installé (« kit »).

### Bons exemples

```
title    : « Le rituel ongles, en cinq minutes. »
subtitle : « Trois gestes, une saison. Une beauté lente, ancrée au Maroc. »
kicker   : « Maison de Casablanca »
```

### Contre-exemples

```
title    : « DÉCOUVREZ LE RITUEL ULTIME ! »      — emphase, capitales
subtitle : « Click ici pour transformer votre…   — anglicisme + injonction
kicker   : « # Trending »                        — mot-clé inadéquat
```

## 5. Scénarios MSW (4-6)

> Chaque scénario nourrit
> `apps/web/src/test/msw/handlers/component-fields.ts` et est
> consommé par les tests RTL de l'éditeur (T4) et e2e (T5).
> Les exemples sont **encodés** comme en DB (`{ "v": … }`).

```ts
// scenario: empty
// Tous les champs au defaultValue (état post-seed initial, jamais édité).
{
  componentKey: '<key>',
  fields: {},
  bindings: [],          // aucun binding draft/published custom
}

// scenario: default
// Tous les champs ont un binding 'published' identique au defaultValue.
{
  componentKey: '<key>',
  fields: {
    title: { v: '<defaultValue>' },
  },
}

// scenario: long-text
// Texte au-delà du maxLength → l'éditeur doit afficher un compteur rouge,
// le serveur Zod doit refuser.

// scenario: special-chars
// Apostrophes courbes, guillemets français, espaces insécables, accents.

// scenario: rich-text-edge
// Pour fields de type rich-text : tag autorisé/refusé, lien javascript:
// (à rejeter), ancre interne (#…) acceptée.

// scenario: scheduled-pending
// Un binding scheduled ce soir 22h, le rendu reste sur le published actuel.
```

## 6. Notes de migration

1. **Ajouter le composant au registre** : `apps/web/src/lib/components/registry.ts`
   contient déjà l'entrée `siteComponents`. On lui ajoute la
   propriété `fields: ComponentFieldDefinition[]`.
2. **defaultValue** : recopier littéralement les valeurs actuelles
   du RSC (ou du mock `apps/web/src/data/mock/<page>.ts`).
3. **Remplacer les littéraux** : dans le RSC, substituer chaque
   chaîne en dur par `<ComponentField componentKey="<key>" fieldKey="…" />`
   ou la valeur résolue par `resolveComponentFields()`.
4. **Seed** : exécuter `pnpm --filter @femiglow/web sync:components`
   puis `pnpm --filter @femiglow/web seed:components`. Vérifier
   en DB qu'on a bien autant de bindings `published` que de fields
   déclarés (cf. `backend/04-seed-pipeline-extensions.md`).
5. **Tests** : ajouter un fichier `<key>.scenarios.ts` pointé par
   `testing/06-component-scenarios.md`.

> Procédure détaillée : [`runbook/02-add-field.md`](../runbook/02-add-field.md) (R2)
> et [`runbook/04-rollout.md`](../runbook/04-rollout.md) (R4).

## 7. Tests liés

| Niveau | Fichier | Couverture |
|--------|---------|------------|
| Unit (resolver) | `apps/web/src/lib/components/__tests__/<key>.resolve.test.ts` | cascade default ▸ binding |
| RTL (RSC) | `apps/web/src/components/sections/<File>.test.tsx` | rendu avec mocks de fields |
| RTL (admin éditeur) | `apps/web/src/app/admin/components/[key]/__tests__/<key>.editor.test.tsx` | dirty tracking, save |
| E2E | `apps/web/playwright/admin/<key>.spec.ts` | parcours édition → publication |

## 8. Changelog

> Append-only. Une ligne par évolution **structurelle**
> (ajout/retrait d'un field, changement de type, renommage de label).
> Les modifications de `defaultValue` ne sont **pas** logguées ici
> — elles vivent dans `component_field_history`.

| Date | Auteur | Changement |
|------|--------|------------|
| YYYY-MM-DD | initiales | Création de la fiche, seed initial. |
