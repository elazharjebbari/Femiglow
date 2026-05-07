import { routes } from './routes';

export interface MenuEntry {
  label: string;
  href: string;
  description: string;
  vignette: { src: string; alt: string };
}

export const menuEntries: MenuEntry[] = [
  {
    label: 'Le rituel',
    href: routes.rituel,
    description: 'Quatre gestes, quatre minutes, matin et soir.',
    vignette: { src: '/maison/cross-rituel.png', alt: '' },
  },
  {
    label: 'Le kit',
    href: routes.kit,
    description: 'Six pièces pensées pour les saisons sèches.',
    vignette: { src: '/maison/cross-kit.png', alt: '' },
  },
  {
    label: 'Le journal',
    href: routes.journal,
    description: "Les notes de l'atelier, en lecture lente.",
    vignette: { src: '/maison/cross-journal.png', alt: '' },
  },
  {
    label: 'La maison',
    href: routes.maison,
    description: "Casablanca, l'atelier, les mains qui font.",
    vignette: { src: '/maison/atelier-1.png', alt: '' },
  },
  {
    label: 'Contact',
    href: routes.contact,
    description: 'Une question, une commande spéciale.',
    vignette: { src: '/maison/atelier-3.png', alt: '' },
  },
];

export const menuSeasonLabel = 'Saison du printemps — Casablanca';
export const menuSeasonLabelShort = 'Printemps · Casa';
export const menuSignature = 'Casablanca, saison du printemps.';
