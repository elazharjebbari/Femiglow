# A1 — Vue d'ensemble système

## Cadrage

### In-scope

1. **Champs typés** par composant : `text`, `multiline`, `rich-text`,
   `cta`, `link`, `icon`, `color-token`, `number`, `boolean`, `enum`,
   `list-of(<type>)`, `record({…})`, et un kit éditorial (`kicker`,
   `quote`, `breadcrumb-segment`).
2. **Cascade de résolution** registre → binding publié.
3. **Statuts** : `draft`, `published`, `scheduled`. `archived` pour
   soft-delete.
4. **Versioning** append-only avec restauration 1-click.
5. **Admin UI** par composant : éditeurs adaptés au type, save
   optimiste, preview iframe RSC, diff vs publié.
6. **API REST** côté admin : `/api/admin/components/[key]/fields`.
7. **Seed** : la version `defaultValue` du registre est synchronisée
   en DB (ligne `published`, version `1`) au boot.
8. **Tests** : Vitest (unit), RTL (éditeurs), MSW (admin), Playwright
   (parcours admin), avec scénarios par composant.
9. **Locale** présente dès le jour 1 (FR par défaut), aucune logique
   i18n côté rendu pour la v1 — la dimension est juste là pour ne pas
   migrer la DB plus tard.

### Out-of-scope (v1)

1. **Multilangue UI** : lecture/écriture multi-locale dans l'admin.
   Le code prévoit, l'UI ne l'expose pas. Ouverture en v2.
2. **Workflow multi-rôles** (rédaction → review → publication).
   Tout admin authentifié peut publier.
3. **A/B testing** sur les valeurs.
4. **Édition collaborative temps réel** (CRDT). On bloque par lock
   léger (`updatedAt` / If-Match optimistic concurrency).
5. **Marketplace de composants** type Storyblok / Sanity Studio.
6. **CDN externe pour le rendu admin**. Tout reste sur Next.js + DB
   in-memory dev / Postgres prod.

## Contraintes

### Architecturales

- **Next.js 14.2 App Router** + RSC. Pas de Pages Router.
- **Drizzle ORM** + Postgres en prod, in-memory store en dev/test.
- **Zod** pour toute validation entrée. Pas de validation custom.
- **server-only** sur tout module qui touche la DB ou un secret.
- **`unstable_cache`** + tags pour le cache HTTP-side. Tag
  `components` (existant) + `components:fields:<componentKey>`.
- **Server Actions** non utilisées : on garde l'API REST + fetch
  côté admin client pour rester compatible MSW.

### Produit

- **Pas de mode plein écran "page builder"**. On n'invente pas
  une grille. Les composants restent posés par le code.
- **L'admin ne crée pas de nouveaux composants** depuis l'UI.
  Un nouveau composant = un PR (registry + RSC + seed).
  Cf. `runbook/03-add-component.md`.
- **Un composant a un nombre de slots/fields fixe**. Ajout = PR.
  L'admin ne peut que **modifier** les valeurs.
- **L'éditeur ne peut pas casser la mise en page** : la cascade
  retombe toujours sur le `defaultValue` du registre.

### Performance

- **TTFB admin** ≤ 300 ms en p95 avec ~30 composants × 8 champs.
- **Rendu public** : aucune régression. Le cache `unstable_cache`
  garde un hit-rate ≥ 95 % en lecture publique.
- **Save** : optimiste, retour visuel < 100 ms. Persistance ≤ 500 ms
  en p95.

### Qualité

- **Coverage Vitest** ≥ 85 % sur `src/lib/components/fields/**`,
  `src/components/admin/components/fields/**`, et les routes admin.
- **Playwright** : 1 parcours nominal par page-group + 3 parcours
  d'erreur (validation, conflit version, droits).
- **a11y axe-core** ≥ 0 violation niveau A/AA sur tout l'écran admin.

## Décisions tranchées

### D1. Pourquoi étendre le système Component-Media plutôt qu'un nouveau

Le système Component-Media porte déjà :

- registre TS source de vérité,
- table `siteComponents` synchronisée,
- bindings côté DB,
- résolveur RSC + cache + tags,
- UI admin par page-group,
- pipeline de seed,
- tests Vitest + MSW.

Refaire un système parallèle dupliquerait tout. On ajoute
simplement la dimension *fields* au modèle existant, en réutilisant
le registre, l'invalidation, et l'UI admin.

### D2. Pourquoi statuts `draft` / `published` / `scheduled` plutôt qu'un seul `value`

Trois retours utilisateurs convergent :

1. *« Je veux pouvoir tester un texte avant qu'il soit live. »*
2. *« Je veux pouvoir préparer un texte pour le 15 mars. »*
3. *« Je veux pouvoir revenir au texte précédent si je me trompe. »*

Un modèle plat (un seul `value`) ne couvre aucun de ces cas. Trois
statuts + history append-only répond aux trois sans complexité
disproportionnée.

### D3. Pourquoi `locale` dès le jour 1

