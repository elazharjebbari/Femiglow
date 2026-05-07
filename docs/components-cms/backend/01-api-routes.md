# B1 — API routes admin

## Vue d'ensemble

> Toutes les routes vivent sous `/api/admin/components/[key]/fields/**`,
> sauf le cron de promotion. Toutes sont **protégées par le middleware
> admin** (cf. A6). Toutes renvoient `application/json`.

| Méthode | Route | Action |
|---|---|---|
| `GET` | `/api/admin/components/[key]/fields` | Liste les champs (draft + published). |
| `PATCH` | `/api/admin/components/[key]/fields/[fieldKey]` | Upsert le draft d'un champ. |
| `POST` | `/api/admin/components/[key]/fields/[fieldKey]/publish` | Promeut draft → published. |
| `POST` | `/api/admin/components/[key]/fields/[fieldKey]/schedule` | draft → scheduled. |
| `POST` | `/api/admin/components/[key]/fields/[fieldKey]/cancel-schedule` | scheduled → draft. |
| `POST` | `/api/admin/components/[key]/fields/[fieldKey]/restore` | history → nouveau draft. |
| `GET` | `/api/admin/components/[key]/fields/[fieldKey]/history` | Liste l'historique d'un champ. |
| `GET` | `/api/cron/promote-scheduled-fields` | Cron : promeut les scheduled échus. |

## Conventions communes

### Headers requis (mutations)

```
Content-Type: application/json
X-Requested-With: XMLHttpRequest    ← anti-CSRF (cf. A6)
If-Match: <updatedAt ISO>           ← optimistic concurrency, sur PATCH
```

### Réponse erreur

```jsonc
// Tous les 4xx, format unique
{
  "error": {
    "code": "invalid_input",          // identifiant stable, FR sur la même clef côté Zod (cf. B2)
    "message": "Le titre est requis", // FR, lisible utilisateur
    "details": { "fieldPath": "value", "received": "" }
  }
}
```

Codes d'erreur principaux :

| Code | Status | Sens |
|---|---|---|
| `unauthorized` | 401 | Pas de session admin valide. |
| `forbidden` | 403 | Session OK mais `user.status !== 'active'`. |
| `not_found` | 404 | Composant ou champ inconnu. |
| `invalid_input` | 400 | Payload mal formé (Zod top-level). |
| `validation_failed` | 422 | Payload bien formé mais valeur invalide (Zod field-level). |
| `version_conflict` | 409 | `If-Match` ne correspond plus. |
| `field_removed` | 409 | Le champ n'est plus dans le registre. |
| `schedule_in_past` | 400 | `scheduledAt < now() + 1 min`. |
| `rate_limited` | 429 | > 60 req/min sur le scope `/api/admin/components/**`. |

## B1.1 — `GET /api/admin/components/[key]/fields`

### Description

Liste tous les champs d'un composant pour une locale, avec leur valeur
actuellement **publiée** (si binding existe) et leur valeur **draft**
(si edition en cours). Les valeurs sont décodées (jsonb → JS).

### Query params

| Nom | Type | Défaut | Notes |
|---|---|---|---|
| `locale` | string | `'fr'` | BCP-47. |

### Response 200

```jsonc
{
  "componentKey": "home-hero",
  "locale": "fr",
  "fields": [
    {
      "key": "title",
      "label": "Titre principal",
      "type": "text",
      "required": true,
      "config": { "maxLength": 80 },
      "defaultValue": "Le rituel du soir, en cinq minutes.",
      "published": {
        "id": "cfb_a1b2",
        "value": "Le rituel du soir, en cinq minutes.",
        "version": 3,
        "publishedAt": "2026-04-12T14:32:00.000Z",
        "updatedAt": "2026-04-12T14:32:00.000Z",
        "authorId": "adm_…"
      },
      "draft": {
        "id": "cfb_z9y8",
        "value": "Le rituel du soir, en quelques minutes.",
        "version": 4,
        "updatedAt": "2026-05-04T09:11:00.000Z",
        "authorId": "adm_…"
      }
    },
    {
      "key": "cta",
      "label": "CTA principal",
      "type": "cta",
      "required": false,
      "config": { "variants": ["primary", "ghost"] },
      "defaultValue": { "label": "Découvrir", "href": "/rituel", "variant": "primary" },
      "published": null,
      "draft": null
    }
  ]
}
```

### Status codes

| Code | Cas |
|---|---|
| 200 | OK |
| 401 | non authentifié |
| 403 | user inactif |
| 404 | composant inconnu |
| 429 | rate-limit |

## B1.2 — `PATCH /api/admin/components/[key]/fields/[fieldKey]`

### Description

Upsert le `draft` d'un champ. Si pas de draft existant, en crée un
(transition `(rien) → draft`, history `create`). Si un draft existe,
met à jour sa `value` (history `update`).

### Headers

```
If-Match: 2026-05-04T09:11:00.000Z   ← updatedAt du draft précédent
```

`If-Match` est obligatoire **uniquement** quand un draft existe déjà.
Le premier PATCH sur un champ vierge l'omet.

