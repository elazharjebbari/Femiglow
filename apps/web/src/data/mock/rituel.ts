import type { RituelPageContent } from '@/lib/schemas';

export const mockRituel: RituelPageContent = {
  hero: {
    variant: 'editorial',
    kicker: 'LE RITUEL',
    title: 'Le rituel, geste après geste.',
    subtitle: 'Une méthode lente, racontée à Casablanca.',
    image: {
      src: '/rituel/hero-lifestyle.svg',
      alt: 'Mains au repos sur un drap de lin clair, lumière oblique de fin de matinée',
      width: 2400,
      height: 1600,
    },
  },
  origine: {
    kicker: 'Origine',
    titre: 'Une attention venue d\u2019ailleurs.',
    paragraphes: [
      'Au Japon, le soin de la main n\u2019est pas un produit\u202F: c\u2019est une attention quotidienne, lente, sans déclaration. On observe, on pose la main, on attend que le geste arrive.',
      'Cette manière nous a accompagnées. Nous avons emprunté la patience, gardé la simplicité, transposé le rituel à un climat marocain — sec en hiver, brûlant en été.',
      'Le résultat tient en cinq minutes par jour. Pas de promesse, pas de cure. Une habitude qui s\u2019installe, comme on dépose une tasse sur une table en bois.',
    ],
    photoSepia: {
      src: '/rituel/origine-sepia.svg',
      alt: 'Mains posées sur une table en bois, photographie sépia',
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
      alt: 'Premier geste du rituel\u202F: la main au repos avant la préparation',
      width: 1920,
      height: 1080,
    },
    captions: {
      fr: '/captions/rituel-fr.vtt',
      ar: '/captions/rituel-ar.vtt',
    },
    transcript:
      'Premier geste, on prépare\u202F: nettoyer doucement, déposer la main au repos.\n\nDeuxième geste, on lime\u202F: donner la forme, sans précipitation.\n\nTroisième geste, on hydrate les cuticules\u202F: une goutte d\u2019huile, repousser doucement.\n\nQuatrième geste, on applique la base\u202F: une couche fine, sans surcharge.\n\nCinquième geste, on scelle\u202F: fortifiant en finition, on laisse sécher.',
    durationSeconds: 90,
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
        id: 'jojoba',
        titre: 'L\u2019huile de jojoba',
        paragraphe:
          'Cire liquide proche du sébum humain. Sa structure permet aux cuticules de retenir l\u2019eau sans former de pellicule grasse — élégance discrète des soins lents.',
      },
      {
        id: 'kaolin',
        titre: 'Le kaolin',
        paragraphe:
          'Argile blanche douce, polissante. Quand l\u2019ongle s\u2019affine, la lime n\u2019est plus toujours nécessaire\u00b2.',
        sourceRef: '[2]',
      },
    ],
    sourcesAcademiques: [
      'Tanaka H. (2021). Beeswax-based barrier creams in cold-induced nail fragility. Journal of Cosmetic Dermatology, 20(4).',
      'Benyahia L. (2019). Kaolin clay polishing in non-invasive nail care. Annales de Dermatologie et de Vénéréologie, 146(8).',
    ],
  },
  interview: {
    introduction:
      'Salma a posé son atelier rue d\u2019Oujda, à Casablanca. Elle reçoit en consultation lente, parfois sans rendez-vous. Nous lui avons demandé comment le rituel s\u2019enseigne.',
    portrait: {
      src: '/rituel/portrait-salma.svg',
      alt: 'Portrait de Salma, fondatrice, lumière naturelle de fin d\u2019après-midi',
      width: 1200,
      height: 1500,
    },
    nomInterviewee: 'Salma',
    questions: [
      {
        id: 'q1',
        question: 'Pourquoi cinq minutes\u202F?',
        reponse:
          'Parce que c\u2019est tenable. Trois minutes ne suffisent pas pour que le geste s\u2019installe, dix minutes décrochent du quotidien. Cinq, c\u2019est une habitude qui résiste à un emploi du temps chargé.',
      },
      {
        id: 'q2',
        question: 'Le soir plutôt que le matin\u202F?',
        reponse:
          'Le soir, la main n\u2019a plus rien à faire. Elle accepte l\u2019huile sans la repousser. Au matin, elle reprend ses tâches trop vite.',
      },
      {
        id: 'q3',
        question: 'Une erreur fréquente\u202F?',
        reponse:
          'Vouloir aller plus vite la première semaine. Les ongles ne courent pas. On observe sept jours, on ajuste, et on tient.',
      },
      {
        id: 'q4',
        question: 'Et quand on arrête\u202F?',
        reponse:
          'On reprend. Le rituel n\u2019est pas une discipline\u202F: il accueille la pause comme il accueille le retour. C\u2019est ce qui le distingue d\u2019un protocole médical.',
      },
    ],
  },
  pivot: {
    phrase: 'Si le geste vous parle, le kit l\u2019accompagne.',
    cta: { label: 'Voir le kit', href: '/kit', variant: 'primary' },
  },
  journalCrossSlugs: ['hiver-ongles-patience', 'matieres-d-ailleurs', 'cinq-minutes-le-soir'],
};
