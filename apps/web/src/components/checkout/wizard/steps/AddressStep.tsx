'use client';

/**
 * CHA-230 / CHA-231 — Step 2 du wizard : adresse de livraison (simplifiée).
 *
 * CHA-230 — Combobox dynamique (DB-driven)
 * ────────────────────────────────────────
 * - Remplace l'ancien `<datalist>` + `MOROCCAN_CITIES` par `<CityAutocomplete>`
 *   qui interroge `/api/delivery-cities/search` (debounced + cached).
 * - Quand l'utilisateur **commit** une ville depuis le listbox, on persiste
 *   le slug + nom AR + prix MAD + ETA dans le wizard store (champs additifs
 *   v3) — utiles pour le bloc dynamique de réassurance et pour l'opt-out
 *   serveur (mode B / cart estimate).
 * - Si l'utilisateur tape un texte qui ne matche pas de ville reconnue, le
 *   champ reste valide côté Zod (texte libre) — c'est l'agent du livreur
 *   qui clarifiera. On évite de bloquer la conversion à cause d'un orthographe
 *   exotique.
 *
 * CHA-231 — Simplifications
 * ─────────────────────────
 * - Pas de code postal ni de complément d'adresse séparés.
 * - Pas de choix de mode de livraison : un seul mode (24-48h gratuit ou
 *   tarifé selon la ville).
 *
 * Banner livraison
 * ────────────────
 * - **Vide / pas reconnu**  : message générique "Livraison gratuite en
 *   24-48 h partout au Maroc."
 * - **Ville reconnue**      : prix dynamique + ETA réel ("Livraison 19 MAD
 *   en 24h — paiement à la livraison.").
 *
 * Tracking
 * ────────
 * - `useAddressMutation` orchestre l'enchaînement et émet :
 *     * `address_completed` (au PATCH address)
 *     * `add_payment_info` (au PATCH payment cod, proxy serveur)
 *     * `purchase` (au POST order)
 *
 * A11y
 * ────
 * - Le combobox suit le pattern WAI-ARIA "editable with list autocomplete".
 * - Le bloc shipping est `role="note"` (information, pas action).
 * - Tous les champs `dir="auto"` pour bilingue FR/AR.
 */

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useId, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';
import { TextField, TextAreaField } from '@/components/forms/Field';
import { useWizardTranslation } from '@/lib/checkout/i18n/use-wizard-translation';
import { useAddressMutation } from '@/lib/checkout/state/use-wizard-mutations';
import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import type { PublicCity } from '@/lib/checkout/delivery/use-delivery-cities';

import { StockIndicator } from '../StockIndicator';
import { CityAutocomplete } from '../components/CityAutocomplete';
import { NoCommitmentBadge } from '../NoCommitmentBadge';
import { InvitationCodeField } from '@/components/sections/InvitationCodeField';
import { cn } from '@/lib/utils/cn';
import { useShippingConfig } from '@/lib/checkout/use-shipping-config';
import { ShippingPriceDisplay } from '@/components/checkout/ShippingPriceDisplay';
import { DEFAULT_WIZARD_FEATURES } from '@/lib/checkout/copy/wizard-copy';

// ─────────────────────────────────────────────────────────────────────────────
// Schema validation client (miroir simplifié de `patchLeadAddressInputSchema`)
// ─────────────────────────────────────────────────────────────────────────────

const addressFormSchema = z.object({
  city: z
    .string()
    .trim()
    .min(2, 'Indiquez votre ville.')
    .max(80, 'Nom de ville trop long.'),
  addressLine1: z
    .string()
    .trim()
    .min(4, 'Adresse trop courte (numéro + rue).')
    .max(160, 'Adresse trop longue.'),
  notes: z.string().trim().max(500, 'Note trop longue (max 500 caractères).').optional(),
});

type AddressFormValues = z.input<typeof addressFormSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component : bloc de réassurance livraison (dynamique selon ville)
// ─────────────────────────────────────────────────────────────────────────────

interface ShippingNoticeProps {
  title: string;
  body: string;
  freeShipping: boolean;
  catalogPriceMad?: number | null;
  /** Note lecteur d'écran i18n pour le badge livraison offerte. */
  freeBadgeSrNote: (price: number) => string;
  /** Libellé visible i18n du badge livraison offerte. */
  freeBadgeLabel: string;
}

