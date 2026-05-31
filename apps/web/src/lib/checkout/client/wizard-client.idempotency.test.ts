/**
 * Tests — retry automatique sur idempotency_conflict.
 *
 * Vérifie que :
 *  - Sur 409 `idempotency_conflict`, le client purge la clé en sessionStorage
 *    et retente UNE fois avec une clé fraîche → succès.
 *  - Pas de boucle infinie : 2e 409 → throw.
 *  - Sur autre code 409 (stock_insufficient, etc.), pas de retry.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { wizardClient } from './wizard-client';

const VALID_LEAD_INPUT = {
  sessionId: 'cs_test_1234567890ab',
  visitorId: 'cv_test_1234567890ab',
  phone: '+212600000000',
  firstName: 'Sara',
  language: 'fr' as const,
  consent: true as const,
  consentVersion: '1.0',
  formContext: {
    formId: 'wizard_kit' as const,
    formMode: 'wizard_embed' as const,
    variantKey: 'A' as const,
    source: 'wizard_kit' as const,
  },
  cartSnapshot: { items: [], totalCents: 19900, currency: 'MAD' as const },
  page: '/kit',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('wizardClient — idempotency_conflict auto-retry', () => {
  beforeEach(() => {
    // jsdom : sessionStorage est fourni
    window.sessionStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('retente avec une clé fraîche sur idempotency_conflict (succès second appel)', async () => {
    const calls: Array<{ key: string; body: unknown }> = [];
    const fetchFn = vi.fn(async (_url: string, init?: RequestInit) => {
      const idem = ((init?.headers as Record<string, string>)['Idempotency-Key'] ?? '');
      const body = init?.body ? JSON.parse(String(init.body)) : null;
      calls.push({ key: idem, body });
      if (calls.length === 1) {
        return jsonResponse(409, {
          error: {
            code: 'idempotency_conflict',
            message: 'La clé Idempotency-Key a déjà été utilisée…',
          },
        });
      }
      return jsonResponse(201, {
        leadId: 'cl_new_lead_id',
        status: 'created',
        nextStep: 'address',
      });
    });

    const result = await wizardClient.createLead(VALID_LEAD_INPUT, {
      fetchImpl: fetchFn as unknown as typeof fetch,
      baseUrl: 'https://test.local',
    });

    expect(result.leadId).toBe('cl_new_lead_id');
    expect(calls.length).toBe(2);
    // Les deux requêtes ont envoyé des clés différentes (purge + regen)
    expect(calls[0]?.key).toBeDefined();
    expect(calls[1]?.key).toBeDefined();
    expect(calls[0]?.key).not.toBe(calls[1]?.key);
  });

  it('ne retente PAS sur un autre code 409 (validation_failed, stock_insufficient, …)', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse(409, {
        error: { code: 'stock_insufficient', message: 'Stock' },
      }),
    );

    await expect(
      wizardClient.createLead(VALID_LEAD_INPUT, {
        fetchImpl: fetchFn as unknown as typeof fetch,
        baseUrl: 'https://test.local',
      }),
    ).rejects.toMatchObject({ code: 'stock_insufficient' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('ne retente PAS plus d\'une fois (anti-boucle)', async () => {
    const fetchFn = vi.fn(async () =>
      jsonResponse(409, {
        error: {
          code: 'idempotency_conflict',
          message: 'Conflict persistant',
        },
      }),
    );

    await expect(
      wizardClient.createLead(VALID_LEAD_INPUT, {
        fetchImpl: fetchFn as unknown as typeof fetch,
        baseUrl: 'https://test.local',
      }),
    ).rejects.toMatchObject({ code: 'idempotency_conflict' });
    expect(fetchFn).toHaveBeenCalledTimes(2); // 1 initial + 1 retry
  });
});
