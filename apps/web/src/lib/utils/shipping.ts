import type { ShippingMode, VilleMaroc } from '@/lib/schemas';

const STANDARD_CASA_CENTS = 4000;
const STANDARD_REST_CENTS = 6000;
const EXPRESS_CASA_CENTS = 8000;

export function computeShippingCents(input: {
  city?: VilleMaroc | string;
  mode?: ShippingMode;
}): number {
  const city = (input.city ?? '').toString().toLowerCase();
  const mode = input.mode ?? 'standard';
  if (mode === 'express') {
    if (city === 'casablanca') return EXPRESS_CASA_CENTS;
    return EXPRESS_CASA_CENTS;
  }
  if (city === 'casablanca' || city === 'casa') return STANDARD_CASA_CENTS;
  return STANDARD_REST_CENTS;
}

export function isExpressAvailable(city?: VilleMaroc | string): boolean {
  return (city ?? '').toString().toLowerCase() === 'casablanca';
}

export const shippingLabel = {
  standard: 'Standard · 3 à 5 jours ouvrés',
  express: 'Express · 24-48 h Casablanca',
} as const;
