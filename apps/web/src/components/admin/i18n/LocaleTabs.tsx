/**
 * LocaleTabs — sélecteur de langue pour l'édition de bindings CMS (T3.8).
 *
 * Rend une barre d'onglets `role="tablist"` avec un bouton par locale activée
 * (FR / AR / EN dans l'ordre de `LOCALES`). L'onglet actif porte
 * `aria-selected="true"`, les autres `aria-selected="false"`.
 *
 * Le composant est **présentationnel** : il ne gère pas d'état interne ; le
 * parent (`LocaleEditorShell`) tient l'`activeLocale` et déclenche un
 * re-mount du formulaire au switch via la prop `key={activeLocale}`.
 *
 * Voix admin : ce composant fait partie du chrome admin, donc reste en FR
 * pur — seules les valeurs des bindings sont multilingues (cf. ADR-008).
 *
 * @see apps/web/src/i18n.config.ts — `LOCALES`, `getLocaleConfig`
 * @see docs/i18n-strategy-2026-05/05-ui-ux-design/locale-switcher-ui.md
 * @see docs/i18n-strategy-2026-05/PHASE-3-PROGRESS.md (T3.8)
 */
'use client';

import { LOCALES, type Locale, getLocaleConfig } from '@/i18n.config';

interface LocaleTabsProps {
  /** Locale actuellement active (contrôle l'onglet pré-sélectionné). */
  activeLocale: Locale;
  /** Callback quand l'utilisateur change d'onglet. */
  onChange: (next: Locale) => void;
  /**
   * Optionnel — pour chaque locale, indique si au moins un binding draft
   * ou published existe. Rendu visuel : point vert si traduit, point gris
   * sinon. Utile pour qu'un éditeur voie immédiatement les locales à
   * compléter. La clé manquante équivaut à `false`.
   */
  completion?: Partial<Record<Locale, boolean>>;
  /** id ARIA pour relier les onglets au tabpanel rendu en dessous. */
  panelId?: string;
}

const ACTIVE_CLASSES =
  'border-stone-900 bg-white text-stone-900 shadow-sm';
const INACTIVE_CLASSES =
  'border-transparent bg-stone-50 text-stone-500 hover:bg-stone-100 hover:text-stone-700';

export function LocaleTabs({
  activeLocale,
  onChange,
  completion,
  panelId,
}: LocaleTabsProps): JSX.Element {
  return (
    <div
      role="tablist"
      aria-label="Locale d'édition"
      className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 p-1"
    >
      {LOCALES.map((locale) => {
        const cfg = getLocaleConfig(locale);
        const isActive = locale === activeLocale;
        const translated = completion?.[locale] === true;
        return (
          <button
            key={locale}
            id={`locale-tab-${locale}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={panelId}
            tabIndex={isActive ? 0 : -1}
            onClick={() => {
              if (!isActive) onChange(locale);
            }}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium uppercase tracking-wide transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-900 focus-visible:ring-offset-1 ${
              isActive ? ACTIVE_CLASSES : INACTIVE_CLASSES
            }`}
            data-locale={locale}
            data-active={isActive ? 'true' : 'false'}
          >
            <span aria-hidden="true" className="text-sm">
              {cfg.flagEmoji}
            </span>
            <span>{locale.toUpperCase()}</span>
            {/* Indicateur de complétion par locale (point coloré).
             * On évite emoji pour rester sobre et a11y-friendly. */}
            <span
              aria-hidden="true"
              className={`ml-0.5 inline-block h-1.5 w-1.5 rounded-full ${
                translated ? 'bg-emerald-500' : 'bg-stone-300'
              }`}
              title={translated ? 'Au moins un champ traduit' : 'Aucun champ traduit'}
            />
            {/* Label accessible explicite : on annonce l'état au screen reader. */}
            <span className="sr-only">
              {cfg.displayName} ({translated ? 'au moins un champ traduit' : 'rien de traduit'})
            </span>
          </button>
        );
      })}
    </div>
  );
}
