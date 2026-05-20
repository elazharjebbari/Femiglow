/**
 * Alt text par image source — dérivé de `docs/images/03-inventaire-images.md`.
 *
 * Utilisé par le pipeline seed pour pré-remplir le champ `alt` du Media créé.
 * L’alt peut ensuite être édité depuis l’admin Media — la valeur seedée n’est
 * pas re-écrasée si déjà personnalisée (cf. `--force-alt` du CLI).
 */
export const SEED_ALT_BY_PATH: Record<string, string> = {
  /* home */
  'home/hero-home.png':
    'Mains posées sur un plan de travail beige, gestes lents, lumière douce du matin.',
  'home/og-home.png': 'FemiGlow — visuel d’ouverture pour le partage social.',
  'home/mains-yasmine.png': 'Mains de Yasmine, ongles courts, lumière chaude.',
  'home/mains-salma.png': 'Mains de Salma tenant un kit, geste précis.',
  'home/mains-ines.png': 'Mains d’Inès, peau sèche apaisée par le soin.',

  /* rituel */
  'rituel/hero-lifestyle.png': 'Scène lifestyle d’un rituel du soir, texture lin et bois.',
  'rituel/portrait-salma.png': 'Portrait éditorial de Souheila, fondatrice et formulatrice, regard de côté, lumière naturelle.',
  'rituel/origine-sepia.png': 'Image sépia évoquant l’origine — atelier vintage.',
  'rituel/poster-video.png': 'Poster de la vidéo des 4 gestes — main appliquant l’huile.',
  'rituel/og-rituel.png': 'Page Rituel — visuel social.',

  /* kit */
  'kit/kit-principale.png': 'Pack FemiGlow complet \u2014 paste, powder et polissoir Step 4, packshot principal sur fond cr\u00E8me.',
  'kit/kit-pack-shot.png':
    'Pack FemiGlow \u2014 paste, powder et polissoir Step 4 Polish & Shine pos\u00E9s sur papier cr\u00E8me et linge de lin, lumi\u00E8re du matin.',
  'kit/kit-detail-mains.png': 'Mains tenant le pack FemiGlow en macro, doigts effleurant le bouchon.',
  'kit/kit-base.png': 'Paste FemiGlow, packshot trois-quarts (vert sauge).',
  'kit/kit-fortifiant.png': 'Powder FemiGlow, packshot ambr\u00E9 ros\u00E9 (rose poudr\u00E9).',
  'kit/kit-lime.png': 'Polissoir Step 4 Polish & Shine FemiGlow, vue d\u00E9taill\u00E9e (bleu ciel).',
  'kit/hands-sara-avant.png': 'Mains de Sara avant le rituel — peau sèche.',
  'kit/hands-amal-avant.png': 'Mains d’Amal avant — ongles striés.',
  'kit/hands-amal-apres.png': 'Mains d’Amal après 4 semaines — peau apaisée.',
  'kit/hands-lina-avant.png': 'Mains de Lina avant le rituel.',
  'kit/hands-lina-apres.png': 'Mains de Lina après 4 semaines.',
  'kit/og-kit.png': 'Page Kit — visuel social.',

  /* maison */
  'maison/maison-hero.png': 'Vue d’ensemble de la Maison — atelier baigné de lumière.',
  'maison/fondatrice-mains.png': 'Mains de la fondatrice ajustant un flacon.',
  'maison/atelier-1.png': 'Atelier — vue 1 : céramiques alignées sur étagère.',
  'maison/atelier-2.png': 'Atelier — vue 2 : plantes sur le rebord, lumière oblique.',
  'maison/atelier-3.png': 'Atelier — vue 3 : plan de travail avec ingrédients.',
  'maison/og-maison.png': 'Page Maison — visuel social.',

  /* journal */
  'journal/cinq-minutes-le-soir.png':
    'Cinq minutes le soir — ambiance éditoriale, bougie et flacon.',
  'journal/ranger-son-rituel.png':
    'Ranger son rituel — étagère ordonnée, flacons alignés, atmosphère apaisante.',
  'journal/voix-de-lina.png': 'Voix de Lina — portrait éditorial.',
  'journal/voix-de-sara.png': 'Voix de Sara — portrait éditorial.',
  'journal/voix-d-amal.png': 'Voix d’Amal — portrait éditorial.',
  'journal/la-poudre-de-kaolin.png':
    'La poudre de kaolin — détail texture poudre blanche dans coupelle céramique.',
  'journal/hiver-ongles-patience.png':
    'Hiver, ongles, patience — mains réchauffées au coin d’une fenêtre givrée.',
  'journal/avril-soleil-bas.png': 'Avril, soleil bas — lumière oblique sur table en bois.',
  'journal/pluie-de-mars.png': 'Pluie de mars — gouttes sur fenêtre, ambiance grise apaisée.',
  'journal/huile-d-argan-vraie.png':
    'Huile d’argan vraie — flacon ambré, lumière dorée traversant le verre.',
  'journal/matieres-d-ailleurs.png':
    'Matières d’ailleurs — composition ingrédients berbères, argile et plantes.',
  'journal/la-cuisine-comme-laboratoire.png':
    'La cuisine comme laboratoire — plan de travail avec balance et flacons.',
  'journal/la-table-comme-atelier.png':
    'La table comme atelier — table en bois encombrée d’outils de soin.',
  'journal/la-maison-au-printemps.png':
    'La maison au printemps — fenêtre ouverte, lin écru, lumière claire.',
  'journal/visiter-l-atelier.png': 'Visiter l’atelier — porte entrouverte, atmosphère intimiste.',
  'journal/og-journal.png': 'Journal FemiGlow — visuel social.',
};

const FALLBACK_ALT = 'Visuel FemiGlow.';

export function altFor(sourcePath: string): string {
  return SEED_ALT_BY_PATH[sourcePath] ?? FALLBACK_ALT;
}
