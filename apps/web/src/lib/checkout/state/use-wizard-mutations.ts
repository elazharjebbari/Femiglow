/**
 * CHA-230 — Hooks de mutation qui couplent UI / state / API client / tracking.
 *
 * Chaque mutation suit le même pattern :
 *
 *   ```ts
 *   const m = useLeadCreateMutation();
 *   const onSubmit = async () => {
 *     m.setLoading();
 *     try {
 *       const res = await m.execute({ firstName, phone, consent });
 *       // success — la state store est déjà à jour
 *     } catch (e) {
 *       m.setError(e);
 *     }
 *   };
 *   ```
 *
 * Avantages :
 *   - Une seule source de vérité pour les loaders / erreurs UI.
 *   - Tracking centralisé : chaque hook émet l'event GA4 / Meta approprié.
 *   - Pas de duplication de logique entre les steps.
 */
'use client';

import { useCallback, useState } from 'react';

import {
  ApiError,
  isRetryableApiError,
  NetworkApiError,
} from '@/lib/checkout/client/api-errors';
import { wizardClient } from '@/lib/checkout/client/wizard-client';
import {
  ensureSessionId,
  ensureVisitorId,
} from '@/lib/checkout/client/visitor-id';
import { newLeadId } from '@/lib/checkout/client/lead-id';
import { getOrCreateIdempotencyKey } from '@/lib/checkout/client/idempotency-key';
import { isOptimisticWizardClientEnabled } from '@/lib/checkout/flags';
import { getLeadSyncQueue } from '@/lib/checkout/state/lead-sync-singleton';
import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import { useTracking } from '@/lib/tracking/use-tracking';
import {
  buildAddPaymentInfoEvent,
  buildAddressCompletedEvent,
  buildLeadCaptureEvent,
  buildPurchaseEvent,
  buildWizardErrorEvent,
  CHECKOUT_EVENT_NAMES,
  type WizardContext,
} from '@/lib/tracking/checkout-events';
import { hashIdentityBrowser } from '@/lib/tracking/providers/hashing-browser';
import { getEventIdentityFields } from '@/lib/tracking/providers/event-mapping';
import {
  getJourneyPurchaseId,
  readJourneyPurchaseId,
} from '@/lib/tracking/lead-purchase-cookie';
import type { CartItemSnapshot } from '@/lib/checkout/schemas/common';
import { normalizePhoneToE164Maroc } from '@/lib/checkout/schemas/common';
import type { EmitOptions } from '@/lib/tracking/client';

// ─────────────────────────────────────────────────────────────────────────────
// Status type
// ─────────────────────────────────────────────────────────────────────────────

export type MutationStatus = 'idle' | 'loading' | 'success' | 'error';

interface BaseMutationState {
  status: MutationStatus;
  error: ApiError | null;
}

