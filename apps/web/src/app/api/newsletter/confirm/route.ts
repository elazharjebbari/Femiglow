/**
 * Double opt-in confirmation endpoint for newsletter signups.
 *
 *   GET /api/newsletter/confirm?t=<token>
 *
 * Validates the HMAC token (same scheme as unsubscribe), then upserts
 * email_subscriber_link with status=enabled + double_optin_confirmed_at.
 *
 * Returns a minimal HTML confirmation page (no client JS).
 */
import { type NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import { db as getDb } from '@/lib/db/client';
import { emailSubscriberLink } from '@/lib/db/schema-emails';
import { verifyUnsubToken } from '@/lib/mail/unsub-token';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function confirm(token: string | null): Promise<{ ok: boolean; email?: string; reason?: string }> {
  if (!token) return { ok: false, reason: 'missing-token' };
  const email = verifyUnsubToken(token);
  if (!email) return { ok: false, reason: 'invalid-or-expired' };

  const drizzle = getDb();
  if (!drizzle) return { ok: false, reason: 'db-not-configured' };

  // Upsert : if subscriber row exists (pending), promote to enabled. Else
  // create directly enabled. Either way, set double_optin_confirmed_at.
  const now = new Date();
  const existing = await drizzle
    .select({ email: emailSubscriberLink.email })
    .from(emailSubscriberLink)
    .where(eq(emailSubscriberLink.email, email))
    .limit(1);

  if (existing.length > 0) {
    await drizzle
      .update(emailSubscriberLink)
      .set({
        status: 'enabled',
        doubleOptinConfirmedAt: now,
        syncedAt: now,
      })
      .where(eq(emailSubscriberLink.email, email));
  } else {
    await drizzle.insert(emailSubscriberLink).values({
      email,
      status: 'enabled',
      consentAt: now,
      consentSource: 'newsletter-form',
      doubleOptinConfirmedAt: now,
    });
  }

  logger.info('newsletter.confirmed', { email });
  return { ok: true, email };
}

export async function GET(req: NextRequest): Promise<Response> {
  const token = new URL(req.url).searchParams.get('t');
  const result = await confirm(token);
  if (!result.ok) {
    return new NextResponse(
      `<!doctype html><html lang="fr"><body style="font-family:system-ui;padding:2rem;max-width:640px;margin:auto">
        <h1>Lien invalide</h1>
        <p>Désolé, ce lien de confirmation n'est plus valide ou a expiré.</p>
        <p>Tu peux retenter une inscription depuis
        <a href="https://femiglow-maroc.com">femiglow-maroc.com</a>.</p>
      </body></html>`,
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }
  return new NextResponse(
    `<!doctype html><html lang="fr"><body style="font-family:system-ui;padding:2rem;max-width:640px;margin:auto;text-align:center">
      <h1>Inscription confirmée ✨</h1>
      <p>Merci ! Tu es maintenant inscrit·e à la newsletter FemiGlow.</p>
      <p style="color:#666;font-size:.875rem">Tu peux te désinscrire à tout moment via le lien en bas de chaque email.</p>
      <p style="margin-top:2rem"><a href="https://femiglow-maroc.com" style="color:#7C9A8A">Retour au site →</a></p>
    </body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}
