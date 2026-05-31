# API Routes — cleanup endpoint

## 1. Nouveau endpoint `POST /api/admin/chat/cleanup-ghosts`

**Fichier** : `apps/web/src/app/api/admin/chat/cleanup-ghosts/route.ts` (création)

```ts
/**
 * CHA-LEAD-V2 — POST /api/admin/chat/cleanup-ghosts
 *
 * Archive les ghost sessions wizard orphelines (sans lead lié).
 *
 * Sécurité :
 *   - Cookie admin valide requis (admin@femiglow.local).
 *   - Rate limit : 5 req/heure/admin via redis ou memory.
 *   - olderThanDays >= 7 (sinon 400 BadRequest).
 *
 * Body :
 *   {
 *     "dryRun": true | false,
 *     "olderThanDays": 30,    // optionnel, default 30
 *     "kinds": ["wizard_pivot"]  // optionnel
 *   }
 *
 * Response 200 :
 *   {
 *     "candidates": <number>,
 *     "archived": <number>,
 *     "dryRun": <boolean>,
 *     "criteria": { ... }
 *   }
 *
 * Cf. docs/chat-conversations-leads-fix-2026-05/01-design-conception/api-contracts.md §9
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logging/logger';
import { requireAdmin } from '@/lib/auth/require-admin';
import { cleanupGhosts } from '@/lib/chat/admin/cleanup';
import { CHAT_SESSION_KINDS } from '@/lib/chat/db/kind';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const inputSchema = z.object({
  dryRun: z.boolean().default(true),
  olderThanDays: z.number().int().min(7).max(365).default(30),
  kinds: z.array(z.enum(CHAT_SESSION_KINDS)).optional(),
});

export async function POST(req: NextRequest): Promise<Response> {
  // 1. Auth admin
  let session;
  try {
    session = await requireAdmin('/api/admin/chat/cleanup-ghosts');
  } catch {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Admin session required' },
      { status: 401 },
    );
  }

  // 2. Parse + validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_json', message: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const parsed = inputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_input', message: parsed.error.message },
      { status: 400 },
    );
  }

  // 3. Exécute
  try {
    const result = await cleanupGhosts(parsed.data);
    logger.info('chat.admin.cleanup_ghosts', {
      candidates: result.candidates,
      archived: result.archived,
      dryRun: result.dryRun,
      by: session.email,
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    logger.error('chat.admin.cleanup_ghosts.failed', {
      error: String(err),
      by: session.email,
    });
    return NextResponse.json(
      { error: 'internal_error', message: 'Cleanup failed' },
      { status: 500 },
    );
  }
}
```

## 2. Tests du endpoint

**Fichier nouveau** : `apps/web/src/app/api/admin/chat/cleanup-ghosts/route.test.ts`

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn(),
}));
vi.mock('@/lib/chat/admin/cleanup', () => ({
  cleanupGhosts: vi.fn(),
}));

import { POST } from './route';
import { requireAdmin } from '@/lib/auth/require-admin';
import { cleanupGhosts } from '@/lib/chat/admin/cleanup';

function makeReq(body: unknown): Request {
  return new Request('http://localhost:3001/api/admin/chat/cleanup-ghosts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/admin/chat/cleanup-ghosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('401 si pas d\'auth admin', async () => {
    (requireAdmin as any).mockRejectedValue(new Error('Unauthorized'));
    const res = await POST(makeReq({ dryRun: true }) as any);
    expect(res.status).toBe(401);
  });

  it('400 si body invalide', async () => {
    (requireAdmin as any).mockResolvedValue({ email: 'admin@femiglow.local' });
    const res = await POST(makeReq({ olderThanDays: 3 }) as any); // < 7
    expect(res.status).toBe(400);
  });

  it('200 dry-run renvoie candidates sans toucher DB', async () => {
    (requireAdmin as any).mockResolvedValue({ email: 'admin@femiglow.local' });
    (cleanupGhosts as any).mockResolvedValue({
      candidates: 42,
      archived: 0,
      dryRun: true,
      criteria: { olderThanDays: 30, kinds: ['wizard_pivot'], withoutLead: true },
    });
    const res = await POST(makeReq({ dryRun: true }) as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({
      candidates: 42,
      archived: 0,
      dryRun: true,
    });
  });

  it('200 execute met à jour les rows', async () => {
    (requireAdmin as any).mockResolvedValue({ email: 'admin@femiglow.local' });
    (cleanupGhosts as any).mockResolvedValue({
      candidates: 42,
      archived: 42,
      dryRun: false,
      criteria: { olderThanDays: 30, kinds: ['wizard_pivot'], withoutLead: true },
    });
    const res = await POST(makeReq({ dryRun: false }) as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.archived).toBe(42);
  });

  it('500 si erreur DB', async () => {
    (requireAdmin as any).mockResolvedValue({ email: 'admin@femiglow.local' });
    (cleanupGhosts as any).mockRejectedValue(new Error('DB unavailable'));
    const res = await POST(makeReq({ dryRun: true }) as any);
    expect(res.status).toBe(500);
  });
});
```

## 3. Audit endpoint (optionnel, pour vérifier la pollution)

**Fichier nouveau** : `apps/web/src/app/api/admin/chat/audit-pollution/route.ts` (création)

```ts
/**
 * CHA-LEAD-V2 — GET /api/admin/chat/audit-pollution
 *
 * Renvoie un rapport synthétique sur la pollution :
 *  - distribution de chat_session par kind
 *  - count chat_lead par source
 *  - cohérence kind ↔ source
 */
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';

