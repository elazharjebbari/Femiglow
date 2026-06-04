/**
 * Module 09 — Parcours client : R-018, volet email de POST /api/checkout/order.
 *
 * Teste la BRANCHE email du handler (route.ts ~347-386) en isolant la logique
 * commande derrière des mocks. Oracles métier :
 *   - CLI-UNIT-004 : orderTotal = `${(totalCents/100).toFixed(2)} ${currency}`
 *     ⇒ 19900 cents → "199.00 MAD" (chaîne EXACTE).
 *   - CLI-UNIT-005/006 : deliveryEstimate pickup → "retrait en boutique",
 *     sinon → "2-4 jours ouvrés".
 *   - CLI-INT-CONF-PRESENT (au niveau route) : email présent ⇒ sendTransactional
 *     appelé avec template order-confirmation + idempotencyKey order-confirm:.
 *   - CLI-INT-CONF-ABSENT : email absent ⇒ sendTransactional JAMAIS appelé,
 *     MAIS recordOrderPlaced n'est pas requis (pas d'email) — la commande réussit.
 *   - Garantie « le client n'est jamais bloqué par l'email » : sendTransactional
 *     qui REJETTE ⇒ la réponse POST reste le 201 succès.
 *
 * On ne touche pas la logique commande : `withIdempotency` est mocké pour
 * exécuter `execute()` et renvoyer son résultat tel quel (replayed=false).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// — Mocks du volet « logique commande » (hors périmètre) —
const createOrderMock = vi.fn();
const markPurchasedMock = vi.fn();
const getByIdMock = vi.fn();

vi.mock('@/lib/checkout/repos/order-repo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/checkout/repos/order-repo')>();
  return {
    ...actual,
    orderRepo: { createOrder: (...a: unknown[]) => createOrderMock(...a) },
  };
});

vi.mock('@/lib/checkout/repos/lead-repo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/checkout/repos/lead-repo')>();
  return {
    ...actual,
    wizardLeadRepo: {
      getById: (...a: unknown[]) => getByIdMock(...a),
      markPurchased: (...a: unknown[]) => markPurchasedMock(...a),
      patchPayment: vi.fn(),
    },
  };
});

// withIdempotency : exécute le callback et renvoie {status,body,resourceId,replayed:false}.
// On garde les exports réels (IdempotencyConflictError est référencé par
// response.mapError) et on n'override QUE withIdempotency.
vi.mock('@/lib/checkout/api/idempotency-middleware', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/lib/checkout/api/idempotency-middleware')
  >();
  return {
    ...actual,
    withIdempotency: async (opts: { execute: () => Promise<unknown> }) => {
      const r = (await opts.execute()) as {
        status: number;
        body: unknown;
        resourceId: string | null;
      };
      return { ...r, replayed: false };
    },
  };
});

// recordOrderPlaced (bridge user_event) — fire-and-forget, on l'observe.
const recordOrderPlacedMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/user-events/bridges/server-actions', () => ({
  recordOrderPlaced: (...a: unknown[]) => recordOrderPlacedMock(...a),
}));

// Webhook outbound — no-op (hors périmètre email). On expose des mocks nommés
// pour pouvoir RÉ-ARMER leur implémentation dans beforeEach (clearAllMocks +
// restoreAllMocks effacent les impl inline d'un appel à l'autre).
const dispatchOrderWebhookMock = vi.fn().mockResolvedValue(undefined);
const enqueueMock = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/webhooks/outbound/sources/from-order', () => ({
  dispatchOrderWebhook: (...a: unknown[]) => dispatchOrderWebhookMock(...a),
}));
vi.mock('@/lib/leads/outbox/lead-outbox-repo', () => ({
  leadOutboxRepo: { enqueue: (...a: unknown[]) => enqueueMock(...a) },
}));

// Coupons / fidélité (imports dynamiques sur succès) — neutralisés.
vi.mock('@/lib/coupons/context', () => ({
  buildCouponContext: () => ({ visitorKey: null }),
}));
vi.mock('@/lib/db/queries/coupon-repo', () => ({ listCoupons: vi.fn().mockResolvedValue([]) }));
vi.mock('@/lib/db/queries/coupon-grant-repo', () => ({ issueGrant: vi.fn().mockResolvedValue(null) }));

// LE mock central : sendTransactional. On observe son invocation (ou non).
const sendTransactionalMock = vi.fn().mockResolvedValue({ status: 'queued', outboxId: 'eo_1' });
vi.mock('@/lib/mail/send', () => ({
  sendTransactional: (...a: unknown[]) => sendTransactionalMock(...a),
}));

import { NextRequest } from 'next/server';
import { POST } from '../route';

/** Lead wizard prêt à commander (adresse + paiement finalisés). */
function makeLead(over: Record<string, unknown> = {}) {
  return {
    id: 'cl_test_0001',
    firstName: 'Kaoutar',
    phoneE164: '+212600112233',
    email: 'kaoutar@exemple.test',
    emailConsent: true,
    addressCompletedAt: new Date('2026-06-04T09:00:00Z'),
    paymentSelectedAt: new Date('2026-06-04T09:05:00Z'),
    shippingCity: null,
    ...over,
  };
}

