/**
 * Ligne de sensation physique d'un sous-produit, affichée sous la
 * description courte. Italique Cormorant Garamond, encre désaturée 70 %.
 *
 * Kolenda §4.3 + UX §13 : induce sensation = preuve d'efficacité par
 * description physique (« Tiède au contact. », « Glisse, ne grise pas. »).
 *
 * Le texte est déjà encadré par `« … »` côté caller (cf.
 * `lib/composition/copy.ts::formatSensation`).
 */
export interface SensationLineProps {
  /** Texte déjà formaté avec guillemets français. */
  text: string;
}

export function SensationLine({ text }: SensationLineProps): JSX.Element {
  return (
    <p
      className="font-display italic text-encre/70 text-[15px] leading-snug pt-1"
      data-testid="composition-card-sensation"
    >
      {text}
    </p>
  );
}
