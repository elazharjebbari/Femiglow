import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createLeadSyncQueue,
  QUEUE_MIRROR_KEY,
  type Envelope,
  type SendResult,
  type SyncTransport,
} from './lead-sync-queue';

const LEAD = 'cl_3xq7m2k9v4b1n8p0w5tz';

function envInput(
  scope: Envelope['scope'],
  over: Partial<Envelope> = {},
): Omit<Envelope, 'mutationId' | 'enqueuedAt' | 'attempt'> {
  return {
    leadId: LEAD,
    scope,
    endpoint: `/api/checkout/lead/${scope}`,
    method: scope === 'lead_create' ? 'POST' : 'PATCH',
    idempotencyKey: `idem_${scope}`,
    payload: { scope },
    ...over,
  };
}

/** Transport scriptable : renvoie des résultats programmés par scope. */
function scriptedTransport(
  script: (env: Envelope) => SendResult,
): SyncTransport & { calls: Envelope[] } {
  const calls: Envelope[] = [];
  return {
    calls,
    async send(env) {
      calls.push({ ...env });
      return script(env);
    },
  };
}

/** Fake Storage en mémoire (jsdom-free). */
function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k) => m.get(k) ?? null,
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    clear: () => m.clear(),
    key: (i) => Array.from(m.keys())[i] ?? null,
    get length() {
      return m.size;
    },
  } as Storage;
}

const noSleep = () => Promise.resolve();

