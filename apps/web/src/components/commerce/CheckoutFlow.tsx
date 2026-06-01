'use client';

/**
 * CHA-233 — Mode B (panier /commander) re-routé sur la chaîne wizard.
 *
 * Avant : `POST /api/checkout` mono-shot ; le lead n'était jamais persisté,
 * le webhook chat-lead ne déclenchait pas, et les events tracking étaient
 * désaligné du wizard /kit.
 *
 * Après : on emprunte la chaîne CHA-230/231/232 du wizard :
 *   - step 0 → POST `/api/checkout/lead`           (persiste le lead + webhook)
 *   - step 1 → PATCH `/api/checkout/lead/[id]/address`
 *   - step 2 → PATCH `/api/checkout/lead/[id]/payment` (cod silencieux)
 *              + POST  `/api/checkout/order`
 *              + (opt) PATCH `/api/checkout/order/[id]/email` si recapEmail
 *
 * Bénéfices :
 *   - Leads enregistrés à chaque étape ; relance commerciale possible.
 *   - Webhook chat-lead branché identiquement.
 *   - Funnel tracking aligné : begin_checkout / lead_capture / address_completed
 *     / add_payment_info / purchase (cf. event-catalog CHA-230).
 *
 * @tracking-category commerce_checkout
 * @tracking-events begin_checkout, lead_capture, generate_lead, address_completed, add_payment_info, purchase
 */

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
import { useShippingConfig } from '@/lib/checkout/use-shipping-config';
import { wizardClient, ApiError } from '@/lib/checkout/client/wizard-client';
import {
  ensureSessionId,
  ensureVisitorId,
} from '@/lib/checkout/client/visitor-id';
import { consumeIdempotencyKey } from '@/lib/checkout/client/idempotency-key';
import { DEFAULT_CONSENT_VERSION } from '@/lib/checkout/state/wizard-store';
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
import { markLeadAsPurchaseCookie } from '@/lib/tracking/lead-purchase-cookie';

const stepLabels = ['Informations', 'Livraison', 'Confirmation'] as const;

const fieldsByStep: Record<CheckoutStep, ReadonlyArray<string>> = {
  0: ['contact.firstName', 'contact.phone', 'consent'],
  1: ['address.city', 'address.line1', 'address.notes'],
  2: ['paymentMethod', 'recapEmail'],
};

type SubmitError = { title: string; description?: string };

interface CheckoutFlowProps {
  onLeaveModalChange?: (controls: { open: () => void }) => void;
}

const FORM_ID = 'cart-checkout-v1';
const FORM_MODE = 'wizard_cart' as const;

