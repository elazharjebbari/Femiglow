import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/require-admin';
import { AdminShell } from '@/components/admin/AdminShell';
import {
  BREAKPOINT_WIDTHS,
  DEFAULT_BREAKPOINTS,
  DEFAULT_FORMATS,
  DEFAULT_QUALITIES,
} from '@/lib/media/pipeline/breakpoints';

export const dynamic = 'force-dynamic';

export default async function MediaSettingsPage() {
  const session = await requireAdmin('/admin/media/settings');
  return (
    <AdminShell adminEmail={session.email} active="media">
      <nav aria-label="Fil d'Ariane" className="mb-4 text-sm text-stone-500">
        <Link href="/admin/media" className="hover:underline">
          Médias
        </Link>{' '}
        <span aria-hidden="true">/</span> Réglages
      </nav>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">
          Réglages média
        </h1>
        <p className="mt-1 text-sm text-stone-600">
          Profils, breakpoints et stratégies par défaut. Lecture seule pour le
          moment — éditer via override par média ou variables d'environnement.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-md border border-stone-200 bg-white p-5">
          <h2 className="text-base font-semibold text-stone-900">Breakpoints</h2>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="py-1">Clé</th>
                <th className="py-1">Largeur</th>
                <th className="py-1">Par défaut</th>
              </tr>
            </thead>
            <tbody>
              {(Object.entries(BREAKPOINT_WIDTHS) as Array<[string, number]>).map(([k, w]) => (
                <tr key={k} className="border-t border-stone-100">
                  <td className="py-1.5">{k}</td>
                  <td className="py-1.5">{w}px</td>
                  <td className="py-1.5">
                    {DEFAULT_BREAKPOINTS.includes(k as (typeof DEFAULT_BREAKPOINTS)[number])
                      ? '✓'
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-md border border-stone-200 bg-white p-5">
          <h2 className="text-base font-semibold text-stone-900">Formats & qualité</h2>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-stone-500">
                <th className="py-1">Format</th>
                <th className="py-1">Qualité</th>
              </tr>
            </thead>
            <tbody>
              {DEFAULT_FORMATS.map((f) => (
                <tr key={f} className="border-t border-stone-100">
                  <td className="py-1.5">{f}</td>
                  <td className="py-1.5">
                    {DEFAULT_QUALITIES[f as keyof typeof DEFAULT_QUALITIES] ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="rounded-md border border-stone-200 bg-white p-5 lg:col-span-2">
          <h2 className="text-base font-semibold text-stone-900">Profils qualité</h2>
          <ul role="list" className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
            <li className="rounded border border-stone-200 p-3">
              <h3 className="font-semibold">Hero</h3>
              <p className="mt-1 text-xs text-stone-600">
                Eager + fetchPriority high · breakpoints complets · qualité +5
              </p>
            </li>
            <li className="rounded border border-stone-200 p-3">
              <h3 className="font-semibold">Inline</h3>
              <p className="mt-1 text-xs text-stone-600">
                Viewport · qualité standard · srcset complet
              </p>
            </li>
            <li className="rounded border border-stone-200 p-3">
              <h3 className="font-semibold">Thumb</h3>
              <p className="mt-1 text-xs text-stone-600">
                Viewport · qualité réduite · breakpoints xs/sm uniquement
              </p>
            </li>
          </ul>
        </section>
      </div>
    </AdminShell>
  );
}
