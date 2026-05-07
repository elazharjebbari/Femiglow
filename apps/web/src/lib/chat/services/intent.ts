/**
 * CHA-035 / CHA-161 / CHA-225 — `intent.detect`.
 *
 * Heuristique légère qui classe un message visiteur dans un intent
 * éditorial. Ne remplace PAS un classifieur ML — sert seulement à :
 * - choisir un wording approprié dans la réponse,
 * - tracker le funnel (KPI),
 * - alimenter le re-rank RAG (filtrage tags `pricing` vs `routine`).
 * - alimenter `lead-decision` (déclenchement formulaire de capture).
 *
 * Architecture (v2 / CHA-225) :
 *  - Chaque pattern porte un POIDS qui contribue à un score par intent.
 *  - L'intent gagnant est celui avec le score cumulé le plus élevé,
 *    avec un seuil minimal (`MIN_CONFIDENCE_SCORE`) en deçà duquel on
 *    retombe sur 'misc' — utile pour éviter qu'un seul mot ambigu
 *    déclenche un faux positif (ex. "j'ai une commande" pour
 *    `purchase-intent` au lieu de `order-status`).
 *  - L'ordre des intents en cas d'égalité reste celui de la liste
 *    (priorité éditoriale), ce qui préserve la compatibilité.
 *
 * cf. docs/chat-assistant/03-backend.md §3.4
 *     docs/chat-assistant/18-instructions-knowledge-strategy.md §6
 *     docs/chat-assistant/CHA-225-classifier.md
 */

export type ChatIntent =
  | 'greeting'
  | 'pricing'
  | 'shipping'
  | 'routine'
  | 'ingredient'
  | 'order-status'
  | 'support'
  // CHA-161 — 8 nouveaux intents pour mieux qualifier les conversations
  | 'objection-price'
  | 'objection-doubt'
  | 'social-proof'
  | 'comparison'
  | 'b2b'
  | 'callback-request'
  | 'frustration'
  | 'after-hours'
  // CHA-225 — Intent d'achat explicite : on ne rate pas l'opportunité,
  // on déclenche le formulaire de capture lead dès le 1er tour.
  | 'purchase-intent'
  | 'misc';

interface PatternRule {
  intent: ChatIntent;
  patterns: RegExp[];
  /**
   * Patterns "forts" qui valent 2× le score nominal. Utilisés pour les
   * formulations exclusives à un intent (ex. "je veux commander" pour
   * `purchase-intent` ne peut pas vouloir dire autre chose).
   */
  strong?: RegExp[];
  /**
   * Patterns "négateurs" qui invalident l'intent même si un pattern
   * principal a matché. Ex. "j'ai déjà commandé" → ne pas classifier
   * comme `purchase-intent`.
   */
  negate?: RegExp[];
}

/**
 * Score minimum pour qu'un intent gagne. En deçà, on retombe sur 'misc'.
 * Évite les faux positifs sur des messages qui ne contiennent qu'un
 * mot ambigu (ex. "j'ai une commande" tout seul → score 1, devient
 * 'misc' s'il n'y a pas de signal d'achat plus fort).
 */
const MIN_CONFIDENCE_SCORE = 1;