export function CheckoutFlow({ onLeaveModalChange }: CheckoutFlowProps) {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const hydrated = useCartHydrated();
  const subtotal = useCartStore(selectSubtotalCents);
  const clearCart = useCartStore((s) => s.clear);
  const { emit } = useTracking();
  const { freeShipping } = useShippingConfig();

  const [step, setStep] = useState<CheckoutStep>(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<SubmitError | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [leadId, setLeadId] = useState<string | null>(null);

  const methods = useForm<CheckoutForm>({
    resolver: zodResolver(checkoutFormSchema),
    mode: 'onBlur',
    defaultValues: {
      contact: {
        firstName: '',
        phone: '',
      },
      address: {
        city: '',
        line1: '',
        notes: '',
        country: 'MA',
      },
      paymentMethod: 'cod' as CheckoutPaymentMethod,
      promoCode: '',
      recapEmail: '',
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
  // CHA-233 : Mode B n'a plus de sélecteur de mode — toujours 'standard'.
  const shippingMode = 'standard' as const;
  const shipping = useMemo(
    () =>
      items.length === 0
        ? 0
        : computeShippingCents({ city, mode: shippingMode, freeShipping }),
    [items.length, city, freeShipping],
  );
  // Prix catalogue (référence non offerte) — sert au strikethrough.
  const catalogShipping = useMemo(
    () =>
      items.length === 0
        ? 0
        : computeShippingCents({ city, mode: shippingMode }),
    [items.length, city],
  );
  const total = subtotal + shipping;

  // `begin_checkout` migré vers `checkout_intent` (1ère frappe, cf.
  // InfoStep + useCheckoutIntentTrigger). On purge `lead_create.__new__`
  // au mount pour éviter une collision idempotency avec un parcours
  // wizard /kit antérieur (clés partagées en sessionStorage).
  const purgeLeadCreateRef = useRef(false);
  useEffect(() => {
    if (purgeLeadCreateRef.current) return;
    if (!hydrated || items.length === 0) return;
    purgeLeadCreateRef.current = true;
    consumeIdempotencyKey('lead_create', null);
  }, [hydrated, items]);

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

  function buildCartSnapshot() {
    return {
      items: items.map((it) => ({
        // CHA-233 — Préfère le SKU variant DB (rempli côté AddToCartButton
        // via `product.primaryVariantSku`). Fallback sur le slug produit
        // (résolu par le serveur via `products.slug` → primary variant),
        // puis sur l'id produit en dernier recours.
        sku: it.variantSku || it.productSlug || it.productId,
        name: it.productName,
        quantity: it.quantity,
        unitPriceCents: it.unitPriceCents,
        ...(it.variantId ? { variantId: it.variantId } : {}),
      })),
      totalCents: subtotal,
      currency: 'MAD',
    };
  }

  function buildFormContext() {
    return {
      formId: FORM_ID,
      formMode: FORM_MODE,
      variantKey: 'control' as const,
      source: 'wizard_commander' as const,
      language: 'fr' as const,
    };
  }

  function setNetworkError(err: unknown, fallbackTitle: string) {
    if (err instanceof ApiError) {
      if (err.code === 'invalid_input') {
        setError({
          title: 'Vérifions les informations saisies.',
          description: 'Quelques champs nécessitent un ajustement.',
        });
        return;
      }
      if (err.code === 'rate_limited') {
        setError({
          title: 'Un instant.',
          description: 'Trop d\u2019envois — réessayez dans quelques instants.',
        });
        return;
      }
      if (err.httpStatus === 0) {
        setError({
          title: 'Connexion impossible.',
          description: 'Vérifiez votre réseau, puis réessayez.',
        });
        return;
      }
    }
    setError({
      title: fallbackTitle,
      description: 'Veuillez réessayer dans quelques instants.',
    });
  }

  async function handleStep0Submit() {
    const values = methods.getValues();
    const visitorId = ensureVisitorId() ?? 'v_cart_unknown';
    const sessionId = ensureSessionId() ?? 's_cart_unknown';
    // NB : `begin_checkout` n'est plus émis ici. Le signal d'intent
    // est désormais porté par `checkout_intent` (1ère frappe dans
    // InfoStep, cf. useCheckoutIntentTrigger).
    setSubmitting(true);
    setError(null);
    try {
      const res = await wizardClient.createLead({
        formContext: buildFormContext(),
        firstName: values.contact.firstName.trim(),
        phone: values.contact.phone,
        consent: true,
        consentVersion: DEFAULT_CONSENT_VERSION,
        visitorId,
        sessionId,
        language: 'fr',
        cartSnapshot: buildCartSnapshot(),
        page: typeof window !== 'undefined' ? window.location.pathname : undefined,
        referrer:
          typeof document !== 'undefined' ? document.referrer || undefined : undefined,
      });
      setLeadId(res.leadId);
      // Tracking — lead_capture (custom) + generate_lead (GA4 standard).
      // `schema_version: 'v1'` est requis par le schéma serveur des events
      // wizard custom (cf. lib/tracking/schemas.ts). Sans cela, l'event est
      // rejeté côté `/api/track` avec `Invalid literal value`.
      emit('lead_capture', {
        form_id: FORM_ID,
        form_mode: FORM_MODE,
        step_name: 'lead',
        variant_key: 'control',
        lead_id: res.leadId,
        schema_version: 'v1',
        method: 'wizard',
        contact_channels: ['phone'],
        currency: 'MAD',
        value: total / 100,
      });
      emit('generate_lead', {
        // `method` discrimine la SOURCE du lead pour le pont Meta lead→Purchase
        // (audit meta-lead-as-purchase-2026-06-01). Le serveur ne traite comme
        // Purchase Meta que les sources éligibles {chat, abandoned_cart}.
        method: 'abandoned_cart',
        currency: 'MAD',
        value: total / 100,
      });
      // Marque le parcours (cookie) → GTM bloque le Purchase pixel du vrai
      // achat pour éviter le doublon avec le lead-Purchase CAPI. No-op si OFF.
      markLeadAsPurchaseCookie();
      return true;
    } catch (err) {
      setNetworkError(err, 'Impossible de valider vos coordonnées.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStep1Submit() {
    const values = methods.getValues();
    if (!leadId) {
      setError({
        title: 'Session interrompue.',
        description: 'Reprenez à l\u2019étape précédente.',
      });
      return false;
    }
    setSubmitting(true);
    setError(null);
    try {
      await wizardClient.patchAddress(leadId, {
        city: values.address.city.trim(),
        addressLine1: (values.address.line1 ?? '').trim() || '',
        country: 'MA',
        notes: values.address.notes?.trim() || undefined,
        shippingMode: 'standard',
      });
      emit('add_shipping_info', {
        currency: 'MAD',
        value: total / 100,
        shipping_tier: shippingMode,
        form_id: FORM_ID,
        form_mode: FORM_MODE,
        step_name: 'address',
        lead_id: leadId,
        items: items.map((it) => ({
          item_id: it.productId,
          item_name: it.productName,
          price: it.unitPriceCents / 100,
          quantity: it.quantity,
        })),
      });
      return true;
    } catch (err) {
      setNetworkError(err, 'Adresse non enregistrée.');
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  async function nextStep() {
    const valid = await methods.trigger(fieldsByStep[step] as never);
    if (!valid) return;

    if (step === 0) {
      const ok = await handleStep0Submit();
      if (!ok) return;
    } else if (step === 1) {
      const ok = await handleStep1Submit();
      if (!ok) return;
    }

    if (step < 2) {
      const target = (step + 1) as CheckoutStep;
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
    if (!leadId) {
      setError({
        title: 'Session interrompue.',
        description: 'Reprenez à l\u2019étape « Informations ».',
      });
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // 1) PATCH /lead/[id]/payment (cod silencieux — pas de choix UI Mode B)
      await wizardClient.patchPayment(leadId, { paymentMethod: 'cod' });
      emit('add_payment_info', {
        currency: 'MAD',
        value: total / 100,
        payment_type: 'cod',
        form_id: FORM_ID,
        form_mode: FORM_MODE,
        step_name: 'payment',
        lead_id: leadId,
        items: items.map((it) => ({
          item_id: it.productId,
          item_name: it.productName,
          price: it.unitPriceCents / 100,
          quantity: it.quantity,
        })),
      });

      // 2) POST /order
      const orderRes = await wizardClient.createOrder({
        leadId,
        formContext: buildFormContext(),
        items: buildCartSnapshot().items,
        expectedTotalCents: total,
        currency: 'MAD',
        paymentMethod: 'cod',
        shippingMode: 'standard',
      });

      // 3) Tracking purchase
      emit('purchase', {
        transaction_id: orderRes.orderId,
        currency: 'MAD',
        value: orderRes.totalCents / 100,
        payment_type: 'cod',
        form_id: FORM_ID,
        form_mode: FORM_MODE,
        step_name: 'thank_you',
        lead_id: leadId,
        items: items.map((it) => ({
          item_id: it.productId,
          item_name: it.productName,
          price: it.unitPriceCents / 100,
          quantity: it.quantity,
        })),
      });

      // 4) Opt-in email (best-effort — l'échec n'empêche pas la conversion).
      const recapEmail = (values.recapEmail ?? '').trim();
      if (recapEmail) {
        try {
          await wizardClient.optInEmail(orderRes.orderId, {
            email: recapEmail,
            emailConsent: true,
          });
        } catch {
          /* silencieux — l'order est créé, l'opt-in est secondaire */
        }
      }

      saveLastOrder({
        orderId: orderRes.orderId,
        firstName: values.contact.firstName,
        email: recapEmail || undefined,
        items,
        subtotal,
        shipping,
        total,
        address: values.address,
        paymentMethod: 'cod',
        createdAt: new Date().toISOString(),
        catalogShippingCents: catalogShipping,
        freeShipping,
      });
      clearCart();
      clearCheckoutDraft();
      router.push(routes.merci(orderRes.orderId));
    } catch (err) {
      setSubmitting(false);
      setNetworkError(err, 'Le paiement n\u2019a pas abouti.');
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
          catalogShippingCents={catalogShipping}
          freeShipping={freeShipping}
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
                data-testid="checkout-form"
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
                      loading={submitting}
                      data-testid={`checkout-step-${step}-next`}
                    >
                      Continuer
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      variant="primary"
                      size="lg"
                      loading={submitting}
                      data-testid="checkout-submit"
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
              catalogShippingCents={catalogShipping}
              freeShipping={freeShipping}
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
