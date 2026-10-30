/**
 * Kit CRO v2 §4 — les messages i18n de repli portent bien les nouveaux
 * libellés (FR/AR/EN) et le jeton `{price}` là où le prix est attendu.
 */
import { describe, expect, it } from 'vitest';

import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import fr from '../../../messages/fr.json';

import { DEFAULT_KIT_CTA_COPY } from './cta-copy';

const EXPECTED = {
  fr: { primary: 'Je commande — {price}', sticky: 'Je commande', microcopy: 'Je paie à la livraison' },
  ar: { primary: 'اطلبي الآن — {price}', sticky: 'اطلبي الآن', microcopy: 'الدفع عند الاستلام' },
  en: { primary: 'Order now — {price}', sticky: 'Order now', microcopy: 'Pay on delivery' },
} as const;

const MESSAGES = { fr, ar, en } as const;

describe('messages marketing.kit.cta', () => {
  for (const locale of ['fr', 'ar', 'en'] as const) {
    it(`${locale} : libellés directs`, () => {
      expect(MESSAGES[locale].marketing.kit.cta).toEqual(EXPECTED[locale]);
    });

    it(`${locale} : bouton du bloc pack = gabarit avec {price}`, () => {
      expect(MESSAGES[locale].marketing.kit.product_feed.hero.cta_label).toBe(
        EXPECTED[locale].primary,
      );
    });
  }

  it('le repli FR du code reprend les messages FR', () => {
    expect(DEFAULT_KIT_CTA_COPY.primary).toBe(EXPECTED.fr.primary);
    expect(DEFAULT_KIT_CTA_COPY.sticky).toBe(EXPECTED.fr.sticky);
    expect(DEFAULT_KIT_CTA_COPY.microcopy).toBe(EXPECTED.fr.microcopy);
  });
});
