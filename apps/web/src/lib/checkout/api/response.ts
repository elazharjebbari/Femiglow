/**
 * CHA-230 — Helpers de réponse cohérents pour les routes checkout.
 */
import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';

import {
  IdempotencyConflictError,
  InvalidIdempotencyKeyError,
} from './idempotency-middleware';
import { DbUnavailableError } from '../repos/idempotency-repo';
import { InvalidPhoneError } from '../repos/lead-repo';

export type CheckoutErrorCode =
  | 'invalid_json'
  | 'invalid_input'
  | 'idempotency_conflict'
  | 'idempotency_invalid_key'
  | 'not_found'
  | 'invalid_state'
  | 'stock_insufficient'
  | 'price_mismatch'
  | 'db_unavailable'
  | 'internal_error';

const STATUS_BY_CODE: Record<CheckoutErrorCode, number> = {
  invalid_json: 400,
  invalid_input: 400,
  idempotency_conflict: 409,
  idempotency_invalid_key: 400,
  not_found: 404,
  invalid_state: 409,
  stock_insufficient: 409,
  price_mismatch: 422,
  db_unavailable: 503,
  internal_error: 500,
};

export function errorResponse(
  code: CheckoutErrorCode,
  message: string,
  details?: unknown,
): NextResponse {
  return NextResponse.json(
    { error: { code, message, details } },
    { status: STATUS_BY_CODE[code] },
  );
}

export function zodErrorResponse(err: ZodError): NextResponse {
  return errorResponse(
    'invalid_input',
    'Payload invalide.',
    err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  );
}

/** Mappe les erreurs métier connues en réponse HTTP. */
export function mapError(err: unknown): NextResponse {
  if (err instanceof IdempotencyConflictError) {
    return errorResponse('idempotency_conflict', err.message);
  }
  if (err instanceof InvalidIdempotencyKeyError) {
    return errorResponse('idempotency_invalid_key', err.message);
  }
  if (err instanceof DbUnavailableError) {
    return errorResponse('db_unavailable', err.message);
  }
  if (err instanceof InvalidPhoneError) {
    return errorResponse('invalid_input', err.message);
  }
  return errorResponse('internal_error', 'Erreur interne');
}
