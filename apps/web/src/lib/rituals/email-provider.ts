/**
 * Interface email transactionnel + implémentations.
 * Cf. docs/reviews-wall/execution/04-backend-plan-action.md § 9.2
 *
 * Trois providers :
 *  - consoleEmailProvider : log structuré (default dev/test)
 *  - resendEmailProvider : Resend HTTP API (si RESEND_API_KEY défini)
 *  - noopProvider : ignore (utile pour tests qui ne veulent pas d'I/O)
 */

import type { RenderedEmail } from './email-templates';

export interface SendEmailInput {
  to: string;
  rendered: RenderedEmail;
}

export interface EmailProvider {
  name: string;
  send(input: SendEmailInput): Promise<{ ok: boolean; messageId?: string; error?: string }>;
}

export const consoleEmailProvider: EmailProvider = {
  name: 'console',
  async send({ to, rendered }) {
    /* eslint-disable no-console */
    console.warn('[email/console]', {
      to,
      subject: rendered.subject,
      from: rendered.from,
      replyTo: rendered.replyTo,
      bodyPreview: rendered.body.slice(0, 120),
    });
    /* eslint-enable no-console */
    return { ok: true, messageId: `console-${Date.now()}` };
  },
};

export const noopProvider: EmailProvider = {
  name: 'noop',
  async send() {
    return { ok: true, messageId: 'noop' };
  },
};

/**
 * Resend — appel HTTP simple (pas de dépendance npm).
 * cf. https://resend.com/docs/api-reference/emails/send-email
 */
export function createResendProvider(apiKey: string): EmailProvider {
  return {
    name: 'resend',
    async send({ to, rendered }) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: rendered.from,
            to,
            subject: rendered.subject,
            text: rendered.body,
            reply_to: rendered.replyTo,
          }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { message?: string };
          return { ok: false, error: err.message ?? `HTTP ${res.status}` };
        }
        const data = (await res.json()) as { id?: string };
        return { ok: true, messageId: data.id };
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) };
      }
    },
  };
}

/**
 * Sélection automatique selon les env vars disponibles :
 *  - RESEND_API_KEY → Resend
 *  - NODE_ENV=test → noop
 *  - sinon → console
 */
export function getEmailProvider(): EmailProvider {
  if (process.env.NODE_ENV === 'test') return noopProvider;
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) return createResendProvider(resendKey);
  return consoleEmailProvider;
}
