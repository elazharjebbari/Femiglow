/**
 * Helpers partagés par les routes `/api/admin/components/[key]/media-sets/**`.
 *
 * Calqués sur `lib/components/fields/route-helpers.ts` :
 *  - `requireMediaVariantsComponent` : composant existant (404) ET doté
 *    d'une politique `metadata.mediaVariants` (422) ;
 *  - `requireSetOfComponent` : ensemble existant ET rattaché au composant
 *    de l'URL (404 sinon — pas de fuite d'un composant à l'autre) ;
 *  - `readExpectedUpdatedAt` : verrouillage optimiste (`If-Match` prioritaire
 *    sur `expectedUpdatedAt` du corps) ;
 *  - `toMediaSetHttpError` : traduction homogène des erreurs de la couche
 *    requêtes en `HttpError` ;
 *  - `auditMediaSetChange` : journal d'audit (`resourceType`
 *    `component_media_set`) ;
 *  - `enrichSetsForAdmin` : vignettes et état des médias pour l'UI admin.
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.7
 */
import 'server-only';
import { NextResponse } from 'next/server';
import { HttpError, formatErrorResponse } from '@/lib/errors/http-error';
import { logger } from '@/lib/logging/logger';
import { logAuditEvent } from '@/lib/audit/log-event';
import { getSiteComponentByKey } from '@/lib/db/queries/site-components';
import {
  MediaSetConflictError,
  MediaSetStateError,
  MediaSetTransactionUnavailableError,
  MediaSetValidationError,
  NotFoundError,
  getSetById,
  getSetWithItems,
} from '@/lib/db/queries/component-media-sets';
import { MediaInUseError, findMediaByIds, thumbsByMediaId } from '@/lib/db/queries/media';
import type { MediaVariantPolicy } from '@/lib/components/registry';
import type {
  ComponentMediaSet,
  ComponentMediaSetItem,
  ComponentMediaSetWithItems,
  Media,
  SiteComponent,
} from '@/lib/db/types';
import { readMediaVariantPolicy } from './policy';

export { requireAdminApi } from '@/lib/components/fields/route-helpers';

/** Composant + politique « médias par audience ». */
export async function requireMediaVariantsComponent(
  componentKey: string,
): Promise<{ component: SiteComponent; policy: MediaVariantPolicy }> {
  const component = await getSiteComponentByKey(componentKey);
  if (!component) throw new HttpError('not_found', 'Composant introuvable');
  const policy = readMediaVariantPolicy(component.metadata);
  if (!policy) {
    throw new HttpError(
      'validation_failed',
      "Ce composant ne déclare pas de « médias par audience » (metadata.mediaVariants absent).",
      { issues: [{ code: 'policy.missing', path: [], message: 'Politique mediaVariants absente' }] },
    );
  }
  return { component, policy };
}

/** Ensemble de l'URL, rattaché au composant (404 sinon). */
export async function requireSetOfComponent(
  setId: string,
  componentId: string,
): Promise<ComponentMediaSet> {
  const set = await getSetById(setId);
  if (!set || set.componentId !== componentId) {
    throw new HttpError('not_found', 'Ensemble de médias introuvable');
  }
  return set;
}

/**
 * Horodatage attendu pour le verrouillage optimiste. Le header `If-Match`
 * (valeur = `updatedAt` ISO, éventuellement entre guillemets comme un ETag)
 * est prioritaire sur `expectedUpdatedAt` du corps. Absent → `null`.
 */
export function readExpectedUpdatedAt(request: Request, fromBody?: string | null): Date | null {
  const header = request.headers.get('if-match');
  const raw = header ? header.trim().replace(/^W\//, '').replace(/^"(.*)"$/, '$1') : fromBody;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError('invalid_input', header ? 'If-Match non parsable' : 'expectedUpdatedAt non parsable');
  }
  return date;
}

/**
 * Précondition `If-None-Match: *` (« aucun brouillon ne doit exister ») pour
 * `PUT /draft` et `POST /restore` : le client part d'un état sans brouillon.
 * Toute autre valeur → 400 ; combinée à `If-Match` / `expectedUpdatedAt` → 400.
 */
