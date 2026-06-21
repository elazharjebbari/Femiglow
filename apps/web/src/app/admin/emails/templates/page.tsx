/**
 * /admin/emails/templates — Liste des templates HTML custom (M5.7.6).
 *
 * RSC = chargement + en-tête ; l'interactivité (recherche, tri, dupliquer,
 * supprimer avec garde 409) vit dans TemplatesListClient (P3.4-l, Lot 6).
 */
import Link from 'next/link';
import { desc, isNull } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { db as getDb } from '@/lib/db/client';
import { emailTemplateCustom } from '@/lib/db/schema-emails';
import { TemplatesListClient } from '@/components/admin/emails/templates/TemplatesListClient';
import type { TemplateListItem } from '@/components/admin/emails/templates/template-list';

export const dynamic = 'force-dynamic';

async function load(): Promise<TemplateListItem[]> {
  const drizzle = getDb();
  if (!drizzle) return [];
  const rows = await drizzle
    .select()
    .from(emailTemplateCustom)
    .where(isNull(emailTemplateCustom.deletedAt))
    .orderBy(desc(emailTemplateCustom.updatedAt));
  return rows.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    subjectTmpl: t.subjectTmpl,
    updatedAt: (t.updatedAt instanceof Date ? t.updatedAt : new Date(t.updatedAt)).toISOString(),
  }));
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

      <TemplatesListClient initialItems={templates} />
    </AdminShell>
  );
}
