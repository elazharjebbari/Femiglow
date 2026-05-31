/**
 * Mock homepage AR — version arabe traduite de `mockHomepage` (FR).
 *
 * Phase 3 T3.5 — Premier vrai contenu localisé livré (jusque-là toutes
 * les locales tombaient en fallback FR). Strings AR alignées avec
 * `apps/web/messages/ar.json` namespace `marketing.home.*` et le tone
 * guide `docs/i18n-content-2026-05/00-style-reference.md` §4 (Voix AR).
 *
 * Stratégie : on clone le mock FR (préserve assets, structures, etc.)
 * et on override les strings affichables — pattern simple, maintenable,
 * sans risque de divergence des shapes.
 *
 * @see docs/i18n-content-2026-05/03-seed-data/component-bindings-ar.csv
 */
import type { HomepageContent } from '@/lib/schemas';

import { mockHomepage } from './homepage';

export const mockHomepageAr: HomepageContent = {
  ...mockHomepage,

  hero: {
    ...mockHomepage.hero,
    kicker: 'دار الرباط',
    title: 'كيت فيمي قلو. حركتان، إشراق مكشوف.',
    subtitle: 'مناكير يابانية حلال، صُمّمت في الرباط. بدون طلاء، بدون كشط.',
    cta: {
      label: 'اكتشفي الكيت',
      href: '/rituel',
      variant: 'primary',
    },
    ctaSecondary: {
      label: 'استلمي الكيت',
      href: '/kit',
      variant: 'link',
    },
    image: {
      src: '/journal/hero-accueil.svg',
      alt: 'علبة فيمي قلو الباستيل المفتوحة، علبة العجينة بلون السج وعلبة البودرة بلون البتلة الوردية، مصقّال أزرق سماوي، إضاءة طبيعية في نهاية الصباح',
      width: 1600,
      height: 2000,
    },
  },

  // Gestes : titres + descriptions traduits en arabe (عجينة/بودرة/تلميع
  // وإشراق). Les noms latins « Paste/Powder/Polish & Shine » du mock FR
  // fuitaient sur /ar — on les remplace par les libellés arabes.
  gestes: mockHomepage.gestes.map((g, i) => ({
    ...g,
    titre:
      i === 0 ? 'عجينة' : i === 1 ? 'بودرة' : 'تلميع وإشراق',
    duree:
      i === 0 ? 'دقيقتان' : i === 1 ? 'دقيقتان' : 'دقيقة واحدة',
    description:
      i === 0
        ? 'عجينة كريمية ناعمة، توضع على الظفر الجاف. تغلّف، تنعّم، تحضّر.'
        : i === 1
          ? 'بودرة بيضاء دقيقة، توضع فوق العجينة. تمتص، تلمّع، تنعش.'
          : 'مصقّال الخطوة 4 يُمرَّر بحركات بطيئة. يظهر اللمعان الطبيعي.',
  })),

  manifeste: {
    kicker: 'البيان',
    title: 'الجمال البطيء عناية.',
    paragraphs: [
      'نؤمن أن الأظافر تكشف ما نمنحه لها. الحركة، الوقت، الصبر.',
      'خمس دقائق يوميا. حركتان ومصقّال. بدون عرض.',
    ],
  },

  // Avis : prénom, contexte (ville) et mois d'initiation traduits en arabe
  // (Salma/Casablanca/Janvier 2025 fuitaient sur /ar). La citation t2 garde
  // « الطقوس » : témoignage éditorial décrivant le rituel comme pratique.
  avis: mockHomepage.avis.map((a) => ({
    ...a,
    authorFirstName:
      a.id === 't1' ? 'سلمى' : a.id === 't2' ? 'ياسمين' : 'إيناس',
    authorContext:
      a.id === 't1' ? 'الدار البيضاء' : a.id === 't2' ? 'الرباط' : 'مراكش',
    initieeDepuis:
      a.id === 't1'
        ? 'يناير 2025'
        : a.id === 't2'
          ? 'مارس 2024'
          : 'أكتوبر 2023',
    quote:
      a.id === 't1'
        ? 'ثلاثة أشهر دون كسر. خمس دقائق مساء كل يوم تكفي.'
        : a.id === 't2'
          ? 'الطقوس ترتّب نهاية يومي. أصبحت لحظة لي.'
          : 'العجينة تمنح لمسة تشبهني. طبيعية، بدون طلاء.',
  })),

  // journalExtraitsSlugs : identique au FR — les articles partagent
  // les mêmes slugs entre locales (cf. ADR-002 pathnames identiques).
  journalExtraitsSlugs: mockHomepage.journalExtraitsSlugs,
};
