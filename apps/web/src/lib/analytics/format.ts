/**
 * Helpers de formatage pour KPI / charts analytics.
 * cf. docs/analytics/04-ui-design.md §2.3 et §3.3
 *
 * Conventions FR : espace insécable comme séparateur de milliers, virgule
 * comme séparateur décimal, "%" précédé d'une espace, durée mm:ss / hh:mm.
 */

const NBSP = '\u202f'; // narrow no-break space (FR locale standard)

/** Formate un entier en FR : 12340 → "12 340". null/undefined → "—". */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return new Intl.NumberFormat('fr-FR').format(value).replace(/\u00a0/g, NBSP);
}

/** Formate un ratio en pourcentage : 0.124 → "12,4 %". */
export function formatPercent(value: number | null | undefined, fractionDigits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const formatted = new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  }).format(value);
  return formatted.replace(/\u00a0/g, NBSP);
}

/** Formate une durée en secondes : 125 → "2m 5s", 3725 → "1h 2m". */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '—';
  const total = Math.max(0, Math.round(seconds));
  if (total < 60) return `${total}s`;
  const mins = Math.floor(total / 60);
  if (mins < 60) {
    const s = total - mins * 60;
    return `${mins}m ${s}s`;
  }
  const hours = Math.floor(mins / 60);
  const m = mins - hours * 60;
  return `${hours}h ${m}m`;
}

/**
 * Formate un montant en cents → unité majeure avec devise.
 * MAD : pas de fraction (1 MAD = 100 cents stockés mais affichés 320 MAD).
 * EUR : 2 décimales.
 */
export function formatCurrency(
  cents: number | null | undefined,
  currency: string = 'EUR',
): string {
  if (cents === null || cents === undefined || Number.isNaN(cents)) return '—';
  const major = cents / 100;
  const fractionDigits = currency.toUpperCase() === 'MAD' ? 0 : 2;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
    .format(major)
    .replace(/\u00a0/g, NBSP);
}

/** Formate un delta (variation) avec signe et flèche : 0.124 → "↑ 12,4 %". */
export function formatDelta(
  value: number | null | undefined,
  fractionDigits = 1,
): { label: string; direction: 'up' | 'down' | 'flat' } {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { label: '—', direction: 'flat' };
  }
  if (Math.abs(value) < 1e-6) return { label: `→ 0${NBSP}%`, direction: 'flat' };
  const arrow = value > 0 ? '↑' : '↓';
  const formatted = formatPercent(Math.abs(value), fractionDigits);
  return { label: `${arrow} ${formatted}`, direction: value > 0 ? 'up' : 'down' };
}

/**
 * Formate un timestamp pour l'axe X d'un chart, selon la granularité.
 *  - 'hour' (Today / Yesterday) → "14:00"
 *  - 'day'  (7d / 30d)          → "06 mai"
 *  - 'week' (90d / All)         → "S18"
 */
export function formatBucket(
  date: Date | string | number,
  granularity: 'hour' | 'day' | 'week',
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  switch (granularity) {
    case 'hour':
      // Heure ancrée sur le fuseau Maroc, cohérente avec les bornes de période
      // (cf. AF-04 / F-FMT-01) — sinon l'axe X dérive selon le fuseau du client.
      return d
        .toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Africa/Casablanca',
        })
        .replace(':', 'h');
    case 'day':
      return d.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'short',
        timeZone: 'Africa/Casablanca',
      });
    case 'week': {
      // ISO week number
      const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
      const dayNum = (tmp.getUTCDay() + 6) % 7; // Mon=0
      tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
      const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
      const week =
        1 +
        Math.round(
          ((tmp.getTime() - firstThursday.getTime()) / 86_400_000 -
            3 +
            ((firstThursday.getUTCDay() + 6) % 7)) /
            7,
        );
      return `S${week}`;
    }
  }
}

/** Granularité conseillée pour l'axe X d'un chart selon le span en ms. */
export function suggestGranularity(spanMs: number): 'hour' | 'day' | 'week' {
  const days = spanMs / 86_400_000;
  if (days <= 2) return 'hour';
  if (days <= 60) return 'day';
  return 'week';
}
