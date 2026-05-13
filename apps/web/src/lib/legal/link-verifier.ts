import { and, desc, eq, sql } from 'drizzle-orm';

import { db, schema } from '@/lib/db/client';
import { createId } from '@/lib/ids';
import { LEGAL_LINK_HEALTH_ID_PREFIX, type LegalLinkStatus } from '@/lib/legal/types';

export interface LinkCheckTarget {
  zoneKey: string;
  pageSlug: string;
}

export interface LinkCheckResult {
  zoneKey: string;
  pageSlug: string;
  status: LegalLinkStatus;
  httpCode: number | null;
  latencyMs: number | null;
  notes: string | null;
}

const DEFAULT_TIMEOUT_MS = 5_000;

export async function gatherPlacementsToCheck(): Promise<LinkCheckTarget[]> {
  const conn = db();
  if (!conn) return [];
  const rows = await conn
    .select({
      zoneKey: schema.legalPagePlacements.zoneKey,
      pageSlug: schema.legalPagePlacements.pageSlug,
    })
    .from(schema.legalPagePlacements)
    .where(eq(schema.legalPagePlacements.isVisible, true));
  return rows;
}

export async function classifyLink(target: LinkCheckTarget): Promise<LinkCheckResult> {
  const conn = db();
  if (!conn) {
    return {
      zoneKey: target.zoneKey,
      pageSlug: target.pageSlug,
      status: 'page_missing',
      httpCode: null,
      latencyMs: null,
      notes: 'db unavailable',
    };
  }

  const pageRows = await conn
    .select({ status: schema.legalPages.status })
    .from(schema.legalPages)
    .where(eq(schema.legalPages.slug, target.pageSlug))
    .limit(1);

  const status = pageRows[0]?.status;
  if (!status) {
    return {
      zoneKey: target.zoneKey,
      pageSlug: target.pageSlug,
      status: 'page_missing',
      httpCode: null,
      latencyMs: null,
      notes: 'no row for slug',
    };
  }
  if (status !== 'published') {
    return {
      zoneKey: target.zoneKey,
      pageSlug: target.pageSlug,
      status: 'page_draft',
      httpCode: null,
      latencyMs: null,
      notes: `current status=${status}`,
    };
  }

  return {
    zoneKey: target.zoneKey,
    pageSlug: target.pageSlug,
    status: 'ok',
    httpCode: null,
    latencyMs: null,
    notes: null,
  };
}

export async function checkLinkOverHttp(
  baseUrl: string,
  target: LinkCheckTarget,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<LinkCheckResult> {
  const conn = db();
  if (!conn) return classifyLink(target);

  const initial = await classifyLink(target);
  if (initial.status !== 'ok') return initial;

  const url = `${baseUrl.replace(/\/$/, '')}/legal/${target.pageSlug}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();

  try {
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal });
    const latencyMs = Date.now() - start;
    let httpStatus: LegalLinkStatus = 'ok';
    if (res.status >= 400 && res.status < 500) httpStatus = 'http_4xx';
    else if (res.status >= 500) httpStatus = 'http_5xx';
    return {
      zoneKey: target.zoneKey,
      pageSlug: target.pageSlug,
      status: httpStatus,
      httpCode: res.status,
      latencyMs,
      notes: null,
    };
  } catch (err) {
    const aborted = (err as Error)?.name === 'AbortError';
    return {
      zoneKey: target.zoneKey,
      pageSlug: target.pageSlug,
      status: aborted ? 'timeout' : 'http_5xx',
      httpCode: null,
      latencyMs: Date.now() - start,
      notes: aborted ? `aborted after ${timeoutMs}ms` : (err as Error).message,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function recordSnapshots(results: LinkCheckResult[]): Promise<number> {
  if (results.length === 0) return 0;
  const conn = db();
  if (!conn) return 0;
  const values = results.map((r) => ({
    id: createId(LEGAL_LINK_HEALTH_ID_PREFIX),
    zoneKey: r.zoneKey,
    pageSlug: r.pageSlug,
    status: r.status,
    httpCode: r.httpCode,
    latencyMs: r.latencyMs,
    notes: r.notes,
  }));
  await conn.insert(schema.legalLinkHealthSnapshot).values(values);
  return values.length;
}

export interface LinkHealthSummary {
  globalStatus: 'ok' | 'warning' | 'error';
  lastCheckedAt: Date | null;
  byZone: Array<{
    zoneKey: string;
    ok: number;
    broken: number;
    links: Array<{
      pageSlug: string;
      status: LegalLinkStatus;
      httpCode: number | null;
      checkedAt: Date;
    }>;
  }>;
}

export async function summarizeLinkHealth(): Promise<LinkHealthSummary> {
  const conn = db();
  if (!conn) {
    return { globalStatus: 'ok', lastCheckedAt: null, byZone: [] };
  }

  const rows = await conn
    .select()
    .from(schema.legalLinkHealthSnapshot)
    .orderBy(desc(schema.legalLinkHealthSnapshot.checkedAt))
    .limit(500);

  const byKey = new Map<
    string,
    { zoneKey: string; pageSlug: string; status: LegalLinkStatus; httpCode: number | null; checkedAt: Date }
  >();
  for (const r of rows) {
    const k = `${r.zoneKey}::${r.pageSlug}`;
    if (!byKey.has(k)) {
      byKey.set(k, {
        zoneKey: r.zoneKey,
        pageSlug: r.pageSlug,
        status: r.status as LegalLinkStatus,
        httpCode: r.httpCode,
        checkedAt: r.checkedAt,
      });
    }
  }

  const lastCheckedAt = rows[0]?.checkedAt ?? null;
  const zoneMap = new Map<string, LinkHealthSummary['byZone'][number]>();
  for (const entry of byKey.values()) {
    const z = zoneMap.get(entry.zoneKey) ?? {
      zoneKey: entry.zoneKey,
      ok: 0,
      broken: 0,
      links: [],
    };
    if (entry.status === 'ok') z.ok += 1;
    else z.broken += 1;
    z.links.push({
      pageSlug: entry.pageSlug,
      status: entry.status,
      httpCode: entry.httpCode,
      checkedAt: entry.checkedAt,
    });
    zoneMap.set(entry.zoneKey, z);
  }

  const totalBroken = [...zoneMap.values()].reduce((acc, z) => acc + z.broken, 0);
  const globalStatus: LinkHealthSummary['globalStatus'] =
    totalBroken === 0 ? 'ok' : totalBroken < 3 ? 'warning' : 'error';

  return {
    globalStatus,
    lastCheckedAt,
    byZone: [...zoneMap.values()].sort((a, b) => a.zoneKey.localeCompare(b.zoneKey)),
  };
}

export async function purgeOldSnapshots(daysToKeep = 30): Promise<number> {
  const conn = db();
  if (!conn) return 0;
  const result = await conn.execute(sql`
    DELETE FROM legal_link_health_snapshot
    WHERE checked_at < NOW() - (${daysToKeep} || ' days')::interval
  `);
  return (result as { rowCount?: number }).rowCount ?? 0;
}
