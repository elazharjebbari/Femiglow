/**
 * F14 — Contract POST /api/coupons/redeem (validation sans consommation).
 *
 * Couverture EXHAUSTIVE des motifs renvoyés à la cliente lorsqu'elle saisit un
 * code de fidélité : valid / not_found / not_yet_active / expired /
 * already_redeemed (HTTP 200) + invalid_input (HTTP 422) + error (catch, 200).
 * Publique, sans auth. Repo en memoryStore, horloge injectée.
 * cf. docs/coupon-loyalty-qa-ui-2026-06-03/14-api-redeem.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { resetMemoryStore } from '@/lib/db/client';
import * as grantRepo from '@/lib/db/queries/coupon-grant-repo';
import { POST } from './route';

const DAY = 24 * 3600 * 1000;

beforeEach(() => {
  resetMemoryStore();
});
afterEach(() => {
  vi.restoreAllMocks();
});

function postReq(body: unknown, raw = false): NextRequest {
  return new Request('http://localhost/api/coupons/redeem', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: raw ? (body as string) : JSON.stringify(body),
  }) as unknown as NextRequest;
}

/** Émet un grant de test ; activatesAt par défaut hier (donc actif). */
async function seedGrant(over: Partial<grantRepo.IssueGrantInput> = {}) {
  const activatesAt = over.activatesAt ?? new Date(Date.now() - DAY);
  return grantRepo.issueGrant({
    templateCouponId: 'cpn_tpl',
    leadId: null,
    sourceOrderId: `o_${Math.round(activatesAt.getTime())}_${Math.random().toString(36).slice(2, 7)}`,
    valueCents: 2000,
    ...over,
    activatesAt,
  });
}

describe('F14 redeem route', () => {
  it('F14-I001 code valide (actif) → 200 {valid:true, valueCents}', async () => {
    const g = await seedGrant({ valueCents: 2000, activatesAt: new Date(Date.now() - DAY) });
    const res = await POST(postReq({ code: g!.code }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: true, valueCents: 2000 });
  });

  it('F14-I002 code inconnu → 200 {valid:false, reason:not_found}', async () => {
    const res = await POST(postReq({ code: 'FG-NOPE-0000' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: false, reason: 'not_found' });
  });

  it('F14-I003 code pas encore actif → reason:not_yet_active', async () => {
    const g = await seedGrant({ activatesAt: new Date(Date.now() + 5 * DAY) });
    const res = await POST(postReq({ code: g!.code }));
    const json = await res.json();
    expect(json.valid).toBe(false);
    expect(json.reason).toBe('not_yet_active');
  });

  it('F14-I004 code expiré → reason:expired', async () => {
    // activatesAt il y a 70j → expiresAt il y a 10j.
    const g = await seedGrant({ activatesAt: new Date(Date.now() - 70 * DAY) });
    const res = await POST(postReq({ code: g!.code }));
    const json = await res.json();
    expect(json.valid).toBe(false);
    expect(json.reason).toBe('expired');
  });

  it('F14-I005 code déjà utilisé → reason:already_redeemed', async () => {
    const g = await seedGrant({ activatesAt: new Date(Date.now() - DAY) });
    await grantRepo.redeemGrant(g!.code, 'o_redeemed');
    const res = await POST(postReq({ code: g!.code }));
    const json = await res.json();
    expect(json.valid).toBe(false);
    expect(json.reason).toBe('already_redeemed');
  });

  it('F14-I006 corps sans code → 422 invalid_input', async () => {
    const res = await POST(postReq({}));
    expect(res.status).toBe(422);
    expect((await res.json()).reason).toBe('invalid_input');
  });

  it('F14-I007 code trop court (<3) → 422 invalid_input', async () => {
    const res = await POST(postReq({ code: 'ab' }));
    expect(res.status).toBe(422);
    expect((await res.json()).reason).toBe('invalid_input');
  });

  it('F14-I008 JSON malformé → 422 invalid_input', async () => {
    const res = await POST(postReq('{not json', true));
    expect(res.status).toBe(422);
    expect((await res.json()).reason).toBe('invalid_input');
  });

  it('F14-I009 exception interne → 200 {valid:false, reason:error}', async () => {
    vi.spyOn(grantRepo, 'validateGrant').mockRejectedValueOnce(new Error('boom'));
    const res = await POST(postReq({ code: 'FG-ANY-0001' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: false, reason: 'error' });
  });

  it('F14-I010 normalisation : casse/espaces tolérés (trim+upper côté repo)', async () => {
    const g = await seedGrant({ activatesAt: new Date(Date.now() - DAY) });
    const res = await POST(postReq({ code: `  ${g!.code.toLowerCase()}  ` }));
    expect((await res.json()).valid).toBe(true);
  });
});
