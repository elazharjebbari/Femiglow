/**
 * Cover SVG par défaut pour la section vidéo `/kit` — dégradé pur charte
 * graphique, sans dessin ni texte. Trois stops du token system :
 *   - `#FBF8F1` crème
 *   - `#E8D9BC` champagne soft
 *   - `#C5DBC4` sauge
 *
 * Linear gradient diagonal (top-left → bottom-right) sur viewBox 9:16
 * (1080×1920). Pas d'animation, pas de filtre — repose purement sur le
 * voile encre 25 % et le bouton play du parent pour la lisibilité.
 */

/**
 * Construit le SVG de cover avec un `<title>` localisé. Le titre est une
 * étiquette d'accessibilité rendue dans la locale active (FemiGlow reste latin).
 */
function buildKitVideoCoverSvg(title: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" preserveAspectRatio="xMidYMid slice" role="img" aria-labelledby="cover-title">
<title id="cover-title">${title}</title>
<defs>
<linearGradient id="brand" x1="0%" y1="0%" x2="100%" y2="100%">
<stop offset="0%" stop-color="#FBF8F1"/>
<stop offset="50%" stop-color="#E8D9BC"/>
<stop offset="100%" stop-color="#C5DBC4"/>
</linearGradient>
</defs>
<rect width="1080" height="1920" fill="url(#brand)"/>
</svg>`;
}

/** Titre du cover (FR) — `FemiGlow` reste latin. */
export const DEFAULT_KIT_VIDEO_COVER_TITLE = 'Ambiance maison FemiGlow';

export const DEFAULT_KIT_VIDEO_COVER_SVG = buildKitVideoCoverSvg(
  DEFAULT_KIT_VIDEO_COVER_TITLE,
);

export const DEFAULT_KIT_VIDEO_COVER_ARIA_LABEL =
  'Ambiance maison FemiGlow — dégradé crème, champagne et sauge.';

// ---- Variantes arabes (RTL) — translittération avec FemiGlow latin ----

/** Titre du cover (AR) — `FemiGlow` reste latin. */
export const KIT_VIDEO_COVER_TITLE_AR = 'أجواء دار FemiGlow';

export const KIT_VIDEO_COVER_SVG_AR = buildKitVideoCoverSvg(
  KIT_VIDEO_COVER_TITLE_AR,
);

export const KIT_VIDEO_COVER_ARIA_LABEL_AR =
  'أجواء دار FemiGlow — تدرّج لوني كريمي وشمبانيا ومريمية.';
