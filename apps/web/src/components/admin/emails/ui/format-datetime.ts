/**
 * Formateur date/heure CENTRAL de la section emails (TRV-05 / DASH-08).
 *
 * Règle (verrou F01-U-068) : AUCUN `toLocaleString`/`toLocaleTimeString`
 * direct dans components/admin/emails/** — tout passe par ici, qui affiche
 * TOUJOURS la timezone (l'audit a montré des heures ambiguës partout).
 */

export const DEFAULT_TIMEZONE = 'Africa/Casablanca';

/** Âge relatif FR : <60 s → « il y a Ns », <60 min → « il y a N min », sinon heures. */
export function formatAge(fromIso: string, now: Date = new Date()): string {
  const from = new Date(fromIso).getTime();
  const seconds = Math.max(0, Math.floor((now.getTime() - from) / 1000));
  if (seconds < 60) return `il y a ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `il y a ${hours} h`;
}

/** Heure absolue « 06/06 14:32 » dans la TZ demandée (libellé TZ à afficher à côté). */
export function formatAbsolute(iso: string, timeZone: string = DEFAULT_TIMEZONE): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** Libellé court d'une TZ IANA (« Africa/Casablanca » → « Casablanca »). */
export function timeZoneLabel(timeZone: string): string {
  return timeZone.split('/').pop()?.replace(/_/g, ' ') ?? timeZone;
}
