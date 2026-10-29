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
 * féminins). Termes de marque préservés en latin : `عجينة`, `بودرة`,
 * Phase 9 : termes de marque TRADUITS en arabe (عجينة, بودرة, الخطوة 4,
 * تلميع وإشراق). Seuls restent en latin : `FemiGlow` et les noms INCI. Aucune
 * certification affichée (cf. `KIT_FACTS.certifications`). Devise affichée en درهم sur /ar.
 *
 * @see docs/i18n-content-2026-05/03-seed-data/component-bindings-ar.csv
 */
import type { KitPageContent } from '@/lib/schemas';
import { KIT_FACTS } from '@/lib/products/kit-facts';

import {
  KIT_VIDEO_COVER_ARIA_LABEL_AR,
  KIT_VIDEO_COVER_SVG_AR,
} from './kit-video-cover';
import { mockKitPageContent } from './kit';
import { mockRituelAr } from './rituel.ar';

export const mockKitPageContentAr: KitPageContent = {
  ...mockKitPageContent,

  product: {
    ...mockKitPageContent.product,
    name: 'كيت FemiGlow',
    tagline: 'حلال، يُحضَّر في الرباط. 4 حركات، 5 دقائق، مرة واحدة في الأسبوع.',
    description:
      'يضمّ كيت FemiGlow عجينة تُغذّي الظفر، وبودرة تمنحه اللمعان، ومبرد تلميع بثلاثة أوجه. بلا طلاء ولا مصباح UV ولا أسيتون. 4 حركات في 5 دقائق، مرة واحدة في الأسبوع، فيستعيد ظفرك لمعانه الطبيعي. ولأنّ لا طبقة تُغطّي الظفر، يبقى وضوؤكِ سليمًا.',
    images: [
      {
        src: '/products/kit-principale.png',
        alt: 'كيت FemiGlow مفتوح على خلفية فاتحة: علبة العجينة بملصق أخضر، علبة البودرة بملصق وردي، ومبرد التلميع الأزرق',
        width: 1600,
        height: 2000,
      },
      {
        src: '/products/kit-detail-mains.png',
        alt: 'يدان بأظافر طبيعية قصيرة لامعة بعد استعمال العجينة والبودرة ومبرد التلميع',
        width: 1600,
        height: 1067,
      },
    ],
    composition: [
      {
        name: '1 العجينة',
        origin: 'الأطلس المغربي · سوس-ماسة',
        description:
          'عجينة كريمية تُغذّي الظفر: شمع النحل، زيت الجوجوبا، التوكوفيرول.',
      },
      {
        name: '2 البودرة',
        origin: 'المغرب · آسيا (زراعة عضوية)',
        description:
          'بودرة بيضاء ناعمة تُبرز اللمعان: طلق تجميلي، بودرة الأرز، السيليكا.',
      },
      {
        name: 'مبرد التلميع — الخطوة 4',
        origin: 'ورشة الرباط · كاولين مراكش',
        description:
          'مبرد أزرق بثلاثة أوجه، من الأخشن إلى الأنعم. يُبرز اللمعان الطبيعي للظفر.',
      },
    ],
    estimatedShipping: 'الرباط خلال 24 ساعة، وباقي المغرب خلال 2 إلى 3 أيام. رسوم التوصيل حسب المدينة.',
  },

  composition: [
    {
      id: '1-paste',
      name: '1 العجينة',
      sensation: 'ملمس دافئ وناعم.',
      accentColor: 'sauge',
      shortDescription:
        'عجينة كريمية تُغذّي الظفر وتُنعّمه. تكفي كمية بحجم حبة البندق لأصابع اليدين.',
      volume: '15 g',
      usageHint: 'حبة بحجم البندق تكفي عشرة أصابع',
      narrative:
        '12% شمع نحل مُذاب على حرارة منخفضة من قِبَل تعاونية النحل في الأطلس المتوسّط. لحظة قصيرة من التطبيق، اللمسة مطفأة.',
      image: {
        src: '/products/kit-base.svg',
        alt: 'علبة مربّعة شفّافة بملصق دائري أخضر «1 العجينة»، وبداخلها عجينة كريمية',
        width: 1200,
        height: 1500,
      },
      ingredients: [
        {
          name: 'شمع النحل',
          inci: 'Cera Alba',
          function: 'حماية طبيعية',
          origin: 'تعاونية نحل، الأطلس المغربي',
          concentrationPct: 12,
          inciDefinition:
            'الاسم العلمي لشمع النحل النقي. يكوّن حماية رقيقة دون أن يسدّ سطح الظفر.',
        },
        {
          name: 'زيت الجوجوبا',
          inci: 'Simmondsia Chinensis Seed Oil',
          function: 'ترطيب الجلد الميّت',
          origin: 'زراعة عضوية، سوس-ماسة',
          concentrationPct: 8,
          inciDefinition:
            'زيت نباتي قريب من الدهون الطبيعية للبشرة. يُليّن الجلد حول الظفر دون أثر دهني.',
        },
        {
          name: 'التوكوفيرول',
          inci: 'Tocopherol',
          function: 'مضادّ للأكسدة',
          origin: 'مصدر نباتي، أوروبا',
          concentrationPct: 0.5,
          inciDefinition:
            'فيتامين E من مصدر نباتي. يحفظ زيوت التركيبة من التلف.',
        },
      ],
      certifications: [...KIT_FACTS.certifications],
    },
    {
      id: '2-powder',
      name: '2 البودرة',
      sensation: 'تنساب بنعومة ولا تتطاير.',
      accentColor: 'petale',
      shortDescription:
        'بودرة بيضاء ناعمة تُوضع فوق العجينة. تمتصّ الفائض وتُبرز لمعان الظفر.',
      volume: '8 g',
      usageHint: 'رشّة صغيرة تكفي اليد كلّها',
      narrative:
        'بودرة معدنية ناعمة تُوضع مباشرة بعد العجينة. يمتصّ الطلق الفائض، وتُبرز السيليكا اللمعان. لا تترك أثرًا أبيض ولا رماديًا.',
      image: {
        src: '/products/kit-fortifiant.svg',
        alt: 'علبة مربّعة شفّافة بملصق دائري وردي «2 البودرة»، وبداخلها بودرة بيضاء ناعمة',
        width: 1200,
        height: 1500,
      },
      ingredients: [
        {
          name: 'الطلق التجميلي',
          inci: 'Talc',
          function: 'امتصاص اللمعة الزائدة',
          origin: 'المغرب',
          concentrationPct: 60,
          inciDefinition:
            'سيليكات مغنيسيوم نقية، مغسولة ومنخولة. يمتصّ الفائض دون أن يُجفّف الظفر.',
        },
        {
          name: 'بودرة الأرز',
          inci: 'Oryza Sativa Powder',
          function: 'امتصاص لطيف',
          origin: 'زراعة عضوية، آسيا',
          concentrationPct: 30,
          inciDefinition:
            'نشا أرز مطحون بدقة. يمتصّ فائض العجينة دون تجفيف.',
        },
        {
          name: 'السيليكا',
          inci: 'Silica',
          function: 'نعومة وانسياب',
          origin: 'مصدر معدني، أوروبا',
          concentrationPct: 10,
          inciDefinition:
            'معدن تجميلي ناعم. يمنح الانسياب ويُبرز اللمعان عند التلميع.',
        },
      ],
      certifications: [...KIT_FACTS.certifications],
    },
    {
      id: 'polissoir-step-4',
      name: 'مبرد التلميع — الخطوة 4',
      shortDescription:
        'مبرد أزرق بثلاثة أوجه، من الأخشن إلى الأنعم. يُبرز اللمعان الطبيعي للظفر.',
      volume: '90 mm',
      sensation: 'لمعان يظهر من الظفر نفسه.',
      accentColor: 'ciel',
      usageHint: 'يكفي ستة أشهر من التلميع',
      narrative:
        'ثلاثة أوجه متدرّجة. الوجه الأخير يُظهر اللمعان دون مذيب ولا طلاء. يُغسل بماء فاتر.',
      image: {
        src: '/products/kit-lime.svg',
        alt: 'مبرد تلميع مستطيل أزرق برمادي فاتح، عليه علامة «الخطوة 4»، بثلاثة أوجه',
        width: 1200,
        height: 1500,
      },
      ingredients: [
        {
          name: 'إسفنج بولي يوريثان عالي الكثافة',
          inci: 'Polyurethane Foam',
          function: 'قاعدة المبرد',
          origin: 'أوروبا',
          inciDefinition:
            'إسفنج عالي الكثافة يشكّل قاعدة المبرد. متين وقابل للغسل، ولا يمتصّ البودرة.',
        },
        {
          name: 'بودرة الكاولين',
          inci: 'Kaolin',
          function: 'تلميع لطيف',
          origin: 'مقلع، مراكش',
          inciDefinition:
            'طين أبيض ناعم من مصدر محلي. يُلمّع دون أن يخدش، ويُبرز اللمعان الطبيعي للظفر.',
        },
        {
          name: 'حبر تجميلي لعلامة الخطوة 4',
          inci: 'Cosmetic Ink',
          function: 'علامة بلا مذيب',
          origin: 'أوروبا',
          inciDefinition:
            'حبر مائي خالٍ من المذيبات والمعادن الثقيلة. يُبيّن درجة كل وجه دون أن يؤثّر في التلميع.',
        },
      ],
      certifications: [...KIT_FACTS.certifications],
    },
  ],

  videoSrc: {
    ...mockKitPageContent.videoSrc,
    ...mockRituelAr.videoGestes,
    youtubeUrl: mockKitPageContent.videoSrc.youtubeUrl,
    // Cover SVG localisé AR : `<title>` + aria-label en arabe (FemiGlow latin).
    posterCoverSvg: {
      source: 'inline' as const,
      inline: KIT_VIDEO_COVER_SVG_AR,
      meta: { ariaLabel: KIT_VIDEO_COVER_ARIA_LABEL_AR },
    },
  },

  comparatif: {
    titreVernis: 'طلاء الأظافر التقليدي',
    titreRituel: 'كيت FemiGlow',
    rows: [
      {
        axis: 'التحضير',
        vernis: 'إزالة الدهون بالأسيتون وبرد السطح بقوة.',
        rituel: 'تنظيف لطيف للظفر، بلا مذيبات قاسية.',
      },
      {
        axis: 'الثبات',
        vernis: 'من 5 إلى 7 أيام، مع إصلاحات متكرّرة.',
        rituel:
          'لا لون يتقشّر: الظفر يبقى طبيعيًا، ولمعانه يدوم حتى 3 أسابيع.',
      },
      {
        axis: 'صحة الظفر',
        vernis: 'ظفر يجفّ تحت الطبقة، وقد يضعف أحيانًا.',
        rituel: 'ظفر مرطّب، وجلد ليّن حوله، ولمعان بالكاولين.',
      },
      {
        axis: 'التكلفة السنوية',
        vernis: 'طلاء ومزيل وزيارات للصالون: نحو 1500 درهم.',
        rituel:
          'يكفي الكيت نحو ستة أشهر: كيتان في السنة، أي قرابة 400 درهم.',
      },
      {
        axis: 'المكوّنات',
        vernis: 'مذيبات متطايرة وتركيبات بترولية في الغالب.',
        rituel:
          'شمع النحل، الجوجوبا، الطلق المعدني، بودرة الأرز، الكاولين. والقائمة الكاملة (INCI) على كل علبة.',
      },
      {
        axis: 'وقت العناية',
        vernis: '20 دقيقة للتطبيق، ثم انتظار طويل للتجفيف.',
        rituel: '5 دقائق مرة واحدة في الأسبوع، بلا انتظار للتجفيف.',
      },
    ],
  },

  faq: [
    {
      id: 'duree-pack',
      question: 'كم يدوم الكيت؟',
      answer:
        'بمعدّل عناية واحدة في الأسبوع، يكفي الكيت نحو ستة أشهر، أي قرابة 25 عناية. ويدوم مبرد التلميع المدة نفسها. وعبوات التعبئة متوفّرة قريبًا.',
    },
    {
      id: 'frequence',
      question: 'كم مرة أستعمله؟',
      answer:
        'مرة واحدة في الأسبوع، في 5 دقائق. ويدوم اللمعان حتى 3 أسابيع. وإن فاتكِ أسبوع، فلا بأس: تستأنفين متى شئت.',
    },
    {
      id: 'compatibilite-vernis',
      question: 'هل يمكنني الاستمرار في وضع الطلاء؟',
      answer:
        'نعم، يناسب الكيت الطلاء أيضًا، وإن صُمّم ليُغنيكِ عنه. خصّصي لعنايتك الأسبوعية مساءً بلا طلاء، ليرتاح الظفر وتظهر النتيجة.',
    },
    {
      id: 'grossesse',
      question: 'هل يناسب الكيت فترة الحمل؟',
      answer:
        'جميع التركيبات خالية من المذيبات المتطايرة والفثالات والتولوين. ومع ذلك ننصحكِ باستشارة طبيبتك.',
    },
    {
      id: 'expedition',
      question: 'كم تستغرق مدة التوصيل؟',
      answer:
        'الرباط: خلال 24 ساعة. باقي المغرب: من 2 إلى 3 أيام. رسوم التوصيل حسب المدينة، وتظهر قبل تأكيد الطلب. وخارج المغرب، ندرس كل وجهة ونرسل عبر DHL مع رقم تتبّع.',
    },
    {
      id: 'retours',
      question: 'هل يمكنني إرجاع الكيت؟',
      answer:
        'نعم، خلال 30 يومًا، حتى لو كان مفتوحًا. يكفي أن تراسلينا على info@femiglow-maroc.com ونتكفّل باسترجاعه. ويُردّ المبلغ خلال 5 أيام عمل.',
    },
    {
      id: 'allergies',
      question: 'ماذا لو كانت لديّ حساسية من أحد المكوّنات؟',
      answer:
        'تجدين القائمة الكاملة للمكوّنات (INCI) في هذه الصفحة وعلى ملصق العلبة. وإن كان لديكِ شكّ، نرسل إليكِ عيّنة قبل الكيت الكامل.',
    },
    {
      id: 'adolescentes',
      question: 'هل يناسب الكيت الفتيات المراهقات؟',
      answer:
        'نعم، ابتداءً من 14 سنة. التركيبات لطيفة والحركات بسيطة، وهي بداية جيدة لعادة عناية هادئة.',
    },
  ],

  handsTestimonials: [
    {
      id: 'amal',
      authorFirstName: 'أمل',
      city: 'الرباط',
      quote: 'بعد 3 أشهر، استعاد ظفري صحّته. لم أعد أُرهقه.',
      beforeImage: {
        src: '/testimonials/hands-amal-avant.svg',
        alt: 'يدا أمل قبل الاستعمال: أظافر قصيرة مخطّطة',
        width: 800,
        height: 800,
      },
      afterImage: {
        src: '/testimonials/hands-amal-apres.svg',
        alt: 'يدا أمل بعد 3 أشهر: أظافر ملساء',
        width: 800,
        height: 800,
      },
      initieeDepuis: 'فبراير 2026',
    },
    {
      id: 'lina',
      authorFirstName: 'لينا',
      city: 'الدار البيضاء',
      quote: '5 دقائق في المساء، وصارت لحظتي للاسترخاء في آخر اليوم.',
      beforeImage: {
        src: '/testimonials/hands-lina-avant.svg',
        alt: 'يدا لينا قبل الاستعمال: جلد جافّ حول الأظافر',
        width: 800,
        height: 800,
      },
      afterImage: {
        src: '/testimonials/hands-lina-apres.svg',
        alt: 'يدا لينا بعد شهرين: جلد أهدأ حول الأظافر',
        width: 800,
        height: 800,
      },
      initieeDepuis: 'دجنبر 2025',
    },
    {
      id: 'sara',
      authorFirstName: 'سارة',
      city: 'مراكش',
      quote: 'لن أعود إلى الطلاء. أظافري جميلة كما هي.',
      beforeImage: {
        src: '/testimonials/hands-sara-avant.svg',
        alt: 'يدا سارة قبل الاستعمال: أظافر هشّة',
        width: 800,
        height: 800,
      },
      afterImage: {
        src: '/testimonials/hands-sara-apres.svg',
        alt: 'يدا سارة بعد 4 أشهر: أظافر أقوى',
        width: 800,
        height: 800,
      },
      initieeDepuis: 'يناير 2026',
    },
  ],

  reassurances: [
    {
      icon: 'shipping',
      label: 'توصيل إلى كل مدن المغرب',
      detail: 'الرباط خلال 24 ساعة، وباقي المغرب خلال 2–3 أيام',
    },
    { icon: 'return', label: 'إرجاع خلال 30 يومًا', detail: 'حتى لو كان مفتوحًا' },
    {
      icon: 'payment',
      label: 'الدفع عند الاستلام',
      detail: 'تفحّصين طلبكِ ثم تدفعين',
    },
  ],

  // journalCrossSlugs : identique au FR — slugs partagés entre locales.
  journalCrossSlugs: mockKitPageContent.journalCrossSlugs,
};
