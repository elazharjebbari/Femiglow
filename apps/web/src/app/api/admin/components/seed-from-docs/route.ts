/**
 * POST /api/admin/components/seed-from-docs
 *   Lance le pipeline de seed depuis `docs/images/values/`. Long (~30s à 5min).
 *
 *   Body : { autoActivate?, force?, forceAlt?, filterPageGroup?, dryRun? }
 *
 *   Réponse : NDJSON streamé (`application/x-ndjson`).
 *     Chaque ligne est un événement JSON :
 *       { type: 'phase', phase, total, message }
 *       { type: 'item', phase, current, total, item, status, message? }
 *       { type: 'done', report }       (terminal — succès)
 *       { type: 'error', error }       (terminal — échec global)
 *
 *   Côté client : lire ligne par ligne via `ReadableStream` (cf.
 *   `SeedRunnerForm` qui affiche barre de progression + état final).
 */
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { checkRateLimit } from '@/lib/rate-limit/check';
import { seedFromDocs, type SeedProgressEvent } from '@/lib/components/seed-pipeline';
import { seedFromDocsSchema } from '@/lib/schemas/admin/components';
import { auditTrackingChange } from '@/lib/tracking/server/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: Request): Promise<Response> {
  // --- Garde-fous synchrones (auth, rate-limit, payload) — si un échec se
  // produit ici, on renvoie une erreur JSON classique (pas de stream).
  let session;
  try {
    session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rate = await checkRateLimit({
      key: `seed-components:${ip}`,
      limit: 3,
      windowMs: 60 * 5 * 1000,
    });
    if (!rate.ok) throw new HttpError('rate_limited', 'Trop de requêtes — patientez');
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  let parsed;
  try {
    const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    parsed = seedFromDocsSchema.safeParse(json);
    if (!parsed.success)
      throw new HttpError('invalid_input', 'Payload invalide', parsed.error.flatten());
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const data = parsed.data;
  const adminId = session.adminId;
  const encoder = new TextEncoder();

  // --- Stream NDJSON. On capture les événements de progression émis par le
  // pipeline et on les sérialise ligne par ligne. À la fin, on envoie soit
  // `{type:'done', report}`, soit `{type:'error', error}`.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const writeLine = (obj: unknown): void => {
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
        } catch {
          // Le client a fermé la connexion : on laisse le pipeline finir,
          // mais on n'enqueue plus rien.
        }
      };

      const onProgress = (event: SeedProgressEvent): void => {
        writeLine(event);
      };

      try {
        const report = await seedFromDocs({
          ...data,
          actorId: adminId,
          onProgress,
        });

        // Audit + revalidation seulement si pas dry-run.
        if (!data.dryRun) {
          await auditTrackingChange({
            action: 'seed',
            resource: 'site_component',
            actorId: adminId,
            meta: {
              seeded: report.images.seeded,
              skipped: report.images.skipped,
              activated: report.images.activated,
              errors: report.images.errors.length,
              durationMs: report.durationMs,
            },
          });
          revalidateTag('components');
        }

        writeLine({ type: 'done', report });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        writeLine({ type: 'error', error: message });
      } finally {
        try {
          controller.close();
        } catch {
          /* déjà fermé */
        }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      // Désactive la mise en buffer côté proxy (Vercel/nginx) pour que
      // chaque ligne arrive immédiatement au client.
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
    },
  });
}
