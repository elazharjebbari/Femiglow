/**
 * CHA-050 — Cron: purge sessions inactives (RGPD).
 *
 * Stratégie :
 * - sessions `status = 'open'` sans activité depuis > 90 j → archive
 * - sessions `status = 'archived'` depuis > 365 j → forget (anonymisation)
 * - rate-limit buckets expirés → DELETE
 *
 * cf. docs/chat-assistant/13-securite-rgpd-moderation.md §7
 */
import { sql } from 'drizzle-orm';
import { type NextRequest, NextResponse } from 'next/server';

import { requireChatDb } from '@/lib/chat/db/client';
import { rateLimit } from '@/lib/chat/services/rate-limit';
import { isAuthorizedCron } from '@/lib/chat/services/auth-cron';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<Response> {
  if (!isAuthorizedCron(req)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }
  const db = requireChatDb();

  // 1) sessions ouvertes mais idle depuis > 90j → archive
  const archived = await db.execute<{ id: string }>(sql`
    UPDATE chat_session
       SET status = 'archived',
           archived_at = NOW(),
           updated_at  = NOW()
     WHERE status = 'open'
       AND last_seen_at < NOW() - INTERVAL '90 days'
     RETURNING id
  `);

  // 2) sessions archivées depuis > 365j → anonymise
  const purged = await db.execute<{ id: string }>(sql`
    UPDATE chat_session
       SET status = 'purged',
           purged_at = NOW(),
           visitor_id = encode(gen_random_bytes(16), 'hex'),
           fingerprint_hash = NULL,
           referrer = NULL,
           utm = NULL,
           meta_summary = NULL,
           updated_at = NOW()
     WHERE status = 'archived'
       AND archived_at < NOW() - INTERVAL '365 days'
     RETURNING id
  `);

  // 3) rate-limit buckets expirés
  const buckets = await rateLimit.purgeExpired();

  const archivedCount = (archived as { rows?: unknown[] }).rows?.length ?? 0;
  const purgedCount = (purged as { rows?: unknown[] }).rows?.length ?? 0;

  logger.info('chat.cron.purge', {
    archived: archivedCount,
    purged: purgedCount,
    buckets,
  });
  return NextResponse.json({
    archived: archivedCount,
    purged: purgedCount,
    rateLimitBucketsCleaned: buckets,
  });
}