function useBaseMutation(): {
  state: BaseMutationState;
  setIdle: () => void;
  setLoading: () => void;
  setSuccess: () => void;
  setError: (err: unknown) => void;
} {
  const [state, setState] = useState<BaseMutationState>({
    status: 'idle',
    error: null,
  });
  const setIdle = useCallback(() => setState({ status: 'idle', error: null }), []);
  const setLoading = useCallback(
    () => setState({ status: 'loading', error: null }),
    [],
  );
  const setSuccess = useCallback(() => setState({ status: 'success', error: null }), []);
  const setError = useCallback((err: unknown) => {
    const apiErr =
      err instanceof ApiError ? err : new ApiError('internal_error', 'Erreur inattendue.', 500);
    setState({ status: 'error', error: apiErr });
  }, []);
  return { state, setIdle, setLoading, setSuccess, setError };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers communs
// ─────────────────────────────────────────────────────────────────────────────

function buildWizardCtx(opts: {
  formId: string;
  formMode: 'wizard_embed' | 'wizard_cart' | 'legacy_cart';
  variantKey: 'A' | 'B' | 'control' | null;
  stepName: WizardContext['step_name'];
  leadId?: string | null;
}): WizardContext {
  return {
    form_id: opts.formId,
    form_mode: opts.formMode,
    step_name: opts.stepName,
    variant_key: opts.variantKey,
    lead_id: opts.leadId ?? undefined,
  };
}

/**
 * Le `emit()` du provider tracking attend un `Record<string, unknown>`
 * (signature ouverte). Les types `*Event` produits par les builders sont
 * structurellement compatibles mais TS ne le déduit pas sans index
 * signature. On bridge via un wrapper qui projette dans un plain Record.
 */
function emitEvent(
  emit: (event: string, params?: Record<string, unknown>, options?: EmitOptions) => void,
  eventName: string,
  payload: object,
  options?: EmitOptions,
): void {
  emit(eventName, payload as Record<string, unknown>, options);
}

interface CheckoutIdentityFull {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  city?: string;
  country?: string;
}

/**
 * Hash l'identity côté navigateur (SHA-256) en filtrant sur les champs
 * autorisés par le mapping de l'event (cf. `event-mapping.ts` →
 * `identityFields`). Renvoie `undefined` si aucun hash possible (utile
 * pour les events sans hydratation, ex. checkout_intent).
 */
async function buildUserDataForEvent(
  eventName: string,
  identity: CheckoutIdentityFull,
): Promise<Record<string, unknown> | undefined> {
  const fields = getEventIdentityFields(eventName);
  if (fields.length === 0) return undefined;
  const filtered: CheckoutIdentityFull = {};
  for (const f of fields) {
    const v = identity[f];
    if (v) (filtered as Record<string, string>)[f] = v;
  }
  if (Object.keys(filtered).length === 0) return undefined;
  try {
    const hashed = await hashIdentityBrowser(filtered);
    return hashed as Record<string, unknown>;
  } catch {
    // SubtleCrypto indisponible (test env) — on n'attache pas user_data
    // mais on ne casse pas l'emit pour autant.
    return undefined;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook : lead capture (Step 1)
// ─────────────────────────────────────────────────────────────────────────────

export interface LeadCaptureMutationInput {
  firstName: string;
  phone: string;
  consent: true;
  consentVersion: string;
}

export function useLeadCaptureMutation(): {
  status: MutationStatus;
  error: ApiError | null;
  execute: (input: LeadCaptureMutationInput) => Promise<{ leadId: string }>;
  reset: () => void;
} {
  const { state, setLoading, setSuccess, setError, setIdle } = useBaseMutation();
  const { emit } = useTracking();
  const setLeadId = useWizardStore((s) => s.setLeadId);
  const goToStep = useWizardStore((s) => s.goToStep);
  const formContext = useWizardStore((s) => s.formContext);
  const cartSnapshot = useWizardStore((s) => s.cartSnapshot);

  const execute = useCallback(
    async (input: LeadCaptureMutationInput): Promise<{ leadId: string }> => {
      if (!formContext) {
        throw new ApiError(
          'invalid_state',
          'formContext absent — appeler setFormContext() avant.',
          0,
        );
      }
      setLoading();
      const visitorId = ensureVisitorId() ?? 'v_unknown_visitor';
      const sessionId = ensureSessionId() ?? 's_unknown_session';
      try {
        const leadBody = {
          formContext: {
            formId: formContext.formId,
            formMode: formContext.formMode,
            variantKey: formContext.variantKey ?? null,
            source: formContext.source,
          },
          firstName: input.firstName.trim(),
          phone: normalizePhoneToE164Maroc(input.phone)?.replace('+212', '') ?? input.phone,
          consent: input.consent,
          consentVersion: input.consentVersion,
          visitorId,
          sessionId,
          language: 'fr' as const,
          cartSnapshot: cartSnapshot ?? undefined,
          page: typeof window !== 'undefined' ? window.location.pathname : undefined,
          referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
        };

        // OWBS — chemin optimiste : leadId généré client, on AVANCE
        // immédiatement (goToStep), et on envoie la création en tâche de fond
        // (file de sync idempotente). Flag OFF → legacy (await bloquant).
        // cf. docs/checkout-leads-background-2026-06-01 (ADR-0001/0002/0003).
        let leadId: string;
        if (isOptimisticWizardClientEnabled()) {
          leadId = newLeadId();
          getLeadSyncQueue().enqueue({
            leadId,
            scope: 'lead_create',
            endpoint: '/api/checkout/lead',
            method: 'POST',
            idempotencyKey: getOrCreateIdempotencyKey('lead_create', leadId),
            payload: { ...leadBody, leadId },
          });
        } else {
          const res = await wizardClient.createLead(leadBody);
          leadId = res.leadId;
        }
        setLeadId(leadId);
        goToStep('address');
        setSuccess();
        // Pont lead→Meta Purchase (parité `CheckoutFlow`) : on crée/lit le
        // `eventID` de parcours (jpid) et on le porte sur `lead_capture` ET
        // `generate_lead` → le pixel Purchase du lead ET la CAPI partagent le
        // MÊME eventID → dédup native Meta (+ cookie qui bloquera l'achat
        // réel). No-op si le flag NEXT_PUBLIC lead-as-Purchase est OFF.
        const jpid = getJourneyPurchaseId();
        const leadValue = cartSnapshot?.totalCents
          ? cartSnapshot.totalCents / 100
          : undefined;
        // Tracking — lead_capture (conversion) — hydratée pour
        // Enhanced Conversions Google Ads + Advanced Matching Meta.
        const userData = await buildUserDataForEvent(
          CHECKOUT_EVENT_NAMES.leadCapture,
          {
            firstName: input.firstName,
            phone: input.phone,
          },
        );
        emitEvent(
          emit,
          CHECKOUT_EVENT_NAMES.leadCapture,
          buildLeadCaptureEvent({
            ctx: buildWizardCtx({
              formId: formContext.formId,
              formMode: formContext.formMode,
              variantKey: formContext.variantKey,
              stepName: 'lead',
              leadId,
            }),
            method: 'wizard',
            contact_channels: ['phone'],
            currency: cartSnapshot?.currency ?? 'MAD',
            value: leadValue,
            meta_purchase_eid: jpid ?? undefined,
          }),
          { userData },
        );
        // `generate_lead` (GA4 standard) — c'est CET event, avec
        // `method:'abandoned_cart'` (source éligible) + `meta_purchase_eid`,
        // que le serveur traite comme Meta Purchase (cf.
        // `lib/tracking/server/lead-as-purchase.ts`). `value`/`currency`
        // seulement si `value > 0` (currency orpheline = signal invalide).
        // `generate_lead` porte DÉSORMAIS la conversion Google Ads `lead`
        // (method-gatée {chat,abandoned_cart}) → on attache `userData` (mêmes
        // identifiants hashés que lead_capture) pour Enhanced Conversions.
        emit(
          'generate_lead',
          {
            method: 'abandoned_cart',
            lead_id: leadId,
            ...(jpid ? { meta_purchase_eid: jpid } : {}),
            ...(typeof leadValue === 'number' && leadValue > 0
              ? { value: leadValue, currency: cartSnapshot?.currency ?? 'MAD' }
              : {}),
          },
          { userData },
        );
        return { leadId };
      } catch (e) {
        setError(e);
        emitEvent(
          emit,
          CHECKOUT_EVENT_NAMES.wizardError,
          buildWizardErrorEvent({
            ctx: buildWizardCtx({
              formId: formContext.formId,
              formMode: formContext.formMode,
              variantKey: formContext.variantKey,
              stepName: 'lead',
            }),
            source: e instanceof NetworkApiError ? 'network' : 'api',
            error_code: e instanceof ApiError ? e.code : 'unknown',
            http_status: e instanceof ApiError ? e.httpStatus : undefined,
          }),
        );
        throw e;
      }
    },
    [formContext, cartSnapshot, setLeadId, goToStep, setLoading, setSuccess, setError, emit],
  );

  return { status: state.status, error: state.error, execute, reset: setIdle };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook : address (Step 2)
//
// CHA-231 — Cette mutation orchestre désormais la chaîne complète :
//   1. PATCH /api/checkout/lead/[id]/address
//   2. PATCH /api/checkout/lead/[id]/payment  (paymentMethod='cod' implicite)
//   3. POST  /api/checkout/order               (creation finale)
//   4. goToStep('thank_you')
//
// Le step `payment` disparaît du parcours UI ; le serveur continue à recevoir
// la sélection paiement (en `cod` par défaut) pour préserver les analytics
// existants (funnel payment_selected → purchase reste exploitable).
//
// Gestion d'erreur
// ────────────────
// - Si address échoue : on reste sur address, bandeau d'erreur.
// - Si payment échoue : on reste sur address ; le retry relance l'enchaînement
//   (l'idempotency-key d'address est consumée → server renvoie le résultat
//   précédent, donc rejouer ne crée pas de doublon).
// - Si order échoue (stock, prix, etc.) : idem — l'erreur est propagée et
//   l'utilisateur peut retenter.
// ─────────────────────────────────────────────────────────────────────────────

export interface AddressMutationInput {
  city: string;
  addressLine1: string;
  country: string;
  notes?: string;
  shippingMode: 'standard' | 'express' | 'pickup';
}

/**
 * Moyen de paiement par défaut au Maroc — paiement à la livraison.
 * Centralisé pour faciliter une bascule future (config par marché).
 */
const DEFAULT_PAYMENT_METHOD: 'cod' | 'bank_transfer' | 'card' = 'cod';

export function useAddressMutation(): {
  status: MutationStatus;
  error: ApiError | null;
  execute: (input: AddressMutationInput) => Promise<void>;
  reset: () => void;
} {
  const { state, setLoading, setSuccess, setError, setIdle } = useBaseMutation();
  const { emit } = useTracking();
  const leadId = useWizardStore((s) => s.leadId);
  const formContext = useWizardStore((s) => s.formContext);
  const goToStep = useWizardStore((s) => s.goToStep);
  const setOrderId = useWizardStore((s) => s.setOrderId);
  const setLoyalty = useWizardStore((s) => s.setLoyalty);
  const cartSnapshot = useWizardStore((s) => s.cartSnapshot);
  const leadDraft = useWizardStore((s) => s.leadDraft);
  // Phase 3 — crédit de fidélité (code + montant validé).
  const couponCode = useWizardStore((s) => s.couponCode);
  const creditCents = useWizardStore((s) => s.creditCents);

  const execute = useCallback(
    async (input: AddressMutationInput): Promise<void> => {
      if (!leadId || !formContext) {
        throw new ApiError('invalid_state', 'Lead manquant.', 0);
      }
      if (!cartSnapshot) {
        throw new ApiError('invalid_state', 'Panier manquant.', 0);
      }
      setLoading();
      const ctx = buildWizardCtx({
        formId: formContext.formId,
        formMode: formContext.formMode,
        variantKey: formContext.variantKey,
        stepName: 'address',
        leadId,
      });

      // ── 1) PATCH address ─────────────────────────────────────────────────
      // OWBS — garantit que le lead (potentiellement créé en tâche de fond en
      // mode optimiste) est bien persisté côté serveur AVANT la conversion :
      // patchAddress / createOrder référencent `leadId`. Flush quasi instantané
      // s'il a déjà abouti pendant la saisie de l'adresse. cf. ADR-0002 (snapshot).
      if (isOptimisticWizardClientEnabled()) {
        await getLeadSyncQueue().flush();
      }

      try {
        await wizardClient.patchAddress(leadId, {
          city: input.city.trim(),
          addressLine1: input.addressLine1.trim(),
          country: input.country,
          notes: input.notes?.trim() || undefined,
          shippingMode: input.shippingMode,
        });
        // Hydratation identity : firstName/phone (depuis leadDraft, set step 1)
        // + city/country (depuis l'input courant). Enhanced Conversions.
        const userDataAddress = await buildUserDataForEvent(
          CHECKOUT_EVENT_NAMES.addressCompleted,
          {
            firstName: leadDraft.firstName,
            phone: leadDraft.phone,
            city: input.city,
            country: input.country,
          },
        );
        emitEvent(
          emit,
          CHECKOUT_EVENT_NAMES.addressCompleted,
          buildAddressCompletedEvent({
            ctx,
            shipping_tier: input.shippingMode,
            city_code: input.city.toLowerCase().trim().replace(/\s+/g, '-'),
            currency: cartSnapshot.currency,
            value: cartSnapshot.totalCents / 100,
          }),
          { userData: userDataAddress },
        );
      } catch (e) {
        setError(e);
        emitEvent(
          emit,
          CHECKOUT_EVENT_NAMES.wizardError,
          buildWizardErrorEvent({
            ctx,
            source: e instanceof NetworkApiError ? 'network' : 'api',
            error_code: e instanceof ApiError ? e.code : 'unknown',
            http_status: e instanceof ApiError ? e.httpStatus : undefined,
          }),
        );
        throw e;
      }

      // ── 2) PATCH payment (cod par défaut) ────────────────────────────────
      try {
        await wizardClient.patchPayment(leadId, {
          paymentMethod: DEFAULT_PAYMENT_METHOD,
        });
        const userDataPayment = await buildUserDataForEvent(
          CHECKOUT_EVENT_NAMES.addPaymentInfo,
          {
            firstName: leadDraft.firstName,
            phone: leadDraft.phone,
            city: input.city,
            country: input.country,
          },
        );
        emitEvent(
          emit,
          CHECKOUT_EVENT_NAMES.addPaymentInfo,
          buildAddPaymentInfoEvent({
            ctx: { ...ctx, step_name: 'payment' },
            payment_type: DEFAULT_PAYMENT_METHOD,
            currency: cartSnapshot.currency,
            value: cartSnapshot.totalCents / 100,
          }),
          { userData: userDataPayment },
        );
      } catch (e) {
        setError(e);
        emitEvent(
          emit,
          CHECKOUT_EVENT_NAMES.wizardError,
          buildWizardErrorEvent({
            ctx: { ...ctx, step_name: 'payment' },
            source: e instanceof NetworkApiError ? 'network' : 'api',
            error_code: e instanceof ApiError ? e.code : 'unknown',
            http_status: e instanceof ApiError ? e.httpStatus : undefined,
          }),
        );
        throw e;
      }

      // ── 3) POST order ────────────────────────────────────────────────────
      try {
        const res = await wizardClient.createOrder({
          leadId,
          formContext: {
            formId: formContext.formId,
            formMode: formContext.formMode,
            variantKey: formContext.variantKey ?? null,
            source: formContext.source,
            // CHA-232 — la langue persistée reste `fr|ar` (contrainte SQL) ;
            // `en` n'est qu'une langue d'affichage → ramenée à `fr` ici.
            language: formContext.language === 'en' ? 'fr' : formContext.language,
          },
          items: cartSnapshot.items,
          // Phase 3 — INVARIANT anti-422 : le total attendu inclut le crédit
          // (plafonné au total). Le serveur reprice et soustrait le MÊME
          // crédit (via le grant du code) → les totaux coïncident.
          expectedTotalCents:
            cartSnapshot.totalCents - Math.min(creditCents, cartSnapshot.totalCents),
          currency: cartSnapshot.currency,
          paymentMethod: DEFAULT_PAYMENT_METHOD,
          shippingMode: input.shippingMode,
          couponCode: couponCode ?? undefined,
        });
        setOrderId(res.orderId);
        // Phase 3 — mémorise le code de fidélité émis (affiché au ThankYouStep).
        if (res.loyalty) setLoyalty(res.loyalty);
        // Conversion principale — identity complète hydratée
        // (Enhanced Conversions Google Ads + Advanced Matching Meta).
        // Email pas encore connu à ce stade (capturé optionnellement au
        // thank_you step) ; phone/firstName/city/country suffisent.
        const userDataPurchase = await buildUserDataForEvent(
          CHECKOUT_EVENT_NAMES.purchase,
          {
            firstName: leadDraft.firstName,
            phone: leadDraft.phone,
            city: input.city,
            country: input.country,
          },
        );
        // Si un lead a précédé (cookie jpid posé), l'achat réel porte le MÊME
        // jpid → la CAPI déduplique avec le lead même si le ledger serveur a été
        // perdu (restart). Achat direct → null → event_id client standard.
        // Parité avec le `CheckoutFlow` legacy.
        const purchaseJpid = readJourneyPurchaseId();
        emitEvent(
          emit,
          CHECKOUT_EVENT_NAMES.purchase,
          buildPurchaseEvent({
            ctx: { ...ctx, step_name: 'thank_you' },
            transaction_id: res.orderId,
            currency: res.currency,
            value: res.totalCents / 100,
            items: cartSnapshot.items.map((it) => ({
              item_id: it.sku,
              item_name: it.name,
              price: it.unitPriceCents / 100,
              quantity: it.quantity,
              currency: res.currency,
            })),
            payment_type: DEFAULT_PAYMENT_METHOD,
            meta_purchase_eid: purchaseJpid ?? undefined,
          }),
          { userData: userDataPurchase },
        );
        goToStep('thank_you');
        setSuccess();
      } catch (e) {
        setError(e);
        emitEvent(
          emit,
          CHECKOUT_EVENT_NAMES.wizardError,
          buildWizardErrorEvent({
            ctx: { ...ctx, step_name: 'thank_you' },
            source: e instanceof NetworkApiError ? 'network' : 'api',
            error_code: e instanceof ApiError ? e.code : 'unknown',
            http_status: e instanceof ApiError ? e.httpStatus : undefined,
          }),
        );
        throw e;
      }
    },
    [
      leadId,
      formContext,
      cartSnapshot,
      couponCode,
      creditCents,
      goToStep,
      setOrderId,
      setLoyalty,
      setLoading,
      setSuccess,
      setError,
      emit,
    ],
  );

  return { status: state.status, error: state.error, execute, reset: setIdle };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook : payment (Step 3)
// ─────────────────────────────────────────────────────────────────────────────

export interface PaymentMutationInput {
  paymentMethod: 'cod' | 'bank_transfer' | 'card';
}

export function usePaymentMutation(): {
  status: MutationStatus;
  error: ApiError | null;
  execute: (input: PaymentMutationInput) => Promise<void>;
  reset: () => void;
} {
  const { state, setLoading, setSuccess, setError, setIdle } = useBaseMutation();
  const { emit } = useTracking();
  const leadId = useWizardStore((s) => s.leadId);
  const formContext = useWizardStore((s) => s.formContext);
  const cartSnapshot = useWizardStore((s) => s.cartSnapshot);

  const execute = useCallback(
    async (input: PaymentMutationInput): Promise<void> => {
      if (!leadId || !formContext) {
        throw new ApiError('invalid_state', 'Lead manquant.', 0);
      }
      setLoading();
      try {
        await wizardClient.patchPayment(leadId, { paymentMethod: input.paymentMethod });
        // Note : on NE goToStep('thank_you') PAS ici — c'est la mutation
        // `useOrderCreateMutation` qui finalise et déclenche le go-to.
        setSuccess();
        emitEvent(
          emit,
          CHECKOUT_EVENT_NAMES.addPaymentInfo,
          buildAddPaymentInfoEvent({
            ctx: buildWizardCtx({
              formId: formContext.formId,
              formMode: formContext.formMode,
              variantKey: formContext.variantKey,
              stepName: 'payment',
              leadId,
            }),
            payment_type: input.paymentMethod,
            currency: cartSnapshot?.currency ?? 'MAD',
            value: cartSnapshot ? cartSnapshot.totalCents / 100 : undefined,
          }),
        );
      } catch (e) {
        setError(e);
        emitEvent(
          emit,
          CHECKOUT_EVENT_NAMES.wizardError,
          buildWizardErrorEvent({
            ctx: buildWizardCtx({
              formId: formContext.formId,
              formMode: formContext.formMode,
              variantKey: formContext.variantKey,
              stepName: 'payment',
              leadId,
            }),
            source: e instanceof NetworkApiError ? 'network' : 'api',
            error_code: e instanceof ApiError ? e.code : 'unknown',
            http_status: e instanceof ApiError ? e.httpStatus : undefined,
          }),
        );
        throw e;
      }
    },
    [leadId, formContext, cartSnapshot, setLoading, setSuccess, setError, emit],
  );

  return { status: state.status, error: state.error, execute, reset: setIdle };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook : order create (finalisation après payment)
// ─────────────────────────────────────────────────────────────────────────────

export interface OrderCreateMutationInput {
  items: CartItemSnapshot[];
  expectedTotalCents: number;
  currency: string;
  paymentMethod: 'cod' | 'bank_transfer' | 'card';
  shippingMode: 'standard' | 'express' | 'pickup';
}

export function useOrderCreateMutation(): {
  status: MutationStatus;
  error: ApiError | null;
  execute: (input: OrderCreateMutationInput) => Promise<{ orderId: string }>;
  reset: () => void;
} {
  const { state, setLoading, setSuccess, setError, setIdle } = useBaseMutation();
  const { emit } = useTracking();
  const leadId = useWizardStore((s) => s.leadId);
  const formContext = useWizardStore((s) => s.formContext);
  const setOrderId = useWizardStore((s) => s.setOrderId);
  const goToStep = useWizardStore((s) => s.goToStep);

  const execute = useCallback(
    async (input: OrderCreateMutationInput): Promise<{ orderId: string }> => {
      if (!leadId || !formContext) {
        throw new ApiError('invalid_state', 'Lead manquant.', 0);
      }
      setLoading();
      try {
        const res = await wizardClient.createOrder({
          leadId,
          formContext: {
            formId: formContext.formId,
            formMode: formContext.formMode,
            variantKey: formContext.variantKey ?? null,
            source: formContext.source,
          },
          items: input.items,
          expectedTotalCents: input.expectedTotalCents,
          currency: input.currency,
          paymentMethod: input.paymentMethod,
          shippingMode: input.shippingMode,
        });
        setOrderId(res.orderId);
        goToStep('thank_you');
        setSuccess();
        // Conversion finale (purchase). Si un lead a précédé (cookie jpid posé),
        // l'achat réel porte le MÊME jpid → la CAPI déduplique avec le lead même
        // si le ledger serveur a été perdu (restart). Achat direct (sans lead) :
        // `readJourneyPurchaseId()` renvoie null → event_id client standard.
        // Parité avec `CheckoutFlow`.
        const purchaseJpid = readJourneyPurchaseId();
        emitEvent(
          emit,
          CHECKOUT_EVENT_NAMES.purchase,
          buildPurchaseEvent({
            ctx: buildWizardCtx({
              formId: formContext.formId,
              formMode: formContext.formMode,
              variantKey: formContext.variantKey,
              stepName: 'thank_you',
              leadId,
            }),
            transaction_id: res.orderId,
            currency: res.currency,
            value: res.totalCents / 100,
            items: input.items.map((it) => ({
              item_id: it.sku,
              item_name: it.name,
              price: it.unitPriceCents / 100,
              quantity: it.quantity,
              currency: res.currency,
            })),
            payment_type: input.paymentMethod,
            meta_purchase_eid: purchaseJpid ?? undefined,
          }),
        );
        return { orderId: res.orderId };
      } catch (e) {
        setError(e);
        emitEvent(
          emit,
          CHECKOUT_EVENT_NAMES.wizardError,
          buildWizardErrorEvent({
            ctx: buildWizardCtx({
              formId: formContext.formId,
              formMode: formContext.formMode,
              variantKey: formContext.variantKey,
              stepName: 'payment',
              leadId,
            }),
            source: e instanceof NetworkApiError ? 'network' : 'api',
            error_code: e instanceof ApiError ? e.code : 'unknown',
            http_status: e instanceof ApiError ? e.httpStatus : undefined,
          }),
        );
        throw e;
      }
    },
    [leadId, formContext, setOrderId, goToStep, setLoading, setSuccess, setError, emit],
  );

  return { status: state.status, error: state.error, execute, reset: setIdle };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook : email opt-in newsletter (legacy CHA-230)
// ─────────────────────────────────────────────────────────────────────────────
// @deprecated CHA-231 : utiliser `useOrderEmailConfirmationMutation` pour la
// nouvelle UX de confirmation transactionnelle. Ce hook reste pour rétro-compat
// si du code legacy le référence ; il sera supprimé une fois la migration finie.

export function useEmailOptInMutation(): {
  status: MutationStatus;
  error: ApiError | null;
  execute: (input: { email: string; emailConsent: true }) => Promise<void>;
  reset: () => void;
} {
  const { state, setLoading, setSuccess, setError, setIdle } = useBaseMutation();
  const orderId = useWizardStore((s) => s.orderId);

  const execute = useCallback(
    async (input: { email: string; emailConsent: true }): Promise<void> => {
      if (!orderId) {
        throw new ApiError('invalid_state', 'Commande manquante.', 0);
      }
      setLoading();
      try {
        await wizardClient.optInEmail(orderId, input);
        setSuccess();
      } catch (e) {
        setError(e);
        throw e;
      }
    },
    [orderId, setLoading, setSuccess, setError],
  );

  return { status: state.status, error: state.error, execute, reset: setIdle };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook : confirmation transactionnelle par email (CHA-231)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Variante UX du opt-in email : on propose à l'utilisateur de recevoir une
 * confirmation écrite de SA commande + le numéro de suivi à l'expédition.
 *
 * Côté serveur, c'est le même endpoint PATCH `/api/checkout/order/[id]/email`
 * (l'email est enregistré sur l'order et le lead). La différence est purement
 * sémantique :
 *   - Le copy UI parle de « confirmation de commande », pas de newsletter.
 *   - L'event tracking émis est `order_confirmation_optin`, qui doit alimenter
 *     un funnel analytics distinct de `newsletter_signup`.
 *
 * Si un jour on veut séparer techniquement (column DB `email_purpose`), il
 * suffira de patcher ce hook pour envoyer le purpose au backend. La surface
 * UI reste inchangée.
 */
export function useOrderEmailConfirmationMutation(): {
  status: MutationStatus;
  error: ApiError | null;
  execute: (input: { email: string; emailConsent: true }) => Promise<void>;
  reset: () => void;
} {
  const { state, setLoading, setSuccess, setError, setIdle } = useBaseMutation();
  const { emit } = useTracking();
  const orderId = useWizardStore((s) => s.orderId);
  const leadId = useWizardStore((s) => s.leadId);
  const formContext = useWizardStore((s) => s.formContext);

  const execute = useCallback(
    async (input: { email: string; emailConsent: true }): Promise<void> => {
      if (!orderId) {
        throw new ApiError('invalid_state', 'Commande manquante.', 0);
      }
      setLoading();
      try {
        await wizardClient.optInEmail(orderId, input);
        setSuccess();
        // Tracking — event dédié à la confirmation transactionnelle (distinct
        // de la newsletter pour pouvoir suivre les deux funnels séparément).
        emit('order_confirmation_optin', {
          order_id: orderId,
          lead_id: leadId ?? undefined,
          form_id: formContext?.formId,
          form_mode: formContext?.formMode,
          variant_key: formContext?.variantKey ?? null,
          email_set: true,
        });
      } catch (e) {
        setError(e);
        throw e;
      }
    },
    [orderId, leadId, formContext, setLoading, setSuccess, setError, emit],
  );

  return { status: state.status, error: state.error, execute, reset: setIdle };
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-export pour debug
// ─────────────────────────────────────────────────────────────────────────────

export { isRetryableApiError };
