/**
 * CS v2 create-audit Phase 6 — Map server-known error codes to operator-
 * friendly messages, so toasts don't read like "Publication : HTTP 409".
 *
 * Codes we know about today live in this map. Unknown codes fall back to
 * the server-supplied `message` (still preferred over a raw HTTP status).
 */

export const ERROR_MESSAGES: Record<string, string> = {
  budget_exceeded: 'Budget IA quotidien atteint.',
  brand_review_blocked: 'Le contenu est bloqué par la revue brand.',
  no_media_attached: 'Aucun média attaché au draft.',
  no_account_connected: 'Aucun compte social connecté.',
  session_expired: 'Session expirée, veuillez vous reconnecter.',
  rate_limit_exceeded: 'Trop de requêtes, réessayez dans un instant.',
  provider_down: 'Provider indisponible.',
  version_conflict: 'Le draft a été modifié ailleurs. Rechargez la page.',
  min_lead_time: 'La date doit être au moins 5 minutes dans le futur.',
  invalid_state: 'État de draft invalide pour cette action.',
  invalid_input: 'Requête invalide.',
  not_found: 'Ressource introuvable.',
  forbidden: 'Action non autorisée.',
  unauthorized: 'Session expirée, veuillez vous reconnecter.',
};

interface ErrorLike {
  code?: unknown;
  message?: unknown;
}

/**
 * Resolve a user-facing message from a server error envelope, a raw Error,
 * or any unknown value. Returns a stable fallback string when nothing
 * useful is available.
 */
export function formatError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as ErrorLike;
    if (typeof e.code === 'string') {
      const mapped = ERROR_MESSAGES[e.code];
      if (mapped) return mapped;
      if (typeof e.message === 'string' && e.message.length > 0) return e.message;
      return `Erreur : ${e.code}`;
    }
    if (typeof e.message === 'string' && e.message.length > 0) return e.message;
  }
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'Une erreur est survenue.';
}
