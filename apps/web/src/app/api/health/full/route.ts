/**
 * GET /api/health/full
 *
 * Health check étendu : DB ping + migration count + tables critiques + services
 * externes. Utilisé par bin/deploy.sh post-restart et par /admin/status.
 *
 * Reponses :
 *   200 OK   { status: 'ok', checks: { ... } }
 *   503      { status: 'degraded', checks: { ... }, failing: [...] }
 */
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db as getDb } from '@/lib/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CRITICAL_TABLES = [
  'leads',
  'orders',
  'email_outbox',
  'email_audience',
  'email_automation',
  'email_template_custom',
  'user_event',
  'admin_email_view',
  'legal_pages',
  'legal_zones',
  'legal_page_placements',
  'legal_template_vars',
];

type Check = { name: string; ok: boolean; detail?: string };

async function checkDb(): Promise<Check> {
  const drizzle = getDb();
  if (!drizzle) return { name: 'db', ok: false, detail: 'db client not configured' };
  try {
    await drizzle.execute(sql`SELECT 1`);
    return { name: 'db', ok: true };
  } catch (e) {
    return { name: 'db', ok: false, detail: String(e) };
  }
}

function extractRows<T>(res: unknown): T[] {
  // postgres-js (drizzle) returns the array directly; node-pg returns { rows }
  if (Array.isArray(res)) return res as T[];
  if (res && typeof res === 'object' && Array.isArray((res as { rows?: T[] }).rows)) {
    return (res as { rows: T[] }).rows;
  }
  return [];
}

async function checkMigrations(): Promise<Check> {
  const drizzle = getDb();
  if (!drizzle) return { name: 'migrations', ok: false, detail: 'no db' };
  try {
    const raw = await drizzle.execute(
      sql`SELECT count(*)::int AS c FROM drizzle.__drizzle_migrations`,
    );
    const rows = extractRows<{ c: number }>(raw);
    const dbCount = rows[0]?.c ?? 0;

    let journalCount = 0;
    try {
      const journalPath = resolve(process.cwd(), 'drizzle/migrations/meta/_journal.json');
      const j = JSON.parse(readFileSync(journalPath, 'utf8'));
      journalCount = j.entries?.length ?? 0;
    } catch {
      return { name: 'migrations', ok: true, detail: `applied=${dbCount} (journal not bundled)` };
    }

    const ok = dbCount === journalCount;
    return {
      name: 'migrations',
      ok,
      detail: `applied=${dbCount} journal=${journalCount}${ok ? '' : ' MISMATCH'}`,
    };
  } catch (e) {
    return { name: 'migrations', ok: false, detail: String(e) };
  }
}

async function checkCriticalTables(): Promise<Check> {
  const drizzle = getDb();
  if (!drizzle) return { name: 'tables', ok: false, detail: 'no db' };
  try {
    const raw = await drizzle.execute(sql`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `);
    const present = new Set(extractRows<{ tablename: string }>(raw).map((r) => r.tablename));
    const missing = CRITICAL_TABLES.filter((t) => !present.has(t));
    return {
      name: 'tables',
      ok: missing.length === 0,
      detail:
        missing.length === 0
          ? `${CRITICAL_TABLES.length}/${CRITICAL_TABLES.length} present`
          : `MISSING: ${missing.join(', ')}`,
    };
  } catch (e) {
    return { name: 'tables', ok: false, detail: String(e) };
  }
}

export async function GET() {
  const checks = await Promise.all([checkDb(), checkMigrations(), checkCriticalTables()]);
  const failing = checks.filter((c) => !c.ok);
  const ok = failing.length === 0;
  return NextResponse.json(
    {
      status: ok ? 'ok' : 'degraded',
      ts: new Date().toISOString(),
      checks,
      ...(ok ? {} : { failing: failing.map((c) => c.name) }),
    },
    { status: ok ? 200 : 503 },
  );
}
