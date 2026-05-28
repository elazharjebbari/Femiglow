/**
 * Mock rituel EN — English translation of `mockRituel` (FR canonical).
 *
 * Phase 3 T3.6 — Strings aligned with `apps/web/messages/en.json` namespace
 * `marketing.rituel.*` and tone guide
 * `docs/i18n-content-2026-05/00-style-reference.md` §5 (Voice EN).
 *
 * Strategy: clone FR mock (preserves assets, structures, slugs) and
 * override displayable strings. Sub-objects with strict required fields
 * (image, cta, video sources) are redefined explicitly so TS validates
 * the exact shape.
 *
 * Voice: international English, editorial, sober. `Maison` preserved as
 * proper noun. Brand terms preserved in Latin: `Paste`, `Powder`,
 * `Step 4`, `Polish & Shine`, `FemiGlow`, `MAD`, `INCI`.
 *
 * @see docs/i18n-content-2026-05/03-seed-data/component-bindings-en.csv
 */
import type { RituelPageContent } from '@/lib/schemas';

import { mockRituel } from './rituel';

export const mockRituelEn: RituelPageContent = {
  ...mockRituel,

  hero: {
    variant: 'editorial',
    kicker: 'The ritual',
    title: 'Japanese manicure. Two gestures. A slow glow.',
    subtitle: 'A slow method, told in Rabat.',
    image: {
      src: '/rituel/hero-lifestyle.svg',
      alt: 'Hands at rest on a pale linen sheet, oblique late-morning light',
      width: 2400,
      height: 1600,
    },
  },

  origine: {
    kicker: 'Origin',
    titre: 'An attention from Japan, passed on in Rabat.',
    paragraphes: [
      'In Japan, the care of the hand is not a product: it is a daily attention, slow, without declaration. The Japanese manicure — also known as kawaii or chigiri — dates back to the early 20th century. It reveals the natural shine of the nail through buffing, without polish.',
      'Our founder brought this gesture back from a training trip. She set it within a Moroccan framework: local materials, halal certification, atelier at 25 bis avenue Patrice Lumumba, in Rabat.',
      'The result fits in five minutes a day. No promises, no cure. A habit that settles in, as one sets a cup on a wooden table.',
    ],
    photoSepia: {
      src: '/rituel/origine-sepia.svg',
      alt: 'Hands of a Japanese artisan holding a buffer, sepia photograph',
      width: 1600,
      height: 2000,
    },
  },

  videoGestes: {
    ...mockRituel.videoGestes,
    sources: {
      mp4: '/videos/rituel-90s.mp4',
      webm: '/videos/rituel-90s.webm',
    },
    poster: {
      src: '/videos/rituel-poster.svg',
      alt: 'First gesture of the ritual: a hazelnut-sized amount of Paste, laid down',
      width: 1920,
      height: 1080,
    },
    captions: {
      fr: '/captions/rituel-fr.vtt',
      ar: '/captions/rituel-ar.vtt',
    },
    transcript:
      'The big clean-girl trend for nails is the Japanese manicure. But there is something you absolutely need to know first.\n\nThe Japanese manicure is in fact a care applied to the nail plate that nourishes it and makes it shine for at least three weeks.\n\nOf course, if your nails are damaged, ridged, or a previous removal was poorly done, the result will not be at its best. You need to take care of your nails first so they are repaired as much as possible to reach the optimal result.\n\nThat said, since the Japanese manicure contains beeswax, silicates, pearl powder and many other beautiful things, it helps you repair the plate. It is a deep care.',
    chapters: [
      { key: 'paste', label: 'Paste', startSeconds: 0 },
      { key: 'powder', label: 'Powder', startSeconds: 18 },
      { key: 'step-4', label: 'Step 4', startSeconds: 42 },
      { key: 'polissage', label: 'Buffing', startSeconds: 68 },
    ],
    provenance: 'Filmed in the Rabat atelier, March 2026.',
  },

  sciences: {
    titre: 'Three materials, three uses.',
    essais: [
      {
        id: 'cire',
        titre: 'Beeswax',
        paragraphe:
          'Films the nail plate without sealing it. A 12-week clinical study observed a reduction in dorsal microfissures in subjects exposed to dry cold¹.',
        sourceRef: '[1]',
      },
      {
        id: 'kaolin',
        titre: 'Polishing kaolin',
        paragraphe:
          'A soft white clay. When the nail is smoothed, the Step 4 buffer does not score — it reveals the natural shine of the keratin².',
        sourceRef: '[2]',
      },
      {
        id: 'halal',
        titre: 'The halal framework',
        paragraphe:
          'Material traceability, no denatured alcohol, no non-compliant animal derivatives. The label follows an audit by the Halal Cosmetics Council³.',
        sourceRef: '[3]',
      },
    ],
    sourcesAcademiques: [
      'Tanaka H. (2021). Beeswax-based barrier creams in cold-induced nail fragility. Journal of Cosmetic Dermatology, 20(4).',
      'Benyahia L. (2019). Kaolin clay polishing in non-invasive nail care. Annales de Dermatologie et de Vénéréologie, 146(8).',
      'Halal Cosmetics Council (2023). Standards for halal cosmetic ingredient sourcing and certification — public framework.',
    ],
  },

  interview: {
    introduction:
      'Our founder set her atelier at 25 bis avenue Patrice Lumumba, in Rabat. She formulates there, and she teaches there — other natural cosmetics lines pass through her hands. We asked her how the ritual is taught.',
    portrait: {
      src: '/rituel/portrait-salma.svg',
      alt: 'Portrait of our founder, natural late-afternoon light',
      width: 1200,
      height: 1500,
    },
    nomInterviewee: 'Our founder',
    questions: [
      {
        id: 'q1',
        question:
          'You are a biologist by training. Why choose the gesture over the laboratory?',
        reponse:
          'The laboratory taught me INCI. The gesture taught me patience. The two complete each other — and that is what I pass on in my workshops in Rabat.',
      },
      {
        id: 'q2',
        question: 'Why the Japanese manicure?',
        reponse:
          'Because it does not cheat. It reveals rather than covers. Polish colours — the ritual polishes.',
      },
      {
        id: 'q3',
        question: 'What does halal change in a formulation?',
        reponse:
          'Everything. Origin of the materials, traceability, no denatured alcohol, no animal gelatin. It is not a marketing argument — it is a manufacturing framework.',
      },
      {
        id: 'q4',
        question: 'Five minutes a day is little. Why not more?',
        reponse:
          'Because the nail grows 0.1 mm a day. Five minutes is enough to keep pace. More would be useless. Less would be unfaithful.',
      },
      {
        id: 'q5',
        question: 'What would you advise an initiate who is starting?',
        reponse:
          'Begin with the Paste. For a week, nothing else. You will see what your nails are telling you. The buffer comes next.',
      },
    ],
  },

  pivot: {
    phrase: 'Now that you know. Receive the pack.',
    cta: {
      label: 'Receive the pack — 199 MAD',
      href: '/kit',
      variant: 'primary',
    },
  },

  journalCrossSlugs: mockRituel.journalCrossSlugs,
};
