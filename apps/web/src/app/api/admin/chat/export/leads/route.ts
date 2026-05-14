/**
 * CHAT-066 — Export CSV / JSON des leads chat.
 *
 * Pourquoi
 * ────────
 * L'équipe Care veut récupérer la liste filtrée des leads (par trigger,
 * outcome, période) pour relances CRM ou rapports hebdo. La page admin
 * affiche déjà 200 lignes, mais on a besoin d'un export téléchargeable
 * pour tableurs / outils externes.
 *
 * Querystring
 * ────────────
 *   - format     = csv | json (défaut csv)
 *   - outcome    = pending | reached | no-answer | converted | discarded
 *   - trigger    = (cf. ChatLeadRow.triggerReason)
 *   - fromDate   = ISO date (inclus)
 *   - toDate     = ISO date (inclus)
 *   - limit      = entier 1..1000 (défaut 500)
 *
 * Auth
 * ────
 * `requireAdminApi` (iron-session admin) — identique aux autres exports.
 *
 * RGPD
 * ────
 * On exporte `phoneE164` (PII) parce que c'est précisément l'usage métier
 * (rappeler le visiteur). Le téléchargement reste réservé aux admins.
 * Conserve les fichiers comme du CSV sensible (pas Slack, pas pastebin).
 */
import { type NextRequest, NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { adminQueries } from '@/lib/chat/admin/queries';
import type { ChatLeadRow } from '@/lib/chat/db/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_LIMIT = 1000;

const OUTCOMES: ReadonlyArray<ChatLeadRow['outcome']> = [
  'pending',
  'reached',
  'no-answer',
  'converted',
  'discarded',
];

const TRIGGERS: ReadonlyArray<ChatLeadRow['triggerReason']> = [
  'explicit-request',
  'out-of-knowledge',
  'objection-repeat',
  'long-no-progress',
  'frustration',
  'after-hours',
  'b2b',
  'purchase-intent',
  'inline-contact',
  'manual',
];

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  const format = (sp.get('format') ?? 'csv').toLowerCase();
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number.parseInt(sp.get('limit') ?? '500', 10) || 500),
  );
  const fromDate = sp.get('fromDate') ? new Date(sp.get('fromDate')!) : undefined;
  const toDate = sp.get('toDate') ? new Date(sp.get('toDate')!) : undefined;
  const outcomeRaw = sp.get('outcome');
  const triggerRaw = sp.get('trigger');
  const outcome = OUTCOMES.includes(outcomeRaw as ChatLeadRow['outcome'])
    ? (outcomeRaw as ChatLeadRow['outcome'])
    : undefined;
  const triggerReason = TRIGGERS.includes(triggerRaw as ChatLeadRow['triggerReason'])
    ? (triggerRaw as ChatLeadRow['triggerReason'])
    : undefined;

  const rows = await adminQueries.listChatLeads({
    outcome,
    triggerReason,
    fromDate,
    toDate,
    limit,
  });

  const filename = `chat-leads-${new Date().toISOString().slice(0, 10)}.${
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

function rowsToCsv(rows: ChatLeadRow[]): string {
  const headers = [
    'id',
    'sessionId',
    'firstName',
    'phoneE164',
    'triggerReason',
    'outcome',
    'language',
    'intentAtCapture',
    'page',
    'referrer',
    'webhookStatus',
    'webhookAttempts',
    'handledBy',
    'createdAt',
    'consentVersion',
  ];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        csvField(r.id),
        csvField(r.sessionId),
        csvField(r.firstName),
        csvField(r.phoneE164),
        csvField(r.triggerReason),
        csvField(r.outcome),
        csvField(r.language),
        csvField(r.intentAtCapture ?? ''),
        csvField(r.page ?? ''),
        csvField(r.referrer ?? ''),
        csvField(r.webhookStatus),
        csvField(r.webhookAttempts),
        csvField(r.handledBy ?? ''),
        csvField(toIso(r.createdAt)),
        csvField(r.consentVersion),
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
