'use client';

/**
 * Étape 2 du wizard, version progressive (test A/B `kit-step2-v2`).
 *
 * Un seul champ à l'arrivée, la ville. L'adresse s'ouvre une fois la ville
 * connue, les frais et le total arrivent avec elle, et le bouton reste à
 * portée de pouce. Conception : docs/checkout-etape2-conversion/03-conception-ux.md.
 *
 * Tout ce qui touche au montant et à l'envoi vit dans `useAddressForm`,
 * partagé avec `AddressStep`.
 */

import { useEffect, useId, useMemo, useState, type CSSProperties, type MouseEvent } from 'react';
import { flushSync } from 'react-dom';
import { Controller } from 'react-hook-form';

import { TextAreaField, TextField } from '@/components/forms/Field';
import { Heading } from '@/components/ui/Heading';
import { Text } from '@/components/ui/Text';
import {
  deriveAddressPhase,
  isAddressCityValid,
  isAddressLineValid,
  type AddressPhase,
} from '@/lib/checkout/address/address-phase';
import { ADDRESS_NOTES_MAX_LENGTH } from '@/lib/checkout/address/address-form-schema';
import { useAddressReveal } from '@/lib/checkout/address/use-address-reveal';
import type { PublicCity } from '@/lib/checkout/delivery/use-delivery-cities';
import { useWizardTranslation } from '@/lib/checkout/i18n/use-wizard-translation';
import { checkoutTotalCents, shippingCentsFromPrice } from '@/lib/checkout/shipping-fee';
import { useAppliedCoupon } from '@/lib/checkout/state/use-applied-coupon';
import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import { useShippingConfig } from '@/lib/checkout/use-shipping-config';
import { alignWizardStep } from '@/lib/checkout/wizard-arrival';
import { cn } from '@/lib/utils/cn';

import { AddressCouponDisclosure } from '../AddressCouponDisclosure';
import { ConfirmOrderButton } from '../ConfirmOrderButton';
import { StepActionBar } from '../StepActionBar';
import { StepProgressLine } from '../StepProgressLine';
import { StockIndicator } from '../StockIndicator';
import { CityAutocomplete } from '../components/CityAutocomplete';
import { useIsWizardInPanel } from '../wizard-scroll-container';
import { useAddressForm } from './use-address-form';

const SUGGESTIONS_KEYBOARD_CLOSED = 5;
const SUGGESTIONS_KEYBOARD_OPEN = 3;

const PROGRESS_BY_PHASE: Record<AddressPhase, number> = {
  city: 66,
  address: 80,
  ready: 95,
  submitting: 100,
};

const FIELD_CLASS =
  '!h-12 !bg-creme-warm !px-3 !py-0 placeholder:!text-placeholder scroll-mb-64 scroll-mt-32';

// Les erreurs passent en bleu : le grenat est réservé au bouton de confirmation.
const NOTICE_THEME = { '--color-petale-dark': 'var(--color-notice)' } as CSSProperties;

