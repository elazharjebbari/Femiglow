/**
 * Newsletter double opt-in — point d'entrée partagé.
 *
 * UX-PUB-003 / UX-PUB-007 (campagne QA emailing, vague 4 — parcours public).
 *
 * Deux call-sites publics déclenchent EXACTEMENT le même flux double opt-in :
 *   - POST /api/newsletter            (formulaire newsletter dédié)
 *   - POST /api/contact (case cochée) (opt-in collecté dans le formulaire de
 *     contact — auparavant la case ne faisait qu'ajouter une note webhook, donc
 *     fausse promesse de consentement : l'utilisateur n'était jamais abonné).
 *
 * Le flux :
 *   1. Génère un token HMAC signé (réutilise `generateUnsubToken`).
 *   2. Construit l'URL de confirmation `/api/newsletter/confirm?t=<token>`.
 *   3. `sendTransactional('newsletter-confirm')`, idempotent par email
 *      (clé `newsletter-confirm:<email>` — pas de date : re-soumettre n'envoie
 *      pas un second mail, l'utilisateur peut re-cliquer son ancien lien).
 *
 * Contrat d'erreur (UX-PUB-007) : si `MAIL_UNSUB_TOKEN_SECRET` n'est pas
 * configuré, `generateUnsubToken` throw. On NE renvoie PAS un faux succès :
 * le résultat est `{ ok: false, reason: 'token-unavailable' }` et l'appelant
 * doit répondre une erreur actionnable (503) plutôt qu'un `ok:true` silencieux.
 */
import { env } from '@/lib/env';
import { logger } from '@/lib/logging/logger';
import { sendTransactional } from '@/lib/mail/send';
import { generateUnsubToken } from '@/lib/mail/unsub-token';

export type NewsletterOptInResult =
  | { ok: true }
  | { ok: false; reason: 'token-unavailable' };

export interface NewsletterOptInInput {
  email: string;
  /** Étiquette de provenance, ex. `footer`, `contact-form`. */
  source: string;
}

/**
 * Déclenche le double opt-in newsletter pour `email`. Le `sendTransactional`
 * reste fire-and-forget (le call-site n'attend pas l'envoi SMTP), mais la
 * génération du token est synchrone : on détecte AVANT de répondre si le
 * secret manque, pour ne jamais afficher un faux « Bienvenue ».
 */
export function triggerNewsletterDoubleOptIn(
  input: NewsletterOptInInput,
): NewsletterOptInResult {
  const email = input.email;

  let confirmUrl: string;
  try {
    const token = generateUnsubToken(email);
    confirmUrl = `${env.NEXT_PUBLIC_SITE_URL}/api/newsletter/confirm?t=${encodeURIComponent(token)}`;
  } catch {
    // MAIL_UNSUB_TOKEN_SECRET absent : aucun mail de confirmation ne peut
    // partir. On remonte l'échec à l'appelant (pas de faux succès).
    logger.warn('newsletter.confirm_token_unavailable', { source: input.source });
    return { ok: false, reason: 'token-unavailable' };
  }

  void sendTransactional({
    template: 'newsletter-confirm',
    to: { email },
    payload: { confirmUrl },
    idempotencyKey: `newsletter-confirm:${email.toLowerCase()}`,
    source: `api.newsletter.${input.source}`,
  }).catch((err: unknown) => {
    logger.error('mail.newsletter_confirm.dispatch_error', { error: String(err) });
  });

  return { ok: true };
}
