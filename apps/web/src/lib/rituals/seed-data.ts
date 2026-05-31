/**
 * Fixtures d'avis FemiGlow pour seed BDD et démos.
 *
 * Distribution alignée avec les bonnes pratiques Kolenda (UX/Pricing/Copywriting) :
 *
 *   - **Volume** : 50 avis (sweet spot crédibilité : > 20 mais < 100 sans hashtag).
 *   - **Signal** : ~ 82 % "oui", ~ 12 % "hesite", ~ 6 % "non" — la présence de
 *     mitigés et négatifs augmente la conversion (vs 100 % oui qui sent le fake).
 *   - **Longueur** : moyenne ~ 140 caractères, distribution naturelle 60-280.
 *     Pas que des "Super produit !!!" : phrases d'usage qui racontent un moment.
 *   - **Photos** : ~ 30 % des avis en ont (les UGC convertissent 2× mieux).
 *     Aucune photo avec visage frontal (RGPD + brand guidelines maison).
 *   - **Verified purchase** : ~ 65 % marqués vérifiés (e-mail J+45 + manuel).
 *   - **Featured** : 3 avis épinglés sur les plus émotionnels.
 *   - **Dates** : étalées sur 90 jours, plus dense les 30 derniers (effet récence).
 *   - **Auteurs** : prénoms marocains/maghrébins, villes du catalogue.
 *   - **Tags** : 0-3 par avis depuis le catalogue maison.
 *   - **Sources** : web (40 %), email_j45 (45 %), manual (10 %), import_csv (5 %).
 *
 * Le `body` est en français maison : phrases mesurées, premières personnes,
 * pas de superlatifs vides, vocabulaire sensoriel ("nervure", "souplesse",
 * "cuticules apaisées"). Quelques avis en arabe pour montrer la couverture.
 *
 * Cf. docs/reviews-wall/execution/18-ameliorations-admin-controle.md
 * Cf. docs/kolenda/Copywriting.pdf — règles de copy honnête
 */

import type { RitualSignal, RitualSource, RitualStatus } from '@/lib/db/types';

export interface SeedRitualPhoto {
  /** Chemin sous /public — ex. `/reviews/reviews2.jpg`. */
  url: string;
  width: number;
  height: number;
  alt?: string;
}

export interface SeedRitual {
  body: string;
  bodyOriginal?: string;
  wouldRecommend: RitualSignal;
  ritualTags: string[];
  authorFirstName: string | null;
  authorCity: string | null;
  initiatedSince: string | null;
  isAnonymous?: boolean;
  language?: 'fr' | 'ar' | 'en';
  source: RitualSource;
  verifiedPurchase: boolean;
  status: RitualStatus;
  featured?: boolean;
  /** Décalage en jours depuis aujourd'hui (négatif = passé). */
  daysAgo: number;
  photos?: SeedRitualPhoto[];
  autoFlags?: string[];
}

const PHOTO_R2 = { url: '/reviews/reviews2.jpg', width: 1000, height: 900, alt: 'Mains, ongles French naturels' } as const;
const PHOTO_R3 = { url: '/reviews/reviews3.jpg', width: 1000, height: 750, alt: 'Le rituel posé en bord de douche' } as const;
const PHOTO_R4 = { url: '/reviews/reviews4.jpg', width: 1000, height: 900, alt: 'Boîte FemiGlow + 4 étapes' } as const;
const PHOTO_R5 = { url: '/reviews/reviews5.jpg', width: 1000, height: 580, alt: 'Pots paste/powder + buffer' } as const;
const PHOTO_R6 = { url: '/reviews/reviews6.jpg', width: 1000, height: 940, alt: 'Boîte au café, ongles nude' } as const;
const PHOTO_R7 = { url: '/reviews/reviews7.jpg', width: 1000, height: 900, alt: 'Setup studio marbre' } as const;
const PHOTO_R8 = { url: '/reviews/reviews8.jpg', width: 1000, height: 880, alt: 'Boîte sur table marbre' } as const;
const PHOTO_R10 = { url: '/reviews/reviews10.jpg', width: 1000, height: 840, alt: 'French naturel close-up' } as const;
const PHOTO_R11 = { url: '/reviews/reviews11.jpg', width: 1000, height: 990, alt: 'Boîte ouverte, pots verts/roses' } as const;
const PHOTO_R12 = { url: '/reviews/reviews12.jpg', width: 1000, height: 800, alt: 'Pull rose, main' } as const;

