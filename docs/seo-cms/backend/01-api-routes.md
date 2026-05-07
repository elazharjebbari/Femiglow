# Backend — Routes API admin

Toutes les routes : `getAdminSession()`, `checkRateLimit()`,
validation Zod, `logAuditEvent()`, `revalidateTag('seo')` si
mutation.

Base : `apps/web/src/app/api/admin/seo/`.

## Recapitulatif

| Methode | Route | Action |
|---|---|---|
| GET | `/api/admin/seo` | Liste paginee |
| GET | `/api/admin/seo/[scope]/[targetKey]` | Detail |
| PATCH | `/api/admin/seo/[scope]/[targetKey]` | Update draft |
| POST | `/api/admin/seo/[scope]/[targetKey]/publish` | Publier |
| POST | `/api/admin/seo/[scope]/[targetKey]/restore` | Restore snapshot |
| GET | `/api/admin/seo/settings` | Lire settings |
| PATCH | `/api/admin/seo/settings` | Update settings |
| POST | `/api/admin/seo/audit` | Lancer linter |
| GET | `/api/admin/seo/preview/[scope]/[targetKey]` | Metadata resolue |

## `GET /api/admin/seo`

Liste paginee + filtres.

Query :
```ts
{
  scope?: 'page' | 'component' | 'product' | 'article';
  locale?: string;
  q?: string;        // recherche dans target_key + title
  status?: 'draft' | 'published' | 'all';
  page?: number;
  pageSize?: number; // defaut 20, max 100
}
```

Reponse :
```ts
{
  items: Array<{
    id: string;
    scope: string;
    targetKey: string;
    locale: string;
    title: string | null;
    publishedAt: string | null;
    draftedAt: string | null;
    lastAuditScore: number | null; // 0-100, derive du linter
    updatedAt: string;
  }>;
  total: number;
  page: number;
  pageSize: number;
}
```

Rate limit : `key: 'admin-seo-list:${userId}'`, 60/min.

## `GET /api/admin/seo/[scope]/[targetKey]`

Detail complet.

Reponse :
```ts
{
  override: SeoOverride | null;       // null si jamais cree
  resolved: ResolvedMetadata;          // ce que la page rendra
  defaults: { title?, description? }; // defaults code
  knownPage?: { label: string; path: string };
  recentSnapshots: Array<{
    id: string;
    capturedAt: string;
    actor: { id: string; email: string };
  }>;
}
```

## `PATCH /api/admin/seo/[scope]/[targetKey]`

Body : `seoOverrideSchema.partial()` (voir Zod).

Comportement :
- Upsert sur (scope, targetKey, locale)
- Met a jour `drafted_at = now()`
- Audit `seo.draft_update`
- **Pas** de revalidate (draft ne change pas le rendu)

Reponse : override apres update.

## `POST /api/admin/seo/[scope]/[targetKey]/publish`

Body : vide ou `{ note?: string }`.

Comportement :
1. Charge override
2. Lance le linter ; si erreurs (severity=error) -> 422
3. Insert dans `seo_audit_snapshots` (payload = override actuel)
4. `published_at = now()`
5. `revalidateTag('seo')` + `revalidateTag(\`seo:${scope}:${targetKey}\`)`
6. Audit `seo.publish` avec diff vs snapshot precedent

Reponse :
```ts
{
  override: SeoOverride;
  snapshotId: string;
  lintReport: LintReport;
}
```

## `POST /api/admin/seo/[scope]/[targetKey]/restore`

Body : `{ snapshotId: string }`.

Restaure un snapshot dans l'override (etat draft).

Reponse : override draft restaure.

## `GET /api/admin/seo/settings`

Renvoie le singleton (cree avec defaults si absent).

## `PATCH /api/admin/seo/settings`

Body : `seoSettingsSchema.partial()`. Audit + revalidate global.

## `POST /api/admin/seo/audit`

Lance le linter sur une cible (sans muter).

Body :
```ts
{
  scope: 'page' | 'component' | 'product' | 'article';
  targetKey: string;
  locale?: string;
  // permet de tester un override non encore sauvegarde
  candidate?: Partial<SeoOverride>;
}
```

Reponse :
```ts
{
  report: LintReport;
  resolved: ResolvedMetadata;
  score: number; // 0-100
}
```

Rate limit : 30/min/user (ne pas saturer si linter cote serveur
fait des fetch externes pour valider canonical).

## `GET /api/admin/seo/preview/[scope]/[targetKey]`

Renvoie la metadata resolue + extras pour preview SERP/FB/Twitter.

Query : `?candidate=<base64 JSON>` optionnel pour preview live.

Reponse :
```ts
{
  metadata: Metadata;          // Next.js shape
  serp: { url, title, description, faviconUrl };
  facebook: { ogTitle, ogDescription, ogImageUrl, urlHost };
  twitter: { card, title, description, imageUrl, handle };
  jsonLd: object[]; // structured data resolu
}
```

## Codes erreur

| Code | Cas |
|---|---|
| 401 | Pas de session admin |
| 403 | Session valide mais role insuffisant |
| 404 | targetKey inconnu et pas dans known_pages |
| 422 | Validation Zod ou linter errors au publish |
| 429 | Rate limit |
| 500 | DB / cache failure |
