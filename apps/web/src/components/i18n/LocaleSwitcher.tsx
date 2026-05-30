'use client';

/**
 * LocaleSwitcher — bascule entre locales actives, design éditorial FemiGlow.
 *
 * Phase 5 — Switcher public éditorial.
 *
 * Charte FemiGlow (NON NÉGOCIABLE) :
 *  - couleurs : sauge / crème / encre / pétale (cf. `tailwind.config.ts`)
 *  - typo : Pinyon Script (wordmark only), Cormorant Garamond (titres),
 *    Inter (UI labels)
 *  - voix : sobre, AUCUN emoji (pas de flags), uppercase tracking-[0.2em]
 *    pour les widgets, underline-offset[6px] pour les actifs
 *  - réf : ~/.claude/projects/.../memory/project_femiglow.md
 *
 * Deux variantes :
 *  - `variant="dropdown"` (par défaut, desktop) : bouton "FR" → popover
 *    léger avec les 3 langues + endonyme italic Cormorant
 *  - `variant="inline"` (mobile, dans SommaireOverlay) : liste verticale,
 *    tap targets ≥ h-14, barre sauge à gauche de l'actif
 *
 * Comportement :
 *  - Lit la locale active via `useLocale()` (NextIntlClientProvider context)
 *  - `usePathname()` (next-intl wrapper) garantit que le path est stripé
 *    du préfixe locale → `router.replace(pathname, { locale: next })`
 *    redirige vers la même page dans la nouvelle locale
 *  - Cookie `NEXT_LOCALE` mis à jour automatiquement par next-intl middleware
 *  - A11y : aria-expanded, aria-controls, role=menu, roving tabindex
 *    (Arrow Up/Down/Home/End), Escape ferme, click outside ferme
 *
 * @see docs/i18n-strategy-2026-05/05-ui-ux-design/locale-switcher-ui.md
 * @see docs/i18n-strategy-2026-05/PHASE-4-FINAL.md §Phase 5
 */
