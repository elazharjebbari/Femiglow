/**
 * Formatage de la date d'un article de journal.
 *
 * Phase 9 i18n STRICT — `locale` optionnel :
 *  - FR (défaut) / EN : comportement legacy (`fr-FR`, jour mois année).
 *  - AR : mois arabes via `Intl.DateTimeFormat('ar-u-nu-latn', …)` →
 *    on conserve des **chiffres latins** (cohérence de marque) tout en
 *    affichant le nom du mois en arabe (mai → مايو…). Aucun latin ne fuite.
 *
 * Les formatters sont mémoïsés par locale pour éviter de reconstruire un
 * `Intl.DateTimeFormat` à chaque rendu.
 */
const OPTIONS: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
};

const DEFAULT_FORMATTER = new Intl.DateTimeFormat('fr-FR', OPTIONS);

const FORMATTERS = new Map<string, Intl.DateTimeFormat>([
  ['fr', DEFAULT_FORMATTER],
]);

function resolveFormatter(locale?: string): Intl.DateTimeFormat {
  if (!locale || locale === 'fr') return DEFAULT_FORMATTER;
  const cached = FORMATTERS.get(locale);
  if (cached) return cached;
  // AR : chiffres latins forcés (`-u-nu-latn`) + mois arabes.
  // EN : en-US classique. Autre : on retombe sur le tag tel quel.
  const intlLocale = locale === 'ar' ? 'ar-u-nu-latn' : locale;
  const fmt = new Intl.DateTimeFormat(intlLocale, OPTIONS);
  FORMATTERS.set(locale, fmt);
  return fmt;
}

export function formatArticleDate(date: Date, locale?: string): string {
  return resolveFormatter(locale).format(date);
}
