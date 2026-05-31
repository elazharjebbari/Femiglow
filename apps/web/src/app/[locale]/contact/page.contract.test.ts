/**
 * Contract test pour `/[locale]/contact/page.tsx`.
 *
 * Vérifie que toutes les clés i18n consommées par la page existent dans
 * les 3 locales FR/AR/EN avec des valeurs non-vides. Garantit qu'aucune
 * traduction n'est manquante au runtime.
 *
 * Tournez ce test après toute modification de la page ou des messages
 * pour détecter immédiatement les drifts (clé supprimée, renommée, etc.).
 *
 * @see apps/web/src/app/[locale]/contact/page.tsx
 * @see apps/web/src/test/helpers/i18n-keys.ts
 */
import { describe } from 'vitest';

import { assertI18nKeysExist } from '@/test/helpers/i18n-keys';

/**
 * Liste exhaustive des clés consommées par `/[locale]/contact/page.tsx`.
 * À garder synchro avec le fichier source — toute clé ajoutée/retirée
 * doit être reflétée ici.
 */
const REQUIRED_KEYS = [
  // generateMetadata
  'marketing.contact.metadata.title',
  'marketing.contact.metadata.description',
  'marketing.contact.metadata.og_description',
  // Form section
  'marketing.contact.form.section_title',
  // Cross-links navigation
  'marketing.contact.crosslinks.rituel',
  'marketing.contact.crosslinks.kit',
  'marketing.contact.crosslinks.maison',
  // FAQ items (5 IDs × 2 keys chacune = 10 keys)
  'marketing.contact.faq.duree.question',
  'marketing.contact.faq.duree.answer',
  'marketing.contact.faq.fragiles.question',
  'marketing.contact.faq.fragiles.answer',
  'marketing.contact.faq.livraison.question',
  'marketing.contact.faq.livraison.answer',
  'marketing.contact.faq.formation.question',
  'marketing.contact.faq.formation.answer',
  'marketing.contact.faq.echantillon.question',
  'marketing.contact.faq.echantillon.answer',
] as const;

describe('Contract: /[locale]/contact — keys exist in FR/AR/EN', () => {
  assertI18nKeysExist(REQUIRED_KEYS);
});
