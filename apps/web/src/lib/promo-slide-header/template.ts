const TEMPLATE_VAR_RE = /\{([a-zA-Z][a-zA-Z0-9]*)\}/g;
const SUPPORTED_VARS = new Set(['date', 'dateShort', 'city', 'region', 'country']);

export interface PromoTemplateContext {
  date: string;
  dateShort: string;
  city: string | null;
  region: string | null;
  country: string | null;
}

export function formatPromoDates(now = new Date()): {
  date: string;
  dateShort: string;
} {
  const long = new Intl.DateTimeFormat('fr-MA', {
    timeZone: 'Africa/Casablanca',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(now);
  const short = new Intl.DateTimeFormat('fr-MA', {
    timeZone: 'Africa/Casablanca',
    day: 'numeric',
    month: 'long',
  }).format(now);
  return { date: long, dateShort: short };
}

export function renderPromoTemplate(
  template: string,
  fallbackTemplate: string,
  ctx: PromoTemplateContext,
): string {
  const selected = ctx.city ? template : fallbackTemplate;
  const hasUnknownVar = Array.from(selected.matchAll(TEMPLATE_VAR_RE)).some(
    (match) => !SUPPORTED_VARS.has(match[1] ?? ''),
  );
  const safeTemplate = hasUnknownVar
    ? ctx.city
      ? 'Offre du {dateShort} - {city}'
      : 'Offre du {dateShort} - Maroc'
    : selected;

  const rendered = safeTemplate.replace(TEMPLATE_VAR_RE, (_full, key: string) => {
    if (key === 'date') return ctx.date;
    if (key === 'dateShort') return ctx.dateShort;
    if (key === 'city') return ctx.city ?? '';
    if (key === 'region') return ctx.region ?? '';
    if (key === 'country') return ctx.country ?? '';
    return '';
  });

  return rendered.replace(/\s+/g, ' ').trim();
}
