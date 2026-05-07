# Architecture — Modèle de données

Deux tables : `app_config`, `app_config_snapshots`.
Convention snake_case (Drizzle), Zod camelCase.

## `app_config`

Table key-value typée. Une ligne = une section.

| Colonne       | Type        | Note |
|---------------|-------------|------|
| `section`     | text PK     | `'nav' \| 'flags' \| 'rbac' \| 'branding'` |
| `payload`     | jsonb       | objet validé contre `appConfigSchema[section]` |
| `version`     | int         | optimistic lock, incrémente à chaque PATCH |
| `updated_at`  | timestamptz | |
| `updated_by`  | uuid        | FK users |

### Indices

- PK sur `section` (déjà unique)
- Pas de besoin d'index secondaire (≤ 4 lignes)

### Contraintes

- `section IN ('nav', 'flags', 'rbac', 'branding')` — check constraint
- `payload IS NOT NULL`
- `version >= 1`

## `app_config_snapshots`

Historique append-only.

| Colonne        | Type        | Note |
|----------------|-------------|------|
| `id`           | uuid pk     | |
| `section`      | text        | même enum que `app_config.section` |
| `captured_at`  | timestamptz | défaut now() |
| `payload`      | jsonb       | snapshot complet |
| `version`      | int         | version au moment du snapshot |
| `actor_id`     | uuid        | FK users |
| `note`         | text        | optionnel |

### Indices

- `INDEX (section, captured_at DESC)` — historique d'une section
- Rétention : 50 derniers snapshots par section (job cron mensuel post-v1)

## Schémas Zod par section

Fichier : `apps/web/src/lib/admin-config/schemas.ts`.

### `nav`

```ts
const navItemSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9-]*$/),
  label: z.string().min(1).max(40),
  href: z.string().startsWith('/'),
  icon: z.string().min(1),                        // clé du registre icons
  requiresRole: z.enum(['admin', 'editor', 'superadmin']).optional(),
  position: z.number().int().min(0),
});

export const navSchema = z.object({
  items: z.array(navItemSchema).max(20),
});
```

### `flags`

```ts
export const flagsSchema = z.object({
  flags: z.record(z.string(), z.boolean()),
});
```

### `rbac`

```ts
const action = z.enum(['read', 'write', 'publish', 'delete']);
const resource = z.enum([
  'components', 'seo', 'products', 'media', 'users', 'app-config',
]);

export const rbacSchema = z.object({
  matrix: z.record(
    z.string(),                            // role
    z.record(resource, z.array(action)),   // resource → actions
  ),
});
```

### `branding`

```ts
const colorHex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const brandingSchema = z.object({
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
  logoMediaId: z.string().uuid().optional(),
});
```

## Cascade defaults → DB

1. Lecture `app_config` filtré par section
2. Si pas de ligne → `defaults[section]`
3. Si ligne mais Zod fail → warn + `defaults[section]`
4. Sinon → `deepMerge(defaults[section], payload)`

→ Cf. [`backend/02-zod-validation.md`](../backend/02-zod-validation.md)
   pour la stratégie de fallback détaillée.

## Migration

Fichier : `apps/web/drizzle/migrations/0009_admin_config.sql`. Pas de
seed nécessaire (tout part du défaut codé).

```sql
CREATE TABLE app_config (
  section TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID NOT NULL REFERENCES users(id),
  CHECK (section IN ('nav', 'flags', 'rbac', 'branding'))
);

CREATE TABLE app_config_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payload JSONB NOT NULL,
  version INTEGER NOT NULL,
  actor_id UUID NOT NULL REFERENCES users(id),
  note TEXT
);

CREATE INDEX app_config_snapshots_section_idx
  ON app_config_snapshots (section, captured_at DESC);
```
