# 03 — Modèle de données SEO

État existant des tables Drizzle, extensions nécessaires, contrats Zod et conventions.

## 1. État existant (à conserver)

### 1.1 Table `seoOverrides`

`apps/web/src/lib/db/schema.ts` L1223-L1255.

```ts
export const seoOverrides = pgTable('seo_overrides', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  scope: seoScopeEnum('scope').notNull(),          // page | component | product | article
  targetKey: text('target_key').notNull(),         // ex: 'le-kit', 'kit-hero', '/journal'
  locale: text('locale').notNull().default('fr-MA'),

  // contenu éditable
  title: text('title'),
  description: text('description'),
  ogTitle: text('og_title'),
  ogDescription: text('og_description'),
  keywords: jsonb('keywords').$type<string[]>().default([]),
  ogImageMediaId: text('og_image_media_id').references(() => media.id, { onDelete: 'set null' }),
  ogImageTemplate: ogImageTemplateEnum('og_image_template'),  // marketing | article | product | default
  twitterCard: twitterCardEnum('twitter_card'),               // summary | summary_large_image
  canonical: text('canonical'),
  robotsIndex: boolean('robots_index').default(true).notNull(),
  robotsFollow: boolean('robots_follow').default(true).notNull(),
  structuredData: jsonb('structured_data').$type<Record<string, unknown> | null>(),

  // workflow
  publishedAt: timestamp('published_at', { withTimezone: true }),
  draftedAt: timestamp('drafted_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: text('created_by').references(() => adminUsers.id, { onDelete: 'set null' }),
}, (table) => ({
  targetUnique: uniqueIndex('seo_overrides_target_unique').on(table.scope, table.targetKey, table.locale),
  publishedIdx: index('seo_overrides_published_idx').on(table.publishedAt),
  scopeIdx: index('seo_overrides_scope_idx').on(table.scope),
}));
```

### 1.2 Table `seoSettings`

Singleton (1 ligne). Defaults globaux : `siteName`, `defaultDescription`, `defaultOgImageMediaId`, `twitterHandle`, `organizationJsonLd`, `defaultRobotsIndex`, `defaultRobotsFollow`, `knownPages`.

### 1.3 Table `seoAuditSnapshots`

Snapshots immuables à chaque publication. Permet restauration et diff.

## 2. Extensions nécessaires

### 2.1 Phase 5 — Brancher le scope `component`

**Aucune migration Drizzle nécessaire**. Le scope `'component'` existe déjà dans `seoScopeEnum`. L'extension est purement applicative : il faut un point de résolution dans le rendu des composants CMS.

Convention de `targetKey` pour les composants :

| Composant | targetKey | Lieu de résolution |
|---|---|---|
| Kit hero | `kit-hero` | `apps/web/src/components/kit/KitHero.tsx` |
| Rituel hero | `rituel-hero` | `apps/web/src/components/rituel/RituelHero.tsx` |
| Hero journal | `journal-hero` | `apps/web/src/components/journal/JournalHero.tsx` |
| Maison hero | `maison-hero` | `apps/web/src/components/maison/MaisonHero.tsx` |

**Règle** : un composant n'est éligible à un override SEO que si sa résolution **alimente la page parente** (typiquement via `generateMetadata` qui appelle `resolveSeoMetadata('component', componentKey)` en complément de la résolution `page`).

### 2.2 Phase 4 — Endpoint OG image dynamique

**Aucune nouvelle table**. Les colonnes `ogImageMediaId` et `ogImageTemplate` existent déjà. L'endpoint `/api/og/[template]/route.tsx` génère dynamiquement l'image à partir de paramètres (title, eyebrow, theme) et cache en CDN.

URL canonique d'un OG image dynamique :

```
/api/og/{template}?title=...&eyebrow=...&theme=...&v=2026-05
```

Le paramètre `v` permet d'invalider le cache CDN sans purge.

### 2.3 Phase 6 — Migration potentielle (backlog, non livrée ici)

Si on souhaite stocker des **alternates par locale** explicitement, on ajouterait une table jonction :

```ts
// HORS PÉRIMÈTRE DU PLAN ACTUEL — documentation seulement
export const seoAlternates = pgTable('seo_alternates', {
  id: text('id').primaryKey().$defaultFn(() => createId()),
  sourceOverrideId: text('source_override_id').notNull().references(() => seoOverrides.id, { onDelete: 'cascade' }),
  locale: text('locale').notNull(),
  href: text('href').notNull(),
});
```

Pas livré dans ce plan. À considérer si expansion ar-MA / en effective.

## 3. Contrats Zod (à étendre légèrement)

### 3.1 Existant — `apps/web/src/lib/seo/schemas.ts`

```ts
export const seoOverrideUpsertSchema = z.object({
  scope: z.enum(['page', 'component', 'product', 'article']),
  targetKey: z.string().regex(/^[a-z0-9][a-z0-9:_-]{0,119}$/),
  locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).default('fr-MA'),
  title: z.string().min(1).max(120).nullable().optional(),
  description: z.string().min(1).max(320).nullable().optional(),
  ogTitle: z.string().min(1).max(120).nullable().optional(),
  ogDescription: z.string().min(1).max(320).nullable().optional(),
  keywords: z.array(z.string().min(1).max(40)).max(20).default([]),
  ogImageMediaId: z.string().nullable().optional(),
  ogImageTemplate: z.enum(['marketing', 'article', 'product', 'default']).nullable().optional(),
  twitterCard: z.enum(['summary', 'summary_large_image']).nullable().optional(),
  canonical: z.string().url().nullable().optional(),
  robotsIndex: z.boolean().default(true),
  robotsFollow: z.boolean().default(true),
  structuredData: z.record(z.unknown()).nullable().optional(),
});
```

