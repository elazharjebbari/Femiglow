/**
 * CHA-126 — Export CSV / JSON des conversations.
 *
 * Querystring :
 *   - format=csv|json (défaut csv)
 *   - language, status, q, fromDate, toDate, limit (max 1000)
 *
 * On retourne un flux téléchargeable (header `Content-Disposition`).
 * RGPD : aucune PII brute (le `content` chat_message contient déjà du
 * texte sanitizé/redacté côté pipeline).
 */
import { type NextRequest, NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { adminQueries } from '@/lib/chat/admin/queries';
import type { ChatSessionRow } from '@/lib/chat/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_LIMIT = 1000;

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  const format = (sp.get('format') ?? 'csv').toLowerCase();
  const limit = Math.min(MAX_LIMIT, Number.parseInt(sp.get('limit') ?? '500', 10) || 500);
  const fromDate = sp.get('fromDate') ? new Date(sp.get('fromDate')!) : undefined;
  const toDate = sp.get('toDate') ? new Date(sp.get('toDate')!) : undefined;
  const language = sp.get('language') ?? undefined;
  const statusParam = sp.get('status') as ChatSessionRow['status'] | null;

  const rows = await adminQueries.listConversations({
    q: sp.get('q') ?? undefined,
    language: language ?? undefined,
    status: statusParam ?? undefined,
    fromDate,
    toDate,
    limit,
  });

  const filename = `chat-conversations-${new Date().toISOString().slice(0, 10)}.${
    format === 'json' ? 'json' : 'csv'
  }`;

  if (format === 'json') {
    return new NextResponse(JSON.stringify(rows, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  }

  const csv = rowsToCsv(rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

function rowsToCsv(rows: ChatSessionRow[]): string {
  const headers = [
    'id',
    'visitorId',
    'language',
    'status',
    'page',
    'openedAt',
    'lastSeenAt',
    'archivedAt',
    'purgedAt',
    'convertedAt',
    'convertedOrderId',
  ];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        csvField(r.id),
        csvField(r.visitorId),
        csvField(r.language),
        csvField(r.status),
        csvField(r.page ?? ''),
        csvField(toIso(r.openedAt)),
        csvField(toIso(r.lastSeenAt)),
        csvField(toIso(r.archivedAt)),
        csvField(toIso(r.purgedAt)),
        csvField(toIso(r.convertedAt)),
        csvField(r.convertedOrderId ?? ''),
      ].join(','),
    );
  }
  return lines.join('\n');
}

function csvField(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toIso(d: Date | null | undefined): string {
  if (!d) return '';
  if (d instanceof Date) return d.toISOString();
  return String(d);
}
