/**
 * Détection des auto-flags (signaux non bloquants élevant la priorité).
 * Cf. docs/reviews-wall/execution/04-backend-plan-action.md § 5.2
 */

const DEFAULT_FORBIDDEN_WORDS = new Set<string>([
  // À étendre depuis app_config en production
  'miracle',
  'instantané',
]);

export interface AutoFlagsOptions {
  forbiddenWords?: Iterable<string>;
}

export function detectAutoFlags(
  body: string,
  options: AutoFlagsOptions = {},
): string[] {
  const flags: string[] = [];
  if (!body) return flags;

  if (/https?:\/\/|www\./i.test(body)) flags.push('link_external');
  if (/\S+@\S+\.\S+/i.test(body)) flags.push('email_in_body');
  if (/(\+212|^0[567])\d{7,}/m.test(body)) flags.push('phone_in_body');
  if (body.length < 80) flags.push('body_short');
  if (body.length > 500) flags.push('body_long');

  const letters = body.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letters.length > 8) {
    const uppers = letters.replace(/[^A-ZÀ-Ý]/g, '');
    if (uppers.length / letters.length > 0.5) flags.push('all_caps');
  }

  if (/(.)\1{5,}/.test(body)) flags.push('repetition');

  const forbidden = options.forbiddenWords
    ? new Set(options.forbiddenWords)
    : DEFAULT_FORBIDDEN_WORDS;
  for (const word of forbidden) {
    if (new RegExp(`\\b${word}\\b`, 'i').test(body)) {
      flags.push('forbidden_word');
      break;
    }
  }

  return flags;
}
