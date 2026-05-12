import { createHash } from 'node:crypto';

/**
 * Hash d'identifiant client (e-mail) avec pepper serveur.
 * Cf. docs/reviews-wall/execution/04-backend-plan-action.md § 7
 */
export function hashCustomerEmail(email: string): string {
  const pepper = process.env.RITUAL_PEPPER ?? '';
  const normalized = email.trim().toLowerCase();
  return createHash('sha256').update(`${normalized}|${pepper}`).digest('hex');
}
