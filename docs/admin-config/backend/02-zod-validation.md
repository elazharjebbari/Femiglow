# Backend — Validation Zod

Schémas dans `apps/web/src/lib/admin-config/schemas.ts`. Source de
vérité unique pour : route API PATCH, helper `getAppConfig` (Zod en
**lecture** aussi, contre la DB), formulaires admin.

## Le map principal

```ts
export const appConfigSchema = {
  nav: navSchema,
  flags: flagsSchema,
  rbac: rbacSchema,
  branding: brandingSchema,
} as const satisfies Record<Section, z.ZodTypeAny>;

export type AppConfigBySection = {
  [K in Section]: z.infer<(typeof appConfigSchema)[K]>;
};
```

## Schémas par section

### `nav`

```ts
const navItemSchema = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9-]*$/, 'kebab-case'),
    label: z.string().min(1).max(40),
    href: z.string().regex(/^\/[a-zA-Z0-9/_-]*$/, 'doit commencer par /'),
    icon: z.string().min(1).max(40),
    requiresRole: z.enum(['admin', 'editor', 'superadmin']).optional(),
    position: z.number().int().min(0).max(99),
  })
  .strict();

export const navSchema = z
  .object({
    items: z.array(navItemSchema).max(20),
  })
  .strict()
  .superRefine((data, ctx) => {
    const keys = data.items.map(i => i.key);
    if (new Set(keys).size !== keys.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['items'],
        message: 'Clés `key` doivent être uniques',
      });
    }
  });
```

### `flags`

```ts
export const flagsSchema = z
  .object({
    flags: z.record(
      z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/),    // camelCase
      z.boolean(),
    ),
  })
  .strict();
```

### `rbac`

```ts
const action = z.enum(['read', 'write', 'publish', 'delete']);
const resource = z.enum([
  'components', 'seo', 'products', 'media', 'users', 'app-config',
]);

const rolePermissionsSchema = z.record(resource, z.array(action).max(4));

export const rbacSchema = z
  .object({
    matrix: z.record(z.string(), rolePermissionsSchema),
  })
  .strict()
  .superRefine((data, ctx) => {
    // superadmin doit toujours avoir toutes les permissions
    const sa = data.matrix.superadmin;
    if (!sa) {
      ctx.addIssue({
        code: 'custom',
        path: ['matrix', 'superadmin'],
        message: 'superadmin obligatoire',
      });
      return;
    }
    const expected = ['read', 'write', 'publish', 'delete'] as const;
    for (const r of resource.options) {
      const actions = sa[r] ?? [];
      const missing = expected.filter(a => !actions.includes(a));
      if (missing.length) {
        ctx.addIssue({
          code: 'custom',
          path: ['matrix', 'superadmin', r],
          message: `superadmin doit avoir ${missing.join(', ')}`,
        });
      }
    }
  });
```

### `branding`

```ts
const colorHex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'hex 6 chars');

export const brandingSchema = z
  .object({
    colors: z.object({
      primary: colorHex,
      accent: colorHex,
      bg: colorHex,
      text: colorHex,
    }),
    fonts: z.object({
      heading: z.enum(['Cormorant Garamond', 'Playfair Display', 'Inter']),
      body: z.enum(['Inter', 'Manrope']),
    }),
    logoMediaId: z.string().uuid().nullable(),
  })
  .strict()
  .superRefine((data, ctx) => {
    // garde-fou contraste minimal text/bg
    const ratio = contrastRatio(data.colors.text, data.colors.bg);
    if (ratio < 4.5) {
      ctx.addIssue({
        code: 'custom',
        path: ['colors', 'text'],
        message: `Contraste text/bg insuffisant (${ratio.toFixed(2)} < 4.5 WCAG AA)`,
      });
    }
  });
```

## Mode strict (`.strict()`)

Tous les schémas sont `.strict()` : un champ inconnu → fail. Au
PATCH : refus immédiat, message clair.

En **lecture** (cascade), on **n'utilise pas strict** : on `safeParse`
permissif puis fallback. Subtilité : on définit deux variantes
`schemaStrict` (pour PATCH) et `schemaPermissive` (pour read).

Ou alternativement : strict partout + migrator au load qui drop
les champs inconnus. **Choix v1 : strict + migrator** (plus prudent,
on voit l'évolution du schéma).

## Sanitization

- `nav.items[].label` : trim + collapse whitespace
- `branding.colors.*` : lower-case forcé
- `flags.flags` : keys trim, booléens normalisés

## Erreurs

Format `error_envelope` :

```ts
{
  ok: false,
  error: {
    code: 'VALIDATION_ERROR',
    message: 'Configuration invalide.',
    issues: ZodIssue[],          // exposé en admin (pas en public)
  },
}
```

L'admin affiche les `issues` dans le panneau erreurs (path → message).
En lecture (cascade fail), les issues vont dans les logs structurés
(Sentry tag `admin-config-zod-fail`), pas en réponse HTTP.

## Tests

Fixtures `__fixtures__/zod-cases.ts` :

| Section    | Valides | Invalides |
|------------|---------|-----------|
| nav        | 4       | 8 (dup key, label vide, href sans /, …) |
| flags      | 3       | 4 (key invalide, valeur non-bool, …) |
| rbac       | 3       | 6 (superadmin manquant, action inconnue, …) |
| branding   | 3       | 7 (hex invalide, contraste insuffisant, …) |

Coverage 100% des branches Zod.

## Round-trip jsonb ↔ Zod

Trivial pour ce module : les payloads sont des objets JSON. Drizzle
les sérialise/désérialise. Pas de mapping spécial.
