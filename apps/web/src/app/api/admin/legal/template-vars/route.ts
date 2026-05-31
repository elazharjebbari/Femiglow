import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logLegalEvent } from '@/lib/legal/audit';
import { LEGAL_PUBLISHED_TAG, LEGAL_VARS_TAG } from '@/lib/legal/cache-tags';
import { requireSameOrigin } from '@/lib/legal/csrf';
import { listAllTemplateVars, updateTemplateVar } from '@/lib/legal/repository';
import { createTemplateVar } from '@/lib/legal/template-vars-helpers';
import { legalTemplateVarKeySchema } from '@/lib/legal/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const putBodySchema = z.object({
  key: legalTemplateVarKeySchema,
  value: z.string().max(1000).nullable(),
});

export async function GET(): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');

    const vars = await listAllTemplateVars();
    return NextResponse.json(
      vars.map((v) => ({
        key: v.key,
        label: v.label,
        description: v.description,
        value: v.sensitive ? maskValue(v.value) : v.value,
        is_required: v.isRequired,
        sensitive: v.sensitive,
        updated_at: v.updatedAt,
      })),
    );
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function PUT(request: Request): Promise<Response> {
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
    const parsed = putBodySchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'validation_failed',
            message: 'Payload invalide',
            details: parsed.error.issues,
          },
        },
        { status: 422 },
      );
    }

    const updated = await updateTemplateVar(parsed.data.key, parsed.data.value, session.adminId);
    if (!updated) throw new HttpError('not_found', 'Variable inconnue');

    await logLegalEvent('legal.template-var.updated', session.adminId, updated.key, {
      key: updated.key,
      had_value: parsed.data.value !== null && parsed.data.value.length > 0,
    });

    revalidatePath('/sitemap.xml');
    // Une variable touchée peut être référencée dans n'importe quelle page
    // publiée → on flush global + tag dédié vars (consommé par la pipeline
    // de rendu legal côté serveur).
    revalidateTag(LEGAL_VARS_TAG);
    revalidateTag(LEGAL_PUBLISHED_TAG);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

function maskValue(value: string | null): string | null {
  if (!value) return value;
  if (value.length <= 4) return '****';
  return `${value.slice(0, 2)}****${value.slice(-2)}`;
}

// ----------------------------------------------------------------------------
// LEGAL-V2 — POST create new template var
// ----------------------------------------------------------------------------

const postBodySchema = z.object({
  key: z.string().regex(/^[A-Z][A-Z0-9_]*$/, 'Format UPPER_SNAKE_CASE requis')
    .min(2).max(40),
  label: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  value: z.string().max(1000).default(''),
  isRequired: z.boolean().default(false),
  sensitive: z.boolean().default(false),
});

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
    const parsed = postBodySchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'validation_failed',
            message: 'Payload invalide',
            details: parsed.error.issues,
          },
        },
        { status: 422 },
      );
    }

    const result = await createTemplateVar(parsed.data, session.adminId);
    if (!result.ok) {
      if (result.code === 'conflict_key_exists') {
        return NextResponse.json(
          { error: { code: 'conflict_key_exists', message: `Variable "${parsed.data.key}" existe déjà` } },
          { status: 409 },
        );
      }
      return NextResponse.json(
        { error: { code: result.code, message: 'Clé invalide' } },
        { status: 400 },
      );
    }

    await logLegalEvent('legal.template-var.created', session.adminId, result.row.key, {
      key: result.row.key,
      is_required: result.row.isRequired,
      sensitive: result.row.sensitive,
    });

    revalidateTag(LEGAL_VARS_TAG);
    return NextResponse.json(
      {
        key: result.row.key,
        label: result.row.label,
        description: result.row.description,
        value: result.row.sensitive ? maskValue(result.row.value) : result.row.value,
        is_required: result.row.isRequired,
        sensitive: result.row.sensitive,
        updated_at: result.row.updatedAt,
      },
      { status: 201 },
    );
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
