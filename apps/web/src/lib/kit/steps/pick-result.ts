/**
 * Helper pur — retourne le step marqué `isResult: true`, ou à défaut
 * le dernier step de la liste (convention métier — step 4).
 *
 * Renvoie `null` si la liste est vide.
 */

interface StepLike {
  step: number;
  isResult?: boolean;
}

export function pickResultStep<T extends StepLike>(
  steps: ReadonlyArray<T>,
): T | null {
  if (!steps || steps.length === 0) return null;
  const explicit = steps.find((s) => s.isResult === true);
  if (explicit) return explicit;
  return steps[steps.length - 1] ?? null;
}
