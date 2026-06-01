/**
 * OWBS — File de synchronisation des mutations lead (côté client).
 *
 * Après la transition optimiste (ADR-0001), les mutations sont **enfilées** ici
 * et envoyées en tâche de fond, sans bloquer l'UI :
 *   - FIFO (la tête est réessayée jusqu'au succès avant de passer à la suivante)
 *     → garantit l'ordre create → address → payment pour un même lead ;
 *   - retry **backoff exponentiel + jitter** sur erreur réseau / 5xx, avec la
 *     **même `Idempotency-Key`** (pas de doublon serveur) ;
 *   - **miroir `sessionStorage`** → survit à un reload (reprise via `hydrateFromMirror`) ;
 *   - drop + callback `onDrop` sur erreur non-retryable (4xx) ou après `maxAttempts`.
 *
 * La file est **pure** : le transport est injecté (testable Vitest/MSW).
 *
 * @see docs/checkout-leads-background-2026-06-01/00-conception/decisions/ADR-0003-background-sync-queue.md
 */
import { createId } from '@/lib/checkout/client/random-id';

export type MutationScope = 'lead_create' | 'address_update' | 'payment_select';

export interface Envelope {
  /** Identité transport (dédup d'un double-flush). */
  mutationId: string;
  leadId: string;
  scope: MutationScope;
  endpoint: string;
  method: 'POST' | 'PATCH';
  idempotencyKey: string;
  payload: unknown;
  enqueuedAt: string;
  attempt: number;
}

export type SendResult = { ok: true } | { ok: false; retryable: boolean; status?: number };

export interface SyncTransport {
  send(env: Envelope): Promise<SendResult>;
}

export type DropReason = 'non_retryable' | 'max_attempts';

export interface LeadSyncQueue {
  /** Enfile une mutation et déclenche un flush en tâche de fond (non bloquant). */
  enqueue(input: Omit<Envelope, 'mutationId' | 'enqueuedAt' | 'attempt'>): Envelope;
  /** Draine la file (FIFO, retry/backoff). Idempotent : un seul flush concurrent. */
  flush(): Promise<void>;
  /** Snapshot des envelopes en attente (pour beacon + tests). */
  pending(): Envelope[];
  /** Recharge la file depuis le miroir (reprise après reload). */
  hydrateFromMirror(): void;
  /** Vide la file + le miroir (tests / reset). */
  clear(): void;
}

export const QUEUE_MIRROR_KEY = 'femiglow.owbs.queue.v1';

export interface CreateLeadSyncQueueOptions {
  transport: SyncTransport;
  /** Storage du miroir. `undefined` → tente sessionStorage ; `null` → mémoire seule. */
  storage?: Storage | null;
  maxAttempts?: number;
  backoffBaseMs?: number;
  maxBackoffMs?: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** Observabilité (FR-11) : appelé quand une envelope est abandonnée. */
  onDrop?: (env: Envelope, reason: DropReason) => void;
}

function defaultStorage(): Storage | null {
  try {
    if (typeof globalThis !== 'undefined' && 'sessionStorage' in globalThis) {
      return (globalThis as unknown as { sessionStorage: Storage }).sessionStorage;
    }
  } catch {
    /* sessionStorage inaccessible (SSR / privacy) */
  }
  return null;
}

export function createLeadSyncQueue(opts: CreateLeadSyncQueueOptions): LeadSyncQueue {
  const transport = opts.transport;
  const storage = opts.storage === undefined ? defaultStorage() : opts.storage;
  const maxAttempts = opts.maxAttempts ?? 6;
  const backoffBaseMs = opts.backoffBaseMs ?? 250;
  const maxBackoffMs = opts.maxBackoffMs ?? 4_000;
  const now = opts.now ?? (() => Date.now());
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const onDrop = opts.onDrop;

  let queue: Envelope[] = [];
  let currentFlush: Promise<void> | null = null;

  function persist(): void {
    if (!storage) return;
    try {
      storage.setItem(QUEUE_MIRROR_KEY, JSON.stringify(queue));
    } catch {
      /* quota / privacy — la file reste en mémoire */
    }
  }

  function backoff(attempt: number): number {
    const base = Math.min(backoffBaseMs * 2 ** (attempt - 1), maxBackoffMs);
    // Jitter déterministe (testable avec faux timers) : 0–30 % du base.
    const jitter = ((now() % 1000) / 1000) * 0.3 * base;
    return Math.round(base + jitter);
  }

  function enqueue(input: Omit<Envelope, 'mutationId' | 'enqueuedAt' | 'attempt'>): Envelope {
    const env: Envelope = {
      ...input,
      mutationId: createId('mut'),
      enqueuedAt: new Date(now()).toISOString(),
      attempt: 0,
    };
    queue.push(env);
    persist();
    // Fire-and-forget : ne bloque jamais l'appelant (UI déjà avancée).
    void flush();
    return env;
  }

  async function doFlush(): Promise<void> {
    while (queue.length > 0) {
      const env = queue[0]!;
      const res = await transport.send(env);
      if (res.ok) {
        queue.shift();
        persist();
        continue;
      }
      if (!res.retryable) {
        queue.shift();
        persist();
        onDrop?.(env, 'non_retryable');
        continue;
      }
      // Retryable : incrémente la tentative, backoff, et réessaie la MÊME tête.
      env.attempt += 1;
      if (env.attempt >= maxAttempts) {
        queue.shift();
        persist();
        onDrop?.(env, 'max_attempts');
        continue;
      }
      persist();
      await sleep(backoff(env.attempt));
    }
  }

  /** Draine la file. Un seul flush concurrent : les appels suivants attendent
   *  le flush en cours (await fiable pour le beacon et les tests). */
  function flush(): Promise<void> {
    if (currentFlush) return currentFlush;
    currentFlush = doFlush().finally(() => {
      currentFlush = null;
    });
    return currentFlush;
  }

  function pending(): Envelope[] {
    return [...queue];
  }

  function hydrateFromMirror(): void {
    if (!storage) return;
    try {
      const raw = storage.getItem(QUEUE_MIRROR_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        queue = parsed.filter(isEnvelope);
      }
    } catch {
      /* miroir corrompu — on ignore */
    }
  }

  function clear(): void {
    queue = [];
    if (storage) {
      try {
        storage.removeItem(QUEUE_MIRROR_KEY);
      } catch {
        /* no-op */
      }
    }
  }

  return { enqueue, flush, pending, hydrateFromMirror, clear };
}

function isEnvelope(v: unknown): v is Envelope {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as Envelope).mutationId === 'string' &&
    typeof (v as Envelope).leadId === 'string' &&
    typeof (v as Envelope).endpoint === 'string'
  );
}
