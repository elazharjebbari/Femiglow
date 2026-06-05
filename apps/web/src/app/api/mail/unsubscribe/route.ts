/**
 * List-Unsubscribe endpoint (RFC 8058) + page de confirmation non destructive.
 *
 *   POST /api/mail/unsubscribe?t=<token>                  → 200 OK (one-click)
 *   POST /api/mail/unsubscribe?t=<token>&action=resubscribe → 200 + page réabo
 *   GET  /api/mail/unsubscribe?t=<token>                  → 200 + page de
 *                                                            CONFIRMATION (ne
 *                                                            supprime RIEN)
 *
 * Le token est HMAC-signé (cf. unsub-token.ts).
 *
 * UX-PUB-004 — le GET est désormais NON DESTRUCTIF. Auparavant, un GET exécutait
 * immédiatement la suppression : un préfetch de lien par Gmail/Outlook
 * safelinks/un antivirus désinscrivait l'utilisateur sans intention. Le lien
 * VISIBLE cliqué affiche maintenant une page « Confirmer la désinscription »
 * avec un bouton qui POST le token (le POST seul exécute la suppression).
 * L'en-tête `List-Unsubscribe-Post=One-Click` (POST) reste honoré pour les
 * clients RFC 8058.
 *
 * UX-PUB-005 — la page de confirmation porte un bouton « Me réabonner » qui POST
 * `action=resubscribe` : il retire la suppression `unsubscribe` et ré-active le
 * subscriber_link (chemin de retour direct après une désinscription par erreur).
 *
 * Cf. docs/emailing/11-security-rgpd.md §3.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db as getDb } from '@/lib/db/client';
import {
  emailSuppression,
  emailSubscriberLink,
} from '@/lib/db/schema-emails';
import { verifyUnsubToken } from '@/lib/mail/unsub-token';
import { logger } from '@/lib/logging/logger';
import { enforceMailRateLimit } from '@/lib/mail/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ProcessResult = { ok: boolean; email?: string; reason?: string };

/** Échappe le texte injecté dans le HTML de confirmation (anti-injection). */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Exécute la désinscription (DESTRUCTIF) : suppression + bascule disabled. */
async function unsubscribe(token: string | null): Promise<ProcessResult> {
  if (!token) return { ok: false, reason: 'missing-token' };
  const email = verifyUnsubToken(token);
  if (!email) return { ok: false, reason: 'invalid-or-expired' };

  const drizzle = getDb();
  if (!drizzle) return { ok: false, reason: 'db-not-configured' };
  await drizzle.transaction(async (tx) => {
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

/**
 * Réabonnement (UX-PUB-005) : retire UNIQUEMENT la suppression `unsubscribe`
 * (on ne « réveille » jamais une adresse mise en suppression pour bounce/plainte)
 * et ré-active le subscriber_link s'il existe. Idempotent.
 */
async function resubscribe(token: string | null): Promise<ProcessResult> {
  if (!token) return { ok: false, reason: 'missing-token' };
  const email = verifyUnsubToken(token);
  if (!email) return { ok: false, reason: 'invalid-or-expired' };

  const drizzle = getDb();
  if (!drizzle) return { ok: false, reason: 'db-not-configured' };
  await drizzle.transaction(async (tx) => {
    await tx
      .delete(emailSuppression)
      .where(
        and(
          eq(emailSuppression.email, email),
          eq(emailSuppression.reason, 'unsubscribe'),
        ),
      );
    await tx
      .update(emailSubscriberLink)
      .set({ status: 'enabled', unsubscribedAt: null })
      .where(eq(emailSubscriberLink.email, email));
  });

  logger.info('mail.resubscribe.processed', { email });
  return { ok: true, email };
}

/** Lit le token, calcule (sans écrire) l'email pour la page de confirmation. */
function peek(token: string | null): ProcessResult {
  if (!token) return { ok: false, reason: 'missing-token' };
  const email = verifyUnsubToken(token);
  if (!email) return { ok: false, reason: 'invalid-or-expired' };
  return { ok: true, email };
}

function htmlPage(body: string, status: number): Response {
  return new NextResponse(
    `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
      `<body style="font-family:system-ui;padding:2rem;max-width:640px;margin:auto;line-height:1.6">${body}</body></html>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

function invalidLinkPage(): Response {
  return htmlPage(
    `<h1>Lien invalide</h1>
     <p>Désolé, ce lien n'est plus valide. Tu peux nous écrire à
     <a href="mailto:info@femiglow-maroc.com">info@femiglow-maroc.com</a>.</p>`,
    400,
  );
}

export async function POST(req: NextRequest): Promise<Response> {
  const blocked = await enforceMailRateLimit('unsubscribe', req);
  if (blocked) return blocked;
  const url = new URL(req.url);
  const token = url.searchParams.get('t');
  const action = url.searchParams.get('action');

  // UX-PUB-005 — branche réabonnement (déclenchée par le bouton « Me réabonner »
  // de la page de confirmation, ou un POST programmatique). Page HTML car
  // soumise depuis un <form> navigateur.
  if (action === 'resubscribe') {
    const result = await resubscribe(token);
    if (!result.ok) return invalidLinkPage();
    return htmlPage(
      `<h1>Réabonnement confirmé ✨</h1>
       <p>C'est noté${result.email ? ` pour <strong>${escapeHtml(result.email)}</strong>` : ''} :
       tu recevras de nouveau la lettre de la maison FemiGlow.</p>
       <p style="color:#666;font-size:.875rem">Tu peux te désinscrire à tout moment
       via le lien en bas de chaque email.</p>
       <p style="margin-top:2rem"><a href="https://femiglow-maroc.com" style="color:#7C9A8A">Retour au site →</a></p>`,
      200,
    );
  }

  const result = await unsubscribe(token);
  if (!result.ok) {
    return new NextResponse(`Unsubscribe failed: ${result.reason}`, { status: 400 });
  }
  // Le <form> de la page de confirmation (navigateur humain, Accept: text/html)
  // mérite une page digne — pas un JSON brut. Le one-click RFC 8058 (Gmail/
  // Apple Mail POSTent sans Accept html) et les appels API gardent le JSON.
  if (req.headers.get('accept')?.includes('text/html')) {
    const tokenParam = encodeURIComponent(token!);
    return htmlPage(
      `<h1>Désinscription confirmée</h1>
       <p>C'est noté${result.email ? ` pour <strong>${escapeHtml(result.email)}</strong>` : ''} :
       tu ne recevras plus de communications marketing de FemiGlow.</p>
       <p style="color:#666;font-size:.875rem">Tu t'es désinscrit par erreur ?</p>
       <form method="post" action="/api/mail/unsubscribe?action=resubscribe&t=${tokenParam}" style="margin:.5rem 0">
         <button type="submit"
           style="background:transparent;color:#7C9A8A;border:1px solid #7C9A8A;border-radius:6px;padding:.6rem 1.1rem;font-size:.95rem;cursor:pointer">
           Me réabonner
         </button>
       </form>`,
      200,
    );
  }
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest): Promise<Response> {
  const blocked = await enforceMailRateLimit('unsubscribe', req);
  if (blocked) return blocked;
  const token = new URL(req.url).searchParams.get('t');

  // UX-PUB-004 — GET NON DESTRUCTIF : on se contente de vérifier le token et
  // d'afficher la page de confirmation. AUCUNE écriture en base ici.
  const result = peek(token);
  if (!result.ok) return invalidLinkPage();

  const email = result.email!;
  const tokenParam = encodeURIComponent(token!);
  // Deux <form> distincts qui POSTent le même token signé :
  //  - confirmer la désinscription (POST sans action → unsubscribe)
  //  - me réabonner (POST action=resubscribe)
  return htmlPage(
    `<h1>Confirmer la désinscription</h1>
     <p>Tu es sur le point de te désinscrire des communications de FemiGlow pour
     <strong>${escapeHtml(email)}</strong>.</p>
     <form method="post" action="/api/mail/unsubscribe?t=${tokenParam}" style="margin:1.5rem 0">
       <button type="submit"
         style="background:#7C9A8A;color:#fff;border:0;border-radius:6px;padding:.75rem 1.25rem;font-size:1rem;cursor:pointer">
         Confirmer la désinscription
       </button>
     </form>
     <p style="color:#666;font-size:.875rem">Tu t'es désinscrit par erreur, ou tu veux rester abonné ?</p>
     <form method="post" action="/api/mail/unsubscribe?action=resubscribe&t=${tokenParam}" style="margin:.5rem 0">
       <button type="submit"
         style="background:transparent;color:#7C9A8A;border:1px solid #7C9A8A;border-radius:6px;padding:.6rem 1.1rem;font-size:.95rem;cursor:pointer">
         Me réabonner
       </button>
     </form>`,
    200,
  );
}
