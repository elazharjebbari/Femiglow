/**
 * loading.tsx du segment /admin/emails (UX-TRANSVERSE-007 / UX-DASH-003).
 *
 * Feedback de navigation : pendant que le Server Component charge ses données
 * (KPI + derniers envois + santé, en synchrone côté RSC), Next affiche ce
 * skeleton au lieu de figer l'écran sur la page précédente.
 *
 * Reprend le shell du dashboard : header + 6 cartes KPI + tableau. Squelette
 * purement décoratif → `aria-hidden`, avec un `role="status"` muet pour les
 * lecteurs d'écran.
 */
export default function EmailsLoading() {
  return (
    <div data-testid="emails-loading">
      <span role="status" className="sr-only">
        Chargement du tableau de bord emails…
      </span>

      <div aria-hidden="true" className="animate-pulse">
        {/* Header */}
        <div className="mb-6 flex items-baseline justify-between">
          <div className="space-y-2">
            <div className="h-7 w-40 rounded bg-stone-200" />
            <div className="h-4 w-72 rounded bg-stone-100" />
          </div>
          <div className="h-6 w-24 rounded-full bg-stone-200" />
        </div>

        {/* 6 cartes KPI */}
        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-stone-200 bg-white p-3">
              <div className="h-3 w-16 rounded bg-stone-100" />
              <div className="mt-2 h-7 w-12 rounded bg-stone-200" />
              <div className="mt-2 h-3 w-20 rounded bg-stone-100" />
            </div>
          ))}
        </div>

        {/* Tableau « Derniers envois » */}
        <div className="overflow-hidden rounded-lg border border-stone-200 bg-white">
          <div className="border-b border-stone-200 bg-stone-50 px-3 py-2">
            <div className="h-3 w-32 rounded bg-stone-200" />
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-stone-100 px-3 py-3">
              <div className="h-3 w-24 rounded bg-stone-100" />
              <div className="h-3 w-32 rounded bg-stone-100" />
              <div className="h-3 w-40 rounded bg-stone-100" />
              <div className="ml-auto h-5 w-16 rounded-full bg-stone-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
