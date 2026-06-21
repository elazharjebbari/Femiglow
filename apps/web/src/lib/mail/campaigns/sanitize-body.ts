/**
 * Sanitization du corps libre d'une campagne (F05 P3.3-a, sécurité G12).
 *
 * Le corps HTML saisi dans le wizard est envoyé à Listmonk (test-send via
 * /api/tx ET envoi de masse via campaigns.create, content_type=html). Même
 * rédigé par un admin, il est sanitizé en DÉFENSE EN PROFONDEUR : neutralise
 * script/iframe/handlers `on*`/`javascript:`/CSS exécutable avant qu'ils
 * n'atteignent une boîte de réception (le test-send livre dans une VRAIE boîte).
 *
 * Réutilise la SEULE implémentation de sanitization e-mail (DOMPurify durci,
 * R-017) — single source (G15) — en mode FRAGMENT : le corps est inséré dans
 * l'enveloppe du template, on ne le réécrit pas en document complet.
 *
 * CONTRAT : les merge-tags Listmonk `{{ … }}` sont PRÉSERVÉS (texte et attributs
 * `href`/`src`) — la personnalisation ne doit jamais être cassée par la sécurité.
 */
import { sanitizeEmailHtml } from '@/lib/mail/templates/custom/sanitize';

export function sanitizeCampaignBody(html: string): string {
  return sanitizeEmailHtml(html, { wholeDocument: false });
}
