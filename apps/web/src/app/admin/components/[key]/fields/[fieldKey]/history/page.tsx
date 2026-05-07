/**
 * /admin/components/[key]/fields/[fieldKey]/history — timeline + restore (P11).
 *
 * RSC qui charge l'historique du champ et délègue le rendu interactif à
 * <HistoryTimeline> (client). Le bouton « Restaurer » appelle
 * /api/admin/components/[key]/fields/[fieldKey]/restore qui crée un draft
 * via `restoreFromHistory` (cf. P5 / B1.6).
 *
 * Cf. docs/components-cms/action-plan/01-phases.md §P11.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { getSiteComponentByKey } from '@/lib/db/queries/site-components';
import { listHistory } from '@/lib/db/queries/component-fields';
import { decodeValue } from '@/lib/components/fields/encoding';
import {
  HistoryTimeline,
  type HistoryEntry,
} from '@/components/admin/components/fields/HistoryTimeline';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { key: string; fieldKey: string };
  searchParams?: { locale?: string };
}

export default async function FieldHistoryPage({
  params,
  searchParams,
}: PageProps): Promise<JSX.Element> {
  const session = await requireAdmin(
    `/admin/components/${params.key}/fields/${params.fieldKey}/history`,
  );
  const component = await getSiteComponentByKey(params.key);
  if (!component) notFound();
  const fieldDef = component.fields?.find((f) => f.key === params.fieldKey);
  if (!fieldDef) notFound();
  const locale = searchParams?.locale ?? 'fr';

  // 50 entrées suffisent pour le panneau (la pagination via API existe).
  const rawEntries = await listHistory(component.id, fieldDef.key, locale, 50);
  const entries: HistoryEntry[] = rawEntries.map((e) => ({
    id: e.id,
    version: e.version,
    value: decodeValue(e.value, fieldDef.type),
    status: e.status,
    action: e.action,
    actorId: e.actorId,
    notes: e.notes,
    createdAt: e.createdAt.toISOString(),
  }));

  return (
    <AdminShell adminEmail={session.email} active="components">
      <header className="mb-6">
        <nav aria-label="Fil d'Ariane" className="mb-2 text-xs text-stone-500">
          <Link href="/admin/components" className="hover:text-stone-900">
            Composants
          </Link>{' '}
          /{' '}
          <Link
            href={`/admin/components/${component.key}`}
            className="hover:text-stone-900"
          >
            {component.name}
          </Link>{' '}
          / Historique
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Historique : {fieldDef.label}
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-xs">
            {component.key}.{fieldDef.key}
          </code>{' '}
          · {entries.length} version{entries.length > 1 ? 's' : ''} · locale{' '}
          <code className="font-mono">{locale}</code>
        </p>
      </header>

      <HistoryTimeline
        componentKey={component.key}
        fieldDef={fieldDef}
        entries={entries}
        locale={locale}
      />
    </AdminShell>
  );
}
