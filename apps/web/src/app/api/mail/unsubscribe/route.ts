/**
 * One-click List-Unsubscribe endpoint (RFC 8058).
 *
 *   POST /api/mail/unsubscribe?t=<token>  → 200 OK
 *   GET  /api/mail/unsubscribe?t=<token>  → 200 + minimal HTML confirmation
 *
 * The token is HMAC-signed (cf. unsub-token.ts). On valid token:
 *   - INSERT into email_suppression(reason='unsubscribe')
 *   - UPDATE email_subscriber_link.status='disabled' if present
 *
 * Cf. docs/emailing/11-security-rgpd.md §3.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import {
  emailSuppression,
  emailSubscriberLink,
} from '@/lib/db/schema-emails';
import { verifyUnsubToken } from '@/lib/mail/unsub-token';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function process(token: string | null): Promise<{ ok: boolean; email?: string; reason?: string }> {
  if (!token) return { ok: false, reason: 'missing-token' };

  const email = verifyUnsubToken(token);
  if (!email) return { ok: false, reason: 'invalid-or-expired' };

  await db.transaction(async (tx) => {
    await tx
      .insert(emailSuppression)
      .values({
        email,
        reason: 'unsubscribe',
        detail: 'list-unsubscribe-one-click',
        source: 'manual',
      })
      .onConflictDoNothing();
    await tx
      .update(emailSubscriberLink)
      .set({ status: 'disabled', unsubscribedAt: new Date() })
      .where(eq(emailSubscriberLink.email, email));
  });

  logger.info('mail.unsubscribe.processed', { email });
  return { ok: true, email };
}

export async function POST(req: NextRequest): Promise<Response> {
  const token = new URL(req.url).searchParams.get('t');
  const result = await process(token);
  if (!result.ok) return new NextResponse(`Unsubscribe failed: ${result.reason}`, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest): Promise<Response> {
  const token = new URL(req.url).searchParams.get('t');
  const result = await process(token);
  if (!result.ok) {
    return new NextResponse(
      `<!doctype html><html lang="fr"><body style="font-family:system-ui;padding:2rem">
        <h1>Lien invalide</h1>
        <p>Désolé, ce lien de désabonnement n'est plus valide. Tu peux nous écrire à
        <a href="mailto:info@femiglow-maroc.com">info@femiglow-maroc.com</a>.</p>
      </body></html>`,
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
  return new NextResponse(
    `<!doctype html><html lang="fr"><body style="font-family:system-ui;padding:2rem">
      <h1>Désinscription confirmée ✓</h1>
      <p>Tu ne recevras plus de communications marketing de FemiGlow.</p>
      <p style="color:#666;font-size:.875rem">Si tu changes d'avis, tu peux te réinscrire sur
      <a href="https://femiglow-maroc.com">femiglow-maroc.com</a>.</p>
    </body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
