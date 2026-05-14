/**
 * CHA-111 — Activation d'une version d'instruction.
 */
import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

import { instructionRepo } from '@/lib/chat/repos/instruction';
import { requireAdminApi } from '@/lib/chat/admin/auth';
import { logger } from '@/lib/logging/logger';
import { redirectToPublic } from '@/lib/http/redirect-public';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const row = await instructionRepo.activate(params.id);
  if (!row) return NextResponse.json({ error: 'not-found' }, { status: 404 });
  revalidateTag('chat-config');
  logger.info('chat.admin.instruction.activated', {
    id: row.id,
    by: auth.email,
  });
  const ct = req.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    return NextResponse.json({ ok: true });
  }
  return redirectToPublic(req, '/admin/chat/instructions');
}
