/**
 * Planification de campagne — conversion wall-clock ↔ UTC TZ-aware (F05 é5,
 * CMP-F07). Le datetime-local saisi par l'opératrice est une HEURE MURALE dans
 * `Africa/Casablanca` ; on la convertit en instant UTC en lisant l'offset réel
 * À L'INSTANT T (jamais codé en dur) — le Maroc est à +01 mais SUSPEND l'heure
 * d'été pendant le ramadan (retour à +00), donc l'offset varie dans l'année.
 *
 * Implémentation via `Intl` (zéro dépendance) : on mesure l'offset de la TZ pour
 * un instant donné en comparant son rendu TZ à son rendu UTC.
 */
import 'server-only';

export const CAMPAIGN_DEFAULT_TZ = 'Africa/Casablanca';

/**
 * Offset (ms) de la timezone `tz` à l'instant `instant` : (heure rendue en tz)
 * − (heure rendue en UTC). Positif à l'est de Greenwich.
 */
export function tzOffsetMs(instant: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const p = Object.fromEntries(dtf.formatToParts(instant).map((x) => [x.type, x.value]));
  // `hour` peut valoir '24' à minuit selon l'implémentation → normaliser.
  const hour = p.hour === '24' ? '00' : p.hour;
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(hour),
    Number(p.minute),
    Number(p.second),
  );
  return asUtc - instant.getTime();
}

/** Parse un `datetime-local` "YYYY-MM-DDTHH:MM" (sans secondes ni offset). */
function parseLocalParts(local: string): { y: number; mo: number; d: number; h: number; mi: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local.trim());
  if (!m) return null;
  return { y: +m[1]!, mo: +m[2]!, d: +m[3]!, h: +m[4]!, mi: +m[5]! };
}

/**
 * Convertit une heure murale (datetime-local) de la TZ `tz` en instant UTC,
 * en respectant l'offset RÉEL (DST/ramadan) — double passe pour les bascules.
 * Retourne `null` si le format est invalide.
 */
export function wallClockToUtc(local: string, tz: string = CAMPAIGN_DEFAULT_TZ): Date | null {
  const p = parseLocalParts(local);
  if (!p) return null;
  // 1re estimation : on traite la murale comme si c'était de l'UTC.
  const guess = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi);
  const off1 = tzOffsetMs(new Date(guess), tz);
  let utc = guess - off1;
  // 2e passe : l'offset à l'instant calculé peut différer (bascule DST) →
  // on recalcule avec l'offset effectif de cet instant.
  const off2 = tzOffsetMs(new Date(utc), tz);
  if (off2 !== off1) utc = guess - off2;
  return new Date(utc);
}

/** Réaffiche un instant UTC en heure murale "YYYY-MM-DDTHH:MM" de la TZ. */
export function utcToWallClock(instant: Date, tz: string = CAMPAIGN_DEFAULT_TZ): string {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const p = Object.fromEntries(dtf.formatToParts(instant).map((x) => [x.type, x.value]));
  const hour = p.hour === '24' ? '00' : p.hour;
  return `${p.year}-${p.month}-${p.day}T${hour}:${p.minute}`;
}

export type ScheduleValidation =
  | { ok: true; instant: Date }
  | { ok: false; error: string };

export const SCHEDULE_PAST_ERROR =
  '⚠ La date de planification est dans le passé — choisissez un créneau futur.';
export const SCHEDULE_MISSING_ERROR =
  '⚠ Choisissez une date et une heure d’envoi (mode planifié).';
export const SCHEDULE_INVALID_ERROR = '⚠ Date/heure invalide.';

/**
 * Valide une planification (mode 'scheduled') : date présente, format correct,
 * et instant STRICTEMENT futur (sur l'instant CONVERTI, pas sur la murale).
 * `mode='now'` → toujours ok (pas de date requise).
 */
export function validateSchedule(
  mode: 'now' | 'scheduled',
  local: string | null | undefined,
  tz: string = CAMPAIGN_DEFAULT_TZ,
  now: Date = new Date(),
): ScheduleValidation {
  if (mode === 'now') return { ok: true, instant: now };
  if (!local || !local.trim()) return { ok: false, error: SCHEDULE_MISSING_ERROR };
  const instant = wallClockToUtc(local, tz);
  if (!instant) return { ok: false, error: SCHEDULE_INVALID_ERROR };
  if (instant.getTime() <= now.getTime()) return { ok: false, error: SCHEDULE_PAST_ERROR };
  return { ok: true, instant };
}
