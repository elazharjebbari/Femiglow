import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  listAnimations,
  listAnimationBindings,
} from '@/lib/db/queries/component-animations';
import { listSiteComponents } from '@/lib/db/queries/site-components';
import { ANIMATION_REGISTRY } from '@/lib/components/animations-registry';

export const dynamic = 'force-dynamic';

const KIND_LABEL: Record<string, string> = {
  none: 'Sans animation',
  'framer-motion': 'Framer Motion',
  css: 'CSS',
  svg: 'SVG',
};

const KIND_TONE: Record<string, string> = {
  none: 'bg-stone-100 text-stone-600',
  'framer-motion': 'bg-violet-100 text-violet-800',
  css: 'bg-sky-100 text-sky-800',
  svg: 'bg-emerald-100 text-emerald-800',
};

export default async function AdminComponentsAnimationsPage(): Promise<JSX.Element> {
  const session = await requireAdmin('/admin/components/animations');
  const animations = await listAnimations();
  const components = await listSiteComponents({});
  const bindingsByAnimationId = new Map<string, number>();
  for (const c of components) {
    const bindings = await listAnimationBindings(c.id);
    for (const b of bindings) {
      bindingsByAnimationId.set(
        b.animationId,
        (bindingsByAnimationId.get(b.animationId) ?? 0) + 1,
      );
    }
  }
  const presentKeys = new Set(animations.map((a) => a.key));
  const missingFromDB = ANIMATION_REGISTRY.filter((p) => !presentKeys.has(p.key));

  return (
    <AdminShell adminEmail={session.email} active="components">
      <header className="mb-6">
        <nav aria-label="Fil d'Ariane" className="mb-2 text-xs text-stone-500">
          <Link href="/admin/components" className="hover:text-stone-900">
            ← Composants
          </Link>
        </nav>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Profils d&apos;animation
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          {animations.length} profil{animations.length === 1 ? '' : 's'} —{' '}
          {components.length} composants liés à des bindings.{' '}
          {missingFromDB.length > 0 && (
            <span className="text-amber-700">
              ⚠ {missingFromDB.length} profil{missingFromDB.length === 1 ? '' : 's'}{' '}
              déclaré{missingFromDB.length === 1 ? '' : 's'} dans le registre mais
              absent{missingFromDB.length === 1 ? '' : 's'} de la DB — lancez un seed.
            </span>
          )}
        </p>
      </header>

      {animations.length === 0 ? (
        <p className="rounded-md border border-stone-200 bg-white px-4 py-8 text-center text-sm text-stone-500">
          Aucun profil d&apos;animation. Lancez le seed depuis la page{' '}
          <Link href="/admin/components/seed" className="underline">
            Seed depuis docs/
          </Link>
          .
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {animations.map((anim) => {
            const usage = bindingsByAnimationId.get(anim.id) ?? 0;
            return (
              <li
                key={anim.id}
                className="rounded-lg border border-stone-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-stone-900">
                      {anim.name}
                    </h2>
                    <p className="mt-0.5 truncate font-mono text-[11px] text-stone-500">
                      {anim.key}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      KIND_TONE[anim.kind] ?? 'bg-stone-100 text-stone-600'
                    }`}
                  >
                    {KIND_LABEL[anim.kind] ?? anim.kind}
                  </span>
                </div>
                {anim.description && (
                  <p className="mt-2 line-clamp-3 text-xs text-stone-600">
                    {anim.description}
                  </p>
                )}
                <dl className="mt-3 space-y-1 text-[11px] text-stone-700">
                  <div className="flex justify-between gap-2">
                    <dt className="text-stone-500">Composants liés</dt>
                    <dd className="font-mono">{usage}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-stone-500">prefers-reduced-motion</dt>
                    <dd className="font-mono">
                      {anim.respectsReducedMotion ? 'oui' : 'non'}
                    </dd>
                  </div>
                </dl>
                {anim.previewSnippet && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-[11px] text-stone-600">
                      Aperçu de la config
                    </summary>
                    <pre className="mt-1 overflow-x-auto rounded bg-stone-100 p-2 font-mono text-[10px] text-stone-700">
                      {anim.previewSnippet}
                    </pre>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {missingFromDB.length > 0 && (
        <section className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <h2 className="text-sm font-semibold text-amber-900">
            Profils registre non synchronisés
          </h2>
          <ul className="mt-2 space-y-1 text-xs font-mono text-amber-800">
            {missingFromDB.map((p) => (
              <li key={p.key}>
                {p.key} — {p.name}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-amber-900">
            Lancez{' '}
            <Link href="/admin/components/seed" className="underline">
              Seed depuis docs/
            </Link>{' '}
            pour les insérer.
          </p>
        </section>
      )}
    </AdminShell>
  );
}
