/**
 * CHA-034 — `charterFilter`.
 *
 * Garde-fou éditorial : avant un envoi user, et après une réponse
 * agent, on vérifie que :
 * - le contenu ne sort pas du périmètre FemiGlow (médical, prix
 *   inventés, marques tierces sensibles),
 * - le ton respecte la charte (sobre, ouvert, jamais médical).
 *
 * cf. docs/chat-assistant/13-securite-rgpd-moderation.md §4
 *
 * Implémentation 100 % heuristique + listes : zéro coût provider,
 * latence négligeable. Renvoie `{ allowed, reason, rewriteHint }`.
 */

export type CharterDirection = 'inbound' | 'outbound';

export interface CharterCheck {
  allowed: boolean;
  reason?: 'medical' | 'price-claim' | 'third-party' | 'profanity' | 'system-prompt';
  rewriteHint?: string;
  detected: string[];
}

// Termes médicaux qui obligent à dévier la réponse vers un disclaimer.
const MEDICAL_TERMS = [
  'mycose',
  'eczema',
  'eczéma',
  'psoriasis',
  'cancer',
  'tumeur',
  'diabète',
  'diabete',
  'enceinte',
  'grossesse',
  'allaitement',
  'medicament',
  'médicament',
  'ordonnance',
  'prescription',
  'maladie',
  'infection',
  'douleur',
  'sang',
  'piqûre',
  'piqure',
  // arabe (latinisé darija)
  'mrid',
  'mridi',
  'sah7a',
  'tabib',
  'dwa',
  'hamel',
  'haml',
  // arabe (script)
  'مرض',
  'دواء',
  'حامل',
  'طبيب',
];

// Marques tierces qu'on ne commente pas (concurrents, ingrédients
// brevetés, etc.). Liste éditoriale — à versionner.
const THIRD_PARTY_BRANDS = [
  'opi',
  'essie',
  'mavala',
  'sephora',
  'amazon',
  'aliexpress',
  'shein',
];

// Tentatives de jailbreak / extraction d'instruction système.
const SYSTEM_PROMPT_TOKENS = [
  'ignore previous',
  'ignore all instructions',
  'tu es désormais',
  'reveal your prompt',
  'system prompt',
  'jailbreak',
  'developer mode',
  'do anything now',
  'dan mode',
];

// Affirmations de prix/promo non vérifiées (à faire valider par le
// CMS produits — ici on bloque par défaut côté agent).
const PRICE_CLAIM_TOKENS = [
  '% de réduction',
  'gratuit',
  'rembourse',
  'remboursement',
  'cashback',
];

// Insultes / vulgarité — minimal, évite false positives. Liste à
// expanser dans l'admin (CHA-120).
const PROFANITY = ['putain', 'merde', 'connard', 'salope'];

function findHits(text: string, list: string[]): string[] {
  const lc = text.toLowerCase();
  return list.filter((t) => lc.includes(t));
}

/**
 * Inbound : analyse un message visiteur. La majorité des cas passent ;
 * on signale seulement les jailbreaks et la profanité dure.
 */
export function checkInbound(text: string): CharterCheck {
  const systemHits = findHits(text, SYSTEM_PROMPT_TOKENS);
  if (systemHits.length > 0) {
    return {
      allowed: false,
      reason: 'system-prompt',
      detected: systemHits,
      rewriteHint:
        "Je ne peux pas modifier mes consignes. Je peux par contre vous aider sur le rituel ou la commande FemiGlow.",
    };
  }
  const medical = findHits(text, MEDICAL_TERMS);
  // Médical inbound : on autorise mais on prévient l'orchestrator pour
  // injecter le disclaimer médical dans la réponse.
  if (medical.length > 0) {
    return {
      allowed: true,
      reason: 'medical',
      detected: medical,
      rewriteHint:
        "Le visiteur évoque un sujet santé : répondre avec un disclaimer non-médical et inviter à consulter un professionnel.",
    };
  }
  return { allowed: true, detected: [] };
}

/**
 * Outbound : analyse une réponse agent (texte agrégé final). Bloque
 * les contenus médicaux affirmatifs ou les comparaisons concurrents.
 */
export function checkOutbound(text: string): CharterCheck {
  const medical = findHits(text, MEDICAL_TERMS);
  const profanity = findHits(text, PROFANITY);
  const thirdParty = findHits(text, THIRD_PARTY_BRANDS);
  const priceClaim = findHits(text, PRICE_CLAIM_TOKENS);

  // Priorité : médical (risque le plus élevé) > tiers > prix > profanité.
  if (medical.length > 0) {
    // On autorise SI un disclaimer est présent (regex large).
    const hasDisclaimer = /(consult|professionnel|médecin|dermatologue|tabib)/i.test(text);
    if (!hasDisclaimer) {
      return {
        allowed: false,
        reason: 'medical',
        detected: medical,
        rewriteHint:
          "Réponse contient un terme médical sans disclaimer. Réécrire avec « pour toute question santé, consultez un professionnel ».",
      };
    }
  }
  if (thirdParty.length > 0) {
    return {
      allowed: false,
      reason: 'third-party',
      detected: thirdParty,
      rewriteHint:
        "Ne pas comparer aux marques tierces. Centrer la réponse sur l'expérience FemiGlow.",
    };
  }
  if (priceClaim.length > 0) {
    return {
      allowed: false,
      reason: 'price-claim',
      detected: priceClaim,
      rewriteHint:
        "Ne pas annoncer de prix ou promotion non vérifiée. Renvoyer vers /kit pour les conditions actuelles.",
    };
  }
  if (profanity.length > 0) {
    return {
      allowed: false,
      reason: 'profanity',
      detected: profanity,
      rewriteHint: "Réécrire sans profanité.",
    };
  }
  return { allowed: true, detected: [] };
}

export const charterFilter = {
  inbound: checkInbound,
  outbound: checkOutbound,
};