export const SEED_RITUALS: SeedRitual[] = [
  // ---------- Featured FR (3 — émotionnels et précis) ----------
  {
    body: 'Trois mois et l’ongle a retrouvé sa nervure. J’ai cessé de le forcer. Les cuticules ont apaisé doucement, sans que je m’en rende compte. Le matin je passe la lime, le soir je polis. C’est devenu un repère plus qu’un soin.',
    wouldRecommend: 'oui',
    ritualTags: ['plus-de-casse', 'cuticules-apaisees', 'rituel-devenu-habitude'],
    authorFirstName: 'Amal',
    authorCity: 'Rabat',
    initiatedSince: '3 mois',
    language: 'fr',
    source: 'email_j45',
    verifiedPurchase: true,
    status: 'APPROVED',
    featured: true,
    daysAgo: 18,
    photos: [PHOTO_R2],
  },
  {
    body: 'Mon ongle se dédoublait au moindre geste. J’ai testé six bases dures, sept huiles, rien. Le rituel m’a appris à ne pas couvrir mais à nourrir. Six semaines et la plaque est devenue homogène. Je ne reviens pas en arrière.',
    wouldRecommend: 'oui',
    ritualTags: ['plaque-souple', 'plus-de-casse'],
    authorFirstName: 'Souad',
    authorCity: 'Casablanca',
    initiatedSince: '6 semaines',
    language: 'fr',
    source: 'email_j45',
    verifiedPurchase: true,
    status: 'APPROVED',
    featured: true,
    daysAgo: 9,
    photos: [PHOTO_R10],
  },
  {
    body: 'J’aime que la maison soit honnête : on ne promet rien, on accompagne. La paste a une odeur de soin, pas de chimie. Le polish donne un fini brillant doux, sans cette laque dure des vernis. Mes filles m’ont demandé pourquoi mes mains brillent.',
    wouldRecommend: 'oui',
    ritualTags: ['eclat-naturel', 'fini-brillant', 'rituel-devenu-habitude'],
    authorFirstName: 'Khadija',
    authorCity: 'Salé',
    initiatedSince: '2 mois',
    language: 'fr',
    source: 'email_j45',
    verifiedPurchase: true,
    status: 'APPROVED',
    featured: true,
    daysAgo: 4,
    photos: [PHOTO_R7, PHOTO_R11],
  },

  // ---------- Featured AR (3 — miroir arabe MSA des featured, Phase 7E-11) ----------
  // Voix maison : adresse féminine, sans emoji ni « ! ». Termes produit traduits
  // (paste→العجينة, polish→المُلمِّع) et prénoms/villes translittérés en arabe.
  // Seul `FemiGlow` reste en latin. Repli FR géré côté listRituals si absents.
  {
    body: 'بعد ثلاثة أشهر استعاد الظفر تموجه الطبيعي، وكففت عن إجهاده. هدأت الأظافر شيئا فشيئا دون أن أنتبه. في الصباح أمرر المبرد، وفي المساء أصقل بالمُلمِّع. صار الأمر طقسا أكثر منه مجرد عناية.',
    wouldRecommend: 'oui',
    ritualTags: ['plus-de-casse', 'cuticules-apaisees', 'rituel-devenu-habitude'],
    authorFirstName: 'أمل',
    authorCity: 'الرباط',
    initiatedSince: '3 mois',
    language: 'ar',
    source: 'email_j45',
    verifiedPurchase: true,
    status: 'APPROVED',
    featured: true,
    daysAgo: 17,
    photos: [PHOTO_R2],
  },
  {
    body: 'كان ظفري ينشطر عند أي حركة. جربت ست قواعد صلبة وسبعة زيوت دون فائدة. علمني الطقس أن أغذي الظفر لا أن أغطيه. بعد ستة أسابيع صارت الصفيحة متجانسة، ولن أعود إلى الوراء.',
    wouldRecommend: 'oui',
    ritualTags: ['plaque-souple', 'plus-de-casse'],
    authorFirstName: 'سعاد',
    authorCity: 'الدار البيضاء',
    initiatedSince: '6 semaines',
    language: 'ar',
    source: 'email_j45',
    verifiedPurchase: true,
    status: 'APPROVED',
    featured: true,
    daysAgo: 8,
    photos: [PHOTO_R10],
  },
  {
    body: 'يعجبني صدق هذه الدار، فهي لا تعد بشيء بل ترافق. رائحة العجينة رائحة عناية لا كيمياء. يمنح المُلمِّع لمعانا ناعما بلا تلك الطبقة القاسية. سألتني بناتي عن سر لمعان يدي.',
    wouldRecommend: 'oui',
    ritualTags: ['eclat-naturel', 'fini-brillant', 'rituel-devenu-habitude'],
    authorFirstName: 'خديجة',
    authorCity: 'سلا',
    initiatedSince: '2 mois',
    language: 'ar',
    source: 'email_j45',
    verifiedPurchase: true,
    status: 'APPROVED',
    featured: true,
    daysAgo: 3,
    photos: [PHOTO_R7, PHOTO_R11],
  },

  // ---------- Featured EN (3 — miroir anglais sobre des featured, Phase 7E-11) ----------
  {
    body: 'Three months in and the nail has found its ridge again. I stopped forcing it. The cuticles settled quietly, almost without my noticing. In the morning I pass the file, in the evening I polish. It has become a marker more than a treatment.',
    wouldRecommend: 'oui',
    ritualTags: ['plus-de-casse', 'cuticules-apaisees', 'rituel-devenu-habitude'],
    authorFirstName: 'Amal',
    authorCity: 'Rabat',
    initiatedSince: '3 mois',
    language: 'en',
    source: 'email_j45',
    verifiedPurchase: true,
    status: 'APPROVED',
    featured: true,
    daysAgo: 16,
    photos: [PHOTO_R2],
  },
  {
    body: 'My nail split at the slightest touch. I tried six hard bases, seven oils, nothing. The ritual taught me not to cover the nail but to nourish it. Six weeks on, the plate has become even. I am not going back.',
    wouldRecommend: 'oui',
    ritualTags: ['plaque-souple', 'plus-de-casse'],
    authorFirstName: 'Souad',
    authorCity: 'Casablanca',
    initiatedSince: '6 semaines',
    language: 'en',
    source: 'email_j45',
    verifiedPurchase: true,
    status: 'APPROVED',
    featured: true,
    daysAgo: 7,
    photos: [PHOTO_R10],
  },
  {
    body: 'I like that the house is honest: nothing is promised, you are accompanied. The paste smells of care, not chemistry. The polish gives a soft, bright finish, without the hard lacquer of varnish. My daughters asked me why my hands shine.',
    wouldRecommend: 'oui',
    ritualTags: ['eclat-naturel', 'fini-brillant', 'rituel-devenu-habitude'],
    authorFirstName: 'Khadija',
    authorCity: 'Salé',
    initiatedSince: '2 mois',
    language: 'en',
    source: 'email_j45',
    verifiedPurchase: true,
    status: 'APPROVED',
    featured: true,
    daysAgo: 2,
    photos: [PHOTO_R7, PHOTO_R11],
  },

  // ---------- "Oui" verbeux et précis (12 — l'épine dorsale) ----------
  {
    body: 'Je travaille dans la pâtisserie. Mes mains touchent l’eau, le sucre, la farine toute la journée. En quatre semaines, j’ai cessé de voir mes ongles se fendre. Le polish revient une fois par semaine. Le reste, c’est de la patience.',
    wouldRecommend: 'oui',
    ritualTags: ['plus-de-casse', 'plaque-souple'],
    authorFirstName: 'Houda',
    authorCity: 'Casablanca',
    initiatedSince: '1 mois',
    source: 'email_j45',
    verifiedPurchase: true,
    status: 'APPROVED',
    daysAgo: 22,
    photos: [PHOTO_R5],
  },
  {
    body: 'La paste s’étale fin, ça compte. J’ai eu peur d’en mettre trop la première fois. La poudre se fond sans grumeaux. Je polis avec le bloc, et l’ongle redevient lisse. Le geste prend cinq minutes. Le soir.',
    wouldRecommend: 'oui',
    ritualTags: ['ongles-plus-lisses', 'rituel-devenu-habitude'],
    authorFirstName: 'Yasmine',
    authorCity: 'Rabat',
    initiatedSince: '5 semaines',
    source: 'web',
    verifiedPurchase: false,
    status: 'APPROVED',
    daysAgo: 11,
    photos: [PHOTO_R12],
  },
  {
    body: 'J’ai porté du gel pendant trois ans. À l’arrêt, mes ongles étaient comme du papier. Le rituel ne fait pas de miracle en une semaine, mais il accompagne la repousse. Au bout de deux mois, la nervure revient. Patience.',
    wouldRecommend: 'oui',
    ritualTags: ['plaque-souple', 'plus-de-casse'],
    authorFirstName: 'Imane',
    authorCity: 'Marrakech',
    initiatedSince: '2 mois',
    source: 'email_j45',
    verifiedPurchase: true,
    status: 'APPROVED',
    daysAgo: 33,
  },
  {
    body: 'Le coffret est élégant sans en faire trop. Les pots sont petits mais durent. J’ai apprécié la livraison rapide à Tanger. Le mot qui accompagne le colis donne envie de prendre soin du rituel.',
    wouldRecommend: 'oui',
    ritualTags: ['eclat-naturel'],
    authorFirstName: 'Sofia',
    authorCity: 'Tanger',
    initiatedSince: '3 semaines',
    source: 'web',
    verifiedPurchase: false,
    status: 'APPROVED',
    daysAgo: 7,
    photos: [PHOTO_R6],
  },
  {
    body: 'Halal, sans-cruauté, sans paraben : ça compte pour moi. La composition est lisible, pas de jargon caché. J’ai partagé le rituel avec ma sœur, qui en a commandé un.',
    wouldRecommend: 'oui',
    ritualTags: ['halal', 'rituel-devenu-habitude'],
    authorFirstName: 'Nadia',
    authorCity: 'Fès',
    initiatedSince: '6 semaines',
    source: 'manual',
    verifiedPurchase: true,
    status: 'APPROVED',
    daysAgo: 14,
  },
  {
    body: 'Au début, j’étais sceptique. Le prix m’a fait hésiter. Après essai, j’ai compris que c’est un investissement de quelques mois, pas un produit jetable. Mes ongles sont plus brillants sans vernis qu’avant.',
    wouldRecommend: 'oui',
    ritualTags: ['eclat-naturel', 'fini-brillant'],
    authorFirstName: 'Salma',
    authorCity: 'Agadir',
    initiatedSince: '7 semaines',
    source: 'email_j45',
    verifiedPurchase: true,
    status: 'APPROVED',
    daysAgo: 26,
  },
  {
    body: 'J’ai des cuticules qui s’infectent facilement. La paste les a apaisées en quelques jours. Plus de rougeurs après la douche. Je l’utilise même seule, sans la poudre, certains soirs.',
    wouldRecommend: 'oui',
    ritualTags: ['cuticules-apaisees', 'mains-detendues'],
    authorFirstName: 'Hafsa',
    authorCity: 'Oujda',
    initiatedSince: '1 mois',
    source: 'web',
    verifiedPurchase: false,
    status: 'APPROVED',
    daysAgo: 12,
    photos: [PHOTO_R3],
  },
  {
    body: 'Ma fille de 19 ans me l’a offert pour mon anniversaire. Elle m’a dit : "Maman, prends cinq minutes pour toi." Le rituel est devenu ce moment où je m’arrête. Mes mains m’en remercient.',
    wouldRecommend: 'oui',
    ritualTags: ['mains-detendues', 'rituel-devenu-habitude'],
    authorFirstName: 'Latifa',
    authorCity: 'Meknès',
    initiatedSince: '5 semaines',
    source: 'manual',
    verifiedPurchase: true,
    status: 'APPROVED',
    daysAgo: 19,
  },
  {
    body: 'Effet visible dès la première application : la plaque est tout de suite plus lisse. Le polish 4 fait toute la différence. Je le passe une fois par semaine, pas plus.',
    wouldRecommend: 'oui',
    ritualTags: ['ongles-plus-lisses', 'fini-brillant'],
    authorFirstName: 'Mounia',
    authorCity: 'Tétouan',
    initiatedSince: '2 semaines',
    source: 'web',
    verifiedPurchase: false,
    status: 'APPROVED',
    daysAgo: 5,
    photos: [PHOTO_R4],
  },
  {
    body: 'Très satisfaite. Le service après-vente m’a recontactée pour vérifier que tout allait bien. C’est rare aujourd’hui, et ça compte.',
    wouldRecommend: 'oui',
    ritualTags: ['rituel-devenu-habitude'],
    authorFirstName: 'Wafae',
    authorCity: 'Kénitra',
    initiatedSince: '4 semaines',
    source: 'manual',
    verifiedPurchase: true,
    status: 'APPROVED',
    daysAgo: 28,
  },
  {
    body: 'Je suis enseignante. Mes mains sont en contact avec la craie, le savon, parfois le tableau. Avant le rituel, j’avais honte de mes ongles. Aujourd’hui je les laisse sortir.',
    wouldRecommend: 'oui',
    ritualTags: ['eclat-naturel', 'mains-detendues'],
    authorFirstName: 'Rajae',
    authorCity: 'Rabat',
    initiatedSince: '8 semaines',
    source: 'email_j45',
    verifiedPurchase: true,
    status: 'APPROVED',
    daysAgo: 41,
    photos: [PHOTO_R10],
  },
  {
    body: 'L’instruction qui accompagne le kit est claire : trois gestes, mesurés. J’aurais aimé une vidéo, mais finalement le geste se prend vite.',
    wouldRecommend: 'oui',
    ritualTags: ['rituel-devenu-habitude'],
    authorFirstName: 'Hind',
    authorCity: 'Casablanca',
    initiatedSince: '3 semaines',
    source: 'web',
    verifiedPurchase: false,
    status: 'APPROVED',
    daysAgo: 16,
  },
  {
    body: 'La poudre est très fine, elle ne fait pas de grumeaux. Le rendu est mat naturel, exactement ce que je cherchais.',
    wouldRecommend: 'oui',
    ritualTags: ['fini-brillant', 'ongles-plus-lisses'],
    authorFirstName: 'Ikram',
    authorCity: 'Marrakech',
    initiatedSince: '4 semaines',
    source: 'email_j45',
    verifiedPurchase: true,
    status: 'APPROVED',
    daysAgo: 31,
    photos: [PHOTO_R8],
  },

  // ---------- "Oui" courts (12 — densité de social proof) ----------
  { body: 'Ongles plus lisses dès la première utilisation.', wouldRecommend: 'oui', ritualTags: ['ongles-plus-lisses'], authorFirstName: 'Asmae', authorCity: 'Rabat', initiatedSince: '2 semaines', source: 'web', verifiedPurchase: false, status: 'APPROVED', daysAgo: 3 },
  { body: 'Très belle texture, application facile.', wouldRecommend: 'oui', ritualTags: ['fini-brillant'], authorFirstName: 'Zineb', authorCity: 'Casablanca', initiatedSince: '3 semaines', source: 'email_j45', verifiedPurchase: true, status: 'APPROVED', daysAgo: 8 },
  { body: 'Adopté. Mes ongles m’en remercient.', wouldRecommend: 'oui', ritualTags: ['rituel-devenu-habitude'], authorFirstName: 'Fatima', authorCity: 'Tanger', initiatedSince: '1 mois', source: 'web', verifiedPurchase: false, status: 'APPROVED', daysAgo: 13 },
  { body: 'Plaque plus souple en quatre semaines.', wouldRecommend: 'oui', ritualTags: ['plaque-souple'], authorFirstName: 'Lina', authorCity: 'Agadir', initiatedSince: '4 semaines', source: 'email_j45', verifiedPurchase: true, status: 'APPROVED', daysAgo: 17 },
  { body: 'Plus de casse après trois semaines. Magique.', wouldRecommend: 'oui', ritualTags: ['plus-de-casse'], authorFirstName: 'Maryam', authorCity: 'Salé', initiatedSince: '3 semaines', source: 'web', verifiedPurchase: false, status: 'APPROVED', daysAgo: 21 },
  { body: 'Je suis discrète, mais ce rituel m’a convaincue.', wouldRecommend: 'oui', ritualTags: ['mains-detendues'], authorFirstName: 'Kawtar', authorCity: 'Fès', initiatedSince: '5 semaines', source: 'email_j45', verifiedPurchase: true, status: 'APPROVED', daysAgo: 25 },
  { body: 'Fini brillant comme une vraie manucure, mais sans le gel.', wouldRecommend: 'oui', ritualTags: ['fini-brillant'], authorFirstName: 'Dounia', authorCity: 'Rabat', initiatedSince: '6 semaines', source: 'email_j45', verifiedPurchase: true, status: 'APPROVED', daysAgo: 29, photos: [PHOTO_R12] },
  { body: 'Cuticules apaisées, c’est très visible.', wouldRecommend: 'oui', ritualTags: ['cuticules-apaisees'], authorFirstName: 'Sara', authorCity: 'Oujda', initiatedSince: '4 semaines', source: 'web', verifiedPurchase: false, status: 'APPROVED', daysAgo: 36 },
  { body: 'Bon produit, bon service, livraison rapide.', wouldRecommend: 'oui', ritualTags: ['rituel-devenu-habitude'], authorFirstName: 'Iman', authorCity: 'Meknès', initiatedSince: '2 semaines', source: 'manual', verifiedPurchase: true, status: 'APPROVED', daysAgo: 6 },
  { body: 'L’éclat naturel revient peu à peu.', wouldRecommend: 'oui', ritualTags: ['eclat-naturel'], authorFirstName: 'Najlaa', authorCity: 'Marrakech', initiatedSince: '5 semaines', source: 'email_j45', verifiedPurchase: true, status: 'APPROVED', daysAgo: 38, photos: [PHOTO_R7] },
  { body: 'Halal et clean, c’est ce que je cherchais.', wouldRecommend: 'oui', ritualTags: ['halal'], authorFirstName: 'Aicha', authorCity: 'Tétouan', initiatedSince: '3 semaines', source: 'manual', verifiedPurchase: true, status: 'APPROVED', daysAgo: 23 },
  { body: 'Rituel adopté. Je l’offre à ma mère ce mois-ci.', wouldRecommend: 'oui', ritualTags: ['rituel-devenu-habitude'], authorFirstName: 'Lamia', authorCity: 'Kénitra', initiatedSince: '7 semaines', source: 'email_j45', verifiedPurchase: true, status: 'APPROVED', daysAgo: 44 },

  // ---------- "Oui" plus anciens (10 — montrent la profondeur historique) ----------
  { body: 'Plus de six mois que j’utilise le rituel. Mes ongles n’ont jamais été aussi solides.', wouldRecommend: 'oui', ritualTags: ['plus-de-casse', 'rituel-devenu-habitude'], authorFirstName: 'Btissam', authorCity: 'Rabat', initiatedSince: '6 mois', source: 'email_j45', verifiedPurchase: true, status: 'APPROVED', daysAgo: 52, photos: [PHOTO_R2] },
  { body: 'J’ai eu peur que ça s’estompe, mais après huit semaines l’effet tient. Je rachète.', wouldRecommend: 'oui', ritualTags: ['plaque-souple'], authorFirstName: 'Hiba', authorCity: 'Casablanca', initiatedSince: '8 semaines', source: 'email_j45', verifiedPurchase: true, status: 'APPROVED', daysAgo: 56 },
  { body: 'Je suis infirmière. Mes mains supportent l’alcool plusieurs fois par jour. Ce rituel les a sauvées.', wouldRecommend: 'oui', ritualTags: ['cuticules-apaisees', 'mains-detendues'], authorFirstName: 'Karima', authorCity: 'Salé', initiatedSince: '4 mois', source: 'email_j45', verifiedPurchase: true, status: 'APPROVED', daysAgo: 61 },
  { body: 'L’odeur me rappelle une crème de ma grand-mère, légère et terreuse. Réconfortant.', wouldRecommend: 'oui', ritualTags: ['mains-detendues'], authorFirstName: 'Naima', authorCity: 'Fès', initiatedSince: '2 mois', source: 'web', verifiedPurchase: false, status: 'APPROVED', daysAgo: 64 },
  { body: 'Premier kit terminé, je commande le second. La paste tient bien dans le temps.', wouldRecommend: 'oui', ritualTags: ['rituel-devenu-habitude'], authorFirstName: 'Loubna', authorCity: 'Marrakech', initiatedSince: '4 mois', source: 'email_j45', verifiedPurchase: true, status: 'APPROVED', daysAgo: 68, photos: [PHOTO_R6] },
  { body: 'Pour un rituel marocain, le packaging est moderne. Je l’assume sur ma vanity.', wouldRecommend: 'oui', ritualTags: ['eclat-naturel'], authorFirstName: 'Ghita', authorCity: 'Agadir', initiatedSince: '3 mois', source: 'web', verifiedPurchase: false, status: 'APPROVED', daysAgo: 72 },
  { body: 'Mes ongles sont plus longs, plus brillants. Et je n’ai plus à les couper court tous les quinze jours.', wouldRecommend: 'oui', ritualTags: ['plus-de-casse', 'eclat-naturel'], authorFirstName: 'Yasmin', authorCity: 'Tanger', initiatedSince: '5 mois', source: 'email_j45', verifiedPurchase: true, status: 'APPROVED', daysAgo: 76 },
  { body: 'Sceptique au début. Convaincue après six semaines. Pas de tour de magie, juste de la régularité.', wouldRecommend: 'oui', ritualTags: ['plaque-souple'], authorFirstName: 'Soukaina', authorCity: 'Oujda', initiatedSince: '6 semaines', source: 'web', verifiedPurchase: false, status: 'APPROVED', daysAgo: 81 },
  { body: 'Très bon rapport qualité-prix pour un soin marocain de cette qualité.', wouldRecommend: 'oui', ritualTags: ['rituel-devenu-habitude'], authorFirstName: 'Asma', authorCity: 'Meknès', initiatedSince: '3 mois', source: 'manual', verifiedPurchase: true, status: 'APPROVED', daysAgo: 85 },
  { body: 'Le polish 4 est ma surprise préférée. Ce fini soyeux, c’est ça que je cherchais depuis dix ans.', wouldRecommend: 'oui', ritualTags: ['fini-brillant', 'ongles-plus-lisses'], authorFirstName: 'Chaymae', authorCity: 'Rabat', initiatedSince: '4 mois', source: 'email_j45', verifiedPurchase: true, status: 'APPROVED', daysAgo: 88 },

  // ---------- "Hesite" honnêtes (6 — crédibilité du wall) ----------
  {
    body: 'L’effet est réel mais lent. Il faut six semaines pour le voir. Si vous cherchez un miracle en trois jours, ce n’est pas pour vous.',
    wouldRecommend: 'hesite',
    ritualTags: ['plaque-souple'],
    authorFirstName: 'Sanaa',
    authorCity: 'Casablanca',
    initiatedSince: '7 semaines',
    source: 'email_j45',
    verifiedPurchase: true,
    status: 'APPROVED',
    daysAgo: 15,
  },
  {
    body: 'J’aime la philosophie mais le prix m’a fait réfléchir. Je rachèterai, mais pas en pack premium.',
    wouldRecommend: 'hesite',
    ritualTags: [],
    authorFirstName: 'Rim',
    authorCity: 'Salé',
    initiatedSince: '5 semaines',
    source: 'web',
    verifiedPurchase: false,
    status: 'APPROVED',
    daysAgo: 24,
  },
  {
    body: 'La paste a une odeur légère qui ne me plaît pas tout à fait. Mais l’effet est là.',
    wouldRecommend: 'hesite',
    ritualTags: ['ongles-plus-lisses'],
    authorFirstName: 'Saadia',
    authorCity: 'Fès',
    initiatedSince: '3 semaines',
    source: 'email_j45',
    verifiedPurchase: true,
    status: 'APPROVED',
    daysAgo: 31,
  },
  {
    body: 'Mes ongles sont trop fragiles à la base. J’ai vu un léger mieux, mais j’aurais besoin d’un complément.',
    wouldRecommend: 'hesite',
    ritualTags: ['plaque-souple'],
    authorFirstName: 'Houria',
    authorCity: 'Tanger',
    initiatedSince: '6 semaines',
    source: 'email_j45',
    verifiedPurchase: true,
    status: 'APPROVED',
    daysAgo: 47,
  },
  {
    body: 'Le buffer s’use vite avec un usage hebdomadaire. À voir s’il est remplaçable seul.',
    wouldRecommend: 'hesite',
    ritualTags: ['fini-brillant'],
    authorFirstName: 'Mariam',
    authorCity: 'Marrakech',
    initiatedSince: '3 mois',
    source: 'manual',
    verifiedPurchase: true,
    status: 'APPROVED',
    daysAgo: 55,
  },
  {
    body: 'Bonne idée, joli kit, mais je m’attendais à des résultats plus rapides après ce que j’avais lu.',
    wouldRecommend: 'hesite',
    ritualTags: [],
    authorFirstName: 'Amina',
    authorCity: 'Agadir',
    initiatedSince: '1 mois',
    source: 'web',
    verifiedPurchase: false,
    status: 'APPROVED',
    daysAgo: 38,
  },

  // ---------- "Non" honnêtes (3) ----------
  {
    body: 'Ce n’est pas pour mes ongles. Ils sont trop secs à la base, le rituel n’a pas suffi. Le service a été pro, ils m’ont remboursée.',
    wouldRecommend: 'non',
    ritualTags: [],
    authorFirstName: 'Bouchra',
    authorCity: 'Rabat',
    initiatedSince: '2 semaines',
    source: 'email_j45',
    verifiedPurchase: true,
    status: 'APPROVED',
    daysAgo: 27,
  },
  {
    body: 'Le rendu mat n’est pas mon goût. Je préfère un vernis classique. Pas un défaut, juste une attente.',
    wouldRecommend: 'non',
    ritualTags: ['fini-brillant'],
    authorFirstName: 'Najat',
    authorCity: 'Tétouan',
    initiatedSince: '3 semaines',
    source: 'web',
    verifiedPurchase: false,
    status: 'APPROVED',
    daysAgo: 49,
  },
  {
    body: 'Je n’ai pas trouvé le temps de m’y tenir. Le rituel demande de la régularité que je n’ai pas eue.',
    wouldRecommend: 'non',
    ritualTags: [],
    authorFirstName: 'Saida',
    authorCity: 'Kénitra',
    initiatedSince: '2 semaines',
    source: 'manual',
    verifiedPurchase: true,
    status: 'APPROVED',
    daysAgo: 60,
  },

  // ---------- PENDING (4 — alimente la queue admin) ----------
  {
    body: 'Premier essai ce matin. La paste s’étale joliment. J’écrirai un retour complet dans un mois.',
    wouldRecommend: 'oui',
    ritualTags: [],
    authorFirstName: 'Salwa',
    authorCity: 'Casablanca',
    initiatedSince: '1 semaine',
    source: 'web',
    verifiedPurchase: false,
    status: 'PENDING',
    daysAgo: 1,
  },
  {
    body: 'كنت أبحث عن طقس طبيعي لأظافري. هذا الطقس أعطاني نتيجة بعد ثلاثة أسابيع. أنا سعيدة.',
    wouldRecommend: 'oui',
    ritualTags: ['plaque-souple'],
    authorFirstName: 'زهرة',
    authorCity: 'الرباط',
    initiatedSince: '3 semaines',
    language: 'ar',
    source: 'email_j45',
    verifiedPurchase: true,
    status: 'PENDING',
    daysAgo: 2,
    photos: [PHOTO_R5],
  },
  {
    body: 'Ongles plus lisses, plaque plus souple, cuticules apaisées, fini brillant ! Un MIRACLE ! Toutes mes amies en parlent !!!',
    wouldRecommend: 'oui',
    ritualTags: ['ongles-plus-lisses', 'plaque-souple', 'fini-brillant'],
    authorFirstName: 'Karima',
    authorCity: 'Agadir',
    initiatedSince: '1 mois',
    source: 'web',
    verifiedPurchase: false,
    status: 'PENDING',
    daysAgo: 0,
    // Devrait être flag all_caps + emojis si présents ; ici on simule un flag.
    autoFlags: ['all_caps'],
  },
  {
    body: 'Visitez www.autre-marque-suspecte.com pour mieux 😍',
    wouldRecommend: 'oui',
    ritualTags: [],
    authorFirstName: 'Anonyme',
    authorCity: null,
    initiatedSince: null,
    source: 'web',
    verifiedPurchase: false,
    status: 'PENDING',
    daysAgo: 0,
    autoFlags: ['link_external', 'emoji_detected'],
  },

  // ---------- REJECTED + HIDDEN (3 — donnent du grain à la modération) ----------
  {
    body: 'Spam évident, copié-collé d’un autre site.',
    wouldRecommend: 'oui',
    ritualTags: [],
    authorFirstName: null,
    authorCity: null,
    initiatedSince: null,
    source: 'import_csv',
    verifiedPurchase: false,
    status: 'REJECTED',
    daysAgo: 7,
    autoFlags: ['duplicate_strict'],
  },
  {
    body: 'Photo non conforme (visage frontal). Texte ok mais photo retirée pour modération.',
    wouldRecommend: 'oui',
    ritualTags: ['eclat-naturel'],
    authorFirstName: 'Kenza',
    authorCity: 'Rabat',
    initiatedSince: '2 mois',
    source: 'email_j45',
    verifiedPurchase: true,
    status: 'HIDDEN',
    daysAgo: 20,
    autoFlags: ['face_detected'],
  },
  {
    body: 'TROIS MOIS ET RIEN N\'A CHANGÉ, C\'EST UN SCANDALE, J\'EXIGE UN REMBOURSEMENT IMMÉDIAT !!!',
    wouldRecommend: 'non',
    ritualTags: [],
    authorFirstName: 'Inconnue',
    authorCity: null,
    initiatedSince: '3 mois',
    source: 'web',
    verifiedPurchase: false,
    status: 'REJECTED',
    daysAgo: 35,
    autoFlags: ['all_caps'],
  },
];

/**
 * Stats de contrôle pour le seed (utile en CLI et tests).
 */
export function getSeedStats() {
  const total = SEED_RITUALS.length;
  const bySignal = {
    oui: SEED_RITUALS.filter((r) => r.wouldRecommend === 'oui').length,
    hesite: SEED_RITUALS.filter((r) => r.wouldRecommend === 'hesite').length,
    non: SEED_RITUALS.filter((r) => r.wouldRecommend === 'non').length,
  };
  const byStatus = {
    APPROVED: SEED_RITUALS.filter((r) => r.status === 'APPROVED').length,
    PENDING: SEED_RITUALS.filter((r) => r.status === 'PENDING').length,
    REJECTED: SEED_RITUALS.filter((r) => r.status === 'REJECTED').length,
    HIDDEN: SEED_RITUALS.filter((r) => r.status === 'HIDDEN').length,
  };
  const withPhotos = SEED_RITUALS.filter((r) => (r.photos?.length ?? 0) > 0).length;
  const verified = SEED_RITUALS.filter((r) => r.verifiedPurchase).length;
  const featured = SEED_RITUALS.filter((r) => r.featured).length;
  return { total, bySignal, byStatus, withPhotos, verified, featured };
}