function makeBody(over: Record<string, unknown> = {}) {
  return {
    leadId: 'cl_test_0001',
    formContext: { formId: 'wizard-main', formMode: 'wizard_embed' },
    items: [
      { sku: 'FG-KIT-1', name: 'Kit FemiGlow', quantity: 1, unitPriceCents: 19900 },
    ],
    expectedTotalCents: 19900,
    currency: 'MAD',
    paymentMethod: 'cod',
    shippingMode: 'standard',
    ...over,
  };
}

function makeReq(body: unknown): NextRequest {
  // NextRequest pour que `req.cookies.get(...)` (lecture du contexte coupon)
  // existe — un Request brut n'a pas de `.cookies`.
  return new NextRequest('http://localhost/api/checkout/order', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  // clearAllMocks : on efface l'HISTORIQUE d'appels mais on RÉ-ARME chaque impl
  // ci-dessous (sinon les `void X().catch()` de la route reçoivent un undefined).
  vi.clearAllMocks();
  sendTransactionalMock.mockResolvedValue({ status: 'queued', outboxId: 'eo_1' });
  // createOrder renvoie une commande créée par défaut (totalCents alignés).
  createOrderMock.mockResolvedValue({ id: 'o_test_0001', totalCents: 19900, currency: 'MAD' });
  markPurchasedMock.mockResolvedValue(undefined);
  recordOrderPlacedMock.mockResolvedValue(undefined);
  dispatchOrderWebhookMock.mockResolvedValue(undefined);
  enqueueMock.mockResolvedValue(undefined);
});

