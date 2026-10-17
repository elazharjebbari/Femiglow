/**
 * Fiche de référence du Pack FemiGlow — source unique de vérité.
 *
 * Toute surface qui énonce un fait produit (page /kit, accueil, rituel,
 * panier, catalogue Meta, chat IA, emails, traductions FR/EN/AR) doit
 * s'aligner sur ce fichier. Le test `kit-facts.guard.test.ts` échoue si une
 * surface affiche une valeur contradictoire ou une mention retirée.
 *
 * Version lisible pour validation : `docs/fiche-produit-reference.md`.
 * Pour changer un fait : modifier ici, puis la liste `KIT_FORBIDDEN_CLAIMS`
 * si l'ancienne valeur doit être bannie, puis relancer le test.
 */
import type { Locale } from '@/i18n.config';

export const KIT_FACTS = {
  /** Contenances imprimées sur les pots. */
  paste: { grams: 15 },
  powder: { grams: 8 },
  polissoir: { lengthMm: 90, faces: 3 },

  /** Le rituel : 4 gestes (préparer, paste, powder, polir) en 5 minutes. */
  gestures: ['preparer', 'paste', 'powder', 'polir'] as const,
  ritualMinutes: 5,
  /** Démonstration vidéo accélérée. */
  videoDemoSeconds: 90,
  /** Fréquence recommandée : une fois par semaine. */
  applicationsPerWeek: 1,
  /** Brillance visible jusqu'à 3 semaines. */
  shineWeeksMax: 3,

  /** Durée de vie du pack à raison d'un soin par semaine. */
  treatmentsPerPack: 25,
  packMonths: 6,
  polissoirMonths: 6,

  /** Ingrédients clés (détail INCI : src/data/mock/kit.ts → composition). */
  keyIngredients: ['cire d’abeille', 'huile de jojoba', 'poudre de riz', 'kaolin'],

  /** Aucune certification affichée tant qu'aucun certificat n'est fourni. */
  certifications: [] as ReadonlyArray<{ label: string; body: string }>,

  workshopCity: 'Rabat',
  delivery: { rabatHours: 24, moroccoHoursMin: 48, moroccoHoursMax: 72, free: true },
  returnDays: 30,
  payment: 'cod' as const,
  minAge: 14,
} as const;

export const KIT_GESTURE_COUNT = KIT_FACTS.gestures.length;

interface KitCopy {
  /** « Quatre gestes » — en tête de phrase. */
  gestures: string;
  /** « quatre gestes » — en milieu de phrase. */
  gesturesLower: string;
  /** « cinq minutes ». */
  duration: string;
  /** « une fois par semaine ». */
  frequency: string;
  /** « jusqu'à trois semaines ». */
  shine: string;
  /** « environ six mois ». */
  packDuration: string;
  /** Ligne livraison courte. */
  delivery: string;
  /** Mention ablutions (angle halal / woudou). */
  wudu: string;
}

export const KIT_COPY: Record<Locale, KitCopy> = {
  fr: {
    gestures: 'Quatre gestes',
    gesturesLower: 'quatre gestes',
    duration: 'cinq minutes',
    frequency: 'une fois par semaine',
    shine: 'jusqu’à trois semaines',
    packDuration: 'environ six mois',
    delivery: 'Rabat 24 h — Maroc 48 à 72 h',
    wudu: 'Compatible woudou',
  },
  en: {
    gestures: 'Four gestures',
    gesturesLower: 'four gestures',
    duration: 'five minutes',
    frequency: 'once a week',
    shine: 'up to three weeks',
    packDuration: 'about six months',
    delivery: 'Rabat 24 h — Morocco 48 to 72 h',
    wudu: 'Wudu-friendly',
  },
  ar: {
    gestures: 'أربع حركات',
    gesturesLower: 'أربع حركات',
    duration: 'خمس دقائق',
    frequency: 'مرة واحدة في الأسبوع',
    shine: 'حتى ثلاثة أسابيع',
    packDuration: 'حوالي ستة أشهر',
    delivery: 'الرباط 24 ساعة — باقي المغرب 48 إلى 72 ساعة',
    wudu: 'متوافق مع الوضوء',
  },
};

/**
 * Formulations retirées : toute occurrence dans une surface publique est
 * une contradiction avec la fiche. Utilisé par le test garde-fou.
 */
export const KIT_FORBIDDEN_CLAIMS: ReadonlyArray<{ pattern: RegExp; why: string }> = [
  { pattern: /\b287\b/, why: 'nombre d’avis de démarrage (faux) — utiliser le vrai compte' },
  { pattern: /EVE Vegan|Cosmos Organic|Ecocert/i, why: 'certification non prouvée, retirée' },
  { pattern: /\bvegan\b/i, why: 'formule à la cire d’abeille : pas vegan' },
  { pattern: /poudre de perle|pearl powder|مسحوق اللؤلؤ/i, why: 'ingrédient absent de l’INCI' },
  { pattern: /\b30 ?ml\b|\b30 ?g\b/i, why: 'contenances : paste 15 g, powder 8 g' },
  { pattern: /47 (jours|soins|days|treatments)/i, why: 'durée du pack : 25 soins, environ six mois' },
  { pattern: /quatre (à|à) cinq mois|four to five months|أربعة إلى خمسة أشهر/i, why: 'durée du pack : environ six mois' },
  { pattern: /tous les soirs|every evening|every night|كل مساء/i, why: 'fréquence : une fois par semaine' },
  { pattern: /cinq minutes par jour|five minutes a day|خمس دقائق كلّ يوم|خمس دقائق كل يوم/i, why: 'fréquence : une fois par semaine' },
  { pattern: /\b(deux|trois|cinq) gestes\b|\b(two|three|five) gestures\b|حركتان|ثلاث حركات|خمس حركات/i, why: 'le rituel compte quatre gestes' },
  { pattern: /powder rose poudr|rose poudré powder|powdered rose powder/i, why: 'la powder est blanche ; seule l’étiquette est rose poudré' },
];
