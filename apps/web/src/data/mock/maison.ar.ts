/**
 * Mock maison AR — version arabe traduite de `mockMaison` (FR).
 *
 * Phase 3 T3.6 — Page maison localisée. Strings alignées avec
 * `apps/web/messages/ar.json` namespace `marketing.maison.*` et le tone
 * guide `docs/i18n-content-2026-05/00-style-reference.md` §4 (Voix AR).
 *
 * Stratégie : clone du mock FR (préserve assets, structures, slugs) et
 * override des strings affichables. Les sous-objets avec champs requis
 * stricts (image, cta) sont redéfinis explicitement — pas spread — afin
 * que TS valide le shape exact.
 *
 * Voix : MSA simplifié, adresse féminine systématique (impératifs
 * féminins type `اكتشفي`). Termes de marque préservés en latin :
 * `Paste`, `Powder`, `Step 4`, `FemiGlow`. Lexique : `دار` pour maison,
 * `الكيت` pour kit, `الطقوس` pour rituel.
 *
 * @see docs/i18n-content-2026-05/03-seed-data/component-bindings-ar.csv
 */
import type { MaisonPageContent } from '@/lib/schemas';

import { mockMaison } from './maison';

export const mockMaisonAr: MaisonPageContent = {
  ...mockMaison,

  hero: {
    variant: 'editorial',
    kicker: 'الدار',
    title: 'دار الإشراق.',
    subtitle:
      'دار للعناية بالأظافر، مُحرَّرة في الرباط. بطيئة، منتبهة، تقع في 25 مكرر شارع باتريس لومومبا.',
    cta: {
      variant: 'link',
      label: 'اكتشفي الورشة ←',
      href: '#origine',
    },
  },

  origine: {
    kicker: 'الأصل',
    titre: 'انتباه نشأ من ملاحظة بسيطة.',
    paragraphs: [
      'وُلدت FemiGlow من ملاحظة بسيطة: تصمد الأظافر حين نمنحها الوقت الذي تطلبه. لا أكثر، لا أقلّ. خمس دقائق في المساء، حركتان مدروستان ومُلمِّع.',
      'تشكّلت الفكرة في الرباط، في ورشة بشارع باتريس لومومبا حيث يسقط الضوء قبيل السادسة مساءً. ثلاث حِرَف جلست حول طاولة: التركيب، المادّة، الكتابة. قناعة واحدة — الجمال البطيء انتباه، لا أداء.',
      'مؤسِّستنا بيولوجية. تابعت تكوينات عدّة في صناعة مستحضرات التجميل قبل أن تُحرِّر علاماتها الأولى للعناية الطبيعية. اليوم، تُؤطِّر تكوينات في الورشة ذاتها حيث تُصمَّم FemiGlow. الطقوس ليست اكتشافا — بل نقل.',
    ],
    image: {
      src: '/maison/maison-origine.png',
      alt: 'طاولة عمل ورشة في الرباط، ضوء بعد الظهر على علب Paste وPowder',
      width: 960,
      height: 1200,
    },
    imagePosition: 'right',
  },

  fondatrice: {
    kicker: 'المؤسِّسة',
    titre: 'مؤسِّستنا، بيولوجية ومُركِّبة.',
    paragraphs: [
      'تحمل مؤسِّستنا ماستر في علم الأحياء. تابعت تكوينات متخصّصة عدّة في صناعة مستحضرات التجميل. قبل FemiGlow، أحرَزَت عدّة علامات للعناية الطبيعية — وعلّمتها كلّ منها شيئا عن الحركة، المادّة، التتبّع.',
      'تُؤطِّر اليوم تكوينات في ورشة الرباط، مفتوحة للمُركِّبات المغربيات الشابات. FemiGlow هي دارها الأكثر بطئا.',
    ],
    image: {
      src: '/maison/fondatrice-mains.svg',
      alt: 'ورشة الرباط، نهاية بعد الظهر. مؤسِّستنا تُحضِّر Paste، حركة بطيئة، ملاحظة متواصلة',
      width: 960,
      height: 1200,
    },
    imagePosition: 'left',
  },

  atelier: {
    adresse: '25 مكرر شارع باتريس لومومبا',
    quartier: 'الرباط',
    description: [
      'تتألّف الورشة من غرفتين هادئتين: طاولة عمل واضحة، مكتبة بأعمال تقنية ودفاتر، عيّنات موادّ مُرتَّبة بحسب الموسم.',
      'نُركِّب هناك بكمّيات صغيرة. تستقبل مؤسِّستنا بموعد، يومَي الثلاثاء والخميس، للتكوينات والاستشارات.',
    ],
    gallerie: [
      {
        src: '/maison/atelier-1.svg',
        alt: 'منظر عامّ لورشة الرباط، ضوء عابر من النافذة الشمالية',
        width: 1600,
        height: 1067,
      },
      {
        src: '/maison/atelier-2.svg',
        alt: 'طاولة عمل بميزان دقيق، علب Paste وPowder، دفتر مفتوح',
        width: 1600,
        height: 1067,
      },
      {
        src: '/maison/atelier-3.svg',
        alt: 'تفصيل مادّة: شمع نحل مُذاب في وعاء سيراميك',
        width: 1600,
        height: 1067,
      },
    ],
  },

  matieres: mockMaison.matieres.map((m) => {
    if (m.id === 'cire') {
      return {
        ...m,
        nom: 'شمع النحل',
        origine: 'يُجمَع في سوس، بشراكة مع تعاونية عائلية.',
        pourquoi: 'يُليِّن طوق الظفر ويُمسك Paste دون أن يُصلِّبها.',
      };
    }
    if (m.id === 'jojoba') {
      return {
        ...m,
        nom: 'زيت الجوجوبا',
        origine: 'يُضغَط على البارد في سوس-ماسة، قطاع مغربي.',
        pourquoi: 'شمع سائل يحاكي الزهم الجلدي — يُغذِّي دون دهنية.',
      };
    }
    if (m.id === 'kaolin') {
      return {
        ...m,
        nom: 'كاولين مُلمِّع',
        origine: 'طين معدني مغربي، محجر مراكش.',
        pourquoi: 'يُلمِّع الظفر دون أن يُجفِّفه — هو من يُنشِّط مُلمِّع Step 4.',
      };
    }
    // riz
    return {
      ...m,
      nom: 'بودرة الأرزّ',
      origine: 'زراعات بيولوجية من آسيا، قطاع متتبَّع.',
      pourquoi:
        'ماصّ لطيف — هي من تمنح Powder لمستها المطفأة قبيل اللمعان.',
    };
  }),

  engagements: mockMaison.engagements.map((e) => {
    switch (e.ordre) {
      case 1:
        return {
          ...e,
          titre: 'تزوّد مباشر',
          description: 'كلّ مادّة متتبَّعة حتى ورشة أصلها. لا وسيط مجهول.',
        };
      case 2:
        return {
          ...e,
          titre: 'شهادة حلال',
          description:
            'كلّ مادّة متتبَّعة. مُصنِّعنا مُدقَّق من قِبَل Halal Cosmetics Council. الشارة على كلّ علبة وعلى المُلمِّع.',
        };
      case 3:
        return {
          ...e,
          titre: 'دون طلاء',
          description:
            'لا راتنج بلاستيكي، لا مذيب قويّ. العناية تظهر على الظفر، لا في الهواء.',
        };
      case 4:
        return {
          ...e,
          titre: 'طقوس بطيئة',
          description:
            'كلّ شيء مُعاير لخمس دقائق في المساء. أقصر من ذلك تجميل عاديّ. أطول من ذلك عبء.',
        };
      case 5:
        return {
          ...e,
          titre: 'محلّي',
          description:
            'يُعبَّأ، يُملصَق، يُرسَل من الرباط. حين يكون ممكنا، نُبقي السلسلة قصيرة.',
        };
      default:
        return {
          ...e,
          titre: 'نقل',
          description:
            'يُكوِّن فريقنا بانتظام مُجمِّلات ومُركِّبات في المانيكور الياباني، في ورشة الرباط.',
        };
    }
  }),

  crossLinks: mockMaison.crossLinks.map((c) => {
    if (c.id === 'rituel') {
      return {
        id: c.id,
        href: c.href,
        kicker: 'الطقوس',
        titre: 'اقرئي الطقوس',
        image: {
          src: c.image.src,
          alt: 'أيادٍ مستريحة على غطاء صوفي فاتح',
          width: c.image.width,
          height: c.image.height,
        },
      };
    }
    if (c.id === 'journal') {
      return {
        id: c.id,
        href: c.href,
        kicker: 'المجلّة',
        titre: 'المجلّة',
        image: {
          src: c.image.src,
          alt: 'دفتر مفتوح على طاولة، ريشة معلّقة',
          width: c.image.width,
          height: c.image.height,
        },
      };
    }
    // kit
    return {
      id: c.id,
      href: c.href,
      kicker: 'الكيت',
      titre: 'تصفّحي الكيت',
      image: {
        src: c.image.src,
        alt: 'كيت FemiGlow مفتوح: Paste وPowder ومُلمِّع موضوعة على قماش كريمي',
        width: c.image.width,
        height: c.image.height,
      },
    };
  }),
};
