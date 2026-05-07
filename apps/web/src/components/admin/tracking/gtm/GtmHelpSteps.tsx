/**
 * Steps visuels pour la procédure d'import dans GTM.
 * 6 cards numérotées, fade-in séquentiel à l'arrivée.
 */

const STEPS: Array<{ title: string; body: string }> = [
  {
    title: 'Ouvre GTM',
    body: 'tagmanager.google.com → ton compte → ton conteneur web.',
  },
  {
    title: 'Admin → Import Container',
    body: 'Le bouton est dans la section Admin du conteneur.',
  },
  {
    title: 'Choisis le fichier téléchargé',
    body: 'gtm-femiglow-<env>-<date>.json depuis ton dossier Téléchargements.',
  },
  {
    title: 'Workspace cible',
    body: 'Crée feature/auto-import-<date> ou choisis un workspace existant.',
  },
  {
    title: 'Mode',
    body: 'Merge (recommandé, fusionne sans supprimer) ou Overwrite (reset complet).',
  },
  {
    title: 'Confirme et teste',
    body: 'Vérifie en Tag Assistant Preview avant de publier.',
  },
];

export function GtmHelpSteps() {
  return (
    <section className="rounded-md border border-stone-200 bg-white p-5">
      <header className="mb-4 flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-stone-900">Comment importer</h2>
        <span className="text-xs uppercase tracking-wide text-stone-500">6 étapes</span>
      </header>
      <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className="motion-safe:animate-[fg-fade-in_300ms_ease-out_both] rounded-md border border-stone-200/70 bg-stone-50 px-3 py-2.5"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-start gap-2.5">
              <span
                aria-hidden="true"
                className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#A8C4A6]/20 text-[10px] font-semibold tabular-nums text-[#3F5B41]"
              >
                {i + 1}
              </span>
              <div className="min-w-0 leading-snug">
                <p className="text-sm font-medium text-stone-900">{step.title}</p>
                <p className="mt-0.5 text-xs text-stone-600">{step.body}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
