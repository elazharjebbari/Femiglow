/**
 * Mock homepage EN — English translation of `mockHomepage` (FR canonical).
 *
 * Phase 3 T3.5 — Strings aligned with `apps/web/messages/en.json` namespace
 * `marketing.home.*` and tone guide
 * `docs/i18n-content-2026-05/00-style-reference.md` §5 (Voice EN).
 *
 * Strategy: clone FR mock (preserves assets, structures, etc.) and
 * override displayable strings only.
 *
 * @see docs/i18n-content-2026-05/03-seed-data/component-bindings-en.csv
 */
import type { HomepageContent } from '@/lib/schemas';

import { mockHomepage } from './homepage';

export const mockHomepageEn: HomepageContent = {
  ...mockHomepage,

  hero: {
    ...mockHomepage.hero,
    kicker: 'Maison de Rabat',
    title: 'The FemiGlow kit. Two gestures, a revealed glow.',
    subtitle:
      'Japanese halal manicure, conceived in Rabat. No polish, no abrasion.',
    cta: {
      label: 'Discover the ritual',
      href: '/rituel',
      variant: 'primary',
    },
    ctaSecondary: {
      label: 'Receive the kit',
      href: '/kit',
      variant: 'link',
    },
    image: {
      src: '/journal/hero-accueil.svg',
      alt: 'Open FemiGlow pastel kit, sage paste jar and powder rose-petal jar, sky-blue buffer, natural late-morning light',
      width: 1600,
      height: 2000,
    },
  },

  gestes: mockHomepage.gestes.map((g, i) => ({
    ...g,
    duree: i === 0 ? '2 minutes' : i === 1 ? '2 minutes' : '1 minute',
    description:
      i === 0
        ? 'Smooth cream paste, applied on dry nails. Films, smooths, prepares.'
        : i === 1
          ? 'Fine white powder, layered on the paste. Absorbs, lustres, awakens.'
          : 'Step 4 buffer used in slow strokes. The natural shine emerges.',
  })),

  manifeste: {
    kicker: 'Manifesto',
    title: 'Slow beauty is an attention.',
    paragraphs: [
      'We believe that nails reveal what is given to them. The gesture, the time, the patience.',
      'Five minutes a day. Two gestures and a buffer. No demonstration.',
    ],
  },

  avis: mockHomepage.avis.map((a) => ({
    ...a,
    quote:
      a.id === 't1'
        ? 'Three months without breakage. Five minutes each evening suffice.'
        : a.id === 't2'
          ? 'The ritual punctuates the end of my day. It has become a moment for myself.'
          : 'The paste delivers a finish that resembles me. Natural, without polish.',
  })),

  journalExtraitsSlugs: mockHomepage.journalExtraitsSlugs,
};
