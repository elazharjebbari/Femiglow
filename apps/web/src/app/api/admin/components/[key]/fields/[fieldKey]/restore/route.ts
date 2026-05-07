/**
 * POST /api/admin/components/[key]/fields/[fieldKey]/restore
 *
 * Crée un nouveau draft à partir d'une entrée history. Utilisé par le
 * panneau admin "Versions" pour restaurer un état antérieur.
 *
 * On re-valide la valeur historique avec le schéma actuel : si la config
 * du field a changé depuis (ex. `maxLength` réduit), on renvoie 422 pour
 * forcer un correctif manuel.
 *
 * Cf. docs/components-cms/backend/01-api-routes.md §B1.6.
 */
import { NextResponse } from 'next/server';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  auditFieldChange,
  requireAdminApi,
  requireComponentAndField,
} from '@/lib/components/fields/route-helpers';
import {
  getHistoryById,
  NotFoundError,
  restoreFromHistory,
} from '@/lib/db/queries/component-fields';
import { fieldRestoreSchema } from '@/lib/schemas/admin/component-fields';
import { validateFieldValue } from '@/lib/components/fields/validators';
import { decodeValue, encodeValue } from '@/lib/components/fields/encoding';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface Ctx {
  params: { key: string; fieldKey: string };
}

export async function POST(request: Request, ctx: Ctx): Promise<Response> {
  try {
    const session = await requireAdminApi();
    const { component, field } = await requireComponentAndField(
      ctx.params.key,
      ctx.params.fieldKey,
    );
    const url = new URL(request.url);
    const locale = url.searchParams.get('locale') ?? 'fr';

    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = fieldRestoreSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Payload invalide', parsed.error.flatten());
    }

    // On vérifie d'abord la cohérence du snapshot, puis on revalide la
    // valeur — si la config a évolué entre temps, on bloque la restauration.
    const snapshot = await getHistoryById(parsed.data.historyId);
    if (!snapshot) throw new HttpError('not_found', 'Entrée d’historique introuvable');
    if (
      snapshot.componentId !== component.id ||
      snapshot.fieldKey !== field.key ||
      snapshot.locale !== locale
    ) {
      throw new HttpError(
        'invalid_input',
        'L’entrée d’historique ne correspond pas au champ ciblé.',
      );
    }
    // Re-validation de la valeur historique avec la config actuelle. On
    // s'assure d'abord que la valeur stockée est bien sous sa forme encodée
    // (les snapshots des seeds le sont toujours), pour matcher le schéma.
    const decoded = decodeValue(snapshot.value, field.type);
    const reEncoded = encodeValue(decoded, field.type);
    const validated = validateFieldValue(field, reEncoded);
    if (!validated.ok) {
      throw new HttpError(
        'validation_failed',
        'Cette version est incompatible avec la config actuelle du champ.',
        { issues: validated.errors },
      );
    }

    try {
      const binding = await restoreFromHistory({
        componentId: component.id,
        fieldKey: field.key,
        locale,
        historyId: parsed.data.historyId,
        actorId: session.adminId,
      });
      await auditFieldChange({
        action: 'field.restore',
        actorId: session.adminId,
        componentKey: component.key,
        fieldKey: field.key,
        bindingId: binding.id,
        meta: { locale, fromVersion: snapshot.version, fromHistoryId: snapshot.id },
      });
      return NextResponse.json({
        binding,
        restoredFromVersion: snapshot.version,
      });
    } catch (err) {
      if (err instanceof NotFoundError) throw new HttpError('not_found', err.message);
      throw err;
    }
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
