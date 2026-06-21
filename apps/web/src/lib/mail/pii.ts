/**
 * Minimisation PII pour les journaux/audit e-mail (F05-S P3.3-c, G12/G14).
 *
 * Les journaux d'audit sont consultés largement (ops, support) → on n'y écrit
 * pas l'adresse destinataire en clair. `maskEmail` conserve juste assez pour la
 * traçabilité (1re lettre du local + domaine) en masquant le reste.
 *
 *   jane.doe@gmail.com → j***@gmail.com
 *
 * NB : l'`actorId` (l'admin opérateur) n'est PAS concerné — c'est de la
 * responsabilité/traçabilité, pas une donnée client à minimiser.
 */
export function maskEmail(email: string): string {
  if (typeof email !== 'string') return '***';
  const at = email.indexOf('@');
  // Pas une adresse exploitable → ne rien divulguer.
  if (at <= 0 || at === email.length - 1) return '***';
  const head = email[0] ?? '';
  const domain = email.slice(at + 1);
  return `${head}***@${domain}`;
}
