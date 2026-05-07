/**
 * CHA-075 — Dictionnaire darija FR-script + AR-script (versionné).
 *
 * Sources : annexes/lexique-darija.md (à étendre via l'admin
 * `/admin/chat/lang`). Trois listes :
 *
 * - `DARIJA_FR_TOKENS` : tokens darija écrits en alphabet latin
 *   (avec chiffres : 3, 7, 9). Servent à la détection.
 * - `DARIJA_AR_TOKENS` : tokens darija écrits en script arabe
 *   (souvent confondus avec MSA).
 * - `MSA_AR_TOKENS` : marqueurs MSA (arabe classique) — leur présence
 *   majoritaire bascule vers `'ar'` plutôt que `'ar-MA'`.
 */

// FR-script Darija — basé sur ALA-LC + usage marketing courant.
export const DARIJA_FR_TOKENS = [
  // pronoms / articles
  'ana',
  'nta',
  'nti',
  'huwa',
  'hia',
  'hna',
  'hnaya',
  'ntoma',
  'huma',
  // questions
  'chno',
  'kifach',
  'fin',
  'fayn',
  'wach',
  'wakha',
  'imta',
  'mata',
  '3lach',
  '3lah',
  'kifash',
  'achno',
  'chnu',
  // intensifs
  'bzaf',
  'bzzaf',
  '7it',
  '7ta',
  'safi',
  'mzyan',
  'mezyan',
  'zwin',
  'zwina',
  // verbes courants
  'bghit',
  'bghyt',
  'kanbghi',
  'nchri',
  'nakol',
  'mchina',
  'jit',
  'tjib',
  'sift',
  // négation
  'machi',
  'mashi',
  'matbghich',
  'machi mochkil',
  // marqueurs digit
  '3la',
  '3andi',
  '3andek',
  '3andkom',
  '3andna',
  '3lik',
  'l3aks',
  // existence / particules
  'kayn',
  'kayna',
  'kaynin',
  'makayn',
  'makaynsh',
  'walou',
  'labas',
  'mrahba',
  'inshallah',
  'tbarkallah',
  'mochkil',
  'machakil',
  // possessifs
  'dyali',
  'dyalek',
  'dyalkom',
  'dyalna',
  'dyaltek',
  // commerce / vie quotidienne
  'flos',
  'taman',
  '9awi',
  'darija',
  'maghrib',
  'maghribiya',
  'salam',
  'salem',
  'sba7',
  'sbah',
  'msa',
  'mselkhir',
  'shokran',
  'choukran',
  'shukran',
  // anti-darija (faux positifs MSA)
];

// Script arabe — Darija a tendance à utiliser des constructions
// hybrides ; ces mots sont caractéristiques de l'usage marocain.
export const DARIJA_AR_TOKENS = [
  'كيفاش',
  'فاش',
  'فين',
  'شنو',
  'بزاف',
  'واخا',
  'دابا',
  'صافي',
  'عافاك',
  'حشمة',
  'مزيان',
  'مغربية',
  'مغربي',
  'بغيت',
];

// MSA / arabe classique — si on en détecte plusieurs, on bascule
// `ar` plutôt que `ar-MA`.
export const MSA_AR_TOKENS = [
  'ماذا',
  'لماذا',
  'كيف',
  'متى',
  'أين',
  'هل',
  'الذي',
  'التي',
  'أنا',
  'أنت',
  'نحن',
  'أيضا',
  'بالإضافة',
  'هكذا',
  'لكن',
  'لذلك',
];

export interface LangDictionary {
  darijaFr: string[];
  darijaAr: string[];
  msaAr: string[];
  /** ISO date — incrementé à chaque release du dictionnaire. */
  version: string;
}

export const DICTIONARY: LangDictionary = {
  darijaFr: DARIJA_FR_TOKENS,
  darijaAr: DARIJA_AR_TOKENS,
  msaAr: MSA_AR_TOKENS,
  version: '2026-05-06',
};
