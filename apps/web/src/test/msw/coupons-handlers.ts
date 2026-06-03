/**
 * Handlers MSW pour le système coupon + crédit fidélité.
 *
 * Couche de contrat partagée par les tests COMPOSANT (CouponsManager,
 * InvitationCodeField, …) — voir docs/coupon-loyalty-qa-ui-2026-06-03.
 *
 * Cycle de vie géré PAR FICHIER (jamais global) :
 *   beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 *
 * Les fabriques sont STATEFUL : un POST create suivi du refresh GET reflète
 * bien le nouvel item (comme le vrai backend). Injection d'échec via `fail`.
 */
import { http, HttpResponse } from 'msw';

export interface MswCoupon {
  id: string;
  label: string;
  code: string | null;
  type: string;
  mode: string;
  status: string;
  valueKind: string;
  valueAmount: number;
  holdoutPct: number;
  usageCount: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

export interface MswGrant {
  id: string;
  code: string;
  /** Déjà masqué (le vrai backend masque en sérialisation). */
  phone: string;
  valueCents: number;
  status: string;
  activatesAt: string | null;
  expiresAt: string | null;
}

export interface MswCouponStats {
  exposed: { treatment: number; holdout: number };
  converted: { treatment: number; holdout: number };
  conversionRate: { treatment: number | null; holdout: number | null };
  upliftAbsolute: number | null;
  upliftRelative: number | null;
  noControl: boolean;
  lowSample: boolean;
}

/** Codes HTTP d'échec injectables par endpoint. `'network'` ⇒ HttpResponse.error(). */
export interface CouponFailMap {
  list?: number | 'network';
  create?: number | 'network';
  transition?: number | 'network';
  stats?: number | 'network';
  grants?: number | 'network';
}

export interface CouponsAdminHandlersOptions {
  coupons?: MswCoupon[];
  grants?: MswGrant[];
  stats?: Record<string, MswCouponStats>;
  /** Id attribué au coupon créé (défaut cpn_new). */
  newCouponId?: string;
  fail?: CouponFailMap;
  /** Latence simulée en ms (0 = aucune). */
  latencyMs?: number;
}

const DEFAULT_STATS: MswCouponStats = {
  exposed: { treatment: 1000, holdout: 100 },
  converted: { treatment: 150, holdout: 10 },
  conversionRate: { treatment: 0.15, holdout: 0.1 },
  upliftAbsolute: 0.05,
  upliftRelative: 0.5,
  noControl: false,
  lowSample: false,
};

function makeCoupon(id: string, label: string, valueAmount: number): MswCoupon {
  return {
    id,
    label,
    code: null,
    type: 'welcome_auto',
    mode: 'auto',
    status: 'draft',
    valueKind: 'fixed_amount',
    valueAmount,
    holdoutPct: 0,
    usageCount: 0,
    startsAt: null,
    endsAt: null,
    createdAt: '2026-06-03T10:00:00.000Z',
  };
}

async function maybeDelay(ms: number | undefined): Promise<void> {
  if (ms && ms > 0) await new Promise((r) => setTimeout(r, ms));
}

function failResponse(code: number | 'network'): Response {
  if (code === 'network') return HttpResponse.error();
  return HttpResponse.json({ error: { code: 'forced_failure' } }, { status: code });
}

/**
 * Fabrique stateful des handlers admin coupons. L'état (coupons/grants) vit
 * dans la closure : create/transition le mutent, le refresh GET le relit.
 */
export function couponsAdminHandlers(opts: CouponsAdminHandlersOptions = {}) {
  const state = {
    coupons: [...(opts.coupons ?? [])],
    grants: [...(opts.grants ?? [])],
    stats: { ...(opts.stats ?? {}) },
  };
  const fail = opts.fail ?? {};
  const newId = opts.newCouponId ?? 'cpn_new';

  return [
    http.get('/api/admin/coupons', async () => {
      await maybeDelay(opts.latencyMs);
      if (fail.list) return failResponse(fail.list);
      return HttpResponse.json({ items: state.coupons, total: state.coupons.length });
    }),

    http.post('/api/admin/coupons', async ({ request }) => {
      await maybeDelay(opts.latencyMs);
      if (fail.create) return failResponse(fail.create);
      const body = (await request.json()) as { label?: string; valueAmount?: number };
      const created = makeCoupon(newId, body.label ?? 'Sans titre', body.valueAmount ?? 9000);
      state.coupons.push(created);
      return HttpResponse.json({ coupon: created }, { status: 201 });
    }),

    http.post('/api/admin/coupons/:id/status', async ({ request, params }) => {
      await maybeDelay(opts.latencyMs);
      if (fail.transition) return failResponse(fail.transition);
      const body = (await request.json()) as { status?: string };
      const c = state.coupons.find((x) => x.id === params.id);
      if (!c) return HttpResponse.json({ error: { code: 'not_found' } }, { status: 404 });
      if (c.status === 'archived' && body.status !== 'archived') {
        return HttpResponse.json({ error: { code: 'conflict' } }, { status: 409 });
      }
      c.status = body.status ?? c.status;
      return HttpResponse.json({ coupon: c });
    }),

    http.get('/api/admin/coupons/:id/stats', async ({ params }) => {
      await maybeDelay(opts.latencyMs);
      if (fail.stats) return failResponse(fail.stats);
      const id = String(params.id);
      const stats = state.stats[id] ?? DEFAULT_STATS;
      return HttpResponse.json({ couponId: id, stats });
    }),

    http.get('/api/admin/coupons/grants', async ({ request }) => {
      await maybeDelay(opts.latencyMs);
      if (fail.grants) return failResponse(fail.grants);
      const url = new URL(request.url);
      const phone = url.searchParams.get('phone');
      const status = url.searchParams.get('status');
      let items = state.grants;
      if (phone) items = items.filter((g) => g.phone.includes(phone));
      if (status) items = items.filter((g) => g.status === status);
      return HttpResponse.json({ items, total: items.length });
    }),
  ];
}

export interface RedeemHandlerOptions {
  /** code (uppercased) → réponse renvoyée par /api/coupons/redeem. */
  byCode?: Record<string, { valid: boolean; valueCents?: number; reason?: string }>;
  fail?: number | 'network';
  latencyMs?: number;
}

/** Handler pour POST /api/coupons/redeem (InvitationCodeField). */
export function redeemHandlers(opts: RedeemHandlerOptions = {}) {
  const byCode = opts.byCode ?? {};
  return [
    http.post('/api/coupons/redeem', async ({ request }) => {
      await maybeDelay(opts.latencyMs);
      if (opts.fail) return failResponse(opts.fail);
      const body = (await request.json().catch(() => ({}))) as { code?: string };
      const key = (body.code ?? '').trim().toUpperCase();
      const hit = byCode[key];
      if (hit) return HttpResponse.json(hit);
      return HttpResponse.json({ valid: false, reason: 'not_found' });
    }),
  ];
}

/** Grant masqué prêt à l'emploi pour les fixtures de test. */
export function maskedGrant(over: Partial<MswGrant> = {}): MswGrant {
  return {
    id: 'grt_1',
    code: 'FG-SAUGE-7212',
    phone: '0612…78',
    valueCents: 2000,
    status: 'issued',
    activatesAt: '2026-06-10T00:00:00.000Z',
    expiresAt: '2026-08-09T00:00:00.000Z',
    ...over,
  };
}

export function draftCoupon(over: Partial<MswCoupon> = {}): MswCoupon {
  return { ...makeCoupon('cpn_1', 'Geste d’accueil', 9000), ...over };
}
