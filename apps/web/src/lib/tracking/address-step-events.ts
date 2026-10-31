/**
 * Étape 2 du wizard — événements first-party qui mesurent ce qui se passe
 * entre `generate_lead` et `address_completed` (où, et à quels frais, les
 * clientes s'arrêtent). cf. docs/checkout-etape2-conversion/07-backend-tracking.md.
 *
 * Jamais de texte saisi ici : ni adresse, ni prénom, ni téléphone. Une ville
 * n'apparaît que sous forme de slug du catalogue.
 */

export const STEP2_VARIANTS = ['control', 'v2'] as const;
export type Step2Variant = (typeof STEP2_VARIANTS)[number];

export const ADDRESS_STEP_EVENTS = {
  view: 'address_step_view',
  cityFocus: 'address_city_focus',
  citySelected: 'address_city_selected',
  lineFocus: 'address_line_focus',
  validationError: 'address_validation_error',
  ctaTapIncomplete: 'address_cta_tap_incomplete',
  ctaVisible: 'address_cta_visible',
  abandon: 'address_step_abandon',
  noteOpened: 'address_note_opened',
} as const;

export const ADDRESS_STEP_FIELDS = ['city', 'addressLine1', 'notes'] as const;
export type AddressStepField = (typeof ADDRESS_STEP_FIELDS)[number];

export const ADDRESS_STEP_PHASES = ['city', 'address', 'ready', 'submitting'] as const;