export function readExpectNoDraft(request: Request, expectedUpdatedAt: Date | null): boolean {
  const raw = request.headers.get('if-none-match');
  if (raw === null) return false;
  if (raw.trim() !== '*') {
    throw new HttpError('invalid_input', 'If-None-Match : seule la valeur « * » est acceptée');
  }
  if (expectedUpdatedAt) {
    throw new HttpError('invalid_input', 'If-None-Match: * ne se combine pas avec If-Match');
  }
  return true;
}

/** Messages lisibles des refus de transition (`MediaSetStateError.reason`). */
const STATE_MESSAGES: Record<string, string> = {
  'schedule.scheduled_exists':
    'Une autre publication est déjà programmée pour cette cellule : annulez-la d’abord.',
  'cancel_schedule.draft_exists':
    'Un brouillon existe déjà pour cette cellule : publiez-le ou abandonnez-le avant d’annuler la programmation.',
};

function stateMessage(reason: string): string {
  if (STATE_MESSAGES[reason]) return STATE_MESSAGES[reason]!;
  const status = /\.invalid_status:(\w+)$/.exec(reason)?.[1];
  if (status) return `Action impossible sur un ensemble au statut « ${status} ».`;
  return 'Transition de statut impossible.';
}

/**
 * Traduit une erreur de la couche requêtes en `HttpError` (les autres
 * erreurs sont renvoyées telles quelles → 500 via `formatErrorResponse`).
 *
 *  - `MediaSetConflictError`               → 409 `version_conflict` + état courant (avec items)
 *  - `MediaSetValidationError`             → 422 `validation_failed` + `issues`
 *  - `MediaSetStateError` `schedule.in_past` → 400 `schedule_in_past` (comme les champs)
 *  - `MediaSetStateError` (autres)         → 409 `invalid_state` + `reason`
 *  - `NotFoundError`                       → 404
 *  - `MediaSetTransactionUnavailableError` → 503 `service_unavailable`
 *  - `MediaInUseError`                     → 409 `conflict`
 */
export async function toMediaSetHttpError(err: unknown): Promise<unknown> {
  if (err instanceof HttpError) return err;
  if (err instanceof MediaSetConflictError) {
    const current = err.set ? await getSetWithItems(err.set.id).catch(() => null) : null;
    return new HttpError('version_conflict', 'Une autre modification a eu lieu sur cet ensemble', {
      // `err.set` n'a pas d'items : jamais renvoyé comme état courant.
      current: current ?? null,
      remoteUpdatedAt: err.set ? new Date(err.set.updatedAt).toISOString() : null,
    });
  }
  if (err instanceof MediaSetValidationError) {
    return new HttpError('validation_failed', 'Ensemble de médias invalide', { issues: err.issues });
  }
  if (err instanceof MediaSetStateError) {
    if (err.reason === 'schedule.in_past') {
      return new HttpError(
        'schedule_in_past',
        'La date de publication doit être dans le futur (au moins +1 minute).',
      );
    }
    return new HttpError('invalid_state', stateMessage(err.reason), { reason: err.reason });
  }
  if (err instanceof NotFoundError) return new HttpError('not_found', err.message);
  if (err instanceof MediaSetTransactionUnavailableError) {
    return new HttpError(
      'service_unavailable',
      'La base de données ne permet pas les transactions nécessaires à cette opération. Réessayez plus tard.',
    );
  }
  if (err instanceof MediaInUseError) {
    return new HttpError('conflict', 'Ce média est utilisé par un ensemble de médias.', {
      mediaId: err.mediaId,
    });
  }
  return err;
}

/**
 * Réponse d'erreur JSON homogène (`{ error: { code, message, details } }`).
 * Les erreurs inattendues (→ 500) sont journalisées avec la route.
 */
export async function mediaSetErrorResponse(err: unknown, route: string): Promise<Response> {
  const mapped = await toMediaSetHttpError(err);
  if (!(mapped instanceof HttpError)) {
    logger.error('admin.media_sets.unexpected_error', {
      route,
      error: mapped instanceof Error ? mapped.message : String(mapped),
    });
  }
  const { status, body } = formatErrorResponse(mapped);
  return NextResponse.json(body, { status });
}

/** Lit le corps JSON ; vide → `{}`, JSON invalide → 400. */
export async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.trim() === '') return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError('invalid_input', 'Corps JSON invalide');
  }
}

