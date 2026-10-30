/**
 * Kit CRO v2 §4 — cascade des libellés de commande : texte publié (CMS) ▸
 * message i18n ; valeurs par défaut du registre acceptées en FR seulement.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ResolvedField, ResolvedFields } from '@/lib/db/types';

import ar from '../../../messages/ar.json';
import en from '../../../messages/en.json';
import fr from '../../../messages/fr.json';

const resolveComponentFields = vi.fn<(key: string, locale: string) => Promise<ResolvedFields>>();

vi.mock('@/lib/components/field-resolver', () => ({
  resolveComponentFields: (key: string, locale: string) => resolveComponentFields(key, locale),
}));

const MESSAGES = { fr, ar, en } as const;

vi.mock('next-intl/server', () => ({
  getTranslations: async ({ locale }: { locale: keyof typeof MESSAGES }) => {
    const cta = MESSAGES[locale].marketing.kit.cta as Record<string, string>;
    return { raw: (key: string) => cta[key] };
  },
}));

import { resolveKitCtaCopy } from './cta-copy.server';

function field(value: unknown, source: ResolvedField['meta']['source']): ResolvedField {
  return { value, meta: { source, version: source === 'binding' ? 2 : 0, locale: 'fr' } };
}

const REGISTRY_DEFAULTS: ResolvedFields = {
  ctaPrimary: field('Je commande — {price}', 'default'),
  ctaSticky: field('Je commande', 'default'),
  ctaPack: field('Je commande — {price}', 'default'),
  ctaMicrocopy: field('Je paie à la livraison', 'default'),
};

beforeEach(() => {
  resolveComponentFields.mockReset();
});

describe('resolveKitCtaCopy', () => {
  it('lit le composant kit-cta pour la locale demandée', async () => {
    resolveComponentFields.mockResolvedValue({});
    await resolveKitCtaCopy('ar');
    expect(resolveComponentFields).toHaveBeenCalledWith('kit-cta', 'ar');
  });

  it('FR sans texte publié : valeurs du registre (= messages FR), pas de gabarit pack', async () => {
    resolveComponentFields.mockResolvedValue(REGISTRY_DEFAULTS);
    expect(await resolveKitCtaCopy('fr')).toEqual({
      primary: 'Je commande — {price}',
      sticky: 'Je commande',
      microcopy: 'Je paie à la livraison',
    });
  });

  it('AR : ignore les valeurs FR du registre, prend les messages AR', async () => {
    resolveComponentFields.mockResolvedValue(REGISTRY_DEFAULTS);
    expect(await resolveKitCtaCopy('ar')).toEqual({
      primary: 'اطلبي الآن — {price}',
      sticky: 'اطلبي الآن',
      microcopy: 'الدفع عند الاستلام',
    });
  });

  it('EN : messages EN', async () => {
    resolveComponentFields.mockResolvedValue(REGISTRY_DEFAULTS);
    expect(await resolveKitCtaCopy('en')).toEqual({
      primary: 'Order now — {price}',
      sticky: 'Order now',
      microcopy: 'Pay on delivery',
    });
  });

  it('texte publié : prime sur les messages, dans toutes les locales', async () => {
    resolveComponentFields.mockResolvedValue({
      ctaPrimary: field('اطلبي كيتكِ — {price}', 'binding'),
      ctaPack: field('اطلبي الكيت — {price}', 'binding'),
      ctaSticky: field('   ', 'binding'),
    });
    expect(await resolveKitCtaCopy('ar')).toEqual({
      primary: 'اطلبي كيتكِ — {price}',
      // Texte publié vide → message.
      sticky: 'اطلبي الآن',
      microcopy: 'الدفع عند الاستلام',
      pack: 'اطلبي الكيت — {price}',
    });
  });

  it('base indisponible : messages i18n, sans exception', async () => {
    resolveComponentFields.mockRejectedValue(new Error('db down'));
    expect(await resolveKitCtaCopy('fr')).toEqual({
      primary: 'Je commande — {price}',
      sticky: 'Je commande',
      microcopy: 'Je paie à la livraison',
    });
  });
});
