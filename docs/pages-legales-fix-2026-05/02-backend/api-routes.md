# API routes — code complet

## 1. POST `/api/admin/legal/template-vars`

**Fichier** : `apps/web/src/app/api/admin/legal/template-vars/route.ts`

Aujourd'hui : probablement supporte PUT par clé. On ajoute POST pour create.

```ts
/**
 * LEGAL-V2 — POST /api/admin/legal/template-vars
 *
 * Crée une nouvelle variable template.
 *
 * Body :
 *   {
 *     "key": "NEW_VAR",           // UPPER_SNAKE_CASE
 *     "label": "Label affiché",
 *     "description": "optionnel",
 *     "value": "valeur",          // optionnel, default ""
 *     "isRequired": false,        // optionnel
 *     "sortOrder": 200            // optionnel
 *   }
 *
 * Cf. docs/pages-legales-fix-2026-05/02-backend/api-routes.md
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logging/logger';
import { getAdminSession } from '@/lib/auth/require-admin';
import { createTemplateVar } from '@/lib/legal/repository';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const inputSchema = z.object({
  key: z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'Format UPPER_SNAKE_CASE'),
  label: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  value: z.string().max(2000).default(''),
  isRequired: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(9999).default(100),
});

export async function POST(req: NextRequest): Promise<Response> {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Admin session required' },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_json' }, { status: 400 },
    );
  }

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_input', message: parsed.error.message },
      { status: 400 },
    );
  }

  try {
    const result = await createTemplateVar(parsed.data, session.email);
    if (!result.ok) {
      if (result.code === 'conflict_key_exists') {
        return NextResponse.json(
          { error: 'conflict_key_exists', message: `Var "${parsed.data.key}" existe déjà` },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: result.code }, { status: 400 },
      );
    }
    logger.info('legal.vars.create', {
      key: parsed.data.key,
      isRequired: parsed.data.isRequired,
      by: session.email,
    });
    return NextResponse.json(result.row, { status: 201 });
  } catch (err) {
    logger.error('legal.vars.create.failed', { error: String(err), by: session.email });
    return NextResponse.json(
      { error: 'internal_error', message: 'Create failed' },
      { status: 500 },
    );
  }
}
```

## 2. DELETE `/api/admin/legal/cleanup-e2e`

**Fichier nouveau** : `apps/web/src/app/api/admin/legal/cleanup-e2e/route.ts`

```ts
/**
 * LEGAL-V2 — DELETE /api/admin/legal/cleanup-e2e
 *
 * Supprime les pages test E2E orphelines (slug LIKE 'e2e-test-%').
 *
 * Body :
 *   {
 *     "dryRun": true,
 *     "olderThanDays": 7
 *   }
 *
 * Cf. docs/pages-legales-fix-2026-05/02-backend/api-routes.md
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logging/logger';
import { getAdminSession } from '@/lib/auth/require-admin';
import { cleanupLegalE2E } from '@/lib/legal/cleanup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const inputSchema = z.object({
  dryRun: z.boolean().default(true),
  olderThanDays: z.number().int().min(7).max(365).default(7),
});

export async function DELETE(req: NextRequest): Promise<Response> {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json(
      { error: 'unauthorized' }, { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};  // accepter body vide pour défauts
  }

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_input', message: parsed.error.message },
      { status: 400 },
    );
  }

  try {
    const result = await cleanupLegalE2E(parsed.data);
    logger.info('legal.cleanup.e2e', {
      candidates: result.candidates,
      deleted: result.deleted,
      dryRun: result.dryRun,
      by: session.email,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    logger.error('legal.cleanup.e2e.failed', { error: String(err), by: session.email });
    return NextResponse.json(
      { error: 'internal_error' }, { status: 500 },
    );
  }
}
```

## 3. Tests des endpoints

