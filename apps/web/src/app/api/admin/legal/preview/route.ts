import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { requireSameOrigin } from '@/lib/legal/csrf';
import { renderLegalMarkdown } from '@/lib/legal/render';
import { listAllTemplateVars } from '@/lib/legal/repository';
import { buildVarMap } from '@/lib/legal/vars';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  bodyMd: z.string().max(200_000),
  mode: z.enum(['public', 'admin-preview']).optional(),
});

/**
 * POST /api/admin/legal/preview — rend un MD via le VRAI pipeline serveur
 * (unified + sanitize + variables) pour que l'éditeur admin affiche un
 * aperçu fiable au lieu du parseur client simplifié.
 *
 * Pas de side effect, mais nécessite session admin + Origin OK + rate limit
 * léger (auto-applied via le pattern admin habituel).
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    requireSameOrigin(request);

    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = bodySchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: 'invalid_input', message: 'Payload invalide' } },
        { status: 400 },
      );
    }

    const vars = await listAllTemplateVars().catch(() => []);
    const map = buildVarMap(
      vars.map((v) => ({ key: v.key, value: v.value })),
      { mode: parsed.data.mode },
    );
    const { html, headings, varsUsed } = await renderLegalMarkdown(parsed.data.bodyMd, {
      mode: parsed.data.mode ?? 'admin-preview',
      variables: map,
    });

    return NextResponse.json({ html, headings, varsUsed });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
