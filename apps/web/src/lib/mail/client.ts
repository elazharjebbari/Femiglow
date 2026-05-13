/**
 * SMTP transport singleton (nodemailer) pointing at Stalwart on loopback 587.
 *
 * In dev/test, `SMTP_USER` / `SMTP_PASSWORD` may be unset — `getTransporter()`
 * throws a typed error so calling code can fall back to a mock or skip cleanly.
 *
 * Cf. docs/emailing/03-backend-integration.md §3.2.
 */
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '@/lib/env';

export class SmtpNotConfiguredError extends Error {
  readonly code = 'SMTP_NOT_CONFIGURED';
  constructor(missing: string[]) {
    super(`SMTP non configuré (env manquant : ${missing.join(', ')})`);
    this.name = 'SmtpNotConfiguredError';
  }
}

let _transporter: Transporter | null = null;

function buildTransporter(): Transporter {
  const missing: string[] = [];
  if (!env.SMTP_USER) missing.push('SMTP_USER');
  if (!env.SMTP_PASSWORD) missing.push('SMTP_PASSWORD');
  if (missing.length > 0) throw new SmtpNotConfiguredError(missing);

  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    requireTLS: env.SMTP_PORT === 587,
    auth: { user: env.SMTP_USER!, pass: env.SMTP_PASSWORD! },
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    socketTimeout: 30_000,
    connectionTimeout: 10_000,
    name: 'mail.lumiereacademy.com',
  });
}

export function getTransporter(): Transporter {
  if (_transporter) return _transporter;
  _transporter = buildTransporter();
  return _transporter;
}

export function resetTransporterForTests(): void {
  _transporter = null;
}

export type SmtpVerifyResult = { ok: true } | { ok: false; error: string };

export async function verifySmtp(): Promise<SmtpVerifyResult> {
  try {
    await getTransporter().verify();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
