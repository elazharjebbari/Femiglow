/**
 * loading.tsx du segment /admin/emails/events (UX-DASH-010).
 *
 * Feedback de navigation : pendant que le Server Component charge ses 3 requêtes
 * (total 24h + top events + 100 derniers events, lecture DB côté RSC), Next
 * affiche ce skeleton au lieu de figer l'écran sur la page précédente.
 *
 * Squelette purement décoratif → `aria-hidden`, avec un `role="status"` muet
 * pour les lecteurs d'écran.
 */
export default function EventsLoading() {
  return (
    <div data-testid="events-loading">
      <span role="status" className="sr-only">
        Chargement des events utilisateur…
      </span>

      <div aria-hidden="true" className="animate-pulse">
        {/* Header */}
        <div className="mb-6 flex items-baseline justify-between">
          <div className="space-y-2">
            <div className="h-7 w-64 rounded bg-stone-200" />
            <div className="h-4 w-96 rounded bg-stone-100" />
          </div>
          <div className="h-4 w-28 rounded bg-stone-100" />
        </div>

        {/* Compteur total */}
        <div className="mb-8 rounded-lg border border-stone-200 bg-white p-6">
          <div className="h-3 w-20 rounded bg-stone-100" />
          <div className="mt-3 h-9 w-24 rounded bg-stone-200" />
        </div>

        {/* Top events */}
        <div className="mb-8">
          <div className="mb-3 h-5 w-40 rounded bg-stone-200" />
          <div className="overflow-hidden rounded-md border border-stone-200 bg-white">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 border-b border-stone-100 px-3 py-3">
                <div className="h-3 w-32 rounded bg-stone-100" />
                <div className="h-5 w-16 rounded bg-stone-100" />
                <div className="ml-auto h-3 w-10 rounded bg-stone-100" />
              </div>
            ))}
          </div>
        </div>

        {/* Flux */}
        <div className="mb-3 h-5 w-44 rounded bg-stone-200" />
        <div className="overflow-hidden rounded-md border border-stone-200 bg-white">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 border-b border-stone-100 px-3 py-3">
              <div className="h-3 w-24 rounded bg-stone-100" />
              <div className="h-3 w-40 rounded bg-stone-100" />
              <div className="h-3 w-32 rounded bg-stone-100" />
              <div className="ml-auto h-5 w-16 rounded bg-stone-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
