# Architecture — Modele de donnees

Trois tables : `seo_overrides`, `seo_settings`, `seo_audit_snapshots`.
Convention snake_case (Drizzle), Zod kebab-case.

## `seo_overrides`

Override d'une cible specifique (page, composant, produit, article).

| Colonne | Type | Note |
|---|---|---|
| `id` | uuid pk | gen_random_uuid |
| `scope` | enum | `'page' \| 'component' \| 'product' \| 'article'` |
| `target_key` | text | ex: `home`, `kit`, `product:le-rituel`, `article:rituel-doux` |
| `locale` | text | defaut `'fr-MA'`, prepare i18n |
| `title` | text | nullable |
| `description` | text | nullable |
| `keywords` | jsonb | `string[]`, max 20 |
| `og_title` | text | fallback `title` |
| `og_description` | text | fallback `description` |
| `og_image_media_id` | uuid | FK `media.id` nullable |
| `og_image_template` | enum | `'marketing'\|'article'\|'product'\|'default'` nullable |
| `twitter_card` | enum | `'summary' \| 'summary_large_image'` |
| `canonical` | text | URL absolue |
| `robots_index` | bool | defaut true |
| `robots_follow` | bool | defaut true |
| `structured_data` | jsonb | override partiel JSON-LD |
| `published_at` | timestamptz | null si draft seul |
| `drafted_at` | timestamptz | maj a chaque PATCH |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |
| `created_by` | uuid | FK `users.id` |

### Indices

- `UNIQUE (scope, target_key, locale)` — une cible = une ligne par locale
- `INDEX (published_at DESC)` — listes triees
- `INDEX (scope)` — filtres UI

### Etat

- **Draft only** : `drafted_at IS NOT NULL`, `published_at IS NULL`
- **Published** : `published_at IS NOT NULL`
- Un PATCH met a jour `drafted_at`. Un publish copie le draft -> publie et fige `published_at`.

## `seo_settings`

Singleton (1 ligne). Contient les defaults globaux.

| Colonne | Type | Note |
|---|---|---|
| `id` | uuid pk | force a `'singleton'` ou check constraint |
| `site_name` | text | ex: `FemiGlow` |
| `default_description` | text | fallback global |
| `default_og_image_media_id` | uuid | FK media |
| `twitter_handle` | text | `@femiglow` |
| `organization_json_ld` | jsonb | objet JSON-LD complet |
| `default_robots_index` | bool | defaut true |
| `default_robots_follow` | bool | defaut true |
| `known_pages` | jsonb | array `{ key, label, path }` referentiel UI |
| `updated_at` | timestamptz | |
| `updated_by` | uuid | FK users |

### `known_pages` shape

```ts
type KnownPage = {
  key: string;        // 'home', 'kit', 'rituel'
  label: string;      // 'Accueil', 'Le Kit', 'Le Rituel'
  path: string;       // '/', '/kit', '/rituel'
  scope: 'page';
};
```

Initialise depuis le seed avec les 13 pages cartographiees.

## `seo_audit_snapshots`

Historique des etats publies (utilise pour restore + diff audit).

| Colonne | Type | Note |
|---|---|---|
| `id` | uuid pk | |
| `scope` | enum | meme que overrides |
| `target_key` | text | |
| `locale` | text | |
| `captured_at` | timestamptz | defaut now() |
| `payload` | jsonb | snapshot complet de l'override au moment du publish |
| `actor_id` | uuid | FK users |

### Indices

- `INDEX (scope, target_key, locale, captured_at DESC)` — historique d'une cible
- Retention : conserver les 50 derniers snapshots par cible (job cron mensuel hors v1)

## Cascade draft -> publish

Identique au pattern components-CMS :

1. PATCH met a jour les colonnes editables et `drafted_at`
2. POST `/publish` :
   - Capture l'override actuel dans `seo_audit_snapshots`
   - Set `published_at = now()`
   - `revalidateTag('seo')`
   - `logAuditEvent({ action: 'seo.publish', ... })`

## i18n preparation

`locale` est present partout mais le seul code de locale supporte
en v1 est `'fr-MA'`. La contrainte UNIQUE inclut deja `locale`
pour permettre l'extension future sans migration breaking.

## Migration

Fichier : `apps/web/drizzle/migrations/0007_seo_cms.sql`. Detail
dans [`runbook/01-deployment.md`](../runbook/01-deployment.md).
