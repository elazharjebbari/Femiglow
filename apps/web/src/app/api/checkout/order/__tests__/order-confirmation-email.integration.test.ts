// @vitest-environment node
/**
 * Module 09 — Parcours client : R-018 confirmation de commande (VRAIE DB).
 *
 * Le volet email de `POST /api/checkout/order` (lignes ~347-386) émet, APRÈS
 * succès de la commande et SEULEMENT si `leadSnapshot.email` est présent :
 *
 *   void sendTransactional({
 *     template: 'order-confirmation',
 *     idempotencyKey: `order-confirm:${orderId}`,
 *     ...
 *   })
 *
 * Driver tout le handler POST exigerait product_variants/stock/chat_lead — hors
 * de notre périmètre (logique commande). On teste donc le COMPORTEMENT du volet
 * email à sa frontière réelle : `sendTransactional` avec EXACTEMENT la forme
 * d'appel de la route, contre la vraie DB outbox (femiglow_test_m09parcours).
 *
 *   - CLI-INT-CONF-PRESENT : email présent ⇒ 1 ligne outbox `order-confirmation`
 *     enfilée (queued), idempotencyKey `order-confirm:<orderId>`.
 *   - CLI-INT-CONF-IDEM    : re-checkout même orderId ⇒ duplicate, 1 seule ligne.
 *   - CLI-INT-SUPPRESS-BLOCKS : adresse suppressée ⇒ `suppressed`, 0 ligne.
 *
 * Le cas « email absent » (CLI-INT-CONF-ABSENT) et « la commande réussit même si
 * l'enqueue échoue » sont des propriétés de la BRANCHE de la route ; ils sont
 * couverts par la suite unitaire `order-confirmation-volet.unit.test.ts` (le
 * volet est `void ...catch()` ⇒ jamais bloquant), car ils ne dépendent pas de
 * la DB. Ici on prouve les effets persistés du chemin nominal.
 *
 * Lancement :
 *   DBURL=$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/femiglow_emailqa#/femiglow_test_m09parcours#')
 *   DATABASE_URL="$DBURL" DATABASE_URL_TEST="$DBURL" \
 *     pnpm vitest run --no-file-parallelism \
 *       src/app/api/checkout/order/__tests__/order-confirmation-email.integration.test.ts
 */
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { eq } from 'drizzle-orm';

// SMTP inerte (le delivery fire-and-forget de sendTransactional le sollicite).
const sendMailCalls: unknown[] = [];
vi.mock('@/lib/mail/client', () => ({
  SmtpNotConfiguredError: class extends Error {
    readonly code = 'SMTP_NOT_CONFIGURED';
  },
  getTransporter: () => ({
    sendMail: async (opts: unknown) => {
      sendMailCalls.push(opts);
      return { messageId: '<msg@test>', response: '250 OK' };
    },
  }),
}));

import { emailOutbox, emailEvent, emailSuppression } from '@/lib/db/schema-emails';
import { __setTestDb, __resetTestDb } from '@/lib/db/client';
import {
  closeTestDb,
  emailsTestDb,
  truncateEmailTables,
  describeEmailsDb,
} from '@/test/db/emails-db';
import { makeSuppression } from '@/test/factories/emails.factory';
import { sendTransactional } from '@/lib/mail/send';

const db = () => emailsTestDb();

/**
 * Draine le fire-and-forget `attemptSend` (envoi immédiat) déclenché par
 * `sendTransactional` sur une ligne `queued`. On attend la ligne `email_event`
 * (type=sent) écrite EN DERNIER par `attemptSend` (après l'UPDATE outbox→sent) :
 * c'est la SEULE garantie que la transaction de fond a entièrement COMMITÉ.
 *
 * Indispensable contre le deadlock TRUNCATE (R-023) : sans ce drain, la tx de
 * fond tient encore des verrous sur email_outbox/email_event quand le
 * `beforeEach` du test suivant lance `TRUNCATE ... CASCADE` → 40P01.
 */
async function drainImmediateSend(outboxId: string): Promise<void> {
  await vi.waitFor(async () => {
    const ev = await db()
      .select({ id: emailEvent.id })
      .from(emailEvent)
      .where(eq(emailEvent.outboxId, outboxId));
    expect(ev.length).toBeGreaterThanOrEqual(1);
  });
}

/**
 * Reproduit EXACTEMENT la construction de l'appel de la route checkout pour la
 * confirmation de commande (route.ts ~360-386). `orderTotal` est formaté côté
 * route en `${(totalCents/100).toFixed(2)} ${currency}` ; on reproduit ce
 * formatage pour fidélité (ex. 19900 cents → "199.00 MAD").
 */
function confirmInput(opts: {
  email: string;
  orderId: string;
  totalCents: number;
  currency?: string;
  firstName?: string;
  itemsCount?: number;
  shippingMode?: 'pickup' | 'standard';
}) {
  const currency = opts.currency ?? 'MAD';
  return {
    template: 'order-confirmation' as const,
    to: { email: opts.email, name: opts.firstName ?? 'Kaoutar' },
    payload: {
      firstName: opts.firstName ?? 'Kaoutar',
      orderId: opts.orderId,
      orderTotal: `${(opts.totalCents / 100).toFixed(2)} ${currency}`,
      itemsCount: opts.itemsCount ?? 1,
      deliveryEstimate:
        opts.shippingMode === 'pickup' ? 'retrait en boutique' : '2-4 jours ouvrés',
    },
    idempotencyKey: `order-confirm:${opts.orderId}`,
    source: 'api.checkout.order',
  };
}

