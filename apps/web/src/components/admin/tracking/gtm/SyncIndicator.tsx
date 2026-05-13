'use client';

/**
 * SyncIndicator — pastille de sync (✅/⚠) à côté d'un champ GTM.
 *
 * Compare la valeur courante du form à la valeur snapshot des Providers.
 * D-002 : sert d'indicateur visuel pour mettre en évidence les
 * divergences entre la version GTM en cours d'édition et la config
 * provider actuellement en DB.
 *
 * - `match`: ✅ vert silencieux
 * - mismatch (les deux non vides): ⚠ orange
 * - provider vide (rien à comparer): pas d'icône
 *
 * Volontairement minimaliste — pas d'aria-live (l'indicateur est
 * informationnel, pas critique).
 */

export interface SyncIndicatorProps {
  /** Valeur tapée dans le form. */
  current: string | null | undefined;
  /** Valeur côté provider snapshot. */
  providerValue: string | null | undefined;
  /** Label aria décrivant le champ. */
  label?: string;
}

export function SyncIndicator({ current, providerValue, label }: SyncIndicatorProps) {
  const cur = (current ?? '').trim();
  const prov = (providerValue ?? '').trim();
  if (!prov) return null; // Rien à comparer
  const match = cur === prov;
  if (match) {
    return (
      <span
        aria-label={label ? `${label} synchronisé` : 'synchronisé'}
        title={`Synchronisé avec Provider (${prov})`}
        className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="h-2.5 w-2.5"
          fill="currentColor"
        >
          <path d="M13.4 4.6L6.5 11.5 2.6 7.6l1.1-1.1 2.8 2.8 5.8-5.8z" />
        </svg>
      </span>
    );
  }
  return (
    <span
      aria-label={label ? `${label} désynchronisé` : 'désynchronisé'}
      title={`Diverge du Provider : "${prov}"`}
      className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-100 text-amber-700"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="h-2.5 w-2.5"
        fill="currentColor"
      >
        <path d="M8 1l7 13H1L8 1zm0 4.5a1 1 0 00-1 1V9a1 1 0 102 0V6.5a1 1 0 00-1-1zm0 5.5a1 1 0 100 2 1 1 0 000-2z" />
      </svg>
    </span>
  );
}
