/**
 * CHA-LEAD-V2 — POST /api/admin/chat/cleanup-ghosts
 *
 * Archive les ghost sessions wizard orphelines (sans lead lié).
 *
 * Sécurité :
 *   - Cookie admin valide requis.
 *   - olderThanDays >= 7 (sinon 400 BadRequest).
 *
 * Body :
 *   {
 *     "dryRun": true | false,
 *     "olderThanDays": 30,          // optionnel, default 30
 *     "kinds": ["wizard_pivot"]     // optionnel
 *   }
 *
 * Cf. docs/chat-conversations-leads-fix-2026-05/02-backend/api-routes.md §1
 */
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { logger } from '@/lib/logging/logger';
import { getAdminSession } from '@/lib/auth/require-admin';
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
  const session = await getAdminSession();
  if (!session) {
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
