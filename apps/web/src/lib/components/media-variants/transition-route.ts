/**
 * Fabrique des routes de transition d'un ensemble
 * (`/api/admin/components/[key]/media-sets/[setId]/…`).
 *
 * Toutes suivent le même déroulé — session admin (401), même origine
 * (403, `requireSameOrigin`), composant doté
 * d'une politique (404/422), ensemble rattaché au composant (404), corps
 * validé (400), verrouillage optimiste (`If-Match` ou `expectedUpdatedAt`,
 * 409), mutation, invalidation du cache public SI la mutation change ce
 * qui est servi, puis audit (qui ne lève jamais : la mutation est déjà
 * committée). Seuls la mutation, l'action d'audit et le
 * besoin d'invalidation changent d'une route à l'autre.
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.7
 */
import 'server-only';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import { HttpError } from '@/lib/errors/http-error';
import { requireSameOrigin } from '@/lib/legal/csrf';
import type { ComponentMediaSet, ComponentMediaSetWithItems } from '@/lib/db/types';
import {
  auditMediaSetChange,
  mediaSetErrorResponse,
  readExpectedUpdatedAt,
  readJsonBody,
  requireAdminApi,
  requireMediaVariantsComponent,
  requireSetOfComponent,
} from './route-helpers';
import { revalidateMediaSets } from './revalidate.server';

interface TransitionCtx {
  params: { key: string; setId: string };
}

export interface TransitionRunInput<B> {
  setId: string;
  actorId: string;
  expectedUpdatedAt: Date | null;
  body: B;
}

export interface MediaSetTransitionOptions<S extends z.ZodTypeAny> {
  /** Libellé de la route (journal d'erreurs). */
  route: string;
  /** Action d'audit (`media_set.publish`…). */
  action: string;
  schema: S;
  /** Vrai si la mutation change ce qui est servi au public. */
  revalidate: boolean;
  /** Code HTTP de succès (défaut 200). */
  successStatus?: number;
  run: (input: TransitionRunInput<z.infer<S>>) => Promise<ComponentMediaSetWithItems>;
  /** Méta d'audit supplémentaires. */
  auditMeta?: (
    body: z.infer<S>,
    before: ComponentMediaSet,
    after: ComponentMediaSetWithItems,
  ) => Record<string, unknown>;
}

type BodyWithExpected = { expectedUpdatedAt?: string | undefined };

export function mediaSetTransitionHandler<S extends z.ZodTypeAny>(
  opts: MediaSetTransitionOptions<S>,
): (request: Request, ctx: TransitionCtx) => Promise<Response> {
  return async (request, ctx) => {
    try {
      const session = await requireAdminApi();
      requireSameOrigin(request);
      const { component } = await requireMediaVariantsComponent(ctx.params.key);
      const before = await requireSetOfComponent(ctx.params.setId, component.id);

      const parsed = opts.schema.safeParse(await readJsonBody(request));
      if (!parsed.success) {
        throw new HttpError('invalid_input', 'Payload invalide', parsed.error.flatten());
      }
      const body = parsed.data as z.infer<S>;
      const expectedUpdatedAt = readExpectedUpdatedAt(
        request,
        (body as BodyWithExpected | undefined)?.expectedUpdatedAt,
      );

      const set = await opts.run({
        setId: before.id,
        actorId: session.adminId,
        expectedUpdatedAt,
        body,
      });

      // Mutation committée : invalider le cache AVANT l'audit, qui de toute
      // façon ne lève pas (cf. `auditMediaSetChange`).
      const revalidated = opts.revalidate
        ? revalidateMediaSets([component.key], opts.route)
        : [];

      await auditMediaSetChange({
        action: opts.action,
        actorId: session.adminId,
        componentKey: component.key,
        set,
        meta: {
          fromStatus: before.status,
          fromVersion: before.version,
          ...(opts.auditMeta ? opts.auditMeta(body, before, set) : {}),
        },
      });

      return NextResponse.json({ set, revalidated }, { status: opts.successStatus ?? 200 });
    } catch (err) {
      return mediaSetErrorResponse(err, opts.route);
    }
  };
}
