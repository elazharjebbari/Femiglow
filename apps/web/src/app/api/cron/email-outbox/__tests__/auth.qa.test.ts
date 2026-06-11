/**
 * CHANTIER H — Module 08 : auth du cron email-outbox (Bearer CRON_SECRET).
 *
 * Oracle dur : sans Bearer ou avec mauvais Bearer → 401 ET `pickAndProcessBatch`
 * N'EST PAS appelé (aucune exécution / aucun drain). Avec le bon Bearer → 200 et
 * le drain est exécuté exactement une fois. Le secret n'est jamais renvoyé dans
 * la réponse.
 *
 * IDs matrice : PIP-INT-066 (cron auth).
 *
 * NB : le route handler lit `env.CRON_SECRET`, figé à l'import du module env. On
 * fixe `process.env.CRON_SECRET` AVANT tout import (vi.hoist) et on aligne le
 * Bearer de test dessus.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Bearer de test : doit être posé avant l'import de `env` (qui parse au load).
const TEST_SECRET = process.env.CRON_SECRET ?? 'q'.repeat(40);
process.env.CRON_SECRET = TEST_SECRET;

vi.mock('@/lib/mail/outbox', () => ({
  pickAndProcessBatch: vi.fn(),
}));

import { POST } from '../route';
import { pickAndProcessBatch } from '@/lib/mail/outbox';

function makeReq(headers: Record<string, string> = {}): Request {
  return new Request('http://test/api/cron/email-outbox', { method: 'POST', headers });
}

const OK_RESULT = {
  picked: 3,
  succeeded: 3,
  failed: 0,
  dlq: 0,
  reaped: 0,
  durationMs: 12,
};

describe('cron email-outbox — auth Bearer (PIP-INT-066)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(pickAndProcessBatch).mockResolvedValue(OK_RESULT);
  });

  it('sans Authorization → 401 ET aucune exécution du drain', async () => {
    const res = await POST(makeReq());
    expect(res.status).toBe(401);
    expect(pickAndProcessBatch).not.toHaveBeenCalled();
  });

  it('mauvais Bearer → 401 ET aucune exécution du drain', async () => {
    const res = await POST(makeReq({ authorization: 'Bearer mauvais-secret' }));
    expect(res.status).toBe(401);
    expect(pickAndProcessBatch).not.toHaveBeenCalled();
  });

  it('schéma "Bearer " manquant (secret brut) → 401', async () => {
    const res = await POST(makeReq({ authorization: TEST_SECRET }));
    expect(res.status).toBe(401);
    expect(pickAndProcessBatch).not.toHaveBeenCalled();
  });

  it('bon Bearer → 200, drain exécuté une fois, résultat renvoyé', async () => {
    const res = await POST(makeReq({ authorization: `Bearer ${TEST_SECRET}` }));
    expect(res.status).toBe(200);
    expect(pickAndProcessBatch).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, picked: 3, succeeded: 3 });
  });

  it('ne renvoie jamais le secret dans la réponse (401)', async () => {
    const res = await POST(makeReq({ authorization: 'Bearer x' }));
    const text = await res.text();
    expect(text.includes(TEST_SECRET)).toBe(false);
  });
});