### Body

```jsonc
{
  "value": "Le rituel du soir, en quelques minutes.",
  "locale": "fr"
}
```

`value` est typé selon `field.type` ; le serveur valide via Zod
discriminated-union (cf. B2).

### Response 200

```jsonc
{
  "binding": {
    "id": "cfb_z9y8",
    "componentId": "cmp_…",
    "fieldKey": "title",
    "locale": "fr",
    "value": "Le rituel du soir, en quelques minutes.",
    "status": "draft",
    "version": 4,
    "updatedAt": "2026-05-04T09:14:30.000Z",
    "authorId": "adm_…"
  }
}
```

### Status codes

| Code | Cas |
|---|---|
| 200 | OK |
| 400 | payload mal formé (`value` manquant, …) |
| 401/403 | auth |
| 404 | composant ou champ inconnu (`field_removed`) |
| 409 | `If-Match` mismatch (`version_conflict`) — body inclut `details.remoteValue`, `remoteUpdatedAt`, `remoteAuthorId` |
| 422 | validation_failed (Zod sur `value`) |
| 429 | rate-limit |

### Effets de bord

- INSERT/UPDATE `component_field_bindings` (status=draft).
- INSERT `component_field_history` (action=create|update).
- INSERT `adminAuditLog` (action=field.draft.create|update).
- **Pas** de `revalidateTag` (le rendu public n'est pas affecté). Cf. B3.

## B1.3 — `POST /api/admin/components/[key]/fields/[fieldKey]/publish`

### Description

Promeut le `draft` courant → `published`. L'ancien `published` (s'il
existait) passe `archived`. Calcul de `version` via SQL atomique
(cf. A4).

### Body

Pas de body. (Optionnellement `{ "notes": "string" }` archivé dans
history.)

### Response 200

```jsonc
{
  "binding": {
    "id": "cfb_z9y8",
    "fieldKey": "title",
    "locale": "fr",
    "status": "published",
    "version": 4,
    "publishedAt": "2026-05-04T09:30:00.000Z",
    "updatedAt": "2026-05-04T09:30:00.000Z"
  },
  "previousPublishedId": "cfb_a1b2"   // null si première publication
}
```

### Status codes

| Code | Cas |
|---|---|
| 200 | OK |
| 401/403 | auth |
| 404 | pas de draft à publier |
| 409 | draft modifié entre temps (`version_conflict`) |
| 422 | la valeur du draft échoue à la validation Zod (rare ; ex schema modifié depuis) |
| 429 | rate-limit |

### Effets de bord

- UPDATE binding draft → published.
- UPDATE ancien published → archived.
- INSERT 2 lignes history (`publish` + `archive`).
- INSERT `adminAuditLog` (action=`field.publish`).
- `revalidateTag('components')` ET `revalidateTag('components:fields:<key>')` (cf. B3).

## B1.4 — `POST /api/admin/components/[key]/fields/[fieldKey]/schedule`

### Body

```jsonc
{
  "scheduledAt": "2026-03-15T08:00:00.000Z"   // ISO UTC
}
```

### Response 200

```jsonc
{
  "binding": {
    "id": "cfb_z9y8",
    "status": "scheduled",
    "scheduledAt": "2026-03-15T08:00:00.000Z",
    "version": 4
  }
}
```

### Status codes

| Code | Cas |
|---|---|
| 200 | OK |
| 400 | `scheduledAt < now() + 1 min` (`schedule_in_past`) |
| 404 | pas de draft à programmer |
| 409 | draft modifié entre temps |
| 422 | `scheduledAt` non parsable |

### Effets de bord