beforeAll(() => {
  __setTestDb(emailsTestDb() as never);
});

beforeEach(async () => {
  await truncateEmailTables();
  sendMailCalls.length = 0;
});

afterAll(async () => {
  __resetTestDb();
  await closeTestDb();
});

describeEmailsDb('R-018 order-confirmation — volet email checkout (vraie DB)', () => {
  // CLI-INT-CONF-PRESENT — email présent au checkout ⇒ exactement 1 ligne
  // outbox `order-confirmation` enfilée, avec la clé idempotente order-confirm:.
  it('email présent ⇒ 1 outbox order-confirmation queued (clé order-confirm:<orderId>)', async () => {
    const orderId = 'FG-20260604-100';
    const result = await sendTransactional(
      confirmInput({ email: 'cliente-conf@exemple.test', orderId, totalCents: 19900 }),
    );

    // Oracle 1 — l'envoi est accepté/enfilé (pas suppressed, pas duplicate).
    expect(result.status).toBe('queued');

    // Oracle 2 — une ligne outbox `order-confirmation` existe, clé exacte.
    const rows = await db()
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.idempotencyKey, `order-confirm:${orderId}`));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.template).toBe('order-confirmation');
    expect(rows[0]!.toEmail).toBe('cliente-conf@exemple.test');
    // Oracle 3 — le payload persisté porte le total formaté MAD attendu.
    expect((rows[0]!.payloadJson as Record<string, unknown>).orderTotal).toBe('199.00 MAD');

    // Drain déterministe du fire-and-forget avant le truncate suivant.
    await drainImmediateSend(rows[0]!.id);
  });

  // CLI-INT-CONF-IDEM — re-checkout du MÊME orderId (replay réseau, double POST)
  // ⇒ le 2e appel est `duplicate` et il n'y a TOUJOURS qu'une seule ligne outbox
  // (idempotencyKey `order-confirm:<orderId>` unique).
  it('re-checkout même orderId ⇒ duplicate, 1 seule ligne outbox', async () => {
    const orderId = 'FG-20260604-101';
    const input = confirmInput({ email: 'idem-conf@exemple.test', orderId, totalCents: 49000 });

    const first = await sendTransactional(input);
    const second = await sendTransactional(input);

    expect(first.status).toBe('queued');
    // Oracle — le replay ne ré-enfile pas : il retombe sur la ligne existante.
    expect(second.status).toBe('duplicate');
    if (first.status === 'queued' && second.status === 'duplicate') {
      expect(second.outboxId).toBe(first.outboxId);
    }

    const rows = await db()
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.idempotencyKey, `order-confirm:${orderId}`));
    expect(rows).toHaveLength(1);

    // Drain déterministe du fire-and-forget avant le truncate suivant.
    await drainImmediateSend(rows[0]!.id);
  });

  // CLI-INT-SUPPRESS-BLOCKS — l'adresse cliente est suppressée (ex. unsub ou
  // hard bounce antérieur) : la confirmation de commande est REFUSÉE (status
  // suppressed) AVANT tout INSERT outbox. Garantie RGPD : 0 ligne, 0 SMTP.
  it('adresse suppressée ⇒ confirmation `suppressed`, 0 outbox, 0 SMTP', async () => {
    const email = 'suppressed-conf@exemple.test';
    await db()
      .insert(emailSuppression)
      .values(makeSuppression({ email, reason: 'hard_bounce', source: 'listmonk' }));

    const orderId = 'FG-20260604-102';
    const result = await sendTransactional(
      confirmInput({ email, orderId, totalCents: 19900 }),
    );

    // Oracle 1 — l'envoi est bloqué par la suppression list (fail-closed).
    expect(result.status).toBe('suppressed');
    expect(result.outboxId).toBeNull();

    // Oracle 2 — AUCUNE ligne outbox n'a été créée pour cette commande.
    const rows = await db()
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.idempotencyKey, `order-confirm:${orderId}`));
    expect(rows).toHaveLength(0);

    // Oracle 3 — aucun envoi SMTP tenté.
    expect(sendMailCalls).toHaveLength(0);
  });

  // CLI-INT-CONF-PRESENT (variante pickup) — non-régression du libellé de
  // livraison « retrait en boutique » persisté dans le payload de l'outbox.
  it('shippingMode pickup ⇒ deliveryEstimate « retrait en boutique » dans le payload', async () => {
    const orderId = 'FG-20260604-103';
    await sendTransactional(
      confirmInput({
        email: 'pickup-conf@exemple.test',
        orderId,
        totalCents: 25000,
        shippingMode: 'pickup',
      }),
    );

    const rows = await db()
      .select()
      .from(emailOutbox)
      .where(eq(emailOutbox.idempotencyKey, `order-confirm:${orderId}`));
    expect(rows).toHaveLength(1);
    expect((rows[0]!.payloadJson as Record<string, unknown>).deliveryEstimate).toBe(
      'retrait en boutique',
    );

    // Drain déterministe du fire-and-forget avant le truncate (afterAll/next test).
    await drainImmediateSend(rows[0]!.id);
  });
});
