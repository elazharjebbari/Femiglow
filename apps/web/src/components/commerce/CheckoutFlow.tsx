'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm, FormProvider, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useCartStore,
  useCartHydrated,
  selectSubtotalCents,
} from '@/lib/stores/cart-store';
import {
  checkoutFormSchema,
  type CheckoutForm,
  type CheckoutPaymentMethod,
} from '@/lib/schemas';
import {
  saveCheckoutDraft,
  readCheckoutDraft,
  clearCheckoutDraft,
  saveLastOrder,
} from '@/lib/stores/checkout-draft';
import { computeShippingCents } from '@/lib/utils/shipping';
import { Button } from '@/components/ui/Button';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';
import { Container } from '@/components/ui/Container';
import { ProgressBar3Steps, type CheckoutStep } from './ProgressBar3Steps';
import { OrderSummarySticky } from './OrderSummarySticky';
import { OrderSummaryAccordion } from './OrderSummaryAccordion';
import { ErrorBanner } from './ErrorBanner';
import { LeaveCheckoutModal } from './LeaveCheckoutModal';
import { PaymentLoadingOverlay } from './PaymentLoadingOverlay';
import { InfoStep } from './steps/InfoStep';
import { AddressStep } from './steps/AddressStep';
import { PaymentStep } from './steps/PaymentStep';
import { routes } from '@/lib/routes';
import { useTracking } from '@/lib/tracking/use-tracking';

const stepLabels = ['Informations', 'Livraison', 'Paiement'] as const;

const fieldsByStep: Record<CheckoutStep, ReadonlyArray<string>> = {
  0: [
    'contact.firstName',
    'contact.lastName',
    'contact.email',
    'contact.phone',
  ],
  1: [
    'address.line1',
    'address.quartier',
    'address.city',
    'address.cityOther',
    'address.shippingMode',
  ],
  2: ['paymentMethod', 'consent'],
};

type SubmitError = { title: string; description?: string };

interface CheckoutFlowProps {
  onLeaveModalChange?: (controls: { open: () => void }) => void;
}

/**
 * @tracking-category commerce_checkout
 * @tracking-events add_shipping_info, add_payment_info
 * @tracking-description Funnel checkout — add_shipping_info au passage étape 1→2, add_payment_info à la soumission finale.
 */
