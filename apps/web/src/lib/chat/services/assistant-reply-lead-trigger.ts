import type {
  ChatCannedPairLeadCopyKey,
  ChatLanguage,
  ChatLeadTriggerReason,
} from '../contracts';
import type { ChatIntent } from './intent';

export type AssistantLeadTriggerSource =
  | 'assistant-reply-form'
  | 'assistant-reply-callback'
  | 'assistant-reply-purchase'
  | 'assistant-reply-human'
  | 'assistant-reply-inline-contact'
  | 'assistant-reply-out-of-knowledge'
  | 'assistant-reply-b2b';

export interface AssistantReplyLeadTriggerInput {
  assistantReply: string;
  currentIntent: ChatIntent;
  language: ChatLanguage;
}

export interface AssistantReplyLeadTriggerResult {
  shouldOffer: boolean;
  reason?: ChatLeadTriggerReason;
  copyKey?: ChatCannedPairLeadCopyKey;
  source?: AssistantLeadTriggerSource;
  confidence: 'none' | 'low' | 'medium' | 'high';
  matchedPatterns: string[];
}

interface TriggerRule {
  id: AssistantLeadTriggerSource;
  reason: ChatLeadTriggerReason;
  copyKey: ChatCannedPairLeadCopyKey;
  confidence: 'medium' | 'high';
  patterns: RegExp[];
}

