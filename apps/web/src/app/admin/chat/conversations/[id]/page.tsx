/**
 * CHA-107 — Détail d'une conversation : messages + sources + actions.
 */
import { notFound } from 'next/navigation';

import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { messageRepo } from '@/lib/chat/repos/message';
import { sessionRepo } from '@/lib/chat/repos/session';
import { eventRepo } from '@/lib/chat/repos/event';
import { isChatEnabled } from '@/lib/chat/feature-flag';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

export default async function ChatConversationDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireAdmin(`/admin/chat/conversations/${params.id}`);
  if (!isChatEnabled()) notFound();

  const conv = await sessionRepo.getById(params.id);
  if (!conv) notFound();

  const [messages, events] = await Promise.all([
    messageRepo.listBySession(conv.id, 200),
    eventRepo.listBySession(conv.id),
  ]);

  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="conversations" />
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">Session {conv.id}</h1>
        <p className="text-sm text-stone-600">
          {conv.language.toUpperCase()} · {conv.status} · ouverte le{' '}
          {conv.openedAt.toISOString().slice(0, 16).replace('T', ' ')}
        </p>
      </header>

      <section
        aria-label="Messages"
        className="mb-8 max-h-[600px] space-y-3 overflow-y-auto rounded-md border border-stone-200 bg-white p-4"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`rounded-lg px-3 py-2 text-sm ${
              m.role === 'user'
                ? 'ml-auto max-w-[80%] bg-stone-900 text-white'
                : 'mr-auto max-w-[80%] bg-stone-100 text-stone-900'
            }`}
          >
            <div className="mb-1 text-xs uppercase opacity-70">
              {m.role}
              {m.modelName ? ` · ${m.modelName}` : ''}
              {m.latencyMs ? ` · ${m.latencyMs} ms` : ''}
            </div>
            <div className="whitespace-pre-wrap">{m.content}</div>
            {m.ragHits && m.ragHits.length > 0 && (
              <div className="mt-2 text-xs opacity-70">
                Sources : {m.ragHits.length}
              </div>
            )}
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-center text-sm text-stone-500">Aucun message.</p>
        )}
      </section>

      <section aria-label="Événements" className="rounded-md border border-stone-200 bg-white">
        <h2 className="border-b border-stone-200 px-4 py-2 text-sm font-medium">
          Journal d'événements
        </h2>
        <ul className="max-h-64 divide-y divide-stone-100 overflow-y-auto text-xs">
          {events.map((e) => (
            <li key={e.id} className="flex justify-between gap-4 px-4 py-1.5">
              <span className="font-mono">{e.type}</span>
              <span className="text-stone-500">
                {e.occurredAt.toISOString().slice(11, 19)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </AdminShell>
  );
}
