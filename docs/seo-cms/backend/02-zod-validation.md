# Backend — Validation Zod

Tous les schémas SEO sont définis dans
`apps/web/src/lib/seo/schemas.ts`. Source de vérité unique partagée
entre routes API, queries Drizzle et form handlers admin.

## Schémas exportés

```ts
export const seoScopeSchema = z.enum(['page', 'component', 'product', 'article']);
export const seoTwitterCardSchema = z.enum(['summary', 'summary_large_image']);
export const seoOgTemplateSchema = z.enum(['marketing', 'article', 'product', 'default']);
export const seoLocaleSchema = z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).default('fr-MA');

export const seoOverrideSchema = z.object({
  scope: seoScopeSchema,
  targetKey: z.string().min(1).max(120).regex(/^[a-z0-9][a-z0-9:_-]*$/),
  locale: seoLocaleSchema,
  title: z.string().min(1).max(120).nullable(),
  description: z.string().min(1).max(280).nullable(),
  keywords: z.array(z.string().min(1).max(40)).max(20).default([]),
  ogTitle: z.string().max(120).nullable(),
  ogDescription: z.string().max(280).nullable(),
  ogImageMediaId: z.string().uuid().nullable(),
  ogImageTemplate: seoOgTemplateSchema.nullable(),
  twitterCard: seoTwitterCardSchema.default('summary_large_image'),
  canonical: z.string().url().nullable(),
  robotsIndex: z.boolean().default(true),
  robotsFollow: z.boolean().default(true),
  structuredData: z.unknown().nullable(),     // validé séparément
});

export const seoSettingsSchema = z.object({
  siteName: z.string().min(1).max(60),
  defaultDescription: z.string().min(1).max(280),
  defaultOgImageMediaId: z.string().uuid().nullable(),
  twitterHandle: z.string().regex(/^@[A-Za-z0-9_]{1,15}$/).nullable(),
  organizationJsonLd: organizationJsonLdSchema,   // détaillé ci-dessous
  defaultRobotsIndex: z.boolean().default(true),
  defaultRobotsFollow: z.boolean().default(true),
  knownPages: z.array(knownPageSchema).max(100).default([]),
});
```

## Validation JSON-LD

Le champ `organizationJsonLd` exige un sous-ensemble strict :

```ts
export const organizationJsonLdSchema = z.object({
  '@context': z.literal('https://schema.org'),
  '@type': z.enum(['Organization', 'LocalBusiness']),
  name: z.string().min(1).max(120),
  url: z.string().url(),
  logo: z.string().url().optional(),
  sameAs: z.array(z.string().url()).max(20).optional(),
  contactPoint: z.array(z.object({
    '@type': z.literal('ContactPoint'),
    contactType: z.string(),
    email: z.string().email().optional(),
    telephone: z.string().optional(),
  })).optional(),
});
```

Le `structuredData` (par-override) est plus permissif : on parse en
JSON, on vérifie seulement la présence de `@context: 'https://schema.org'`
et que c'est un objet ou un tableau d'objets.

## Sanitization

- `title`, `description` : trim + `replace(/\s+/g, ' ')` côté serveur
  avant Zod
- `keywords` : dédup + lower-case avant validation
- `canonical` : refus si protocole ≠ http/https

## Erreurs renvoyées

Format aligné avec les autres modules (`error_envelope`) :

```ts
{
  ok: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Le champ « title » est trop long (max 120).',
    issues: [
      { path: ['title'], code: 'too_big', max: 120, received: 145 },
      { path: ['canonical'], code: 'invalid_url' },
    ],
  },
}
```

Les messages sont localisés FR via une fonction
`humanizeZodIssue(issue)` (mappe les codes Zod en phrases).

## Tests unitaires

Fixtures dans `apps/web/src/lib/seo/__fixtures__/zod-cases.ts`.
Chaque cas : `{ name, input, expected: 'ok' | { failPath, code } }`.

Couverture cible : 100% des branches Zod (chaque `.refine`, chaque
`.regex`, chaque `nullable`).

## Round-trip avec Drizzle

La conversion DB ↔ Zod se fait dans
`apps/web/src/lib/seo/queries.ts` via deux fonctions :

```ts
function toRow(input: SeoOverrideInput): SeoOverridesInsert { ... }
function fromRow(row: SeoOverridesRow): SeoOverride { ... }
```

Drizzle utilise snake_case ; Zod camelCase. Pas de magie : mapping
explicite + tests.
