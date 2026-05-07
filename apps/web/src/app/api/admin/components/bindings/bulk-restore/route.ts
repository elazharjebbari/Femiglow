/**
 * POST /api/admin/components/bindings/bulk-restore
 *
 * Restore-snapshot bulk (P11 / R5 / I6 Option B). Permet de restaurer
 * plusieurs versions historiques en une seule requête (ex. revenir à
 * un état complet d'un composant après une release malheureuse).
 *
 * Body : `{ items: [{ componentKey, fieldKey, locale?, historyId }, ...] }`
 *   1..50 items.
 *
 * Réponse 207 (multi-status simulé) :
 *   { results: [{ componentKey, fieldKey, ok, bindingId?, error? }, ...] }
 *
 * Sécurité :
 *   - admin session requise,
 *   - rate-limit 10 / 5 min / IP (opération sensible),
 *   - chaque item est revalidé avec la config courante (comme /restore),
 *     un échec individuel n'aborte pas le batch.
 *
 * Cf. docs/components-cms/action-plan/01-phases.md §P11.
 */
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { z } from 'zod';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import {
  auditFieldChange,
  requireAdminApi,
} from '@/lib/components/fields/route-helpers';
import { checkRateLimit } from '@/lib/rate-limit/check';
import { getSiteComponentByKey } from '@/lib/db/queries/site-components';
import {
  getHistoryById,
  restoreFromHistory,
} from '@/lib/db/queries/component-fields';
import { decodeValue, encodeValue } from '@/lib/components/fields/encoding';
import { validateFieldValue } from '@/lib/components/fields/validators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const itemSchema = z.object({
  componentKey: z.string().min(1).max(80),
  fieldKey: z.string().min(1).max(80),
  locale: z.string().min(2).max(10).optional(),
  historyId: z.string().min(1).max(80),
});

const bulkRestoreSchema = z.object({
  items: z.array(itemSchema).min(1).max(50),
});

interface ItemResult {
  componentKey: string;
  fieldKey: string;
  historyId: string;
  ok: boolean;
  bindingId?: string;
  error?: string;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireAdminApi();

    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rate = await checkRateLimit({
      key: `bulk-restore:${ip}`,
      limit: 10,
      windowMs: 60 * 5 * 1000,
    });
    if (!rate.ok) throw new HttpError('rate_limited', 'Trop de requêtes');

    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = bulkRestoreSchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError('invalid_input', 'Payload invalide', parsed.error.flatten());
    }

    const results: ItemResult[] = [];
    let successCount = 0;

    for (const item of parsed.data.items) {
      const locale = item.locale ?? 'fr';
      const base: ItemResult = {
        componentKey: item.componentKey,
        fieldKey: item.fieldKey,
        historyId: item.historyId,
        ok: false,
      };

      try {
        const component = await getSiteComponentByKey(item.componentKey);
        if (!component) {
          base.error = 'Composant introuvable';
          results.push(base);
          continue;
        }
        const fieldDef = (component.fields ?? []).find((f) => f.key === item.fieldKey);
        if (!fieldDef) {
          base.error = `Champ '${item.fieldKey}' introuvable`;
          results.push(base);
          continue;
        }

        const snapshot = await getHistoryById(item.historyId);
        if (!snapshot) {
          base.error = 'Entrée d’historique introuvable';
          results.push(base);
          continue;
        }
        if (
          snapshot.componentId !== component.id ||
          snapshot.fieldKey !== fieldDef.key ||
          snapshot.locale !== locale
        ) {
          base.error = 'L’entrée d’historique ne correspond pas au champ ciblé';
          results.push(base);
          continue;
        }

        const decoded = decodeValue(snapshot.value, fieldDef.type);
        const reEncoded = encodeValue(decoded, fieldDef.type);
        const validated = validateFieldValue(fieldDef, reEncoded);
        if (!validated.ok) {
          base.error = 'Cette version est incompatible avec la config actuelle';
          results.push(base);
          continue;
        }

        const binding = await restoreFromHistory({
          componentId: component.id,
          fieldKey: fieldDef.key,
          locale,
          historyId: item.historyId,
          actorId: session.adminId,
        });
        await auditFieldChange({
          action: 'field.restore',
          actorId: session.adminId,
          componentKey: component.key,
          fieldKey: fieldDef.key,
          bindingId: binding.id,
          meta: {
            locale,
            fromVersion: snapshot.version,
            fromHistoryId: snapshot.id,
            bulk: true,
          },
        });
        base.ok = true;
        base.bindingId = binding.id;
        results.push(base);
        successCount++;
      } catch (err) {
        base.error = err instanceof Error ? err.message : 'Erreur inconnue';
        results.push(base);
      }
    }

    if (successCount > 0) revalidateTag('components');

    return NextResponse.json(
      {
        results,
        summary: {
          total: results.length,
          ok: successCount,
          failed: results.length - successCount,
        },
      },
      { status: 207 },
    );
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
