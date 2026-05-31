/**
 * Mock rituel AR — version arabe traduite de `mockRituel` (FR).
 *
 * Phase 3 T3.6 — Page rituel localisée. Strings alignées avec
 * `apps/web/messages/ar.json` namespace `marketing.rituel.*` et le tone
 * guide `docs/i18n-content-2026-05/00-style-reference.md` §4 (Voix AR).
 *
 * Stratégie : clone du mock FR (préserve assets, structures, slugs) et
 * override des strings affichables. Les sous-objets avec champs requis
 * stricts (image, cta, sources vidéo) sont redéfinis explicitement pour
 * que TS valide le shape exact.
 *
 * Voix : MSA simplifié, adresse féminine systématique (impératifs
 * féminins). Termes de marque préservés en latin : `عجينة`, `بودرة`,
 * Phase 9 : step-names de marque préservés en latin (Paste/Powder/Step 4),
 * générique localisé (تلميع = polissage), loanwords
 * japonais translittérés (كاواي/تشيغيري), INCI rendu en arabe avec l'acronyme
 * entre parenthèses. Restent en latin : `FemiGlow`, l'acronyme `(INCI)` entre
 * parenthèses et citations académiques (V.O.). Lexique :
 * `الطقوس` pour rituel, `الكيت` pour kit, `الدار` pour maison.
 *
 * @see docs/i18n-content-2026-05/03-seed-data/component-bindings-ar.csv
 */
import type { RituelPageContent } from '@/lib/schemas';

import { mockRituel } from './rituel';

