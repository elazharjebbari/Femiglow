'use client';

/**
 * PreviewViewportToggle — bascule la largeur d'aperçu Bureau ↔ Mobile
 * (F07 P3.4-k, Lot 3). Un e-mail se lit majoritairement sur mobile : on
 * permet de vérifier le rendu à ~390 px sans quitter l'éditeur.
 *
 * Contrôle segmenté accessible (`role=group` + `aria-pressed`), couleurs
 * neutres uniquement (stone) → conforme au verrou G10 (TemplateEditor hors
 * whitelist couleur depuis P3.4-i).
 */

export type PreviewViewport = 'desktop' | 'mobile';

/** Source UNIQUE des largeurs d'aperçu (px) : `null` = pleine largeur. */
export const PREVIEW_VIEWPORTS: ReadonlyArray<{
  id: PreviewViewport;
  label: string;
  width: number | null;
}> = [
  { id: 'desktop', label: 'Bureau', width: null },
  { id: 'mobile', label: 'Mobile', width: 390 },
];

/** Largeur d'aperçu (px) d'un viewport, `null` si pleine largeur. */
export function viewportWidth(id: PreviewViewport): number | null {
  return PREVIEW_VIEWPORTS.find((v) => v.id === id)?.width ?? null;
}

export function PreviewViewportToggle({
  value,
  onChange,
}: {
  value: PreviewViewport;
  onChange: (next: PreviewViewport) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Largeur d’aperçu"
      data-testid="preview-viewport-toggle"
      className="inline-flex rounded-md border border-stone-300 bg-stone-50 p-0.5"
    >
      {PREVIEW_VIEWPORTS.map((v) => {
        const active = v.id === value;
        return (
          <button
            key={v.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(v.id)}
            className={`rounded px-2.5 py-0.5 text-xs font-medium transition-colors ${
              active
                ? 'bg-stone-900 text-white shadow-sm'
                : 'text-stone-600 hover:bg-stone-200'
            }`}
          >
            {v.label}
          </button>
        );
      })}
    </div>
  );
}
