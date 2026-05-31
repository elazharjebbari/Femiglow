/**
 * CHAT-067 — Prévisualisation admin du digest hebdo des leads chat.
 *
 * Pourquoi
 * ────────
 * Le cron `weekly-digest` envoie l'email lundi matin. Avant que ça parte,
 * Care doit pouvoir voir ce qui va atterrir dans la boîte. On expose une
 * route admin qui calcule le digest sur une fenêtre paramétrable et le
 * renvoie en texte (Content-Type `text/plain`) — pratique pour faire un
 * smoke test post-deploy ou diagnostiquer un envoi vide.
 *
 * Querystring
 * ───────────
 *  - days  = entier 1..30 (défaut 7) — taille de la fenêtre.
 *  - format = text | json (défaut text)
 *
 * Sécurité : admin only (iron-session). RGPD : pas envoyé par email,
 * juste affiché dans la session admin.
 */
import { type NextRequest, NextResponse } from 'next/server';

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { adminQueries } from '@/lib/chat/admin/queries';
import {
  buildWeeklyDigest,
  summarizeWeeklyLeads,
} from '@/lib/chat/services/weekly-digest';
import { env } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_DAYS = 7;
const MAX_DAYS = 30;

export async function GET(req: NextRequest): Promise<Response> {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const sp = req.nextUrl.searchParams;
  const rawDays = Number.parseInt(sp.get('days') ?? '', 10);
  const days = Math.min(
    MAX_DAYS,
    Math.max(1, Number.isFinite(rawDays) && rawDays > 0 ? rawDays : DEFAULT_DAYS),
  );
  const format = (sp.get('format') ?? 'text').toLowerCase();

  const now = new Date();
  const fromDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const leads = await adminQueries.listChatLeads({
    fromDate,
    toDate: now,
    limit: 1000,
  });

  const rendered = buildWeeklyDigest({
    leads,
    generatedAt: now,
    adminBaseUrl: env.NEXT_PUBLIC_SITE_URL,
    from: env.CHAT_DIGEST_FROM,
  });

  if (format === 'json') {
    return NextResponse.json({
      window: { days, fromDate, toDate: now },
      summary: summarizeWeeklyLeads(leads),
      rendered,
    });
  }

  const body = `Subject: ${rendered.subject}\nFrom: ${rendered.from}\nReply-To: ${rendered.replyTo}\nPreheader: ${rendered.preheader ?? ''}\n\n${rendered.body}`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
