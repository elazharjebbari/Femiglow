/**
 * CHA-110b — Édition d'une version d'instruction (FR / AR / Darija).
 *
 * Page server : auth + chargement de la version + montage de l'éditeur
 * client. L'éditeur poste vers `/api/admin/chat/instructions/[id]` qui
 * redirige ici-même avec `?ok=saved` ou `?err=...`.
 */
import { notFound } from 'next/navigation';

import { AdminShell } from '@/components/admin/AdminShell';
import { ChatAdminNav } from '@/components/admin/chat/ChatAdminNav';
import { InstructionEditor } from '@/components/admin/chat/InstructionEditor';
import { instructionRepo } from '@/lib/chat/repos/instruction';
import { requireAdmin } from '@/lib/auth/require-admin';

export const dynamic = 'force-dynamic';

export default async function EditInstructionPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { ok?: string; err?: string };
}) {
  const session = await requireAdmin(`/admin/chat/instructions/${params.id}`);
  const row = await instructionRepo.getById(params.id).catch(() => null);
  if (!row) notFound();

  return (
    <AdminShell adminEmail={session.email} active="chat">
      <ChatAdminNav active="instructions" />

      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
            Instruction v{row.version}
            {row.enabled && (
              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 align-middle text-xs font-normal text-emerald-700">
                active
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Édition in-place du prompt système. Pour repartir d'une base
            saine, dupliquer cette version puis activer la nouvelle.
          </p>
        </div>
        <a
          href="/admin/chat/instructions"
          className="text-sm text-stone-500 underline-offset-2 hover:underline"
        >
          ← Retour à la liste
        </a>
      </header>

      <InstructionEditor
        row={{
          id: row.id,
          version: row.version,
          scope: row.scope,
          body: row.body,
          bodyAr: row.bodyAr,
          bodyArMa: row.bodyArMa,
          notes: row.notes,
          enabled: row.enabled,
          createdBy: row.createdBy,
          createdAt: row.createdAt.toISOString(),
        }}
        flash={{
          ok: searchParams?.ok,
          err: searchParams?.err,
        }}
      />
    </AdminShell>
  );
}