// Patterns multilingues (FR + AR-script + Darija FR-script).
const RULES: PatternRule[] = [
  {
    intent: 'greeting',
    patterns: [
      /\b(bonjour|salut|hello|hi|coucou|bonsoir)\b/i,
      /\b(salam|salem|sbah)\b/i,
      /(السلام|مرحبا|أهلا)/,
    ],
  },
  {
    intent: 'pricing',
    patterns: [
      /\b(prix|combien|coute|coûte|tarif|tarifs|cost|price|abordable)\b/i,
      /\b(chhal|kifach taman|t9awim|bch7al)\b/i,
      /(سعر|ثمن|كم)/,
    ],
  },
  // CHA-161 — Objection prix : pricing + signaux d'hésitation/cherté.
  {
    intent: 'objection-price',
    patterns: [
      /\b(trop cher|cher|abusif|abusé|c['’]est cher|hors budget|pas les moyens|réduction|promo|code promo|moins cher)\b/i,
      /\b(ghali|ghaliya|ma3andich flouss|takhfid|promo)\b/i,
      /(غالي|كثير|تخفيض)/,
    ],
  },
  // CHA-161 — Doute / efficacité : marche / vraiment / arnaque...
  {
    intent: 'objection-doubt',
    patterns: [
      /\b(ça marche|ca marche|vraiment efficace|preuve|prouvé|prouve|arnaque|scam|fake|miracle|trop beau|garantie|si ça marche pas|sinon)\b/i,
      /\b(wach kayn|ka ykhdem|3la s7i7|sahih)\b/i,
      /(فعالية|حقيقي|نصب)/,
    ],
  },
  // CHA-161 — Social proof : témoignages, avis, avant-après.
  {
    intent: 'social-proof',
    patterns: [
      /\b(avis|témoignages|temoignages|review|client|résultat|resultat|avant après|avant\/après|photo|insta|instagram|tiktok)\b/i,
      /\b(chhadat|nass jrebt|shadat dyal nass)\b/i,
      /(آراء|شهادات|نتائج)/,
    ],
  },
  // CHA-161 — Comparaison concurrent / autre marque (à décliner sans nommer).
  {
    intent: 'comparison',
    patterns: [
      /\b(comparé|compare|différence|difference|versus|vs|mieux que|à la place|alternative)\b/i,
      /\b(mou9arana|moqarana|fer9 bin)\b/i,
      /(مقارنة|الفرق)/,
    ],
  },
  // CHA-161 — B2B : revente, gros, salon, professionnel.
  {
    intent: 'b2b',
    patterns: [
      /\b(revente|revendre|grossiste|gros|distributeur|distribut|salon|esthétic|esthetic|professionn|institut|spa|cabinet)\b/i,
      /\b(b2b|whole sale|wholesale)\b/i,
      /\b(byi3|ti9niya|salon dyal)\b/i,
      /(جملة|موزع|محترف)/,
    ],
  },
  // CHA-161 — Demande explicite de rappel / contact humain.
  {
    intent: 'callback-request',
    patterns: [
      /\b(rappel|rappele|appel|appelle|téléphone|telephone|whats?app|conseill|conseiller|conseillère|parler à|parler a|humain|agent|live)\b/i,
      /\b(3yt liya|sift liya|kaykellem ma3aya|wahed humain|wahed insan)\b/i,
      /(اتصل|اتصلوا|واتساب|متصل)/,
    ],
  },
  // CHA-161 — Frustration / impatience : signaux émotionnels.
  {
    intent: 'frustration',
    patterns: [
      /\b(j['’]ai déjà demandé|encore|toujours pas|pas de réponse|n['’]importe quoi|ça suffit|tu comprends pas|on tourne en rond)\b/i,
      /\b(safi|baraka|kheliw|matb9awch)\b/i,
      /(يكفي|تكلم بصراحة)/,
    ],
  },
  {
    intent: 'shipping',
    patterns: [
      /\b(livr|expédition|delai|délai|delivery|shipping|colis|tracking)\b/i,
      /\b(toussel|wsoul|delai dyal)\b/i,
      /(توصيل|ارسال|متى)/,
    ],
  },
  // CHA-225 — Intent d'achat explicite. Doit être détecté AVANT
  // `order-status` parce que les mots clés se recouvrent ("je veux
  // commander" contient "commande"). En cas d'ambiguïté, on préfère
  // déclencher le formulaire de capture lead plutôt que de partir
  // sur un suivi de commande.
  {
    intent: 'purchase-intent',
    // Patterns FORTS — formulations exclusives, score 2.
    strong: [
      // Phrases d'achat explicite qui ne peuvent PAS vouloir dire suivi.
      /\bje\s+(veux|voudrais|souhaite|peux|vais)\s+(commander|acheter|prendre|payer)\b/i,
      /\b(j['’]?achète|j['’]?ach[eè]te|je\s+l['’]?achète|je\s+le\s+prends|je\s+les\s+prends)\b/i,
      /\b(passer|faire|valider)\s+(une\s+|la\s+)?commande\b/i,
      /\bok\s+je\s+(prends|commande|veux|achète)\b/i,
      // Darija : "bghit nshri/ntleb" et "kifach ntleb/nshri" — ces phrases
      // sont uniques au "comment commander/acheter" en darija → score 2.
      /\bbghit\s+(nshri|ntleb|nakhdo|nakhod)\b/i,
      /\bkifach\s+(ntleb|nshri|n3mel\s+commande)\b/i,
      // AR : "je veux commander/acheter".
      /(أريد\s+(أن\s+)?(أطلب|أشتري|أن\s+أشتري|أن\s+أطلب)|أطلبه|اشتريه)/,
    ],
    patterns: [
      /\bje\s+(veux|voudrais|souhaite|peux|vais)\s+(le\s+kit|votre\s+kit|ce\s+kit)\b/i,
      /\bcomment\s+(je\s+)?(commande[r]?|achète|ach[eè]ter|peux\s+commander|passer\s+commande)\b/i,
      /\b(envoyez|envoie|envoyer)[\s-]+moi\s+(le\s+)?kit\b/i,
      /\b(formulaire|tu\s+as\s+un\s+formulaire|donnez[-\s]?moi\s+(le\s+)?formulaire)\b/i,
      /\bndir\s+commande\b/i,
      /(أريد\s+(الطقم|الكيت)|كيف\s+(أطلب|أشتري))/,
    ],
    // Négateurs — si l'utilisateur parle d'une commande passée, ce
    // n'est PAS un signal d'achat (c'est `order-status`).
    negate: [
      /\bj['’]ai\s+(déjà\s+)?command[ée]\b/i,
      /\bma\s+commande\b/i, // "ma commande" = suivi
      /\bj['’]ai\s+pass[ée]?\s+(une\s+)?commande\b/i,
      /\bma\s+commande\s+est\b/i,
      /\boù\s+est\s+ma\s+commande\b/i,
    ],
  },
  {
    intent: 'routine',
    patterns: [
      /\b(rituel|routine|étape|comment utiliser|use it|application|matin|soir|posologie)\b/i,
      /\b(kifach n3mel|nesta3mel)\b/i,
      /(كيفاش|كيف استعمل)/,
    ],
  },
  {
    intent: 'ingredient',
    patterns: [
      /\b(ingredient|ingrédient|composition|paraben|silicone|naturel|bio|formula|formule|toxic)\b/i,
      /\b(mkawnat|tabi3i)\b/i,
      /(مكونات|طبيعي)/,
    ],
  },
  {
    intent: 'order-status',
    patterns: [
      // Inflected forms : "commande", "commandée", "commandés", "commandé".
      // NB : `\b...\b` ne matche pas les terminaisons accentuées (é/è) en
      // JS sans flag /u. On utilise une assertion lookahead/behind ASCII
      // pour borner correctement le mot.
      /(?<![a-zA-Zà-ÿ])(command[eé]e?s?|order|suivi|tracking|expédiée|expediee|reçue?s?|recue?s?|envoyée?s?|envoy)(?![a-zA-Zà-ÿ])/i,
      /\b(commande dyali|wach toussel)\b/i,
      /(طلب|طلبية)/,
    ],
  },
  {
    intent: 'support',
    patterns: [
      /\b(probleme|problème|aide|help|cassé|defectueux|défectueux|remboursement|retour|return|refund)\b/i,
      /\b(mochkil|3awnini)\b/i,
      /(مشكلة|مساعدة)/,
    ],
  },
];

/**
 * Score d'un intent sur un texte. Algorithme :
 *  - +1 par match dans `patterns`,
 *  - +2 par match dans `strong`,
 *  - 0 (intent invalidé) si AU MOINS un `negate` matche.
 *
 * Le scoring permet de gérer les cas ambigus :
 *   - "je veux commander le kit" → 1 strong (je veux commander) + 0
 *     standard = 2 → purchase-intent gagne.
 *   - "j'ai déjà commandé" → match dans patterns d'order-status, mais
 *     les négateurs de purchase-intent l'invalident → reste correct.
 */
function scoreIntent(rule: PatternRule, text: string): number {
  if (rule.negate?.some((p) => p.test(text))) return 0;
  let score = 0;
  for (const p of rule.strong ?? []) {
    if (p.test(text)) score += 2;
  }
  for (const p of rule.patterns) {
    if (p.test(text)) score += 1;
  }
  return score;
}

/**
 * Détection d'intent par scoring pondéré.
 *
 * - Garde l'ordre `RULES` comme tie-breaker (priorité éditoriale).
 * - Retombe sur 'misc' sous le seuil `MIN_CONFIDENCE_SCORE`.
 *
 * Reste rétro-compatible avec l'ancienne API booléenne — pour la
 * majorité des entrées, le résultat est identique.
 */
export function detectIntent(text: string): ChatIntent {
  if (!text || text.trim().length === 0) return 'misc';

  let bestIntent: ChatIntent = 'misc';
  let bestScore = 0;

  for (const rule of RULES) {
    const score = scoreIntent(rule, text);
    if (score > bestScore) {
      bestScore = score;
      bestIntent = rule.intent;
    }
  }

  return bestScore >= MIN_CONFIDENCE_SCORE ? bestIntent : 'misc';
}

/**
 * Variante avec le score retourné — utile pour les tests et le debug
 * admin. Ne fait PAS partie de l'API publique stable.
 */
export interface IntentClassification {
  intent: ChatIntent;
  score: number;
  /** Map intent → score (uniquement les non-zéro) pour le debug. */
  alternatives: Partial<Record<ChatIntent, number>>;
}

export function classifyIntent(text: string): IntentClassification {
  if (!text || text.trim().length === 0) {
    return { intent: 'misc', score: 0, alternatives: {} };
  }
  const alternatives: Partial<Record<ChatIntent, number>> = {};
  let bestIntent: ChatIntent = 'misc';
  let bestScore = 0;

  for (const rule of RULES) {
    const score = scoreIntent(rule, text);
    if (score > 0) alternatives[rule.intent] = score;
    if (score > bestScore) {
      bestScore = score;
      bestIntent = rule.intent;
    }
  }

  if (bestScore < MIN_CONFIDENCE_SCORE) {
    return { intent: 'misc', score: 0, alternatives };
  }
  return { intent: bestIntent, score: bestScore, alternatives };
}

/**
 * Heuristique horaire : si la conversation se passe en dehors des horaires
 * (lun–sam 9h–17h, fuseau MA = Africa/Casablanca = UTC+1), on tagge le
 * tour comme `after-hours` pour adapter la copy d'invite.
 *
 * On utilise UTC + offset fixe ; pas de DST en MA depuis 2018.
 */
export function isAfterHoursMA(now: Date = new Date()): boolean {
  // UTC+1 en permanence
  const local = new Date(now.getTime() + 60 * 60 * 1000);
  const day = local.getUTCDay(); // 0 dim ... 6 sam
  const h = local.getUTCHours();
  // Dimanche = fermé
  if (day === 0) return true;
  // Hors créneau 9h–17h = after-hours
  if (h < 9 || h >= 17) return true;
  return false;
}

export const intent = { detect: detectIntent, isAfterHoursMA };
