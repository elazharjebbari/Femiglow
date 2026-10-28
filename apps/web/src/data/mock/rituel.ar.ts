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
    title: 'مانيكور ياباني. أربع حركات. إشراقة بطيئة.',
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
      'في اليابان، العناية باليد ليست منتجا: هي انتباه منتظم، بطيء، دون إعلان. المانيكور الياباني — المعروف أيضا بـ«كاواي» أو «تشيغيري» — يعود إلى مطلع القرن العشرين. يكشف اللمعان الطبيعي للظفر بالتلميع، دون طلاء.',
      'نقلت مؤسِّستنا هذه الحركة من رحلة تكوين. أعادت كتابتها في مرجعية مغربية: موادّ محلّية، تركيبة حلال، ورشة في 25 مكرر شارع باتريس لومومبا، بالرباط.',
      'العناية تتّسع في خمس دقائق، مرة واحدة في الأسبوع. لا وعد، لا كور. عادة تستقرّ، كما توضع كأس على طاولة خشب.',
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
      alt: 'الحركة الأولى: حبة بحجم البندق من العجينة',
      width: 1920,
      height: 1080,
    },
    captions: {
      fr: '/captions/rituel-fr.vtt',
      ar: '/captions/rituel-ar.vtt',
    },
    transcript:
      'المانيكور الياباني هو صيحة «كلين غيرل» في عالم الأظافر. وإليكِ ما ينبغي أن تعرفيه.\n\nالمانيكور الياباني ليس طلاءً، بل عناية تُوضع على الظفر فتُغذّيه وتمنحه لمعانًا يدوم حتى ثلاثة أسابيع.\n\nإن كانت أظافرك متعبة أو مخطّطة أو أُزيل عنها طلاء سابق بطريقة سيئة، فالنتيجة تتحسّن تدريجيًا مع كل عناية، فامنحيها بضعة أسابيع.\n\nولأنّ المانيكور الياباني يحتوي على شمع النحل وزيت الجوجوبا وبودرة الأرز والكاولين، فهو يساعد على إصلاح الظفر من العمق.',
    chapters: [
      // Noms d'étapes traduits en arabe (cohérent avec kit.ar.ts, Phase 9).
      { key: 'paste', label: 'العجينة', startSeconds: 0 },
      { key: 'powder', label: 'البودرة', startSeconds: 18 },
      { key: 'step-4', label: 'الخطوة 4', startSeconds: 42 },
      { key: 'polissage', label: 'التلميع', startSeconds: 68 },
    ],
    provenance: 'صُوّر في ورشتنا بالرباط، مارس 2026.',
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
          'تتبّع الموادّ، غياب الكحول المُحوَّل، غياب المشتقّات الحيوانية غير المطابقة. التركيبة تتبع المرجعية العامّة لمجلس الحلال لمستحضرات التجميل (Halal Cosmetics Council)³.',
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
        question: 'خمس دقائق في الأسبوع، قليل. لماذا ليس أكثر؟',
        reponse:
          'لأنّ الظفر ينمو ببطء، واللمعان يدوم حتى ثلاثة أسابيع. عناية واحدة في الأسبوع تكفي لمرافقته. أكثر من ذلك لا فائدة. أقلّ من ذلك خيانة.',
      },
      {
        id: 'q5',
        question: 'بِمَ تنصحين مَن تبدأ؟',
        reponse:
          'شاهدي الفيديو مرة واحدة. ثم قومي بالحركات الأربع بالترتيب، دون استعجال. ستَرَين ما تقوله لكِ أظافرك.',
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
