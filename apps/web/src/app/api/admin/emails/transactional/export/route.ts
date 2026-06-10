/**
 * POST /api/admin/emails/transactional/export — export CSV SERVEUR (CKPT-01).
 *
 * Couvre l'ENSEMBLE du filtre (pas seulement la page affichée) :
 *  - réutilise `buildWhere` de search.ts (interdiction de dupliquer le
 *    compilateur — même ensemble que /search pour le même filtre) ;
 *  - stream `ReadableStream` chunké : jamais 100 000 lignes en mémoire ;
 *  - keyset (created_at, id) : stable sous insertions concurrentes ;
 *  - BOM UTF-8 + RFC 4180 (csv.ts, dialecte partagé avec l'export client) ;
 *  - cap 100 000 lignes — le dépassement est détecté par un COUNT BORNÉ
 *    AVANT le stream pour être annoncé en EN-TÊTE `X-Export-Capped` (impossible
 *    de poser un header après le début du flux) ;
 *  - audit `mail.outbox.export` { actor, filters_count, rows_streamed, capped }.
 */
import { getAdminSession } from '@/lib/auth/require-admin';
import { logAuditEvent } from '@/lib/audit/log-event';
import { logger } from '@/lib/logging/logger';
import { ExportInputSchema } from '@/lib/mail/transactional/schemas';
import {
  countOutboxBounded,
  iterateOutboxForExport,
  EXPORT_MAX_ROWS,
} from '@/lib/mail/transactional/search';
import { CSV_BOM, CSV_EOL, CSV_HEADERS, csvFilename, csvLine } from '@/lib/mail/transactional/csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const session = await getAdminSession();
  if (!session) {
    return Response.json({ error: 'Non autorisé' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Corps JSON invalide' }, { status: 422 });
  }
  const parsed = ExportInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation échouée', issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const input = parsed.data;

  // Cap détecté AVANT le flux (count borné à cap+1 — jamais de COUNT plein).
  const bounded = await countOutboxBounded(input, EXPORT_MAX_ROWS + 1);
  const capped = bounded > EXPORT_MAX_ROWS;

  const encoder = new TextEncoder();
  const actorId = session.adminId ?? session.email;
  const filtersCount = input.filters.length + (input.freetext ? 1 : 0);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let streamed = 0;
      try {
        controller.enqueue(encoder.encode(`${CSV_BOM}${CSV_HEADERS.join(',')}${CSV_EOL}`));
        const gen = iterateOutboxForExport(input, { maxRows: EXPORT_MAX_ROWS });
        for (;;) {
          const step = await gen.next();
          if (step.done) {
            streamed = step.value.streamed;
            break;
          }
          controller.enqueue(
            encoder.encode(step.value.map((r) => csvLine(r)).join(CSV_EOL) + CSV_EOL),
          );
        }
        await logAuditEvent({
          action: 'mail.outbox.export',
          actorId,
          resourceType: 'email_outbox',
          meta: { filters_count: filtersCount, rows_streamed: streamed, capped },
        });
        controller.close();
      } catch (err) {
        // Échec en plein flux : on TERMINE le stream en erreur (le client voit
        // un téléchargement avorté, jamais un CSV silencieusement tronqué).
        logger.error('admin.emails.transactional.export_failed', { error: String(err) });
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${csvFilename()}"`,
      'cache-control': 'no-store',
      'x-export-capped': capped ? 'true' : 'false',
    },
  });
}
