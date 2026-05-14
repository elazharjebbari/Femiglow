/**
 * CHA-303 — Édition d'une FAQ existante. Lit la ligne via `faqRepo`
 * (vecteur exclu pour ne pas le sérialiser dans le HTML) puis monte le
 * formulaire. Le PATCH passe par `POST /api/admin/chat/faq/[id]`
 * (form-encoded → redirect 303).
 */
import { notFound } from 'next/navigation';

import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { FaqForm } from '@/components/admin/chat/FaqForm';
import { faqRepo } from '@/lib/chat/repos/faq';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

export default async function EditFaqPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireAdmin(`/admin/chat/faq/${params.id}`);
  const row = await faqRepo.getById(params.id);
  if (!row) notFound();

  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="faq" />
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          FAQ · <span className="font-mono text-stone-600">{row.key}</span>
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Dernière mise à jour : {row.updatedAt.toISOString().slice(0, 16).replace('T', ' ')}
        </p>
      </header>
      <FaqForm
        initial={{
          id: row.id,
          key: row.key,
          language: row.language,
          questionCanonical: row.questionCanonical,
          scriptedReply: row.scriptedReply,
          intentHint: row.intentHint ?? '',
          threshold: Number(row.threshold),
          audience: row.audience,
          enabled: row.enabled,
        }}
      />
    </AdminShell>
  );
}