/** Résumé stable d'un ensemble pour le journal d'audit. */
function auditTuple(set: ComponentMediaSet): Record<string, unknown> {
  return {
    slot: set.slot,
    variantDim: set.variantDim,
    variantKey: set.variantKey,
    locale: set.locale,
    status: set.status,
    version: set.version,
  };
}

/**
 * Journal d'audit — actions standardisées : `media_set.draft.create`,
 * `media_set.draft.update`, `media_set.publish`, `media_set.schedule`,
 * `media_set.cancel_schedule`, `media_set.unpublish`, `media_set.discard`,
 * `media_set.restore`, `media_set.bulk_publish`, `media_set.publish.scheduled`.
 *
 * Ne lève JAMAIS : l'audit est écrit APRÈS une mutation déjà committée ;
 * une panne du journal ne doit ni renvoyer un 500 trompeur (l'admin
 * retenterait une action déjà faite) ni sauter l'invalidation du cache.
 * L'échec est journalisé en erreur (`admin.media_sets.audit_failed`).
 * Renvoie `false` si l'écriture a échoué.
 */
export async function auditMediaSetChange(input: {
  action: string;
  actorId: string | null;
  componentKey: string;
  set?: ComponentMediaSet | null;
  meta?: Record<string, unknown>;
}): Promise<boolean> {
  try {
    await logAuditEvent({
      action: input.action,
      actorId: input.actorId,
      resourceType: 'component_media_set',
      resourceId: input.set?.id ?? input.componentKey,
      meta: {
        componentKey: input.componentKey,
        ...(input.set ? auditTuple(input.set) : {}),
        ...(input.meta ?? {}),
      },
    });
    return true;
  } catch (err) {
    logger.error('admin.media_sets.audit_failed', {
      action: input.action,
      component_key: input.componentKey,
      set_id: input.set?.id ?? null,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/** État d'un média vu depuis l'admin. */
export type AdminMediaState = 'ok' | 'not_ready' | 'deleted' | 'missing';

export interface AdminMediaRef {
  id: string;
  state: AdminMediaState;
  /** Petite vignette (variant `xs`/`sm`, sinon original). */
  thumbUrl: string | null;
  alt: string | null;
}

export interface AdminMediaSetItem extends ComponentMediaSetItem {
  media: AdminMediaRef;
  mobileMedia: AdminMediaRef | null;
}

export interface AdminMediaSet extends Omit<ComponentMediaSetWithItems, 'items'> {
  items: AdminMediaSetItem[];
  /** Vrai si un item pointe vers un média supprimé, absent ou pas prêt. */
  hasUnavailableMedia: boolean;
}

function mediaState(m: Media | undefined): AdminMediaState {
  if (!m) return 'missing';
  if (m.deletedAt) return 'deleted';
  if (m.status !== 'ready' && m.status !== 'passthrough') return 'not_ready';
  return 'ok';
}

/**
 * Ajoute à chaque item ses vignettes et l'état de ses médias, en deux
 * requêtes groupées (médias + variants), quel que soit le nombre d'ensembles.
 */
export async function enrichSetsForAdmin(
  sets: readonly ComponentMediaSetWithItems[],
): Promise<AdminMediaSet[]> {
  const ids = Array.from(
    new Set(
      sets.flatMap((s) => s.items.flatMap((i) => [i.mediaId, i.mobileMediaId])).filter((id): id is string => !!id),
    ),
  );
  const [mediaRows, thumbs] = await Promise.all([findMediaByIds(ids), thumbsByMediaId(ids)]);
  const byId = new Map(mediaRows.map((m) => [m.id, m]));
  const ref = (id: string): AdminMediaRef => {
    const m = byId.get(id);
    return {
      id,
      state: mediaState(m),
      thumbUrl: thumbs.get(id) ?? m?.originalUrl ?? null,
      alt: m?.alt ?? null,
    };
  };
  return sets.map((s) => {
    const items = s.items.map((i) => ({
      ...i,
      media: ref(i.mediaId),
      mobileMedia: i.mobileMediaId ? ref(i.mobileMediaId) : null,
    }));
    return {
      ...s,
      items,
      hasUnavailableMedia: items.some(
        (i) => i.media.state !== 'ok' || (i.mobileMedia !== null && i.mobileMedia.state !== 'ok'),
      ),
    };
  });
}
