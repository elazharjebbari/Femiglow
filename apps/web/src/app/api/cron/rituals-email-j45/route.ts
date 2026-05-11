import { NextResponse } from 'next/server';
import { generateEmailToken } from '@/lib/rituals/email-tokens';
import { hashCustomerEmail } from '@/lib/rituals/customer-hash';
import { renderEmailTemplate } from '@/lib/rituals/email-templates';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * CRON J+45 — envoie un e-mail d'invitation aux initiées 45 jours après
 * leur commande. À brancher sur le système d'envoi e-mail réel (transactionnel).
 * Pour l'instant : sélection théorique + génération du lien + log.
 *
 * Cf. docs/reviews-wall/execution/04-backend-plan-action.md § 9.2
 */

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://femiglow-maroc.com';

interface OrderJ45 {
  id: string;
  customerEmail: string;
  customerFirstName: string | null;
  paidAt: Date;
}

/** Stub : à remplacer par une query sur la table orders en production. */
async function listOrdersForJ45(): Promise<OrderJ45[]> {
  // TODO: implémenter via lib/db/queries/orders.ts une fois la dépendance prête.
  // Aujourd'hui : retourne tableau vide (no-op safe en preview / dev).
  return [];
}

export async function POST(request: Request) {
  const auth = request.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET ?? ''}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!process.env.RITUAL_EMAIL_SECRET) {
    return NextResponse.json(
      { error: { code: 'CONFIG', message: 'RITUAL_EMAIL_SECRET non configuré' } },
      { status: 500 },
    );
  }

  const start = Date.now();
  const orders = await listOrdersForJ45();
  const sent: string[] = [];
  const failed: Array<{ orderId: string; reason: string }> = [];

  for (const order of orders) {
    try {
      const customerHash = hashCustomerEmail(order.customerEmail);
      const token = generateEmailToken({
        orderId: order.id,
        customerHash,
        issuedAt: Date.now(),
        expiresAt: Date.now() + 30 * 86400 * 1000,
      });
      const ctaUrl = `${BASE_URL}/kit?wall=share&order=${order.id}&hash=${token}`;
      const rendered = await renderEmailTemplate('rituals/j45', {
        firstName: order.customerFirstName ?? 'Une initiée',
        ctaUrl,
      });
      // TODO : remplacer par appel au provider e-mail (Resend, Postmark…)
      console.warn('[cron/rituals-j45] email à envoyer', {
        orderId: order.id,
        subject: rendered.subject,
        ctaUrl,
      });
      sent.push(order.id);
    } catch (e) {
      failed.push({ orderId: order.id, reason: String(e) });
    }
  }

  return NextResponse.json({
    ok: true,
    sent: sent.length,
    failed: failed.length,
    durationMs: Date.now() - start,
    detail: { sent, failed },
  });
}
