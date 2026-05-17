'use client';

function StudioGuide() {
  return (
    <details className="group rounded-md border border-stone-200 bg-stone-50/70 px-4 py-3 text-sm text-stone-700">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
        <span>
          <span className="block text-sm font-semibold text-stone-900">
            Comment utiliser ce studio
          </span>
          <span className="mt-0.5 block text-xs text-stone-500">
            Workflow court : idée, propositions, relecture marque, validation, draft Postiz.
          </span>
        </span>
        <span className="shrink-0 rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-600 group-open:hidden">
          Ouvrir
        </span>
        <span className="hidden shrink-0 rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-600 group-open:inline">
          Fermer
        </span>
      </summary>
      <div className="mt-4 grid gap-3 border-t border-stone-200 pt-4 md:grid-cols-4">
        <div className="rounded border border-stone-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">1. Cadrer</p>
          <p className="mt-1 text-sm leading-6">
            Choisis le pilier, l'objectif, la plateforme et le format. L'intention doit expliquer
            le message à produire, pas seulement un titre.
          </p>
        </div>
        <div className="rounded border border-stone-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">2. Générer</p>
          <p className="mt-1 text-sm leading-6">
            Le studio crée trois brouillons de texte, les relit avec les règles FemiGlow et affiche
            un score marque pour prioriser la meilleure piste.
          </p>
        </div>
        <div className="rounded border border-stone-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">3. Visuel</p>
          <p className="mt-1 text-sm leading-6">
            Génère un visuel IA dans le compartiment dédié ou choisis un média importé. Les deux
            compartiments sont sélectionnables pour le post.
          </p>
        </div>
        <div className="rounded border border-stone-200 bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">4. Publier</p>
          <p className="mt-1 text-sm leading-6">
            Modifie la caption, sauvegarde pour relire, approuve, synchronise Postiz puis crée un
            brouillon social. Rien n'est publié automatiquement.
          </p>
        </div>
      </div>
      <div className="mt-3 rounded border border-violet-200 bg-violet-50 px-3 py-2 text-xs leading-5 text-violet-900">
        Le mode visuel IA est en <strong>mode test</strong> par défaut (pas de crédit OpenAI consommé).
        Pour activer la génération réelle, configurez <code>CONTENT_STUDIO_IMAGE_PROVIDER=openai</code> et
        <code> CONTENT_STUDIO_OPENAI_API_KEY</code>. Les visuels générés restent isolés dans le compartiment
        IA du Studio et n'apparaissent pas dans la médiathèque classique FemiGlow.
      </div>
    </details>
  );
}

export { StudioGuide };