const RULES: TriggerRule[] = [
  {
    id: 'assistant-reply-form',
    reason: 'manual',
    copyKey: 'manual',
    confidence: 'high',
    patterns: [
      /\b(remplissez|remplir|completez|compl[eé]tez|ouvrez|utilisez)\s+(le\s+)?formulaire\b/i,
      /\bformulaire\s+(ci[-\s]?dessous|juste ici|ici|en bas|de contact)\b/i,
      /\bje vous affiche\s+(le\s+)?formulaire\b/i,
      /\bcliquez sur\s+(le\s+)?(bouton|formulaire)\b/i,
      /\btu as un formulaire\b/i,
      /\b3tini\s+(smiytek|smitk)\b/i,
      /\bformulaire\b.*\b(n3ayto|nta3yto|rappel|appell)/i,
      /(املئي|املأ|عبئي)\s+(ال)?استمارة/,
    ],
  },
  {
    id: 'assistant-reply-callback',
    reason: 'explicit-request',
    copyKey: 'explicit-request',
    confidence: 'high',
    patterns: [
      /\b(je peux|on peut|nous pouvons)\s+vous\s+(faire\s+)?rappeler\b/i,
      /\b(une|notre)\s+conseill[eè]re\s+vous\s+(appellera|rappelle|contactera)\b/i,
      /\bon\s+vous\s+rappelle\b/i,
      /\blaissez\s+(vos\s+)?coordonn[eé]es\b/i,
      /\blaissez\s+(votre\s+)?num[eé]ro\b/i,
      /\bvotre\s+num[eé]ro\s+(de\s+t[eé]l[eé]phone)?\b/i,
      /\bdonnez[-\s]?moi\s+votre\s+(pr[eé]nom|nom).{0,80}(t[eé]l[eé]phone|num[eé]ro)\b/i,
      /\b(n3ayto|nta3yto|ghadi\s+n3ayto)\s+lik\b/i,
      /\b(khalli|khelli)\s+(numero|num[eé]ro)\b/i,
      /(اتركي|اترك|ضعي)\s+(رقمك|رقم الهاتف)/,
      /(سنتصل|سأتصل|تتصل)\s+بك/,
      /مستشارة/,
    ],
  },
  {
    id: 'assistant-reply-purchase',
    reason: 'purchase-intent',
    copyKey: 'purchase-intent',
    confidence: 'medium',
    patterns: [
      /\bpour\s+(finaliser|valider|confirmer)\s+(votre\s+)?commande\b/i,
      /\bpour\s+passer\s+commande\b/i,
      /\bfinaliser\s+l['’]?achat\b/i,
      /\br[eé]server\s+(le\s+)?(kit|rituel)\b/i,
      /\bcommander\s+(le\s+)?(kit|rituel|produit)\b/i,
      /(لطلب|لشراء)\s+(المنتج|الكيت|الطقم)/,
    ],
  },
  {
    id: 'assistant-reply-human',
    reason: 'explicit-request',
    copyKey: 'explicit-request',
    confidence: 'medium',
    patterns: [
      /\bje\s+(transmets|passe)\s+votre\s+demande\b/i,
      /\bparler\s+(avec|a|à)\s+(une\s+)?(conseill[eè]re|personne|agent|humain)\b/i,
      /\bune\s+personne\s+de\s+l['’]equipe\s+vous\s+contacte\b/i,
    ],
  },
  {
    id: 'assistant-reply-out-of-knowledge',
    reason: 'out-of-knowledge',
    copyKey: 'out-of-knowledge',
    confidence: 'medium',
    patterns: [
      /\bje pr[eé]f[eè]re qu['’]une conseill[eè]re confirme\b/i,
      /\bje n['’]ai pas cette information.{0,120}(conseill[eè]re|rappeler|formulaire)\b/i,
      /\bpas assez d['’]informations?.{0,120}(conseill[eè]re|rappeler|formulaire)\b/i,
    ],
  },
  {
    id: 'assistant-reply-b2b',
    reason: 'b2b',
    copyKey: 'b2b',
    confidence: 'medium',
    patterns: [
      /\b(revente|revendeur|grossiste|distributeur|salon|institut).{0,120}(formulaire|coordonn[eé]es|rappel|conseill[eè]re)\b/i,
      /\bformulaire.{0,120}(pro|professionnel|b2b|grossiste|distributeur)\b/i,
    ],
  },
];

const NEGATIVE_PATTERNS = [
  /\bne\s+remplissez\s+pas\s+(le\s+)?formulaire\b/i,
  /\bpas\s+besoin\s+de\s+formulaire\b/i,
  /\bsans\s+formulaire\b/i,
  /\bexemple\s+de\s+formulaire\b/i,
];

export function detectAssistantReplyLeadTrigger(
  input: AssistantReplyLeadTriggerInput,
): AssistantReplyLeadTriggerResult {
  const text = input.assistantReply.replace(/\s+/g, ' ').trim();
  if (!text || text.length < 8) {
    return { shouldOffer: false, confidence: 'none', matchedPatterns: [] };
  }
  if (NEGATIVE_PATTERNS.some((pattern) => pattern.test(text))) {
    return { shouldOffer: false, confidence: 'none', matchedPatterns: [] };
  }

  const matches: Array<{
    rule: TriggerRule;
    patterns: string[];
  }> = [];

  for (const rule of RULES) {
    const matchedPatterns = rule.patterns
      .filter((pattern) => pattern.test(text))
      .map((pattern) => pattern.source);
    if (matchedPatterns.length > 0) {
      matches.push({ rule, patterns: matchedPatterns });
    }
  }

  if (matches.length === 0) {
    return { shouldOffer: false, confidence: 'none', matchedPatterns: [] };
  }

  matches.sort((a, b) => confidenceRank(b.rule.confidence) - confidenceRank(a.rule.confidence));
  const best = matches[0]!;
  const confidence =
    best.rule.confidence === 'high' || matches.length > 1 ? 'high' : 'medium';

  return {
    shouldOffer: confidence === 'high' || confidence === 'medium',
    reason: refineReason(best.rule.reason, input.currentIntent),
    copyKey: refineCopyKey(best.rule.copyKey, input.currentIntent),
    source: best.rule.id,
    confidence,
    matchedPatterns: best.patterns.slice(0, 5),
  };
}

function refineReason(
  fallback: ChatLeadTriggerReason,
  currentIntent: ChatIntent,
): ChatLeadTriggerReason {
  if (currentIntent === 'purchase-intent') return 'purchase-intent';
  if (currentIntent === 'callback-request') return 'explicit-request';
  if (currentIntent === 'b2b') return 'b2b';
  if (currentIntent === 'frustration') return 'frustration';
  return fallback;
}

function refineCopyKey(
  fallback: ChatCannedPairLeadCopyKey,
  currentIntent: ChatIntent,
): ChatCannedPairLeadCopyKey {
  if (currentIntent === 'purchase-intent') return 'purchase-intent';
  if (currentIntent === 'callback-request') return 'explicit-request';
  if (currentIntent === 'b2b') return 'b2b';
  if (currentIntent === 'frustration') return 'manual';
  return fallback;
}

function confidenceRank(value: 'medium' | 'high'): number {
  return value === 'high' ? 2 : 1;
}
