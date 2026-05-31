/**
 * Sanitization du `body` d'un témoignage avant insert / publication.
 * Cf. docs/reviews-wall/execution/04-backend-plan-action.md § 5.1
 */

export interface SanitizeResult {
  sanitized: string;
  flags: string[];
}

const EMOJI_PATTERN =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}]/gu;

// Espace fine insécable U+202F (typo française devant : ; ? !)
const NARROW_NBSP = ' ';

export function sanitizeBody(input: string): SanitizeResult {
  let body = (input ?? '').toString();
  const flags: string[] = [];

  // 1. NFC normalize
  body = body.normalize('NFC');

  // 2. Strip emojis
  if (EMOJI_PATTERN.test(body)) {
    flags.push('emoji_detected');
    body = body.replace(EMOJI_PATTERN, '');
  }

  // 3. Apostrophes courbes
  body = body.replace(/'/g, '’');

  // 4. Espaces fines insécables devant : ; ? !
  // Exclut les URLs (`://`) et les `:` suivis d'un mot/chiffre (heures, ratios…)
  body = body.replace(/(\S)[ \t]?([:;?!])(?!\/)/g, `$1${NARROW_NBSP}$2`);

  // 5. Trim + collapse spaces ASCII consécutifs (préserve U+202F)
  body = body.trim().replace(/[ \t]{2,}/g, ' ');

  return { sanitized: body, flags };
}
