/**
 * Copy + feature flags du wizard checkout `/kit` (Kolenda §5).
 *
 * Source de vérité unique pour les chaînes affichées par les nouveaux
 * composants (Cart-recap, NoCommitmentBadge, TimeEstimate, etc.). Un
 * override admin (Phase W5) peut patcher chaque champ individuellement
 * via `resolveWizardCopy(override)` qui merge sur les défauts.
 *
 * Les feature flags permettent de désactiver une amélioration sans
 * redéploiement — utile pour rollback rapide d'un feature problématique.
 */

export interface WizardCopy {
  /** Step 1 — CTA principal. */
  ctaLead: string;
  /** Step 2 — CTA principal. */
  ctaAddress: string;
  /** Step 2 — Badge no-commitment label principal. */
  noCommitmentLabel: string;
  /** Step 2 — Badge no-commitment sub italique. */
  noCommitmentSub: string;
  /** Wizard header — durée totale estimée. */
  timeEstimateTotal: string;
  /** Indicator — durée step lead. */
  timeEstimateLead: string;
  /** Indicator — durée step address. */
  timeEstimateAddress: string;
  /** Indicator — durée step thank-you. */
  timeEstimateThankYou: string;
  /** Step 1 — Label du consent checkbox. */
  consentLabel: string;
  /** Step 1 — Footnote sous le consent (avec lien mentions légales). */
  consentFootnote: string;
  /** ResumeBanner — template avec `{firstName}` placeholder. */
  resumeBannerTemplate: string;
}

export interface WizardFeatureFlags {
  /** Mini cart-recap permanent en haut du wizard. */
  cartRecap: boolean;
  /** Badge « Aucun paiement maintenant » step 2. */
  noCommitmentBadge: boolean;
  /** Estimateur temps global + per-step. */
  timeEstimate: boolean;
  /** Masque téléphone live `06 12 34 56 78`. */
  phoneMask: boolean;
  /** Check ✓ à droite du label quand champ valide. */
  fieldCheckmark: boolean;
  /** Banner « Bon retour, {firstName} » si leadDraft restauré. */
  resumeBanner: boolean;
  /** Thumbnail packshot 64×80 mobile dans header KitCommanderSection. */
  mobilePackThumbnail: boolean;
}

export const DEFAULT_WIZARD_COPY: WizardCopy = {
  ctaLead: 'Continuer · paiement à la livraison',
  ctaAddress: 'Confirmer la commande',
  noCommitmentLabel: 'Aucun paiement maintenant',
  noCommitmentSub: 'Vous payez à la livraison, en main',
  timeEstimateTotal: '≈ 90 secondes pour confirmer',
  timeEstimateLead: '60 s',
  timeEstimateAddress: '30 s',
  timeEstimateThankYou: '5 s',
  consentLabel: 'Je veux être rappelée pour confirmer ma commande',
  consentFootnote: 'Pas de revente, pas de spam — mentions légales',
  resumeBannerTemplate:
    'Bon retour, {firstName} — on reprend où vous en étiez.',
};

export const DEFAULT_WIZARD_FEATURES: WizardFeatureFlags = {
  cartRecap: true,
  noCommitmentBadge: true,
  timeEstimate: true,
  phoneMask: true,
  fieldCheckmark: true,
  resumeBanner: true,
  mobilePackThumbnail: true,
};

/**
 * Résout la copy avec un override partiel. Les champs absents ou
 * `null`/`undefined` reprennent les valeurs par défaut.
 */
export function resolveWizardCopy(
  override?: Partial<WizardCopy> | null,
): WizardCopy {
  if (!override) return DEFAULT_WIZARD_COPY;
  const result = { ...DEFAULT_WIZARD_COPY };
  for (const key of Object.keys(override) as Array<keyof WizardCopy>) {
    const value = override[key];
    if (typeof value === 'string' && value.length > 0) {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Résout les feature flags avec un override partiel. Les flags absents
 * reprennent les valeurs par défaut (toutes à `true`).
 */
export function resolveWizardFeatures(
  override?: Partial<WizardFeatureFlags> | null,
): WizardFeatureFlags {
  if (!override) return DEFAULT_WIZARD_FEATURES;
  const result = { ...DEFAULT_WIZARD_FEATURES };
  for (const key of Object.keys(override) as Array<keyof WizardFeatureFlags>) {
    const value = override[key];
    if (typeof value === 'boolean') {
      result[key] = value;
    }
  }
  return result;
}