/** Laisse les `void ...` (fire-and-forget) se résoudre avant les assertions. */
async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('POST /api/checkout/order — volet confirmation email (R-018)', () => {
  // CLI-INT-CONF-PRESENT + CLI-UNIT-004 — email présent ⇒ sendTransactional
  // appelé avec order-confirmation, idempotencyKey order-confirm:<orderId>, et
  // orderTotal formaté EXACTEMENT "199.00 MAD".
  it('email présent ⇒ order-confirmation enfilée avec orderTotal "199.00 MAD" et clé idempotente', async () => {
    getByIdMock.mockResolvedValue(makeLead({ email: 'cliente@exemple.test' }));

    const res = await POST(makeReq(makeBody()));
    expect(res.status).toBe(201);
    await flushMicrotasks();

    expect(sendTransactionalMock).toHaveBeenCalledTimes(1);
    const arg = sendTransactionalMock.mock.calls[0]![0] as {
      template: string;
      to: { email: string };
      payload: Record<string, unknown>;
      idempotencyKey: string;
    };
    expect(arg.template).toBe('order-confirmation');
    expect(arg.to.email).toBe('cliente@exemple.test');
    expect(arg.idempotencyKey).toBe('order-confirm:o_test_0001');
    // Oracle exact (CLI-UNIT-004) : 19900 cents → "199.00 MAD".
    expect(arg.payload.orderTotal).toBe('199.00 MAD');
    expect(arg.payload.orderId).toBe('o_test_0001');
    expect(arg.payload.firstName).toBe('Kaoutar');
  });

  // CLI-UNIT-006 — deliveryEstimate par défaut (standard) → "2-4 jours ouvrés".
  it('shippingMode standard ⇒ deliveryEstimate "2-4 jours ouvrés"', async () => {
    getByIdMock.mockResolvedValue(makeLead());
    await POST(makeReq(makeBody({ shippingMode: 'standard' })));
    await flushMicrotasks();
    const arg = sendTransactionalMock.mock.calls[0]![0] as { payload: Record<string, unknown> };
    expect(arg.payload.deliveryEstimate).toBe('2-4 jours ouvrés');
  });

  // CLI-UNIT-005 — deliveryEstimate pickup → "retrait en boutique".
  it('shippingMode pickup ⇒ deliveryEstimate "retrait en boutique"', async () => {
    getByIdMock.mockResolvedValue(makeLead());
    await POST(makeReq(makeBody({ shippingMode: 'pickup' })));
    await flushMicrotasks();
    const arg = sendTransactionalMock.mock.calls[0]![0] as { payload: Record<string, unknown> };
    expect(arg.payload.deliveryEstimate).toBe('retrait en boutique');
  });

  // CLI-UNIT-004 (variante) — itemsCount = somme des quantités du panier.
  it('itemsCount reflète la somme des quantités du panier', async () => {
    getByIdMock.mockResolvedValue(makeLead());
    createOrderMock.mockResolvedValue({ id: 'o_multi', totalCents: 59700, currency: 'MAD' });
    const body = makeBody({
      items: [
        { sku: 'A', name: 'A', quantity: 2, unitPriceCents: 19900 },
        { sku: 'B', name: 'B', quantity: 1, unitPriceCents: 19900 },
      ],
      expectedTotalCents: 59700,
    });
    await POST(makeReq(body));
    await flushMicrotasks();
    const arg = sendTransactionalMock.mock.calls[0]![0] as { payload: Record<string, unknown> };
    expect(arg.payload.itemsCount).toBe(3);
    expect(arg.payload.orderTotal).toBe('597.00 MAD');
  });

  // CLI-INT-CONF-ABSENT — email absent au checkout ⇒ AUCUN sendTransactional,
  // AUCUN recordOrderPlaced (gardés par `if (leadEmail)`), mais la commande
  // réussit quand même (201). On documente l'absence d'envoi (le gap prod).
  it('email absent ⇒ aucun envoi de confirmation, mais la commande réussit (201)', async () => {
    getByIdMock.mockResolvedValue(makeLead({ email: null, emailConsent: false }));

    const res = await POST(makeReq(makeBody()));
    expect(res.status).toBe(201);
    await flushMicrotasks();

    // Oracle — le volet email est intégralement court-circuité sans email.
    expect(sendTransactionalMock).not.toHaveBeenCalled();
    expect(recordOrderPlacedMock).not.toHaveBeenCalled();
  });

  // GARANTIE FORTE — le client n'est JAMAIS bloqué par l'email : même si
  // sendTransactional REJETTE (enqueue raté), la réponse POST reste le 201
  // succès avec l'orderId. (Le `.catch()` fire-and-forget absorbe l'erreur.)
  it('sendTransactional qui rejette ⇒ la commande réussit quand même (201, orderId présent)', async () => {
    getByIdMock.mockResolvedValue(makeLead());
    sendTransactionalMock.mockRejectedValue(new Error('outbox DB down'));

    const res = await POST(makeReq(makeBody()));
    // Oracle 1 — la réponse n'est PAS un 500 : la commande est bel et bien créée.
    expect(res.status).toBe(201);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json.orderId).toBe('o_test_0001');
    expect(json.status).toBe('pending_confirmation'); // cod
    await flushMicrotasks();

    // Oracle 2 — l'envoi a bien été TENTÉ (la cliente n'est pas privée d'email
    // par design ; c'est l'échec de l'enqueue qui est absorbé sans bloquer).
    expect(sendTransactionalMock).toHaveBeenCalledTimes(1);
  });

  // Non-régression — recordOrderPlaced (bridge user_event pour audience /
  // relance opt-in) est émis quand l'email est présent : c'est l'événement
  // attendu pour les automations en aval.
  it('email présent ⇒ recordOrderPlaced émis (event attendu pour l\'aval)', async () => {
    getByIdMock.mockResolvedValue(makeLead({ email: 'cliente@exemple.test' }));
    await POST(makeReq(makeBody()));
    await flushMicrotasks();
    expect(recordOrderPlacedMock).toHaveBeenCalledTimes(1);
    const arg = recordOrderPlacedMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg.email).toBe('cliente@exemple.test');
    expect(arg.orderId).toBe('o_test_0001');
  });
});
