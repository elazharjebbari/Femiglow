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
    description: 'Manucure japonaise halal. Deux gestes, un polissoir.',
    vignette: { src: '/maison/cross-rituel.png', alt: '' },
  },
  {
    label: 'Le pack',
    href: routes.kit,
    description: 'Paste, powder, polissoir Step 4. Cinq minutes par soir.',
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
    description: "Rabat, l'atelier de notre fondatrice, les mains qui font.",
    vignette: { src: '/maison/atelier-1.png', alt: '' },
  },
  {
    label: 'Contact',
    href: routes.contact,
    description: 'Une question, une commande spéciale.',
    vignette: { src: '/maison/atelier-3.png', alt: '' },
  },
];

export const menuSeasonLabel = 'Saison du printemps — Rabat';
export const menuSeasonLabelShort = 'Printemps · Rabat';
export const menuSignature = 'Rabat, saison du printemps.';
