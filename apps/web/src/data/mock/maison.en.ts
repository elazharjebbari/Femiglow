/**
 * Mock maison EN — English translation of `mockMaison` (FR canonical).
 *
 * Phase 3 T3.6 — Strings aligned with `apps/web/messages/en.json` namespace
 * `marketing.maison.*` and tone guide
 * `docs/i18n-content-2026-05/00-style-reference.md` §5 (Voice EN).
 *
 * Strategy: clone FR mock (preserves assets, structures, slugs) and
 * override displayable strings. Sub-objects with strict required fields
 * (image, cta) are redefined explicitly — not spread — so TS validates
 * the exact shape.
 *
 * Voice: international English, editorial, sober. `Maison` preserved as
 * proper noun (untranslatable). Brand terms preserved in Latin: `Paste`,
 * `Powder`, `Step 4`, `FemiGlow`, `MAD`. Sentence case for titles.
 *
 * @see docs/i18n-content-2026-05/03-seed-data/component-bindings-en.csv
 */
import type { MaisonPageContent } from '@/lib/schemas';

import { mockMaison } from './maison';

export const mockMaisonEn: MaisonPageContent = {
  ...mockMaison,

  hero: {
    variant: 'editorial',
    kicker: 'The maison',
    title: 'The maison of quiet glow.',
    subtitle:
      'A maison of nail care, edited in Rabat. Slow, attentive, set at 25 bis avenue Patrice Lumumba.',
    cta: {
      variant: 'link',
      label: 'Discover the atelier →',
      href: '#origine',
    },
  },

  origine: {
    kicker: 'The origin',
    titre: 'An attention born of a simple observation.',
    paragraphs: [
      'FemiGlow was born of a simple observation: nails hold when given the time they ask for. No more, no less. Five minutes in the evening, two measured gestures and a buffer.',
      'The idea took shape in Rabat, in an atelier on avenue Patrice Lumumba where the light falls just before 6 PM. Three crafts sat around a table: formulation, materials, writing. One conviction — slow beauty is an attention, never a performance.',
      'Our founder is a biologist. She trained in cosmetic manufacturing before editing her first natural skincare lines. Today, she runs workshops in the same atelier where FemiGlow is designed. The ritual is not a discovery — it is a transmission.',
    ],
    image: {
      src: '/maison/maison-origine.png',
      alt: 'Workshop bench in Rabat, afternoon light over jars of Paste and Powder',
      width: 960,
      height: 1200,
    },
    imagePosition: 'right',
  },

  fondatrice: {
    kicker: 'The founder',
    titre: 'Our founder, biologist and formulator.',
    paragraphs: [
      "Our founder holds a master's degree in biology. She trained in cosmetic product manufacturing across several specialised courses. Before FemiGlow, she edited several natural skincare lines — each one taught her something about the gesture, the material, the traceability.",
      'She now runs workshops in the Rabat atelier, open to young Moroccan formulators. FemiGlow is her slowest maison.',
    ],
    image: {
      src: '/maison/fondatrice-mains.svg',
      alt: 'Rabat atelier, late afternoon. Our founder prepares a Paste, a slow gesture, a continuous observation',
      width: 960,
      height: 1200,
    },
    imagePosition: 'left',
  },

  atelier: {
    adresse: '25 bis avenue Patrice Lumumba',
    quartier: 'Rabat',
    description: [
      'The atelier fits in two quiet rooms: a clear worktop, a library of technical books and notebooks, material samples arranged by season.',
      'We formulate here in small batches. Our founder receives by appointment, on Tuesdays and Thursdays, for workshops and consultations.',
    ],
    gallerie: [
      {
        src: '/maison/atelier-1.svg',
        alt: 'Wide view of the Rabat atelier, light passing through the north window',
        width: 1600,
        height: 1067,
      },
      {
        src: '/maison/atelier-2.svg',
        alt: 'Workbench with precision scale, jars of Paste and Powder, open notebook',
        width: 1600,
        height: 1067,
      },
      {
        src: '/maison/atelier-3.svg',
        alt: 'Material detail: beeswax melted in a ceramic bowl',
        width: 1600,
        height: 1067,
      },
    ],
  },

  matieres: mockMaison.matieres.map((m) => {
    if (m.id === 'cire') {
      return {
        ...m,
        nom: 'Beeswax',
        origine: 'Harvested in the Souss, in partnership with a family cooperative.',
        pourquoi: 'Softens the seating of the nail and holds the Paste without stiffening it.',
      };
    }
    if (m.id === 'jojoba') {
      return {
        ...m,
        nom: 'Jojoba oil',
        origine: 'Cold-pressed in Souss-Massa, Moroccan supply chain.',
        pourquoi:
          "Liquid wax that mimics the skin's sebum — nourishes without leaving a film.",
      };
    }
    if (m.id === 'kaolin') {
      return {
        ...m,
        nom: 'Polishing kaolin',
        origine: 'Moroccan mining clay, quarry in Marrakech.',
        pourquoi:
          'Polishes the nail without drying it — this is what brings the Step 4 buffer to life.',
      };
    }
    // riz
    return {
      ...m,
      nom: 'Rice powder',
      origine: 'Organic crops from Asia, traced supply chain.',
      pourquoi:
        'A gentle absorbent — this is what gives the Powder its matte finish, just before the shine.',
    };
  }),

  engagements: mockMaison.engagements.map((e) => {
    switch (e.ordre) {
      case 1:
        return {
          ...e,
          titre: 'Direct sourcing',
          description:
            'Each material is traced back to its origin atelier. No anonymous intermediary.',
        };
      case 2:
        return {
          ...e,
          titre: 'Halal certification',
          description:
            'Each material is traced. Our manufacturer is audited by the Halal Cosmetics Council. The label appears on every jar and on the buffer.',
        };
      case 3:
        return {
          ...e,
          titre: 'Without polish',
          description:
            'No plastic resin, no strong solvent. The care shows on the nail, not in the air.',
        };
      case 4:
        return {
          ...e,
          titre: 'Slow ritual',
          description:
            'Everything is calibrated for five minutes in the evening. Shorter, it becomes cosmetics. Longer, it becomes a chore.',
        };
      case 5:
        return {
          ...e,
          titre: 'Local',
          description:
            'Bottled, labelled, shipped from Rabat. When possible, we keep the chain short.',
        };
      default:
        return {
          ...e,
          titre: 'Transmission',
          description:
            'Our team regularly trains beauty professionals and formulators in the Japanese manicure, at the Rabat atelier.',
        };
    }
  }),

  crossLinks: mockMaison.crossLinks.map((c) => {
    if (c.id === 'rituel') {
      return {
        id: c.id,
        href: c.href,
        kicker: 'The ritual',
        titre: 'Read the ritual',
        image: {
          src: c.image.src,
          alt: 'Hands at rest on a pale wool throw',
          width: c.image.width,
          height: c.image.height,
        },
      };
    }
    if (c.id === 'journal') {
      return {
        id: c.id,
        href: c.href,
        kicker: 'The journal',
        titre: 'The journal',
        image: {
          src: c.image.src,
          alt: 'Open notebook on a table, pen suspended above',
          width: c.image.width,
          height: c.image.height,
        },
      };
    }
    // kit
    return {
      id: c.id,
      href: c.href,
      kicker: 'The pack',
      titre: 'See the pack',
      image: {
        src: c.image.src,
        alt: 'Open FemiGlow pack: Paste, Powder and buffer aligned on a cream linen',
        width: c.image.width,
        height: c.image.height,
      },
    };
  }),
};