function ShippingNotice({
  title,
  body,
  freeShipping,
  catalogPriceMad,
  freeBadgeSrNote,
  freeBadgeLabel,
}: ShippingNoticeProps) {
  return (
    <section
      role="note"
      aria-label={title}
      className="rounded border border-encre/15 bg-creme p-4 flex items-start gap-3"
      data-testid="wizard-shipping-notice"
    >
      <span
        aria-hidden="true"
        className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-encre/30 bg-white text-encre"
      >
        {/* Picto colis sobre — pas d'emoji, pas d'icônes lourdes */}
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <path
            d="M2 5.5L8 2L14 5.5M2 5.5V11.5L8 14L14 11.5V5.5M2 5.5L8 9M14 5.5L8 9M8 9V14"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <div className="flex-1 space-y-1" data-testid="wizard-shipping-body">
        <Text size="small" className="font-medium text-encre">
          {title}
        </Text>
        <Text size="small" tone="secondary">
          {body}
        </Text>
        {freeShipping && catalogPriceMad && catalogPriceMad > 0 && (
          <div
            className="pt-1"
            data-testid="wizard-shipping-free-badge"
          >
            <ShippingPriceDisplay
              displayPrice={`${catalogPriceMad} MAD`}
              freeShipping
              freeLabel={freeBadgeLabel}
              size="sm"
              align="left"
              srNote={freeBadgeSrNote(catalogPriceMad)}
            />
          </div>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface AddressStepProps {
  /** Override optionnel du CTA — sinon utilise le dictionnaire i18n. */
  cta?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function AddressStep({ cta }: AddressStepProps) {
  const cityId = useId();
  const line1Id = useId();
  const notesId = useId();

  const { t } = useWizardTranslation();

  const addressDraft = useWizardStore((s) => s.addressDraft);
  const mergeAddressDraft = useWizardStore((s) => s.mergeAddressDraft);
  const goToStep = useWizardStore((s) => s.goToStep);
  const cartSnapshot = useWizardStore((s) => s.cartSnapshot);
  // Phase 3 — crédit de fidélité
  const couponCode = useWizardStore((s) => s.couponCode);
  const creditCents = useWizardStore((s) => s.creditCents);
  const couponKind = useWizardStore((s) => s.couponKind);
  const setCoupon = useWizardStore((s) => s.setCoupon);
  const clearCoupon = useWizardStore((s) => s.clearCoupon);
  const isArabic = useWizardStore((s) => s.formContext?.language === 'ar');
  // Disclosure crédit : ouverte d'office si un code a déjà été saisi (reprise).
  const [couponDisclosureOpen, setCouponDisclosureOpen] = useState<boolean>(!!couponCode);

  const mutation = useAddressMutation();
  const { freeShipping } = useShippingConfig();

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<AddressFormValues>({
    resolver: zodResolver(addressFormSchema),
    mode: 'onChange',
    defaultValues: {
      city: addressDraft.city ?? '',
      addressLine1: addressDraft.addressLine1 ?? '',
      notes: addressDraft.notes ?? '',
    },
  });

  // Persistance du draft (resume après refresh).
  const watchedCity = watch('city');
  const watchedLine1 = watch('addressLine1');
  const watchedNotes = watch('notes');
  useEffect(() => {
    mergeAddressDraft({
      city: typeof watchedCity === 'string' ? watchedCity : '',
      addressLine1: typeof watchedLine1 === 'string' ? watchedLine1 : '',
      notes: typeof watchedNotes === 'string' ? watchedNotes : '',
      // CHA-231 : mode unique forcé côté UI — on garde le champ pour le payload
      // serveur mais l'utilisateur n'a plus le choix.
      shippingMode: 'standard',
    });
  }, [watchedCity, watchedLine1, watchedNotes, mergeAddressDraft]);

  // Callback de commit : appelé quand l'utilisateur sélectionne une ville
  // depuis le listbox du combobox. On met à jour le formulaire ET le store
  // pour persister les champs cached (citySlug + cityNameAr + prix + ETA).
  const onCitySelected = (city: PublicCity) => {
    setValue('city', city.nameFr, { shouldValidate: true, shouldDirty: true });
    mergeAddressDraft({
      city: city.nameFr,
      citySlug: city.slug,
      cityNameAr: city.nameAr,
      cityDeliveryPriceMad: city.deliveryPriceMad,
      cityDeliveryEta: city.deliveryEta,
    });
  };

  // Si l'utilisateur modifie le champ texte SANS passer par le listbox
  // (frappe libre), on invalide les champs cached pour éviter qu'un prix
  // stale soit affiché alors que le texte ne correspond plus.
  useEffect(() => {
    if (!addressDraft.citySlug) return;
    if (
      typeof watchedCity === 'string' &&
      watchedCity.trim().toLowerCase() !== addressDraft.city.trim().toLowerCase()
    ) {
      mergeAddressDraft({
        citySlug: null,
        cityNameAr: null,
        cityDeliveryPriceMad: null,
        cityDeliveryEta: null,
      });
    }
  }, [watchedCity, addressDraft.citySlug, addressDraft.city, mergeAddressDraft]);

  // VariantId pour le StockIndicator (premier item du panier).
  const primaryVariantId = useMemo(
    () => cartSnapshot?.items[0]?.variantId,
    [cartSnapshot],
  );

  const onSubmit = handleSubmit(async (values) => {
    try {
      await mutation.execute({
        // Si la ville a été commit via le combobox, on envoie le nom FR
        // canonique (déjà persisté dans le draft) ; sinon le texte saisi.
        city: (addressDraft.city || values.city).trim(),
        addressLine1: values.addressLine1,
        country: 'MA',
        notes: values.notes || undefined,
        shippingMode: 'standard',
      });
    } catch {
      // Erreur déjà capturée par `mutation.error` — affichée plus bas.
    }
  });

  const submitting = mutation.status === 'loading';

  const networkBanner = useMemo(() => {
    if (!mutation.error) return null;
    const e = mutation.error;
    if (e.code === 'invalid_input') return t.errors.invalidInput;
    if (e.code === 'stock_insufficient') return t.errors.stockInsufficient;
    if (e.code === 'price_mismatch') return t.errors.priceMismatch;
    if (e.code === 'rate_limited') return t.errors.rateLimited;
    if (e.httpStatus === 0) return t.errors.networkOffline;
    return e.message || t.errors.addressGeneric;
  }, [mutation.error, t.errors]);

  // Bloc de réassurance — dynamique si une ville a été reconnue.
  const shippingBody = useMemo(() => {
    const price = addressDraft.cityDeliveryPriceMad;
    const eta = addressDraft.cityDeliveryEta;
    // Si livraison offerte (flag admin actif) : on signale "offerte"
    // dès qu'on connaît un ETA, même si le prix catalogue > 0.
    if (freeShipping && eta) {
      return t.address.shippingDynamicFreeBody(eta);
    }
    if (price !== null && eta) {
      return price === 0
        ? t.address.shippingDynamicFreeBody(eta)
        : t.address.shippingDynamicPaidBody(price, eta);
    }
    return t.address.shippingFreeBody;
  }, [
    addressDraft.cityDeliveryPriceMad,
    addressDraft.cityDeliveryEta,
    t.address,
    freeShipping,
  ]);

  return (
    <section
      aria-labelledby={`${cityId}-heading`}
      className="space-y-7"
      data-testid="wizard-step-address"
    >
      <header className="space-y-2">
        <Heading
          as="h2"
          size="md"
          id={`${cityId}-heading`}
          italic="always"
        >
          {t.address.title}
        </Heading>
        <Text size="small" tone="secondary">
          {t.address.subtitle}
        </Text>
      </header>

      {primaryVariantId && (
        <StockIndicator variantId={primaryVariantId} className="" />
      )}

      <form onSubmit={onSubmit} noValidate className="space-y-6">
        {/* Ville — combobox dynamique alimenté par /api/delivery-cities/search */}
        <Controller
          control={control}
          name="city"
          render={({ field }) => (
            <CityAutocomplete
              id={cityId}
              label={t.address.cityLabel}
              placeholder={t.address.cityPlaceholder}
              hint={t.address.cityHintBilingual}
              matchedHint={t.address.cityHintMatched}
              popularCitiesLabel={t.address.cityPopularLabel}
              searchingLabel={t.address.citySearching}
              freeDeliveryLabel={t.address.cityFreeDelivery}
              freeShippingLabel={t.shipping.freeBadgeLabel}
              required
              error={errors.city?.message}
              value={field.value ?? ''}
              onChange={field.onChange}
              onBlur={field.onBlur}
              onCitySelected={onCitySelected}
              testId="wizard-address-city"
            />
          )}
        />

        <TextField
          id={line1Id}
          label={t.address.addressLine1Label}
          placeholder={t.address.addressLine1Placeholder}
          autoComplete="address-line1"
          required
          error={errors.addressLine1?.message}
          data-testid="wizard-address-line1"
          {...register('addressLine1')}
        />

        {/* Mode de livraison — bloc dynamique (prix réel si ville reconnue) */}
        <ShippingNotice
          title={t.address.shippingTitle}
          body={shippingBody}
          freeShipping={freeShipping}
          catalogPriceMad={addressDraft.cityDeliveryPriceMad ?? null}
          freeBadgeSrNote={t.shipping.freeBadgeSrNote}
          freeBadgeLabel={t.shipping.freeBadgeLabel}
        />

        <TextAreaField
          id={notesId}
          label={t.address.notesLabel}
          rows={3}
          maxLength={500}
          showCounter
          placeholder={t.address.notesPlaceholder}
          error={errors.notes?.message}
          {...register('notes')}
        />

        {/* Phase 3 — crédit de fidélité (optionnel). Porte DISCRÈTE repliée
            par défaut (esprit coupon-doc : zéro friction pour qui n'a pas de
            code) ; s'ouvre sur clic, ou d'office si un code est déjà saisi
            (reprise). Validé via /api/coupons/redeem → store → total. */}
        <details
          data-testid="wizard-coupon-field"
          open={couponDisclosureOpen}
          onToggle={(e) => setCouponDisclosureOpen(e.currentTarget.open)}
          className="text-sm"
        >
          <summary
            data-testid="wizard-coupon-summary"
            className="flex w-fit cursor-pointer list-none items-center gap-1.5 text-encre/65 transition-colors hover:text-encre [&::-webkit-details-marker]:hidden"
          >
            <svg
              viewBox="0 0 16 16"
              width="12"
              height="12"
              aria-hidden
              className={cn(
                'shrink-0 text-sauge transition-transform duration-300',
                couponDisclosureOpen && 'rotate-90',
              )}
            >
              <path d="M6 4l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="underline decoration-encre/20 underline-offset-4">
              {isArabic ? 'لدي رمز وفاء' : 'J’ai un code de fidélité'}
            </span>
          </summary>
          <div className="mt-2 max-w-[18rem]">
            <InvitationCodeField
              isArabic={isArabic}
              initialCode={couponCode ?? ''}
              initialValueCents={creditCents}
              initialKind={couponKind ?? 'credit'}
              onValid={(code, cents, kind) => setCoupon(code, cents, kind)}
              onClear={clearCoupon}
            />
          </div>
        </details>

        {networkBanner && (
          <div
            role="alert"
            className="rounded border border-petale-dark/30 bg-petale-soft/30 p-4 text-sm text-encre"
            data-testid="wizard-address-error"
          >
            {networkBanner}
          </div>
        )}

        {submitting && (
          <p
            role="status"
            aria-live="polite"
            className="text-sm leading-[1.6] text-encre/60"
            data-testid="wizard-address-processing"
          >
            {t.address.processingOrder}
          </p>
        )}

        {/* Kolenda §5 W2 (P3) — Trust #1 loss aversion : visible juste
            avant le CTA primary pour désamorcer la peur engagement
            financier. */}
        {DEFAULT_WIZARD_FEATURES.noCommitmentBadge && (
          <NoCommitmentBadge
            label={t.noCommitment.label}
            sub={t.noCommitment.sub}
            ariaLabel={t.noCommitment.ariaLabel}
          />
        )}

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          {/* Kolenda §5 W1 (P9) — Hierarchy : le bouton Retour passe en
              link (souligné chuchoté) pour que le primary « Confirmer »
              domine visuellement. Évite le mauvais clic mobile. */}
          <Button
            type="button"
            variant="link"
            size="md"
            onClick={() => goToStep('lead')}
            disabled={submitting}
          >
            {t.common.back}
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={submitting}
            disabled={!isValid || submitting}
            data-testid="wizard-address-submit"
          >
            {cta ?? t.address.ctaSubmit}
          </Button>
        </div>
      </form>
    </section>
  );
}