Migrer une table portant ~5 000 lignes (30 composants × 8 champs ×
n drafts × n langues) pour ajouter `locale` plus tard est coûteux
et risque la corruption. Le coût d'avoir la colonne dès le jour 1
est nul : on insère toujours `'fr'`.

### D4. Pourquoi pas de Server Actions

- MSW ne sait pas mocker proprement un Server Action côté tests.
- L'API REST se mocke trivialement.
- Save optimiste + retry est plus simple à coder côté client.
- On garde l'option d'ajouter des Server Actions plus tard pour
  des cas spécifiques (ex : publier-tout d'une page).

### D5. Pourquoi un éditeur par type, pas un éditeur générique

Un *« input texte universel »* suffit pour `text`, mais devient une
horreur pour `cta` (label + href + variant + icône) ou `quote`
(text + author). On préfère **un composant éditeur par type**, avec :

- props typées,
- validation Zod intégrée,
- preview live,
- traduction des erreurs.

Ces éditeurs sont eux-mêmes testables en isolation (RTL).

### D6. Pourquoi pas de RHF / Formik

Les éditeurs sont des composants contrôlés simples. Le formulaire-page
porte un `useReducer` léger qui dirty-track par champ. RHF apporterait
~30 ko gzip pour zéro valeur ajoutée ici.

## Hypothèses

- Le déploiement reste **single-tenant** (pas de multi-marque).
- La taille du contenu par champ reste raisonnable (`text` ≤ 500 c.,
  `rich-text` ≤ 5 000 c., `list` ≤ 20 entrées).
- L'admin tourne sur le même nœud Next.js que le rendu public. Pas
  de service séparé.
- L'auth admin reste en place (cf. `docs/admin/02-faisabilite-authentification.md`).

## Non-buts (négatifs explicites)

- ❌ Édition WYSIWYG du DOM rendu (drag-and-drop). On édite des **champs**,
  pas la mise en page.
- ❌ Plugins externes (genre Sanity Studio).
- ❌ Synchronisation bi-directionnelle code ↔ DB (le code reste source
  de vérité du *schéma* ; la DB est source de vérité des *valeurs*).
- ❌ Permissions par-champ (tout admin authentifié édite tout).
- ❌ Comments / annotations sur un champ.

## Schéma haut niveau

```
┌──────────────────────────────────────────────────────────────────────┐
│ apps/web/src/lib/components/                                          │
│                                                                        │
│   registry.ts ─── SiteComponentSeed[]                                 │
│        │                                                              │
│        │     interface SiteComponentSeed {                            │
│        │       key, name, slots[],                                    │
│        │       fields: ComponentFieldDefinition[]   ◄── nouveau       │
│        │     }                                                        │
│        ▼                                                              │
│   seed-pipeline.ts ─── upsert siteComponents + componentFieldBindings │
│                                                                        │
│   resolver.ts ─── existing ComponentMedia resolution                  │
│   field-resolver.ts ─── new field resolution (cascade, cache)         │
│   ComponentField.tsx ─── new RSC helper                                │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│ apps/web/src/lib/db/                                                   │
│                                                                        │
│   schema.ts                                                            │
│     site_components                          (existant)               │
│     component_media_bindings                 (existant)               │
│     component_animation_bindings             (existant)               │
│     component_field_bindings                 ◄── nouveau              │
│     component_field_history                  ◄── nouveau              │
│                                                                        │
│   queries/component-fields.ts                ◄── nouveau              │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│ apps/web/src/app/                                                      │
│                                                                        │
│   admin/components/[key]/page.tsx                                     │
│      ├── ComponentFieldsPanel  ◄── nouveau                            │
│      ├── ComponentMediaPanel   (existant)                             │
│      └── ComponentAnimationPanel (existant)                           │
│                                                                        │
│   api/admin/components/[key]/fields/route.ts  ◄── GET + PATCH         │
│   api/admin/components/[key]/fields/publish/route.ts ◄── POST         │
│   api/admin/components/[key]/fields/history/route.ts ◄── GET          │
│   admin/components/[key]/preview/page.tsx     ◄── iframe RSC          │
│                                                                        │
└──────────────────────────────────────────────────────────────────────┘
```

## Stack utilisée

| Couche | Outil | Pourquoi |
|--------|-------|----------|
| Rendu public | Next.js RSC | Existant, performant |
| ORM | Drizzle | Existant |
| Validation | Zod | Existant |
| Cache | `unstable_cache` + tags | Existant |
| State admin | `useReducer` local | Léger, suffisant |
| Save | `fetch` + optimistic | MSW-compatible |
| Forms | controlled + custom hook | Pas de dépendance |
| Tests | Vitest + RTL + MSW | Existant |
| E2E | Playwright | Existant |
| Sanitization HTML | `sanitize-html` ou DOMPurify | Pour rich-text uniquement |
| Markdown | `marked` ou `markdown-it` | Pour rich-text uniquement |

## Comment lire la suite

1. Le **modèle de données** (A2) fixe le contrat DB.
2. La **cascade** (A3) explique comment les valeurs sont résolues.
3. Le **versioning** (A4) explique le cycle de vie d'un binding.
4. Les autres docs détaillent l'implémentation et le test.
