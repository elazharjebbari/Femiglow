import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import { LOCALES, type Locale } from '@/i18n.config';
import { getSiteComponentByKey } from '@/lib/db/queries/site-components';
import { listBindingsWithMediaByComponent } from '@/lib/db/queries/component-bindings';
import {
  listAnimationBindingsWithAnimation,
  listAnimations,
} from '@/lib/db/queries/component-animations';
import { listBindingsByComponent as listFieldBindingsByComponent } from '@/lib/db/queries/component-fields';
import { ComponentDetailPanel } from '@/components/admin/components/ComponentDetailPanel';
import { loadInitialFields } from '@/components/admin/components/fields/load-initial-fields';
import type { FieldDirtyState } from '@/components/admin/components/fields/types';
import { LocaleEditorShell } from '@/components/admin/i18n/LocaleEditorShell';
import {
  IconArrowLeft,
  IconExternalLink,
  IconLayers,
  IconSparkles,
  IconType,
} from '@/components/admin/icons';

export const dynamic = 'force-dynamic';

/** Chip de statistique compact (icône + valeur + label). */
function StatChip({
  icon,
  label,
  value,
  tone = 'neutral',
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone?: 'neutral' | 'warning' | 'success';
}) {
  const palette =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50 text-amber-800'
      : tone === 'success'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
        : 'border-stone-200 bg-stone-50 text-stone-700';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${palette}`}
    >
      <span className="opacity-70">{icon}</span>
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-stone-500">{label}</span>
    </span>
  );
}

export default async function AdminComponentDetailPage({
  params,
}: {
  params: { key: string };
}) {
  const session = await requireAdmin(`/admin/components/${params.key}`);
  const component = await getSiteComponentByKey(params.key);
  if (!component) notFound();

  const [bindings, animations, allAnimations, fieldBindings] = await Promise.all([
    listBindingsWithMediaByComponent(component.id),
    listAnimationBindingsWithAnimation(component.id),
    listAnimations(),
    listFieldBindingsByComponent(component.id, 'fr').catch(() => []),
  ]);

  const fieldDefs = component.fields ?? [];

  // T3.8 — chargement par locale en parallèle. Default = 'fr' s'il n'y a aucun
  // binding pour AR / EN (le formulaire retombe sur `defaultValue` du registre).
  // Le throw est swallow-é localement : une locale en erreur ne doit pas casser
  // l'édition des deux autres (priorité contrainte 1 : aucune régression admin).
  const initialFieldsByLocale =
    fieldDefs.length > 0
      ? (Object.fromEntries(
          await Promise.all(
            LOCALES.map(async (loc) => {
              try {
                const fields = await loadInitialFields(component, fieldDefs, loc);
                return [loc, fields] as const;
              } catch {
                return [loc, {} as Record<string, FieldDirtyState>] as const;
              }
            }),
          ),
        ) as Partial<Record<Locale, Record<string, FieldDirtyState>>>)
      : null;

  const activeBindings = bindings.filter((b) => b.isActive).length;
  const draftFieldsCount = Array.isArray(fieldBindings)
    ? fieldBindings.filter((fb) => fb.status === 'draft').length
    : 0;
  const defaultAnim =
    animations.find((a) => a.isDefault)?.animation ?? animations[0]?.animation ?? null;

  return (
    <AdminShell adminEmail={session.email} active="components">
      {/* Hero header — breadcrumb + identité + chips + actions */}
      <header className="mb-6 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <nav aria-label="Fil d'Ariane" className="mb-3">
          <Link
            href="/admin/components"
            className="inline-flex items-center gap-1.5 text-xs text-stone-500 transition hover:text-stone-900"
          >
            <IconArrowLeft className="h-3.5 w-3.5" />
            Composants
          </Link>
        </nav>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
                {component.name}
              </h1>
              <code className="rounded-md bg-stone-100 px-2 py-0.5 font-mono text-xs text-stone-700">
                {component.key}
              </code>
            </div>

            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-stone-500">
              <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-stone-600">
                {component.category}
              </span>
              <span>·</span>
              <span>page</span>
              <span className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-stone-600">
                {component.pageGroup}
              </span>
            </p>

            {component.description && (
              <p className="mt-3 max-w-3xl text-sm text-stone-700">
                {component.description}
              </p>
            )}

            {/* Chips récap */}
            <div className="mt-4 flex flex-wrap items-center gap-1.5">
              <StatChip
                icon={<IconLayers className="h-3.5 w-3.5" />}
                value={`${activeBindings}/${component.slots.length}`}
                label="slots actifs"
                tone={
                  activeBindings === component.slots.length && component.slots.length > 0
                    ? 'success'
                    : 'neutral'
                }
              />
              {fieldDefs.length > 0 && (
                <StatChip
                  icon={<IconType className="h-3.5 w-3.5" />}
                  value={fieldDefs.length}
                  label="champs"
                />
              )}
              {draftFieldsCount > 0 && (
                <StatChip
                  icon={<IconType className="h-3.5 w-3.5" />}
                  value={draftFieldsCount}
                  label="drafts"
                  tone="warning"
                />
              )}
              {defaultAnim && (
                <StatChip
                  icon={<IconSparkles className="h-3.5 w-3.5" />}
                  value={defaultAnim.name}
                  label="animation"
                />
              )}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Link
              href={`/${component.pageGroup === 'home' ? '' : component.pageGroup}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900"
            >
              <IconExternalLink className="h-3.5 w-3.5" />
              Voir en prod
            </Link>
          </div>
        </div>
      </header>

      <ComponentDetailPanel
        component={component}
        bindings={bindings}
        animations={animations}
        allAnimations={allAnimations}
      />

      {initialFieldsByLocale ? (
        <section aria-labelledby="editor-heading" className="mt-10">
          <div className="mb-4 flex items-center gap-2 border-b border-stone-200 pb-2">
            <IconType className="h-4 w-4 text-stone-500" />
            <h2
              id="editor-heading"
              className="text-xs font-semibold uppercase tracking-wider text-stone-500"
            >
              Contenu éditorial
            </h2>
            <span className="text-[11px] text-stone-400">
              · {fieldDefs.length} champ{fieldDefs.length > 1 ? 's' : ''} · multilingue
              (FR / AR / EN)
            </span>
          </div>
          {/* T3.8 — LocaleEditorShell tient l'état activeLocale et re-mount
            * EditorWithPreview au switch. Le contrat admin reste FR-only
            * (chrome), seul le contenu édité est multilingue. */}
          <LocaleEditorShell
            componentKey={component.key}
            fieldDefs={fieldDefs}
            initialFieldsByLocale={initialFieldsByLocale}
          />
        </section>
      ) : null}
    </AdminShell>
  );
}
