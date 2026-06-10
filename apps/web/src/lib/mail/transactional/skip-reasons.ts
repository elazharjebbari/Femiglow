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
  suppressed: 'adresse en liste de suppression',
  cap_exceeded: 'au-delà du plafond de tentatives',
};

/**
 * Agrège les raisons EN LES COMPTANT (spec F04 §4) :
 * `[not_found, not_found, wrong_status]` → « 2 non trouvé · 1 statut non relançable ».
 * Une seule occurrence → « non trouvé » (sans le « 1 », plus naturel dans
 * « 1 ignoré (non trouvé) »). Fallback : clé brute (honnête plutôt que muet).
 */
export function formatSkipReasons(
  skippedIds: ReadonlyArray<{ reason: string }> | undefined,
): string {
  const counts = new Map<string, number>();
  for (const s of skippedIds ?? []) {
    const label = SKIP_REASON_LABELS_FR[s.reason] ?? s.reason;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  // Une seule raison distincte → label nu (« 2 ignorés (statut non relançable) » :
  // le compte vit déjà dans « 2 ignorés ») ; plusieurs → comptées une à une.
  return Array.from(counts.entries())
    .map(([label, n]) => (counts.size > 1 ? `${n} ${label}` : label))
    .join(' · ');
}
