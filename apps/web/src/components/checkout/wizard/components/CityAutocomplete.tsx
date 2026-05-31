'use client';

/**
 * CHA-230 — Autocomplete des villes de livraison.
 *
 * Pattern
 * ───────
 * Combobox WAI-ARIA "Editable Combobox with List Autocomplete"
 * (https://www.w3.org/WAI/ARIA/apg/patterns/combobox/). L'utilisateur tape
 * librement dans un champ texte ; un popup listbox suggère les villes
 * appariées (préfixe FR, AR, ou alias).
 *
 * Données
 * ───────
 * Fournies via `useDeliveryCities(query)` — fetch debounced 200 ms vers
 * `/api/delivery-cities/search`, cache mémoire `cc|qLower|limit`, et tolérance
 * d'erreur réseau (silencieuse, le listbox affiche juste "aucun résultat").
 *
 * Bilingue
 * ────────
 * - L'input a `dir="auto"` — il bascule LTR/RTL selon que l'utilisateur tape
 *   en latin ou en arabe.
 * - Chaque option affiche le nom FR + nom AR + prix/ETA. Le nom AR est
 *   rendu dans une `<span dir="rtl">` pour garantir un rendu correct même
 *   dans un contexte LTR.
 *
 * A11y
 * ────
 * - `role="combobox"` sur l'input, `aria-autocomplete="list"`,
 *   `aria-expanded`, `aria-controls` pointant vers le listbox,
 *   `aria-activedescendant` pour signaler l'option en cours de focus visuel.
 * - Le listbox a `role="listbox"`, chaque option `role="option"` +
 *   `aria-selected` (true quand l'option = sélection courante).
 * - Navigation clavier : ↑/↓ (move), Enter (commit), Esc (close),
 *   Tab (commit + close), Home/End (extrêmes). Le focus ne quitte JAMAIS
 *   l'input — c'est `aria-activedescendant` qui signale la navigation.
 * - Click extérieur ferme le listbox sans rien casser.
 *
 * Intégration avec react-hook-form
 * ────────────────────────────────
 * Pensé comme un composant **contrôlé** (`value` + `onChange` + `onBlur`),
 * pour s'intégrer naturellement via `<Controller>` ou un `register` adapté.
 * `onCitySelected(city)` est émis en plus de `onChange` quand l'utilisateur
 * commit une ville structurée (slug + prix + ETA).
 */

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';

