/**
 * Mock kit EN — English translation of `mockKitPageContent` (FR canonical).
 *
 * Phase 3 T3.6 — Strings aligned with `apps/web/messages/en.json` namespace
 * `marketing.kit.*` and tone guide
 * `docs/i18n-content-2026-05/00-style-reference.md` §5 (Voice EN).
 *
 * Strategy: clone FR mock (preserves assets, structures, slugs, ids,
 * accentColors, certifications, prices) and override displayable strings.
 * Sub-objects with strict required fields (image, ingredients, video) are
 * redefined explicitly so TS validates the exact shape.
 *
 * Voice: international English, editorial, sober. `Maison` preserved as
 * proper noun. Brand terms preserved in Latin: `Paste`, `Powder`,
 * `Step 4`, `Polish & Shine`, `FemiGlow`, `MAD`, `INCI`, `Cosmos Organic`,
 * `Ecocert`, `Vegan`, `EVE Vegan`, `DHL`.
 *
 * @see docs/i18n-content-2026-05/03-seed-data/component-bindings-en.csv
 */
import type { KitPageContent } from '@/lib/schemas';

import { mockKitPageContent } from './kit';
import { mockRituelEn } from './rituel.en';

export const mockKitPageContentEn: KitPageContent = {
  ...mockKitPageContent,

  product: {
    ...mockKitPageContent.product,
    name: 'FemiGlow pack',
    tagline: 'Japanese manicure. Two gestures, one buffer, one quiet glow.',
    description:
      'The FemiGlow pack brings together two jars — a smoothing Paste and a polishing Powder — and a Step 4 Polish & Shine buffer. A Japanese manicure, formulated in Rabat by our team. No polish. No abrasion. Five minutes a day is enough.',
    images: [
      {
        src: '/products/kit-principale.png',
        alt: 'Open FemiGlow pack on a pastel background — sage green Paste jar, powdered rose Powder jar, sky blue Step 4 buffer, powdered rose wave, FemiGlow typography',
        width: 1600,
        height: 2000,
      },
      {
        src: '/products/kit-detail-mains.png',
        alt: 'Bare hands with short to medium nails, naturally shining after the Paste-Powder-Polish ritual',
        width: 1600,
        height: 1067,
      },
    ],
    composition: [
      {
        name: '1 Paste',
        origin: 'Moroccan Atlas · Souss-Massa',
        description:
          'Smooth cream paste. Beeswax, jojoba oil, tocopherol. Films the nail plate without sealing it.',
      },
      {
        name: '2 Powder',
        origin: 'Morocco · Organic Asia',
        description:
          'Fine white powder. Cosmetic talc, rice powder, silica. Absorbs the excess, polishes the surface.',
      },
      {
        name: 'Step 4 Polish & Shine buffer',
        origin: 'Rabat atelier · Marrakech kaolin',
        description:
          'Sky blue rectangular buffer. Three sides, three grains. Reveals the natural shine.',
      },
    ],
    estimatedShipping: 'Rabat: 24 h. Morocco: 48 to 72 h. Free shipping.',
  },

  composition: [
    {
      id: '1-paste',
      name: '1 Paste',
      sensation: 'Warm to the touch.',
      accentColor: 'sauge',
      shortDescription:
        'Smooth cream paste. Films the nail plate without sealing it. A hazelnut-sized amount is enough.',
      volume: '15 g',
      usageHint: 'one dab covers ten fingers',
      narrative:
        '12% beeswax melted at low temperature by the beekeeping cooperative of the Middle Atlas. Three minutes of contact, the finish is matte.',
      image: {
        src: '/products/kit-base.svg',
        alt: 'Square transparent jar with faceted edges, sage green circular label "1 paste", smooth cream paste',
        width: 1200,
        height: 1500,
      },
      ingredients: [
        {
          name: 'Beeswax',
          inci: 'Cera Alba',
          function: 'Natural film-former',
          origin: 'Beekeeping cooperative, Moroccan Atlas',
          concentrationPct: 12,
          inciDefinition:
            'Official name for pure beeswax. Films the nail without sealing it, lets the plate breathe.',
        },
        {
          name: 'Jojoba oil',
          inci: 'Simmondsia Chinensis Seed Oil',
          function: 'Cuticle softener',
          origin: 'Organic crops, Souss-Massa',
          concentrationPct: 8,
          inciDefinition:
            'Liquid plant wax, close to natural sebum. Softens cuticles without leaving an oily film.',
        },
        {
          name: 'Tocopherol',
          inci: 'Tocopherol',
          function: 'Antioxidant',
          origin: 'Plant origin, Europe',
          concentrationPct: 0.5,
          inciDefinition:
            "Plant-derived vitamin E. Protects the formula's oils from going rancid.",
        },
      ],
      certifications: [
        { label: 'Cosmos Organic', body: 'Ecocert' },
        { label: 'Vegan', body: 'EVE Vegan' },
      ],
    },
    {
      id: '2-powder',
      name: '2 Powder',
      sensation: 'Glides, never dulls.',
      accentColor: 'petale',
      shortDescription:
        'Fine white powder, set over the Paste. Absorbs the excess, polishes the surface.',
      volume: '8 g',
      usageHint: 'a pinch polishes the whole hand',
      narrative:
        'Fine mineral powder, laid just after the Paste. The talc absorbs the surplus, the silica polishes the surface. No white, no grey.',
      image: {
        src: '/products/kit-fortifiant.svg',
        alt: 'Square transparent jar with faceted edges, powdered rose circular label "2 powder", fine white powder',
        width: 1200,
        height: 1500,
      },
      ingredients: [
        {
          name: 'Cosmetic talc',
          inci: 'Talc',
          function: 'Mineral mattifier',
          origin: 'Morocco',
          concentrationPct: 60,
          inciDefinition:
            'Pure magnesium silicate, washed and sieved. Mattifies without cracking the nail plate.',
        },
        {
          name: 'Rice powder',
          inci: 'Oryza Sativa Powder',
          function: 'Gentle absorbent',
          origin: 'Organic Asia',
          concentrationPct: 30,
          inciDefinition:
            'Finely ground rice starch. Absorbs the surplus Paste without drying.',
        },
        {
          name: 'Silica',
          inci: 'Silica',
          function: 'Texture & glide',
          origin: 'Mineral origin, Europe',
          concentrationPct: 10,
          inciDefinition:
            'Cosmetic form of silicate. Gives the glide and reveals the shine when buffed.',
        },
      ],
      certifications: [{ label: 'Cosmos Organic', body: 'Ecocert' }],
    },
    {
      id: 'polissoir-step-4',
      name: 'Step 4 buffer — Polish & Shine',
      shortDescription:
        'Sky blue rectangular buffer. Three sides, three grains. Reveals the natural shine.',
      volume: '90 mm',
      sensation: 'Light returns to the surface.',
      accentColor: 'ciel',
      usageHint: 'six months of gentle buffing',
      narrative:
        'Three-sided buffer, from the coarsest to the softest grain. The final side reveals the shine, with no solvent, no polish. Rinses under warm water.',
      image: {
        src: '/products/kit-lime.svg',
        alt: 'Sky blue and pale grey rectangular buffer, marked "Step 4 Polish & Shine", three buffing sides',
        width: 1200,
        height: 1500,
      },
      ingredients: [
        {
          name: 'High-density polyurethane foam',
          inci: 'Polyurethane Foam',
          function: 'Support',
          origin: 'Europe',
          inciDefinition:
            "High-density synthetic foam, the buffer's structural support. Washable, durable, does not absorb the powder.",
        },
        {
          name: 'Polishing kaolin powder',
          inci: 'Kaolin',
          function: 'Soft clay',
          origin: 'Quarry, Marrakech',
          inciDefinition:
            'Fine white clay extracted locally. Polishes without scratching, reveals the natural shine of the nail.',
        },
        {
          name: 'Cosmetic ink Step 4 Polish & Shine',
          inci: 'Cosmetic Ink',
          function: 'Solvent-free marking',
          origin: 'Europe',
          inciDefinition:
            'Water-based ink, without solvent or heavy metal. Marks the grain without contaminating the polishing.',
        },
      ],
      certifications: [],
    },
  ],

  videoSrc: {
    ...mockKitPageContent.videoSrc,
    ...mockRituelEn.videoGestes,
    youtubeUrl: mockKitPageContent.videoSrc.youtubeUrl,
    posterCoverSvg: mockKitPageContent.videoSrc.posterCoverSvg,
  },

  comparatif: {
    titreVernis: 'Classic polish',
    titreRituel: 'FemiGlow pack',
    rows: [
      {
        axis: 'Preparation',
        vernis: 'Acetone degreasing, smooth surface forced.',
        rituel:
          'Gentle cleansing, attentive reading of the plate, no aggressive solvent.',
      },
      {
        axis: 'Hold',
        vernis: '5 to 7 days on prepared nails, frequent touch-ups.',
        rituel:
          'No coloured hold: the nail stays as it is, supported day by day.',
      },
      {
        axis: 'Recovery',
        vernis: 'Dehydrated nail under the coat, sometimes weakened.',
        rituel: 'Hydrated plate, supple cuticles, polishing with Step 4 kaolin.',
      },
      {
        axis: 'Annual cost',
        vernis: 'Polish + remover + repair treatments, approx. 1,500 MAD.',
        rituel:
          'A 199 MAD FemiGlow pack lasts four to five months. About 500 MAD per year.',
      },
      {
        axis: 'Material footprint',
        vernis: 'Volatile solvents, often petrochemical-based formulas.',
        rituel:
          'Beeswax, jojoba, mineral talc, rice, kaolin. Cosmos Organic certification.',
      },
      {
        axis: 'Daily time',
        vernis: '20 min application, long drying, touch-ups.',
        rituel: 'Five minutes a day, a slow gesture, no forced drying.',
      },
    ],
  },

  faq: [
    {
      id: 'duree-pack',
      question: 'How long does a pack last?',
      answer:
        'In daily use, the pack lasts four to five months. The Paste runs out first, the Powder follows. The buffer lasts about a year. Refills will be available from autumn 2026.',
    },
    {
      id: 'frequence',
      question: 'How often should I apply it?',
      answer:
        'Every evening if you can, in five minutes. If you skip a day, that is fine: the maison welcomes the pause just as it welcomes the return.',
    },
    {
      id: 'compatibilite-vernis',
      question: 'Can I keep wearing polish?',
      answer:
        'The ritual accommodates polish, even though it is designed to do without. Apply the Paste and the Powder on the evenings without polish. The plate breathes, the ritual settles into its slowness.',
    },
    {
      id: 'grossesse',
      question: 'Is the ritual suitable during pregnancy?',
      answer:
        'All formulas are free of volatile solvents, phthalates and toluene. We recommend speaking with your doctor: care is built in confidence.',
    },
    {
      id: 'expedition',
      question: 'What are the shipping times?',
      answer:
        'Rabat: 24 h. Rest of Morocco: 48 to 72 h. Free shipping. International: we study each destination, shipping is by DHL with tracking.',
    },
    {
      id: 'retours',
      question: 'Can I return the pack?',
      answer:
        'Yes, within thirty days, even opened. Send us two lines at info@femiglow-maroc.com and we will collect the pack. Refund within five working days.',
    },
    {
      id: 'allergies',
      question: 'What if I am allergic to an ingredient?',
      answer:
        'Each formula lists its full INCI on this page and on the jar label. If in doubt, we send you a sample before shipping the full pack.',
    },
    {
      id: 'adolescentes',
      question: 'Is the ritual suitable for teenagers?',
      answer:
        'Yes, from the age of fourteen. The formulas are gentle, the gestures simple. It is often a first encounter with slow care.',
    },
  ],

  handsTestimonials: [
    {
      id: 'amal',
      authorFirstName: 'Amal',
      city: 'Rabat',
      quote:
        'Three months, and the nail has recovered its grain. I stopped forcing it.',
      beforeImage: {
        src: '/testimonials/hands-amal-avant.svg',
        alt: "Amal's hands before the ritual, short and ridged nails",
        width: 800,
        height: 800,
      },
      afterImage: {
        src: '/testimonials/hands-amal-apres.svg',
        alt: "Amal's hands after three months, longer and smoother nails",
        width: 800,
        height: 800,
      },
      initieeDepuis: 'February 2026',
    },
    {
      id: 'lina',
      authorFirstName: 'Lina',
      city: 'Casablanca',
      quote:
        'Five minutes in the evening — it has become a signal that the day is ending.',
      beforeImage: {
        src: '/testimonials/hands-lina-avant.svg',
        alt: "Lina's hands before the ritual, dry cuticles",
        width: 800,
        height: 800,
      },
      afterImage: {
        src: '/testimonials/hands-lina-apres.svg',
        alt: "Lina's hands after two months, soothed cuticles",
        width: 800,
        height: 800,
      },
      initieeDepuis: 'December 2025',
    },
    {
      id: 'sara',
      authorFirstName: 'Sara',
      city: 'Marrakech',
      quote: 'I will not go back to polish. The hand is enough on its own.',
      beforeImage: {
        src: '/testimonials/hands-sara-avant.svg',
        alt: "Sara's hands before, brittle nails",
        width: 800,
        height: 800,
      },
      afterImage: {
        src: '/testimonials/hands-sara-apres.svg',
        alt: "Sara's hands after four months, strengthened nails",
        width: 800,
        height: 800,
      },
      initieeDepuis: 'January 2026',
    },
  ],

  reassurances: [
    {
      icon: 'shipping',
      label: 'Free shipping',
      detail: 'Rabat 24 h — Morocco 48 to 72 h',
    },
    { icon: 'return', label: '30-day return', detail: 'Even opened' },
    {
      icon: 'payment',
      label: 'Cash on delivery',
      detail: 'Inspect before you pay',
    },
  ],

  journalCrossSlugs: mockKitPageContent.journalCrossSlugs,
};
