# API Contracts — signatures cible

## 1. `presetVarsForPage` (nouveau helper)

**Fichier** : `apps/web/src/lib/legal/vars.ts`

```ts
/**
 * LEGAL-V2 — Presets dérivés d'une page spécifique.
 * Étend `presetVars()` avec VERSION et LAST_UPDATED contextuels.
 */
export function presetVarsForPage(
  page: { version: number; updatedAt: Date },
  now: Date = new Date(),
): Map<string, string> {
  const m = presetVars(now);
  m.set('VERSION', `v${page.version}`);
  // LAST_UPDATED dérive de la page (pas du moment du render)
  m.set('LAST_UPDATED', formatFrenchDate(page.updatedAt));
  return m;
}
```

**Usage downstream** :

```ts
// Dans repository.ts ou render.ts
const presets = presetVarsForPage(page);
const dbVars = await listAllTemplateVars();
const fullMap = buildVarMap(dbVars);
// Override avec presets (priorité aux presets)
for (const [k, v] of presets) fullMap.set(k, v);

const html = substituteVars(page.bodyMd, fullMap, 'public');
```

---

## 2. `detectMissingVars` — pas de changement

Signature inchangée. Mais le comportement bénéficie de :
- Vars renommées (CONTACT_EMAIL existe désormais)
- 7 vars ajoutées (COOLING_OFF_DAYS, etc.)
- VERSION reconnu comme preset (donc jamais missing)

---

## 3. POST `/api/admin/legal/template-vars` (nouveau)

### Request

```http
POST /api/admin/legal/template-vars
Cookie: <admin_session>
Content-Type: application/json

{
  "key": "NEW_VAR",
  "label": "Nouvelle variable",
  "description": "Description optionnelle",
  "value": "valeur par défaut",
  "isRequired": false,
  "sortOrder": 200
}
```

### Validation (Zod)

```ts
import { z } from 'zod';

export const createTemplateVarInputSchema = z.object({
  key: z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'Format UPPER_SNAKE_CASE requis'),
  label: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  value: z.string().max(2000).default(''),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(9999).default(100),
});
```

### Response (201)

```json
{
  "id": "ltv_xxxxx",
  "key": "NEW_VAR",
  "label": "Nouvelle variable",
  ...
}
```

### Erreurs

- `401` : pas de session admin
- `400` : `invalid_input` (Zod error)
- `409` : `conflict_key_exists` (clé déjà utilisée)
- `500` : `internal_error`

---

## 4. PUT `/api/admin/legal/template-vars/[key]` (existant — pas de changement)

Mise à jour de la `value`. Inchangé.

---

## 5. DELETE `/api/admin/legal/cleanup-e2e` (nouveau)

### Request

```http
DELETE /api/admin/legal/cleanup-e2e
Cookie: <admin_session>
Content-Type: application/json

{
  "dryRun": true,
  "olderThanDays": 7
}
```

### Response (200)

```json
{
  "candidates": 5,
  "deleted": 0,
  "dryRun": true,
  "criteria": {
    "slugLike": "e2e-test-%",
    "status": "draft",
    "olderThanDays": 7
  }
}
```

### Sécurité

