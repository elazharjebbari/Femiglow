'use client';

/**
 * EntityCombobox — combobox d'autocomplétion d'entité, réutilisable et a11y.
 *
 * Chantier FONDATION de la vague 4 (UX-TRANSVERSE-001). Remplace le pattern
 * `<datalist>` dupliqué 4× dans audiences/ par un composant unique :
 *  - input contrôlé (`value` / `onChange`) ;
 *  - `fetchSuggestions` debouncé (250 ms) + `AbortController` (le fetch
 *    précédent est ANNULÉ à chaque frappe → jamais de suggestion fantôme
 *    arrivant après une réponse plus récente, ni après une erreur 500) ;
 *  - listbox ARIA complète (role=combobox/listbox/option, aria-activedescendant,
 *    navigation clavier ↑↓/Enter/Esc/Tab) ;
 *  - états exposés via data-testid : loading / empty / error.
 *
 * Pas de fermeture sur `mouseleave` (corrige le bug AddRuleMenu) — fermeture
 * uniquement sur clic extérieur, Escape, ou Tab.
 */
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

export interface ComboboxOption {
  value: string;
  label: string;
  hint?: string;
}

export interface EntityComboboxProps {
  value: string;
  onChange: (value: string) => void;
  /**
   * Récupère les suggestions pour la requête `q`. Reçoit un `signal`
   * d'AbortController : DOIT le passer au `fetch` pour que l'annulation du
   * debounce annule aussi le réseau.
   */
  fetchSuggestions: (q: string, signal: AbortSignal) => Promise<ComboboxOption[]>;
  placeholder?: string;
  /** Si false, la valeur n'est validée qu'en SÉLECTIONNANT une option. Déf. true. */
  allowFreeText?: boolean;
  /** Nb min de caractères avant de déclencher un fetch + ouvrir le listbox. Déf. 1. */
  minChars?: number;
  ariaLabel: string;
  renderOption?: (opt: ComboboxOption) => ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
}

const DEBOUNCE_MS = 250;

