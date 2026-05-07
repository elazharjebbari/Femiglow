/**
 * GET  /api/admin/products → liste paginée
 * POST /api/admin/products → créer fiche (status='draft')
 */
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/auth/require-admin';
import { formatErrorResponse, HttpError } from '@/lib/errors/http-error';
import { logAuditEvent } from '@/lib/audit/log-event';
import {
  createProduct,
  getProductBySlug,
  listProducts,
} from '@/lib/db/queries/products';
import { productCreateSchema } from '@/lib/products/schemas';
import { PRODUCTS_TAG } from '@/lib/products/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const listQuerySchema = z.object({
  status: z.enum(['draft', 'published', 'archived', 'all']).optional(),
  category: z.string().optional(),
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  sort: z.enum(['updated_at', 'title', 'position']).optional(),
});

export async function GET(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    const url = new URL(request.url);
    const parsed = listQuerySchema.safeParse(Object.fromEntries(url.searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'validation_failed',
            message: 'Query invalide.',
            details: parsed.error.issues,
          },
        },
        { status: 422 },
      );
    }
    const result = await listProducts({
      status: parsed.data.status as never,
      category: parsed.data.category,
      q: parsed.data.q,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      sort: parsed.data.sort,
    });
    return NextResponse.json(result);
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await getAdminSession();
    if (!session) throw new HttpError('unauthorized', 'Session requise');
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError('invalid_input', 'JSON invalide.');
    }
    const parsed = productCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: 'validation_failed',
            message: 'Body invalide.',
            details: parsed.error.issues,
          },
        },
        { status: 422 },
      );
    }
    const existing = await getProductBySlug(parsed.data.slug);
    if (existing) {
      return NextResponse.json(
        { error: { code: 'slug_conflict', message: 'Slug déjà utilisé.' } },
        { status: 409 },
      );
    }
    const product = await createProduct({
      slug: parsed.data.slug,
      title: parsed.data.title,
      category: parsed.data.category,
      actorId: session.adminId,
    });
    revalidateTag(PRODUCTS_TAG);
    await logAuditEvent({
      action: 'product.create',
      actorId: session.adminId,
      resourceType: 'product',
      resourceId: product.id,
      meta: { slug: product.slug, title: product.title },
    });
    return NextResponse.json({ product }, { status: 201 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
