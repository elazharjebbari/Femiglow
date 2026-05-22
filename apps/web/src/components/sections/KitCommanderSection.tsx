'use client';

/**
 * CHA-231 — Section commander embarquée sur /kit.
 *
 * Embed du wizard checkout (Mode A — `wizard_kit`, `wizard_embed`) directement
 * dans la page produit. Ancre #commander-femiglow ciblée par la sticky CTA et
 * les boutons « Commander » in-page.
 *
 * Responsabilité
 * ──────────────
 * - Reçoit le snapshot panier déjà construit côté serveur (Server Component
 *   parent — `KitPage` — pour ne pas dupliquer la requête DB).
 * - Monte le WizardShell avec le profil Mode A (lead → address → thank_you).
 * - Encadre le shell dans un cadre éditorial sobre, voix FemiGlow.
 *
 * Pourquoi pas un Server Component ?
 * ──────────────────────────────────
 * Le WizardShell est `'use client'` (Zustand store + form state). On garde la
 * section côté client pour pouvoir injecter directement les props sans wrapper
 * intermédiaire. Le coût bundle est marginal (la section ne fait que rendre
 * du markup statique autour du WizardShell qui est déjà côté client).
 */

import type { ReactNode } from 'react';

import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';
import { WizardShell } from '@/components/checkout/wizard/WizardShell';
import { WizardMobilePackThumb } from '@/components/checkout/wizard/WizardMobilePackThumb';
import { DEFAULT_WIZARD_FEATURES } from '@/lib/checkout/copy/wizard-copy';
import type { CartSnapshot } from '@/lib/checkout/schemas/common';
import type { WizardFormContext } from '@/lib/checkout/state/wizard-store';

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

export interface KitCommanderSectionProps {
  /** Snapshot panier construit côté serveur (variantId + prix + SKU). */
  initialCart: CartSnapshot;
  /** Kicker éditorial (optionnel — override possible côté CMS). */
  kicker?: string;
  /** Titre principal du bloc commander. */
  title?: string;
  /** Sous-titre (réassurance courte). */
  subtitle?: string;
  /** Slot custom au-dessus du wizard (ex. recap visuel produit). */
  preface?: ReactNode;
  /**
   * Image du pack à afficher dans le thumb mobile + le cart-recap.
   * Résolue côté serveur depuis la galerie hero (slot Component-Media
   * `kit-hero-produit/primary`) → cohérence visuelle hero → wizard.
   * Si undefined, les sous-composants retombent sur leur default
   * `/products/kit-principale.png`.
   */
  packImage?: { src: string; alt: string };
}

// ─────────────────────────────────────────────────────────────────────────────
// Const — profil Mode A figé pour /kit
// ─────────────────────────────────────────────────────────────────────────────

const KIT_FORM_CONTEXT: WizardFormContext = {
  formId: 'wizard_kit',
  formMode: 'wizard_embed',
  variantKey: 'A',
  source: 'wizard_kit',
};

// CHA-231 : parcours simplifié (plus de step paiement UI). Le serveur
// auto-aligne `payment_selected_at` côté `/api/checkout/order`.
const KIT_STEPS = ['lead', 'address', 'thank_you'] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function KitCommanderSection({
  initialCart,
  kicker = 'Commander le rituel',
  title = 'Trois gestes, livrés chez vous.',
  subtitle = 'Quelques coordonnées, une adresse au Maroc, et nous nous occupons du reste. Livraison gratuite en 24-48&nbsp;heures.',
  preface,
  packImage,
}: KitCommanderSectionProps) {
  return (
    <section
      id="commander-femiglow"
      aria-labelledby="kit-commander-heading"
      data-testid="kit-commander-section"
      className="scroll-mt-24 bg-creme py-16 lg:py-24"
    >
      <Container width="content" padded>
        {/* Kolenda §5 W3 P7 — thumb pack 64×80 mobile only (< lg).
            Image résolue côté server depuis `kit-hero-produit/primary`
            (Component-Media) → packshot dynamique cohérent avec le hero. */}
        <header className="mb-10 flex max-w-2xl gap-4">
          {DEFAULT_WIZARD_FEATURES.mobilePackThumbnail && (
            <WizardMobilePackThumb
              src={packImage?.src}
              alt={packImage?.alt}
            />
          )}
          <div className="space-y-3">
            <Text
              size="small"
              tone="secondary"
              className="uppercase tracking-[0.18em]"
            >
              {kicker}
            </Text>
            <Heading
              as="h2"
              size="display-md"
              italic="always"
              id="kit-commander-heading"
            >
              {title}
            </Heading>
            <Text
              tone="secondary"
              // Subtitle peut contenir un &nbsp; — on s'autorise dangerouslySet ?
              // Non : on garde du texte plat et on laisse le navigateur gérer
              // l'espacement. Le NBSP littéral fonctionne en JSX.
            >
              {subtitle.replace(/&nbsp;/g, '\u00a0')}
            </Text>
          </div>
        </header>

        {preface}

        <div className="mx-auto max-w-2xl rounded border border-encre/10 bg-white p-6 shadow-sm sm:p-8 lg:p-10">
          <WizardShell
            formContext={KIT_FORM_CONTEXT}
            steps={[...KIT_STEPS]}
            initialCart={initialCart}
            cartRecapThumbnailSrc={packImage?.src}
            copy={{
              title: 'Commander le rituel FemiGlow',
              // Kolenda §5 W1 (P2) — CTA outcome qui désamorce la peur
              // du paiement upfront (Trust #1 loss aversion).
              ctaLead: 'Continuer · paiement à la livraison',
              ctaAddress: 'Confirmer la commande',
              thankYouTitle: 'Commande reçue, on vous rappelle.',
            }}
            paymentMethods={['cod']}
          />
        </div>
      </Container>
    </section>
  );
}
