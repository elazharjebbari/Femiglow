/**
 * LEGAL-V2 — Cleanup des pages test E2E orphelines.
 *
 * Supprime les rows legal_pages :
 *  - slug LIKE 'e2e-test-%'
 *  - status = 'draft'
 *  - created_at > N jours (default 7)
 *
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
    slugLike: string;
    status: string;
    olderThanDays: number;
  };
}

const SLUG_PATTERN = 'e2e-test-%';
const TARGET_STATUS = 'draft';

export async function cleanupLegalE2E(
  input: CleanupE2EInput,
): Promise<CleanupE2EResult> {
  if (input.olderThanDays < 7) {
    throw new Error('olderThanDays must be >= 7 (safety guard)');
  }
  const conn = db();
  if (!conn) throw new Error('cleanupLegalE2E requires DATABASE_URL');

  const cutoff = new Date(Date.now() - input.olderThanDays * 86_400_000);

  const countRows = await conn
    .select({ value: sql<number>`COUNT(*)` })
    .from(schema.legalPages)
    .where(
      and(
        like(schema.legalPages.slug, SLUG_PATTERN),
        eq(schema.legalPages.status, TARGET_STATUS),
        lt(schema.legalPages.createdAt, cutoff),
      ),
    );
  const candidates = Number(countRows[0]?.value ?? 0);

  let deleted = 0;
  if (!input.dryRun && candidates > 0) {
    const result = await conn
      .delete(schema.legalPages)
      .where(
        and(
          like(schema.legalPages.slug, SLUG_PATTERN),
          eq(schema.legalPages.status, TARGET_STATUS),
          lt(schema.legalPages.createdAt, cutoff),
        ),
      )
      .returning();
    deleted = result.length;
  }

  return {
    candidates,
    deleted,
    dryRun: input.dryRun,
    criteria: {
      slugLike: SLUG_PATTERN,
      status: TARGET_STATUS,
      olderThanDays: input.olderThanDays,
    },
  };
}
