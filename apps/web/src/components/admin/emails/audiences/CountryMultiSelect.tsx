'use client';

/**
 * CountryMultiSelect — sélection multiple de codes pays en chips (UX-AUD-009).
 *
 * Remplace l'ancien input CSV texte-libre (« MA, FR ») de la règle
 * `country operator='in'`. Chaque code est :
 *   - choisi dans une liste fermée (COUNTRIES) → plus de code ISO à connaître
 *     par cœur, plus de saisie qui compile silencieusement en FALSE ;
 *   - affiché en chip retirable (nom FR + drapeau) ;
 *   - dédupliqué.
 *
 * Si une `value` préexistante contient un code inconnu (audience importée /
 * éditée), on le montre quand même en chip « avertissement » (bordure rose +
 * role=alert) pour que l'opérateur le voie et le retire — au lieu de le perdre
 * silencieusement.
 *
 * Contrôlé : `value: string[]` + `onChange(next: string[])`.
 */
import { useMemo, useState } from 'react';
import { COUNTRIES, countryEntry, isKnownCountry } from './countries';

export interface CountryMultiSelectProps {
  value: string[];
  onChange: (next: string[]) => void;
}

export function CountryMultiSelect({ value, onChange }: CountryMultiSelectProps) {
  const [pending, setPending] = useState('');

  const selected = useMemo(
    () => value.map((c) => c.trim().toUpperCase()).filter((c) => c.length > 0),
    [value],
  );
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const available = useMemo(
    () => COUNTRIES.filter((c) => !selectedSet.has(c.code)),
    [selectedSet],
  );

  function addCode(code: string) {
    const norm = code.trim().toUpperCase();
    if (!norm || selectedSet.has(norm)) return;
    onChange([...selected, norm]);
    setPending('');
  }

  function removeCode(code: string) {
    onChange(selected.filter((c) => c !== code));
  }

  const unknownCount = selected.filter((c) => !isKnownCountry(c)).length;

  return (
    <div
      className="flex flex-col gap-2"
      data-testid="country-multiselect"
      data-selected-count={selected.length}
    >
      {/* Chips des pays sélectionnés */}
      <ul className="flex flex-wrap gap-1.5" aria-label="Pays sélectionnés">
        {selected.length === 0 && (
          <li className="text-xs italic text-stone-400" data-testid="country-empty">
            Aucun pays. Ajoute au moins un pays à cibler.
          </li>
        )}
        {selected.map((code) => {
          const entry = countryEntry(code);
          const known = Boolean(entry);
          return (
            <li key={code}>
              <span
                data-testid={`country-chip-${code}`}
                role={known ? undefined : 'alert'}
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs ${
                  known
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'border border-rose-300 bg-rose-50 text-rose-700'
                }`}
                title={known ? undefined : `Code pays inconnu : ${code} (ne ciblera personne)`}
              >
                {known ? `${entry!.flag} ${entry!.name}` : `⚠ ${code}`}
                <button
                  type="button"
                  onClick={() => removeCode(code)}
                  aria-label={`Retirer ${known ? entry!.name : code}`}
                  data-testid={`country-remove-${code}`}
                  className="rounded-full px-0.5 text-stone-500 hover:text-rose-700"
                >
                  ✕
                </button>
              </span>
            </li>
          );
        })}
      </ul>

      {/* Ajout d'un pays via select fermé (liste COUNTRIES) */}
      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="country-add-select">
          Ajouter un pays
        </label>
        <select
          id="country-add-select"
          data-testid="country-add-select"
          aria-label="Ajouter un pays"
          value={pending}
          onChange={(e) => {
            const code = e.target.value;
            if (code) addCode(code);
          }}
          className="rounded border border-stone-300 px-2 py-1 text-sm"
        >
          <option value="">+ Ajouter un pays…</option>
          {available.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.name} ({c.code})
            </option>
          ))}
        </select>
      </div>

      {unknownCount > 0 && (
        <p className="text-xs text-rose-700" data-testid="country-unknown-warning" role="status">
          {unknownCount} code{unknownCount > 1 ? 's' : ''} pays inconnu{unknownCount > 1 ? 's' : ''} —
          ne ciblera personne. Retire-le ou remplace-le.
        </p>
      )}
    </div>
  );
}