import { requireAdmin } from '@/lib/auth/require-admin';
import { requireChatDb } from '@/lib/chat/db/client';
import { chatLead, chatSession } from '@/lib/chat/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(): Promise<Response> {
  try {
    await requireAdmin('/api/admin/chat/audit-pollution');
  } catch {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = requireChatDb();

  // Distribution kind
  const kindDist = await db
    .select({
      kind: chatSession.kind,
      n: sql<number>`COUNT(*)`,
    })
    .from(chatSession)
    .groupBy(chatSession.kind);

  // Distribution source
  const sourceDist = await db
    .select({
      source: chatLead.source,
      n: sql<number>`COUNT(*)`,
    })
    .from(chatLead)
    .groupBy(chatLead.source);

  // Cohérence kind ↔ source
  const coherence = await db.execute<{ kind: string; source: string; n: number }>(sql`
    SELECT s.kind, l.source, COUNT(*) AS n
      FROM ${chatSession} s
      JOIN ${chatLead} l ON l.session_id = s.id
     GROUP BY 1, 2
     ORDER BY n DESC
  `);

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    distributions: {
      session_kind: kindDist,
      lead_source: sourceDist,
    },
    coherence: (coherence as { rows?: unknown[] }).rows ?? [],
  });
}
```

**Usage** : `curl -H 'cookie: ...' http://localhost:3001/api/admin/chat/audit-pollution | jq`.

## 4. Sécurité — rate limit (suggestion)

Pour éviter qu'un attaquant avec un cookie admin valide n'abuse du endpoint cleanup, ajouter un rate limit via Redis (ou memory fallback) :

```ts
// Dans route.ts, avant le cleanup
import { rateLimit } from '@/lib/redis/rate-limit';

const rl = await rateLimit({
  key: `cleanup_ghosts:${session.email}`,
  windowSec: 3600,
  max: 5,
});
if (!rl.allowed) {
  return NextResponse.json(
    { error: 'rate_limited', resetAt: rl.resetAt },
    { status: 429 },
  );
}
```

## 5. Documentation OpenAPI (optionnel)

Si le projet utilise un fichier OpenAPI agrégé (`docs/openapi.yaml`), ajouter :

```yaml
/api/admin/chat/cleanup-ghosts:
  post:
    summary: Cleanup chat session ghosts wizard orphelins
    operationId: cleanupChatGhosts
    security:
      - adminCookie: []
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            properties:
              dryRun: { type: boolean, default: true }
              olderThanDays: { type: integer, minimum: 7, maximum: 365, default: 30 }
              kinds:
                type: array
                items: { type: string, enum: [chat, wizard_pivot, system] }
    responses:
      '200':
        description: Cleanup result
        content:
          application/json:
            schema:
              type: object
              required: [candidates, archived, dryRun, criteria]
      '401': { description: Unauthorized }
      '400': { description: Bad input }
      '500': { description: Internal error }
```

## 6. UI pour exécuter le endpoint

Cf. [`../03-frontend-ui-ux/pages-admin.md`](../03-frontend-ui-ux/pages-admin.md) §6 "Cleanup admin UI".

Bref : bouton "Nettoyer ghosts orphelins" sur `/admin/chat/audit` qui :
1. Appelle d'abord en dryRun pour montrer le count.
2. Demande confirmation modale.
3. Re-appelle en `dryRun: false`.
4. Affiche un toast avec le résultat.