function ValidMark() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden className="text-sauge-dark">
      <path
        d="M3.5 8.5l3 3 6-6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AddressStepV2() {
  const headingId = useId();
  const cityId = useId();
  const lineId = useId();
  const notesId = useId();
  const formId = useId();

  const { t, language } = useWizardTranslation();
  const copy = t.addressV2;
  const inPanel = useIsWizardInPanel();

  const goToStep = useWizardStore((s) => s.goToStep);
  const cart = useWizardStore((s) => s.cartSnapshot);
  const firstName = useWizardStore((s) => s.leadDraft.firstName).trim();
  const draft = useWizardStore((s) => s.addressDraft);
  const appliedCoupon = useAppliedCoupon({ hydrationSafe: false });
  const isCampaignPromo = appliedCoupon.isPromo && appliedCoupon.hasDiscount;
  const { freeShipping } = useShippingConfig();

  const [cityFocused, setCityFocused] = useState(false);
  const [noteOpen, setNoteOpen] = useState(() => draft.notes.trim().length > 0);

  const {
    revealed,
    reveal,
    onCityBlur: revealOnCityBlur,
  } = useAddressReveal({
    citySlug: draft.citySlug,
    cityText: draft.city,
    addressDraft: draft.addressLine1,
  });

  const {
    form: {
      register,
      control,
      trigger,
      formState: { errors },
    },
    tracking,
    addressDraft,
    watchedCity,
    watchedLine1,
    cityDisplayValue,
    onCitySelected,
    onCityMatched,
    onCityBlur,
    onSubmit,
    submitting,
    networkBanner,
  } = useAddressForm({
    validationMode: 'onTouched',
    onInvalid: reveal,
    isAddressRevealed: () => revealed,
  });

  useEffect(() => {
    if (!inPanel) alignWizardStep();
  }, [inPanel]);

  const phase = deriveAddressPhase({
    city: watchedCity,
    addressLine1: watchedLine1,
    addressRevealed: revealed,
    submitting,
  });

  const focusField = (id: string) => document.getElementById(id)?.focus();

  // Choix dans la liste : le curseur passe à l'adresse dans le même geste,
  // sinon iOS referme le clavier. D'où `flushSync` : le champ doit être actif
  // avant le `focus`.
  const onCityPicked = (city: PublicCity) => {
    onCitySelected(city);
    flushSync(reveal);
    if (!watchedLine1.trim()) focusField(lineId);
  };

  const onCtaClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (phase === 'ready') return;
    event.preventDefault();
    if (phase === 'submitting') return;
    if (phase === 'city') {
      tracking.trackCtaTapIncomplete('city');
      focusField(cityId);
      return;
    }
    tracking.trackCtaTapIncomplete('addressLine1');
    flushSync(reveal);
    focusField(lineId);
    if (watchedLine1.trim()) void trigger('addressLine1');
  };

  const openNote = () => {
    setNoteOpen(true);
    tracking.trackNoteOpened();
  };

  // Frais : même règle que le serveur. Ville hors catalogue → tarif par défaut.
  const cityKnown = Boolean(addressDraft.citySlug) || (revealed && !cityFocused && isAddressCityValid(watchedCity));
  const shippingCents = shippingCentsFromPrice(addressDraft.cityDeliveryPriceMad, freeShipping);
  const currency = t.cartRecap.currency;
  const formatAmount = (cents: number) => `${(cents / 100).toFixed(0)} ${currency}`;
  const totalCents = useMemo(
    () =>
      cart
        ? checkoutTotalCents({
            cartTotalCents: cart.totalCents,
            creditCents: appliedCoupon.creditCents,
            shippingCents,
          })
        : null,
    [cart, appliedCoupon.creditCents, shippingCents],
  );

  const ctaLabels: Record<AddressPhase, string> = {
    city: copy.ctaChooseCity,
    address: copy.ctaAddAddress,
    ready: copy.ctaConfirm,
    submitting: copy.ctaSaving,
  };

  const progressLabel = firstName
    ? phase === 'ready'
      ? copy.progressAlmost(firstName)
      : copy.progress(firstName)
    : copy.progressNoName;

  const lineField = register('addressLine1');
  const primaryVariantId = cart?.items[0]?.variantId;

  return (
    <section
      aria-labelledby={headingId}
      className="space-y-4"
      style={NOTICE_THEME}
      data-testid="wizard-step-address"
      data-variant="v2"
      data-phase={phase}
    >
      <StepProgressLine
        label={progressLabel}
        percent={PROGRESS_BY_PHASE[phase]}
        onBack={() => goToStep('lead')}
        backDisabled={submitting}
      />

      {/* Le titre cède sa place aux champs, mais reste pour les lecteurs d'écran. */}
      <header className={cn('space-y-1', revealed && 'sr-only')}>
        <Heading as="h2" size="md" id={headingId} italic="always">
          {copy.title}
        </Heading>
        <Text size="small" tone="secondary">
          {copy.subtitle}
        </Text>
      </header>

      {primaryVariantId && <StockIndicator variantId={primaryVariantId} hideInStock />}

      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-3">
        <Controller
          control={control}
          name="city"
          render={({ field }) => (
            <CityAutocomplete
              id={cityId}
              label={copy.cityLabel}
              placeholder={copy.cityPlaceholder}
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
              onFocus={() => {
                setCityFocused(true);
                tracking.trackCityFocus();
              }}
              onBlur={() => {
                setCityFocused(false);
                field.onBlur();
                onCityBlur();
                revealOnCityBlur(field.value ?? '');
              }}
              onCitySelected={onCityPicked}
              onExactMatch={onCityMatched}
              testId="wizard-address-city"
              compact
              limit={SUGGESTIONS_KEYBOARD_CLOSED}
              compactLimit={SUGGESTIONS_KEYBOARD_OPEN}
              keepFocusOnCommit={false}
              className={FIELD_CLASS}
              inputAdornment={addressDraft.citySlug ? <ValidMark /> : undefined}
            />
          )}
        />

        {cityKnown && (
          <p
            role="status"
            data-testid="wizard-shipping-notice"
            className="flex items-baseline justify-between gap-3 text-[13px] text-encre-soft"
          >
            <span>
              {addressDraft.cityDeliveryEta
                ? copy.deliveryLine(addressDraft.cityDeliveryEta)
                : copy.deliveryUnknown}
            </span>
            <span dir="ltr" className="shrink-0 font-medium tabular-nums text-encre">
              {shippingCents === 0 ? copy.deliveryFree : formatAmount(shippingCents)}
            </span>
          </p>
        )}

        {/* Toujours monté : le focus doit pouvoir arriver dans le geste. */}
        <div
          data-testid="wizard-address-reveal"
          data-revealed={revealed}
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-[240ms] ease-out motion-reduce:transition-none',
            revealed ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
          )}
          {...(revealed ? {} : { inert: '' as unknown as boolean, 'aria-hidden': true })}
        >
          <div className="min-h-0 overflow-hidden">
            <TextField
              id={lineId}
              label={copy.addressLabel}
              placeholder={copy.addressPlaceholder}
              autoComplete="shipping street-address"
              enterKeyHint="done"
              required
              error={errors.addressLine1?.message}
              inputAdornment={isAddressLineValid(watchedLine1) ? <ValidMark /> : undefined}
              className={FIELD_CLASS}
              data-testid="wizard-address-line1"
              onFocus={tracking.trackLineFocus}
              {...lineField}
            />
          </div>
        </div>

        {revealed && (
          <div className="space-y-2 pt-1">
            {noteOpen ? (
              <TextAreaField
                id={notesId}
                label={t.address.notesLabel}
                rows={2}
                maxLength={ADDRESS_NOTES_MAX_LENGTH}
                placeholder={copy.notePlaceholder}
                error={errors.notes?.message}
                className={cn('!bg-creme-warm !px-3 placeholder:!text-placeholder', 'scroll-mb-64')}
                {...register('notes')}
              />
            ) : (
              <button
                type="button"
                onClick={openNote}
                data-testid="wizard-add-note"
                className="-my-2 block py-2 text-sm text-encre-soft underline decoration-encre/25 underline-offset-4"
              >
                {copy.addNote}
              </button>
            )}
            {!isCampaignPromo && <AddressCouponDisclosure />}
          </div>
        )}

        {networkBanner && (
          <div
            role="alert"
            className="rounded bg-notice-soft p-3 text-sm text-notice"
            data-testid="wizard-address-error"
          >
            {networkBanner}
          </div>
        )}
      </form>

      <StepActionBar hideWithKeyboard={phase === 'city'}>
        {({ keyboardOpen }) => (
          <>
            {cityKnown && totalCents !== null && (
              <div data-testid="wizard-action-total">
                <p className="flex items-baseline justify-between gap-3 text-encre">
                  <span className="text-sm">{copy.totalLabel}</span>
                  <span
                    dir="ltr"
                    className="text-lg font-semibold tabular-nums"
                    data-testid="wizard-action-total-amount"
                  >
                    {formatAmount(totalCents)}
                  </span>
                </p>
                {appliedCoupon.hasDiscount && appliedCoupon.code && (
                  <p className="text-xs text-sauge-dark" data-testid="wizard-promo-applied">
                    {copy.promoLine(appliedCoupon.code, formatAmount(appliedCoupon.creditCents))}
                  </p>
                )}
              </div>
            )}
            <ConfirmOrderButton
              ref={tracking.ctaRef}
              phase={phase}
              label={ctaLabels[phase]}
              formId={formId}
              compact={keyboardOpen}
              onClick={onCtaClick}
            />
            {!keyboardOpen && (
              <p className="text-center text-xs text-encre-soft">{copy.reassurance}</p>
            )}
          </>
        )}
      </StepActionBar>
    </section>
  );
}
