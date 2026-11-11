// @vitest-environment node
/**
 * Tunnel de commande /kit sur une VRAIE base Postgres (toutes les migrations),
 * en appelant les vraies routes API. Vérifie les correctifs de l'audit du
 * 10/11/2026 :
 *   1. une erreur (409 stock, 422 prix) n'est plus rejouée par l'idempotence ;
 *   3. une fiche qui a commandé n'est plus réécrite par une nouvelle saisie ;
 *   4. le prix affiché (devis signé) est le prix facturé, même quand le
 *      contexte de la commande donnerait un autre coupon ;
 *   6. limite de débit, et nom produit serveur dans la commande et le webhook.
 *
 * Désactivé par défaut. Lancement :
 *
 *   CHECKOUT_LIVE_DB=1 \
 *   DATABASE_URL=postgres://femiglow:test@127.0.0.1:55432/femiglow_test \
 *   npx vitest run src/app/api/checkout/__tests__/tunnel-bugs-graves.live-db.test.ts
 *
 * La base doit avoir les migrations (`node scripts/_migrate-safe.mjs`) et les
 * seeds produits + coupons + villes. Le test crée ses propres données
 * (téléphones et sessions uniques) et remet le stock à la fin.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const RUN = process.env.CHECKOUT_LIVE_DB === '1' && Boolean(process.env.DATABASE_URL);

// Les en-têtes et cookies de la requête de PAGE, lus par
// `resolveKitDisplayPricing` (contexte coupon de l'affichage).
const pageRequest = { headers: new Headers(), cookies: new Map<string, string>() };
vi.mock('next/headers', () => ({
  headers: () => pageRequest.headers,
  cookies: () => ({
    get: (name: string) =>
      pageRequest.cookies.has(name) ? { name, value: pageRequest.cookies.get(name)! } : undefined,
  }),
}));
// Hors runtime Next : `unstable_cache` / `revalidateTag` deviennent neutres.
vi.mock('next/cache', () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
  revalidateTag: () => undefined,
  revalidatePath: () => undefined,
}));
vi.mock('server-only', () => ({}));
// `cache` n'existe que dans le build serveur de React (RSC) : neutre ici.
vi.mock('react', async (orig) => ({
  ...(await orig<typeof import('react')>()),
  cache: <T,>(fn: T) => fn,
}));
// Le webhook CRM est capturé, jamais envoyé.
const webhookCalls: Array<{ items: Array<{ name: string; sku: string }> }> = [];
vi.mock('@/lib/webhooks/outbound/sources/from-order', () => ({
  dispatchOrderWebhook: vi.fn(async (input: { items: Array<{ name: string; sku: string }> }) => {
    webhookCalls.push(input);
  }),
}));

type Sql = import('postgres').Sql;
let sql: Sql;
let leadRoute: typeof import('../lead/route');
let addressRoute: typeof import('../lead/[leadId]/address/route');
let orderRoute: typeof import('../order/route');
let display: typeof import('@/lib/products/kit-display-pricing.server');
let memory: typeof import('@/lib/db/client');

const SKU = 'FEMI-KIT-100';
let variantId = '';
let initialStock = 0;
let seq = 0;

function uniq() {
  seq += 1;
  return `${Date.now().toString(36)}${seq}`;
}
/** Téléphone mobile unique par scénario (la déduplication 30 min est par numéro). */
function phone(): string {
  return `6${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
}
function ip(): string {
  return `41.${(seq * 7) % 250}.${Math.floor(Math.random() * 250)}.${(seq * 13) % 250}`;
}

function json(method: string, url: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`https://femiglow-maroc.com${url}`, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

const FORM = { formId: 'wizard_kit', formMode: 'wizard_embed', variantKey: 'A', source: 'wizard_kit' };

interface Cart {
  items: Array<{ sku: string; name: string; quantity: number; unitPriceCents: number; priceQuote?: string }>;
  totalCents: number;
  currency: string;
}

async function createLead(opts: { phone: string; sessionId: string; key: string; ip: string; cart: Cart; firstName?: string }) {
  const res = await leadRoute.POST(
    json(
      'POST',
      '/api/checkout/lead',
      {
        formContext: FORM,
        firstName: opts.firstName ?? 'Amal',
        phone: opts.phone,
        consent: true,
        consentVersion: 'v1',
        visitorId: `v_${opts.sessionId}`,
        sessionId: opts.sessionId,
        language: 'fr',
        cartSnapshot: opts.cart,
      },
      { 'Idempotency-Key': opts.key, 'x-forwarded-for': opts.ip },
    ),
  );
  const body = (await res.json()) as { leadId?: string; error?: { code: string } };
  if (res.status === 400) console.error('LEAD400', JSON.stringify(body));
  return { status: res.status, body };
}

async function patchAddress(leadId: string, city: string, line: string, key: string, ipAddr: string) {
  const res = await addressRoute.PATCH(
    json(
      'PATCH',
      `/api/checkout/lead/${leadId}/address`,
      { city, addressLine1: line, country: 'MA' },
      { 'Idempotency-Key': key, 'x-forwarded-for': ipAddr },
    ),
    { params: { leadId } },
  );
  return { status: res.status, body: (await res.json()) as { error?: { code: string } } };
}

async function postOrder(leadId: string, cart: Cart, key: string, ipAddr: string, extraHeaders: Record<string, string> = {}) {
  const res = await orderRoute.POST(
    json(
      'POST',
      '/api/checkout/order',
      {
        leadId,
        formContext: FORM,
        items: cart.items,
        expectedTotalCents: cart.totalCents,
        currency: cart.currency,
        paymentMethod: 'cod',
        shippingMode: 'standard',
      },
      { 'Idempotency-Key': key, 'x-forwarded-for': ipAddr, ...extraHeaders },
    ),
  );
  return {
    status: res.status,
    body: (await res.json()) as { orderId?: string; totalCents?: number; error?: { code: string } },
  };
}

/** Panier tel que la section commande le construit au rendu de la page. */
async function cartFromPage(referer: string | null): Promise<Cart> {
  pageRequest.headers = new Headers({
    'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    ...(referer ? { referer } : {}),
  });
  pageRequest.cookies = new Map();
  // `cache()` de React est neutre hors rendu : chaque appel recalcule.
  const d = await display.resolveKitDisplayPricing();
  const unit = d.product.promoPriceCents ?? d.product.priceCents;
  return {
    items: [
      {
        sku: SKU,
        name: 'Pack FemiGlow',
        quantity: 1,
        unitPriceCents: unit,
        ...(d.priceQuote ? { priceQuote: d.priceQuote } : {}),
      },
    ],
    totalCents: unit,
    currency: 'MAD',
  };
}

async function fullFunnel(cart: Cart, headers: Record<string, string> = {}) {
  const ipAddr = ip();
  const lead = await createLead({ phone: phone(), sessionId: `s_${uniq()}`, key: `idem_${uniq()}`, ip: ipAddr, cart });
  expect(lead.status).toBe(201);
  const addr = await patchAddress(lead.body.leadId!, 'Rabat', '12 rue des Orangers', `idem_${uniq()}`, ipAddr);
  expect(addr.status).toBe(200);
  return { leadId: lead.body.leadId!, ipAddr, order: await postOrder(lead.body.leadId!, cart, `idem_${uniq()}`, ipAddr, headers) };
}

describe.skipIf(!RUN)('tunnel /kit sur base réelle — correctifs de l’audit du 10/11/2026', () => {
  beforeAll(async () => {
    process.env.PRICE_QUOTE_SECRET = 'test-price-quote-secret-0123456789abcdef';
    const postgres = (await import('postgres')).default;
    sql = postgres(process.env.DATABASE_URL!, { max: 2, onnotice: () => undefined });
    // Version d'instruction active : exigée par la création de session wizard.
    await sql`
      INSERT INTO chat_instruction_version (id, version, scope, body, enabled, created_by)
      VALUES ('civ_test_tunnel', 9001, 'default', 'test', true, 'test')
      ON CONFLICT DO NOTHING`;
    const [v] = await sql`SELECT id FROM product_variants WHERE sku = ${SKU}`;
    variantId = v!.id as string;
    const [st] = await sql`SELECT available FROM product_stock WHERE variant_id = ${variantId}`;
    initialStock = st!.available as number;

    leadRoute = await import('../lead/route');
    addressRoute = await import('../lead/[leadId]/address/route');
    orderRoute = await import('../order/route');
    display = await import('@/lib/products/kit-display-pricing.server');
    memory = await import('@/lib/db/client');
  }, 60_000);

  beforeEach(async () => {
    webhookCalls.length = 0;
    memory.resetMemoryStore(); // compteurs de débit
    await sql`UPDATE product_stock SET available = 500, reserved = 0, sell_when_out = true WHERE variant_id = ${variantId}`;
    await sql`DELETE FROM coupons WHERE id LIKE 'cpn_test_%'`;
  });

  afterAll(async () => {
    if (!sql) return;
    await sql`DELETE FROM coupons WHERE id LIKE 'cpn_test_%'`;
    await sql`UPDATE product_stock SET available = ${initialStock}, reserved = 0, sell_when_out = true WHERE variant_id = ${variantId}`;
    await sql.end();
  });

  it('parcours nominal : 201, stock décrémenté, nom produit serveur dans la commande et le webhook', async () => {
    const cart = await cartFromPage('https://m.facebook.com/');
    cart.items[0]!.name = '<script>alert(1)</script> GRATUIT';
    const { order } = await fullFunnel(cart);
    expect(order.status).toBe(201);
    expect(order.body.totalCents).toBe(19900 + 3500); // 199 MAD + livraison Rabat 35 MAD
    const [st] = await sql`SELECT available FROM product_stock WHERE variant_id = ${variantId}`;
    expect(st!.available).toBe(499);
    const items = await sql`SELECT name, unit_price_cents FROM order_items WHERE order_id = ${order.body.orderId!}`;
    expect(items[0]).toMatchObject({ name: 'Pack FemiGlow', unit_price_cents: 19900 });
    expect(webhookCalls[0]?.items[0]?.name).toBe('Pack FemiGlow');
  });

  describe('Bug 1 — les erreurs ne sont plus rejouées', () => {
    it('409 stock, remise en stock, même clé : la commande passe', async () => {
      const cart = await cartFromPage(null);
      const ipAddr = ip();
      const lead = await createLead({ phone: phone(), sessionId: `s_${uniq()}`, key: `idem_${uniq()}`, ip: ipAddr, cart });
      await patchAddress(lead.body.leadId!, 'Rabat', '1 rue A', `idem_${uniq()}`, ipAddr);
      const key = `idem_${uniq()}`;

      await sql`UPDATE product_stock SET available = 0, sell_when_out = false WHERE variant_id = ${variantId}`;
      const first = await postOrder(lead.body.leadId!, cart, key, ipAddr);
      expect(first.status).toBe(409);
      expect(first.body.error?.code).toBe('stock_insufficient');
      const stored = await sql`SELECT 1 FROM checkout_idempotency WHERE key = ${key}`;
      expect(stored.length).toBe(0);

      await sql`UPDATE product_stock SET available = 500, sell_when_out = true WHERE variant_id = ${variantId}`;
      const second = await postOrder(lead.body.leadId!, cart, key, ipAddr);
      expect(second.status).toBe(201);
      expect(second.body.orderId).toMatch(/^o_/);
    });

    it('une erreur mémorisée AVANT le correctif (ligne 409 en base) est ignorée', async () => {
      const cart = await cartFromPage(null);
      const ipAddr = ip();
      const lead = await createLead({ phone: phone(), sessionId: `s_${uniq()}`, key: `idem_${uniq()}`, ip: ipAddr, cart });
      await patchAddress(lead.body.leadId!, 'Rabat', '1 rue A', `idem_${uniq()}`, ipAddr);
      const key = `idem_${uniq()}`;
      await sql`
        INSERT INTO checkout_idempotency (key, scope, request_hash, response_json, response_status)
        VALUES (${key}, 'order_create', 'ancien-hash', ${sql.json({ error: { code: 'stock_insufficient' } })}, 409)`;
      const res = await postOrder(lead.body.leadId!, cart, key, ipAddr);
      expect(res.status).toBe(201);
      // Le succès remplace la ligne d'erreur, et sera rejoué.
      const [row] = await sql`SELECT response_status FROM checkout_idempotency WHERE key = ${key} AND scope = 'order_create'`;
      expect(row!.response_status).toBe(201);
    });

    it('un succès reste rejoué (double tap) : même commande, pas de seconde ligne', async () => {
      const cart = await cartFromPage(null);
      const ipAddr = ip();
      const lead = await createLead({ phone: phone(), sessionId: `s_${uniq()}`, key: `idem_${uniq()}`, ip: ipAddr, cart });
      await patchAddress(lead.body.leadId!, 'Rabat', '1 rue A', `idem_${uniq()}`, ipAddr);
      const key = `idem_${uniq()}`;
      const a = await postOrder(lead.body.leadId!, cart, key, ipAddr);
      const b = await postOrder(lead.body.leadId!, cart, key, ipAddr);
      expect(a.status).toBe(201);
      expect(b.body.orderId).toBe(a.body.orderId);
      const n = await sql`SELECT count(*)::int AS n FROM orders WHERE chat_lead_id = ${lead.body.leadId!}`;
      expect(n[0]!.n).toBe(1);
    });
  });

  describe('Bug 3 — une commande passée ne peut plus être réécrite', () => {
    it('nouvelle saisie après achat : nouvelle fiche, ancienne adresse intacte', async () => {
      const cart = await cartFromPage(null);
      const ipAddr = ip();
      const sessionId = `s_${uniq()}`;
      const tel = phone();
      const lead1 = await createLead({ phone: tel, sessionId, key: `idem_${uniq()}`, ip: ipAddr, cart });
      await patchAddress(lead1.body.leadId!, 'Rabat', 'Adresse de la 1re commande', `idem_${uniq()}`, ipAddr);
      const o1 = await postOrder(lead1.body.leadId!, cart, `idem_${uniq()}`, ipAddr);
      expect(o1.status).toBe(201);

      // Même session, même prénom et téléphone, clé neuve (purgée après achat).
      const lead2 = await createLead({ phone: tel, sessionId, key: `idem_${uniq()}`, ip: ipAddr, cart });
      expect(lead2.status).toBe(201);
      expect(lead2.body.leadId).not.toBe(lead1.body.leadId);

      const addr2 = await patchAddress(lead2.body.leadId!, 'Casablanca', 'Nouvelle adresse', `idem_${uniq()}`, ipAddr);
      expect(addr2.status).toBe(200);
      const [old] = await sql`SELECT shipping_city, shipping_address_line1 FROM chat_lead WHERE id = ${lead1.body.leadId!}`;
      expect(old).toMatchObject({ shipping_city: 'Rabat', shipping_address_line1: 'Adresse de la 1re commande' });
    });

    it('PATCH adresse sur une fiche déjà convertie : 200 sans rien écrire (réponse de commande perdue)', async () => {
      const cart = await cartFromPage(null);
      const { leadId, ipAddr, order } = await fullFunnel(cart);
      expect(order.status).toBe(201);
      const res = await patchAddress(leadId, 'Tanger', 'Écrasement', `idem_${uniq()}`, ipAddr);
      expect(res.status).toBe(200);
      const [row] = await sql`SELECT shipping_city, shipping_address_line1 FROM chat_lead WHERE id = ${leadId}`;
      expect(row).toMatchObject({ shipping_city: 'Rabat', shipping_address_line1: '12 rue des Orangers' });
      // Puis la cliente renvoie la commande (même panier) : la commande
      // existante lui est rendue, aucune seconde commande.
      const again = await postOrder(leadId, cart, `idem_${uniq()}`, ipAddr);
      expect(again.status).toBe(200);
      expect(again.body.orderId).toBe(order.body.orderId);
      const n = await sql`SELECT count(*)::int AS n FROM orders WHERE chat_lead_id = ${leadId}`;
      expect(n[0]!.n).toBe(1);
    });

    it('chemin optimiste (upsert par id) : une fiche convertie reste figée', async () => {
      const cart = await cartFromPage(null);
      const { leadId, order } = await fullFunnel(cart);
      expect(order.status).toBe(201);
      const { wizardLeadRepo } = await import('@/lib/checkout/repos/lead-repo');
      const [before] = await sql`SELECT first_name, phone_e164, session_id, visitor_id FROM chat_lead WHERE id = ${leadId}`;
      const row = await wizardLeadRepo.upsertWizardLead(leadId, {
        sessionId: before!.session_id as string,
        visitorId: before!.visitor_id as string,
        firstName: 'Autre',
        phone: '699999999',
        consentVersion: 'v1',
        language: 'fr',
        source: 'wizard_kit',
        formId: 'wizard_kit',
        formMode: 'wizard_embed',
      } as Parameters<typeof wizardLeadRepo.upsertWizardLead>[1]);
      expect(row.id).toBe(leadId);
      const [after] = await sql`SELECT first_name, phone_e164 FROM chat_lead WHERE id = ${leadId}`;
      expect(after).toMatchObject({ first_name: before!.first_name, phone_e164: before!.phone_e164 });
    });

    it('seconde commande (autre panier) sur la même fiche : 409, pas de seconde commande', async () => {
      const cart = await cartFromPage(null);
      const { leadId, ipAddr, order } = await fullFunnel(cart);
      expect(order.status).toBe(201);
      const two: Cart = {
        ...cart,
        items: [{ ...cart.items[0]!, quantity: 2 }],
        totalCents: cart.totalCents * 2,
      };
      const res = await postOrder(leadId, two, `idem_${uniq()}`, ipAddr);
      expect(res.status).toBe(409);
      expect(res.body.error?.code).toBe('lead_already_purchased');
      const n = await sql`SELECT count(*)::int AS n FROM orders WHERE chat_lead_id = ${leadId}`;
      expect(n[0]!.n).toBe(1);
    });
  });

  describe('Bug 4 — prix affiché = prix facturé', () => {
    beforeEach(async () => {
      // Coupon réservé au trafic Facebook : vrai à l'affichage (referer
      // facebook.com), faux à la commande (referer = la page /kit).
      await sql`
        INSERT INTO coupons (id, label, type, mode, status, value_kind, value_amount, target, currency, eligibility, priority)
        VALUES ('cpn_test_fb', 'Test FB', 'welcome_auto', 'auto', 'active', 'fixed_amount', 12000, 'product_price', 'MAD',
                ${sql.json({ trafficSources: ['m.facebook.com'] })}, 100)`;
    });

    it('le devis du rendu est honoré : 169 MAD facturés, commande créée', async () => {
      const cart = await cartFromPage('https://m.facebook.com/');
      expect(cart.totalCents).toBe(16900);
      expect(cart.items[0]!.priceQuote).toBeTruthy();
      const { order } = await fullFunnel(cart, { referer: 'https://femiglow-maroc.com/kit' });
      expect(order.status).toBe(201);
      expect(order.body.totalCents).toBe(16900 + 3500);
    });

    it('sans devis (ancien onglet) : le serveur reprice, et refuse en 422 comme avant (preuve du bug)', async () => {
      const cart = await cartFromPage('https://m.facebook.com/');
      delete cart.items[0]!.priceQuote;
      const { order } = await fullFunnel(cart, { referer: 'https://femiglow-maroc.com/kit' });
      expect(order.status).toBe(422);
      expect(order.body.error?.code).toBe('price_mismatch');
    });

    it('devis falsifié (prix baissé à la main) : ignoré, prix serveur, 422', async () => {
      const cart = await cartFromPage('https://m.facebook.com/');
      const [payload, sig] = cart.items[0]!.priceQuote!.split('.');
      const forged = JSON.parse(Buffer.from(payload!, 'base64url').toString());
      forged.unit = 100;
      cart.items[0]!.priceQuote = `${Buffer.from(JSON.stringify(forged)).toString('base64url')}.${sig}`;
      cart.items[0]!.unitPriceCents = 100;
      cart.totalCents = 100;
      const { order } = await fullFunnel(cart, { referer: 'https://femiglow-maroc.com/kit' });
      expect(order.status).toBe(422);
    });

    it('prix catalogue changé depuis le devis : devis ignoré, reprice (422)', async () => {
      const cart = await cartFromPage('https://m.facebook.com/');
      await sql`UPDATE product_variants SET price_cents = 29900 WHERE sku = ${SKU}`;
      try {
        const { order } = await fullFunnel(cart, { referer: 'https://femiglow-maroc.com/kit' });
        expect(order.status).toBe(422);
      } finally {
        await sql`UPDATE product_variants SET price_cents = 28900 WHERE sku = ${SKU}`;
      }
    });

    it('coupon du devis mis en pause depuis : devis ignoré, reprice (422)', async () => {
      const cart = await cartFromPage('https://m.facebook.com/');
      await sql`UPDATE coupons SET status = 'paused' WHERE id = 'cpn_test_fb'`;
      const { order } = await fullFunnel(cart, { referer: 'https://femiglow-maroc.com/kit' });
      expect(order.status).toBe(422);
    });

    it('le coupon et l’économie du devis sont journalisés sur la commande', async () => {
      const cart = await cartFromPage('https://m.facebook.com/');
      const { order } = await fullFunnel(cart, { referer: 'https://femiglow-maroc.com/kit' });
      const ev = await sql`SELECT coupon_id, amount_cents FROM coupon_events WHERE order_id = ${order.body.orderId!} AND phase = 'converted'`;
      expect(ev[0]).toMatchObject({ coupon_id: 'cpn_test_fb', amount_cents: 12000 });
    });
  });

  it('bornes de livraison : min des villes payantes, max jamais sous le tarif par défaut (45)', async () => {
    const { getDeliveryPriceBounds } = await import('@/lib/db/queries/delivery-cities');
    const [row] = await sql`
      SELECT min(nullif(delivery_price_mad, 0))::int AS min, max(delivery_price_mad)::int AS max
      FROM delivery_cities WHERE is_active AND country_code = 'MA'`;
    const bounds = await getDeliveryPriceBounds();
    expect(bounds).toEqual({ minMad: row!.min, maxMad: Math.max(row!.max as number, 45) });
  });

  describe('Bug 6 — limite de débit', () => {
    it('création de fiche : la 31e en 10 min depuis la même IP reçoit 429', async () => {
      const ipAddr = '41.99.99.99';
      const cart = await cartFromPage(null);
      const statuses: number[] = [];
      for (let i = 0; i < 31; i += 1) {
        const r = await createLead({ phone: phone(), sessionId: `s_${uniq()}`, key: `idem_${uniq()}`, ip: ipAddr, cart });
        statuses.push(r.status);
      }
      expect(statuses.slice(0, 30).every((s) => s === 201)).toBe(true);
      expect(statuses[30]).toBe(429);
      // Une autre IP passe toujours.
      const other = await createLead({ phone: phone(), sessionId: `s_${uniq()}`, key: `idem_${uniq()}`, ip: '41.98.98.98', cart });
      expect(other.status).toBe(201);
    }, 60_000);
  });
});
