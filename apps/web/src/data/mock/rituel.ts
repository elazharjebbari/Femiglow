import type { RituelPageContent } from '@/lib/schemas';

/**
 * Audit 08/09 — Rituel = manucure japonaise halal. Interview Souheila à Rabat.
 * Sources scientifiques élargies (kaolin, halal cosmetics, manucure japonaise).
 */
export const mockRituel: RituelPageContent = {
  hero: {
    variant: 'editorial',
    kicker: 'LE RITUEL',
    title: 'Manucure japonaise. Deux gestes. Un éclat lent.',
    subtitle: 'Une méthode lente, racontée à Rabat.',
    image: {
      src: '/rituel/hero-lifestyle.svg',
      alt: 'Mains au repos sur un drap de lin clair, lumière oblique de fin de matinée',
      width: 2400,
      height: 1600,
    },
  },
  origine: {
    kicker: 'Origine',
    titre: 'Une attention venue du Japon, transmise \u00e0 Rabat.',
    paragraphes: [
      'Au Japon, le soin de la main n\u2019est pas un produit\u202F: c\u2019est une attention quotidienne, lente, sans déclaration. La manucure japonaise — connue aussi sous les noms \u00ab\u202Fkawaii\u202F\u00bb ou \u00ab\u202Fchigiri\u202F\u00bb — remonte au début du XXᵉ siècle. Elle révèle la brillance naturelle de l\u2019ongle par polissage, sans vernis.',
      'Souheila a rapporté ce geste d\u2019un voyage de formation. Elle l\u2019a réinscrit dans un référentiel marocain\u202F: matières locales, certification halal, atelier au 25 bis avenue Patrice Lumumba, à Rabat.',
      'Le résultat tient en cinq minutes par jour. Pas de promesse, pas de cure. Une habitude qui s\u2019installe, comme on dépose une tasse sur une table en bois.',
    ],
    photoSepia: {
      src: '/rituel/origine-sepia.svg',
      alt: 'Mains d\u2019artisan japonais tenant un polissoir, photographie sépia',
      width: 1600,
      height: 2000,
    },
  },
  videoGestes: {
    sources: {
      mp4: '/videos/rituel-90s.mp4',
      webm: '/videos/rituel-90s.webm',
    },
    poster: {
      src: '/videos/rituel-poster.svg',
      alt: 'Premier geste du rituel\u202F: une noisette de paste, posée',
      width: 1920,
      height: 1080,
    },
    captions: {
      fr: '/captions/rituel-fr.vtt',
      ar: '/captions/rituel-ar.vtt',
    },
    transcript:
      'La grande tendance clean girl pour les nails, c\u2019est la manucure japonaise. Par contre, il y a quelque chose que vous devez absolument savoir.\n\nLa manucure japonaise, c\u2019est en fait un soin qui vient s\u2019appliquer sur la plaque de l\u2019ongle et qui va venir le nourrir et le faire briller pendant au moins 3 semaines.\n\nBien évidemment, si vous avez les ongles abîmés, striés ou qu\u2019une dépose a été mal faite, le résultat ne sera pas à son maximum. Il faut d\u2019abord prendre soin de vos ongles qu\u2019ils soient réparés au maximum pour avoir le résultat optimum.\n\nEn revanche, comme la manucure japonaise contient de la cire d\u2019abeille, des silicates, de la poudre de perle et plein de belles choses à l\u2019intérieur, elle va vous aider à réparer votre plaque. C\u2019est un soin en profondeur.',
    durationSeconds: 75,
  },
  sciences: {
    titre: 'Trois matières, trois usages.',
    essais: [
      {
        id: 'cire',
        titre: 'La cire d\u2019abeille',
        paragraphe:
          'Filme la plaque sans l\u2019étouffer. Une étude clinique sur 12 semaines a observé une réduction des microfissures dorsales chez les sujets exposés au froid sec\u00b9.',
        sourceRef: '[1]',
      },
      {
        id: 'kaolin',
        titre: 'Le kaolin polissant',
        paragraphe:
          'Argile blanche douce. Quand l\u2019ongle est lissé, le polissoir Step 4 ne grave pas — il révèle la brillance naturelle de la kératine\u00b2.',
        sourceRef: '[2]',
      },
      {
        id: 'halal',
        titre: 'Le référentiel halal',
        paragraphe:
          'Tra\u00e7abilit\u00e9 des mati\u00e8res, absence d\u2019alcool d\u00e9natur\u00e9, absence de d\u00e9riv\u00e9s animaux non conformes. Le label suit un audit du Halal Cosmetics Council\u00b3.',
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
      'Souheila a pos\u00e9 son atelier au 25 bis avenue Patrice Lumumba, \u00e0 Rabat. Elle y formule, et elle y enseigne \u2014 d\u2019autres marques de cosm\u00e9tiques naturels passent par ses mains. Nous lui avons demand\u00e9 comment le rituel s\u2019enseigne.',
    portrait: {
      src: '/rituel/portrait-salma.svg',
      alt: 'Portrait de Souheila, fondatrice, lumi\u00e8re naturelle de fin d\u2019apr\u00e8s-midi',
      width: 1200,
      height: 1500,
    },
    nomInterviewee: 'Souheila',
    questions: [
      {
        id: 'q1',
        question:
          'Vous \u00eates biologiste de formation. Pourquoi avoir choisi le geste plut\u00f4t que le laboratoire\u202F?',
        reponse:
          'Le laboratoire m\u2019a appris l\u2019INCI. Le geste m\u2019a appris la patience. Les deux se compl\u00e8tent \u2014 et c\u2019est ce que je transmets dans mes formations \u00e0 Rabat.',
      },
      {
        id: 'q2',
        question: 'Pourquoi la manucure japonaise\u202F?',
        reponse:
          'Parce qu\u2019elle ne triche pas. Elle r\u00e9v\u00e8le au lieu de couvrir. Le vernis colore \u2014 le rituel polit.',
      },
      {
        id: 'q3',
        question: 'Qu\u2019est-ce que le halal change dans une formulation\u202F?',
        reponse:
          'Tout. Origine des mati\u00e8res, tra\u00e7abilit\u00e9, absence d\u2019alcool d\u00e9natur\u00e9, absence de g\u00e9latine animale. Ce n\u2019est pas un argument marketing \u2014 c\u2019est un r\u00e9f\u00e9rentiel de fabrication.',
      },
      {
        id: 'q4',
        question: 'Cinq minutes par jour, c\u2019est peu. Pourquoi pas plus\u202F?',
        reponse:
          'Parce que l\u2019ongle pousse de 0,1 mm par jour. Cinq minutes suffisent \u00e0 l\u2019accompagner. Plus serait inutile. Moins serait infid\u00e8le.',
      },
      {
        id: 'q5',
        question: 'Que conseilleriez-vous \u00e0 une initi\u00e9e qui commence\u202F?',
        reponse:
          'Commencez par la paste. Pendant une semaine, rien d\u2019autre. Vous verrez ce que vos ongles vous racontent. Le polissoir arrive ensuite.',
      },
    ],
  },
  pivot: {
    phrase: 'Maintenant que vous savez. Recevoir le pack.',
    cta: {
      label: 'Recevoir le pack \u2014 199 dh',
      href: '/kit',
      variant: 'primary',
    },
  },
  journalCrossSlugs: [
    'hiver-ongles-patience',
    'matieres-d-ailleurs',
    'paste-et-powder-deux-gestes',
  ],
};
