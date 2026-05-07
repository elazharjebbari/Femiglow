# Backend — Routes API admin

Toutes les routes : `getAdminSession()`, `checkRateLimit()`, validation
Zod par section, `logAuditEvent()`, `revalidateTag('app-config')` si
mutation.

Base : `apps/web/src/app/api/admin/settings/`.

## Récapitulatif

| Méthode | Route                                           | Action |
|---------|-------------------------------------------------|--------|
| GET     | `/api/admin/settings`                           | Toutes les sections résolues |
| GET     | `/api/admin/settings/[section]`                 | Une section |
| PATCH   | `/api/admin/settings/[section]`                 | Update (snapshot + revalidate) |
| GET     | `/api/admin/settings/[section]/snapshots`       | Historique |
| POST    | `/api/admin/settings/[section]/restore`         | Restaurer un snapshot |

## RBAC

| Section    | Lecture        | Écriture       |
|------------|----------------|----------------|
| `nav`      | admin+         | admin+         |
| `flags`    | admin+         | superadmin     |
| `rbac`     | admin+         | superadmin     |
| `branding` | admin+         | admin+         |

Vérification dans le handler via `requireRole(session, 'superadmin')`
si nécessaire.

## `GET /api/admin/settings`

Réponse :

```ts
{
  nav: NavConfig;
  flags: FlagsConfig;
  rbac: RbacConfig;       // omis si role < admin
  branding: BrandingConfig;
  meta: {
    [section: string]: {
      version: number;
      updatedAt: string;
      updatedBy: { id: string; email: string };
      isDefault: boolean;  // true si pas de ligne DB
    };
  };
}
```

Rate limit : 60/min/user.

## `GET /api/admin/settings/[section]`

Réponse :

```ts
{
  section: 'nav' | 'flags' | 'rbac' | 'branding';
  payload: SectionPayload;       // résolu
  meta: {
    version: number;
    updatedAt: string | null;
    updatedBy: { id, email } | null;
    isDefault: boolean;
  };
}
```

## `PATCH /api/admin/settings/[section]`

Body : `appConfigSchema[section]` (validation stricte côté serveur).

Header optionnel : `If-Match: <version>` pour optimistic lock. Si
`version` du body diffère de la DB → 409 Conflict.

Comportement :

1. Validation Zod (422 si fail)
2. Lecture ligne DB courante (ou défaut)
3. Snapshot préalable de l'état courant
4. UPDATE / INSERT (`ON CONFLICT (section) DO UPDATE`)
5. `version = version + 1`
6. `revalidateTag('app-config')` + `revalidateTag(\`app-config:${section}\`)`
7. `logAuditEvent({ resource: 'app-config', action: 'update', section, diff })`

Réponse :

```ts
{
  payload: SectionPayload;
  meta: { version, updatedAt, updatedBy, isDefault: false };
  snapshotId: string;
}
```

## `GET /api/admin/settings/[section]/snapshots`

Query : `?page=1&pageSize=20` (max 50).

Réponse :

```ts
{
  items: Array<{
    id: string;
    capturedAt: string;
    version: number;
    actor: { id, email };
    note: string | null;
  }>;
  total: number;
}
```

Rate limit : 30/min.

## `POST /api/admin/settings/[section]/restore`

Body : `{ snapshotId: string }`.

Comportement :

1. Charge le snapshot
2. Re-valide Zod (refus si snapshot a un schéma legacy incompatible)
3. PATCH équivalent avec `payload = snapshot.payload`
4. Note auto : `'Restauré depuis snapshot ${snapshotId}'`
5. Audit `app-config.restore`

Réponse : identique à PATCH.

## Codes erreur

| Code | Cas |
|------|-----|
| 401  | Pas de session admin |
| 403  | Role insuffisant pour la section |
| 404  | Section inconnue ou snapshot inconnu |
| 409  | `If-Match` conflict (version stale) |
| 422  | Validation Zod fail |
| 429  | Rate limit |
| 500  | DB / cache failure |

## Logging spécial

Si Zod fail au PATCH → log structuré `{ severity: 'warn', section,
issues, actor }` mais **n'expose pas** les issues brutes au client
(certains messages Zod fuitent des regex internes). Renvoyer un
message générique + un `requestId` traceable côté server logs.