- UPDATE binding (status=scheduled, scheduledAt set).
- INSERT history (action=schedule).
- INSERT auditLog (action=`field.schedule`).
- **Pas** de `revalidateTag` (le scheduled n'est pas lu publiquement).

## B1.5 — `POST /api/admin/components/[key]/fields/[fieldKey]/cancel-schedule`

### Body

Vide.

### Response 200

```jsonc
{
  "binding": {
    "id": "cfb_z9y8",
    "status": "draft",
    "scheduledAt": null
  }
}
```

### Status codes

| Code | Cas |
|---|---|
| 200 | OK |
| 404 | pas de scheduled à annuler |
| 409 | déjà promu (status=published) |

## B1.6 — `POST /api/admin/components/[key]/fields/[fieldKey]/restore`

### Body

```jsonc
{ "historyId": "cfh_abcdef" }
```

### Response 200

```jsonc
{
  "binding": {
    "id": "cfb_new",
    "status": "draft",
    "value": "Le rituel du soir.",
    "version": 5,                        // sera publié comme v5
    "updatedAt": "2026-05-04T10:00:00.000Z"
  },
  "restoredFromVersion": 2
}
```

### Status codes

| Code | Cas |
|---|---|
| 200 | OK |
| 404 | `historyId` inconnu |
| 409 | champ retiré du registre depuis (`field_removed_from_registry`) |
| 422 | la valeur historique est invalide vis-à-vis du schéma actuel (champ a changé de config par ex.) |

### Effets de bord

- INSERT/UPSERT binding draft (la valeur du snapshot devient le draft courant ; l'ancien draft est écrasé).
- INSERT history (action=restore, meta.fromVersion).
- INSERT auditLog.

## B1.7 — `GET /api/admin/components/[key]/fields/[fieldKey]/history`

### Query params

| Nom | Type | Défaut | Notes |
|---|---|---|---|
| `limit` | int | 20 | max 100 |
| `before` | ISO date | (none) | pagination cursor |

### Response 200

```jsonc
{
  "entries": [
    {
      "id": "cfh_x1",
      "version": 4,
      "value": "Le rituel du soir.",
      "status": "published",
      "action": "publish",
      "actorId": "adm_…",
      "actorEmail": "founder@femiglow.com",
      "createdAt": "2026-04-12T14:32:00.000Z"
    },
    {
      "id": "cfh_x2",
      "version": 3,
      "value": "Le rituel du soir, version précédente.",
      "status": "archived",
      "action": "archive",
      "actorId": "adm_…",
      "actorEmail": "founder@femiglow.com",
      "createdAt": "2026-04-12T14:32:00.000Z"
    }
  ],
  "nextCursor": "2026-04-01T00:00:00.000Z"
}
```

## B1.8 — `GET /api/cron/promote-scheduled-fields`

### Auth

Header partagé : `Authorization: Bearer <CRON_SECRET>`. Pas d'auth
admin (le cron tourne sans user).

### Description

Sélectionne les bindings `scheduled` dont `scheduledAt <= now()`,
les promeut en transaction. Idempotent (cf. A4 E5).

### Response 200

```jsonc
{
  "promoted": [
    { "componentKey": "home-hero", "fieldKey": "title", "fromVersion": 3, "toVersion": 4 }
  ],
  "failed": [
    { "componentKey": "kit-block", "fieldKey": "subtitle", "error": "validation_failed" }
  ],
  "durationMs": 47
}
```

### Status codes

| Code | Cas |
|---|---|
| 200 | OK (même si un sous-job a échoué — le rapport l'indique) |
| 401 | secret invalide |

### Effets de bord

- Pour chaque promotion : transaction identique au B1.3.
- `revalidateTag` à la fin du batch (une seule fois pour `components`, et une par composant unique).

## Implémentation de référence

```ts
// apps/web/src/app/api/admin/components/[key]/fields/[fieldKey]/route.ts
import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { getSiteComponentByKey } from '@/lib/db/queries/site-components';
import { upsertDraftBinding, getDraftBinding } from '@/lib/db/queries/component-fields';
import { fieldPatchSchema } from '@/lib/schemas/admin/component-fields';
import { validateFieldValue } from '@/lib/components/field-validation'; // cf. B2
import { logAdminAudit } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx { params: { key: string; fieldKey: string }; }

export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    if (session.adminUser.status !== 'active') {
      throw new HttpError('forbidden', 'Compte admin inactif');
    }

    const cmp = await getSiteComponentByKey(ctx.params.key);
    if (!cmp) throw new HttpError('not_found', 'Composant introuvable');

    const fieldDef = cmp.fields.find((f) => f.key === ctx.params.fieldKey);
    if (!fieldDef) throw new HttpError('not_found', 'Champ introuvable');

    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = fieldPatchSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Payload invalide', parsed.error.flatten());
    }

    // Validation typée du value selon le FieldType
    const valueResult = validateFieldValue(parsed.data.value, fieldDef);
    if (!valueResult.success) {
      throw new HttpError('validation_failed', valueResult.error.message, valueResult.error.details);
    }

    const ifMatch = request.headers.get('if-match');
    const existingDraft = await getDraftBinding(cmp.id, fieldDef.key, parsed.data.locale);
    if (existingDraft && ifMatch && existingDraft.updatedAt.toISOString() !== ifMatch) {
      throw new HttpError('version_conflict', 'Une autre modification a eu lieu', {
        remoteValue: existingDraft.value,
        remoteUpdatedAt: existingDraft.updatedAt.toISOString(),
        remoteAuthorId: existingDraft.authorId,
      });
    }

    const binding = await upsertDraftBinding({
      componentId: cmp.id,
      fieldKey: fieldDef.key,
      locale: parsed.data.locale,
      value: valueResult.data,
      authorId: session.adminUser.id,
    });

    await logAdminAudit({
      actorId: session.adminUser.id,
      action: existingDraft ? 'field.draft.update' : 'field.draft.create',
      resourceType: 'componentField',
      resourceId: `${cmp.key}/${fieldDef.key}`,
      meta: { locale: parsed.data.locale, version: binding.version },
    });

    return NextResponse.json({ binding });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
```

Toutes les autres routes suivent le même squelette (auth, lookup,
Zod, action, audit, response). Cf. T2 et T3 pour les tests.

## Cross-références

- A4 : transitions et invariants.
- A6 : auth, audit, CSRF, rate-limit.
- B2 : Zod schémas par FieldType.
- B3 : invalidation de cache.
- F3 : consommateur côté admin.
