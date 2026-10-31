'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  ADDRESS_CITY_MIN_LENGTH,
  isAddressCityValid,
} from '@/lib/checkout/address/address-phase';

export interface UseAddressRevealInput {
  citySlug: string | null;
  cityText: string;
  addressDraft: string;
}

/**
 * Le champ adresse s'ouvre quand la ville est connue, y compris une ville hors
 * catalogue à la sortie du champ : sans ce cas, une cliente d'un petit village
 * resterait bloquée. Une fois ouvert, il ne se referme plus.
 */
export function useAddressReveal({ citySlug, cityText, addressDraft }: UseAddressRevealInput) {
  const [revealed, setRevealed] = useState(
    () => Boolean(citySlug) || isAddressCityValid(cityText) || addressDraft.trim().length > 0,
  );
  const reveal = useCallback(() => setRevealed(true), []);

  useEffect(() => {
    if (citySlug) reveal();
  }, [citySlug, reveal]);

  const onCityBlur = useCallback(
    (text: string) => {
      if (text.trim().length >= ADDRESS_CITY_MIN_LENGTH) reveal();
    },
    [reveal],
  );

  return { revealed, reveal, onCityBlur };
}
