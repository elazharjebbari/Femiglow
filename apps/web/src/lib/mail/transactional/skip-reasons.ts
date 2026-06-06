/**
 * Traductions FR des raisons d'ignorés renvoyées par les actions bulk
 * (bulk-retry / bulk-suppress) — CKPT-02 : avant ce module, `not_found` et
 * `wrong_status` fuyaient en anglais brut dans le feedback opérateur.
 *
 * Toute nouvelle raison côté `bulk-actions.ts` DOIT recevoir son libellé ici
 * (le fallback renvoie la clé brute pour rester honnête plutôt que muet).
 */
export const SKIP_REASON_LABELS_FR: Record<string, string> = {
  not_found: 'non trouvé',
  wrong_status: 'statut non relançable',
};

/** "not_found, wrong_status" → "non trouvé, statut non relançable" (dédupliqué). */
export function formatSkipReasons(
  skippedIds: ReadonlyArray<{ reason: string }> | undefined,
): string {
  return Array.from(
    new Set((skippedIds ?? []).map((s) => SKIP_REASON_LABELS_FR[s.reason] ?? s.reason)),
  ).join(', ');
}