import { useLocale, useTranslations } from 'next-intl';
import { usePathname as useRawPathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';

import { usePathname, useRouter } from '@/i18n/navigation';
import { isLocaleSwitcherV2Enabled } from './locale-switcher-flag';
import { useLocaleSwitch } from './locale-transition-context';
import {
  DEFAULT_LOCALE,
  getEnabledLocales,
  getLocaleConfig,
  isLocale,
  type Locale,
} from '@/i18n.config';
import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// Hook — lecture résiliente de la locale active
// ---------------------------------------------------------------------------

/**
 * Lit la locale active de manière résiliente :
 *  - Sous `NextIntlClientProvider` (routes `[locale]/*`) : utilise `useLocale()`
 *    pour bénéficier de la source canonique
 *  - Hors provider (routes legacy `(marketing)/*` côté SSR sans i18n) :
 *    retourne `null` (le composant rendra `null`)
 *  - Fallback runtime : parse le premier segment du pathname si présent
 *
 * Ce design garantit que :
 *  - Le composant ne crash JAMAIS dans un layout sans provider
 *  - Le composant ne s'affiche QUE sur les routes effectivement localisées
 */
function useActiveLocaleSafe(): Locale | null {
  // useLocale() throw "No intl context" hors provider — on l'isole dans
  // un try/catch via une wrapper Hook…mais les hooks ne supportent pas le
  // try/catch direct. Alternative : on lit le pathname raw, et SI le premier
  // segment est une locale supportée, on l'utilise. Sinon null.
  const rawPath = useRawPathname() ?? '/';
  const first = rawPath.split('/').filter(Boolean)[0];
  if (first && isLocale(first)) {
    return first;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LocaleSwitcherVariant = 'dropdown' | 'inline';

export interface LocaleSwitcherProps {
  /**
   * Variante visuelle :
   *  - `dropdown` (par défaut) : bouton + menu déroulant absolute, idéal
   *    Header desktop (≥ md)
   *  - `inline` : liste verticale dépliée en flux, idéal drawer mobile
   *    (SommaireOverlay) ou Footer
   */
  variant?: LocaleSwitcherVariant;
  /**
   * Callback optionnel appelé après une sélection — utilisé par exemple
   * dans le SommaireOverlay pour fermer le drawer après le switch.
   */
  onSelect?: (locale: Locale) => void;
  /**
   * Callback optionnel notifiant l'ouverture/fermeture du menu dropdown.
   * Permet à un parent (Header) de masquer un élément voisin qui
   * transparaîtrait sous le fond semi-opaque du menu. Variante `dropdown`
   * uniquement (la variante `inline` n'a pas d'état d'ouverture).
   */
  onOpenChange?: (open: boolean) => void;
  /** Permet d'override la className racine (positionnement par parent). */
  className?: string;
}

// ---------------------------------------------------------------------------
// Composant — wrapper résilient
// ---------------------------------------------------------------------------

/**
 * Wrapper public — détecte si le composant est rendu DANS une route
 * `[locale]/*` (présence du `NextIntlClientProvider`) avant d'appeler les
 * hooks `useLocale()` / `useTranslations()` qui requièrent le provider.
 *
 * Sur les routes legacy (`(marketing)/*` sans i18n), retourne `null` pour
 * éviter le crash de prerender Next.js — gracieusement masqué.
 */
export function LocaleSwitcher(props: LocaleSwitcherProps) {
  const activeLocale = useActiveLocaleSafe();
  if (!activeLocale) return null;
  return <LocaleSwitcherInner {...props} activeLocale={activeLocale} />;
}

/**
 * Cœur du composant — n'est rendu que SI un parent garantit que les hooks
 * `useLocale()` / `useTranslations()` ont accès à un provider valide
 * (route `[locale]/*` avec `NextIntlClientProvider`).
 */
function LocaleSwitcherInner({
  variant = 'dropdown',
  onSelect,
  onOpenChange,
  className,
  activeLocale,
}: LocaleSwitcherProps & { activeLocale: Locale }) {
  // Sanity : on lit aussi la locale via useLocale() pour garder le composant
  // en phase avec le provider en cas de bascule sans changement d'URL
  // (rare, mais possible avec un setLocale custom).
  const providerLocale = useLocale() as Locale;
  const effectiveLocale = (providerLocale ?? activeLocale ?? DEFAULT_LOCALE) as Locale;
  const t = useTranslations('navigation');
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const locales = useMemo(() => getEnabledLocales(), []);

  // V2 (lot L3) — si le provider est monté ET le flag actif, on bascule
  // SANS rechargement via le moteur de transition ; sinon comportement V1
  // (next-intl router.replace). Garde additive → zéro régression flag off.
  const localeSwitch = useLocaleSwitch();
  const v2Enabled = isLocaleSwitcherV2Enabled();
  const handleSelect = useCallback(
    (next: Locale) => {
      if (next !== effectiveLocale) {
        if (localeSwitch && v2Enabled) {
          localeSwitch.switchTo(next, variant === 'inline' ? 'drawer' : 'header');
        } else {
          startTransition(() => {
            router.replace(pathname, { locale: next });
          });
        }
      }
      onSelect?.(next);
    },
    [
      effectiveLocale,
      onSelect,
      pathname,
      router,
      localeSwitch,
      v2Enabled,
      variant,
    ],
  );

  if (locales.length <= 1) {
    return null;
  }

  if (variant === 'inline') {
    return (
      <InlineSwitcher
        locales={locales}
        activeLocale={effectiveLocale}
        onSelect={handleSelect}
        ariaLabel={t('locale_switcher_aria')}
        kickerLabel={t('locale_switcher_label')}
        activeSuffix={t('locale_switcher_active_suffix')}
        isPending={isPending}
        className={className}
      />
    );
  }

  return (
    <DropdownSwitcher
      locales={locales}
      activeLocale={effectiveLocale}
      onSelect={handleSelect}
      ariaLabel={t('locale_switcher_aria')}
      menuAriaLabel={t('locale_switcher_menu_aria')}
      isPending={isPending}
      className={className}
      onOpenChange={onOpenChange}
    />
  );
}

// ---------------------------------------------------------------------------
// Variante DROPDOWN (desktop Header)
// ---------------------------------------------------------------------------

interface DropdownSwitcherProps {
  locales: readonly Locale[];
  activeLocale: Locale;
  onSelect: (locale: Locale) => void;
  ariaLabel: string;
  menuAriaLabel: string;
  isPending: boolean;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}

function DropdownSwitcher({
  locales,
  activeLocale,
  onSelect,
  ariaLabel,
  menuAriaLabel,
  isPending,
  className,
  onOpenChange,
}: DropdownSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [focusIndex, setFocusIndex] = useState<number>(() =>
    Math.max(0, locales.indexOf(activeLocale)),
  );
  const triggerId = useId();
  const menuId = `${triggerId}-menu`;
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Notifie le parent (Header) de l'état d'ouverture du menu pour qu'il
  // masque un voisin transparaissant sous le fond semi-opaque du menu.
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  // Ferme le menu au click outside.
  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Focus l'item courant à l'ouverture (a11y APG menu pattern).
  useEffect(() => {
    if (!open) return;
    const idx = Math.max(0, locales.indexOf(activeLocale));
    setFocusIndex(idx);
    requestAnimationFrame(() => {
      itemRefs.current[idx]?.focus();
    });
  }, [open, activeLocale, locales]);

  function handleTriggerKey(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen(true);
    }
  }

  function handleMenuKey(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === 'Tab') {
      // Tab ferme le menu et laisse le focus naturel suivre.
      setOpen(false);
      return;
    }
    const last = locales.length - 1;
    let next: number | null = null;
    if (event.key === 'ArrowDown') next = focusIndex >= last ? 0 : focusIndex + 1;
    else if (event.key === 'ArrowUp') next = focusIndex <= 0 ? last : focusIndex - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = last;
    if (next === null) return;
    event.preventDefault();
    setFocusIndex(next);
    itemRefs.current[next]?.focus();
  }

  function selectLocale(next: Locale) {
    onSelect(next);
    setOpen(false);
    // Pas de focus retour au trigger sur sélection : la navigation
    // change la page (router.replace) → le focus naturel suit.
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleTriggerKey}
        disabled={isPending}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={ariaLabel}
        data-testid="locale-switcher-trigger"
        data-state={open ? 'open' : 'closed'}
        className={cn(
          'inline-flex h-11 items-center px-2 font-body text-[11px] uppercase tracking-[0.2em] text-encre',
          'underline decoration-encre/40 underline-offset-[6px] transition-colors',
          'hover:decoration-encre focus-visible:outline-none focus-visible:decoration-encre',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'md:px-1 md:text-xs md:underline-offset-4',
        )}
      >
        {/*
          Phase 9bis — on affiche l'endonyme (« العربية » sur /ar,
          « Français » sur /fr) plutôt que le code latin `AR`/`FR`/`EN` :
          ce dernier fuitait du latin sur les pages arabes (règle « aucun
          latin sauf FemiGlow »). L'endonyme dans sa propre écriture est
          aussi le choix le plus accessible (langue présentée dans sa langue).
        */}
        {getLocaleConfig(activeLocale).displayNameNative}
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={menuAriaLabel}
          aria-orientation="vertical"
          onKeyDown={handleMenuKey}
          data-testid="locale-switcher-menu"
          // Animation sobre fade + scale-y, durée 200 ms — pas d'overshoot.
          // `end-0` (logical) garantit l'alignement correct en RTL.
          className={cn(
            'absolute end-0 top-full z-[var(--z-popover,40)] mt-2 min-w-[12rem]',
            'border border-encre/10 bg-creme/95 backdrop-blur-sm shadow-sm',
            'origin-top motion-safe:animate-[locale-fade-in_180ms_ease-out]',
            'motion-reduce:animate-none',
          )}
        >
          <ul className="flex flex-col py-1">
            {locales.map((loc, idx) => {
              const cfg = getLocaleConfig(loc);
              const isActive = loc === activeLocale;
              return (
                <li key={loc} role="none" className="relative">
                  <button
                    ref={(el) => {
                      itemRefs.current[idx] = el;
                    }}
                    type="button"
                    role="menuitemradio"
                    aria-checked={isActive}
                    tabIndex={idx === focusIndex ? 0 : -1}
                    onClick={() => selectLocale(loc)}
                    onFocus={() => setFocusIndex(idx)}
                    data-testid={`locale-switcher-item-${loc}`}
                    data-active={isActive ? 'true' : 'false'}
                    lang={loc}
                    dir={cfg.direction}
                    className={cn(
                      'group relative flex w-full items-baseline gap-2 py-2.5 ps-5 pe-4',
                      'font-body text-[11px] uppercase tracking-[0.18em] text-encre',
                      'transition-colors',
                      'hover:bg-petale/30 focus-visible:bg-petale/30 focus-visible:outline-none',
                      isActive && 'font-medium',
                    )}
                  >
                    {/* Indicateur sauge à gauche pour l'actif — barre 2px */}
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-y-1 start-0 w-[2px] bg-sauge"
                      />
                    )}
                    <span className="font-body">{loc.toUpperCase()}</span>
                    <span className="font-body text-encre/40" aria-hidden="true">
                      —
                    </span>
                    <span
                      className={cn(
                        'font-display text-[14px] italic normal-case tracking-normal',
                        isActive ? 'text-encre' : 'text-encre/75',
                      )}
                    >
                      {cfg.displayNameNative}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variante INLINE (mobile / SommaireOverlay / Footer)
// ---------------------------------------------------------------------------

interface InlineSwitcherProps {
  locales: readonly Locale[];
  activeLocale: Locale;
  onSelect: (locale: Locale) => void;
  ariaLabel: string;
  kickerLabel: string;
  activeSuffix: string;
  isPending: boolean;
  className?: string;
}

function InlineSwitcher({
  locales,
  activeLocale,
  onSelect,
  ariaLabel,
  kickerLabel,
  activeSuffix,
  isPending,
  className,
}: InlineSwitcherProps) {
  const groupId = useId();
  return (
    <section
      aria-labelledby={groupId}
      data-testid="locale-switcher-inline"
      className={cn('flex flex-col gap-3', className)}
    >
      <h3
        id={groupId}
        className="font-display text-[13px] italic text-encre/55 tracking-[0.04em]"
      >
        {kickerLabel}
      </h3>
      <ul
        role="menu"
        aria-label={ariaLabel}
        aria-orientation="vertical"
        className="flex flex-col"
      >
        {locales.map((loc) => {
          const cfg = getLocaleConfig(loc);
          const isActive = loc === activeLocale;
          return (
            <li key={loc} role="none">
              <button
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                disabled={isPending}
                onClick={() => onSelect(loc)}
                data-testid={`locale-switcher-inline-item-${loc}`}
                data-active={isActive ? 'true' : 'false'}
                lang={loc}
                dir={cfg.direction}
                className={cn(
                  'relative flex min-h-[3.5rem] w-full items-baseline gap-3 py-3 ps-5 pe-3',
                  'font-body text-[12px] uppercase tracking-[0.2em] text-encre',
                  'transition-colors',
                  'hover:bg-petale/25 focus-visible:bg-petale/25 focus-visible:outline-none',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                  isActive && 'font-medium',
                )}
              >
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-2 start-0 w-[2px] bg-sauge"
                  />
                )}
                <span>{loc.toUpperCase()}</span>
                <span className="font-body text-encre/40" aria-hidden="true">
                  —
                </span>
                <span
                  className={cn(
                    'font-display text-base italic normal-case tracking-normal',
                    isActive ? 'text-encre' : 'text-encre/70',
                  )}
                >
                  {cfg.displayNameNative}
                </span>
                {isActive && (
                  <span className="sr-only">{` (${activeSuffix})`}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
