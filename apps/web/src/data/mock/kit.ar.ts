/**
 * Mock kit AR — version arabe traduite de `mockKitPageContent` (FR).
 *
 * Phase 3 T3.6 — Page kit localisée. Strings alignées avec
 * `apps/web/messages/ar.json` namespace `marketing.kit.*` et le tone
 * guide `docs/i18n-content-2026-05/00-style-reference.md` §4 (Voix AR).
 *
 * Stratégie : clone du mock FR (préserve assets, structures, slugs, ids,
 * accentColors, certifications, prix) et override des strings affichables.
 * Les sous-objets avec champs requis stricts (image, ingredients, video)
 * sont redéfinis explicitement pour que TS valide le shape exact.
 *
 * Voix : MSA simplifié, adresse féminine systématique (impératifs
 * féminins). Termes de marque préservés en latin : `Paste`, `Powder`,
 * `Step 4`, `Polish & Shine`, `FemiGlow`, `MAD`, `INCI`, `Cosmos Organic`,
 * `Ecocert`, `Vegan`, `EVE Vegan`, `DHL`. Devise affichée en MAD (et non
 * « درهم ») pour cohérence du composant <PriceDisplay>.
 *
 * @see docs/i18n-content-2026-05/03-seed-data/component-bindings-ar.csv
 */
import type { KitPageContent } from '@/lib/schemas';

import { mockKitPageContent } from './kit';
import { mockRituelAr } from './rituel.ar';