**Fichier nouveau** : `apps/web/src/app/api/admin/legal/template-vars/route.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(),
}));
vi.mock('@/lib/legal/repository', () => ({
  createTemplateVar: vi.fn(),
}));
vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { POST } from './route';
import { getAdminSession } from '@/lib/auth/require-admin';
import { createTemplateVar } from '@/lib/legal/repository';

function makeReq(body: unknown): any {
  return { json: () => Promise.resolve(body) };
}

describe('POST /api/admin/legal/template-vars', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('401 si pas d\'auth', async () => {
    (getAdminSession as any).mockResolvedValue(null);
    const res = await POST(makeReq({ key: 'NEW_VAR', label: 'Label' }));
    expect(res.status).toBe(401);
  });

  it('400 si key invalide', async () => {
    (getAdminSession as any).mockResolvedValue({ email: 'admin@femiglow.local' });
    const res = await POST(makeReq({ key: 'invalid-key', label: 'Label' }));
    expect(res.status).toBe(400);
  });

  it('409 si key existe déjà', async () => {
    (getAdminSession as any).mockResolvedValue({ email: 'admin@femiglow.local' });
    (createTemplateVar as any).mockResolvedValue({ ok: false, code: 'conflict_key_exists' });
    const res = await POST(makeReq({ key: 'EXISTING', label: 'Label' }));
    expect(res.status).toBe(409);
  });

  it('201 si création réussie', async () => {
    (getAdminSession as any).mockResolvedValue({ email: 'admin@femiglow.local' });
    (createTemplateVar as any).mockResolvedValue({
      ok: true,
      row: { id: 'ltv_new', key: 'NEW_VAR', label: 'Label' },
    });
    const res = await POST(makeReq({ key: 'NEW_VAR', label: 'Label' }));
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.key).toBe('NEW_VAR');
  });
});
```

**Fichier nouveau** : `apps/web/src/app/api/admin/legal/cleanup-e2e/route.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/require-admin', () => ({
  getAdminSession: vi.fn(),
}));
vi.mock('@/lib/legal/cleanup', () => ({
  cleanupLegalE2E: vi.fn(),
}));
vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn() },
}));

import { DELETE } from './route';
import { getAdminSession } from '@/lib/auth/require-admin';
import { cleanupLegalE2E } from '@/lib/legal/cleanup';

function makeReq(body: unknown): any {
  return { json: () => Promise.resolve(body) };
}

describe('DELETE /api/admin/legal/cleanup-e2e', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('401 sans auth', async () => {
    (getAdminSession as any).mockResolvedValue(null);
    const res = await DELETE(makeReq({}));
    expect(res.status).toBe(401);
  });

  it('400 si olderThanDays < 7', async () => {
    (getAdminSession as any).mockResolvedValue({ email: 'admin@femiglow.local' });
    const res = await DELETE(makeReq({ dryRun: true, olderThanDays: 3 }));
    expect(res.status).toBe(400);
  });

  it('200 dryRun', async () => {
    (getAdminSession as any).mockResolvedValue({ email: 'admin@femiglow.local' });
    (cleanupLegalE2E as any).mockResolvedValue({
      candidates: 5, deleted: 0, dryRun: true,
      criteria: { slugLike: 'e2e-test-%', status: 'draft', olderThanDays: 7 },
    });
    const res = await DELETE(makeReq({ dryRun: true, olderThanDays: 7 }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.candidates).toBe(5);
    expect(json.deleted).toBe(0);
  });

  it('200 execute supprime les rows', async () => {
    (getAdminSession as any).mockResolvedValue({ email: 'admin@femiglow.local' });
    (cleanupLegalE2E as any).mockResolvedValue({
      candidates: 5, deleted: 5, dryRun: false,
      criteria: { slugLike: 'e2e-test-%', status: 'draft', olderThanDays: 7 },
    });
    const res = await DELETE(makeReq({ dryRun: false }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.deleted).toBe(5);
  });
});
```

## 4. Endpoint santé pollution (optionnel)

Cf. dashboard `04-data-strategy/monitoring.md` pour `GET /api/admin/legal/audit` qui renvoie le rapport drift en JSON.
