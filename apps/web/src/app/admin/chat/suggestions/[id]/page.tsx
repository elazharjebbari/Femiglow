/**
 * CHA-300 — Page admin : édition d'une suggestion canned-pair.
 */
import { notFound } from 'next/navigation';

import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { SuggestionForm } from '@/components/admin/chat/SuggestionForm';
import { cannedPairRepo } from '@/lib/chat/repos/canned-pair';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

export default async function EditSuggestionPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireAdmin(`/admin/chat/suggestions/${params.id}`);
  const row = await cannedPairRepo.getById(params.id);
  if (!row) notFound();

  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="suggestions" />
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Modifier la suggestion</h1>
          <p className="text-sm text-stone-600 font-mono">{row.key}</p>
        </div>
        <a
          href="/admin/chat/suggestions"
          className="text-sm text-stone-500 underline"
        >
          ← Retour à la liste
        </a>
      </header>
      <SuggestionForm
        initial={{
          id: row.id,
          key: row.key,
          pagePattern: row.pagePattern,
          audience: row.audience,
          order: row.order,
          enabled: row.enabled,
          labelFr: row.labelFr,
          labelAr: row.labelAr,
          labelArMa: row.labelArMa,
          scriptedReplyFr: row.scriptedReplyFr,
          scriptedReplyAr: row.scriptedReplyAr,
          scriptedReplyArMa: row.scriptedReplyArMa,
          ctaLabel: row.ctaLabel ?? '',
          ctaUrl: row.ctaUrl ?? '',
          allowFollowupLlm: row.allowFollowupLlm,
          status: row.status,
        }}
      />
    </AdminShell>
  );
}
