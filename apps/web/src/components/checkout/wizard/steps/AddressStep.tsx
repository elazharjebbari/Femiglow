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
 * - **Vide / pas reconnu**  : message générique "Frais de livraison selon
 *   votre ville, réglés à la livraison avec votre commande."
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

import { useId, useMemo } from 'react';
import { Controller } from 'react-hook-form';

import { Button } from '@/components/ui/Button';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';
import { TextField, TextAreaField } from '@/components/forms/Field';
import { isAddressCityValid } from '@/lib/checkout/address/address-phase';
import { useWizardTranslation } from '@/lib/checkout/i18n/use-wizard-translation';
import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import { useAppliedCoupon } from '@/lib/checkout/state/use-applied-coupon';

import { AddressCouponDisclosure } from '../AddressCouponDisclosure';
import { StockIndicator } from '../StockIndicator';
import { CityAutocomplete } from '../components/CityAutocomplete';
import { NoCommitmentBadge } from '../NoCommitmentBadge';
import { useAddressForm } from './use-address-form';
import { useShippingConfig } from '@/lib/checkout/use-shipping-config';
import { ShippingPriceDisplay } from '@/components/checkout/ShippingPriceDisplay';
import { DEFAULT_WIZARD_FEATURES } from '@/lib/checkout/copy/wizard-copy';

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

  const { t, language } = useWizardTranslation();

  const goToStep = useWizardStore((s) => s.goToStep);
  const cartSnapshot = useWizardStore((s) => s.cartSnapshot);
  // Cette étape n'est jamais dans la première peinture serveur (le wizard
  // démarre à l'étape « lead » tant qu'il n'est pas hydraté) : pas de parité
  // d'hydratation à préserver, et la garde masquerait le code à la reprise.
  const appliedCoupon = useAppliedCoupon({ hydrationSafe: false });
  const couponCode = appliedCoupon.code;
  const creditCents = appliedCoupon.creditCents;
  // Code de CAMPAGNE (arrivé par l'URL publicitaire) déjà appliqué et chiffré.
  // Un crédit de fidélité saisi à la main garde le champ ouvert historique.
  const isCampaignPromo = appliedCoupon.isPromo && appliedCoupon.hasDiscount;

  const { freeShipping } = useShippingConfig();

  const {
    form: {
      register,
      control,
      formState: { errors, isValid },
    },
    tracking,
    addressDraft,
    watchedCity,
    cityDisplayValue,
    onCitySelected,
    onCityMatched,
    onCityBlur,
    onLineBlur,
    onNotesBlur,
    onSubmit,
    submitting,
    networkBanner,
  } = useAddressForm({ validationMode: 'onChange' });

  // VariantId pour le StockIndicator (premier item du panier).
  const primaryVariantId = useMemo(
    () => cartSnapshot?.items[0]?.variantId,
    [cartSnapshot],
  );

  // Un bouton désactivé ne reçoit aucun évènement : le tap est capté par son
  // conteneur (`pointer-events-none` sur le bouton grisé).
  const onSubmitAreaPress = () => {
    if (isValid || submitting) return;
    tracking.trackCtaTapIncomplete(isAddressCityValid(watchedCity) ? 'addressLine1' : 'city');
  };

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
              displayValue={cityDisplayValue}
              language={language}
              onChange={field.onChange}
              onBlur={() => {
                field.onBlur();
                onCityBlur();
              }}
              onFocus={tracking.trackCityFocus}
              onCitySelected={onCitySelected}
              onExactMatch={onCityMatched}
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
          onFocus={tracking.trackLineFocus}
          {...register('addressLine1', { onBlur: onLineBlur })}
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
          {...register('notes', { onBlur: onNotesBlur })}
        />

        {/* Code de campagne DÉJÀ appliqué (arrivée par une publicité) :
            on confirme, on n'ouvre pas un champ. Un champ ouvert intitulé
            « J'ai un code » fait douter la cliente qu'un autre code soit
            requis, et une frappe suffit à annuler sa remise. */}
        {isCampaignPromo ? (
          <p
            data-testid="wizard-promo-applied"
            className="flex items-center gap-1.5 text-sm text-encre"
          >
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden className="shrink-0 text-sauge">
              <path
                d="M4 8.4l2.6 2.6 5.4-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {t.address.couponApplied(
              couponCode ?? '',
              `${(creditCents / 100).toFixed(0)} ${t.cartRecap.currency}`,
            )}
          </p>
        ) : (
          <AddressCouponDisclosure />
        )}

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
          <div
            onPointerDown={onSubmitAreaPress}
            className="[&_button:disabled]:pointer-events-none"
            data-testid="wizard-address-submit-area"
          >
            <Button
              ref={tracking.ctaRef}
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              loadingLabel={t.common.processing}
              disabled={!isValid || submitting}
              data-testid="wizard-address-submit"
            >
              {cta ?? t.address.ctaSubmit}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