### 3.2 Ajout phase 4 — schéma de query pour l'endpoint OG

```ts
// apps/web/src/lib/seo/og-image.schemas.ts (nouveau)
export const ogImageQuerySchema = z.object({
  title: z.string().min(1).max(120),
  eyebrow: z.string().max(60).optional(),
  theme: z.enum(['sauge', 'creme', 'petale', 'ciel', 'champagne']).default('sauge'),
  template: z.enum(['marketing', 'article', 'product', 'default']),
  v: z.string().regex(/^\d{4}-\d{2}$/).optional(), // cache buster optionnel
});

export type OgImageQuery = z.infer<typeof ogImageQuerySchema>;
```

### 3.3 Ajout phase 5 — helper de résolution composant

```ts
// apps/web/src/lib/seo/component-resolve.ts (nouveau)
export const componentSeoScope = z.object({
  componentKey: z.string().regex(/^[a-z0-9][a-z0-9:_-]{0,119}$/),
  pageRoute: z.string().regex(/^\/[a-z0-9/_-]*$/), // route parente
  locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).default('fr-MA'),
});
```

## 4. Types TypeScript dérivés

Les types sont dérivés des schemas Zod via `z.infer`. Aucun type écrit à la main pour les inputs API.

```ts
export type SeoOverrideUpsert = z.infer<typeof seoOverrideUpsertSchema>;
export type SeoOverridePatch = z.infer<typeof seoOverridePatchSchema>;
export type SeoSettingsUpsert = z.infer<typeof seoSettingsUpsertSchema>;

export interface ResolvedSeoMetadata {
  title: string;
  description: string;
  canonical: string;
  robots: { index: boolean; follow: boolean };
  og: {
    title: string;
    description: string;
    image: { url: string; width: number; height: number; alt: string } | null;
    template: 'marketing' | 'article' | 'product' | 'default';
  };
  twitter: { card: 'summary' | 'summary_large_image'; handle: string | null };
  keywords: string[];
  structuredData: Record<string, unknown> | null;
  source: 'override' | 'settings' | 'default';
  // Phase 5 ajoute :
  componentOverrides?: Array<{ componentKey: string; source: 'override' | 'none' }>;
}
```

## 5. Conventions de `targetKey`

| Scope | Convention | Exemple |
|---|---|---|
| `page` | route slash-stripped, kebab-case | `home`, `kit`, `journal`, `journal-category-rituels` |
| `product` | slug produit (DB) | `le-kit` |
| `article` | slug article (DB) | `rituel-eclat-3-soirs` |
| `component` | clé composant registry CMS | `kit-hero`, `rituel-cards`, `journal-feature` |

Validation Zod : regex `/^[a-z0-9][a-z0-9:_-]{0,119}$/`.

## 6. Tag de cache associés

| Source | Tag |
|---|---|
| Tous les overrides | `seo` (global, invalidé sur settings update) |
| Override individuel | `seo:{scope}:{targetKey}` |
| Phase 5 — composant | `seo:component:{componentKey}` |
| Phase 5 — page parente d'un composant | `seo:page:{pageKey}` (auto-invalidé si composant change) |

## 7. Audit trail (existant, à conserver)

- `auditEvents` — table générique, actions `seo.create`, `seo.update`, `seo.publish`, `seo.unpublish`, `seo.delete`, `seo.settings.update`, `seo.bulk.*`.
- `seoAuditSnapshots` — snapshots immuables avec payload override complet.

**Extension phase 3** : pas de nouvelle table. On lit les events existants pour les afficher dans un panel admin.

## 8. Migrations

### 8.1 État actuel

Aucune migration prévue dans ce plan. Le schéma est déjà aligné avec les phases livrées.

### 8.2 Si besoin (phase 6 backlog)

Pour ajouter la table `seoAlternates` (multi-locale UI) :

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

Avec script de back-fill optionnel (1 alternate par override existant en locale fr-MA).

## 9. Invariants à préserver

1. **`(scope, targetKey, locale)` est unique**. Toute API qui crée un override doit gérer le conflit (upsert ou 409).
2. **`publishedAt` non null ⇒ override visible publiquement**. Le rendu public n'expose **jamais** un override drafté.
3. **`ogImageMediaId` est nullable et SET NULL on delete** sur `media`. Un media supprimé ne casse pas l'override, il retombe sur le fallback template.
4. **`structuredData` doit valider `@context` et `@type`** au minimum si non null. Validation Zod custom (déjà présente côté admin, à confirmer côté API).
5. **Les snapshots sont immuables**. Aucune mise à jour, seulement insertion.

## 10. Tests data layer associés

| Fichier de test | Sujet | Existant ou nouveau |
|---|---|---|
| `apps/web/src/lib/db/queries/seo.test.ts` | CRUD overrides, snapshots | Existant — à étendre phase 5 pour scope component |
| `apps/web/src/lib/seo/schemas.test.ts` | Validation Zod | Existant — à étendre pour `ogImageQuerySchema` |
| `apps/web/src/lib/seo/resolve.test.ts` | Cascade de résolution | Existant — à étendre phase 5 |
| `apps/web/src/lib/seo/og-image.schemas.test.ts` | Nouveau Zod OG | Nouveau (phase 4) |

Détails dans `07-tests-strategy.md`.