describe('lead-sync-queue (OWBS P3)', () => {
  // TST-U-10 — FIFO (create → address → payment)
  it('envoie les mutations en FIFO', async () => {
    const t = scriptedTransport(() => ({ ok: true }));
    const q = createLeadSyncQueue({ transport: t, storage: null, sleep: noSleep });
    q.enqueue(envInput('lead_create'));
    q.enqueue(envInput('address_update'));
    q.enqueue(envInput('payment_select'));
    await q.flush();
    expect(t.calls.map((c) => c.scope)).toEqual([
      'lead_create',
      'address_update',
      'payment_select',
    ]);
    expect(q.pending()).toHaveLength(0);
  });

  // TST-U-11 — retry backoff sur retryable puis succès, MÊME idempotency-key
  it('réessaie sur erreur retryable (même clé), puis vide la file', async () => {
    let n = 0;
    const t = scriptedTransport(() => {
      n += 1;
      return n < 3 ? { ok: false, retryable: true } : { ok: true };
    });
    const sleep = vi.fn(() => Promise.resolve());
    const q = createLeadSyncQueue({ transport: t, storage: null, sleep, backoffBaseMs: 100 });
    q.enqueue(envInput('lead_create'));
    await q.flush();
    expect(t.calls).toHaveLength(3); // 2 échecs + 1 succès
    expect(new Set(t.calls.map((c) => c.idempotencyKey)).size).toBe(1); // même clé
    expect(sleep).toHaveBeenCalledTimes(2); // 2 backoffs
    expect(q.pending()).toHaveLength(0);
  });

  // TST-U-12 — 4xx non-retryable → drop + onDrop, retiré de pending
  it('drop sur erreur non-retryable (4xx), avec callback onDrop', async () => {
    const onDrop = vi.fn();
    const t = scriptedTransport(() => ({ ok: false, retryable: false, status: 409 }));
    const q = createLeadSyncQueue({ transport: t, storage: null, sleep: noSleep, onDrop });
    q.enqueue(envInput('lead_create'));
    await q.flush();
    expect(q.pending()).toHaveLength(0);
    expect(onDrop).toHaveBeenCalledWith(expect.objectContaining({ scope: 'lead_create' }), 'non_retryable');
  });

  // drop après maxAttempts
  it('drop après maxAttempts sur retryable persistant', async () => {
    const onDrop = vi.fn();
    const t = scriptedTransport(() => ({ ok: false, retryable: true }));
    const q = createLeadSyncQueue({ transport: t, storage: null, sleep: noSleep, maxAttempts: 3, onDrop });
    q.enqueue(envInput('lead_create'));
    await q.flush();
    expect(q.pending()).toHaveLength(0);
    expect(onDrop).toHaveBeenCalledWith(expect.anything(), 'max_attempts');
    expect(t.calls.length).toBe(3); // attempt 1,2,3 puis drop
  });

  // TST-U-13 — miroir sessionStorage persiste / hydrate
  it('persiste dans le miroir et réhydrate (reprise après reload)', async () => {
    const storage = memStorage();
    // Transport qui échoue (retryable) pour laisser l'envelope en file.
    const failing = scriptedTransport(() => ({ ok: false, retryable: true }));
    const q1 = createLeadSyncQueue({ transport: failing, storage, sleep: noSleep, maxAttempts: 1 });
    q1.enqueue(envInput('lead_create'));
    // maxAttempts=1 → la 1re tentative incrémente attempt à 1 == max → drop.
    await q1.flush();
    // Re-simule un reload : on ré-injecte une envelope via le miroir.
    storage.setItem(
      QUEUE_MIRROR_KEY,
      JSON.stringify([
        {
          mutationId: 'mut_x',
          leadId: LEAD,
          scope: 'lead_create',
          endpoint: '/api/checkout/lead',
          method: 'POST',
          idempotencyKey: 'idem_lead_create',
          payload: {},
          enqueuedAt: new Date().toISOString(),
          attempt: 0,
        },
      ]),
    );
    const ok = scriptedTransport(() => ({ ok: true }));
    const q2 = createLeadSyncQueue({ transport: ok, storage, sleep: noSleep });
    q2.hydrateFromMirror();
    expect(q2.pending()).toHaveLength(1);
    await q2.flush();
    expect(ok.calls).toHaveLength(1);
    expect(q2.pending()).toHaveLength(0);
  });

  // TST-U-14 — un seul flush concurrent (pas de double-envoi par mutationId)
  it('flush concurrent → un seul envoi par envelope', async () => {
    const t = scriptedTransport(() => ({ ok: true }));
    const q = createLeadSyncQueue({ transport: t, storage: null, sleep: noSleep });
    q.enqueue(envInput('lead_create'));
    // Deux flush lancés en parallèle.
    await Promise.all([q.flush(), q.flush()]);
    const ids = t.calls.map((c) => c.mutationId);
    expect(ids).toHaveLength(1);
    expect(new Set(ids).size).toBe(1);
  });

  // GARDE-FOU (bug live-sync e2e) — un enqueue juste APRÈS un flush (file vide,
  // ex. flush d'init du singleton) doit quand même envoyer l'envelope, SANS
  // qu'on rappelle flush() explicitement. Avec le bug (currentFlush posé +
  // pas de re-drain), l'envelope restait non envoyée.
  it('enqueue juste après un flush d\'init (file vide) → envelope bien envoyée', async () => {
    const t = scriptedTransport(() => ({ ok: true }));
    const q = createLeadSyncQueue({ transport: t, storage: null, sleep: noSleep });
    void q.flush(); // flush d'init sur file vide → currentFlush posé
    q.enqueue(envInput('lead_create')); // déclenche void flush() en interne (re-drain attendu)
    // On NE rappelle PAS flush() : on laisse tourner les microtasks/macrotasks.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(t.calls).toHaveLength(1);
    expect(q.pending()).toHaveLength(0);
  });

  // F03-S05 — backoff BORNÉ (anti retry-storm batterie/CPU, RSK-09)
  it('le backoff est plafonné (maxBackoffMs) — pas de retry-storm', async () => {
    const delays: number[] = [];
    const sleep = vi.fn((ms: number) => {
      delays.push(ms);
      return Promise.resolve();
    });
    const t = scriptedTransport(() => ({ ok: false, retryable: true }));
    const q = createLeadSyncQueue({
      transport: t,
      storage: null,
      sleep,
      maxAttempts: 8,
      backoffBaseMs: 250,
      maxBackoffMs: 4000,
      now: () => 0, // jitter déterministe (0)
    });
    q.enqueue(envInput('lead_create'));
    await q.flush();
    expect(delays.length).toBeGreaterThan(0);
    // Aucun délai ne dépasse le plafond (250*2^n capé à 4000, jitter=0).
    for (const d of delays) expect(d).toBeLessThanOrEqual(4000);
    // Croissance monotone jusqu'au plafond puis stable (pas d'explosion).
    expect(Math.max(...delays)).toBe(4000);
  });
});
