/**
 * Drift snapshot ↔ audience live (F08 étape 3 — AUD-03/11).
 *
 * Un snapshot est une photo figée : entre sa création et l'envoi, l'audience
 * live bouge (inscriptions, désinscriptions, suppression list). Ces helpers
 * quantifient l'écart pour que l'opératrice détecte un snapshot périmé AVANT
 * d'envoyer dessus (seuil d'alerte : > 10 % strict).
 *
 * Le live count est calculé UNE fois par chargement de page (RSC détail,
 * previewAudienceSize borné) — jamais dans la boucle d'auto-refresh 4 s.
 */

/** Seuil (strict, en %) au-delà duquel le drift est surligné + bandeau. */
export const DRIFT_ALERT_PCT = 10;

/**
 * Écart relatif en % (arrondi entier) entre la taille figée et le live.
 * Dénominateur `max(1, size)` : un snapshot vide ne divise jamais par zéro.
 */
export function driftPct(size: number, live: number): number {
  return Math.round((Math.abs(live - size) / Math.max(1, size)) * 100);
}

/** « ▲ +134 (+12 %) » / « ▼ −50 (−8 %) » / « = à jour » (delta nul). */
export function driftLabel(size: number, live: number): string {
  const delta = live - size;
  if (delta === 0) return '= à jour';
  const pct = driftPct(size, live);
  const fmt = new Intl.NumberFormat('fr-FR');
  return delta > 0
    ? `▲ +${fmt.format(delta)} (+${pct} %)`
    : `▼ −${fmt.format(Math.abs(delta))} (−${pct} %)`;
}

/**
 * Âge relatif FR d'un snapshot : « à l'instant » (<60 s), « il y a N min »,
 * « il y a N h » (<24 h), « il y a N j ». Indépendant de la TZ (différence).
 */
export function relativeAge(iso: string, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'à l’instant';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  return `il y a ${Math.floor(hours / 24)} j`;
}

/** « JJ/MM » dans la TZ d'affichage (date de purge auto). */
export function shortDate(iso: string, timeZone: string = 'Africa/Casablanca'): string {
  return new Intl.DateTimeFormat('fr-FR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(iso));
}
