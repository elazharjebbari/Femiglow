/**
 * CHA-123 — Routes admin: sources (POST = create + ingest, GET = list).
 *
 * À l'arrivée d'un POST, on lance l'ingestion synchrone (split + embed
 * + insert). Pour des sources volumineuses (PDF), basculer sur job
 * queue (V2).
 */
import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

import { adminSourceInput } from '@/lib/chat/contracts';
import { ragService, type RagSourceKind } from '@/lib/chat/rag/service';
import { adminQueries } from '@/lib/chat/admin/queries';
import { requireAdminApi } from '@/lib/chat/admin/auth';
import { logger } from '@/lib/logging/logger';
import { redirectToPublic } from '@/lib/http/redirect-public';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  return NextResponse.json({ sources: await adminQueries.listSources() });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const ct = req.headers.get('content-type') ?? '';
  let payload: Record<string, unknown> = {};
  if (ct.includes('application/json')) {
    payload = (await req.json()) as Record<string, unknown>;
  } else {
    const form = await req.formData();
    for (const [k, v] of form.entries()) {
      if (typeof v === 'string') payload[k] = v;
    }
    if (typeof payload.tags === 'string') {
      payload.tags = (payload.tags as string)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else {
      payload.tags = [];
    }
  }
  const parsed = adminSourceInput.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid-input', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await ragService.ingest({
      kind: parsed.data.kind as RagSourceKind,
      label: parsed.data.label,
      language: parsed.data.language,
      audience: parsed.data.audience,
      freshness: parsed.data.freshness,
      tags: parsed.data.tags,
      locator: parsed.data.locator,
      body: parsed.data.body,
      createdBy: auth.email,
    });
    revalidateTag('chat-config');
    logger.info('chat.admin.source.ingested', {
      sourceId: result.sourceId,
      chunkCount: result.chunkCount,
      reused: result.reused,
      by: auth.email,
    });
    if (ct.includes('application/json')) {
      return NextResponse.json(result);
    }
    return redirectToPublic(req, '/admin/chat/sources');
  } catch (err) {
    logger.error('chat.admin.source.ingest_failed', {
      message: (err as Error).message,
    });
    return NextResponse.json(
      { error: 'ingest-failed', message: (err as Error).message },
      { status: 500 },
    );
  }
}
