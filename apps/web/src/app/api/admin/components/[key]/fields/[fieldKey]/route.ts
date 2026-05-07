/**
 * PATCH /api/admin/components/[key]/fields/[fieldKey]
 *
 * Upsert le draft d'un champ éditorial.
 *  - Validation de shape : `fieldPatchSchema` (Zod top-level).
 *  - Validation de valeur typée : `validateFieldValue` (Zod par FieldType).
 *  - Optimistic concurrency : `If-Match` ↔ draft.updatedAt.
 *  - Audit : `field.draft.{create|update}`.
 *  - Pas de revalidateTag (le rendu public n'est pas affecté tant que pas
 *    publié — cf. docs §B3).
 *
 * Cf. docs/components-cms/backend/01-api-routes.md §B1.2.
 */
import { NextResponse } from 'next/server';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  auditFieldChange,
  requireAdminApi,
  requireComponentAndField,
} from '@/lib/components/fields/route-helpers';
import {
  ConflictError,
  getDraftBinding,
  upsertDraftBinding,
} from '@/lib/db/queries/component-fields';
import { fieldPatchSchema } from '@/lib/schemas/admin/component-fields';
import { validateFieldValue } from '@/lib/components/fields/validators';
import { encodeValue } from '@/lib/components/fields/encoding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: { key: string; fieldKey: string };
}

export async function PATCH(request: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await requireAdminApi();
    const { component, field } = await requireComponentAndField(
      ctx.params.key,
      ctx.params.fieldKey,
    );

    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (!('value' in json)) {
      // Zod accepte z.unknown() y compris pour clé manquante → on impose
      // explicitement la présence de `value` pour respecter le contrat B1.2.
      throw new HttpError('invalid_input', 'Champ « value » requis');
    }
    const parsed = fieldPatchSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Payload invalide', parsed.error.flatten());
    }

    // Le client envoie une valeur "raw" (ex: string brute). On encode dans
    // l'enveloppe attendue par les schémas (`{ v: ... }` pour les scalaires)
    // puis on valide. Le résultat encodé est aussi ce qu'on persiste en DB.
    const encoded = encodeValue(parsed.data.value, field.type);
    const validated = validateFieldValue(field, encoded);
    if (!validated.ok) {
      throw new HttpError('validation_failed', 'Valeur invalide', { issues: validated.errors });
    }

    const ifMatchHeader = request.headers.get('if-match');
    const expectedUpdatedAt = ifMatchHeader ? new Date(ifMatchHeader) : null;
    if (ifMatchHeader && Number.isNaN(expectedUpdatedAt!.getTime())) {
      throw new HttpError('invalid_input', 'If-Match non parsable');
    }

    const existingDraft = await getDraftBinding(component.id, field.key, parsed.data.locale);

    try {
      const binding = await upsertDraftBinding({
        componentId: component.id,
        fieldKey: field.key,
        locale: parsed.data.locale,
        value: validated.value, // déjà sous forme encodée (cf. encodeValue ci-dessus)
        authorId: session.adminId,
        ...(expectedUpdatedAt ? { expectedUpdatedAt } : {}),
      });
      await auditFieldChange({
        action: existingDraft ? 'field.draft.update' : 'field.draft.create',
        actorId: session.adminId,
        componentKey: component.key,
        fieldKey: field.key,
        bindingId: binding.id,
        meta: { locale: parsed.data.locale, version: binding.version },
      });
      return NextResponse.json({ binding });
    } catch (err) {
      if (err instanceof ConflictError) {
        throw new HttpError('version_conflict', 'Une autre modification a eu lieu', {
          remoteValue: err.binding.value,
          remoteUpdatedAt: err.binding.updatedAt.toISOString(),
          remoteAuthorId: err.binding.authorId,
        });
      }
      throw err;
    }
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
