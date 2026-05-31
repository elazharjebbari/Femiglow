/**
 * CHA-230 — Middleware idempotence pour les routes checkout.
 *
 * Pattern :
 *
 *   ```ts
 *   const result = await withIdempotency({
 *     request: req,
 *     scope: 'lead_create',
 *     payload: parsed.data,
 *     execute: async () => {
 *       const lead = await wizardLeadRepo.createWizardLead(...);
 *       return { status: 201, body: { leadId: lead.id, ... }, resourceId: lead.id };
 *     },
 *   });
 *   return NextResponse.json(result.body, { status: result.status });
 *   ```
 *
 * Comportement :
 *   - Header `Idempotency-Key` absent → exécute sans cache (fresh request).
 *   - Header présent, clé inconnue → exécute, persiste la réponse.
 *   - Header présent, clé connue, hash matche → replay sans ré-exécuter.
 *   - Header présent, clé connue, hash différent → 409 conflict.
 */
import { type NextRequest } from 'next/server';

import {
  hashRequestPayload,
  idempotencyRepo,
  type IdempotencyScope,
} from '../repos/idempotency-repo';
import { idempotencyKeySchema } from '../schemas/common';

export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

export interface IdempotencyResult<TBody> {
  status: number;
  body: TBody;
  /** ID de la ressource créée/mutée (utile pour audit). */
  resourceId?: string | null;
  /** `true` si la réponse est un replay depuis le cache idempotence. */
  replayed: boolean;
}

export interface WithIdempotencyOpts<TBody> {
  request: NextRequest;
  scope: IdempotencyScope;
  payload: unknown;
  execute: () => Promise<{
    status: number;
    body: TBody;
    resourceId?: string | null;
  }>;
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super(
      'La clé Idempotency-Key a déjà été utilisée avec un payload différent.',
    );
    this.name = 'IdempotencyConflictError';
  }
}

export class InvalidIdempotencyKeyError extends Error {
  constructor() {
    super('Clé Idempotency-Key invalide.');
    this.name = 'InvalidIdempotencyKeyError';
  }
}

export async function withIdempotency<TBody>(
  opts: WithIdempotencyOpts<TBody>,
): Promise<IdempotencyResult<TBody>> {
  const rawKey = opts.request.headers.get(IDEMPOTENCY_HEADER);

  // Pas de clé : on exécute mais on ne persiste pas.
  if (!rawKey) {
    const out = await opts.execute();
    return { ...out, replayed: false };
  }

  // Valide le format de la clé.
  const keyParsed = idempotencyKeySchema.safeParse(rawKey);
  if (!keyParsed.success) {
    throw new InvalidIdempotencyKeyError();
  }
  const key = keyParsed.data;
  const requestHash = hashRequestPayload(opts.payload);

  // Lookup.
  const found = await idempotencyRepo.lookup(key, opts.scope, requestHash);
  if (found?.match === true) {
    return {
      status: found.hit.responseStatus,
      body: found.hit.responseJson as TBody,
      resourceId: found.hit.resourceId,
      replayed: true,
    };
  }
  if (found?.match === false && found.conflict) {
    throw new IdempotencyConflictError();
  }

  // Fresh execution.
  const out = await opts.execute();
  await idempotencyRepo.store({
    key,
    scope: opts.scope,
    requestHash,
    responseJson: out.body,
    responseStatus: out.status,
    resourceId: out.resourceId ?? null,
  });
  return { ...out, replayed: false };
}
