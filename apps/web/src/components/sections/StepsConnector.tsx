/**
 * `StepsConnector` — décoration visuelle qui relie les 4 cartes du
 * rituel (Kolenda §4.7 Attention #12 — directional cues).
 *
 * Mobile (< sm) : timeline verticale `2px bg-encre/10` à gauche des
 * pastilles → l'œil descend le rituel comme un parcours.
 * Tablet (sm < x < lg) : aucun connecteur (la grille 2 cols casserait
 * l'alignement).
 * Desktop (≥ lg) : ligne pointillée horizontale au centre des
 * pastilles → l'œil glisse 1 → 2 → 3 → 4.
 *
 * Purement visuel — `aria-hidden`. Server Component pur.
 */
export interface StepsConnectorProps {
  ariaHidden?: boolean;
}

export function StepsConnector({
  ariaHidden = true,
}: StepsConnectorProps): JSX.Element {
  return (
    <>
      {/* Desktop : ligne pointillée horizontale au centre des pastilles
          (pastille = 48 px, top:6 = 24 px → centre 24 px). Z-index 0 :
          passe sous les cartes (z-10 implicite via flow). */}
      <span
        aria-hidden={ariaHidden}
        data-testid="steps-connector-desktop"
        className="pointer-events-none absolute inset-x-0 top-6 hidden h-px border-t border-dashed border-encre/15 lg:block"
      />
      {/* Mobile : timeline verticale à 24 px depuis la gauche (centre de
          la pastille 48 px). `bottom-2 top-2` ménage 8 px de respiration
          en haut et en bas de la liste. */}
      <span
        aria-hidden={ariaHidden}
        data-testid="steps-connector-mobile"
        className="pointer-events-none absolute bottom-2 start-6 top-2 w-px bg-encre/10 sm:hidden"
      />
    </>
  );
}
