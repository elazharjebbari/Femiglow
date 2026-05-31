/**
 * Helpers de formatage français pour Analytics Insights.
 * cf. docs/analytics-insights/13-wizard-design.md §14.3
 *
 * - Espaces insécables U+00A0 pour les milliers et les unités
 * - Virgule décimale française
 * - Devise après le nombre
 * - Durées humaines (s / m / h)
 * - Dates short (JJ/MM) et long (JJ mois AAAA)
 *
 * NOTE : ICU produit U+202F (narrow no-break space) en `fr-FR`. Pour la
 * cohérence avec nos tests et avec les CSV, on normalise vers U+00A0.
 */

const NBSP = ' ';
const NARROW_NBSP_RE = / /g;

function normalizeSpaces(s: string): string {
  return s.replace(NARROW_NBSP_RE, NBSP);
}

const NUMBER_FORMATTER = new Intl.NumberFormat('fr-FR', {
  maximumFractionDigits: 0,
});

const DECIMAL_FORMATTER = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const DATE_LONG_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

const DATE_SHORT_FORMATTER = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  timeZone: 'UTC',
});

export function formatNumber(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return normalizeSpaces(NUMBER_FORMATTER.format(v));
}

export function formatDecimal(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return normalizeSpaces(DECIMAL_FORMATTER.format(v));
}

export function formatPercent(
  v: number | null | undefined,
  digits: 0 | 1 | 2 = 1,
): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const formatter = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return `${normalizeSpaces(formatter.format(v * 100))}${NBSP}%`;
}

export function formatVariation(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  const sign = v > 0 ? '+' : v < 0 ? '' : '±';
  const formatter = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  });
  return `${sign}${normalizeSpaces(formatter.format(v * 100))}${NBSP}%`;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '—';
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}${NBSP}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) {
    return rem === 0 ? `${m}${NBSP}m` : `${m}${NBSP}m${NBSP}${rem}${NBSP}s`;
  }
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return remM === 0 ? `${h}${NBSP}h` : `${h}${NBSP}h${NBSP}${remM}${NBSP}m`;
}

export function formatCurrency(cents: number | null | undefined, currency = 'MAD'): string {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return '—';
  return `${formatNumber(Math.round(cents / 100))}${NBSP}${currency}`;
}

export function formatDateLong(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  return DATE_LONG_FORMATTER.format(date);
}

export function formatDateShort(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  return DATE_SHORT_FORMATTER.format(date);
}

export function formatRelativeTime(d: Date | string | null, now: Date = new Date()): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '—';
  const diffSec = Math.round((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 5) return "à l'instant";
  if (diffSec < 60) return `il y a ${diffSec}${NBSP}s`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `il y a ${diffMin}${NBSP}min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}${NBSP}h`;
  const diffJ = Math.round(diffH / 24);
  return `il y a ${diffJ}${NBSP}j`;
}
