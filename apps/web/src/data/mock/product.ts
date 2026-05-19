import type { Product } from '@/lib/schemas';

/**
 * Audit 08/09 — Pack FemiGlow (manucure japonaise). Anchoring
 * 199 dh payé / 390 dh référence (option B § 0.1 doc 09) implémenté via
 * `priceCents = 39000` + `promoPriceCents = 19900` pour rester compatible
 * avec <PriceDisplay> et la pipeline tracking GA4 existante.
 */
export const mockKit: Product = {
  id: 'fg-kit-001',
  slug: 'le-rituel',
  name: 'Pack FemiGlow',
  tagline:
    'Manucure japonaise. Deux gestes, un polissoir, un éclat.',
  description:
    'Le pack FemiGlow réunit deux pots — une paste lissante et une powder lustrante — et un polissoir Step 4 Polish & Shine. Une manucure japonaise, formulée à Rabat par Souheila, biologiste et formulatrice. Sans vernis. Sans abrasion. Cinq minutes par jour suffisent.',
  priceCents: 39000,
  promoPriceCents: 19900,
  currency: 'MAD',
  images: [
    {
      src: '/products/kit-principale.png',
      alt: 'Pack FemiGlow ouvert sur fond pastel — pot paste vert sauge, pot powder rose poudré, polissoir Step 4 bleu ciel, vague rose poudré, typographie FemiGlow',
      width: 1600,
      height: 2000,
    },
    {
      src: '/products/kit-detail-mains.png',
      alt: 'Mains aux ongles nus, courts à moyens, naturellement brillants après le rituel paste-powder-polish',
      width: 1600,
      height: 1067,
    },
  ],
  composition: [
    {
      name: '1 Paste',
      origin: 'Atlas marocain · Souss-Massa',
      description:
        'Pâte crème onctueuse. Cire d\u2019abeille, huile de jojoba, tocophérol. Filme la plaque sans l\u2019étouffer.',
    },
    {
      name: '2 Powder',
      origin: 'Maroc · Asie biologique',
      description:
        'Poudre fine blanche. Talc cosmétique, poudre de riz, silice. Absorbe l\u2019excès, lustre la surface.',
    },
    {
      name: 'Polissoir Step 4 Polish & Shine',
      origin: 'Atelier de Rabat · kaolin de Marrakech',
      description:
        'Polissoir rectangulaire bleu ciel. Trois faces, trois grains. Révèle la brillance naturelle.',
    },
  ],
  inStock: true,
  estimatedShipping: 'Rabat : 24 h. Maroc : 48 à 72 h. Livraison offerte.',
  primaryVariantSku: 'FEMI-KIT-100',
  primaryVariantId: 'pvar_0c01jxc1yn4kjp3b',
};