export function CheckoutFlow({ onLeaveModalChange }: CheckoutFlowProps) {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const hydrated = useCartHydrated();
  const subtotal = useCartStore(selectSubtotalCents);
  const clearCart = useCartStore((s) => s.clear);
  const { emit } = useTracking();

  const [step, setStep] = useState<CheckoutStep>(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<SubmitError | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const methods = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutFormSchema),
    mode: 'onBlur',
    defaultValues: {
      contact: {
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        acceptNewsletter: false,
        createAccount: false,
      },
      address: {
        line1: '',
        line2: '',
        quartier: '',
        city: undefined,
        cityOther: '',
        postalCode: '',
        country: 'MA',
        shippingMode: 'standard',
      },
      paymentMethod: 'cod' as CheckoutPaymentMethod,
      promoCode: '',
      consent: undefined as unknown as true,
    },
  });

  const draftRestored = useRef(false);
  useEffect(() => {
    if (draftRestored.current) return;
    draftRestored.current = true;
    const draft = readCheckoutDraft();
    if (!draft) return;
    methods.reset({
      ...methods.getValues(),
      ...draft,
    } as CheckoutForm);
  }, [methods]);

  const watchedValues = useWatch({ control: methods.control });

  useEffect(() => {
    const handle = window.setTimeout(() => {
      saveCheckoutDraft(watchedValues as Partial<CheckoutForm>);
    }, 400);
    return () => window.clearTimeout(handle);
  }, [watchedValues]);

  const city = useWatch({ control: methods.control, name: 'address.city' });
  const shippingMode = useWatch({
    control: methods.control,
    name: 'address.shippingMode',
  });
  const shipping = useMemo(
    () => (items.length === 0 ? 0 : computeShippingCents({ city, mode: shippingMode })),
    [items.length, city, shippingMode],
  );
  const total = subtotal + shipping;

  const focusStepHeading = (target: CheckoutStep) => {
    const id =
      target === 0
        ? 'checkout-step-info'
        : target === 1
          ? 'checkout-step-address'
          : 'checkout-step-payment';
    requestAnimationFrame(() => {
      document.getElementById(id)?.focus();
    });
  };

  useEffect(() => {
    if (onLeaveModalChange) {
      onLeaveModalChange({ open: () => setLeaveOpen(true) });
    }
  }, [onLeaveModalChange]);

  if (!hydrated) {
    return (
      <Container width="page">
        <div aria-busy="true" className="py-20 text-center">
          <Text size="body" tone="tertiary">
            Préparation de la commande…
          </Text>
        </div>
      </Container>
    );
  }

  if (items.length === 0) {
    return (
      <Container width="page">
        <div className="py-20 text-center space-y-4">
          <Heading as="h2" size="lg">
            Le panier est vide.
          </Heading>
          <Text size="body" tone="secondary">
            Ajoutez le kit avant de passer commande.
          </Text>
          <Link href={routes.kit}>
            <Button variant="primary" size="md">
              Voir le kit
            </Button>
          </Link>
        </div>
      </Container>
    );
  }

  async function nextStep() {
    const valid = await methods.trigger(fieldsByStep[step] as never);
    if (!valid) return;
    if (step < 2) {
      const target = (step + 1) as CheckoutStep;
      if (step === 1) {
        emit('add_shipping_info', {
          currency: 'MAD',
          value: total / 100,
          shipping_tier: shippingMode ?? 'standard',
          items: items.map((it) => ({
            item_id: it.productId,
            item_name: it.productName,
            price: it.unitPriceCents / 100,
            quantity: it.quantity,
          })),
        });
      }
      setStep(target);
      const label = stepLabels[target];
      setAnnouncement(`Étape ${target + 1} sur 3 : ${label}.`);
      focusStepHeading(target);
    }
  }

  function previousStep() {
    if (step === 0) return;
    const target = (step - 1) as CheckoutStep;
    setStep(target);
    const label = stepLabels[target];
    setAnnouncement(`Étape ${target + 1} sur 3 : ${label}.`);
    focusStepHeading(target);
  }

  function handleStepClick(target: CheckoutStep) {
    if (target > step) return;
    setStep(target);
    setAnnouncement(`Étape ${target + 1} sur 3 : ${stepLabels[target]}.`);
    focusStepHeading(target);
  }

  async function onSubmit(values: CheckoutForm) {
    setSubmitting(true);
    setError(null);
    emit('add_payment_info', {
      currency: 'MAD',
      value: total / 100,
      payment_type: values.paymentMethod,
      items: items.map((it) => ({
        item_id: it.productId,
        item_name: it.productName,
        price: it.unitPriceCents / 100,
        quantity: it.quantity,
      })),
    });
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        const data = (await response
          .json()
          .catch(() => ({}))) as Record<string, unknown>;
        throw new Error(typeof data.error === 'string' ? data.error : 'CHECKOUT_FAILED');
      }
      const { orderId } = (await response.json()) as { orderId: string };
      saveLastOrder({
        orderId,
        firstName: values.contact.firstName,
        email: values.contact.email,
        items,
        subtotal,
        shipping,
        total,
        address: values.address,
        paymentMethod: values.paymentMethod,
        createdAt: new Date().toISOString(),
      });
      clearCart();
      clearCheckoutDraft();
      router.push(routes.merci(orderId));
    } catch (caught) {
      setSubmitting(false);
      const message =
        caught instanceof Error ? caught.message : 'CHECKOUT_FAILED';
      setError({
        title:
          message === 'INVALID_PAYLOAD'
            ? 'Vérifions les informations saisies.'
            : 'Le paiement n\u2019a pas abouti.',
        description:
          message === 'INVALID_PAYLOAD'
            ? 'Quelques champs nécessitent un ajustement.'
            : 'Veuillez réessayer dans quelques instants.',
      });
    }
  }

  return (
    <>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>

      <div className="lg:hidden">
        <OrderSummaryAccordion
          items={items}
          subtotalCents={subtotal}
          shippingCents={shipping}
          totalCents={total}
        />
      </div>

      <Container width="page">
        <div className="grid gap-12 py-12 sm:py-16 lg:grid-cols-[1.4fr_360px] lg:gap-16">
          <div className="space-y-10">
            <ProgressBar3Steps
              currentStep={step}
              labels={stepLabels}
              onStepClick={handleStepClick}
            />

            {error && (
              <ErrorBanner
                title={error.title}
                description={error.description}
                onDismiss={() => setError(null)}
              />
            )}

            <FormProvider {...methods}>
              <form
                onSubmit={methods.handleSubmit(onSubmit)}
                className="space-y-10"
              >
                {step === 0 && <InfoStep />}
                {step === 1 && <AddressStep />}
                {step === 2 && <PaymentStep />}

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-encre/10 pt-6">
                  {step > 0 ? (
                    <Button type="button" variant="ghost" onClick={previousStep}>
                      Retour
                    </Button>
                  ) : (
                    <span aria-hidden="true" />
                  )}
                  {step < 2 ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="lg"
                      onClick={nextStep}
                    >
                      Continuer
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      loading={submitting}
                    >
                      Confirmer la commande
                    </Button>
                  )}
                </div>
              </form>
            </FormProvider>
          </div>

          <div className="hidden lg:block">
            <OrderSummarySticky
              items={items}
              subtotalCents={subtotal}
              shippingCents={shipping}
              totalCents={total}
            />
          </div>
        </div>
      </Container>

      <LeaveCheckoutModal
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        onResumeLater={() => {
          saveCheckoutDraft(methods.getValues());
          router.push(routes.home);
        }}
        onQuit={() => {
          clearCheckoutDraft();
          router.push(routes.home);
        }}
      />

      {submitting && <PaymentLoadingOverlay />}
    </>
  );
}
