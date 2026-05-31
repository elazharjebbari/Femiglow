/**
 * /admin/emails/templates — Liste des templates HTML custom (M5.7.6).
 */
import Link from 'next/link';
import { desc, isNull } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { db as getDb } from '@/lib/db/client';
import { emailTemplateCustom } from '@/lib/db/schema-emails';

export const dynamic = 'force-dynamic';

async function load() {
  const drizzle = getDb();
  if (!drizzle) return [];
  return drizzle
    .select()
    .from(emailTemplateCustom)
    .where(isNull(emailTemplateCustom.deletedAt))
    .orderBy(desc(emailTemplateCustom.updatedAt));
}

export default async function TemplatesPage() {
  const session = await requireAdmin('/admin/emails/templates');
  const templates = await load();

  return (
    <AdminShell adminEmail={session.email} active="emails">
      <header className="mb-6 flex items-start justify-between">
        <div>
          <Link href="/admin/emails" className="text-sm text-stone-500 underline">
            ← Dashboard emails
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">
            Templates HTML
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Templates personnalisés (Handlebars). Versionnés, prévisualisables avec
            contexte lead réel.
          </p>
        </div>
        <Link
          href="/admin/emails/templates/new"
          className="rounded bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800"
        >
          + Nouveau template
        </Link>
      </header>

      <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-stone-50 text-xs uppercase tracking-wider text-stone-600">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Slug</th>
              <th className="px-3 py-2 text-left font-medium">Nom</th>
              <th className="px-3 py-2 text-left font-medium">Sujet</th>
              <th className="px-3 py-2 text-left font-medium">Modifié</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-200">
            {templates.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-stone-500">
                  Aucun template. Créez-en un pour commencer.
                </td>
              </tr>
            ) : (
              templates.map((t) => (
                <tr key={t.id} className="hover:bg-stone-50/60">
                  <td className="px-3 py-2 font-mono text-xs">
                    <Link
                      href={`/admin/emails/templates/${t.id}/edit`}
                      className="hover:underline"
                    >
                      {t.slug}
                    </Link>
                  </td>
                  <td className="px-3 py-2 font-medium text-stone-900">{t.name}</td>
                  <td className="px-3 py-2 text-xs text-stone-600">{t.subjectTmpl}</td>
                  <td className="px-3 py-2 text-xs text-stone-500">
                    {new Date(t.updatedAt).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/admin/emails/templates/${t.id}/edit`}
                      className="text-xs text-stone-600 underline"
                    >
                      Éditer
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