import { FieldShell } from '@/components/forms/Field';
import {
  type PublicCity,
  useDeliveryCities,
} from '@/lib/checkout/delivery/use-delivery-cities';
import { useShippingConfig } from '@/lib/checkout/use-shipping-config';
import { ShippingPriceDisplay } from '@/components/checkout/ShippingPriceDisplay';
import { cn } from '@/lib/utils/cn';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface CityAutocompleteProps {
  /** Id HTML — utilisé pour le label, le listbox, les options. */
  id?: string;
  /** Libellé du champ (i18n côté appelant). */
  label: string;
  /** Hint sous le champ — peut afficher le matching status. */
  hint?: string;
  /** Message d'erreur, géré par RHF. */
  error?: string;
  /** Hint affiché quand le texte courant matche exactement une ville. */
  matchedHint?: (matched: string) => string;
  /** Placeholder du `<input>`. */
  placeholder?: string;
  /** Valeur courante (texte libre). */
  value: string;
  /**
   * Onchange textuel — déclenché à chaque frappe ET à chaque sélection
   * via clavier/souris. Le composant ne fait jamais de transformation
   * du texte saisi (autre que `trim()` au commit final).
   */
  onChange: (value: string) => void;
  /**
   * Callback de commit structuré. Déclenché quand l'utilisateur choisit
   * une option du listbox (Enter, click, Tab) avec la `PublicCity` complète.
   * Si l'utilisateur tape un texte qui ne matche pas et blur sans choisir,
   * `onCitySelected(null)` n'est PAS automatique — on laisse le parent
   * décider (ex: matching server-side ou validation Zod).
   */
  onCitySelected?: (city: PublicCity) => void;
  /** Callback blur — délégué à RHF si besoin. */
  onBlur?: (e: FocusEvent<HTMLInputElement>) => void;
  /** Marque le champ requis (étoile visuelle + `required` côté input). */
  required?: boolean;
  /** Désactive le combobox entièrement. */
  disabled?: boolean;
  /** Code pays ISO pour filtrer les villes. Défaut `MA`. */
  countryCode?: string;
  /** Taille du listbox (1..50). Défaut 8. */
  limit?: number;
  /** `data-testid` propagé sur l'input (utile pour Playwright/Vitest). */
  testId?: string;
  /** `autocomplete` HTML — défaut `address-level2`. */
  autoComplete?: string;
  /**
   * Classe additionnelle pour l'input — usage rare (override de spacing
   * dans un layout spécifique). Le styling de base reste dans le composant.
   */
  className?: string;
  /** En-tête du groupe villes prioritaires. i18n côté appelant, défaut FR. */
  popularCitiesLabel?: string;
  /** Statut de chargement du listbox. i18n côté appelant, défaut FR. */
  searchingLabel?: string;
  /** Libellé prix de livraison nul. i18n côté appelant, défaut FR. */
  freeDeliveryLabel?: string;
  /** Libellé du badge livraison offerte. i18n côté appelant, défaut FR. */
  freeShippingLabel?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de styling (cohérents avec `TextField`)
// ─────────────────────────────────────────────────────────────────────────────

const INPUT_CLASSES = cn(
  'w-full bg-creme text-encre',
  'border-b border-encre/30 px-0 py-3',
  'placeholder:text-encre/40',
  'focus:outline-none focus:border-encre focus-visible:ring-0',
  'transition-colors duration-base',
  'aria-[invalid=true]:border-petale-dark',
);

const LISTBOX_CLASSES = cn(
  'absolute z-20 mt-1 max-h-72 w-full overflow-auto',
  'rounded border border-encre/15 bg-white shadow-lg',
  'focus:outline-none',
);

const OPTION_CLASSES = cn(
  'flex cursor-pointer items-start justify-between gap-3 px-3 py-2',
  'text-sm leading-snug',
  'aria-selected:bg-petale-soft/40',
  'hover:bg-petale-soft/30',
);

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function CityAutocomplete(props: CityAutocompleteProps) {
  const {
    id: idProp,
    label,
    hint,
    error,
    matchedHint,
    placeholder,
    value,
    onChange,
    onCitySelected,
    onBlur,
    required,
    disabled,
    countryCode = 'MA',
    limit = 8,
    testId,
    autoComplete = 'address-level2',
    className,
    popularCitiesLabel = 'Villes populaires',
    searchingLabel = 'Recherche…',
    freeDeliveryLabel = 'Gratuit',
    freeShippingLabel = 'Offerte',
  } = props;

  // Id stable pour wiring ARIA — peut être surchargé par le parent.
  const reactId = useId();
  const id = idProp ?? `cityac-${reactId}`;
  const listboxId = `${id}-listbox`;
  const optionId = (index: number) => `${id}-option-${index}`;

  // ── State local ────────────────────────────────────────────────────────────
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Données ────────────────────────────────────────────────────────────────
  // Quand la query est vide, on montre les villes prioritaires (position > 0)
  // — on demande davantage de résultats pour les couvrir toutes.
  const isPopularView = value.trim() === '';
  const effectiveLimit = isPopularView ? 13 : limit;
  const { items, loading } = useDeliveryCities(value, {
    countryCode,
    limit: effectiveLimit,
  });
  const { freeShipping } = useShippingConfig();

  const exactMatch = useMemo(() => {
    const normalized = value.trim().toLocaleLowerCase();
    if (!normalized) return null;
    return (
      items.find((city) => {
        const candidates = [
          city.nameFr,
          city.nameAr ?? '',
          city.slug,
          ...city.aliases,
        ];
        return candidates.some(
          (candidate) => candidate.trim().toLocaleLowerCase() === normalized,
        );
      }) ?? null
    );
  }, [items, value]);

  const effectiveHint =
    exactMatch && matchedHint ? matchedHint(exactMatch.nameFr) : hint;

  // Clamp activeIndex quand les items changent (ex: query qui se rétrécit).
  useEffect(() => {
    if (activeIndex >= items.length) {
      setActiveIndex(items.length > 0 ? 0 : -1);
    }
  }, [items.length, activeIndex]);

  // ── Click outside ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // ── Commit d'une option ───────────────────────────────────────────────────
  const commitCity = useCallback(
    (city: PublicCity) => {
      onChange(city.nameFr);
      onCitySelected?.(city);
      setOpen(false);
      setActiveIndex(-1);
      // Garde le focus sur l'input — discoverabilité visuelle.
      requestAnimationFrame(() => inputRef.current?.focus());
    },
    [onChange, onCitySelected],
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
      setOpen(true);
      setActiveIndex(-1);
    },
    [onChange],
  );

  const handleInputFocus = useCallback(() => {
    // Ouvre l'autocomplete dès le focus — pattern "open on focus" standard.
    setOpen(true);
  }, []);

  const handleInputBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      // Laisse le click-handler des options se déclencher d'abord.
      // Le `mousedown` outside handler ferme déjà — ici on défère juste
      // pour ne pas bloquer un click en cours.
      window.setTimeout(() => {
        if (!containerRef.current) return;
        if (!containerRef.current.contains(document.activeElement)) {
          setOpen(false);
        }
      }, 100);
      onBlur?.(e);
    },
    [onBlur],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>) => {
      if (disabled) return;

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          if (!open) {
            setOpen(true);
            setActiveIndex(items.length > 0 ? 0 : -1);
            return;
          }
          setActiveIndex((idx) => {
            if (items.length === 0) return -1;
            return idx < items.length - 1 ? idx + 1 : 0;
          });
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          if (!open) {
            setOpen(true);
            setActiveIndex(items.length > 0 ? items.length - 1 : -1);
            return;
          }
          setActiveIndex((idx) => {
            if (items.length === 0) return -1;
            return idx > 0 ? idx - 1 : items.length - 1;
          });
          break;
        }
        case 'Home': {
          if (!open) return;
          e.preventDefault();
          setActiveIndex(items.length > 0 ? 0 : -1);
          break;
        }
        case 'End': {
          if (!open) return;
          e.preventDefault();
          setActiveIndex(items.length > 0 ? items.length - 1 : -1);
          break;
        }
        case 'Enter': {
          if (!open) return;
          if (activeIndex < 0 || activeIndex >= items.length) return;
          e.preventDefault();
          const city = items[activeIndex];
          if (city) commitCity(city);
          break;
        }
        case 'Escape': {
          if (!open) return;
          e.preventDefault();
          setOpen(false);
          setActiveIndex(-1);
          break;
        }
        case 'Tab': {
          // Si l'utilisateur Tab avec une option highlight, on commit avant
          // de laisser le focus s'échapper.
          if (!open) return;
          if (activeIndex >= 0 && activeIndex < items.length) {
            const city = items[activeIndex];
            if (city) {
              // PAS de preventDefault — on veut laisser le tab naturel
              // se faire ; on commit juste avant.
              commitCity(city);
            }
          } else {
            setOpen(false);
          }
          break;
        }
        default:
          break;
      }
    },
    [open, items, activeIndex, commitCity, disabled],
  );

  // ── Style helpers ──────────────────────────────────────────────────────────
  const hasError = Boolean(error);
  const describedBy = useMemo(() => {
    const ids: string[] = [];
    if (effectiveHint && !error) ids.push(`${id}-hint`);
    if (error) ids.push(`${id}-error`);
    return ids.length > 0 ? ids.join(' ') : undefined;
  }, [effectiveHint, error, id]);

  // Listbox actif uniquement quand il y a quelque chose à montrer ou un état
  // de chargement à signaler.
  const showListbox = open && (items.length > 0 || loading);

  return (
    <div ref={containerRef} className="relative">
      <FieldShell
        id={id}
        label={label}
        hint={effectiveHint}
        error={error}
        required={required}
      >
        <input
          ref={inputRef}
          id={id}
          type="text"
          // ARIA combobox pattern.
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showListbox}
          aria-controls={listboxId}
          aria-activedescendant={
            activeIndex >= 0 && activeIndex < items.length
              ? optionId(activeIndex)
              : undefined
          }
          aria-invalid={hasError ? 'true' : undefined}
          aria-describedby={describedBy}
          // Désactive l'autocomplete natif (différent de notre listbox).
          autoComplete={autoComplete}
          spellCheck={false}
          // CHA-231 — détection LTR/RTL automatique pour input bilingue.
          dir="auto"
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          data-testid={testId}
          className={cn(INPUT_CLASSES, className)}
        />
      </FieldShell>

      {showListbox && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={label}
          className={LISTBOX_CLASSES}
          // L'utilisateur ne tab pas DANS le listbox — c'est l'input qui
          // garde le focus, et aria-activedescendant pilote la sélection
          // virtuelle. C'est le pattern WAI-ARIA standard.
          tabIndex={-1}
          data-testid={testId ? `${testId}-listbox` : undefined}
        >
          {items.length === 0 && loading && (
            <li
              role="presentation"
              className="px-3 py-2 text-xs text-encre/50"
              aria-live="polite"
            >
              {searchingLabel}
            </li>
          )}
          {isPopularView && items.length > 0 && (
            <li
              role="presentation"
              className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-encre/45"
            >
              {popularCitiesLabel}
            </li>
          )}
          {items.map((city, index) => {
            const isActive = index === activeIndex;
            return (
              <li
                key={city.slug}
                id={optionId(index)}
                role="option"
                aria-selected={isActive}
                className={OPTION_CLASSES}
                // Évite de blurrer l'input quand on click sur une option.
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commitCity(city)}
                onMouseEnter={() => setActiveIndex(index)}
                data-testid={testId ? `${testId}-option-${city.slug}` : undefined}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-encre">{city.nameFr}</div>
                  {city.nameAr && (
                    <div
                      dir="rtl"
                      className="truncate text-xs text-encre/55"
                      lang="ar"
                    >
                      {city.nameAr}
                    </div>
                  )}
                </div>
                <div className="shrink-0 whitespace-nowrap text-xs text-encre/60">
                  <div className="flex justify-end text-end">
                    <ShippingPriceDisplay
                      displayPrice={
                        city.deliveryPriceMad === 0
                          ? freeDeliveryLabel
                          : `${city.deliveryPriceMad} MAD`
                      }
                      freeShipping={freeShipping && city.deliveryPriceMad > 0}
                      freeLabel={freeShippingLabel}
                      size="xs"
                      align="right"
                    />
                  </div>
                  <div className="text-end text-encre/45">
                    {city.deliveryEta}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
