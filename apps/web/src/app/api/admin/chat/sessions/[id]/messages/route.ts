/**
 * CHA-229 — Admin lookup léger des messages d'une session de chat.
 *
 * Pourquoi cette route :
 *   Le backoffice `/admin/leads` et `/admin/chat/leads` doit pouvoir
 *   ouvrir une **fenêtre rapide** sur la conversation rattachée à un
 *   lead, sans naviguer vers la page de détail full-fat
 *   `/admin/chat/conversations/[id]` (qui charge les events, les
 *   sources RAG, etc.). Une popup admin doit rester rapide à ouvrir
 *   et zéro friction côté lecture.
 *
 * Garanties :
 *   - Auth admin obligatoire (`requireAdminApi`) — 401 sinon.
 *   - Payload **léger** (pas de RAG, pas de moderation, pas de coûts) :
 *     uniquement `id, role, content, language, status, createdAt,
 *     latencyMs, modelName`. Cela suffit pour reconstituer la
 *     conversation dans une modale.
 *   - Cap dur à 200 messages (alignement avec
 *     `messageRepo.listBySession` côté admin existant). Une session
 *     plus longue est exceptionnelle ; on renvoie les 200 plus récents.
 *   - 404 si la session est introuvable (évite de leaker l'existence
 *     d'IDs en sondant).
 *
 * Réponse :
 *   {
 *     session: { id, language, status, openedAt },
 *     messages: AdminConversationMessage[]
 *   }
 *
 * cf. docs/chat-assistant/19-lead-capture-form.md §7 (« QuickView lead-conversation »).
 */
import { NextResponse, type NextRequest } from 'next/server';

import { requireAdminApi } from '@/lib/chat/admin/auth';
import { messageRepo } from '@/lib/chat/repos/message';
import { sessionRepo } from '@/lib/chat/repos/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Forme publique d'un message côté QuickView admin. */
export interface AdminConversationMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  language: string | null;
  status: 'pending' | 'streaming' | 'sent' | 'error' | 'deleted';
  createdAt: string;
  latencyMs: number | null;
  modelName: string | null;
}

export interface AdminConversationPayload {
  session: {
    id: string;
    language: string;
    status: string;
    openedAt: string;
  };
  messages: AdminConversationMessage[];
}

const MAX_MESSAGES = 200;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const session = await sessionRepo.getById(params.id);
  if (!session) {
    return NextResponse.json({ error: 'not-found' }, { status: 404 });
  }

  const rows = await messageRepo.listBySession(session.id, MAX_MESSAGES);
  const messages: AdminConversationMessage[] = rows.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    language: m.language,
    status: m.status,
    createdAt: m.createdAt.toISOString(),
    latencyMs: m.latencyMs,
    modelName: m.modelName,
  }));

  const payload: AdminConversationPayload = {
    session: {
      id: session.id,
      language: session.language,
      status: session.status,
      openedAt: session.openedAt.toISOString(),
    },
    messages,
  };
  return NextResponse.json(payload);
}
