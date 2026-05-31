/**
 * Politique de retry centralisée pour les jobs publishing.
 *
 * Référence : `docs/live-systems-fix-2026-05/07-system-publishing.md` § QW4
 *
 * Audit a identifié : aucun cap sur `attemptCount` → un admin qui retry
 * manuellement crée potentiellement une boucle infinie via cron auto-retry.
 *
 * Stratégie :
 *  - MAX_ATTEMPTS = 5 (cohérent avec norme industrie pour publishing)
 *  - Backoff exponentiel : 1min → 5min → 15min → 1h → 6h
 *  - Au-delà : dead letter (status='dead' + audit log alerte)
 *
 * Pure function — testable en isolation, pas d'I/O.
 */

export const MAX_ATTEMPTS = 5;

/**
 * Backoff exponentiel en minutes selon le numéro d'attempt suivant.
 * - attempt 0 → 1 (1ère retry après 1min)
 * - attempt 1 → 5
 * - attempt 2 → 15
 * - attempt 3 → 60 (1h)
 * - attempt 4 → 360 (6h)
 * - attempt 5+ → dead letter (pas de retry)
 */
const BACKOFF_MINUTES = [1, 5, 15, 60, 360];

export interface RetryDecision {
  shouldRetry: boolean;
  nextRetryAt: Date | null;
  isDeadLetter: boolean;
  reason: string;
}

/**
 * Décide si un job peut être retried et calcule la prochaine date.
 *
 * @param attemptCount Nombre de tentatives ALREADY effectuées (0 = aucune)
 * @returns Decision contenant shouldRetry / nextRetryAt / isDeadLetter
 */
export function decideRetry(attemptCount: number): RetryDecision {
  if (attemptCount >= MAX_ATTEMPTS) {
    return {
      shouldRetry: false,
      nextRetryAt: null,
      isDeadLetter: true,
      reason: `Max attempts reached (${attemptCount}/${MAX_ATTEMPTS})`,
    };
  }
  const minutes = BACKOFF_MINUTES[attemptCount] ?? BACKOFF_MINUTES[BACKOFF_MINUTES.length - 1]!;
  return {
    shouldRetry: true,
    nextRetryAt: new Date(Date.now() + minutes * 60 * 1000),
    isDeadLetter: false,
    reason: `Retry in ${minutes}min (attempt ${attemptCount + 1}/${MAX_ATTEMPTS})`,
  };
}

/**
 * True si le job a atteint le cap → doit être marqué `dead`.
 */
export function isDeadLetter(attemptCount: number): boolean {
  return attemptCount >= MAX_ATTEMPTS;
}

/**
 * Helper FYI : combien de temps total avant dead letter (en heures)
 * en partant d'attempt 0 ? Utile pour SLA documentation.
 */
export function timeBeforeDeadLetterHours(): number {
  const totalMinutes = BACKOFF_MINUTES.reduce((acc, m) => acc + m, 0);
  return Math.round((totalMinutes / 60) * 10) / 10; // 1 décimale
}