- Cookie admin requis
- `olderThanDays >= 7` (safety guard)
- `slugLike` est fixé à `'e2e-test-%'` (pas d'override pour éviter mauvais usage)

---

## 6. `cleanupLegalE2E` (business logic)

**Fichier nouveau** : `apps/web/src/lib/legal/cleanup.ts`

```ts
/**
 * LEGAL-V2 — Cleanup des pages test E2E orphelines.
 * Cf. docs/pages-legales-fix-2026-05/02-backend/api-routes.md
 */
import { and, eq, like, lt, sql } from 'drizzle-orm';
import { db, schema } from '@/lib/db/client';

export interface CleanupE2EInput {
  dryRun: boolean;
  olderThanDays: number;
}

export interface CleanupE2EResult {
  candidates: number;
  deleted: number;
  dryRun: boolean;
  criteria: {
    slugLike: 'e2e-test-%';
    status: 'draft';
    olderThanDays: number;
  };
}

export async function cleanupLegalE2E(
  input: CleanupE2EInput,
): Promise<CleanupE2EResult> {
  if (input.olderThanDays < 7) {
    throw new Error('olderThanDays must be >= 7 (safety guard)');
  }
  const conn = db();
  if (!conn) throw new Error('cleanupLegalE2E requires DATABASE_URL');

  const cutoff = new Date(Date.now() - input.olderThanDays * 86_400_000);

  const cands = await conn
    .select({ value: sql<number>`COUNT(*)` })
    .from(schema.legalPages)
    .where(
      and(
        like(schema.legalPages.slug, 'e2e-test-%'),
        eq(schema.legalPages.status, 'draft'),
        lt(schema.legalPages.createdAt, cutoff),
      ),
    );
  const candidates = Number(cands[0]?.value ?? 0);

  let deleted = 0;
  if (!input.dryRun && candidates > 0) {
    const result = await conn
      .delete(schema.legalPages)
      .where(
        and(
          like(schema.legalPages.slug, 'e2e-test-%'),
          eq(schema.legalPages.status, 'draft'),
          lt(schema.legalPages.createdAt, cutoff),
        ),
      )
      .returning({ id: schema.legalPages.id });
    deleted = result.length;
  }

  return {
    candidates,
    deleted,
    dryRun: input.dryRun,
    criteria: {
      slugLike: 'e2e-test-%',
      status: 'draft',
      olderThanDays: input.olderThanDays,
    },
  };
}
```

---

## 7. Feature flag `legal/feature-flag.ts` (nouveau)

```ts
/**
 * LEGAL-V2 — Feature flags pour le sprint pages légales.
 */
import { env } from '@/lib/env';

/**
 * Si true, active :
 *  - Nouveau naming des vars (CONTACT_*, HOST_*, CNDP_DECLARATION_REF)
 *  - Preset VERSION dans presetVarsForPage
 *  - UI bouton "+ Nouvelle variable"
 *
 * Par défaut false pour rollback-safe.
 */
export function isLegalVarsV2Enabled(): boolean {
  return env.LEGAL_VARS_V2 === 'true';
}
```

Aussi à ajouter dans `src/lib/env.ts` :

```diff
   CHAT_ADMIN_FILTERS_V2: z.enum(['true', 'false']).default('false'),
+  // LEGAL-V2 — Active nouveau naming vars + presets V2.
+  LEGAL_VARS_V2: z.enum(['true', 'false']).default('false'),
```

---

## 8. Frontend prop contracts

### `<CreateVarForm />` (nouveau)

```tsx
'use client';

interface CreateVarFormProps {
  /** Callback après création réussie (revalidate parent). */
  onCreated?: (varKey: string) => void;
  /** Suggestions de clés (autocompletion à partir des vars utilisées sans définition). */
  suggestions?: string[];
}

export function CreateVarForm(props: CreateVarFormProps): JSX.Element;
```

### `TemplateVarsPage` (modifié)

Nouveau prop : récupère les "vars utilisées sans définition" pour suggestions :

```tsx
const unusedSuggestions = await getUnusedTemplateVars();
return <CreateVarForm suggestions={unusedSuggestions} />;
```

---

## 9. Contrats logs

### Logs `legal.vars.rename`

```json
{
  "level": "info",
  "event": "legal.vars.rename",
  "from": "COMPANY_EMAIL",
  "to": "CONTACT_EMAIL",
  "by": "admin@femiglow.local",
  "ts": "2026-05-27T..."
}
```

### Logs `legal.vars.create`

```json
{
  "level": "info",
  "event": "legal.vars.create",
  "key": "NEW_VAR",
  "isRequired": false,
  "by": "admin@femiglow.local"
}
```

### Logs `legal.cleanup.e2e`

```json
{
  "level": "info",
  "event": "legal.cleanup.e2e",
  "candidates": 5,
  "deleted": 5,
  "dryRun": false,
  "by": "admin@femiglow.local"
}
```

---

## 10. Versioning & deprecation

- Anciens helpers (`presetVars`, `substituteVars`, `detectMissingVars`) : signatures inchangées.
- Nouveaux helpers (`presetVarsForPage`) : optionnels.
- Quand `LEGAL_VARS_V2=true` devient permanent (post J+30), on pourra :
  - Retirer le flag du code (toujours actif)
  - Mettre à jour la doc pour annoncer le nouveau naming comme standard
