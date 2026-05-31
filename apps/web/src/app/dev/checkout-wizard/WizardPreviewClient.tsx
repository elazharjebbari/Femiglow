'use client';

/**
 * CHA-230 — Client component qui monte le WizardShell sur la page preview.
 *
 * Permet de switcher facilement entre Mode A (wizard_kit, embed) et Mode B
 * (wizard_commander, full page) via une URL search param `?form=...`.
 *
 * Hydrate le formContext + cartSnapshot à partir de la config par défaut
 * — pas d'appel `/api/checkout/form-config/...` ici (la page preview n'a
 * pas besoin de la config dynamique pour démontrer le UI). En production
 * (mode A/B intégrés), c'est le Server Component parent qui fetch la
 * config et la passe en props.
 */

import { useSearchParams } from 'next/navigation';
import { useMemo } from 'react';

import { WizardShell, type WizardShellProps } from '@/components/checkout/wizard/WizardShell';
import { purgeAllIdempotencyKeys } from '@/lib/checkout/client/idempotency-key';
import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';
import type { CartSnapshot, StepName } from '@/lib/checkout/schemas/common';
import type { WizardFormContext } from '@/lib/checkout/state/wizard-store';
import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import { Button } from '@/components/ui/Button';

interface PreviewProfile {
  formContext: WizardFormContext;
  steps: StepName[];
  initialCart: CartSnapshot;
  copy: NonNullable<WizardShellProps['copy']>;
  paymentMethods: NonNullable<WizardShellProps['paymentMethods']>;
}

// Variant ID stable du rituel FemiGlow (seed) — branche le StockIndicator.
// En production, le serveur injecte cette valeur via la projection cart.
const FEMI_KIT_VARIANT_ID = 'pvar_0c01jxc1yn4kjp3b';

// CHA-231 — Parcours simplifié : plus de step `payment` UI (création directe
// de l'order au submit adresse, paiement à la livraison par défaut).
const KIT_PROFILE: PreviewProfile = {
  formContext: {
    formId: 'wizard_kit',
    formMode: 'wizard_embed',
    variantKey: 'A',
    source: 'wizard_kit',
  },
  steps: ['lead', 'address', 'thank_you'],
  initialCart: {
    items: [
      {
        sku: 'FEMI-KIT-100',
        name: 'Le rituel FemiGlow',
        quantity: 1,
        unitPriceCents: 4400,
        variantId: FEMI_KIT_VARIANT_ID,
      },
    ],
    totalCents: 4400,
    currency: 'MAD',
  },
  copy: {
    title: 'Commander le rituel FemiGlow',
    ctaLead: 'Continuer',
    ctaAddress: 'Confirmer la commande',
    thankYouTitle: 'Commande reçue, on vous rappelle.',
  },
  paymentMethods: ['cod'],
};

const COMMANDER_PROFILE: PreviewProfile = {
  formContext: {
    formId: 'wizard_commander',
    formMode: 'wizard_cart',
    variantKey: 'B',
    source: 'wizard_commander',
  },
  steps: ['cart_review', 'lead', 'address', 'thank_you'],
  initialCart: {
    items: [
      {
        sku: 'FEMI-KIT-100',
        name: 'Le rituel FemiGlow',
        quantity: 1,
        unitPriceCents: 4400,
        variantId: FEMI_KIT_VARIANT_ID,
      },
    ],
    totalCents: 4400,
    currency: 'MAD',
  },
  copy: {
    title: 'Finaliser ma commande',
    ctaLead: 'Continuer',
    ctaAddress: 'Confirmer la commande',
    thankYouTitle: 'Commande reçue, on vous rappelle.',
  },
  paymentMethods: ['cod'],
};

export function WizardPreviewClient() {
  const search = useSearchParams();
  const formParam = search.get('form') ?? 'kit';
  const profile = formParam === 'commander' ? COMMANDER_PROFILE : KIT_PROFILE;
  const reset = useWizardStore((s) => s.reset);

  const debugState = useMemo(
    () => ({
      formContext: profile.formContext,
      cartTotal: profile.initialCart.totalCents,
    }),
    [profile],
  );

  return (
    <main className="bg-creme py-12">
      <Container width="content" padded>
        <div className="mb-10 flex items-end justify-between gap-4 border-b border-encre/10 pb-6">
          <div>
            <Heading as="h1" size="lg" italic="always">
              Wizard checkout — preview
            </Heading>
            <Text size="small" tone="secondary" className="mt-2">
              Dev only. Form&nbsp;:{' '}
              <code className="font-mono">{profile.formContext.formId}</code> · Mode&nbsp;:{' '}
              <code className="font-mono">{profile.formContext.formMode}</code> · Variant&nbsp;:{' '}
              <code className="font-mono">{profile.formContext.variantKey ?? '—'}</code>
            </Text>
          </div>
          <div className="flex flex-col items-end gap-2 sm:flex-row">
            <a
              href="?form=kit"
              className="text-xs underline decoration-encre/40 underline-offset-4 hover:decoration-encre"
            >
              Mode A (kit)
            </a>
            <a
              href="?form=commander"
              className="text-xs underline decoration-encre/40 underline-offset-4 hover:decoration-encre"
            >
              Mode B (commander)
            </a>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                purgeAllIdempotencyKeys();
                reset();
              }}
            >
              Reset wizard
            </Button>
          </div>
        </div>

        <WizardShell
          formContext={profile.formContext}
          steps={profile.steps}
          initialCart={profile.initialCart}
          copy={profile.copy}
          paymentMethods={profile.paymentMethods}
        />

        <details className="mt-12 rounded border border-encre/15 bg-white p-4 text-xs text-encre/60">
          <summary className="cursor-pointer font-mono text-encre">
            Debug — preview profile
          </summary>
          <pre className="mt-3 overflow-auto font-mono">
            {JSON.stringify(debugState, null, 2)}
          </pre>
        </details>
      </Container>
    </main>
  );
}
