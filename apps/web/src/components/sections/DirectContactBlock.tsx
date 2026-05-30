/**
 * `DirectContactBlock` — bloc « Écrire à la maison » + adresse atelier.
 *
 * Phase 7C (2026-05) — Architecture dual (sync + helper async pour i18n) :
 *  - composant sync : strings injectés en prop `strings`, sinon FR legacy.
 *  - `getDirectContactStringsForLocale(locale)` — helper exporté.
 *
 * Clés `marketing.contact.direct.{kicker_write,kicker_atelier,response_time,
 * appointment_only,street_address,district}` — présentes FR / AR / EN.
 * L'adresse atelier est localisée (translittération arabe alignée au footer).
 *
 * @see docs/i18n-strategy-2026-05/PHASE-7-AUDIT.md §A2
 */
import { getTranslations } from 'next-intl/server';

import { Container } from '@/components/ui/Container';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import type { Locale } from '@/i18n.config';

export interface DirectContactStrings {
  kickerWrite: string;
  kickerAtelier: string;
  responseTime: string;
  appointmentOnly: string;
  /** Adresse atelier localisée (rue). Garde les chiffres en latin. */
  streetAddress: string;
  /** Ville/quartier localisé. */
  district: string;
}

interface DirectContactBlockProps {
  email: string;
  /**
   * Adresse rue affichée. Optionnelle : si absente, on prend
   * `strings.streetAddress` (localisé). Conservée pour compat appelants legacy.
   */
  streetAddress?: string;
  /** Ville/quartier affiché. Si absent, `strings.district` (localisé). */
  district?: string;
  strings?: DirectContactStrings;
}

const LEGACY_FR: DirectContactStrings = {
  kickerWrite: 'Écrire',
  kickerAtelier: 'Atelier',
  responseTime: 'Réponse sous 24 heures ouvrées, depuis Rabat.',
  appointmentOnly: 'Sur rendez-vous.',
  streetAddress: '25 bis avenue Patrice Lumumba',
  district: 'Rabat',
};

export async function getDirectContactStringsForLocale(
  locale: Locale,
): Promise<DirectContactStrings> {
  const t = await getTranslations({
    locale,
    namespace: 'marketing.contact.direct',
  });
  return {
    kickerWrite: t('kicker_write'),
    kickerAtelier: t('kicker_atelier'),
    responseTime: t('response_time'),
    appointmentOnly: t('appointment_only'),
    streetAddress: t('street_address'),
    district: t('district'),
  };
}

export function DirectContactBlock({
  email,
  streetAddress,
  district,
  strings = LEGACY_FR,
}: DirectContactBlockProps) {
  const resolvedStreetAddress = streetAddress ?? strings.streetAddress;
  const resolvedDistrict = district ?? strings.district;
  return (
    <section className="border-t border-encre/10 bg-creme py-16 sm:py-20">
      <Container width="content">
        <div className="grid gap-10 md:grid-cols-2 md:gap-16">
          <div className="space-y-3">
            <Kicker>{strings.kickerWrite}</Kicker>
            <Text size="body" tone="default">
              <a
                href={`mailto:${email}?subject=Bonjour`}
                className="underline decoration-encre/20 underline-offset-4 transition-colors duration-base hover:decoration-encre"
              >
                {email}
              </a>
            </Text>
            <Text size="caption" tone="tertiary">
              {strings.responseTime}
            </Text>
          </div>
          <div className="space-y-3 border-t border-sauge pt-6 md:border-t-0 md:border-s md:ps-12 md:pt-0">
            <Kicker>{strings.kickerAtelier}</Kicker>
            <Text size="body" tone="default">
              {resolvedStreetAddress}
              <br />
              {resolvedDistrict}
            </Text>
            <Text size="caption" tone="tertiary">
              {strings.appointmentOnly}
            </Text>
          </div>
        </div>
      </Container>
    </section>
  );
}
