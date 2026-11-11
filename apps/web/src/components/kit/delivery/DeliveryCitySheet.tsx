'use client';

/**
 * Panneau « Ma ville » : choisir sa ville depuis la page /kit et voir le total
 * exact avant le formulaire. La ville validée est écrite dans le brouillon
 * d'adresse du formulaire : l'étape 2 la reprend sans la redemander.
 *
 * Six villes en raccourci (ordre de l'admin, avec leur tarif) pour choisir
 * sans clavier, et la recherche du formulaire (autocomplétion FR/AR, alias)
 * pour toutes les autres.
 */

import { useEffect, useId, useState } from 'react';

import { BottomSheet } from '@/components/ui/BottomSheet';
import { CityAutocomplete } from '@/components/checkout/wizard/components/CityAutocomplete';
import {
  deliveryDraftFromCity,
  formatMad,
} from '@/lib/checkout/delivery/delivery-estimate';
import {
  useDeliveryCities,
  type PublicCity,
} from '@/lib/checkout/delivery/use-delivery-cities';
import {
  getWizardDictionary,
  type DictionaryLanguage,
} from '@/lib/checkout/i18n/dictionary';
import { shippingCentsFromPrice } from '@/lib/checkout/shipping-fee';
import { useWizardStore } from '@/lib/checkout/state/wizard-store';
import { useShippingConfig } from '@/lib/checkout/use-shipping-config';
import { cn } from '@/lib/utils/cn';

const SHORTCUT_COUNT = 6;

export interface DeliveryCitySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prix du kit, remises déduites (centimes). */
  productCents: number;
  language: DictionaryLanguage;
  /** Après validation (la ville est déjà enregistrée). */
  onValidated?: (city: PublicCity) => void;
}

function cityLabel(city: PublicCity, language: DictionaryLanguage): string {
  return language === 'ar' && city.nameAr ? city.nameAr : city.nameFr;
}

export function DeliveryCitySheet({
  open,
  onOpenChange,
  productCents,
  language,
  onValidated,
}: DeliveryCitySheetProps) {
  const t = getWizardDictionary(language);
  const copy = t.deliveryEstimate;
  const dir = language === 'ar' ? 'rtl' : 'ltr';
  const searchId = useId();
  const { freeShipping } = useShippingConfig();
  const mergeAddressDraft = useWizardStore((s) => s.mergeAddressDraft);
  const savedSlug = useWizardStore((s) => s.addressDraft.citySlug);

  const { items: shortcuts } = useDeliveryCities('', { limit: SHORTCUT_COUNT, debounceMs: 0 });
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PublicCity | null>(null);

  // À l'ouverture : la ville déjà enregistrée est présélectionnée si elle est
  // dans les raccourcis ; la recherche repart vide.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelected(shortcuts.find((c) => c.slug === savedSlug) ?? null);
  }, [open, savedSlug, shortcuts]);

  const shippingCents = selected ? shippingCentsFromPrice(selected.deliveryPriceMad, freeShipping) : null;

  const validate = () => {
    if (!selected) return;
    mergeAddressDraft(deliveryDraftFromCity(selected));
    onOpenChange(false);
    onValidated?.(selected);
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={copy.sheetTitle}
      description={copy.sheetSubtitle}
      closeLabel={copy.close}
      dir={dir}
      data-testid="delivery-city-sheet"
      // Pas de clavier à l'ouverture : les raccourcis suffisent souvent.
      onOpenAutoFocus={(event) => event.preventDefault()}
      bodyClassName="px-5 pb-8 pt-4 sm:px-8"
    >
      <div className="space-y-5" dir={dir}>
        {shortcuts.length > 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-encre/60">
              {copy.popularLabel}
            </p>
            <ul className="grid grid-cols-2 gap-2">
              {shortcuts.map((city) => {
                const active = selected?.slug === city.slug;
                return (
                  <li key={city.slug}>
                    <button
                      type="button"
                      aria-pressed={active}
                      data-testid={`delivery-city-shortcut-${city.slug}`}
                      onClick={() => {
                        setSelected(city);
                        setQuery('');
                      }}
                      className={cn(
                        'flex min-h-[44px] w-full items-center justify-between gap-1.5 rounded-lg border px-2.5 py-2 text-start text-[13.5px] transition-colors',
                        active
                          ? 'border-sauge-dark bg-sauge-soft text-encre'
                          : 'border-encre/15 bg-white text-encre hover:border-encre/35',
                      )}
                    >
                      <span className="truncate">{cityLabel(city, language)}</span>
                      <span dir="ltr" className="shrink-0 whitespace-nowrap tabular-nums text-encre/70">
                        {freeShipping ? copy.free : formatMad(city.deliveryPriceMad * 100, language)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <CityAutocomplete
          id={searchId}
          label={copy.searchLabel}
          placeholder={copy.searchPlaceholder}
          popularCitiesLabel={copy.popularLabel}
          searchingLabel={copy.searching}
          freeDeliveryLabel={t.address.cityFreeDelivery}
          freeShippingLabel={t.shipping.freeBadgeLabel}
          value={query}
          language={language}
          onChange={setQuery}
          onCitySelected={(city) => {
            setSelected(city);
            setQuery(cityLabel(city, language));
          }}
          onExactMatch={(city) => setSelected(city)}
          keepFocusOnCommit={false}
          testId="delivery-city-search"
          className="!h-12 !bg-creme-warm !px-3"
        />

        {selected && shippingCents !== null ? (
          <div
            data-testid="delivery-city-recap"
            className="space-y-1.5 rounded-xl border border-encre/10 bg-white p-4 text-[14px] tabular-nums"
          >
            <p className="flex justify-between gap-3 text-encre/75">
              <span>{copy.recapKit}</span>
              <span dir="ltr">{formatMad(productCents, language)}</span>
            </p>
            <p className="flex justify-between gap-3 text-encre/75">
              <span>{copy.recapShipping(cityLabel(selected, language), selected.deliveryEta)}</span>
              <span dir="ltr" key={selected.slug} className="fg-amount-in px-1">
                {shippingCents === 0 ? copy.free : formatMad(shippingCents, language)}
              </span>
            </p>
            <p className="flex items-baseline justify-between gap-3 border-t border-encre/10 pt-2 text-encre">
              <span className="text-[11px] font-semibold uppercase tracking-[0.14em]">
                {copy.totalLabel}
              </span>
              <span
                dir="ltr"
                key={`total-${selected.slug}`}
                className="fg-amount-in whitespace-nowrap px-1 font-display text-[26px] leading-none [font-feature-settings:'lnum','tnum']"
                data-testid="delivery-city-total"
              >
                {formatMad(productCents + shippingCents, language)}
              </span>
            </p>
          </div>
        ) : null}

        <div className="space-y-2">
          <button
            type="button"
            onClick={validate}
            disabled={!selected}
            data-testid="delivery-city-validate"
            className="flex min-h-[52px] w-full items-center justify-center rounded-[14px] bg-encre px-4 text-[16px] font-medium text-creme transition-opacity disabled:opacity-40"
          >
            {copy.validate}
          </button>
          <p className="text-center text-[12.5px] text-encre/65">{copy.explanation}</p>
        </div>
      </div>
    </BottomSheet>
  );
}
