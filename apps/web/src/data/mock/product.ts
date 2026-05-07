import type { Product } from '@/lib/schemas';

export const mockKit: Product = {
  id: 'fg-kit-001',
  slug: 'le-rituel',
  name: 'Le rituel FemiGlow',
  tagline: 'Trois gestes, cinq minutes, une saison.',
  description:
    'Le kit FemiGlow réunit la base, le fortifiant et la lime. Trois gestes mesurés, pensés à Casablanca, pour accompagner vos ongles à chaque saison.',
  priceCents: 32000,
  promoPriceCents: null,
  currency: 'MAD',
  images: [
    {
      src: '/products/kit-principale.svg',
      alt: 'Le rituel FemiGlow \u2014 flacon de base, fortifiant et lime, sur fond crème',
      width: 1600,
      height: 2000,
    },
    {
      src: '/products/kit-detail-mains.svg',
      alt: 'Mains appliquant la base transparente FemiGlow',
      width: 1600,
      height: 1067,
    },
  ],
  composition: [
    {
      name: 'Base transparente',
      origin: 'Maroc, Casablanca',
      description: 'Soin lissant qui prépare la surface de l\u2019ongle.',
    },
    {
      name: 'Fortifiant',
      origin: 'Maroc',
      description: 'Concentré qui retient l\u2019ongle dans le temps.',
    },
    {
      name: 'Lime artisanale',
      origin: 'Atelier de Casablanca',
      description: 'Coupe de précision, douce sur la kératine.',
    },
  ],
  inStock: true,
  estimatedShipping: '48 à 72 heures à Casablanca',
};
