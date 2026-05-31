/**
 * Admin: suppression d'un provider chat.
 *
 * - `DELETE /api/admin/chat/providers/[id]` — appel direct (fetch côté
 *   client ou outil admin).
 * - `POST   /api/admin/chat/providers/[id]` — variante form-encoded pour
 *   permettre une suppression via `<form method="post">` (pas de JS
 *   requis depuis la page admin).
 *
 * Le `providerRepo.delete` met `chat_message.provider_id` à NULL pour
 * les messages référençant le provider, puis supprime la ligne — tout
 * en transaction. On invalide ensuite le tag `chat-config` pour que
 * l'orchestrateur recharge la liste des providers actifs.
 */
import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { providerRepo } from '@/lib/chat/repos/provider';
import { logger } from '@/lib/logging/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function deleteProvider(
  req: NextRequest,
  id: string,
  source: 'DELETE' | 'POST',
): Promise<Response> {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const result = await providerRepo.delete(id).catch((err: Error) => {
    logger.error('chat.admin.provider.delete_failed', {
      id,
      error: err.message,
      by: auth.email,
    });
    return undefined;
  });

  if (result === undefined) {
    return NextResponse.json({ error: 'delete-failed' }, { status: 500 });
  }
  if (result === null) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }

  revalidateTag('chat-config');
  logger.info('chat.admin.provider.deleted', {
    id,
    messagesNulled: result.messagesNulled,
    by: auth.email,
  });

  // Form POST → redirect vers la liste avec un flash code.
  if (source === 'POST') {
    return NextResponse.redirect(
      new URL('/admin/chat/providers?ok=deleted', req.url),
      303,
    );
  }
  return NextResponse.json({ ok: true, ...result });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  return deleteProvider(req, params.id, 'DELETE');
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<Response> {
  return deleteProvider(req, params.id, 'POST');
}