export const mockRituelAr: RituelPageContent = {
  ...mockRituel,

  hero: {
    variant: 'editorial',
    kicker: 'الطقوس',
    title: 'مانيكور ياباني. حركتان. إشراقة بطيئة.',
    subtitle: 'طريقة بطيئة، مرويّة في الرباط.',
    image: {
      src: '/rituel/hero-lifestyle.svg',
      alt: 'أيادٍ مستريحة على قطعة كتّان فاتحة، ضوء مائل في نهاية الصباح',
      width: 2400,
      height: 1600,
    },
  },

  origine: {
    kicker: 'الأصل',
    titre: 'انتباه قادم من اليابان، مُنقَل إلى الرباط.',
    paragraphes: [
      'في اليابان، العناية باليد ليست منتجا: هي انتباه يومي، بطيء، دون إعلان. المانيكور الياباني — المعروف أيضا بـ«كاواي» أو «تشيغيري» — يعود إلى مطلع القرن العشرين. يكشف اللمعان الطبيعي للظفر بالتلميع، دون طلاء.',
      'نقلت مؤسِّستنا هذه الحركة من رحلة تكوين. أعادت كتابتها في مرجعية مغربية: موادّ محلّية، شهادة حلال، ورشة في 25 مكرر شارع باتريس لومومبا، بالرباط.',
      'النتيجة تتّسع في خمس دقائق يوميا. لا وعد، لا كور. عادة تستقرّ، كما توضع كأس على طاولة خشب.',
    ],
    photoSepia: {
      src: '/rituel/origine-sepia.svg',
      alt: 'أيادٍ حِرَفية يابانية تُمسك مُلمِّعا، صورة بلون سيبيا',
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
      alt: 'الحركة الأولى من الطقوس: حبّة بحجم البندقة من عجينة، موضوعة',
      width: 1920,
      height: 1080,
    },
    captions: {
      fr: '/captions/rituel-fr.vtt',
      ar: '/captions/rituel-ar.vtt',
    },
    transcript:
      'الموضة الكبرى «كلين غيرل» للأظافر هي المانيكور الياباني. لكن، هناك شيء يجب أن تعرفيه قطعا.\n\nالمانيكور الياباني هو في الواقع عناية تُطبَّق على لوحة الظفر وتُغذِّيها وتُلمِّعها لمدّة ثلاثة أسابيع على الأقلّ.\n\nبالطبع، إن كانت أظافرك متعَبة أو مخطّطة أو تمّت إزالة سابقة بشكل سيّئ، النتيجة لن تكون في أفضل حالاتها. عليك أوّلا أن تعتني بأظافرك حتى تُرمَّم بأقصى ما يمكن للحصول على نتيجة مُثلى.\n\nفي المقابل، بما أنّ المانيكور الياباني يحتوي على شمع نحل، سيليكات، بودرة لؤلؤ وأشياء جميلة كثيرة، فإنّه يساعد على ترميم لوحتك. إنّها عناية عميقة.',
    chapters: [
      // Step-names de marque préservés en latin (comme FR/EN) ; le générique
      // « polissage » reste localisé.
      { key: 'paste', label: 'Paste', startSeconds: 0 },
      { key: 'powder', label: 'Powder', startSeconds: 18 },
      { key: 'step-4', label: 'Step 4', startSeconds: 42 },
      { key: 'polissage', label: 'تلميع', startSeconds: 68 },
    ],
    provenance: 'صُوِّر في ورشة الرباط، مارس 2026.',
  },

  sciences: {
    titre: 'ثلاث موادّ، ثلاثة استعمالات.',
    essais: [
      {
        id: 'cire',
        titre: 'شمع النحل',
        paragraphe:
          'يُغلِّف اللوحة دون أن يخنقها. لاحظت دراسة سريرية على 12 أسبوعا تراجعا في التشقّقات الدقيقة الظهرية لدى المعرّضين للبرد الجافّ¹.',
        sourceRef: '[1]',
      },
      {
        id: 'kaolin',
        titre: 'الكاولين المُلمِّع',
        paragraphe:
          'طين أبيض لطيف. حين تُملَّس اللوحة، لا يحفر مُلمِّع Step 4 — بل يكشف اللمعان الطبيعي للكيراتين².',
        sourceRef: '[2]',
      },
      {
        id: 'halal',
        titre: 'المرجعية الحلال',
        paragraphe:
          'تتبّع الموادّ، غياب الكحول المُحوَّل، غياب المشتقّات الحيوانية غير المطابقة. الشارة تتبع تدقيقا من مجلس الحلال لمستحضرات التجميل (Halal Cosmetics Council)³.',
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
      'وضعت مؤسِّستنا ورشتها في 25 مكرر شارع باتريس لومومبا، بالرباط. هناك تُركِّب، وهناك تُعلِّم — تمرّ علامات أخرى من العناية الطبيعية بين يديها. سألناها كيف تُعلَّم الطقوس.',
    portrait: {
      src: '/rituel/portrait-salma.svg',
      alt: 'صورة مؤسِّستنا، ضوء طبيعي في نهاية بعد الظهر',
      width: 1200,
      height: 1500,
    },
    nomInterviewee: 'مؤسِّستنا',
    questions: [
      {
        id: 'q1',
        question:
          'أنتِ بيولوجية بالتكوين. لماذا اخترتِ الحركة بدلا من المختبر؟',
        reponse:
          'علّمني المختبر المعايير الدولية لتسمية المكوّنات (INCI). علّمتني الحركة الصبر. الاثنان يكمّلان بعضهما — وهذا ما أنقله في تكويناتي بالرباط.',
      },
      {
        id: 'q2',
        question: 'لماذا المانيكور الياباني؟',
        reponse:
          'لأنّه لا يغشّ. يكشف بدل أن يُغطِّي. الطلاء يُلوِّن — الطقوس تُلمِّع.',
      },
      {
        id: 'q3',
        question: 'ماذا يُغيِّر الحلال في تركيبة ما؟',
        reponse:
          'كلّ شيء. أصل الموادّ، التتبّع، غياب الكحول المُحوَّل، غياب الجيلاتين الحيواني. ليست حجّة تسويقية — بل مرجعية صناعة.',
      },
      {
        id: 'q4',
        question: 'خمس دقائق في اليوم، قليل. لماذا ليس أكثر؟',
        reponse:
          'لأنّ الظفر ينمو 0,1 ملم في اليوم. خمس دقائق تكفي لمرافقته. أكثر من ذلك لا فائدة. أقلّ من ذلك خيانة.',
      },
      {
        id: 'q5',
        question: 'بِمَ تنصحين مَن تبدأ؟',
        reponse:
          'ابدئي بـعجينة. لأسبوع، لا شيء غيرها. ستَرَين ما تقوله لكِ أظافرك. المُلمِّع يأتي بعد ذلك.',
      },
    ],
  },

  pivot: {
    phrase: 'الآن وقد عرفتِ. استلمي الكيت.',
    cta: {
      label: 'استلمي الكيت — 199 درهم',
      href: '/kit',
      variant: 'primary',
    },
  },

  // journalCrossSlugs : identique au FR — slugs partagés entre locales
  // (cf. ADR-002 pathnames identiques).
  journalCrossSlugs: mockRituel.journalCrossSlugs,
};
