/**
 * Phase audit-counts — snapshot row counts par table critique avant le wipe.
 * Sert pour le rapport final (diff before/after) et pour pré-reset dans le manifest.
 */
import type { PhaseContext, PhaseResult, RowCountsSnapshot } from '../types';
import { db } from '@/lib/db/client';
import { rowsOf } from '@/lib/db/exec';
import { sql } from 'drizzle-orm';

const CRITICAL_TABLES = [
  // System
  'admin_users', 'audit_events', 'app_config',
  // Commerce
  'products', 'product_variants', 'delivery_cities', 'form_config',
  // Content
  'media', 'site_components', 'seo_overrides', 'ritual_testimonials',
  // Users
  'orders', 'leads', 'chat_lead',
  // Chat
  'chat_instruction_version', 'chat_theme_preset',
  // Tracking
  'tracking_event_definitions', 'experiments',
];

export async function runAuditCounts(ctx: PhaseContext): Promise<PhaseResult> {
  const conn = db();
  const counts: Record<string, number> = {};
  if (!conn) {
    return { stats: { counts }, summary: 'no DB (memory mode)' };
  }
  let i = 0;
  for (const table of CRITICAL_TABLES) {
    ctx.onProgress?.(`count ${table}`, i / CRITICAL_TABLES.length);
    i += 1;
    try {
      const result = await conn.execute<{ n: number }>(
        sql`SELECT count(*)::int AS n FROM ${sql.identifier(table)}`,
      );
      const row = rowsOf<{ n: number }>(result)[0];
      counts[table] = row?.n ?? 0;
    } catch {
      counts[table] = -1; // table absente
    }
  }
  const snapshot: RowCountsSnapshot = { takenAt: Date.now(), counts };
  return {
    stats: { counts: snapshot.counts, takenAt: snapshot.takenAt },
    summary: `${Object.keys(counts).length} tables countées`,
  };
}
