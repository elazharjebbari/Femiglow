import type { ContentBrandReview, ContentBrandViolation, ContentDraft } from './types';
import { createId } from '@/lib/ids';

export const BRAND_RULES_VERSION = '2026-05-14';

const BLOCKED_TERMS = [
  'révolutionnaire',
  'revolutionnaire',
  'miracle',
  'incroyable',
  'wow',
  'offre flash',
  'soldes',
  'dépêchez-vous',
  'depechez-vous',
  'résultat garanti',
  'resultat garanti',
  'ongles parfaits',
];

const WARNING_TERMS = ['acheter maintenant', 'add to cart', 'deal', 'promo'];
const EMOJI_RE = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;

export function reviewDraftContent(draft: Pick<ContentDraft, 'id' | 'caption' | 'hashtags'>): ContentBrandReview {
  const text = draft.caption.toLowerCase();
  const violations: ContentBrandViolation[] = [];

  for (const term of BLOCKED_TERMS) {
    if (text.includes(term)) {
      violations.push({
        severity: 'blocked',
        rule: 'blocked_term',
        message: `Terme interdit détecté : "${term}".`,
      });
    }
  }

  for (const term of WARNING_TERMS) {
    if (text.includes(term)) {
      violations.push({
        severity: 'warning',
        rule: 'avoid_term',
        message: `Formulation à éviter : "${term}".`,
      });
    }
  }

  if (draft.caption.includes('!')) {
    violations.push({
      severity: 'blocked',
      rule: 'punctuation_exclamation',
      message: 'La maison évite les points d’exclamation.',
    });
  }

  if (EMOJI_RE.test(draft.caption)) {
    violations.push({
      severity: 'blocked',
      rule: 'emoji',
      message: 'Les emojis ne sont pas autorisés dans la voix FemiGlow.',
    });
  }

  if (draft.hashtags.length > 12) {
    violations.push({
      severity: 'warning',
      rule: 'too_many_hashtags',
      message: 'Limiter les hashtags pour préserver la sobriété.',
    });
  }

  const blocked = violations.some((v) => v.severity === 'blocked');
  const warning = violations.some((v) => v.severity === 'warning');
  const scoreTotal = Math.max(
    0,
    100 -
      violations.reduce((acc, v) => acc + (v.severity === 'blocked' ? 35 : 12), 0),
  );

  return {
    id: createId('cbr'),
    draftId: draft.id,
    status: blocked ? 'blocked' : warning ? 'warning' : 'pass',
    scoreTotal,
    score: {
      lexical: blocked ? 40 : warning ? 78 : 96,
      tone: warning ? 78 : 94,
      claims: blocked ? 35 : 92,
      platform: draft.hashtags.length > 12 ? 70 : 92,
    },
    violations,
    reviewerId: null,
    reviewType: 'auto' as const,
    rulesVersion: BRAND_RULES_VERSION,
    createdAt: new Date(),
  };
}
