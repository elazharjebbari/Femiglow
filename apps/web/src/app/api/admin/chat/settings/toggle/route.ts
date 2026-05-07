/**
 * CHA-104 — Toggle runtime du module chat (admin).
 *
 * Form-encoded `enabled=true|false`. Met à jour `chat_runtime_setting`
 * et invalide le cache `chat-config`. Si `CHAT_ENABLED` est `false` côté
 * env, le toggle est inopérant : `isChatActive()` retournera toujours
 * `false`. C'est intentionnel (kill switch ultime).
 */
import { NextResponse, type NextRequest } from 'next/server';

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { setChatActive } from '@/lib/chat/runtime-setting';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const ct = req.headers.get('content-type') ?? '';
  let enabledRaw: unknown;
  if (ct.includes('application/json')) {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    enabledRaw = body.enabled;
  } else {
    const form = await req.formData();
    enabledRaw = form.get('enabled');
  }

  const enabled = enabledRaw === true || enabledRaw === 'true';
  await setChatActive(enabled, auth.email);

  logger.info('chat.admin.toggle', { enabled, by: auth.email });

  if (ct.includes('application/json')) {
    return NextResponse.json({ enabled });
  }
  return NextResponse.redirect(new URL('/admin/chat', req.url), 303);
}
