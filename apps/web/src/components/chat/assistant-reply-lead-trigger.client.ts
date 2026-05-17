'use client';

import type {
  ChatCannedPairLeadCopyKey,
  ChatLanguage,
  ChatLeadTriggerReason,
} from '@/lib/chat/contracts';

export interface ClientAssistantLeadTriggerResult {
  shouldOffer: true;
  reason: ChatLeadTriggerReason;
  copyKey: ChatCannedPairLeadCopyKey;
  source: 'client-safety-net';
  matchedPattern: string;
}

interface ClientRule {
  reason: ChatLeadTriggerReason;
  copyKey: ChatCannedPairLeadCopyKey;
  patterns: RegExp[];
}

const RULES: ClientRule[] = [
  {
    reason: 'manual',
    copyKey: 'manual',
    patterns: [
      /\b(remplissez|remplir|compl[eé]tez)\s+(le\s+)?formulaire\b/i,
      /\bformulaire\s+(ci[-\s]?dessous|juste ici|ici|en bas|de contact)\b/i,
      /\bje vous affiche\s+(le\s+)?formulaire\b/i,
      /(املئي|املأ|عبئي)\s+(ال)?استمارة/,
    ],
  },
  {
    reason: 'explicit-request',
    copyKey: 'explicit-request',
    patterns: [
      /\b(je peux|on peut|nous pouvons)\s+vous\s+(faire\s+)?rappeler\b/i,
      /\bconseill[eè]re\s+vous\s+(appellera|rappelle|contactera)\b/i,
      /\blaissez\s+(vos\s+)?coordonn[eé]es\b/i,
      /\blaissez\s+(votre\s+)?num[eé]ro\b/i,
      /\b(n3ayto|nta3yto|ghadi\s+n3ayto)\s+lik\b/i,
      /(اتركي|اترك|ضعي)\s+(رقمك|رقم الهاتف)/,
      /(سنتصل|سأتصل|تتصل)\s+بك/,
    ],
  },
  {
    reason: 'purchase-intent',
    copyKey: 'purchase-intent',
    patterns: [
      /\bpour\s+(finaliser|valider|confirmer)\s+(votre\s+)?commande\b/i,
      /\bpour\s+passer\s+commande\b/i,
      /\bfinaliser\s+l['’]?achat\b/i,
      /(لطلب|لشراء)\s+(المنتج|الكيت|الطقم)/,
    ],
  },
];

const NEGATIVE_PATTERNS = [
  /\bne\s+remplissez\s+pas\s+(le\s+)?formulaire\b/i,
  /\bpas\s+besoin\s+de\s+formulaire\b/i,
  /\bsans\s+formulaire\b/i,
  /\bexemple\s+de\s+formulaire\b/i,
];

export function detectClientAssistantLeadTrigger(
  assistantContent: string,
  _language: ChatLanguage,
): ClientAssistantLeadTriggerResult | null {
  const text = assistantContent.replace(/\s+/g, ' ').trim();
  if (!text || text.length < 8) return null;
  if (NEGATIVE_PATTERNS.some((pattern) => pattern.test(text))) return null;

  for (const rule of RULES) {
    const matched = rule.patterns.find((pattern) => pattern.test(text));
    if (matched) {
      return {
        shouldOffer: true,
        reason: rule.reason,
        copyKey: rule.copyKey,
        source: 'client-safety-net',
        matchedPattern: matched.source,
      };
    }
  }
  return null;
}