export const mockKitPageContentAr: KitPageContent = {
  ...mockKitPageContent,

  product: {
    ...mockKitPageContent.product,
    name: 'كيت FemiGlow',
    tagline: 'مانيكور ياباني. حركتان، مُلمِّع، إشراقة.',
    description:
      'يجمع كيت FemiGlow علبتين — Paste مُملِّسة وPowder مُلمِّعة — ومُلمِّع Step 4 Polish & Shine. مانيكور ياباني، صيغ في الرباط من قِبَل فريقنا. دون طلاء. دون احتكاك. خمس دقائق كلّ يوم تكفي.',
    images: [
      {
        src: '/products/kit-principale.png',
        alt: 'كيت FemiGlow مفتوح على خلفية باستيلية — علبة Paste خضراء مريمية، علبة Powder وردية ناعمة، مُلمِّع Step 4 أزرق سماوي، موجة وردية ناعمة، حرف FemiGlow',
        width: 1600,
        height: 2000,
      },
      {
        src: '/products/kit-detail-mains.png',
        alt: 'أيادٍ بأظافر طبيعية، قصيرة إلى متوسّطة، لامعة بطبيعتها بعد طقوس Paste-Powder-Polish',
        width: 1600,
        height: 1067,
      },
    ],
    composition: [
      {
        name: '1 Paste',
        origin: 'الأطلس المغربي · سوس-ماسة',
        description:
          'عجينة كريمية ناعمة. شمع نحل، زيت جوجوبا، توكوفيرول. تُغلِّف اللوحة دون أن تخنقها.',
      },
      {
        name: '2 Powder',
        origin: 'المغرب · آسيا بيولوجية',
        description:
          'بودرة بيضاء ناعمة. طلق تجميلي، بودرة أرزّ، سيليكا. تمتصّ الفائض، تُلمِّع السطح.',
      },
      {
        name: 'مُلمِّع Step 4 Polish & Shine',
        origin: 'ورشة الرباط · كاولين مراكش',
        description:
          'مُلمِّع مستطيل أزرق سماوي. ثلاثة أوجه، ثلاث درجات. يكشف اللمعان الطبيعي.',
      },
    ],
    estimatedShipping: 'الرباط: 24 ساعة. المغرب: 48 إلى 72 ساعة. توصيل مجّاني.',
  },

  composition: [
    {
      id: '1-paste',
      name: '1 Paste',
      sensation: 'دافئة عند اللمس.',
      accentColor: 'sauge',
      shortDescription:
        'عجينة كريمية ناعمة. تُغلِّف اللوحة دون أن تخنقها. حبّة بحجم البندقة تكفي.',
      volume: '15 غ',
      usageHint: 'حبّة بحجم البندقة تُغلِّف عشرة أصابع',
      narrative:
        '12% شمع نحل مُذاب على حرارة منخفضة من قِبَل تعاونية النحل في الأطلس المتوسّط. ثلاث دقائق من التطبيق، اللمسة مطفأة.',
      image: {
        src: '/products/kit-base.svg',
        alt: 'علبة مربّعة شفّافة بحواف مُضلَّعة، ملصق دائري أخضر مريمي «1 paste»، عجينة كريمية ناعمة',
        width: 1200,
        height: 1500,
      },
      ingredients: [
        {
          name: 'شمع النحل',
          inci: 'Cera Alba',
          function: 'مُغلِّف طبيعي',
          origin: 'تعاونية نحل، الأطلس المغربي',
          concentrationPct: 12,
          inciDefinition:
            'الاسم الرسمي لشمع النحل النقي. يُغلِّف الظفر دون أن يُغلقه، يترك اللوحة تتنفّس.',
        },
        {
          name: 'زيت الجوجوبا',
          inci: 'Simmondsia Chinensis Seed Oil',
          function: 'ترطيب الجلد الميّت',
          origin: 'زراعات بيولوجية، سوس-ماسة',
          concentrationPct: 8,
          inciDefinition:
            'شمع نباتي سائل، قريب من الزهم الطبيعي. يُليِّن الجلد الميّت دون دهنية.',
        },
        {
          name: 'توكوفيرول',
          inci: 'Tocopherol',
          function: 'مضادّ أكسدة',
          origin: 'أصل نباتي، أوروبا',
          concentrationPct: 0.5,
          inciDefinition:
            'فيتامين E من أصل نباتي. يحفظ زيوت الصيغة من التزنّخ.',
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
      sensation: 'تنزلق، دون أن تُغبِّر.',
      accentColor: 'petale',
      shortDescription:
        'بودرة بيضاء ناعمة، تُوضع فوق Paste. تمتصّ الفائض، تُلمِّع السطح.',
      volume: '8 غ',
      usageHint: 'قبضة تُلمِّع اليد كاملة',
      narrative:
        'بودرة معدنية ناعمة، تُوضع مباشرة بعد Paste. الطلق يمتصّ الفائض، السيليكا تُلمِّع السطح. دون أبيض، دون رمادي.',
      image: {
        src: '/products/kit-fortifiant.svg',
        alt: 'علبة مربّعة شفّافة بحواف مُضلَّعة، ملصق دائري وردي ناعم «2 powder»، بودرة بيضاء ناعمة',
        width: 1200,
        height: 1500,
      },
      ingredients: [
        {
          name: 'طلق تجميلي',
          inci: 'Talc',
          function: 'مُطفئ معدني',
          origin: 'المغرب',
          concentrationPct: 60,
          inciDefinition:
            'سيليكات مغنيزيوم نقية، مغسولة ومنخولة. تُطفئ دون أن تُشقِّق اللوحة.',
        },
        {
          name: 'بودرة الأرزّ',
          inci: 'Oryza Sativa Powder',
          function: 'ماصّ لطيف',
          origin: 'آسيا بيولوجية',
          concentrationPct: 30,
          inciDefinition:
            'نشا أرزّ مطحون ناعما. يمتصّ فائض Paste دون تجفيف.',
        },
        {
          name: 'سيليكا',
          inci: 'Silica',
          function: 'ملمس وانزلاق',
          origin: 'أصل معدني، أوروبا',
          concentrationPct: 10,
          inciDefinition:
            'الشكل التجميلي للسيليكات. تمنح الانزلاق وتكشف اللمعان عند التلميع.',
        },
      ],
      certifications: [{ label: 'Cosmos Organic', body: 'Ecocert' }],
    },
    {
      id: 'polissoir-step-4',
      name: 'مُلمِّع Step 4 — Polish & Shine',
      shortDescription:
        'مُلمِّع مستطيل أزرق سماوي. ثلاثة أوجه، ثلاث درجات. يكشف اللمعان الطبيعي.',
      volume: '90 ملم',
      sensation: 'يعود الضوء إلى السطح.',
      accentColor: 'ciel',
      usageHint: 'ستّة أشهر من التلميع اللطيف',
      narrative:
        'مُلمِّع بثلاثة أوجه، من الأخشن إلى الأنعم. الوجه الأخير يكشف اللمعان، دون مذيب ولا طلاء. يُغسل بماء فاتر.',
      image: {
        src: '/products/kit-lime.svg',
        alt: 'مُلمِّع مستطيل أزرق سماوي ورمادي فاتح، يحمل علامة «Step 4 Polish & Shine»، ثلاثة أوجه تلميع',
        width: 1200,
        height: 1500,
      },
      ingredients: [
        {
          name: 'إسفنج بولي يوريثان عالي الكثافة',
          inci: 'Polyurethane Foam',
          function: 'دعامة',
          origin: 'أوروبا',
          inciDefinition:
            'إسفنج صناعي عالي الكثافة، دعامة هيكلية للمُلمِّع. قابل للغسل، متين، لا يمتصّ البودرة.',
        },
        {
          name: 'بودرة كاولين مُلمِّعة',
          inci: 'Kaolin',
          function: 'طين لطيف',
          origin: 'محجر، مراكش',
          inciDefinition:
            'طين أبيض ناعم مُستخرَج محلّيا. يُلمِّع دون أن يخدش، يكشف اللمعان الطبيعي للظفر.',
        },
        {
          name: 'حبر تجميلي Step 4 Polish & Shine',
          inci: 'Cosmetic Ink',
          function: 'علامة دون مذيب',
          origin: 'أوروبا',
          inciDefinition:
            'حبر بأساس مائي، دون مذيب ولا معدن ثقيل. يحدّد الدرجة دون أن يُلوِّث التلميع.',
        },
      ],
      certifications: [],
    },
  ],

  videoSrc: {
    ...mockKitPageContent.videoSrc,
    ...mockRituelAr.videoGestes,
    youtubeUrl: mockKitPageContent.videoSrc.youtubeUrl,
    posterCoverSvg: mockKitPageContent.videoSrc.posterCoverSvg,
  },

  comparatif: {
    titreVernis: 'طلاء أظافر تقليدي',
    titreRituel: 'كيت FemiGlow',
    rows: [
      {
        axis: 'التحضير',
        vernis: 'إزالة الدهون بالأسيتون، تنعيم قسري للسطح.',
        rituel: 'تنظيف لطيف، ملاحظة اللوحة، دون مذيب عدواني.',
      },
      {
        axis: 'الثبات',
        vernis: '5 إلى 7 أيام على ظفر مُحضَّر، إصلاحات متكرّرة.',
        rituel:
          'دون ثبات لوني: الظفر يبقى كما هو، مدعوما يوما بعد يوم.',
      },
      {
        axis: 'التعافي',
        vernis: 'ظفر مُجفَّف تحت الطبقة، أحيانا مُضعَّف.',
        rituel: 'لوحة مرطّبة، جلد ميّت ليّن، تلميع بالكاولين Step 4.',
      },
      {
        axis: 'التكلفة السنوية',
        vernis: 'طلاء + مزيل + كور إصلاحية، حوالي 1 500 MAD.',
        rituel:
          'كيت FemiGlow بـ199 MAD يصمد أربعة إلى خمسة أشهر. أي حوالي 500 MAD في السنة.',
      },
      {
        axis: 'أثر المادّة',
        vernis: 'مذيبات متطايرة، صيغ بأساس بتروكيميائي شائعة.',
        rituel:
          'شمع نحل، جوجوبا، طلق معدني، أرزّ، كاولين. شهادة Cosmos Organic.',
      },
      {
        axis: 'الوقت اليومي',
        vernis: 'تطبيق 20 دقيقة، تجفيف طويل، إصلاحات.',
        rituel: 'خمس دقائق كلّ يوم، حركة بطيئة، دون تجفيف قسري.',
      },
    ],
  },

  faq: [
    {
      id: 'duree-pack',
      question: 'كم من الوقت يدوم الكيت؟',
      answer:
        'في الاستعمال اليومي، يصمد الكيت أربعة إلى خمسة أشهر. تفرغ Paste أوّلا، تليها Powder. المُلمِّع يدوم حوالي سنة. نُقدِّم تعبئات إضافية ابتداء من خريف 2026.',
    },
    {
      id: 'frequence',
      question: 'ما هو إيقاع التطبيق؟',
      answer:
        'كلّ مساء إن استطعتِ، في خمس دقائق. إن تخطّيتِ يوما، لا مشكلة: الدار تستقبل التوقّف كما تستقبل العودة.',
    },
    {
      id: 'compatibilite-vernis',
      question: 'هل أستطيع الاستمرار في وضع الطلاء؟',
      answer:
        'تتكيّف الطقوس مع الطلاء وإن صُمِّمت للاستغناء عنه. ضعي Paste وPowder في الأمسيات دون طلاء. اللوحة تتنفّس، الطقوس تُرسي بطئها.',
    },
    {
      id: 'grossesse',
      question: 'هل تناسب الطقوس فترة الحمل؟',
      answer:
        'كلّ الصيغ دون مذيبات متطايرة، دون فثالات، دون تولوين. ننصح بالحوار مع طبيبتك: العناية تُبنى بالثقة.',
    },
    {
      id: 'expedition',
      question: 'ما هي مدد التوصيل؟',
      answer:
        'الرباط: 24 ساعة. باقي المغرب: 48 إلى 72 ساعة. توصيل مجّاني. الخارج: ندرس كلّ وجهة، الإرسال عبر DHL مع تتبّع.',
    },
    {
      id: 'retours',
      question: 'هل أستطيع إرجاع الكيت؟',
      answer:
        'نعم، خلال ثلاثين يوما، حتى المفتوح. تكتبين لنا سطرين على info@femiglow-maroc.com، نسترجع الكيت. الاسترداد خلال خمسة أيام عمل.',
    },
    {
      id: 'allergies',
      question: 'وإن كنتُ أعاني من حساسية تجاه أحد المكوّنات؟',
      answer:
        'كلّ صيغة تعرض INCI كاملة في هذه الصفحة وعلى ملصق العلبة. عند الشكّ، نُرسل لكِ عيّنة قبل إرسال الكيت الكامل.',
    },
    {
      id: 'adolescentes',
      question: 'هل تناسب الطقوس المراهقات؟',
      answer:
        'نعم، ابتداء من سنّ الرابعة عشرة. الصيغ لطيفة، الحركات بسيطة. غالبا ما يكون لقاءً أوّل مع العناية البطيئة.',
    },
  ],

  handsTestimonials: [
    {
      id: 'amal',
      authorFirstName: 'أمل',
      city: 'الرباط',
      quote: 'ثلاثة أشهر، واستعاد الظفر عروقه. كففتُ عن إجباره.',
      beforeImage: {
        src: '/testimonials/hands-amal-avant.svg',
        alt: 'أيادي أمل قبل الطقوس، أظافر قصيرة ومخطّطة',
        width: 800,
        height: 800,
      },
      afterImage: {
        src: '/testimonials/hands-amal-apres.svg',
        alt: 'أيادي أمل بعد ثلاثة أشهر، أظافر مستطيلة وملساء',
        width: 800,
        height: 800,
      },
      initieeDepuis: 'فبراير 2026',
    },
    {
      id: 'lina',
      authorFirstName: 'لينا',
      city: 'الدار البيضاء',
      quote: 'خمس دقائق في المساء، أصبحت إشارة نهاية اليوم.',
      beforeImage: {
        src: '/testimonials/hands-lina-avant.svg',
        alt: 'أيادي لينا قبل الطقوس، جلد ميّت جافّ',
        width: 800,
        height: 800,
      },
      afterImage: {
        src: '/testimonials/hands-lina-apres.svg',
        alt: 'أيادي لينا بعد شهرين، جلد ميّت مُهدَّأ',
        width: 800,
        height: 800,
      },
      initieeDepuis: 'دجنبر 2025',
    },
    {
      id: 'sara',
      authorFirstName: 'سارة',
      city: 'مراكش',
      quote: 'لن أعود إلى الطلاء. اليد تكفي بذاتها.',
      beforeImage: {
        src: '/testimonials/hands-sara-avant.svg',
        alt: 'أيادي سارة قبل، أظافر هشّة',
        width: 800,
        height: 800,
      },
      afterImage: {
        src: '/testimonials/hands-sara-apres.svg',
        alt: 'أيادي سارة بعد أربعة أشهر، أظافر قويّة',
        width: 800,
        height: 800,
      },
      initieeDepuis: 'يناير 2026',
    },
  ],

  reassurances: [
    {
      icon: 'shipping',
      label: 'توصيل مجّاني',
      detail: 'الرباط 24 ساعة — المغرب 48 إلى 72 ساعة',
    },
    { icon: 'return', label: 'إرجاع خلال 30 يوما', detail: 'حتى المفتوح' },
    {
      icon: 'payment',
      label: 'الدفع عند الاستلام',
      detail: 'تحقّقي قبل الدفع',
    },
  ],

  // journalCrossSlugs : identique au FR — slugs partagés entre locales.
  journalCrossSlugs: mockKitPageContent.journalCrossSlugs,
};
