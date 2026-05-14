/**
 * CHA-123 — Routes admin: instructions (POST = create, GET = list).
 *
 * Form encoded ou JSON. Crée une nouvelle version puis redirige vers
 * la page liste. L'activation est sur une route distincte.
 */
import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

import { adminInstructionInput } from '@/lib/chat/contracts';
import { instructionRepo } from '@/lib/chat/repos/instruction';
import { requireAdminApi } from '@/lib/chat/admin/auth';
import { logger } from '@/lib/logging/logger';
import { redirectToPublic } from '@/lib/http/redirect-public';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const list = await instructionRepo.listByScope('default');
  return NextResponse.json({ versions: list });
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
  }
  const parsed = adminInstructionInput.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid-input', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const created = await instructionRepo.create({
    scope: parsed.data.scope,
    body: parsed.data.body,
    bodyAr: parsed.data.bodyAr ?? null,
    bodyArMa: parsed.data.bodyArMa ?? null,
    notes: parsed.data.notes ?? null,
    createdBy: auth.email,
  });
  revalidateTag('chat-config');
  logger.info('chat.admin.instruction.created', {
    id: created.id,
    by: auth.email,
  });

  if (ct.includes('application/json')) {
    return NextResponse.json({ id: created.id, version: created.version });
  }
  return redirectToPublic(req, '/admin/chat/instructions');
}
