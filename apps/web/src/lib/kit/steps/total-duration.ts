/**
 * Helper pur — additionne les durées de plusieurs steps et retourne
 * une string formatée FR (« 5 minutes »).
 *
 * Format accepté en entrée : « 30 s », « 1 min », « 2 min », « 90 s ».
 * NBSP (U+00A0) et espace standard tous deux acceptés.
 *
 * Si une durée est absente ou inparseable, elle est ignorée
 * silencieusement (pas d'exception). Renvoie `null` si la somme est 0.
 */
const DURATION_RE = /^(\d+)\s*(s|min)\b/i;

function parseSeconds(label: string | undefined): number | null {
  if (!label) return null;
  const normalized = label.replace(/ /g, ' ').trim();
  const m = normalized.match(DURATION_RE);
  if (!m) return null;
  const value = Number.parseInt(m[1]!, 10);
  if (!Number.isFinite(value) || value < 0) return null;
  const unit = m[2]!.toLowerCase();
  return unit === 'min' ? value * 60 : value;
}

interface StepLike {
  duration?: string;
}

/**
 * Calcule la durée totale d'une liste de steps.
 * Retourne `null` si aucune durée parseable ne ressort.
 */
export function computeTotalDuration(steps: ReadonlyArray<StepLike>): string | null {
  if (!steps || steps.length === 0) return null;
  let totalSec = 0;
  for (const step of steps) {
    const sec = parseSeconds(step.duration);
    if (sec !== null) totalSec += sec;
  }
  if (totalSec <= 0) return null;

  // Formatage FR : si > 60 s, on convertit en minutes entières.
  if (totalSec >= 60) {
    const minutes = Math.round(totalSec / 60);
    return `${minutes} minutes`;
  }
  return `${totalSec} s`;
}