export function EntityCombobox({
  value,
  onChange,
  fetchSuggestions,
  placeholder,
  allowFreeText = true,
  minChars = 1,
  ariaLabel,
  renderOption,
  disabled = false,
  id,
  className = 'w-full rounded border border-stone-300 px-2 py-1 text-sm',
}: EntityComboboxProps) {
  const reactId = useId();
  const inputId = id ?? `combobox-${reactId}`;
  const listboxId = `${inputId}-listbox`;

  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  /** -1 = aucune option active (saisie libre). */
  const [activeIndex, setActiveIndex] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Sérialise les réponses : on ignore toute réponse plus ancienne que la
  // dernière requête lancée (anti suggestion fantôme même si AbortController
  // est ignoré par un fetchSuggestions mal câblé).
  const requestSeq = useRef(0);

  const clearDebounce = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  };
  const abortInFlight = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  };

  const runFetch = useCallback(
    (q: string) => {
      abortInFlight();
      const controller = new AbortController();
      abortRef.current = controller;
      const seq = ++requestSeq.current;
      setLoading(true);
      setError(false);
      fetchSuggestions(q, controller.signal)
        .then((opts) => {
          if (seq !== requestSeq.current) return; // réponse périmée → ignorée
          setOptions(opts);
          setError(false);
          setActiveIndex(-1);
          setOpen(opts.length > 0);
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return; // annulation volontaire
          if (seq !== requestSeq.current) return;
          // Échec réseau/HTTP : AUCUNE suggestion fantôme, on expose l'erreur.
          setOptions([]);
          setActiveIndex(-1);
          setError(true);
          setOpen(true);
        })
        .finally(() => {
          if (seq === requestSeq.current) setLoading(false);
        });
    },
    [fetchSuggestions],
  );

  // Debounce : à chaque changement de saisie, relance un fetch 250 ms plus tard.
  const scheduleFetch = useCallback(
    (q: string) => {
      clearDebounce();
      if (q.length < minChars) {
        abortInFlight();
        requestSeq.current++; // invalide toute réponse en vol
        setOptions([]);
        setLoading(false);
        setError(false);
        setOpen(false);
        setActiveIndex(-1);
        return;
      }
      debounceRef.current = setTimeout(() => runFetch(q), DEBOUNCE_MS);
    },
    [minChars, runFetch],
  );

  useEffect(() => {
    return () => {
      clearDebounce();
      abortInFlight();
    };
  }, []);

  // Fermeture sur clic extérieur (PAS sur mouseleave).
  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  function handleInput(next: string) {
    onChange(next);
    scheduleFetch(next);
  }

  function commitOption(opt: ComboboxOption) {
    onChange(opt.value);
    setOpen(false);
    setActiveIndex(-1);
    requestSeq.current++; // évite qu'un fetch en vol ne rouvre le listbox
    abortInFlight();
    clearDebounce();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open && options.length > 0) {
        setOpen(true);
        setActiveIndex(0);
        return;
      }
      if (options.length === 0) return;
      setActiveIndex((i) => (i + 1 >= options.length ? 0 : i + 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (options.length === 0) return;
      setOpen(true);
      setActiveIndex((i) => (i <= 0 ? options.length - 1 : i - 1));
      return;
    }
    if (e.key === 'Enter') {
      const active = activeIndex >= 0 ? options[activeIndex] : undefined;
      if (open && active) {
        e.preventDefault();
        commitOption(active);
        return;
      }
      // Pas d'option active. En mode strict (allowFreeText=false) on NE ferme
      // PAS sur Enter : on garde le listbox ouvert pour forcer une sélection
      // (la valeur libre portée par onChange n'est pas considérée validée).
      const first = options[0];
      if (open && allowFreeText) {
        e.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
      } else if (open && !allowFreeText && first) {
        // Mode strict avec des options dispo : sélectionne la première.
        e.preventDefault();
        commitOption(first);
      }
      return;
    }
    if (e.key === 'Escape') {
      if (open) {
        // Escape FERME sans vider la valeur.
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setActiveIndex(-1);
      }
      return;
    }
    if (e.key === 'Tab') {
      // Tab ferme et conserve la valeur (navigation naturelle).
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  const activeId =
    open && activeIndex >= 0 && activeIndex < options.length
      ? `${listboxId}-opt-${activeIndex}`
      : undefined;

  const dataState = error ? 'error' : loading ? 'loading' : open ? 'open' : 'idle';

  return (
    <div ref={rootRef} className="relative" data-state={dataState}>
      <input
        id={inputId}
        type="text"
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-invalid={error || undefined}
        autoComplete="off"
        spellCheck={false}
        disabled={disabled}
        value={value}
        placeholder={placeholder}
        className={className}
        data-testid="combobox-input"
        onChange={(e) => handleInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (options.length > 0 && value.length >= minChars) setOpen(true);
        }}
      />

      {loading ? (
        <span
          data-testid="combobox-loading"
          role="status"
          aria-label="Chargement des suggestions"
          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-400"
        >
          …
        </span>
      ) : null}

      {open ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          data-testid="combobox-listbox"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-stone-200 bg-white py-1 text-sm shadow-lg"
        >
          {error ? (
            <li
              data-testid="combobox-error"
              role="status"
              className="px-3 py-2 text-xs text-rose-600"
            >
              Suggestions indisponibles
            </li>
          ) : options.length === 0 ? (
            <li
              data-testid="combobox-empty"
              role="status"
              className="px-3 py-2 text-xs text-stone-500"
            >
              Aucun résultat
            </li>
          ) : (
            options.map((opt, i) => {
              const isActive = i === activeIndex;
              const isSelected = opt.value === value;
              return (
                <li
                  key={`${opt.value}-${i}`}
                  id={`${listboxId}-opt-${i}`}
                  role="option"
                  aria-selected={isSelected}
                  data-testid="combobox-option"
                  data-active={isActive || undefined}
                  className={`cursor-pointer px-3 py-1.5 ${
                    isActive ? 'bg-stone-100' : 'hover:bg-stone-50'
                  }`}
                  // onMouseDown (pas onClick) : empêche le blur de l'input de
                  // fermer le listbox AVANT la sélection.
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commitOption(opt);
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                >
                  {renderOption ? (
                    renderOption(opt)
                  ) : (
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="text-stone-800">{opt.label}</span>
                      {opt.hint ? (
                        <span className="shrink-0 text-xs text-stone-400">{opt.hint}</span>
                      ) : null}
                    </span>
                  )}
                </li>
              );
            })
          )}
        </ul>
      ) : null}
    </div>
  );
}
